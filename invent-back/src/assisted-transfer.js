const {fail,integer,serials}=require("./errors");
const {transaction}=require("./database");
const {product,technician,record,syncStock}=require("./inventory");
async function classify(db,codes,techId){
 const rows=(await db.query(`SELECT e.codigo_serial,e.produto_id,e.tecnico_id,e.status,e.arquivado,p.nome AS modelo,p.categoria,t.nome AS tecnico
 FROM equipamentos_seriais e JOIN produtos p ON p.id=e.produto_id LEFT JOIN tecnicos t ON t.id=e.tecnico_id
 WHERE e.codigo_serial=ANY($1::text[])`,[codes])).rows;
 const existing=new Map(rows.map(r=>[r.codigo_serial,r]));
 const absent=codes.filter(c=>!existing.has(c));
 const previous=new Set(absent.length?(await db.query("SELECT DISTINCT codigo_serial FROM eventos_seriais WHERE codigo_serial=ANY($1::text[])",[absent])).rows.map(r=>r.codigo_serial):[]);
 return codes.map(c=>{
  const row=existing.get(c);
  if(!row)return {codigo_serial:c,estado:previous.has(c)?"historico":"novo"};
  const estado=row.arquivado?"bloqueado":row.status==="MATRIZ"?"matriz":row.status==="TECNICO"&&row.tecnico_id===techId?"ja_na_carga":"bloqueado";
  return {...row,estado};
 });
}
async function preview(pool,body){
 const techId=integer(body.tecnico_id,"Técnico"),codes=serials(body.seriais);
 const active=await pool.query("SELECT id FROM tecnicos WHERE id=$1 AND ativo=true",[techId]);
 if(!active.rowCount)fail(404,"Técnico ativo não encontrado.");
 return {tecnico_id:techId,items:await classify(pool,codes,techId)};
}
async function transfer(pool,body){
 const techId=integer(body.tecnico_id,"Técnico");
 if(!Array.isArray(body.items))fail(400,"Confira os equipamentos antes de transferir.");
 const codes=serials(body.items.map(x=>x?.codigo_serial));
 const input=new Map(body.items.map(x=>[x.codigo_serial.trim(),x]));
 if(body.items.some(x=>!["matriz","novo","ja_na_carga"].includes(x.estado)))fail(400,"Remova os itens bloqueados antes de confirmar.");
 const expected=new Map(body.items.map(x=>[x.codigo_serial.trim(),integer(x.produto_id,"Modelo")]));
 if(body.items.some(x=>x.estado==="novo")&&body.confirmar_entrada_direta!==true)fail(400,"Confirme expressamente o cadastro direto dos equipamentos não encontrados.");
 return transaction(pool,async db=>{
  await technician(db,techId);
  for(const id of [...new Set(expected.values())].sort((a,b)=>a-b)){
   const p=await product(db,id);
   if(!["RASTREADOR","TAG"].includes(p.categoria))fail(400,"A transferência assistida aceita modelos de rastreador ou TAG.");
  }
  const current=await classify(db,codes,techId);
  const groups=new Map();let skipped=0,transferred=0,created=0;
  for(const row of current){
   const chosen=input.get(row.codigo_serial),id=expected.get(row.codigo_serial);
   if(row.estado==="ja_na_carga"&&row.produto_id===id){skipped++;continue;}
   if(row.estado!==chosen.estado||row.estado==="matriz"&&row.produto_id!==id||!["matriz","novo"].includes(row.estado))
    fail(409,"A situação de um equipamento mudou ou está bloqueada. Reconferir o lote; nenhuma alteração foi gravada.");
   const group=groups.get(id)||{matrix:[],direct:[]};
   group[row.estado==="matriz"?"matrix":"direct"].push(row.codigo_serial);groups.set(id,group);
  }
  for(const [id,g] of groups){
   if(g.matrix.length){
    const result=await db.query("UPDATE equipamentos_seriais SET status='TECNICO',tecnico_id=$1,arquivado=false,data_atualizacao=CURRENT_TIMESTAMP WHERE codigo_serial=ANY($2::text[]) AND produto_id=$3 AND status='MATRIZ' AND NOT arquivado",[techId,g.matrix,id]);
    if(result.rowCount!==g.matrix.length)fail(409,"O estoque mudou. Confira o lote novamente.");
    await record(db,"CARGA_TECNICO",id,techId,g.matrix,"MATRIZ","TECNICO");
    transferred+=g.matrix.length;
   }
   if(g.direct.length){
    await db.query("INSERT INTO equipamentos_seriais(codigo_serial,produto_id,tecnico_id,status) SELECT unnest($1::text[]),$2,$3,'TECNICO'",[g.direct,id,techId]);
    await record(db,"ENTRADA_DIRETA_TECNICO",id,techId,g.direct,null,"TECNICO");
    created+=g.direct.length;
   }
  }
  await syncStock(db,[...groups.keys()]);
  return {success:true,transferidos:transferred,cadastrados_diretamente:created,ja_na_carga:skipped,total:transferred+created,alerta:created>0?"Equipamentos cadastrados diretamente na carga, sem entrada anterior na matriz.":null};
 });
}
module.exports={preview,transfer};

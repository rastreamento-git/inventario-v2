import {useState,lazy} from "react";
import {Truck,AlertTriangle,CheckCircle2,X,RefreshCw} from "lucide-react";
import {api,errorMessage} from "../lib/api";
import {notify,confirmAction} from "../lib/feedback";
const LeitorSeriais=lazy(()=>import("./LeitorSeriais"));
const labels={matriz:"Disponível na matriz",novo:"Não cadastrado · entrada direta",ja_na_carga:"Já está com este técnico",bloqueado:"Bloqueado",historico:"Serial com histórico · não reativar"};
export default function TransferenciaAssistida({produtos,tecnicos,reload}){
 const [tech,setTech]=useState(""),[codes,setCodes]=useState([]),[preview,setPreview]=useState(null),[models,setModels]=useState({}),[busy,setBusy]=useState(false),[error,setError]=useState(""),[receipt,setReceipt]=useState(null),[defaultModel,setDefaultModel]=useState(""),[importing,setImporting]=useState(false);
 const [filter,setFilter]=useState("todos");
 const validModels=produtos.filter(p=>["RASTREADOR","TAG"].includes(p.categoria));
 const update=next=>{setCodes(next);setFilter("todos");setPreview(null);setError("");setReceipt(null)};
 const changeTech=id=>{setTech(id);setFilter("todos");setPreview(null);setError("");setReceipt(null)};
 const rows=preview?.items||[],blocked=rows.filter(r=>["bloqueado","historico"].includes(r.estado)),missing=rows.filter(r=>r.estado==="novo"),ready=rows.filter(r=>r.estado==="matriz"),skipped=rows.filter(r=>r.estado==="ja_na_carga");
 const byCode=new Map(rows.map(r=>[r.codigo_serial,r]));
 const visibleCodes=codes.filter(code=>filter==="todos"||(filter==="bloqueados"?["bloqueado","historico"].includes(byCode.get(code)?.estado):byCode.get(code)?.estado===filter));
 const modelFor=r=>r.estado==="novo"?models[r.codigo_serial]||defaultModel:r.produto_id;
 const canSubmit=!!preview&&!blocked.length&&rows.every(r=>modelFor(r))&&ready.length+missing.length>0&&!busy&&!importing;
 async function review(){
  if(!tech||!codes.length||busy||importing)return;
  setBusy(true);setError("");setFilter("todos");setPreview(null);setReceipt(null);
  try{const {data}=await api.post("/transferencia-assistida/conferir",{tecnico_id:tech,seriais:codes});setPreview(data);setModels({});}
  catch(e){setError(e.response?.status===404?"A API de conferência não está disponível nesta versão da homologação. Atualize o backend integrado ao ZenControl e tente novamente.":errorMessage(e));}finally{setBusy(false);}
 }
 async function transfer(){
  if(!canSubmit)return;
  setBusy(true);setError("");
  try{
   if(!(await confirmAction(missing.length?("Atenção: "+missing.length+" equipamento(s) não existem no estoque. Serão cadastrados diretamente na carga do técnico escolhido, sem reduzir a matriz. Confirma a entrada direta e a transferência dos demais?"):("Confirmar a transferência de "+ready.length+" equipamento(s) da matriz para o técnico selecionado?"))))return;
   const {data}=await api.post("/transferencia-assistida/confirmar",{tecnico_id:tech,items:rows.map(r=>({codigo_serial:r.codigo_serial,estado:r.estado,produto_id:modelFor(r)})),confirmar_entrada_direta:missing.length>0});
   setReceipt(data);setCodes([]);setFilter("todos");setPreview(null);setModels({});setDefaultModel("");notify(data.alerta||"Transferência concluída!");reload();
  }catch(e){setError(e.response?.status===404?"A API de confirmação não está disponível nesta versão da homologação. Verifique o backend antes de repetir a operação.":errorMessage(e));setFilter("todos");setPreview(null);}finally{setBusy(false);}
 }
 return <div className="zen-assisted" aria-busy={busy||importing}>
  <fieldset disabled={busy} className="zen-assisted-panel">
   <h2 className="text-xl font-bold flex items-center gap-2"><Truck size={22}/> Carga assistida</h2>
   <p className="text-sm zen-assisted-muted my-3">Escolha o técnico e leia os seriais. O sistema identifica os modelos automaticamente, inclusive lotes mistos.</p>
   <label className="block text-sm font-medium mb-4">Técnico de destino<select className="w-full p-3 border rounded-xl mt-2" value={tech} onChange={e=>changeTech(e.target.value)}><option value="">Selecione o técnico...</option>{tecnicos.filter(t=>t.ativo!==false).map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
   <LeitorSeriais seriais={codes} setSeriais={update} onImportBusyChange={setImporting}/>
  </fieldset>
  <fieldset disabled={busy} className="zen-assisted-panel space-y-4">
   <div className="flex items-center justify-between gap-2 flex-wrap"><h3 className="font-bold text-lg">Conferência do lote · {codes.length}</h3><button type="button" className="text-sm underline" disabled={!codes.length||importing} onClick={()=>update([])}>Limpar lote</button></div>
   {receipt&&<div role="status" className="zen-assisted-alert" data-tone="success"><CheckCircle2 size={19}/> Carga concluída: {receipt.transferidos} transferidos, {receipt.cadastrados_diretamente} cadastrados diretamente, {receipt.ja_na_carga} já estavam na carga.{receipt.alerta&&<p className="font-bold mt-2">{receipt.alerta}</p>}</div>}
   {error&&<p role="alert" className="zen-assisted-alert font-medium" data-tone="error">{error}</p>}
   {!preview&&!receipt&&<p className="text-sm zen-assisted-muted">Após a leitura, confira o lote para identificar automaticamente os equipamentos.</p>}
   {preview&&<><div className="grid grid-cols-2 gap-2 text-sm">
    {[["Na matriz",ready.length,"matriz"],["Não cadastrados",missing.length,"novo"],["Já na carga",skipped.length,"ja_na_carga"],["Bloqueados",blocked.length,"bloqueados"]].map(([name,n,state])=><button type="button" key={state} className="zen-assisted-metric" aria-pressed={filter===state} onClick={()=>setFilter(filter===state?"todos":state)}><strong className="text-lg tabular-nums">{n}</strong><p>{name}</p></button>)}
   </div>
   {missing.length>0&&<div role="alert" className="zen-assisted-alert" data-tone="warning"><strong className="flex items-center gap-2"><AlertTriangle size={18}/> Entrada direta: {missing.length} equipamento(s)</strong><p className="text-sm mt-1">Não foram localizados. Informe o modelo de cada item; não haverá baixa da matriz para esses códigos.</p><label className="block text-sm mt-2">Modelo padrão apenas para novos seriais<select className="w-full border rounded-lg p-2" value={defaultModel} onChange={e=>setDefaultModel(e.target.value)}><option value="">Selecionar individualmente</option>{validModels.map(p=><option key={p.id} value={p.id}>{p.categoria} · {p.nome}</option>)}</select></label></div>}
   {blocked.length>0&&<p role="alert" className="zen-assisted-alert text-sm" data-tone="error">Remova os bloqueados do lote. Equipamentos instalados, em triagem, sucata, com outro técnico ou com histórico de cancelamento não podem ser recadastrados automaticamente.</p>}</>}
   {preview&&<div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span role="status" className="zen-assisted-muted">Exibindo {visibleCodes.length} de {codes.length} seriais</span>{filter!=="todos"&&<button type="button" className="underline" onClick={()=>setFilter("todos")}>Ver todos</button>}</div>}
   {!visibleCodes.length&&<p className="zen-assisted-muted text-sm">{codes.length?"Nenhum equipamento neste filtro.":receipt?"Pronto para iniciar outro lote.":"Nenhum serial lido. Use o leitor ou importe um arquivo."}</p>}
   <div className="zen-assisted-list">{visibleCodes.map(code=>{const r=byCode.get(code);return <div key={code} className="zen-assisted-row">
    <div className="min-w-0 flex-1"><code className="break-all font-bold">{code}</code>{r&&<><p className="text-sm zen-assisted-status" data-state={r.estado}>{labels[r.estado]}{r.modelo?" · "+r.categoria+" / "+r.modelo:""}{r.estado==="bloqueado"?" · "+r.status+(r.tecnico?" / "+r.tecnico:""):""}</p>{r.estado==="novo"&&<select aria-label={"Modelo para "+code} className="w-full mt-2 border rounded-lg p-2" value={models[code]||defaultModel} onChange={e=>setModels(v=>({...v,[code]:e.target.value}))}><option value="">Escolha o modelo</option>{validModels.map(p=><option key={p.id} value={p.id}>{p.categoria} · {p.nome}</option>)}</select>}</>}</div>
    <button type="button" title="Remover da lista" aria-label={"Remover "+code} disabled={importing} onClick={()=>update(codes.filter(c=>c!==code))}><X size={18}/></button>
   </div>})}</div>
   {!preview?<button type="button" className="zen-assisted-action" disabled={!tech||!codes.length||busy||importing} onClick={review}><RefreshCw size={18}/>{importing?"Lendo arquivos…":busy?"Conferindo…":"Conferir equipamentos"}</button>:<button type="button" className="zen-assisted-action" disabled={!canSubmit} onClick={transfer}>{busy?"Processando…":"Confirmar carga · "+(ready.length+missing.length)}</button>}
  </fieldset>
 </div>
}

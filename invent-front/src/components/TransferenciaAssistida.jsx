import {useState,lazy} from "react";
import {Truck,AlertTriangle,CheckCircle2,X,RefreshCw} from "lucide-react";
import {api,errorMessage} from "../lib/api";
import {notify,confirmAction} from "../lib/feedback";
const LeitorSeriais=lazy(()=>import("./LeitorSeriais"));
const labels={matriz:"Disponível na matriz",novo:"Não cadastrado · entrada direta",ja_na_carga:"Já está com este técnico",bloqueado:"Bloqueado",historico:"Serial com histórico · não reativar"};
export default function TransferenciaAssistida({produtos,tecnicos,reload}){
 const [tech,setTech]=useState(""),[codes,setCodes]=useState([]),[preview,setPreview]=useState(null),[models,setModels]=useState({}),[busy,setBusy]=useState(false),[error,setError]=useState(""),[receipt,setReceipt]=useState(null),[defaultModel,setDefaultModel]=useState("");
 const validModels=produtos.filter(p=>["RASTREADOR","TAG"].includes(p.categoria));
 const update=next=>{setCodes(next);setPreview(null);setError("");setReceipt(null)};
 const changeTech=id=>{setTech(id);setPreview(null);setError("");setReceipt(null)};
 const rows=preview?.items||[],blocked=rows.filter(r=>["bloqueado","historico"].includes(r.estado)),missing=rows.filter(r=>r.estado==="novo"),ready=rows.filter(r=>r.estado==="matriz"),skipped=rows.filter(r=>r.estado==="ja_na_carga");
 const modelFor=r=>r.estado==="novo"?models[r.codigo_serial]||defaultModel:r.produto_id;
 const canSubmit=!!preview&&!blocked.length&&rows.every(r=>modelFor(r))&&ready.length+missing.length>0&&!busy;
 async function review(){
  if(!tech||!codes.length||busy)return;
  setBusy(true);setError("");setPreview(null);setReceipt(null);
  try{const {data}=await api.post("/transferencia-assistida/conferir",{tecnico_id:tech,seriais:codes});setPreview(data);setModels({});}
  catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 async function transfer(){
  if(!canSubmit)return;
  setBusy(true);setError("");
  try{
   if(!(await confirmAction(missing.length?("Atenção: "+missing.length+" equipamento(s) não existem no estoque. Serão cadastrados diretamente na carga do técnico escolhido, sem reduzir a matriz. Confirma a entrada direta e a transferência dos demais?"):("Confirmar a transferência de "+ready.length+" equipamento(s) da matriz para o técnico selecionado?"))))return;
   const {data}=await api.post("/transferencia-assistida/confirmar",{tecnico_id:tech,items:rows.map(r=>({codigo_serial:r.codigo_serial,estado:r.estado,produto_id:modelFor(r)})),confirmar_entrada_direta:missing.length>0});
   setReceipt(data);setCodes([]);setPreview(null);setModels({});setDefaultModel("");notify(data.alerta||"Transferência concluída!");reload();
  }catch(e){setError(errorMessage(e));setPreview(null);}finally{setBusy(false);}
 }
 return <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
  <fieldset disabled={busy} className="bg-white rounded-xl border border-gray-100 p-5 min-w-0">
   <h2 className="text-xl font-bold flex items-center gap-2"><Truck size={22}/> Carga assistida</h2>
   <p className="text-sm text-gray-500 my-3">Escolha o técnico e leia os seriais. O sistema identifica os modelos automaticamente, inclusive lotes mistos.</p>
   <label className="block text-sm font-medium mb-4">Técnico de destino<select className="w-full p-3 border rounded-xl mt-2" value={tech} onChange={e=>changeTech(e.target.value)}><option value="">Selecione o técnico...</option>{tecnicos.filter(t=>t.ativo!==false).map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
   <LeitorSeriais seriais={codes} setSeriais={update}/>
  </fieldset>
  <fieldset disabled={busy} className="bg-white rounded-xl border border-gray-100 p-5 min-w-0 space-y-4">
   <div className="flex items-center justify-between gap-2 flex-wrap"><h3 className="font-bold text-lg">Conferência do lote · {codes.length}</h3><button type="button" className="text-sm underline" disabled={!codes.length} onClick={()=>update([])}>Limpar lote</button></div>
   {receipt&&<div role="status" className="rounded-xl border p-3"><CheckCircle2 size={19}/> Carga concluída: {receipt.transferidos} transferidos, {receipt.cadastrados_diretamente} cadastrados diretamente, {receipt.ja_na_carga} já estavam na carga.{receipt.alerta&&<p className="font-bold text-amber-700 mt-2">{receipt.alerta}</p>}</div>}
   {error&&<p role="alert" className="text-red-600 font-medium">{error}</p>}
   {!preview&&<p className="text-sm text-gray-500">Após a leitura, confira o lote para identificar automaticamente os equipamentos.</p>}
   {preview&&<><div className="grid grid-cols-2 gap-2 text-sm">
    {[["Na matriz",ready.length],["Não cadastrados",missing.length],["Já na carga",skipped.length],["Bloqueados",blocked.length]].map(([name,n])=><div key={name} className="rounded-lg border p-3"><strong className="text-lg">{n}</strong><p>{name}</p></div>)}
   </div>
   {missing.length>0&&<div role="alert" className="border border-amber-500 rounded-lg p-3"><strong className="flex items-center gap-2"><AlertTriangle size={18}/> Entrada direta: {missing.length} equipamento(s)</strong><p className="text-sm mt-1">Não foram localizados. Informe o modelo de cada item; não haverá baixa da matriz para esses códigos.</p><label className="block text-sm mt-2">Modelo padrão apenas para novos seriais<select className="w-full border rounded-lg p-2" value={defaultModel} onChange={e=>setDefaultModel(e.target.value)}><option value="">Selecionar individualmente</option>{validModels.map(p=><option key={p.id} value={p.id}>{p.categoria} · {p.nome}</option>)}</select></label></div>}
   {blocked.length>0&&<p role="alert" className="text-sm text-red-600">Remova os bloqueados do lote. Equipamentos instalados, em triagem, sucata, com outro técnico ou com histórico de cancelamento não podem ser recadastrados automaticamente.</p>}</>}
   <div className="max-h-[420px] overflow-auto space-y-2">{codes.map(code=>{const r=rows.find(x=>x.codigo_serial===code);return <div key={code} className="border rounded-lg p-3 flex gap-2 items-start">
    <div className="min-w-0 flex-1"><code className="break-all font-bold">{code}</code>{r&&<><p className={"text-sm "+(["bloqueado","historico"].includes(r.estado)?"text-red-600":r.estado==="novo"?"text-amber-700":"text-gray-600")}>{labels[r.estado]}{r.modelo?" · "+r.categoria+" / "+r.modelo:""}{r.estado==="bloqueado"?" · "+r.status+(r.tecnico?" / "+r.tecnico:""):""}</p>{r.estado==="novo"&&<select aria-label={"Modelo para "+code} className="w-full mt-2 border rounded-lg p-2" value={models[code]||defaultModel} onChange={e=>setModels(v=>({...v,[code]:e.target.value}))}><option value="">Escolha o modelo</option>{validModels.map(p=><option key={p.id} value={p.id}>{p.categoria} · {p.nome}</option>)}</select>}</>}</div>
    <button type="button" title="Remover da lista" aria-label={"Remover "+code} onClick={()=>update(codes.filter(c=>c!==code))}><X size={18}/></button>
   </div>})}</div>
   {!preview?<button type="button" className="w-full bg-blue-600 text-white rounded-xl p-3 font-bold flex justify-center gap-2" disabled={!tech||!codes.length||busy} onClick={review}><RefreshCw size={18}/>{busy?"Conferindo…":"Conferir equipamentos"}</button>:<button type="button" className="w-full bg-blue-600 text-white rounded-xl p-3 font-bold" disabled={!canSubmit} onClick={transfer}>{busy?"Processando…":"Confirmar carga · "+(ready.length+missing.length)}</button>}
  </fieldset>
 </div>
}

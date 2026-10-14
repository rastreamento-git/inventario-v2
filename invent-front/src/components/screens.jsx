import { useState, useEffect, lazy } from "react";
import { api, errorMessage } from "../lib/api";
import { notify, confirmAction } from "../lib/feedback";
import { mergeSerials } from "../lib/serials";
import { groupForecast } from "../lib/forecast";
import TipoEquipamento from "./TipoEquipamento";
import {
  PackagePlus,
  Truck,
  Settings,
  Wrench,
  ClipboardList,
  ShoppingCart,
  UserPlus,
  Undo2,
  Trash2,
  X,
  Search,
  ShieldCheck,
  Box,
  Upload,
} from "lucide-react";
const LeitorSeriais = lazy(() => import("./LeitorSeriais"));

// ==========================================
// CÂMERA E IMPORTAÇÃO TXT (Entrada e Triagem)
// ==========================================
function SidebarConferencia({
  seriais,
  setSeriais,
  submit,
  disabled,
  labelBtn,
  corBtn,
}) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-fit">
      <h3 className="text-xl font-bold text-gray-800 mb-2">
        Itens Prontos ({seriais.length})
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Confira os números antes de concluir.
      </p>
      <div className="flex-1 overflow-y-auto bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 max-h-[350px] min-h-[200px]">
        {seriais.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 italic">
            Vazio.
          </div>
        ) : (
          <ul className="space-y-2">
            {seriais.map((codigo, index) => (
              <li
                key={codigo}
                className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 flex justify-between items-center font-mono text-sm break-all"
              >
                <span>
                  <span className="text-blue-500 font-bold mr-2">
                    #{seriais.length - index}
                  </span>{" "}
                  {codigo}
                </span>
                <button
                  aria-label="Remover serial da lista"
                  type="button"
                  onClick={() =>
                    setSeriais(seriais.filter((s) => s !== codigo))
                  }
                  className="text-red-400 hover:text-red-600 p-2"
                >
                  <X size={20} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        onClick={submit}
        disabled={disabled}
        className={`w-full font-bold py-4 rounded-xl text-white transition-all shadow-md text-lg ${disabled ? "bg-gray-300 shadow-none cursor-not-allowed" : corBtn}`}
      >
        {labelBtn}
      </button>
    </div>
  );
}

// ==========================================
// SIDEBAR DE SELEÇÃO DE IMEIs COM PESQUISA
// ==========================================
function SidebarSelecaoImeis({
  imeisGlobais,
  produtoId,
  tecnicoId,
  statusAlvo,
  seriais,
  setSeriais,
  submit,
  disabled,
  labelBtn,
  corBtn,
}) {
  const [busca, setBusca] = useState("");
  const imeisDisponiveis = imeisGlobais
    .filter(
      (i) =>
        Number(i.produto_id) === Number(produtoId) &&
        i.status === statusAlvo &&
        (statusAlvo !== "TECNICO" ||
          Number(i.tecnico_id) === Number(tecnicoId)),
    )
    .map((i) => i.codigo_serial);
  useEffect(() => {
    setSeriais([]);
    setBusca("");
  }, [produtoId, tecnicoId, statusAlvo, setSeriais]);
  useEffect(() => {
    const available = new Set(
      imeisGlobais
        .filter(
          (i) =>
            Number(i.produto_id) === Number(produtoId) &&
            i.status === statusAlvo &&
            (statusAlvo !== "TECNICO" ||
              Number(i.tecnico_id) === Number(tecnicoId)),
        )
        .map((i) => i.codigo_serial),
    );
    setSeriais((prev) => prev.filter((code) => available.has(code)));
  }, [imeisGlobais, produtoId, tecnicoId, statusAlvo, setSeriais]);

  const imeisFiltradosPesquisa = imeisDisponiveis.filter((codigo) =>
    codigo.toLowerCase().includes(busca.toLowerCase()),
  );
  const handleToggle = (codigo) => {
    try {
      setSeriais(
        seriais.includes(codigo)
          ? seriais.filter((c) => c !== codigo)
          : mergeSerials(seriais, [codigo]),
      );
    } catch (e) {
      notify(e.message);
    }
  };

  const handleToggleTodos = () => {
    const todosSelecionados =
      imeisFiltradosPesquisa.length > 0 &&
      imeisFiltradosPesquisa.every((codigo) => seriais.includes(codigo));
    if (todosSelecionados) {
      setSeriais((prev) =>
        prev.filter((c) => !imeisFiltradosPesquisa.includes(c)),
      );
    } else {
      const novos = new Set([...seriais, ...imeisFiltradosPesquisa]);
      if (novos.size > 1000)
        return notify(
          "Selecione no máximo 1.000 itens por operação. Use a pesquisa para reduzir o lote.",
        );
      setSeriais(Array.from(novos));
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[550px] lg:h-[650px]">
      <h3 className="text-xl font-bold text-gray-800 mb-2">
        Seleção de Equipamentos
      </h3>

      {/* BARRA DE PESQUISA */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-4 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Pesquisar IMEI/QR Code..."
          className="w-full pl-10 p-3 border border-gray-300 rounded-xl bg-gray-50 focus:bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="flex justify-between items-center mb-2 px-1">
        <span className="text-sm text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-md">
          {seriais.length} selecionado(s)
        </span>
        {imeisFiltradosPesquisa.length > 0 && (
          <button
            type="button"
            onClick={handleToggleTodos}
            className="text-sm text-gray-600 font-bold hover:text-blue-600 hover:underline"
          >
            {imeisFiltradosPesquisa.every((codigo) => seriais.includes(codigo))
              ? "Desmarcar Visíveis"
              : "Marcar Visíveis"}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50 p-2 rounded-xl border border-slate-200 mb-6">
        {!produtoId ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 italic text-sm text-center px-4">
            <Truck size={32} className="mb-2 text-slate-300" /> Selecione os
            dados ao lado para ver os itens disponíveis.
          </div>
        ) : imeisDisponiveis.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 italic text-sm text-center">
            Nenhum equipamento deste modelo disponível.
          </div>
        ) : imeisFiltradosPesquisa.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 italic text-sm text-center">
            Nenhum IMEI encontrado na pesquisa.
          </div>
        ) : (
          <div className="space-y-1">
            {imeisFiltradosPesquisa.map((codigo) => (
              <label
                key={codigo}
                className={`flex items-center p-3 rounded-lg cursor-pointer transition ${seriais.includes(codigo) ? "bg-blue-100 border-blue-300" : "bg-white hover:bg-gray-100"} border border-transparent shadow-sm`}
              >
                <input
                  type="checkbox"
                  className="w-5 h-5 mr-3 text-blue-600 rounded focus:ring-blue-500"
                  checked={seriais.includes(codigo)}
                  onChange={() => handleToggle(codigo)}
                />
                <span className="font-mono text-sm font-medium text-gray-800">
                  {codigo}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={submit}
        disabled={disabled}
        className={`w-full font-bold py-4 rounded-xl text-white transition-all shadow-md text-lg ${disabled ? "bg-gray-300 shadow-none cursor-not-allowed" : corBtn}`}
      >
        {labelBtn} ({seriais.length})
      </button>
    </div>
  );
}

// ==========================================
// TELA DE EQUIPAMENTOS (COM IMPORTAÇÃO TXT E BUSCA)
// ==========================================
export function TelaEquipamentos({ produtos, reload }) {
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("RASTREADOR");
  const [busca, setBusca] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    try {
      const catExistente = produtos.find((p) => p.categoria === categoria);
      const minSugerido = catExistente ? catExistente.estoque_minimo : 5;
      await api.post("/produtos", {
        nome,
        categoria,
        estoque_minimo: minSugerido,
      });
      notify("Equipamento cadastrado com sucesso!");
      setNome("");
      reload();
    } catch (err) {
      notify(errorMessage(err), "error");
    }
  };

  const removerEquipamento = async (id, nomeEquip) => {
    if (
      await confirmAction(
        `Tem certeza que deseja remover o modelo ${nomeEquip}?`,
      )
    ) {
      try {
        await api.delete(`/produtos/${id}`);
        notify("Removido!");
        reload();
      } catch (err) {
        notify(errorMessage(err), "error");
      }
    }
  };

  const importarTXT = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024)
      return notify("O arquivo TXT deve ter até 1 MB.");
    const reader = new FileReader();
    reader.onerror = () => notify("Não foi possível ler o arquivo.");
    reader.onload = async (event) => {
      const linhas = [
        ...new Set(
          event.target.result
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean),
        ),
      ];
      if (linhas.length === 0) return notify("Arquivo vazio.");
      if (linhas.length > 1000)
        return notify("Importe no máximo 1.000 registros por arquivo.");
      if (
        !(await confirmAction(
          `Deseja importar ${linhas.length} modelos como "${categoria}"?`,
        ))
      )
        return;

      let sucesso = 0;
      const catExistente = produtos.find((p) => p.categoria === categoria);
      const minSugerido = catExistente ? catExistente.estoque_minimo : 5;

      for (let linha of linhas) {
        try {
          await api.post("/produtos", {
            nome: linha,
            categoria,
            estoque_minimo: minSugerido,
          });
          sucesso++;
        } catch {
          /* Summary reports failed rows. */
        }
      }
      notify(
        `${sucesso} modelos importados; ${linhas.length - sucesso} falharam ou já existiam.`,
      );
      reload();
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const produtosFiltrados = produtos.filter((p) =>
    p.nome.toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <div className="w-full lg:w-1/3 bg-white p-8 rounded-xl shadow-sm border border-gray-100 h-fit">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <Box className="mr-2" /> Novo Modelo
        </h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <TipoEquipamento value={categoria} onChange={setCategoria} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome do Modelo (Ex: NT40)
            </label>
            <input
              required
              className="w-full p-4 border border-gray-300 rounded-xl bg-gray-50"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl mt-2"
          >
            Cadastrar Modelo
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ou importe uma lista (.txt):
          </label>
          <label className="equipment-import">
            <span className="equipment-import-icon">
              <Upload size={20} />
            </span>
            <span>
              <strong>Importar modelos</strong>
              <small>Lista TXT · um modelo por linha</small>
            </span>
            <input
              type="file"
              accept=".txt"
              className="sr-only"
              onChange={importarTXT}
            />
          </label>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Os modelos serão importados na categoria selecionada acima.
          </p>
        </div>
      </div>

      <div className="flex-1 bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h2 className="text-xl font-bold text-gray-800">
            Modelos no Sistema
          </h2>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar modelo..."
              className="w-full pl-10 p-2 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white outline-none"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm">
                <th className="p-4 border-b">Categoria</th>
                <th className="p-4 border-b">Nome do Modelo</th>
                <th className="p-4 border-b text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {produtosFiltrados.map((p) => (
                <tr key={p.id} className="border-b text-sm hover:bg-gray-50">
                  <td className="p-4">
                    <span className="bg-blue-100 text-blue-800 py-1 px-2 rounded-lg font-bold text-xs">
                      {p.categoria || "OUTROS"}
                    </span>
                  </td>
                  <td className="p-4 font-medium">{p.nome}</td>
                  <td className="p-4 text-center">
                    <button
                      aria-label="Excluir modelo"
                      onClick={() => removerEquipamento(p.id, p.nome)}
                      className="text-red-400 hover:text-red-600 p-2"
                    >
                      <Trash2 size={20} />
                    </button>
                  </td>
                </tr>
              ))}
              {produtosFiltrados.length === 0 && (
                <tr>
                  <td colSpan="3" className="p-4 text-center text-gray-500">
                    Nenhum modelo encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function TelaEntrada({ produtos, reload }) {
  const [produtoId, setProdutoId] = useState("");
  const [seriais, setSeriais] = useState([]);
  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/entrada", {
        produto_id: produtoId,
        seriais,
      });
      notify(`${res.data.registrados} registrados!`);
      setSeriais([]);
      setProdutoId("");
      reload();
    } catch (err) {
      notify(errorMessage(err), "error");
    }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <PackagePlus className="mr-2" /> Entrada (Matriz)
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Vincular IMEIs ao Modelo:
            </label>
            <select
              className="mt-1 w-full p-4 border border-gray-300 rounded-xl"
              value={produtoId}
              onChange={(e) => setProdutoId(e.target.value)}
            >
              <option value="">Selecione o modelo que chegou...</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.categoria || "EQUIP"}] {p.nome}
                </option>
              ))}
            </select>
          </div>
          <LeitorSeriais seriais={seriais} setSeriais={setSeriais} />
        </div>
      </div>
      <SidebarConferencia
        seriais={seriais}
        setSeriais={setSeriais}
        submit={submit}
        disabled={!produtoId || seriais.length === 0}
        labelBtn="Confirmar Entrada"
        corBtn="bg-emerald-600"
      />
    </div>
  );
}

export function TelaTransferencia({
  produtos,
  tecnicos,
  imeisGlobais,
  reload,
}) {
  const [tecnicoId, setTecnicoId] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [seriais, setSeriais] = useState([]);
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/transferir", {
        tecnico_id: tecnicoId,
        produto_id: produtoId,
        seriais,
      });
      notify("Transferência concluída!");
      setSeriais([]);
      reload();
    } catch (err) {
      notify(errorMessage(err), "error");
    }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <Truck className="mr-2" /> Transferir para Técnico
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Técnico Destino:
              </label>
              <select
                className="mt-1 w-full p-4 border border-gray-300 rounded-xl"
                value={tecnicoId}
                onChange={(e) => setTecnicoId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Qual modelo ele vai levar?
              </label>
              <select
                className="mt-1 w-full p-4 border border-gray-300 rounded-xl"
                value={produtoId}
                onChange={(e) => setProdutoId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.categoria}] {p.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
      <SidebarSelecaoImeis
        imeisGlobais={imeisGlobais}
        produtoId={produtoId}
        tecnicoId={tecnicoId}
        statusAlvo="MATRIZ"
        produtos={produtos}
        tecnicos={tecnicos}
        seriais={seriais}
        setSeriais={setSeriais}
        submit={submit}
        disabled={!produtoId || !tecnicoId || seriais.length === 0}
        labelBtn="Executar Transferência"
        corBtn="bg-blue-600 hover:bg-blue-700"
      />
    </div>
  );
}

export function TelaInstalacao({
  produtos,
  tecnicos,
  estoque,
  imeisGlobais,
  reload,
}) {
  const [tecnicoId, setTecnicoId] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [seriais, setSeriais] = useState([]);
  const prodDoTecnico = estoque.filter(
    (et) => et.tecnico_id === Number(tecnicoId) && et.quantidade > 0,
  );
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/instalar", {
        tecnico_id: tecnicoId,
        produto_id: produtoId,
        seriais,
      });
      notify("Instalação registrada!");
      setSeriais([]);
      reload();
    } catch (err) {
      notify(errorMessage(err), "error");
    }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <Wrench className="mr-2" /> Registrar Instalação
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Técnico:
              </label>
              <select
                className="mt-1 w-full p-4 border border-gray-300 rounded-xl"
                value={tecnicoId}
                onChange={(e) => {
                  setTecnicoId(e.target.value);
                  setProdutoId("");
                }}
              >
                <option value="">Selecione...</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Qual modelo ele instalou?
              </label>
              <select
                className="mt-1 w-full p-4 border border-gray-300 rounded-xl"
                value={produtoId}
                onChange={(e) => setProdutoId(e.target.value)}
                disabled={!tecnicoId}
              >
                <option value="">
                  {tecnicoId ? "Selecione..." : "Selecione o técnico"}
                </option>
                {prodDoTecnico.map((et) => (
                  <option key={et.produto_id} value={et.produto_id}>
                    {et.produto_nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
      <SidebarSelecaoImeis
        imeisGlobais={imeisGlobais}
        produtoId={produtoId}
        tecnicoId={tecnicoId}
        statusAlvo="TECNICO"
        produtos={produtos}
        tecnicos={tecnicos}
        seriais={seriais}
        setSeriais={setSeriais}
        submit={submit}
        disabled={!produtoId || !tecnicoId || seriais.length === 0}
        labelBtn="Confirmar Instalação"
        corBtn="bg-emerald-600 hover:bg-emerald-700"
      />
    </div>
  );
}

export function TelaEstorno({
  produtos,
  tecnicos,
  estoque,
  imeisGlobais,
  reload,
}) {
  const [tipo, setTipo] = useState("MATRIZ");
  const [produtoId, setProdutoId] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [seriais, setSeriais] = useState([]);
  const submit = async (e) => {
    e.preventDefault();
    if (await confirmAction(`Estornar ${seriais.length} equipamento(s)?`)) {
      try {
        await api.post("/estorno", {
          tipo_estorno: tipo,
          produto_id: produtoId,
          tecnico_id: tecnicoId,
          seriais,
        });
        notify("Estornado com sucesso.");
        setSeriais([]);
        reload();
      } catch (err) {
        notify(errorMessage(err), "error");
      }
    }
  };
  const estoqueFiltrado =
    tipo === "TECNICO"
      ? estoque.filter(
          (e) => e.tecnico_id === Number(tecnicoId) && e.quantidade > 0,
        )
      : [];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center text-red-600">
          <Undo2 className="mr-2" /> Correção / Devolução
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Ação de Correção:
            </label>
            <select
              className="mt-1 w-full p-4 border border-gray-300 rounded-xl"
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value);
                setProdutoId("");
                setTecnicoId("");
              }}
            >
              <option value="MATRIZ">Remover da Matriz</option>
              <option value="TECNICO">Devolução do Técnico p/ Matriz</option>
            </select>
          </div>
          {tipo === "TECNICO" && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Técnico:
              </label>
              <select
                className="mt-1 w-full p-4 border border-gray-300 rounded-xl"
                value={tecnicoId}
                onChange={(e) => setTecnicoId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Qual modelo será devolvido?
            </label>
            <select
              className="mt-1 w-full p-4 border border-gray-300 rounded-xl"
              value={produtoId}
              onChange={(e) => setProdutoId(e.target.value)}
              disabled={tipo === "TECNICO" && !tecnicoId}
            >
              <option value="">Selecione...</option>
              {tipo === "MATRIZ"
                ? produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))
                : estoqueFiltrado.map((et) => (
                    <option key={et.produto_id} value={et.produto_id}>
                      {et.produto_nome}
                    </option>
                  ))}
            </select>
          </div>
        </div>
      </div>
      <SidebarSelecaoImeis
        imeisGlobais={imeisGlobais}
        produtoId={produtoId}
        tecnicoId={tecnicoId}
        statusAlvo={tipo}
        produtos={produtos}
        tecnicos={tecnicos}
        seriais={seriais}
        setSeriais={setSeriais}
        submit={submit}
        disabled={
          !produtoId ||
          (tipo === "TECNICO" && !tecnicoId) ||
          seriais.length === 0
        }
        labelBtn="Executar Estorno"
        corBtn="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
}

// ==========================================
// TELA RASTREIO (COM BUSCA GLOBAL)
// ==========================================
export function TelaTriagem({ imeisGlobais = [], reload }) {
  const [seriais, setSeriais] = useState([]);
  const [processing, setProcessing] = useState(false);
  const rows = imeisGlobais.filter((i) => i.status === "TRIAGEM");
  async function receive(e) {
    e.preventDefault();
    setProcessing(true);
    try {
      await api.post("/triagem/receber", { seriais });
      notify("Equipamentos recebidos para triagem.", "success");
      setSeriais([]);
      await reload();
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setProcessing(false);
    }
  }
  async function evaluate(row, approved) {
    if (
      !(await confirmAction(
        `${approved ? "Aprovar para reuso" : "Enviar para sucata"} o equipamento ${row.codigo_serial}?`,
        {
          title: "Avaliar equipamento",
          confirmLabel: approved ? "Aprovar para reuso" : "Enviar para sucata",
          danger: !approved,
        },
      ))
    )
      return;
    setProcessing(true);
    try {
      await api.post("/triagem/avaliar", {
        codigo_serial: row.codigo_serial,
        aprovado: approved,
      });
      notify(
        approved
          ? "Equipamento disponível para reuso na matriz."
          : "Equipamento classificado como sucata.",
        "success",
      );
      await reload();
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setProcessing(false);
    }
  }
  return (
    <section className="triage-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">Recebimento e avaliação</span>
          <h2>Triagem e reuso</h2>
          <p>
            Receba devoluções, avalie os equipamentos e devolva os aprovados à
            matriz.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100">
          <h3 className="font-bold mb-4">Receber equipamentos</h3>
          <LeitorSeriais seriais={seriais} setSeriais={setSeriais} />
        </div>
        <SidebarConferencia
          seriais={seriais}
          setSeriais={setSeriais}
          submit={receive}
          disabled={processing || !seriais.length}
          labelBtn="Receber para triagem"
          corBtn="bg-orange-500 hover:bg-orange-600"
        />
      </div>
      <div className="trace-card triage-queue">
        <h3>{rows.length} equipamento(s) aguardando avaliação</h3>
        {!rows.length ? (
          <div className="empty-state">
            <ShieldCheck size={32} />
            <p>Nenhum equipamento aguardando avaliação.</p>
          </div>
        ) : (
          rows.map((row) => (
            <div className="triage-row" key={row.codigo_serial}>
              <div>
                <code>{row.codigo_serial}</code>
                <small>
                  {row.produto} · {row.categoria}
                </small>
              </div>
              <div className="row-actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={processing}
                  onClick={() => evaluate(row, false)}
                >
                  Enviar para sucata
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={processing}
                  onClick={() => evaluate(row, true)}
                >
                  Aprovar para reuso
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
export function TelaCompras({ previsao, produtos }) {
  const listaCompras = groupForecast(previsao, produtos);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-white">
        <h2 className="text-2xl font-bold flex items-center">
          <ShoppingCart className="mr-2 text-blue-600" /> Inteligência de
          Compras (Por Categoria)
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="bg-gray-50 text-sm">
              <th className="p-4 border-b">Categoria Agrupada</th>
              <th className="p-4 border-b text-center">Média/Dia</th>
              <th className="p-4 border-b text-center">Ponto de Pedido</th>
              <th className="p-4 border-b text-center">Estoque Atual</th>
              <th className="p-4 border-b text-center">Sugestão de Compra</th>
            </tr>
          </thead>
          <tbody>
            {listaCompras.map((c, i) => (
              <tr key={i} className="border-b text-sm">
                <td className="p-4 font-bold text-blue-800">{c.categoria}</td>
                <td className="p-4 text-center">{c.cmd}</td>
                <td className="p-4 text-center font-bold text-orange-600">
                  {c.ponto_pedido}
                </td>
                <td
                  className={`p-4 text-center font-bold ${c.status === "URGENTE" ? "text-red-600" : "text-green-600"}`}
                >
                  {c.quantidade_matriz}
                </td>
                <td className="p-4 text-center">
                  <span
                    className={`py-1 px-3 rounded font-bold text-sm ${c.sugerido > 0 ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}
                  >
                    {c.sugerido > 0
                      ? `Comprar ${c.sugerido}`
                      : "Estoque Adequado"}
                  </span>
                </td>
              </tr>
            ))}
            {listaCompras.length === 0 && (
              <tr>
                <td colSpan="5" className="p-4 text-center text-gray-500">
                  Sem dados de movimentação.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TelaConfiguracao({ tecnicos, reload }) {
  const [tipo, setTipo] = useState("CATEGORIA");
  const [id, setId] = useState("RASTREADOR");
  const [limite, setLimite] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.put("/configurar-alerta", {
        tipo,
        id,
        novo_limite: Number(limite),
      });
      notify("Regra de Alerta Salva!");
      setLimite("");
      await reload();
    } catch (err) {
      notify(errorMessage(err), "error");
    }
  };
  return (
    <div className="bg-white p-8 rounded-xl shadow-sm max-w-lg border border-gray-100">
      <h2 className="text-2xl font-bold mb-6 flex items-center">
        <Settings className="mr-2" /> Configuração de Alertas
      </h2>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Onde aplicar o alerta?
          </label>
          <select
            className="w-full p-4 border rounded-xl"
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value);
              setId(e.target.value === "CATEGORIA" ? "RASTREADOR" : "");
            }}
          >
            <option value="CATEGORIA">Geral da Matriz (Por Categoria)</option>
            <option value="TECNICO">Estoque do Técnico</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Selecione o Alvo
          </label>
          {tipo === "CATEGORIA" ? (
            <select
              required
              className="w-full p-4 border rounded-xl"
              value={id}
              onChange={(e) => setId(e.target.value)}
            >
              <option value="RASTREADOR">Total de Rastreadores</option>
              <option value="TAG">Total de Tags</option>
            </select>
          ) : (
            <select
              required
              className="w-full p-4 border rounded-xl"
              value={id}
              onChange={(e) => setId(e.target.value)}
            >
              <option value="">Selecione o Técnico...</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Quantidade Mínima Exigida
          </label>
          <input
            required
            type="number"
            min="0"
            placeholder="Ex: 50"
            className="w-full p-4 border rounded-xl"
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl"
        >
          Salvar Nova Regra
        </button>
      </form>
    </div>
  );
}

// ==========================================
// TELA TÉCNICOS (COM IMPORTAÇÃO TXT E BUSCA)
// ==========================================
export function TelaTecnicos({ tecnicos, estoque, reload }) {
  const [nome, setNome] = useState("");
  const [busca, setBusca] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/tecnicos", { nome });
      notify("Cadastrado!");
      setNome("");
      await reload();
    } catch (err) {
      notify(errorMessage(err), "error");
    }
  };
  const remover = async (id, nomeTec) => {
    if (estoque.some((et) => et.tecnico_id === id && et.quantidade > 0))
      return notify(`Técnico possui itens.`);
    if (await confirmAction(`Remover ${nomeTec}?`)) {
      try {
        await api.delete(`/tecnicos/${id}`);
        await reload();
      } catch (err) {
        notify(errorMessage(err), "error");
      }
    }
  };

  const importarTXT = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024)
      return notify("O arquivo TXT deve ter até 1 MB.");
    const reader = new FileReader();
    reader.onerror = () => notify("Não foi possível ler o arquivo.");
    reader.onload = async (event) => {
      const linhas = [
        ...new Set(
          event.target.result
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean),
        ),
      ];
      if (linhas.length === 0) return notify("Arquivo vazio.");
      if (linhas.length > 1000)
        return notify("Importe no máximo 1.000 registros por arquivo.");
      if (!(await confirmAction(`Deseja importar ${linhas.length} técnicos?`)))
        return;

      let sucesso = 0;
      for (let linha of linhas) {
        try {
          await api.post("/tecnicos", { nome: linha });
          sucesso++;
        } catch {
          /* Summary reports failed rows. */
        }
      }
      notify(
        `${sucesso} técnicos importados; ${linhas.length - sucesso} falharam ou já existiam.`,
      );
      reload();
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const tecnicosFiltrados = tecnicos.filter((t) =>
    t.nome.toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 h-fit">
        <h2 className="text-2xl font-bold mb-6 flex items-center">
          <UserPlus className="mr-2" /> Novo Técnico
        </h2>
        <form onSubmit={submit} className="space-y-4">
          <input
            required
            placeholder="Nome do Instalador"
            className="w-full p-4 border rounded-xl"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl"
          >
            Cadastrar Manualmente
          </button>
        </form>
        <div className="mt-8 pt-6 border-t border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ou importe uma lista (.txt):
          </label>
          <label className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-xl flex justify-center items-center cursor-pointer transition">
            <Upload className="mr-2" size={20} /> Escolher Arquivo TXT
            <input
              type="file"
              accept=".txt"
              className="hidden"
              onChange={importarTXT}
            />
          </label>
        </div>
      </div>
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h2 className="text-xl font-bold text-gray-800">Equipe</h2>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar técnico..."
              className="w-full pl-10 p-2 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white outline-none"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>
        <ul className="divide-y">
          {tecnicosFiltrados.map((t) => (
            <li key={t.id} className="py-4 font-medium flex justify-between">
              {t.nome}
              <button
                aria-label="Desativar técnico"
                onClick={() => remover(t.id, t.nome)}
                className="text-red-400 hover:text-red-600"
              >
                <Trash2 size={20} />
              </button>
            </li>
          ))}
          {tecnicosFiltrados.length === 0 && (
            <li className="py-4 text-gray-500 text-center">
              Nenhum técnico encontrado.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

export function TelaLogs({ logs }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b">
        <h2 className="text-2xl font-bold flex items-center">
          <ClipboardList className="mr-2" /> Histórico
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="bg-gray-50 text-sm">
              <th className="p-4">Data</th>
              <th className="p-4">Ação</th>
              <th className="p-4">Equipamento</th>
              <th className="p-4">Técnico</th>
              <th className="p-4 text-center">Quantidade</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b text-sm">
                <td className="p-4">
                  {new Date(log.data).toLocaleString("pt-BR")}
                </td>
                <td className="p-4 font-bold">{log.tipo}</td>
                <td className="p-4">{log.produto}</td>
                <td className="p-4">{log.tecnico || "-"}</td>
                <td className="p-4 text-center font-bold">{log.quantidade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

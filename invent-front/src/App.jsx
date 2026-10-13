import {
  useState,
  useEffect,
  useRef,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { api, errorMessage, saveToken } from "./lib/api";
import {
  TelaEntrada,
  TelaTransferencia,
  TelaInstalacao,
  TelaEstorno,
  TelaRastreioTriagem,
  TelaEquipamentos,
  TelaCompras,
  TelaTecnicos,
  TelaLogs,
  TelaConfiguracao,
} from "./components/screens";
const TelaDashboard = lazy(() => import("./components/Dashboard"));
import {
  LayoutDashboard,
  PackagePlus,
  Truck,
  Settings,
  AlertTriangle,
  Wrench,
  ClipboardList,
  ShoppingCart,
  UserPlus,
  Undo2,
  X,
  Search,
  Menu,
  Box,
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [menuAberto, setMenuAberto] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [estoqueTecnicos, setEstoqueTecnicos] = useState([]);
  const [logs, setLogs] = useState([]);
  const [previsao, setPrevisao] = useState([]);
  const [dashboard, setDashboard] = useState({
    kpis: {},
    grafico: [],
    tecnicos: [],
  });
  const [imeisGlobais, setImeisGlobais] = useState([]);

  const notificadoRef = useRef(new Set());
  const refreshId = useRef(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  useEffect(() => {
    const listener = (event) => setBusy(event.detail);
    window.addEventListener("invent:busy", listener);
    return () => window.removeEventListener("invent:busy", listener);
  }, []);

  const fetchData = useCallback(async () => {
    const requestId = ++refreshId.current;
    setLoading(true);
    try {
      const [
        prodRes,
        techRes,
        dashRes,
        estTechRes,
        logsRes,
        prevRes,
        imeisRes,
      ] = await Promise.all([
        api.get("/produtos"),
        api.get("/tecnicos"),
        api.get("/dashboard"),
        api.get("/estoque-tecnicos"),
        api.get("/logs"),
        api.get("/previsao-compras"),
        api.get("/imeis"),
      ]);
      if (requestId !== refreshId.current) return;
      setLoadError("");
      setLastUpdated(new Date());
      setProdutos(prodRes.data);
      setTecnicos(techRes.data);
      setDashboard(dashRes.data);
      setEstoqueTecnicos(estTechRes.data);
      setLogs(logsRes.data);
      setPrevisao(prevRes.data);
      setImeisGlobais(imeisRes.data);
    } catch (error) {
      if (requestId === refreshId.current) setLoadError(errorMessage(error));
    } finally {
      if (requestId === refreshId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    return () => {
      refreshId.current++;
    };
  }, [fetchData]);

  const categoriasMatriz = {};
  produtos.forEach((p) => {
    const cat = p.categoria || "RASTREADOR";
    if (!categoriasMatriz[cat])
      categoriasMatriz[cat] = { quantidade: 0, minimo: p.estoque_minimo };
    categoriasMatriz[cat].quantidade += Number(p.quantidade_matriz);
    categoriasMatriz[cat].minimo = Math.max(
      categoriasMatriz[cat].minimo,
      p.estoque_minimo,
    );
  });

  const alertasMatriz = Object.keys(categoriasMatriz)
    .filter(
      (cat) => categoriasMatriz[cat].quantidade <= categoriasMatriz[cat].minimo,
    )
    .map((cat) => ({
      categoria: cat,
      quantidade: categoriasMatriz[cat].quantidade,
      minimo: categoriasMatriz[cat].minimo,
    }));

  const categoriasTecnicos = {};
  tecnicos.forEach((t) =>
    Object.keys(categoriasMatriz).forEach((categoria) => {
      categoriasTecnicos[`${t.id}-${categoria}`] = {
        tecnico_id: t.id,
        tecnico_nome: t.nome,
        categoria,
        quantidade: 0,
        minimo: t.estoque_minimo,
      };
    }),
  );
  estoqueTecnicos.forEach((et) => {
    const cat = et.categoria || "RASTREADOR";
    const key = `${et.tecnico_id}-${cat}`;
    if (!categoriasTecnicos[key]) {
      categoriasTecnicos[key] = {
        tecnico_id: et.tecnico_id,
        tecnico_nome: et.tecnico_nome,
        categoria: cat,
        quantidade: 0,
        minimo: et.estoque_minimo,
      };
    }
    categoriasTecnicos[key].quantidade += Number(et.quantidade);
  });

  const alertasTecnicos = Object.values(categoriasTecnicos).filter(
    (ct) => ct.quantidade <= ct.minimo,
  );

  useEffect(() => {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      alertasMatriz.forEach((a) => {
        const key = `matriz-${a.categoria}-${a.quantidade}`;
        if (!notificadoRef.current.has(key)) {
          try {
            new Notification("Alerta Matriz", {
              body: `Categoria ${a.categoria}: ${a.quantidade} restantes.`,
            });
          } catch {
            /* use in-app alerts */
          }
          notificadoRef.current.add(key);
        }
      });
      alertasTecnicos.forEach((a) => {
        const key = `tec-${a.tecnico_id}-${a.categoria}-${a.quantidade}`;
        if (!notificadoRef.current.has(key)) {
          try {
            new Notification("Alerta Técnico", {
              body: `${a.tecnico_nome}: ${a.quantidade} unidades de ${a.categoria}.`,
            });
          } catch {
            /* use in-app alerts */
          }
          notificadoRef.current.add(key);
        }
      });
    }
  }, [produtos, tecnicos, estoqueTecnicos]);

  async function enableNotifications() {
    if (typeof Notification === "undefined")
      return alert(
        "Este navegador não oferece notificações. Os avisos continuam disponíveis no painel.",
      );
    try {
      const permission = await Notification.requestPermission();
      alert(
        permission === "granted"
          ? "Notificações ativadas. Os próximos alertas serão exibidos pelo navegador."
          : "Notificações não autorizadas. Confira as permissões do site.",
      );
    } catch {
      alert("Não foi possível ativar notificações neste navegador.");
    }
  }
  const changeTab = (tab) => {
    setActiveTab(tab);
    setMenuAberto(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      {menuAberto && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMenuAberto(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 transform ${menuAberto ? "translate-x-0" : "-translate-x-full"} lg:relative lg:translate-x-0 w-72 shrink-0 bg-slate-900 text-white flex flex-col z-50 transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none`}
      >
        <div className="p-6 text-2xl font-bold border-b border-slate-800 flex justify-between items-center">
          <span>
            Estoque <span className="text-blue-500">Pro</span>
          </span>
          <button
            aria-label="Fechar menu"
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setMenuAberto(false)}
          >
            <X size={28} />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto pb-20">
          <MenuButton
            icon={<LayoutDashboard />}
            label="Dashboard"
            active={activeTab === "dashboard"}
            onClick={() => changeTab("dashboard")}
          />
          <MenuButton
            icon={<PackagePlus />}
            label="Entrada Matriz"
            active={activeTab === "entrada"}
            onClick={() => changeTab("entrada")}
          />
          <MenuButton
            icon={<Truck />}
            label="Carga p/ Técnico"
            active={activeTab === "transferencia"}
            onClick={() => changeTab("transferencia")}
          />
          <MenuButton
            icon={<Wrench />}
            label="Baixa (Instalação)"
            active={activeTab === "instalacao"}
            onClick={() => changeTab("instalacao")}
          />
          <MenuButton
            icon={<Undo2 />}
            label="Correções (Estornos)"
            active={activeTab === "estorno"}
            onClick={() => changeTab("estorno")}
          />
          <MenuButton
            icon={<Search />}
            label="Controle IMEI & Triagem"
            active={activeTab === "rastreio"}
            onClick={() => changeTab("rastreio")}
          />
          <MenuButton
            icon={<Box />}
            label="Cadastrar Equipamentos"
            active={activeTab === "equipamentos"}
            onClick={() => changeTab("equipamentos")}
          />
          <MenuButton
            icon={<ShoppingCart />}
            label="Previsão Compras"
            active={activeTab === "compras"}
            onClick={() => changeTab("compras")}
          />
          <MenuButton
            icon={<UserPlus />}
            label="Equipe (Técnicos)"
            active={activeTab === "tecnicos"}
            onClick={() => changeTab("tecnicos")}
          />
          <MenuButton
            icon={<ClipboardList />}
            label="Histórico (Logs)"
            active={activeTab === "logs"}
            onClick={() => changeTab("logs")}
          />
          <MenuButton
            icon={<Settings />}
            label="Configurações"
            active={activeTab === "config"}
            onClick={() => changeTab("config")}
          />
        </nav>
        <div className="p-4 border-t border-slate-800 flex flex-col gap-2">
          <button
            onClick={enableNotifications}
            className="text-sm text-slate-300 p-2"
          >
            Ativar notificações
          </button>
          <button
            onClick={() => {
              saveToken(null);
              window.dispatchEvent(new Event("invent:unauthorized"));
            }}
            className="text-sm text-slate-300 p-2"
          >
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col h-full w-full overflow-hidden relative">
        <header className="lg:hidden bg-slate-900 text-white p-4 flex items-center shadow-md">
          <button
            aria-label="Abrir menu"
            onClick={() => setMenuAberto(true)}
            className="mr-4 focus:outline-none"
          >
            <Menu size={28} />
          </button>
          <h1 className="text-xl font-bold">Estoque Pro</h1>
        </header>

        <div className="flex-1 p-4 md:p-8 overflow-y-auto pb-24">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
            <p role="status" className="text-sm text-slate-500">
              {busy
                ? "Salvando operação…"
                : loading
                  ? "Atualizando dados…"
                  : lastUpdated
                    ? `Atualizado às ${lastUpdated.toLocaleTimeString("pt-BR")}`
                    : "Aguardando dados"}
            </p>
            <button
              disabled={loading || busy}
              onClick={fetchData}
              className="bg-white border rounded-lg px-4 py-2 text-sm disabled:opacity-50"
            >
              Atualizar dados
            </button>
          </div>
          {loadError && (
            <div
              role="alert"
              className="mb-6 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg"
            >
              {loadError} Os dados exibidos podem estar desatualizados.
            </div>
          )}
          <fieldset
            disabled={busy || loading || Boolean(loadError)}
            className="min-w-0 border-0 p-0 m-0"
          >
            {(alertasMatriz.length > 0 || alertasTecnicos.length > 0) && (
              <div className="mb-8 bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
                <div className="flex items-center text-red-800 font-bold mb-2">
                  <AlertTriangle className="mr-2" /> Atenção: Níveis Críticos de
                  Estoque
                </div>
                <ul className="ml-8 text-red-700 list-disc text-sm space-y-1">
                  {alertasMatriz.map((a) => (
                    <li key={`m-${a.categoria}`}>
                      <strong>Matriz ({a.categoria}):</strong> Restam apenas{" "}
                      {a.quantidade} no total (Mínimo: {a.minimo})
                    </li>
                  ))}
                  {alertasTecnicos.map((a) => (
                    <li key={`t-${a.tecnico_id}-${a.categoria}`}>
                      <strong>
                        {a.tecnico_nome} ({a.categoria}):
                      </strong>{" "}
                      Restam apenas {a.quantidade} em posse (Mínimo: {a.minimo})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Suspense
              fallback={
                <p role="status" className="p-6">
                  Carregando tela…
                </p>
              }
            >
              {activeTab === "dashboard" && <TelaDashboard data={dashboard} />}
              {activeTab === "entrada" && (
                <TelaEntrada produtos={produtos} reload={fetchData} />
              )}
              {activeTab === "transferencia" && (
                <TelaTransferencia
                  produtos={produtos}
                  tecnicos={tecnicos}
                  imeisGlobais={imeisGlobais}
                  reload={fetchData}
                />
              )}
              {activeTab === "instalacao" && (
                <TelaInstalacao
                  produtos={produtos}
                  tecnicos={tecnicos}
                  estoque={estoqueTecnicos}
                  imeisGlobais={imeisGlobais}
                  reload={fetchData}
                />
              )}
              {activeTab === "estorno" && (
                <TelaEstorno
                  produtos={produtos}
                  tecnicos={tecnicos}
                  estoque={estoqueTecnicos}
                  imeisGlobais={imeisGlobais}
                  reload={fetchData}
                />
              )}
              {activeTab === "rastreio" && (
                <TelaRastreioTriagem
                  imeisGlobais={imeisGlobais}
                  reload={fetchData}
                />
              )}
              {activeTab === "equipamentos" && (
                <TelaEquipamentos produtos={produtos} reload={fetchData} />
              )}
              {activeTab === "compras" && (
                <TelaCompras previsao={previsao} produtos={produtos} />
              )}
              {activeTab === "tecnicos" && (
                <TelaTecnicos
                  tecnicos={tecnicos}
                  estoque={estoqueTecnicos}
                  reload={fetchData}
                />
              )}
              {activeTab === "logs" && <TelaLogs logs={logs} />}
              {activeTab === "config" && (
                <TelaConfiguracao
                  produtos={produtos}
                  tecnicos={tecnicos}
                  reload={fetchData}
                />
              )}
            </Suspense>
          </fieldset>
        </div>
      </main>
    </div>
  );
}

function MenuButton({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center p-3 rounded-lg transition-colors ${active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}
    >
      {icon} <span className="ml-3 text-sm">{label}</span>
    </button>
  );
}

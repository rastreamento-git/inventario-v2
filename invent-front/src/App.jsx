import ThemeControl from "./components/ThemeControl";
import ZenMark from "./components/ZenMark";
import ZenCentralLink from "./components/ZenCentralLink";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  Bell,
  BellOff,
  Box,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  RefreshCw,
  Search,
  Settings,
  ShoppingCart,
  Truck,
  Undo2,
  UserPlus,
  Wrench,
  X,
  AlertTriangle,
  ShieldCheck,
  Download,
} from "lucide-react";
import { api, errorMessage, saveToken } from "./lib/api";
import {
  TelaEntrada,
  TelaTransferencia,
  TelaInstalacao,
  TelaEstorno,
  TelaTriagem,
  TelaEquipamentos,
  TelaCompras,
  TelaTecnicos,
  TelaLogs,
  TelaConfiguracao,
} from "./components/screens";

import { useSession } from "./lib/session";
import { notify } from "./lib/feedback";
import { commandFor, keySequence } from "./lib/easter-eggs";
import Feedback from "./components/Feedback";
import AppFooter from "./components/AppFooter";
const Traceability = lazy(() => import("./components/Traceability"));
const AdminTools = lazy(() => import("./components/AdminTools"));
const Dashboard = lazy(() => import("./components/Dashboard"));

const groups = [
  {
    label: "Visão geral",
    items: [["dashboard", "Painel de controle", LayoutDashboard]],
  },
  {
    label: "Produção",
    items: [
      ["entrada", "Entrada na matriz", PackagePlus],
      ["transferencia", "Carga para técnico", Truck],
      ["instalacao", "Instalações", Wrench],
      ["estorno", "Devoluções e estornos", Undo2],
    ],
  },
  {
    label: "Inventário",
    items: [
      ["rastreio", "Rastreabilidade global", Search],
      ["triagem", "Triagem e reuso", ShieldCheck],
      ["equipamentos", "Equipamentos", Box],
    ],
  },
  {
    label: "Gestão",
    items: [
      ["compras", "Previsão de compras", ShoppingCart],
      ["tecnicos", "Equipe técnica", UserPlus],
      ["logs", "Histórico", ClipboardList],
      ["config", "Configurações", Settings],
    ],
  },
];

const preferenceKey = "invent.notifications.enabled";

const permission = () =>
  typeof Notification === "undefined" ? "unsupported" : Notification.permission;

function remember(enabled) {
  try {
    localStorage.setItem(preferenceKey, String(enabled));
  } catch {
    // A preferência continua funcionando nesta sessão.
  }
}

export default function App() {
  const user = useSession();
  const initials = (user?.nome || "EP")
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const [globalSearch, setGlobalSearch] = useState("");
  const [traceSearch, setTraceSearch] = useState("");
  const [adminPanel, setAdminPanel] = useState(null);
  function openAdmin(panel) {
    if (!["admin", "operador"].includes(user?.papel)) {
      notify("Esta ação exige um administrador.", "error");
      return;
    }
    setAdminPanel(panel);
  }
  function changeGlobalSearch(e) {
    const value = e.target.value,
      action = commandFor(value);
    if (action) {
      openAdmin(action);
      setGlobalSearch("");
    } else setGlobalSearch(value);
  }
  function searchSubmit(e) {
    e.preventDefault();
    const action = commandFor(globalSearch);
    if (action) {
      openAdmin(action);
      setGlobalSearch("");
    } else {
      setTraceSearch(globalSearch.trim());
      setTab("rastreio");
      setMenu(false);
    }
  }
  useEffect(() => {
    const sequence = keySequence();
    const handler = (event) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing ||
        event.target.closest?.("input,textarea,select,[contenteditable='true']")
      )
        return;
      const action = sequence(event.key, Date.now());
      if (action) {
        event.preventDefault();
        openAdmin(action);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [user?.papel]);
  const [tab, setTab] = useState("dashboard");
  const [menu, setMenu] = useState(false);
  const [data, setData] = useState({
    produtos: [],
    tecnicos: [],
    estoque: [],
    logs: [],
    previsao: [],
    imeis: [],
    dashboard: { kpis: {}, grafico: [], tecnicos: [] },
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(null);
  const [notice, setNotice] = useState("");
  const [notifyPermission, setNotifyPermission] = useState(permission);
  const [notifyEnabled, setNotifyEnabled] = useState(() => {
    try {
      return localStorage.getItem(preferenceKey) !== "false";
    } catch {
      return true;
    }
  });

  const requestId = useRef(0);
  const contentRef = useRef(null);
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [tab]);
  const notified = useRef(new Set());
  const title = groups
    .flatMap((group) => group.items)
    .find((item) => item[0] === tab)?.[1];

  const notificationsOn = notifyEnabled && notifyPermission === "granted";

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);

    try {
      const paths = [
        "produtos",
        "tecnicos",
        "estoque-tecnicos",
        "logs",
        "previsao-compras",
        "imeis",
        "dashboard",
      ];
      const responses = await Promise.all(
        paths.map((path) => api.get(`/${path}`)),
      );

      if (id !== requestId.current) return;

      const [produtos, tecnicos, estoque, logs, previsao, imeis, dashboard] =
        responses.map((response) => response.data);

      setData({
        produtos,
        tecnicos,
        estoque,
        logs,
        previsao,
        imeis,
        dashboard,
      });
      setUpdated(new Date());
      setError("");
    } catch (e) {
      if (id === requestId.current) setError(errorMessage(e));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    return () => {
      requestId.current++;
    };
  }, [reload]);

  useEffect(() => {
    const onBusy = (event) => setBusy(event.detail);
    const onFocus = () => setNotifyPermission(permission());

    window.addEventListener("invent:busy", onBusy);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("invent:busy", onBusy);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const escape = (event) => {
      if (event.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);

  const alerts = useMemo(() => {
    const categories = new Map();
    const team = new Map();

    data.produtos.forEach((p) => {
      const category = p.categoria || "RASTREADOR";
      const current = categories.get(category) || {
        quantidade: 0,
        minimo: 0,
      };

      current.quantidade += Number(p.quantidade_matriz || 0);
      current.minimo = Math.max(current.minimo, Number(p.estoque_minimo || 0));
      categories.set(category, current);
    });

    data.tecnicos.forEach((t) => {
      categories.forEach((_, category) => {
        team.set(`${t.id}-${category}`, {
          nome: t.nome,
          categoria: category,
          quantidade: 0,
          minimo: Number(t.estoque_minimo || 0),
        });
      });
    });

    data.estoque.forEach((item) => {
      const category = item.categoria || "RASTREADOR";
      const key = `${item.tecnico_id}-${category}`;

      if (team.has(key)) {
        team.get(key).quantidade += Number(item.quantidade || 0);
      }
    });

    const result = [];

    categories.forEach((item, category) => {
      if (item.quantidade <= item.minimo) {
        result.push({
          key: `matriz-${category}`,
          nome: "Matriz",
          categoria: category,
          ...item,
        });
      }
    });

    team.forEach((item, key) => {
      if (item.quantidade <= item.minimo) {
        result.push({ key, ...item });
      }
    });

    return result;
  }, [data.produtos, data.tecnicos, data.estoque]);

  useEffect(() => {
    if (!notificationsOn || loading || error) return;

    const key = (item) => `${item.key}:${item.quantidade}:${item.minimo}`;

    const fresh = alerts.filter((item) => !notified.current.has(key(item)));
    notified.current = new Set(alerts.map(key));

    if (!fresh.length) return;

    try {
      const first = fresh[0];

      new Notification("Estoque precisa de atenção", {
        body:
          `${first.nome} · ${first.categoria}: ` +
          `${first.quantidade} unidade(s).` +
          (fresh.length > 1 ? ` E mais ${fresh.length - 1} alerta(s).` : ""),
        tag: "invent-stock",
      });
    } catch {
      // Os alertas continuam disponíveis no painel.
    }
  }, [alerts, notificationsOn, loading, error]);

  async function toggleNotifications() {
    const current = permission();
    setNotifyPermission(current);

    if (current === "unsupported") return;

    if (current === "denied") {
      setNotice(
        "As notificações estão bloqueadas. Libere a permissão " +
          "nas configurações deste site no navegador.",
      );
      return;
    }

    if (current === "granted") {
      const enabled = !notificationsOn;
      setNotifyEnabled(enabled);
      remember(enabled);

      if (enabled) notified.current.clear();

      setNotice(
        enabled
          ? "Notificações ativadas."
          : "Notificações silenciadas neste navegador.",
      );
      return;
    }

    try {
      const allowed = await Notification.requestPermission();
      setNotifyPermission(allowed);

      if (allowed === "granted") {
        setNotifyEnabled(true);
        remember(true);
        notified.current.clear();
      }

      setNotice(
        allowed === "granted"
          ? "Notificações ativadas."
          : "Permissão não concedida. Os alertas continuam disponíveis no painel.",
      );
    } catch {
      setNotice("Não foi possível ativar as notificações neste navegador.");
    }
  }

  function navigate(next) {
    setTab(next);
    setMenu(false);
  }

  const bellLabel =
    notifyPermission === "unsupported"
      ? "Notificações indisponíveis neste navegador"
      : notifyPermission === "denied"
        ? "Notificações bloqueadas pelo navegador"
        : notificationsOn
          ? "Silenciar notificações"
          : "Ativar notificações";

  return (
    <div className="inventory-app">
      {menu && (
        <button
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMenu(false)}
        />
      )}

      <aside
        id="inventory-menu"
        className={`app-sidebar ${menu ? "is-open" : ""}`}
      >
        <div className="brand">
          <span className="brand-mark">
            <ZenMark variant="stock" size={36} />
          </span>
          <div>
            <strong>
              Estoque <span>Pro</span>
            </strong>
            <small>Inventário & rastreamento</small>
          </div>
          <button
            className="icon-button sidebar-close"
            aria-label="Fechar menu"
            onClick={() => setMenu(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map(([id, label, Icon]) => (
                <button
                  key={id}
                  className={`nav-item ${tab === id ? "is-active" : ""}`}
                  aria-current={tab === id ? "page" : undefined}
                  onClick={() => navigate(id)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {tab === id && <ChevronRight size={15} />}
                </button>
              ))}
            </div>
          ))}
          <ZenCentralLink />
        </nav>

        <div className="sidebar-footer">
          <span className="avatar">{initials}</span>
          <div>
            <strong>{user?.nome || "Painel administrativo"}</strong>
            <small>
              {user?.papel === "admin" ? "Administrador" : "Operador"}
            </small>
          </div>
          <button
            className="icon-button"
            title="Sair"
            aria-label="Sair"
            disabled={busy}
            onClick={async () => {
              try {
                await api.post("/auth/logout", {});
              } catch (e) {
                notify(errorMessage(e), "error");
                return;
              }
              saveToken(null);
              window.dispatchEvent(
                new CustomEvent("invent:unauthorized", {
                  detail: { reason: "logout" },
                }),
              );
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="app-main">
        <header className="topbar">
          <div className="topbar-context">
            <button
              className="icon-button menu-toggle"
              aria-label="Abrir menu"
              aria-expanded={menu}
              aria-controls="inventory-menu"
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>
            <div>
              <div className="breadcrumb">
                Estoque Pro <ChevronRight size={12} /> {title}
              </div>
              <h1>{title}</h1>
            </div>
          </div>

          <form className="topbar-search" onSubmit={searchSubmit} role="search">
            <Search size={17} />
            <input
              type="search"
              aria-label="Pesquisar equipamento ou digitar atalho"
              placeholder="Pesquisar equipamento…"
              value={globalSearch}
              onChange={changeGlobalSearch}
              autoComplete="off"
              maxLength={128}
            />
            <button type="submit" aria-label="Executar pesquisa ou atalho">
              <ChevronRight size={18} />
            </button>
          </form>
          <div className="topbar-actions">
            <ThemeControl />
            <span className="header-date">
              {new Date().toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
              })}
            </span>

            <button
              className={`icon-button notification-button ${notificationsOn ? "is-enabled" : ""}`}
              title={bellLabel}
              aria-label={bellLabel}
              aria-pressed={notificationsOn}
              disabled={notifyPermission === "unsupported"}
              onClick={toggleNotifications}
            >
              {notificationsOn || notifyPermission === "default" ? (
                <Bell size={20} />
              ) : (
                <BellOff size={20} />
              )}
              {notificationsOn && <span className="notification-dot" />}
            </button>

            {["admin", "operador"].includes(user?.papel) && (
              <button
                type="button"
                className="icon-button"
                aria-label="Backups locais"
                title="Backups locais"
                disabled={busy}
                onClick={() => openAdmin("backup")}
              >
                <Download size={19} />
              </button>
            )}
            <span className="avatar header-avatar" title={user?.nome}>
              {initials}
            </span>
          </div>
        </header>

        <div className="app-content" ref={contentRef}>
          <div className="sync-toolbar">
            <span
              role="status"
              className={`sync-status ${error ? "has-error" : ""}`}
            >
              <i />
              {busy
                ? "Salvando movimentação…"
                : loading
                  ? "Sincronizando inventário…"
                  : error
                    ? "Falha na atualização"
                    : `Última atualização às ${
                        updated?.toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }) || "—"
                      }`}
            </span>

            <button
              className="refresh-button"
              disabled={loading || busy}
              onClick={reload}
            >
              <RefreshCw size={15} className={loading ? "is-spinning" : ""} />
              Atualizar
            </button>
          </div>

          {error && (
            <div role="alert" className="error-banner">
              <AlertTriangle size={19} />
              <div>
                <strong>Não foi possível atualizar os dados</strong>
                <p>{error} Os dados exibidos podem estar desatualizados.</p>
              </div>
            </div>
          )}

          {alerts.length > 0 && (
            <details className="stock-alerts">
              <summary>
                <span className="alert-icon">
                  <AlertTriangle size={18} />
                </span>
                <span>
                  <strong>
                    {alerts.length} ponto(s) de atenção no estoque
                  </strong>
                  <small>Confira os saldos abaixo do mínimo configurado.</small>
                </span>
                <ChevronRight className="alert-chevron" size={18} />
              </summary>
              <div className="alert-list">
                {alerts.map((item) => (
                  <div key={item.key}>
                    <span>
                      <strong>{item.nome}</strong>
                      <small>{item.categoria}</small>
                    </span>
                    <span>
                      {item.quantidade} unidade(s)
                      <small>Mínimo: {item.minimo}</small>
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}

          <fieldset
            className="workspace-fieldset"
            disabled={busy || loading || Boolean(error)}
          >
            <div className="workspace-view">
              <Suspense
                fallback={
                  <div className="loading-card" role="status">
                    <Activity size={22} /> Carregando tela…
                  </div>
                }
              >
                {tab === "dashboard" && (
                  <Dashboard
                    data={data.dashboard}
                    produtos={data.produtos}
                    tecnicos={data.tecnicos}
                    imeis={data.imeis}
                    onNavigate={navigate}
                  />
                )}
                {tab === "entrada" && (
                  <TelaEntrada produtos={data.produtos} reload={reload} />
                )}
                {tab === "transferencia" && (
                  <TelaTransferencia
                    produtos={data.produtos}
                    tecnicos={data.tecnicos}
                    imeisGlobais={data.imeis}
                    reload={reload}
                  />
                )}
                {tab === "instalacao" && (
                  <TelaInstalacao
                    produtos={data.produtos}
                    tecnicos={data.tecnicos}
                    estoque={data.estoque}
                    imeisGlobais={data.imeis}
                    reload={reload}
                  />
                )}
                {tab === "estorno" && (
                  <TelaEstorno
                    produtos={data.produtos}
                    tecnicos={data.tecnicos}
                    estoque={data.estoque}
                    imeisGlobais={data.imeis}
                    reload={reload}
                  />
                )}
                {tab === "rastreio" && (
                  <Traceability
                    produtos={data.produtos}
                    refreshToken={updated}
                    initialSearch={traceSearch}
                    reload={reload}
                  />
                )}
                {tab === "triagem" && (
                  <TelaTriagem imeisGlobais={data.imeis} reload={reload} />
                )}
                {tab === "equipamentos" && (
                  <TelaEquipamentos produtos={data.produtos} reload={reload} />
                )}
                {tab === "compras" && (
                  <TelaCompras
                    previsao={data.previsao}
                    produtos={data.produtos}
                  />
                )}
                {tab === "tecnicos" && (
                  <TelaTecnicos
                    tecnicos={data.tecnicos}
                    estoque={data.estoque}
                    reload={reload}
                  />
                )}
                {tab === "logs" && <TelaLogs logs={data.logs} />}
                {tab === "config" && (
                  <TelaConfiguracao
                    produtos={data.produtos}
                    tecnicos={data.tecnicos}
                    reload={reload}
                  />
                )}
              </Suspense>
            </div>
          </fieldset>
        </div>
        <AppFooter />
      </main>

      <Feedback />
      {adminPanel && (
        <Suspense
          fallback={<div className="loading-card">Carregando painel…</div>}
        >
          <AdminTools
            key={adminPanel}
            panel={adminPanel}
            onClose={() => setAdminPanel(null)}
            onReset={async () => {
              setTab("dashboard");
              setTraceSearch("");
              setGlobalSearch("");
              await reload();
            }}
          />
        </Suspense>
      )}
      {notice && (
        <div className="ui-toast" role="status">
          <Bell size={18} />
          <p>{notice}</p>
          <button
            className="icon-button"
            aria-label="Fechar aviso"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

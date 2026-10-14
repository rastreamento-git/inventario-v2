import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Filter,
  Package,
  Copy,
  History,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Archive,
  ArrowRight,
  LoaderCircle,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { api, errorMessage } from "../lib/api";
import { notify, confirmAction } from "../lib/feedback";
import Modal from "./Modal";
const states = {
  MATRIZ: ["Na matriz", "mint"],
  TECNICO: ["Com técnico", "blue"],
  INSTALADO: ["Instalado", "purple"],
  TRIAGEM: ["Em triagem", "amber"],
  SUCATA: ["Sucata", "red"],
  CANCELADO: ["Cancelado", "gray"],
};
const actions = {
  ENTRADA_MATRIZ: "Entrada na matriz",
  CARGA_TECNICO: "Entregue ao técnico",
  USO_FINAL: "Instalação",
  DEVOLUCAO_TECNICO: "Devolução à matriz",
  ESTORNO_MATRIZ: "Entrada cancelada",
  RECEBIMENTO_TRIAGEM: "Recebido para triagem",
  REUSO_APROVADO: "Aprovado para reuso",
  REUSO_REPROVADO: "Reprovado para reuso",
  ARQUIVAMENTO_INSTALADO: "Registro arquivado",
  RECLASSIFICACAO_ORIGEM: "Modelo de origem alterado",
  RECLASSIFICACAO_DESTINO: "Novo modelo associado",
};
const date = (value) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(value))
    : "—";
const location = (row) =>
  row.status === "TECNICO"
    ? row.tecnico || "Técnico não informado"
    : {
        MATRIZ: "Matriz",
        INSTALADO: "Instalado",
        TRIAGEM: "Triagem",
        SUCATA: "Sucata",
        CANCELADO: "Registro cancelado",
      }[row.status] || row.status;
function Badge({ status }) {
  const [label, color] = states[status] || [status, "gray"];
  return <span className={`status-pill ${color}`}>{label}</span>;
}
export default function Traceability({
  produtos,
  refreshToken,
  initialSearch = "",
  reload,
}) {
  const [q, setQ] = useState(initialSearch),
    [debounced, setDebounced] = useState(initialSearch),
    [status, setStatus] = useState("TODOS"),
    [category, setCategory] = useState("TODOS"),
    [tech, setTech] = useState(""),
    [archive, setArchive] = useState("todos"),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(25),
    [retry, setRetry] = useState(0);
  const [result, setResult] = useState({
      rows: [],
      total: 0,
      pages: 1,
      page: 1,
      summary: [],
      categorias: [],
      tecnicos: [],
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [selected, setSelected] = useState(null),
    [history, setHistory] = useState([]),
    [detailLoading, setDetailLoading] = useState(false),
    [detailError, setDetailError] = useState(""),
    [nextModel, setNextModel] = useState(""),
    [saving, setSaving] = useState(false);
  const detailRequest = useRef(0);
  useEffect(() => {
    setQ(initialSearch);
    setPage(1);
  }, [initialSearch]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api
      .get("/rastreabilidade", {
        params: {
          q: debounced,
          status,
          categoria: category,
          tecnico_id: tech || undefined,
          arquivo: archive,
          page,
          pageSize,
        },
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) setResult(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    debounced,
    status,
    category,
    tech,
    archive,
    page,
    pageSize,
    refreshToken,
    retry,
  ]);
  const all = useMemo(
    () => result.summary.reduce((n, s) => n + s.total, 0),
    [result.summary],
  );
  const archived = useMemo(
    () => result.summary.reduce((n, s) => n + s.arquivados, 0),
    [result.summary],
  );
  const filters =
    status !== "TODOS" ||
    category !== "TODOS" ||
    tech ||
    archive !== "todos" ||
    q;
  function clear() {
    setQ("");
    setStatus("TODOS");
    setCategory("TODOS");
    setTech("");
    setArchive("todos");
    setPage(1);
  }
  async function copy(code) {
    try {
      await navigator.clipboard.writeText(code);
      notify("Serial copiado.", "success");
    } catch {
      notify("Selecione o serial e copie pelo menu do dispositivo.", "info");
    }
  }
  async function details(row) {
    const id = ++detailRequest.current;
    setSelected(row);
    setNextModel(String(row.produto_id || ""));
    setHistory([]);
    setDetailError("");
    setDetailLoading(true);
    try {
      const { data } = await api.get(
        `/imeis/${encodeURIComponent(row.codigo_serial)}/historico`,
      );
      if (id === detailRequest.current) setHistory(data);
    } catch (e) {
      if (id === detailRequest.current) setDetailError(errorMessage(e));
    } finally {
      if (id === detailRequest.current) setDetailLoading(false);
    }
  }
  function close() {
    detailRequest.current++;
    setSelected(null);
  }
  async function reclassify() {
    if (
      !(await confirmAction(
        `Associar ${selected.codigo_serial} ao modelo selecionado?`,
        { title: "Corrigir modelo", confirmLabel: "Salvar alteração" },
      ))
    )
      return;
    setSaving(true);
    setDetailError("");
    try {
      await api.put(`/imeis/${encodeURIComponent(selected.codigo_serial)}`, {
        produto_id: Number(nextModel),
      });
      notify("Modelo corrigido e histórico preservado.", "success");
      close();
      await reload();
    } catch (e) {
      setDetailError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  async function archiveOld() {
    if (
      !(await confirmAction(
        "Arquivar instalações com mais de 30 dias? Elas continuarão visíveis na rastreabilidade global.",
        { title: "Arquivar instalações", confirmLabel: "Arquivar registros" },
      ))
    )
      return;
    try {
      const { data } = await api.delete("/limpeza-instalados");
      notify(`${data.arquivados} registro(s) arquivado(s).`, "success");
      await reload();
      setRetry((v) => v + 1);
    } catch (e) {
      notify(errorMessage(e), "error");
    }
  }
  return (
    <section className="trace-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">Visão completa do inventário</span>
          <h2>Todos os equipamentos</h2>
          <p>
            Encontre cada equipamento, sua localização e todas as movimentações
            registradas.
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setRetry((v) => v + 1)}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "is-spinning" : ""} />
          Atualizar lista
        </button>
      </div>
      <div className="trace-summary">
        <button
          className={
            status === "TODOS" && archive === "todos" ? "is-active" : ""
          }
          type="button"
          onClick={() => {
            setStatus("TODOS");
            setArchive("todos");
            setPage(1);
          }}
        >
          <Package size={18} />
          <span>
            Todos os registros<strong>{all}</strong>
          </span>
        </button>
        {["MATRIZ", "TECNICO", "INSTALADO", "TRIAGEM"].map((key) => (
          <button
            key={key}
            className={status === key ? "is-active" : ""}
            type="button"
            onClick={() => {
              setStatus(key);
              setPage(1);
            }}
          >
            <span>
              {states[key][0]}
              <strong>
                {result.summary.find((s) => s.status === key)?.total || 0}
              </strong>
            </span>
          </button>
        ))}
        <button
          type="button"
          className={archive === "arquivados" ? "is-active" : ""}
          onClick={() => {
            setArchive("arquivados");
            setStatus("TODOS");
            setPage(1);
          }}
        >
          <Archive size={18} />
          <span>
            Arquivados<strong>{archived}</strong>
          </span>
        </button>
      </div>
      <div className="trace-card">
        <div className="trace-search">
          <Search size={20} />
          <input
            aria-label="Buscar equipamentos na rastreabilidade"
            type="search"
            placeholder="IMEI, serial, modelo, tipo, técnico ou operador…"
            maxLength={128}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {loading && <LoaderCircle size={18} className="is-spinning" />}
        </div>
        <div className="trace-filters">
          <label>
            <span>Status</span>
            <select
              aria-label="Status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="TODOS">Todos os status</option>
              {Object.entries(states).map(([key, [label]]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Tipo</span>
            <select
              aria-label="Tipo"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="TODOS">Todos os tipos</option>
              {[
                ...new Set([
                  ...result.categorias,
                  ...produtos.map((p) => p.categoria || "SEM_TIPO"),
                ]),
              ]
                .sort()
                .map((c) => (
                  <option key={c} value={c}>
                    {c === "SEM_TIPO" ? "Sem tipo definido" : c}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>Técnico responsável</span>
            <select
              aria-label="Técnico responsável"
              value={tech}
              onChange={(e) => {
                setTech(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos os técnicos</option>
              {result.tecnicos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome || `Técnico ${t.id}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Arquivamento</span>
            <select
              aria-label="Arquivamento"
              value={archive}
              onChange={(e) => {
                setArchive(e.target.value);
                setPage(1);
              }}
            >
              <option value="todos">Incluir todos</option>
              <option value="ativos">Somente não arquivados</option>
              <option value="arquivados">Somente arquivados</option>
            </select>
          </label>
        </div>
        <div className="trace-toolbar">
          <span>
            <Filter size={14} />
            {result.total} registro(s){filters ? " nos filtros atuais" : ""}
          </span>
          {filters && (
            <button type="button" onClick={clear}>
              Limpar filtros
            </button>
          )}
          <button type="button" className="archive-action" onClick={archiveOld}>
            <Archive size={14} />
            Arquivar instalações antigas
          </button>
        </div>
        {error ? (
          <div className="table-error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setRetry((v) => v + 1)}
            >
              Tentar novamente
            </button>
          </div>
        ) : loading && !result.rows.length ? (
          <div className="empty-state" role="status">
            <LoaderCircle className="is-spinning" />
            Carregando equipamentos…
          </div>
        ) : !result.rows.length ? (
          <div className="empty-state">
            <Package size={36} />
            <h3>
              {filters
                ? "Nenhum resultado nesses filtros"
                : "O inventário está pronto para receber equipamentos"}
            </h3>
            <p>
              {filters
                ? "Ajuste a busca ou limpe os filtros para ver todos os registros."
                : "Faça a primeira entrada na matriz para iniciar a rastreabilidade."}
            </p>
            {filters && (
              <button
                type="button"
                className="secondary-button"
                onClick={clear}
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <div className={`trace-table-wrap ${loading ? "is-loading" : ""}`}>
              <table className="trace-table">
                <thead>
                  <tr>
                    <th>IMEI / Serial</th>
                    <th>Modelo / Tipo</th>
                    <th>Status</th>
                    <th>Localização / Técnico</th>
                    <th>Última atualização</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.codigo_serial}>
                      <td>
                        <button
                          type="button"
                          className="serial-link"
                          onClick={() => details(row)}
                        >
                          {row.codigo_serial}
                        </button>
                        {row.arquivado && (
                          <small className="archive-label">Arquivado</small>
                        )}
                        {row.origem === "historico" && (
                          <small className="archive-label">
                            Registro histórico
                          </small>
                        )}
                      </td>
                      <td>
                        <strong>
                          {row.produto || "Modelo não cadastrado"}
                        </strong>
                        <small>
                          {row.categoria === "SEM_TIPO"
                            ? "Sem tipo definido"
                            : row.categoria}
                        </small>
                      </td>
                      <td>
                        <Badge status={row.status} />
                      </td>
                      <td>
                        <span className="location-text">
                          <MapPin size={14} />
                          {location(row)}
                        </span>
                        {row.status !== "TECNICO" && row.tecnico && (
                          <small>Último técnico: {row.tecnico}</small>
                        )}
                      </td>
                      <td>
                        {date(row.data_atualizacao)}
                        {row.operador && <small>Por {row.operador}</small>}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`Copiar serial ${row.codigo_serial}`}
                            onClick={() => copy(row.codigo_serial)}
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => details(row)}
                            aria-label={`Histórico de ${row.codigo_serial}`}
                          >
                            <History size={15} />
                            Detalhes
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="trace-mobile-list">
              {result.rows.map((row) => (
                <article key={row.codigo_serial}>
                  <div>
                    <button
                      type="button"
                      className="serial-link"
                      onClick={() => details(row)}
                    >
                      {row.codigo_serial}
                    </button>
                    <Badge status={row.status} />
                  </div>
                  <p>
                    {row.produto || "Modelo não cadastrado"} · {row.categoria}
                  </p>
                  <small>
                    {location(row)} · {date(row.data_atualizacao)}
                    {row.arquivado ? " · Arquivado" : ""}
                  </small>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => copy(row.codigo_serial)}
                    >
                      <Copy size={15} />
                      Copiar
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => details(row)}
                    >
                      <History size={15} />
                      Ver histórico
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        <div className="table-pagination">
          <label>
            Por página
            <select
              aria-label="Registros por página"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <span>
            Página {result.page} de {result.pages}
          </span>
          <div>
            <button
              type="button"
              className="icon-button"
              aria-label="Página anterior"
              disabled={loading || result.page <= 1}
              onClick={() => setPage(result.page - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Próxima página"
              disabled={loading || result.page >= result.pages}
              onClick={() => setPage(result.page + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
      {selected && (
        <Modal
          title="Histórico do equipamento"
          onClose={close}
          busy={saving}
          wide
        >
          <div className="equipment-detail">
            <div className="detail-identity">
              <Package size={26} />
              <div>
                <code>{selected.codigo_serial}</code>
                <p>
                  {selected.produto || "Modelo não cadastrado"} ·{" "}
                  {selected.categoria}
                </p>
              </div>
              <Badge status={selected.status} />
            </div>
            <div className="detail-meta">
              <span>
                <MapPin size={16} />
                {location(selected)}
              </span>
              <span>Atualização: {date(selected.data_atualizacao)}</span>
              {selected.arquivado && (
                <span>
                  <Archive size={16} />
                  Arquivado
                </span>
              )}
            </div>
            {detailError && (
              <div className="form-error" role="alert">
                {detailError}
              </div>
            )}
            <h3>Movimentações</h3>
            {detailLoading ? (
              <p role="status">Carregando histórico…</p>
            ) : !history.length ? (
              <div className="empty-history">
                Ainda não há eventos individuais registrados para este serial.
              </div>
            ) : (
              <ol className="timeline">
                {history.map((e) => (
                  <li key={e.id}>
                    <span className="timeline-dot">
                      <CheckCircle2 size={15} />
                    </span>
                    <div>
                      <strong>{actions[e.tipo] || e.tipo}</strong>
                      <p>
                        {e.status_anterior
                          ? states[e.status_anterior]?.[0] || e.status_anterior
                          : "Novo equipamento"}
                        <ArrowRight size={13} />
                        {states[e.status_novo]?.[0] || e.status_novo}
                      </p>
                      <small>
                        {date(e.data)}
                        {e.tecnico ? ` · ${e.tecnico}` : ""}
                        {e.operador ? ` · Operador: ${e.operador}` : ""}
                        {e.produto ? ` · ${e.produto}` : ""}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {selected.origem === "cadastro" && (
              <section className="detail-correction">
                <h3>Corrigir modelo ou tipo</h3>
                <div>
                  <select
                    aria-label="Novo modelo do equipamento"
                    value={nextModel}
                    onChange={(e) => setNextModel(e.target.value)}
                    disabled={saving}
                  >
                    <option value="">Selecione um modelo</option>
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} · {p.categoria}
                      </option>
                    ))}
                  </select>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={
                      saving ||
                      !nextModel ||
                      Number(nextModel) === selected.produto_id
                    }
                    onClick={reclassify}
                  >
                    Salvar alteração
                  </button>
                </div>
              </section>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => copy(selected.codigo_serial)}
              >
                <Copy size={16} />
                Copiar código
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={close}
                disabled={saving}
              >
                Concluir
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

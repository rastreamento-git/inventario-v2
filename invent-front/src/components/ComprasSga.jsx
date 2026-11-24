import { useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useSession } from "../lib/session";

const pendingUrl = "/compras/instalacoes-pendentes";
const runsUrl = pendingUrl + "/coletas";
const sgaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const displayDate = (value) => value.split("-").reverse().join("/");

const equipment = {
  RASTREADOR: ["rastreador", "rastreadores"],
  TAG: ["TAG", "TAGs"],
  PERFURADO: ["adesivo", "adesivos"],
};
const states = {
  covered: "Coberto pela carga técnica",
  matrix_transfer: "Depende de transferência da matriz",
  shortage: "Equipamentos insuficientes",
  route_pending: "Trajeto a confirmar",
  stock_pending: "Estoque a confirmar",
  demand_pending: "Equipamentos a confirmar na ficha",
  already_ordered: "Já possui OS",
};

function units(value) {
  if (!value) return "A confirmar";
  return (
    Object.entries(equipment)
      .filter(([key]) => value[key] > 0)
      .map(([key, names]) => `${value[key]} ${names[value[key] === 1 ? 0 : 1]}`)
      .join(" · ") || "Nenhum"
  );
}
function technician(value) {
  return `${value.name} · ${Math.round(value.route.duration_seconds / 60)} min`;
}

export default function ComprasSga() {
  const canCollect = useSession()?.papel === "admin";
  const today = sgaDate.format(new Date());
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [confirmed, setConfirmed] = useState(false);
  const [run, setRun] = useState(null);
  const [starting, setStarting] = useState(false);
  const [runError, setRunError] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState(null);
  const [ids, setIds] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const activeRunId = run?.state === "completed" ? run.id : null;
  const pollingId =
    run && (["queued", "running"].includes(run.state) || run.retrying)
      ? run.id
      : null;
  const retrying = run?.retrying;
  const periodDays = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  const validPeriod = periodDays >= 1 && periodDays <= 31 && end <= today;

  useEffect(() => {
    if (!pollingId) return;
    const controller = new AbortController();
    let timer;
    async function poll() {
      try {
        const { data: current } = await api.get(`${runsUrl}/${pollingId}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setRunError("");
        setRun((previous) =>
          previous?.id === current.id ? current : previous,
        );
        if (current.state === "completed") setLoading(true);
        if (["queued", "running"].includes(current.state) || current.retrying)
          timer = setTimeout(poll, current.retrying ? 15000 : 5000);
      } catch (failure) {
        if (controller.signal.aborted) return;
        setRunError(errorMessage(failure));
        timer = setTimeout(poll, 15000);
      }
    }
    timer = setTimeout(poll, retrying ? 15000 : 5000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [pollingId, retrying]);

  useEffect(() => {
    if (!activeRunId) return;
    const controller = new AbortController();
    api
      .get(pendingUrl, {
        params: { page, coleta: activeRunId },
        signal: controller.signal,
      })
      .then(({ data: queue }) => {
        if (!controller.signal.aborted) setData(queue);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(errorMessage(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [activeRunId, page, refresh]);

  function resetResults() {
    setData(null);
    setError("");
    setResult(null);
    setIds([]);
  }

  function navigate(next) {
    resetResults();
    setLoading(true);
    if (next === page) setRefresh((value) => value + 1);
    else setPage(next);
  }

  async function openRun(collect) {
    if (starting || busy || !validPeriod || (collect && !confirmed)) return;
    setStarting(true);
    setRun(null);
    setRunError("");
    setPage(1);
    setLoading(false);
    resetResults();
    try {
      const period = { start, end };
      const { data: current } = collect
        ? await api.post(runsUrl, { ...period, confirmed })
        : await api.get(runsUrl, { params: period });
      if (collect) setConfirmed(false);
      setRun(current);
      if (current.state === "completed") {
        setLoading(true);
        setRefresh((value) => value + 1);
      }
    } catch (failure) {
      setRunError(errorMessage(failure));
    } finally {
      setStarting(false);
    }
  }

  async function simulate() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { data: coverage } = await api.post(
        pendingUrl + "/cobertura",
        { ids, coleta: activeRunId },
        { timeout: 185000 },
      );
      setResult(coverage);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="bg-white rounded-xl border border-gray-200 p-5 mb-5"
      aria-labelledby="compras-sga-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold" id="compras-sga-title">
          Instalação Pendente · SGA
        </h2>
        {activeRunId && (
          <button
            type="button"
            className="secondary-button"
            disabled={loading || busy}
            onClick={() => navigate(page)}
          >
            Atualizar lista
          </button>
        )}
      </div>
      <p className="mt-2 text-sm" id="compras-sga-periodo">
        Informe até 31 dias, pela data de entrada em Instalação Pendente no SGA.
        {!canCollect && " Um administrador inicia a coleta."}
      </p>
      <form
        className="my-4 flex flex-wrap items-end gap-3"
        aria-describedby="compras-sga-periodo"
        onSubmit={(event) => {
          event.preventDefault();
          void openRun(canCollect);
        }}
      >
        <label className="grid min-w-0 flex-1 gap-1 text-sm sm:flex-none">
          Data inicial
          <input
            className="min-h-11 w-full min-w-0 rounded-lg border border-gray-200 px-3 text-base"
            type="date"
            max={today}
            value={start}
            required
            disabled={starting}
            onChange={(event) => {
              setStart(event.target.value);
              setConfirmed(false);
            }}
          />
        </label>
        <label className="grid min-w-0 flex-1 gap-1 text-sm sm:flex-none">
          Data final
          <input
            className="min-h-11 w-full min-w-0 rounded-lg border border-gray-200 px-3 text-base"
            type="date"
            min={start || undefined}
            max={today}
            value={end}
            required
            disabled={starting}
            onChange={(event) => {
              setEnd(event.target.value);
              setConfirmed(false);
            }}
          />
        </label>
        {canCollect && (
          <label className="flex w-full items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={starting || !validPeriod}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Confirmo o período da coleta.
          </label>
        )}
        <div className="flex w-full flex-wrap gap-2">
          <button
            type="submit"
            className="primary-button"
            disabled={
              starting ||
              busy ||
              !validPeriod ||
              (canCollect && (!confirmed || Boolean(pollingId)))
            }
          >
            {canCollect ? "Coletar no SGA" : "Ver última coleta"}
          </button>
          {canCollect && (
            <button
              type="button"
              className="secondary-button"
              disabled={starting || busy || !validPeriod}
              onClick={() => void openRun(false)}
            >
              Ver última coleta
            </button>
          )}
        </div>
      </form>
      {!validPeriod && (
        <p className="my-3 text-sm">
          Informe um período válido de até 31 dias, sem datas futuras.
        </p>
      )}
      {starting && <p role="status">Consultando fila do SGA…</p>}
      {run && (
        <div className="my-3 text-sm" role="status">
          <p className="font-semibold">
            {displayDate(run.start)} a {displayDate(run.end)}
          </p>
          {run.state === "queued" && <p>Coleta na fila do ZenControl.</p>}
          {run.state === "running" && (
            <p>
              Consultando o SGA.{" "}
              {run.days &&
                `${run.checked_days} de ${run.days} dias consultados.`}
              {run.matching > 0 &&
                ` ${run.checked_vehicles} de ${run.matching} veículos verificados.`}
            </p>
          )}
          {run.retrying && (
            <p>Consulta incompleta. O ZenControl fará uma nova tentativa.</p>
          )}
          {run.state === "failed" && !run.retrying && (
            <p>Coleta incompleta. Confira os detalhes no ZenControl.</p>
          )}
          {run.state === "completed" && <p>Coleta concluída.</p>}
        </div>
      )}
      {runError && (
        <p className="my-3" role="alert">
          {runError}
        </p>
      )}
      {loading && <p role="status">Carregando pendências…</p>}
      {error && (
        <p role="alert" className="my-3">
          {error}
        </p>
      )}
      {data && (
        <>
          {data.items.length === 0 ? (
            <p className="my-3">
              Nenhuma instalação pendente encontrada no período.
            </p>
          ) : (
            <>
              <p className="my-3 text-sm">
                Selecione até cinco pendências para simular a cobertura pela
                carga dos técnicos e pelo estoque da matriz.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="p-2">Selecionar</th>
                      <th className="p-2">Veículo</th>
                      <th className="hidden p-2 sm:table-cell">
                        Classificação SGA
                      </th>
                      <th className="p-2">Equipamentos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id} className="border-b border-gray-200">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${item.vehicle}`}
                            checked={ids.includes(item.id)}
                            disabled={
                              busy ||
                              item.ordered ||
                              (ids.length >= 5 && !ids.includes(item.id))
                            }
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setResult(null);
                              setIds((previous) =>
                                checked
                                  ? [...previous, item.id]
                                  : previous.filter((id) => id !== item.id),
                              );
                            }}
                          />
                        </td>
                        <td className="p-2">{item.vehicle}</td>
                        <td className="hidden p-2 sm:table-cell">
                          {item.classification || "A confirmar"}
                        </td>
                        <td className="p-2">
                          {item.ordered ? "Já possui OS" : units(item.required)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="flex flex-wrap gap-3 items-center my-3">
            <button
              type="button"
              className="primary-button"
              disabled={busy || !ids.length}
              onClick={simulate}
            >
              {busy ? "Consultando cobertura…" : "Simular cobertura"}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={busy || page === 1}
              onClick={() => navigate(page - 1)}
            >
              Anterior
            </button>
            <span>
              {data.total} pendência(s) · página {page}
            </span>
            <button
              type="button"
              className="secondary-button"
              disabled={busy || page * data.limit >= data.total}
              onClick={() => navigate(page + 1)}
            >
              Próxima
            </button>
          </div>
        </>
      )}
      {result && (
        <div className="border-t border-gray-200 pt-3" aria-live="polite">
          <h3 className="font-bold">Cobertura da seleção</h3>
          <p>
            Matriz disponível: {units(result.matrix)} · Saldo após simulação:{" "}
            {units(result.matrix_remaining)}
          </p>
          <p>
            Necessários: {units(result.totals.required)} · Carga:{" "}
            {units(result.totals.covered)} · Da matriz:{" "}
            {units(result.totals.from_matrix)}
          </p>
          <p>
            Faltam: {units(result.totals.missing)} · A confirmar:{" "}
            {units(result.totals.pending)} · {result.totals.pending_items}{" "}
            atendimento(s) a conferir
          </p>
          <ul className="mt-3 space-y-2">
            {result.items.map((item) => (
              <li key={item.id} className="border-t border-gray-200 pt-2">
                <strong>
                  {item.vehicle} · {states[item.state]}
                </strong>
                {item.nearest && (
                  <div>
                    Mais próximo: {technician(item.nearest)} · carga livre:{" "}
                    {units(item.nearest.free)}
                  </div>
                )}
                {item.direct && (
                  <div>Carga completa: {technician(item.direct)}</div>
                )}
                {item.matrix_option && (
                  <div>
                    Com transferência: {technician(item.matrix_option)} ·{" "}
                    {units(item.matrix_option.missing)}
                  </div>
                )}
                {item.missing && <div>Faltam: {units(item.missing)}</div>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            Confirme o prazo da transferência antes de agendar.
          </p>
        </div>
      )}
    </section>
  );
}

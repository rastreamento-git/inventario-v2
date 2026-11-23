import { useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";

const equipment = {
  RASTREADOR: "Rastreadores",
  TAG: "TAGs",
  PERFURADO: "Adesivos",
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
      .map(([key, name]) => `${value[key]} ${name.toLowerCase()}`)
      .join(" · ") || "Nenhum"
  );
}
function technician(value) {
  return `${value.name} · ${Math.round(value.route.duration_seconds / 60)} min`;
}

export default function ComprasSga() {
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState(null);
  const [ids, setIds] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api
      .get("/compras/instalacoes-pendentes", {
        params: { page },
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
  }, [page, refresh]);

  function navigate(next) {
    setData(null);
    setLoading(true);
    setError("");
    setResult(null);
    setIds([]);
    if (next === page) setRefresh((value) => value + 1);
    else setPage(next);
  }
  async function simulate() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { data: coverage } = await api.post(
        "/compras/instalacoes-pendentes/cobertura",
        { ids },
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
        <button
          type="button"
          className="secondary-button"
          disabled={loading || busy}
          onClick={() => navigate(page)}
        >
          Atualizar
        </button>
      </div>
      <p className="mt-2 text-sm">
        Demanda por atendimento. Selecione até cinco pendências para conferir
        carga técnica e matriz.
      </p>
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
              Nenhuma pendência nesta página. A lista usa as coletas do
              ZenControl.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="p-2">Selecionar</th>
                    <th className="p-2">Veículo</th>
                    <th className="p-2">Classificação SGA</th>
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
                      <td className="p-2">
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

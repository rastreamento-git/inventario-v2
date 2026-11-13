import "./Adesivos.css";
import { useEffect, useState, useRef } from "react";
import { api, errorMessage } from "../lib/api";
export default function Adesivos({ reload: reloadParent }) {
  const [data, setData] = useState(null),
    [type, setType] = useState("ENTRADA"),
    [quantity, setQuantity] = useState(1),
    [technician, setTechnician] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const key = useRef(crypto.randomUUID());
  const load = async () => {
    try {
      setData((await api.get("/adesivos")).data);
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  useEffect(() => {
    load();
  }, []);
  function change(fn, value) {
    fn(value);
    key.current = crypto.randomUUID();
    setNotice("");
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post(
        "/adesivos/movements",
        { type, quantity: Number(quantity), technician_id: technician },
        { headers: { "Idempotency-Key": key.current } },
      );
      key.current = crypto.randomUUID();
      setNotice("Movimentação de adesivos registrada.");
      await load();
      await reloadParent();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="adhesive-screen bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6"
      aria-label="Adesivos Perfurados"
    >
      <h2 className="text-2xl font-bold">Adesivo Perfurado</h2>
      <p>Produto SGA 2371 · Controle por quantidade, sem IMEI ou serial.</p>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <h3>Saldo na matriz: {data?.matrix ?? "…"} unidade(s)</h3>
      <form className="adhesive-form" onSubmit={submit}>
        <label>
          Movimentação
          <select
            aria-label="Movimentação"
            value={type}
            onChange={(e) => change(setType, e.target.value)}
            disabled={busy}
          >
            <option value="ENTRADA">Receber na matriz</option>
            <option value="TRANSFERENCIA">Entregar ao técnico</option>
            <option value="DEVOLUCAO">Devolver à matriz</option>
          </select>
        </label>
        {type !== "ENTRADA" && (
          <label>
            Técnico
            <select
              required
              aria-label="Técnico"
              value={technician}
              onChange={(e) => change(setTechnician, e.target.value)}
              disabled={busy}
            >
              <option value="">Selecione</option>
              {data?.technicians
                .filter((t) => t.ativo || type === "DEVOLUCAO")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome} · {t.quantidade} unidade(s)
                  </option>
                ))}
            </select>
          </label>
        )}
        <label>
          Quantidade
          <input
            type="number"
            min="1"
            max="1000000"
            required
            value={quantity}
            onChange={(e) => change(setQuantity, e.target.value)}
            disabled={busy}
          />
        </label>
        <button className="primary-button" disabled={busy || !data}>
          {busy ? "Registrando…" : "Registrar movimentação"}
        </button>
      </form>
      <h3>Carga dos técnicos</h3>
      <div className="adhesive-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Técnico</th>
              <th>Adesivos disponíveis</th>
            </tr>
          </thead>
          <tbody>
            {data?.technicians.map((t) => (
              <tr key={t.id}>
                <td>
                  {t.nome}
                  {!t.ativo && " (inativo)"}
                </td>
                <td>{t.quantidade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Últimas movimentações</h3>
      <div className="adhesive-table-wrap">
        <table className="adhesive-history">
          <thead>
            <tr>
              <th>Data</th>
              <th>Movimentação</th>
              <th>Técnico</th>
              <th>Quantidade</th>
              <th>OS</th>
            </tr>
          </thead>
          <tbody>
            {data?.movements.map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.data).toLocaleString("pt-BR")}</td>
                <td>
                  {
                    {
                      ENTRADA: "Entrada",
                      TRANSFERENCIA: "Entrega",
                      DEVOLUCAO: "Devolução",
                      APLICACAO: "Aplicação em OS",
                    }[m.tipo]
                  }
                </td>
                <td>{m.tecnico || "Matriz"}</td>
                <td>{m.quantidade}</td>
                <td>{m.order_id || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        O adesivo é baixado da carga somente quando a aplicação na OS é
        confirmada no ZenControl.
      </p>
    </section>
  );
}

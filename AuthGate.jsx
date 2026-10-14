import { useEffect, useState } from "react";
import { api, errorMessage, saveToken } from "../lib/api";
export default function AuthGate({ children }) {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function check() {
    setStatus("loading");
    setError("");
    try {
      const { data } = await api.get("/auth/session");
      setStatus(data.authenticated ? "ready" : "login");
    } catch (e) {
      setError(errorMessage(e));
      setStatus("error");
    }
  }
  useEffect(() => {
    check();
    const expired = () => {
      setStatus("login");
      setError("Sua sessão expirou. Entre novamente.");
    };
    window.addEventListener("invent:unauthorized", expired);
    return () => window.removeEventListener("invent:unauthorized", expired);
  }, []);
  async function login(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login", { password });
      saveToken(data.token);
      setPassword("");
      setStatus("ready");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (status === "ready") return children;
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-slate-900 mb-3">
          Estoque <span className="text-blue-600">Pro</span>
        </h1>
        {status === "loading" ? (
          <p role="status">Conectando ao inventário…</p>
        ) : status === "error" ? (
          <>
            <p role="alert" className="text-red-700 mb-4">
              {error}
            </p>
            <button
              onClick={check}
              className="bg-blue-600 text-white rounded-lg p-3"
            >
              Tentar novamente
            </button>
          </>
        ) : (
          <form onSubmit={login} className="space-y-4">
            <p className="text-slate-600">
              Entre para consultar e movimentar equipamentos.
            </p>
            <label className="block font-medium" htmlFor="password">
              Senha de acesso
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg p-3"
            />
            {error && (
              <p role="alert" className="text-red-700">
                {error}
              </p>
            )}
            <button
              disabled={busy}
              className="w-full bg-blue-600 text-white rounded-lg p-3 disabled:opacity-50"
            >
              {busy ? "Entrando…" : "Entrar"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

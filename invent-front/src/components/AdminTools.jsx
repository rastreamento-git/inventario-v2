import { useEffect, useRef, useState } from "react";
import {
  Download,
  ShieldCheck,
  UserPlus,
  Database,
  RotateCcw,
  KeyRound,
  LoaderCircle,
} from "lucide-react";
import { api, errorMessage, saveToken } from "../lib/api";
import { useSession } from "../lib/session";
import { notify, confirmAction } from "../lib/feedback";
import { downloadJson } from "../lib/download";
import Modal from "./Modal";
import ZenCentralLink from "./ZenCentralLink";

export default function AdminTools({ panel, onClose, onReset }) {
  const user = useSession();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    nome: "",
    login: "",
    password: "",
    repeat: "",
    papel: "operador",
  });
  const [prepared, setPrepared] = useState(null),
    [source, setSource] = useState(null),
    [scope, setScope] = useState("all"),
    [password, setPassword] = useState("");
  const [editing, setEditing] = useState(null),
    [newPassword, setNewPassword] = useState("");
  const input = useRef(null);
  async function loadUsers() {
    const { data } = await api.get("/admin/users");
    setUsers(data);
  }
  useEffect(() => {
    if (panel === "users" && user?.identity_provider !== "zen")
      loadUsers().catch((e) => setError(errorMessage(e)));
  }, [panel, user?.identity_provider]);
  function change(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }
  async function create(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (form.password !== form.repeat) {
      setError("As senhas precisam ser iguais.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/admin/users", {
        nome: form.nome,
        login: form.login,
        password: form.password,
        papel: form.papel,
      });
      setForm({
        nome: "",
        login: "",
        password: "",
        repeat: "",
        papel: "operador",
      });
      await loadUsers();
      notify(
        "Usuário cadastrado. Ele já pode entrar com seu login e senha.",
        "success",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function toggle(row) {
    if (
      !(await confirmAction(
        `${row.ativo ? "Desativar" : "Ativar"} o acesso de ${row.nome}?`,
        {
          title: "Acesso do usuário",
          confirmLabel: row.ativo ? "Desativar" : "Ativar",
          danger: row.ativo,
        },
      ))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api.put(`/admin/users/${row.id}`, { ativo: !row.ativo });
      await loadUsers();
      notify("Acesso atualizado.", "success");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function resetPassword(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.put(`/admin/users/${editing.id}`, { nova_senha: newPassword });
      const self = editing.id === user?.id;
      setEditing(null);
      setNewPassword("");
      notify("Senha atualizada.", "success");
      if (self) {
        saveToken(null);
        window.dispatchEvent(
          new CustomEvent("invent:unauthorized", {
            detail: { reason: "password_change" },
          }),
        );
      } else await loadUsers();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function makeBackup() {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.get("/admin/backup");
      const filename = downloadJson(data);
      setPrepared({ checksum: data.checksum, counts: data.counts, filename });
      notify(
        "Backup gerado. Confira o arquivo nos downloads do dispositivo.",
        "success",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function readSource(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setSource(null);
    if (file.size > 25 * 1024 * 1024) {
      setError("O backup deve ter até 25 MB.");
      return;
    }
    try {
      const data = JSON.parse(await file.text());
      if (
        data.format !== "estoquepro-inventory" ||
        data.version !== 1 ||
        !data.data ||
        typeof data.checksum !== "string"
      )
        throw Error("Arquivo não é um backup compatível.");
      setSource({ filename: file.name, backup: data });
    } catch (e) {
      setError(e.message || "Não foi possível ler o arquivo.");
    }
  }
  async function reset() {
    if (!prepared || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/admin/reset", {
        confirmation: "thereisnourflevel",
        scope,
        password,
        expectedChecksum: prepared.checksum,
      });
      notify(
        "Inventário reiniciado. Pronto para começar a produção.",
        "success",
      );
      onClose();
      await onReset();
    } catch (e) {
      setError(errorMessage(e));
      if (e.response?.status === 409) setPrepared(null);
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    if (!source || !prepared || busy) return;
    if (
      !(await confirmAction(
        "O conteúdo do arquivo vai substituir os cadastros e movimentações atuais. Confirmar restauração?",
        {
          title: "Restaurar inventário",
          confirmLabel: "Restaurar backup",
          danger: true,
        },
      ))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api.post("/admin/restore", {
        confirmation: "restaurar",
        backup: source.backup,
        password,
        expectedChecksum: prepared.checksum,
      });
      notify("Backup restaurado com sucesso.", "success");
      onClose();
      await onReset();
    } catch (e) {
      setError(errorMessage(e));
      if (e.response?.status === 409) setPrepared(null);
    } finally {
      setBusy(false);
    }
  }
  const title =
    panel === "users"
      ? "Usuários e acessos"
      : panel === "reset"
        ? "Reiniciar inventário"
        : "Backups locais";
  return (
    <Modal title={title} onClose={onClose} busy={busy} wide>
      <div className="admin-panel">
        <div className="admin-banner">
          <ShieldCheck size={20} />
          <span>
            Administrador: <strong>{user?.nome || "Administrador"}</strong>
          </span>
        </div>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {panel === "users" && user?.identity_provider === "zen" ? (
          <section>
            <h3>Contas gerenciadas no ZenControl</h3>
            <p>
              Cadastre usuários e ajuste os perfis na central. A mesma conta dá
              acesso ao estoque.
            </p>
            <ZenCentralLink />
          </section>
        ) : panel === "users" ? (
          <>
            <form className="admin-user-form" onSubmit={create}>
              <h3>
                <UserPlus size={18} /> Cadastrar usuário
              </h3>
              <fieldset className="form-grid" disabled={busy}>
                <label>
                  Nome
                  <input
                    name="nome"
                    required
                    maxLength={120}
                    value={form.nome}
                    onChange={change}
                  />
                </label>
                <label>
                  Login
                  <input
                    name="login"
                    required
                    minLength={3}
                    maxLength={48}
                    autoComplete="off"
                    value={form.login}
                    onChange={change}
                  />
                </label>
                <label>
                  Senha
                  <input
                    name="password"
                    required
                    type="password"
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={change}
                  />
                </label>
                <label>
                  Repetir senha
                  <input
                    name="repeat"
                    required
                    type="password"
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    value={form.repeat}
                    onChange={change}
                  />
                </label>
                <label>
                  Perfil
                  <select
                    aria-label="Perfil"
                    name="papel"
                    value={form.papel}
                    onChange={change}
                  >
                    <option value="operador">Operador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </label>
              </fieldset>
              <p className="field-hint">
                Operadores trabalham no inventário. Administradores também
                gerenciam usuários, backups e resets.
              </p>
              <button className="primary-button" disabled={busy} type="submit">
                {busy ? (
                  <LoaderCircle className="is-spinning" size={16} />
                ) : (
                  <UserPlus size={16} />
                )}{" "}
                Cadastrar usuário
              </button>
            </form>
            <div className="admin-users">
              <h3>
                Acessos cadastrados <span>{users.length}</span>
              </h3>
              {users.map((row) => (
                <div className="user-row" key={row.id}>
                  <div>
                    <strong>{row.nome}</strong>
                    <small>
                      {row.login} ·{" "}
                      {row.papel === "admin" ? "Administrador" : "Operador"} ·{" "}
                      {row.ativo ? "Ativo" : "Desativado"}
                      {row.id === user?.id ? " · Você" : ""}
                    </small>
                  </div>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => {
                        setEditing(row);
                        setNewPassword("");
                        setError("");
                      }}
                      aria-label={`Alterar senha de ${row.nome}`}
                    >
                      <KeyRound size={15} />
                      <span>Senha</span>
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy || row.id === user?.id}
                      onClick={() => toggle(row)}
                    >
                      {row.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {panel === "reset" && (
              <div className="reset-description">
                <Database size={24} />
                <div>
                  <h3>Começar com o inventário limpo</h3>
                  <p>
                    Baixe o backup e confirme o que deseja apagar. Os usuários e
                    a auditoria administrativa são preservados.
                  </p>
                </div>
              </div>
            )}
            <section className="backup-card">
              <div>
                <h3>
                  <Download size={18} />{" "}
                  {panel === "reset"
                    ? "1. Baixar backup antes do reset"
                    : "Baixar backup do inventário"}
                </h3>
                <p>
                  Modelos, técnicos, seriais, saldos, movimentações e histórico
                  individual, em um arquivo JSON.
                </p>
              </div>
              <button
                className="primary-button"
                type="button"
                disabled={busy}
                onClick={makeBackup}
              >
                <Download size={16} />
                {prepared ? "Baixar novo backup" : "Baixar backup local"}
              </button>
            </section>
            {prepared && (
              <div className="backup-ready" role="status">
                <strong>Backup gerado</strong>
                <span>
                  {prepared.counts.equipamentos_seriais} equipamentos ·{" "}
                  {prepared.counts.produtos} modelos ·{" "}
                  {prepared.counts.tecnicos} técnicos
                </span>
                <small>{prepared.filename}</small>
              </div>
            )}
            {panel === "reset" ? (
              <section className="reset-form">
                <h3>2. Confirmar reset</h3>
                <label>
                  O que será apagado?
                  <select
                    aria-label="O que será apagado?"
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    disabled={busy}
                  >
                    <option value="all">
                      Todo o inventário: modelos, técnicos, seriais e
                      movimentações
                    </option>
                    <option value="stock">
                      Somente seriais e movimentações; manter modelos e técnicos
                    </option>
                  </select>
                </label>
                <label>
                  Sua senha atual
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <p className="field-hint">
                  Se alguém movimentar o estoque após o backup, será necessário
                  baixar outro antes de apagar.
                </p>
                <div className="dialog-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={busy}
                    onClick={onClose}
                  >
                    Cancelar
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    disabled={busy || !prepared || !password}
                    onClick={reset}
                  >
                    {busy ? (
                      <LoaderCircle className="is-spinning" size={16} />
                    ) : (
                      <RotateCcw size={16} />
                    )}
                    Confirmar reset
                  </button>
                </div>
              </section>
            ) : (
              <section className="restore-form">
                <h3>
                  <RotateCcw size={18} /> Restaurar um backup local
                </h3>
                <p>
                  A restauração substitui os dados do inventário. Primeiro baixe
                  um backup do estado atual.
                </p>
                <input
                  ref={input}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={readSource}
                />
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => input.current.click()}
                >
                  Selecionar arquivo JSON
                </button>
                {source && (
                  <p className="field-hint">
                    Selecionado: {source.filename} · Exportado em{" "}
                    {new Date(source.backup.exportedAt).toLocaleString("pt-BR")}
                  </p>
                )}
                <label>
                  Sua senha atual
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <button
                  type="button"
                  className="danger-button"
                  disabled={busy || !source || !prepared || !password}
                  onClick={restore}
                >
                  Restaurar backup
                </button>
              </section>
            )}
          </>
        )}
      </div>
      {editing && (
        <Modal
          title={`Alterar senha · ${editing.nome}`}
          onClose={() => setEditing(null)}
          busy={busy}
        >
          <form onSubmit={resetPassword}>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <label>
              Nova senha
              <input
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            {editing.id === user?.id && (
              <p className="field-hint">
                Após alterar sua senha, entre novamente.
              </p>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                Cancelar
              </button>
              <button className="primary-button" type="submit" disabled={busy}>
                Salvar nova senha
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Modal>
  );
}

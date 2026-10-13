import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  ArrowUpRight, CalendarDays, Package, Users,
  ShieldCheck, Box, PackagePlus, Truck, Search,
} from "lucide-react";

const number = (value) =>
  Number(value || 0).toLocaleString("pt-BR");

export default function Dashboard({
  data,
  produtos = [],
  tecnicos = [],
  imeis = [],
  onNavigate,
}) {
  const stats = [
    ["Hoje", data.kpis?.diario, "Instalações no dia", "mint"],
    ["Esta semana", data.kpis?.semanal, "Instalações na semana", "blue"],
    ["Este mês", data.kpis?.mensal, "Instalações no mês", "violet"],
    ["Este trimestre", data.kpis?.trimestral, "Instalações no trimestre", "amber"],
  ];

  const stock = [
    [
      "Itens na matriz",
      produtos.reduce(
        (sum, p) => sum + Number(p.quantidade_matriz || 0), 0,
      ),
      Package,
    ],
    ["Técnicos ativos", tecnicos.length, Users],
    [
      "Em triagem",
      imeis.filter((i) => i.status === "TRIAGEM").length,
      ShieldCheck,
    ],
    ["Modelos cadastrados", produtos.length, Box],
  ];

  const team = data.tecnicos || [];
  const top = Math.max(
    1,
    ...team.map((t) => Number(t.total_mes || 0)),
  );

  const actions = [
    ["entrada", "Registrar entrada", "Novos equipamentos na matriz", PackagePlus],
    ["transferencia", "Preparar uma carga", "Distribuir equipamentos à equipe", Truck],
    ["rastreio", "Consultar um IMEI", "Ver situação e histórico do serial", Search],
  ];

  return (
    <div className="dashboard-view">
      <div className="dashboard-intro">
        <div>
          <span className="eyebrow">PAINEL DE CONTROLE</span>
          <h2>Uma visão clara da operação.</h2>
          <p>
            Disponibilidade, instalações e desempenho da equipe em um só lugar.
          </p>
        </div>
        <span className="intro-chip">
          <CalendarDays size={15} /> Resumo das instalações
        </span>
      </div>

      <div className="stat-grid">
        {stats.map(([label, value, caption, color]) => (
          <article className={`stat-card ${color}`} key={label}>
            <div className="stat-card-top">
              <span>{label}</span>
              <span className="stat-icon">
                <ArrowUpRight size={18} />
              </span>
            </div>
            <strong className="stat-value">{number(value)}</strong>
            <span className="stat-caption">{caption}</span>
            <div className="stat-decoration" aria-hidden="true" />
          </article>
        ))}
      </div>

      <section className="stock-overview" aria-label="Resumo do inventário">
        {stock.map(([label, value, Icon]) => (
          <div className="stock-item" key={label}>
            <span className="stock-icon"><Icon size={19} /></span>
            <div>
              <span>{label}</span>
              <strong>{number(value)}</strong>
            </div>
          </div>
        ))}
      </section>

      <div className="dashboard-columns">
        <section className="dashboard-panel chart-panel">
          <div className="panel-heading">
            <div>
              <h3>Ritmo de instalações</h3>
              <p>Volume registrado nos últimos 7 dias</p>
            </div>
            <span className="chart-legend"><i /> Instalações</span>
          </div>

          <div className="chart-container">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={data.grafico || []}
                margin={{ top: 12, right: 8, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="inventory-bars"
                    x1="0" y1="0" x2="0" y2="1"
                  >
                    <stop offset="0%" stopColor="#14b8a6" />
                    <stop offset="100%" stopColor="#0f766e" />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  vertical={false}
                  stroke="#edf1f4"
                  strokeDasharray="4 4"
                />
                <XAxis
                  dataKey="dia"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "#f0fdfa", radius: 8 }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 8px 24px #0f172a0d",
                  }}
                  formatter={(value) => [number(value), "Instalações"]}
                />
                <Bar
                  dataKey="instalacoes"
                  fill="url(#inventory-bars)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="dashboard-panel team-panel">
          <div className="panel-heading">
            <div>
              <h3>Desempenho da equipe</h3>
              <p>Instalações nos últimos 30 dias</p>
            </div>
            <span className="panel-icon"><Users size={18} /></span>
          </div>

          {team.length ? (
            <div className="team-list">
              {team.map((t, index) => (
                <div className="team-row" key={t.id}>
                  <span className="team-avatar">
                    {String(t.nome)
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase()}
                  </span>

                  <div className="team-person">
                    <div>
                      <strong>{t.nome}</strong>
                      <span>{number(t.total_mes)}</span>
                    </div>
                    <div className="team-progress">
                      <i
                        style={{
                          width: `${Number(t.total_mes || 0) / top * 100}%`,
                        }}
                      />
                    </div>
                    <small>
                      {number(t.media_diaria)} instalações/dia
                    </small>
                  </div>

                  <span className="team-position">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty">
              <Users size={28} />
              <strong>Sua equipe aparece aqui</strong>
              <p>
                Cadastre os técnicos para acompanhar as instalações.
              </p>
            </div>
          )}
        </section>
      </div>

      <section className="quick-actions">
        <div>
          <span className="eyebrow">PRÓXIMA MOVIMENTAÇÃO</span>
          <h3>O que você precisa fazer?</h3>
        </div>
        <div className="quick-action-grid">
          {actions.map(([id, label, detail, Icon]) => (
            <button key={id} onClick={() => onNavigate(id)}>
              <span className="quick-action-icon"><Icon size={20} /></span>
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
              <ArrowUpRight size={18} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

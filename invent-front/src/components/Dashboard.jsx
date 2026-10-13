import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
export default function TelaDashboard({ data }) {
  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-gray-800">Visão Geral</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <CardStat
          titulo="Hoje"
          valor={data.kpis?.diario || 0}
          cor="from-blue-500"
        />
        <CardStat
          titulo="Esta Semana"
          valor={data.kpis?.semanal || 0}
          cor="from-indigo-500"
        />
        <CardStat
          titulo="Este Mês"
          valor={data.kpis?.mensal || 0}
          cor="from-purple-500"
        />
        <CardStat
          titulo="Este Trimestre"
          valor={data.kpis?.trimestral || 0}
          cor="from-slate-700"
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <h3 className="text-lg font-bold mb-4">Instalações (7 dias)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.grafico}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="dia" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="instalacoes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold mb-4">Desempenho da Equipe</h3>
          <div className="overflow-x-auto max-h-[300px]">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 text-sm">
                  <th className="p-3">Técnico</th>
                  <th className="p-3 text-center">Últimos 30 dias</th>
                  <th className="p-3 text-center">Média Diária</th>
                </tr>
              </thead>
              <tbody>
                {data.tecnicos.map((t) => (
                  <tr key={t.id} className="text-sm border-b">
                    <td className="p-3 font-medium">{t.nome}</td>
                    <td className="p-3 text-center font-bold">{t.total_mes}</td>
                    <td className="p-3 text-center text-blue-600">
                      {t.media_diaria}/dia
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardStat({ titulo, valor, cor }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <h4 className="text-gray-500 text-sm font-semibold uppercase">
        {titulo}
      </h4>
      <p
        className={`text-4xl font-bold mt-2 text-transparent bg-clip-text bg-gradient-to-r ${cor} to-black`}
      >
        {valor}
      </p>
    </div>
  );
}

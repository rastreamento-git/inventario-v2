// Category-level minimum is shared by its models, matching the alert configuration.
export function groupForecast(forecasts, products) {
  const groups = new Map();
  for (const row of forecasts) {
    const product = products.find((item) => item.id === row.id);
    const category = row.categoria || product?.categoria || "RASTREADOR";
    if (!groups.has(category))
      groups.set(category, {
        categoria: category,
        consumo: 0,
        minimo: 0,
        quantidade_matriz: 0,
      });
    const group = groups.get(category);
    group.consumo += Number(row.uso_30_dias || 0);
    group.minimo = Math.max(
      group.minimo,
      Number(product?.estoque_minimo ?? row.estoque_minimo ?? 0),
    );
    group.quantidade_matriz += Number(row.quantidade_matriz || 0);
  }
  return [...groups.values()].map((group) => {
    const consumption = group.consumo / 30;
    const threshold = Math.max(group.minimo, Math.ceil(consumption * 22.5));
    return {
      ...group,
      cmd: consumption.toFixed(2),
      ponto_pedido: threshold,
      sugerido: Math.max(
        0,
        Math.ceil(
          Math.max(group.minimo, consumption * 52.5) - group.quantidade_matriz,
        ),
      ),
      status: group.quantidade_matriz <= threshold ? "URGENTE" : "OK",
    };
  });
}

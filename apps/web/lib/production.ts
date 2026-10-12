import type { Fluid, Row } from "./contract.ts";
import { historyWindow } from "./history.ts";
import {
  change,
  comparisonOffset,
  effectiveMode,
  referencePrice,
  shiftMonth,
  valuedVolume,
  type Comparison,
  type Mode,
  type Prices,
} from "./metrics.ts";

export function productionValue(
  row: Row | undefined,
  prices: Prices | null,
  mode: Mode,
): number | null {
  if (!row) return null;
  return mode === "value"
    ? valuedVolume(row.volume, row.fluid, row.periodo, prices)
    : row.volume;
}
export function absoluteChange(value: number | null, base: number | null) {
  return value == null || base == null ? null : value - base;
}
export function productionPoints(
  rows: Row[],
  fluid: Fluid,
  period: string,
  range: number,
  prices: Prices | null,
  mode: Mode,
) {
  const shownMode = effectiveMode(mode, fluid);
  const byPeriod = new Map(
    rows
      .filter((r) => r.fluid === fluid && r.periodo <= period)
      .map((r) => [r.periodo, r]),
  );
  return historyWindow(rows, fluid, period, range).points.map(({ periodo }) => {
    const row = byPeriod.get(periodo);
    const value = productionValue(row, prices, shownMode);
    const momBase = shiftMonth(periodo, -1),
      yoyBase = shiftMonth(periodo, -12);
    const previous = productionValue(byPeriod.get(momBase), prices, shownMode);
    const previousYear = productionValue(
      byPeriod.get(yoyBase),
      prices,
      shownMode,
    );
    return {
      periodo,
      volume: row?.volume ?? null,
      rate: row?.rate ?? null,
      price: row ? referencePrice(prices, periodo, fluid) : null,
      estimated: row ? valuedVolume(row.volume, fluid, periodo, prices) : null,
      value,
      momBase,
      yoyBase,
      mom: absoluteChange(value, previous),
      yoy: absoluteChange(value, previousYear),
      momPct: change(value, previous),
      yoyPct: change(value, previousYear),
    };
  });
}
export function productionKpis(
  rows: Row[],
  fluid: Fluid,
  period: string,
  prices: Prices | null,
  mode: Mode,
  comparison: Comparison,
) {
  const history = rows
    .filter((r) => r.fluid === fluid && r.periodo <= period)
    .sort((a, b) => a.periodo.localeCompare(b.periodo));
  const shownMode = effectiveMode(mode, fluid);
  const value = productionValue(
    history.find((r) => r.periodo === period),
    prices,
    shownMode,
  );
  const basePeriod = shiftMonth(period, comparisonOffset(comparison));
  const base = productionValue(
    history.find((r) => r.periodo === basePeriod),
    prices,
    shownMode,
  );
  const count = Number(period.slice(5, 7));
  const start = `${period.slice(0, 4)}-01-01`;
  const sumYear = (offset: number) => {
    const values = Array.from({ length: count }, (_, i) =>
      productionValue(
        history.find((r) => r.periodo === shiftMonth(start, i + offset)),
        prices,
        shownMode,
      ),
    );
    return values.some((v) => v == null)
      ? null
      : values.reduce<number>((sum, v) => sum + v!, 0);
  };
  const accumulated = sumYear(0),
    previousAccumulated = sumYear(-12);
  const candidates = history.map((r) => ({
    periodo: r.periodo,
    value: productionValue(r, prices, shownMode),
  }));
  // A missing valuation must not turn a partial monetary history into a record claim.
  const maximum =
    candidates.length && candidates.every((p) => p.value != null)
      ? candidates.reduce((best, p) => (p.value! >= best.value! ? p : best))
      : null;
  return {
    value,
    delta: absoluteChange(value, base),
    pct: change(value, base),
    basePeriod,
    accumulated,
    previousAccumulated,
    accumulatedGrowth: change(accumulated, previousAccumulated),
    start,
    maximum,
    historyStart: history[0]?.periodo ?? null,
  };
}
export function yearlyComparison(
  rows: Row[],
  fluid: Fluid,
  period: string,
  prices: Prices | null,
  mode: Mode,
) {
  const available = rows.filter(
    (r) => r.fluid === fluid && r.periodo <= period,
  );
  const years = [...new Set(available.map((r) => r.periodo.slice(0, 4)))]
    .sort()
    .slice(-3);
  const byPeriod = new Map(available.map((r) => [r.periodo, r]));
  const points = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, "0");
    const point: { month: string; [year: string]: string | number | null } = {
      month,
    };
    for (const year of years)
      point[year] = productionValue(
        byPeriod.get(`${year}-${month}-01`),
        prices,
        effectiveMode(mode, fluid),
      );
    return point;
  });
  return { years, points };
}
export function productionCsv(
  points: ReturnType<typeof productionPoints>,
  fluid: Fluid,
  mode: Mode,
) {
  const unit = fluid === "oil" ? "bbl" : "m3",
    factor = fluid === "oil" ? 1 : 1e6;
  const metricUnit =
    effectiveMode(mode, fluid) === "value" ? "USD_estimated" : unit;
  const headers = [
    "period",
    "fluid",
    `volume_${unit}`,
    `daily_rate_${unit}_per_day`,
    "brent_USD_per_bbl",
    "estimated_value_USD",
    "comparison_metric_unit",
    "mom_base_period",
    `mom_absolute_${metricUnit}`,
    "mom_pct",
    "yoy_base_period",
    `yoy_absolute_${metricUnit}`,
    "yoy_pct",
  ];
  const physical = effectiveMode(mode, fluid) === "volume" ? factor : 1;
  const scaled = (v: number | null, n: number) => (v == null ? null : v * n);
  return (
    [
      headers,
      ...points.map((p) => [
        p.periodo,
        fluid,
        scaled(p.volume, factor),
        scaled(p.rate, factor),
        p.price,
        p.estimated,
        metricUnit,
        p.momBase,
        scaled(p.mom, physical),
        p.momPct,
        p.yoyBase,
        scaled(p.yoy, physical),
        p.yoyPct,
      ]),
    ]
      .map((row) => row.map((v) => (v == null ? "" : String(v))).join(","))
      .join("\r\n") + "\r\n"
  );
}

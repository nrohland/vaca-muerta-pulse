import { trend, type Row, type Fluid } from "./contract.ts";
export const historyRanges = [12, 24, 36, 0] as const;
export const defaultHistoryRange = 36;

// Presentation window only. Never create observations before validated coverage.
export function historyWindow(
  rows: Row[],
  fluid: Fluid,
  period: string,
  requested: number,
) {
  const first = rows
    .filter((r) => r.fluid === fluid && r.periodo <= period)
    .map((r) => r.periodo)
    .sort()[0];
  const months = first ? (Number(period.slice(0,4))-Number(first.slice(0,4)))*12 + Number(period.slice(5,7))-Number(first.slice(5,7))+1 : 0;
  const resolved = requested === 0 ? months : requested;
  const points = first
    ? trend(rows, fluid, period, resolved).filter((p) => p.periodo >= first)
    : [];
  const observed = points.filter((p) =>
    rows.some((r) => r.fluid === fluid && r.periodo === p.periodo),
  );
  return {
    points,
    requested: resolved,
    available: observed.length,
    start: points[0]?.periodo ?? null,
    end: points.at(-1)?.periodo ?? null,
    partial: observed.length < resolved,
  };
}

export function historyTicks(periods: string[], requested: number) {
  const stride =
    requested >= 60 ? 12 : requested >= 36 ? 6 : requested >= 24 ? 4 : 2;
  return periods.filter((_, i) => i % stride === 0 || i === periods.length - 1);
}

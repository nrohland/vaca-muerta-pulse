import type { Entity, Fluid, Row } from "./contract.ts";
export type Mode = "volume" | "value";
export type Prices = {
  schema_version: 1;
  source: {
    provider: string;
    series: string;
    url: string;
    unit: "USD/bbl";
    frequency: "monthly";
    source_updated_at: string;
    retrieved_at: string;
    response_sha256: string;
  };
  prices: { periodo: string; usd_per_bbl: number }[];
  gas: { status: "unavailable"; reason: string; reviewed_sources: string[] };
};
export type Metric = {
  value: number | null;
  yoy: number | null;
  mom: number | null;
};
export function validatePrices(v: unknown): Prices {
  const p = v as Prices;
  if (
    !p ||
    p.schema_version !== 1 ||
    p.source?.unit !== "USD/bbl" ||
    p.source.frequency !== "monthly" ||
    p.source.provider !== "EIA" ||
    !p.source.url.startsWith("https://www.eia.gov/") ||
    !Number.isFinite(Date.parse(p.source.source_updated_at)) ||
    !Number.isFinite(Date.parse(p.source.retrieved_at)) ||
    !/^[a-f0-9]{64}$/.test(p.source.response_sha256) ||
    !Array.isArray(p.prices) ||
    p.gas?.status !== "unavailable"
  )
    throw Error("Referencia de precios inválida");
  const seen = new Set<string>();
  for (const r of p.prices) {
    if (
      !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(r.periodo) ||
      seen.has(r.periodo) ||
      typeof r.usd_per_bbl !== "number" ||
      !Number.isFinite(r.usd_per_bbl) ||
      r.usd_per_bbl <= 0
    )
      throw Error("Precio mensual inválido");
    seen.add(r.periodo);
  }
  return p;
}
export function shiftMonth(period: string, offset: number) {
  const d = new Date(`${period}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 10);
}
export function daysInMonth(period: string) {
  const d = new Date(`${period}T00:00:00Z`);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
}
export function change(
  value: number | null | undefined,
  base: number | null | undefined,
) {
  return value == null || base == null || base <= 0
    ? null
    : (value / base - 1) * 100;
}
export function referencePrice(
  prices: Prices | null,
  period: string,
  fluid: Fluid,
) {
  return fluid === "oil"
    ? (prices?.prices.find((p) => p.periodo === period)?.usd_per_bbl ?? null)
    : null;
}
export function valuedVolume(
  volume: number | null | undefined,
  fluid: Fluid,
  period: string,
  prices: Prices | null,
) {
  const price = referencePrice(prices, period, fluid);
  return volume == null || price == null ? null : volume * price;
}
export function metric(
  row: Row,
  rows: Row[],
  prices: Prices | null,
  kind: "rate" | "volume" | "wells" | "estimate" | "price",
  mode: Mode = "volume",
): Metric {
  if (kind === "price") {
    const value = referencePrice(prices, row.periodo, row.fluid);
    return {
      value,
      yoy: change(
        value,
        referencePrice(prices, shiftMonth(row.periodo, -12), row.fluid),
      ),
      mom: change(
        value,
        referencePrice(prices, shiftMonth(row.periodo, -1), row.fluid),
      ),
    };
  }
  const previous = (offset: number) =>
    rows.find(
      (r) =>
        r.fluid === row.fluid && r.periodo === shiftMonth(row.periodo, offset),
    );
  const read = (r: Row | undefined): number | null => {
    if (!r) return null;
    if (kind === "wells") return r.positive_producing_wells;
    if (kind === "estimate" || mode === "value") {
      const v = valuedVolume(r.volume, r.fluid, r.periodo, prices);
      return v == null
        ? null
        : kind === "rate"
          ? v / daysInMonth(r.periodo)
          : v;
    }
    return r[kind];
  };
  const value = read(row);
  return {
    value,
    yoy: change(value, read(previous(-12))),
    mom: change(value, read(previous(-1))),
  };
}
export function entityValue(e: Entity, prices: Prices | null, mode: Mode) {
  return mode === "value"
    ? valuedVolume(e.volume, e.fluid, e.periodo, prices)
    : e.volume;
}
export function entityYoY(e: Entity, prices: Prices | null, mode: Mode) {
  if (mode === "volume") return e.yoy_volume_pct;
  return change(
    entityValue(e, prices, mode),
    valuedVolume(
      e.yoy_volume as number | null,
      e.fluid,
      shiftMonth(e.periodo, -12),
      prices,
    ),
  );
}
export function effectiveMode(mode: Mode, fluid: Fluid) {
  return fluid === "gas" ? "volume" : mode;
}
export const estimationNote =
  "Valor bruto estimado a precio Brent. No representa facturación efectiva.";

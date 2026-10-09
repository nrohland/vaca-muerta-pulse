import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  metric,
  validatePrices,
  valuedVolume,
  entityValue,
  entityYoY,
  shiftMonth,
  change,
  effectiveMode,
} from "../lib/metrics.ts";
import { validateRelease } from "../lib/contract.ts";
import { readSelection } from "../lib/navigation.ts";
const release = validateRelease(
  JSON.parse(
    readFileSync(
      new URL("../public/data/release.json", import.meta.url),
      "utf8",
    ),
  ),
);
const prices = validatePrices(
  JSON.parse(
    readFileSync(
      new URL("../public/data/prices.json", import.meta.url),
      "utf8",
    ),
  ),
);
const close = (a: number | null, b: number | null) =>
  a == null || b == null
    ? assert.equal(a, b)
    : assert.ok(
        Math.abs(a - b) <= Math.max(1e-7, Math.abs(b) * 1e-10),
        `${a} != ${b}`,
      );
test("physical comparisons reproduce dbt for every accepted month, independently for volume and daily rate", () => {
  for (const r of release.production)
    for (const kind of ["rate", "volume"] as const) {
      const m = metric(r, release.production, prices, kind);
      close(m.yoy, r[`yoy_${kind}_pct`] as number | null);
      close(m.mom, r[`mom_${kind}_pct`] as number | null);
    }
});
test("each monetary month uses its own historical price and calendar days; comparisons include price changes", () => {
  for (const r of release.production.filter((r) => r.fluid === "oil")) {
    const p = prices.prices.find((p) => p.periodo === r.periodo)!;
    const v = metric(r, release.production, prices, "volume", "value");
    const daily = metric(r, release.production, prices, "rate", "value");
    close(v.value, r.volume * p.usd_per_bbl);
    close(daily.value, v.value! / Number(r.days_in_month));
    for (const [offset, k] of [
      [-12, "yoy"],
      [-1, "mom"],
    ] as const) {
      const base = release.production.find(
        (b) => b.fluid === "oil" && b.periodo === shiftMonth(r.periodo, offset),
      );
      const bp = prices.prices.find(
        (p) => p.periodo === shiftMonth(r.periodo, offset),
      );
      close(
        v[k],
        base && bp
          ? ((r.volume * p.usd_per_bbl) / (base.volume * bp.usd_per_bbl) - 1) *
              100
          : null,
      );
    }
  }
  const last = release.production.filter((r) => r.fluid === "oil").at(-1)!;
  assert.notEqual(
    metric(last, release.production, prices, "volume", "value").yoy,
    last.yoy_volume_pct,
  );
});
test("productive wells compare unique positive counts, not production growth", () => {
  const r = release.production.filter((r) => r.fluid === "oil").at(-1)!;
  const base = release.production.find(
    (b) => b.fluid === "oil" && b.periodo === shiftMonth(r.periodo, -12),
  )!;
  close(
    metric(r, release.production, prices, "wells").yoy,
    (r.positive_producing_wells / base.positive_producing_wells - 1) * 100,
  );
  assert.notEqual(
    metric(r, release.production, prices, "wells").yoy,
    r.yoy_volume_pct,
  );
});
test("uniform monetary entity references reconcile to totals and retain honest total-denominator shares", () => {
  for (const r of release.production.filter((r) => r.fluid === "oil"))
    for (const dim of ["area", "company"]) {
      const entities = release.entities.filter(
        (e) =>
          e.fluid === r.fluid && e.periodo === r.periodo && e.dimension === dim,
      );
      close(
        entities.reduce((sum, e) => sum + entityValue(e, prices, "value")!, 0),
        valuedVolume(r.volume, r.fluid, r.periodo, prices),
      );
      for (const e of entities) {
        const bv = valuedVolume(
          e.yoy_volume as number | null,
          e.fluid,
          shiftMonth(e.periodo, -12),
          prices,
        );
        close(
          entityYoY(e, prices, "value"),
          change(entityValue(e, prices, "value"), bv),
        );
      }
    }
});
test("missing prices, missing calendar bases, zero bases and gas never create invented monetary values", () => {
  const r = release.production.find((r) => r.fluid === "oil")!;
  const empty = { ...prices, prices: [] };
  assert.equal(metric(r, release.production, empty, "estimate").value, null);
  assert.equal(metric(r, [r], prices, "wells").mom, null);
  assert.equal(change(10, 0), null);
  assert.equal(valuedVolume(1, "gas", r.periodo, prices), null);
  assert.equal(effectiveMode("value", "gas"), "volume");
  const bad = structuredClone(prices);
  bad.prices.push(bad.prices[0]);
  assert.throws(() => validatePrices(bad));
  bad.prices[0].usd_per_bbl = NaN;
  assert.throws(() => validatePrices(bad));
  assert.equal(
    readSelection("?fluid=gas&mode=value&month=2026-08-01").mode,
    "value",
  );
});

test("reference-price comparisons can use verified prices before the production-history window", () => {
  const r = release.production
    .filter((r) => r.fluid === "oil")
    .sort((a, b) => a.periodo.localeCompare(b.periodo))[0];
  const current = prices.prices.find(
    (p) => p.periodo === r.periodo,
  )!.usd_per_bbl;
  const base = prices.prices.find(
    (p) => p.periodo === shiftMonth(r.periodo, -12),
  )!.usd_per_bbl;
  close(metric(r, [r], prices, "price").yoy, (current / base - 1) * 100);
  assert.equal(metric(r, [r], prices, "volume", "value").yoy, null);
});

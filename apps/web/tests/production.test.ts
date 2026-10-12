import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  productionKpis,
  productionPoints,
  productionCsv,
  yearlyComparison,
  absoluteChange,
} from "../lib/production.ts";
import { validateRelease, type Row } from "../lib/contract.ts";
import { validatePrices, shiftMonth } from "../lib/metrics.ts";
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
test("absolute volume changes reconcile with every prepared MoM/YoY delta; monetary uses each historical price", () => {
  for (const fluid of ["oil", "gas"] as const)
    for (const mode of ["volume", "value"] as const) {
      const pts = productionPoints(
        release.production,
        fluid,
        "2026-08-01",
        0,
        prices,
        mode,
      );
      for (const p of pts) {
        const r = release.production.find(
          (r) => r.fluid === fluid && r.periodo === p.periodo,
        )!;
        for (const [c, offset] of [
          ["mom", -1],
          ["yoy", -12],
        ] as const) {
          const b = release.production.find(
            (r) =>
              r.fluid === fluid && r.periodo === shiftMonth(p.periodo, offset),
          );
          if (mode === "volume" || fluid === "gas")
            close(p[c], r[`${c}_volume_delta`] as number | null);
          else {
            const cp = prices.prices.find(
              (v) => v.periodo === p.periodo,
            )!.usd_per_bbl;
            const bp = prices.prices.find(
              (v) => v.periodo === shiftMonth(p.periodo, offset),
            )?.usd_per_bbl;
            close(p[c], b && bp ? r.volume * cp - b.volume * bp : null);
          }
        }
      }
    }
});
test("YTD sums exact January–selected months and peak excludes future data", () => {
  for (const fluid of ["oil", "gas"] as const)
    for (const mode of ["volume", "value"] as const) {
      const k = productionKpis(
        release.production,
        fluid,
        "2026-08-01",
        prices,
        mode,
        "yoy",
      );
      const sum = (year: string) =>
        release.production
          .filter(
            (r) =>
              r.fluid === fluid &&
              r.periodo.startsWith(year) &&
              r.periodo.slice(5, 7) <= "08",
          )
          .reduce(
            (s, r) =>
              s +
              r.volume *
                (mode === "value" && fluid === "oil"
                  ? prices.prices.find((p) => p.periodo === r.periodo)!
                      .usd_per_bbl
                  : 1),
            0,
          );
      close(k.accumulated, sum("2026"));
      close(k.previousAccumulated, sum("2025"));
      close(k.accumulatedGrowth, (sum("2026") / sum("2025") - 1) * 100);
      const early = productionKpis(
        release.production,
        fluid,
        "2024-02-01",
        prices,
        mode,
        "mom",
      );
      assert.ok(early.maximum!.periodo <= "2024-02-01");
    }
});
test("missing months, missing prices and a zero base preserve honest nulls and signed deltas", () => {
  const sample = release.production.find((r) => r.fluid === "oil")!;
  const row = (periodo: string, volume: number): Row => ({
    ...sample,
    periodo,
    volume,
    rate: volume / 31,
  });
  const rows = [
    row("2024-01-01", 0),
    row("2024-02-01", 20),
    row("2024-04-01", 10),
  ];
  const points = productionPoints(
    rows,
    "oil",
    "2024-04-01",
    0,
    prices,
    "volume",
  );
  assert.equal(points[1].mom, 20);
  assert.equal(points[1].momPct, null);
  assert.equal(points[2].volume, null);
  assert.equal(points[3].mom, null);
  assert.equal(absoluteChange(0, 10), -10);
  assert.equal(absoluteChange(0, 0), 0);
  assert.equal(
    productionKpis(rows, "oil", "2024-04-01", prices, "volume", "mom")
      .accumulated,
    null,
  );
  const missing = {
    ...prices,
    prices: prices.prices.filter((p) => p.periodo !== "2026-07-01"),
  };
  const k = productionKpis(
    release.production,
    "oil",
    "2026-08-01",
    missing,
    "value",
    "mom",
  );
  assert.equal(k.delta, null);
  assert.equal(k.maximum, null);
  assert.equal(k.accumulatedGrowth, null);
  assert.equal(
    productionKpis(
      release.production,
      "oil",
      "2023-01-01",
      prices,
      "volume",
      "yoy",
    ).accumulatedGrowth,
    null,
  );
  assert.equal(
    productionPoints(
      release.production,
      "oil",
      "2026-08-01",
      12,
      null,
      "value",
    ).at(-1)!.estimated,
    null,
  );
  const gas = productionPoints(
    release.production,
    "gas",
    "2026-08-01",
    12,
    prices,
    "value",
  );
  assert.ok(
    gas.every(
      (p) => p.price === null && p.estimated === null && p.value === p.volume,
    ),
  );
});
test("year comparison aligns calendar months with gaps, no future observations and no mutated source", () => {
  const before = JSON.stringify(release.production);
  const result = yearlyComparison(
    release.production,
    "oil",
    "2026-08-01",
    prices,
    "volume",
  );
  assert.deepEqual(result.years, ["2024", "2025", "2026"]);
  assert.equal(result.points.length, 12);
  for (const p of result.points)
    for (const y of result.years) {
      const r = release.production.find(
        (r) =>
          r.fluid === "oil" &&
          r.periodo === `${y}-${p.month}-01` &&
          r.periodo <= "2026-08-01",
      );
      assert.equal(p[y], r?.volume ?? null);
    }
  assert.equal(result.points[8]["2026"], null);
  const earlier = yearlyComparison(
    release.production,
    "oil",
    "2023-02-01",
    prices,
    "volume",
  );
  assert.deepEqual(earlier.years, ["2023"]);
  assert.equal(earlier.points[2]["2023"], null);
  assert.equal(JSON.stringify(release.production), before);
});
test("CSV roundtrips raw precision, units, nulls, zeroes, signs and exact base dates", () => {
  for (const fluid of ["oil", "gas"] as const)
    for (const mode of ["volume", "value"] as const) {
      const points = productionPoints(
        release.production,
        fluid,
        "2026-08-01",
        0,
        prices,
        mode,
      );
      const csv = productionCsv(points, fluid, mode);
      assert.equal(csv.split("\r\n").length, 46);
      const [headers, ...body] = csv
        .trimEnd()
        .split("\r\n")
        .map((l) => l.split(","));
      assert.equal(headers[2], `volume_${fluid === "oil" ? "bbl" : "m3"}`);
      assert.equal(body[0][8], "");
      assert.equal(body[0][10], "2022-01-01");
      assert.equal(
        Number(body.at(-1)![2]),
        points.at(-1)!.volume! * (fluid === "gas" ? 1e6 : 1),
      );
      if (fluid === "gas") {
        assert.ok(
          body.every((r) => r[4] === "" && r[5] === "" && r[6] === "m3"),
        );
      } else assert.equal(Number(body.at(-1)![5]), points.at(-1)!.estimated);
    }
});

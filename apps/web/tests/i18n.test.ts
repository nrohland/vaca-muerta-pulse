import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatters, translations, readLanguage } from "../lib/i18n.ts";
import {
  entityComparison,
  comparisonOffset,
  shiftMonth,
  validatePrices,
  nonnegativeDomain,
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
test("compact formats preserve magnitude, precision and locale; exact values remain available", () => {
  const es = formatters("es"),
    en = formatters("en");
  for (const [v, s, e] of [
    [10353166, "10,35 M", "10.35M"],
    [2527252, "2,53 M", "2.53M"],
    [2860800, "2,86 M", "2.86M"],
    [12345, "12,35 K", "12.35K"],
    [999999, "1 M", "1M"],
    [0.12, "0,12", "0.12"],
    [0, "0", "0"],
  ] as const) {
    assert.equal(es.compact(v), s);
    assert.equal(en.compact(v), e);
  }
  assert.equal(es.number(669802, 0), "669.802");
  assert.equal(en.number(669802, 0), "669,802");
  assert.equal(es.exact(10353166.125), "10.353.166,125");
  assert.equal(en.exact(10353166.125), "10,353,166.125");
  assert.equal(es.percent(27.2, true), "+27,2%");
  assert.equal(en.percent(27.2, true), "+27.2%");
  assert.equal(es.compact(null), "No disponible");
  assert.equal(en.compact(null), "Unavailable");
});
test("dates, variables, preferences and known diagnostics have equivalent localized semantics", () => {
  const es = formatters("es"),
    en = formatters("en");
  assert.equal(es.month("2026-08-01"), "Agosto de 2026");
  assert.equal(en.month("2026-08-01"), "August 2026");
  assert.equal(
    en.t("vs. {period}", { period: en.month("2025-08-01") }),
    "vs. August 2025",
  );
  assert.equal(readLanguage("en"), "en");
  assert.equal(readLanguage("unknown"), "es");
  assert.equal(readLanguage(null), "es");
  for (const [key, value] of Object.entries(translations)) {
    assert.ok(value.length > 0);
    assert.deepEqual(
      [...key.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(),
      [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(),
    );
  }
  assert.match(en.date("2026-10-09T19:14:31Z"), /Oct 9, 2026.*UTC/);
  assert.match(en.date("2026-10-09T10:04:00"), /time zone not reported/);
});
test("monthly and yearly entity comparisons use exact calendar bases and same-period historical prices for all entities", () => {
  const before = JSON.stringify(release);
  for (const e of release.entities)
    for (const c of ["mom", "yoy"] as const) {
      const basePeriod = shiftMonth(e.periodo, comparisonOffset(c));
      const base = release.entities.find(
        (b) =>
          b.fluid === e.fluid &&
          b.dimension === e.dimension &&
          b.entity_id === e.entity_id &&
          b.periodo === basePeriod,
      );
      const rawBase = e[`${c}_volume`] as number | null;
      // Prepared bases are authoritative, including entities missing from the current/base snapshot.
      if (base && rawBase != null)
        assert.ok(
          Math.abs(rawBase - base.volume) < Math.max(1e-7, base.volume * 1e-10),
        );
      assert.equal(
        entityComparison(e, prices, "volume", c),
        e[`${c}_volume_pct`],
      );
      const p = prices.prices.find((p) => p.periodo === e.periodo)?.usd_per_bbl;
      const bp = prices.prices.find(
        (p) => p.periodo === basePeriod,
      )?.usd_per_bbl;
      const expected =
        e.fluid === "oil" && rawBase != null && rawBase > 0 && p && bp
          ? ((e.volume * p) / (rawBase * bp) - 1) * 100
          : null;
      const actual = entityComparison(e, prices, "value", c);
      if (expected == null) assert.equal(actual, null);
      else assert.ok(Math.abs(actual! - expected) < 1e-9);
    }
  assert.equal(JSON.stringify(release), before);
  assert.deepEqual(nonnegativeDomain, [0, "auto"]);
  assert.equal(
    readSelection("?fluid=gas&mode=value&comparison=mom").comparison,
    "mom",
  );
  assert.equal(readSelection("?comparison=annual-total").comparison, "yoy");
});

test("tooltip presentation uses bounded precision and compact monthly dates", () => {
  const es = formatters("es"),
    en = formatters("en");
  assert.equal(es.currency(1891200000), "US$ 1.891,2 M");
  assert.equal(en.currency(1891200000), "USD 1,891.2M");
  assert.equal(es.physical(20763871.222585436, "oil"), "20,76 M bbl");
  assert.equal(en.physical(2958.950899444006, "gas"), "2,958.95 MMm³");
  assert.equal(es.percent(-3.4, true), "−3,4%");
  assert.equal(en.percent(-3.4, true), "−3.4%");
  assert.equal(es.month("2026-08-01", true), "ago 26");
  assert.equal(en.month("2026-08-01", true), "Aug 26");
  assert.equal(es.currency(null), "No disponible");
});

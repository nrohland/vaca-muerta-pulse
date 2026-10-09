import { test } from "node:test";
import assert from "node:assert/strict";
import { readSelection, destinationLabel } from "../lib/navigation.ts";
test("changing a section never borrows the title of an unrelated selected area", () => {
  for (const tab of ["production", "activity", "summary"] as const) {
    const s = readSelection(`?tab=${tab}&fluid=gas&month=2026-07-01&area=FOR`);
    assert.equal(
      destinationLabel(s, [
        {
          dimension: "area",
          entity_id: "FOR",
          entity_name: "FORTIN DE PIEDRA",
        } as any,
      ]),
      tab === "production"
        ? "Producción"
        : tab === "activity"
          ? "Actividad"
          : "Resumen",
    );
    assert.equal(s.fluid, "gas");
    assert.equal(s.month, "2026-07-01");
  }
});
test("unrecognized destinations default to overview without losing valid filters", () => {
  const s = readSelection("?tab=bogus&fluid=gas&month=2023-01-01");
  assert.equal(s.tab, "summary");
  assert.equal(s.fluid, "gas");
  assert.equal(s.month, "2023-01-01");
});

test("localize section destinations while preserving proper entity names", () => {
  const translate = (label: string) =>
    label === "Producción"
      ? "Production"
      : label === "Operadores"
        ? "Operators"
        : label;
  assert.equal(
    destinationLabel(readSelection("?tab=production"), [], translate),
    "Production",
  );
  assert.equal(
    destinationLabel(
      readSelection("?tab=operators&operator=missing"),
      [],
      translate,
    ),
    "Operators",
  );
  assert.equal(
    destinationLabel(
      readSelection("?tab=operators&operator=YPF"),
      [
        {
          dimension: "company",
          entity_id: "YPF",
          entity_name: "YPF S.A.",
        } as any,
      ],
      translate,
    ),
    "YPF S.A.",
  );
});

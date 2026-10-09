import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { metric, validatePrices, shiftMonth } from "../lib/metrics";
import { formatters } from "../lib/i18n";
import { number, prepareEntities, type Release } from "../lib/contract";
const release: Release = JSON.parse(
  readFileSync("public/data/release.json", "utf8"),
);
const manifest = JSON.parse(readFileSync("public/data/manifest.json", "utf8"));
const latest = manifest.source.approved_period;
const prices = validatePrices(
  JSON.parse(readFileSync("public/data/prices.json", "utf8")),
);
const base = "/vaca-muerta-pulse/";
const evidence =
  process.env.EVIDENCE_DIR ?? path.resolve("../../docs/evidence/resumen");
async function ready(page: any) {
  await expect(page.locator(".kpi-card--primary")).toBeVisible();
}

test("real snapshot matches KPIs and both top-five rankings for oil and gas", async ({
  page,
}) => {
  await page.goto(base);
  await ready(page);
  for (const fluid of ["oil", "gas"] as const) {
    await page
      .getByRole("button", {
        name: fluid === "oil" ? "Petróleo" : "Gas",
        exact: true,
      })
      .click();
    const r = release.production.find(
      (r) => r.fluid === fluid && r.periodo === latest,
    )!;
    await expect(page.locator(".kpi-card--primary .kpi-value")).toContainText(
      number(r.rate, fluid === "oil" ? 0 : 2),
    );
    await expect(
      page.locator(".kpi-card--primary .kpi-comparisons"),
    ).toContainText(number(r.yoy_rate_pct!));
    await page.getByRole("button", { name: "Mensual", exact: true }).click();
    await expect(
      page.locator(".kpi-card--primary .kpi-comparisons"),
    ).toContainText(number(r.mom_rate_pct!));
    await page.getByRole("button", { name: "Interanual", exact: true }).click();
    await expect(page.locator(".kpi-card").nth(2)).toContainText(
      number(r.positive_producing_wells, 0),
    );
    await expect(
      page.locator(".kpi-card").nth(1).locator(".kpi-value"),
    ).toContainText(number(fluid === "oil" ? r.volume / 1e6 : r.volume, 1));
    await expect(page.locator(".kpi-card").nth(3)).toContainText(
      fluid === "oil"
        ? number(metric(r, release.production, prices, "estimate").value! / 1e6)
        : "No disponible",
    );
    for (const dimension of ["company", "area"] as const) {
      const top = prepareEntities(
        release.entities,
        fluid,
        dimension,
        latest,
      ).top;
      const card = page.locator(
        dimension === "company" ? ".ranking-operators" : ".ranking-areas",
      );
      await expect(card.locator("li")).toHaveCount(5);
      for (let i = 0; i < 5; i++) {
        const row = card.locator("li").nth(i),
          e = top[i];
        await expect(row.locator(".bar-value")).toContainText(
          formatters("es").compact(e.volume),
        );
        await expect(row.locator(".yoy-value")).toContainText(
          e.yoy_volume_pct == null
            ? "Sin comparador"
            : number(Math.abs(e.yoy_volume_pct)),
        );
        const width = await row
          .locator(".bar-track>span")
          .evaluate((el: any) => parseFloat(el.style.width));
        expect(width).toBeCloseTo((e.volume / r.volume) * 100, 6);
        if (dimension === "company")
          await expect(row.locator(".share-value")).toContainText(
            number((e.volume / r.volume) * 100),
          );
      }
    }
  }
});
test("filters, chart ranges, early missing comparisons and URL reload", async ({
  page,
}) => {
  await page.goto(base);
  await ready(page);
  await page.getByRole("button", { name: "Gas", exact: true }).click();
  await page.getByRole("button", { name: "36m", exact: true }).click();
  await expect(page.getByRole("button", { name: "36m" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page
    .getByLabel("Mes de producción")
    .selectOption(manifest.source.accepted_periods[0]);
  await expect(
    page.locator(".kpi-card--primary .kpi-comparisons .sr-only"),
  ).toHaveCount(2);
  await page.reload();
  await ready(page);
  await expect(
    page.getByRole("button", { name: "Gas", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Mes de producción")).toHaveValue(
    manifest.source.accepted_periods[0],
  );
  await page.getByText("Ver tabla de datos", { exact: true }).click();
  await expect(page.locator("table")).toBeVisible();
});
test("progressive destinations retain filters and entity identity through browser history", async ({
  page,
}) => {
  await page.goto(base);
  await ready(page);
  await page.getByRole("button", { name: "Gas", exact: true }).click();
  const first = prepareEntities(release.entities, "gas", "company", latest)
    .top[0];
  await page.locator(".ranking-operators .ranking-row").first().click();
  await expect(page.locator(".planned-view")).toContainText("Próximamente");
  expect(new URL(page.url()).searchParams.get("operator")).toBe(
    first.entity_id,
  );
  expect(new URL(page.url()).searchParams.get("fluid")).toBe("gas");
  await page.goBack();
  await ready(page);
  await page.goForward();
  await expect(page.locator(".planned-view")).toBeVisible();
  await page.getByRole("button", { name: "Volver al Resumen" }).click();
  await ready(page);
  const area = prepareEntities(release.entities, "gas", "area", latest).top[0];
  await page.locator(".ranking-areas .ranking-row").first().click();
  await expect(
    page.getByRole("heading", { name: area.entity_name, exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("area")).toBe(area.entity_id);
  await page.getByRole("tab", { name: "Producción", exact: true }).click();
  await expect(page.locator(".planned-view")).toBeVisible();
  await page.getByRole("tab", { name: "Actividad", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Actividad", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Resumen", exact: true }).click();
  await ready(page);
  await page.getByRole("tab", { name: "Resumen", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Producción", exact: true }),
  ).toBeFocused();
});
test("hash mismatch blocks display and retry recovers", async ({ page }) => {
  await page.route("**/data/release.json", (route) =>
    route.fulfill({ json: { schema_version: 1 } }),
  );
  await page.goto(base);
  await expect(page.getByRole("alert")).toContainText("La versión no coincide");
  await expect(page.locator(".kpi-card")).toHaveCount(0);
  await page.unroute("**/data/release.json");
  await page.getByRole("button", { name: "Reintentar" }).click();
  await ready(page);
});
test("missing and invalid approval retain existing validation behavior", async ({
  page,
}) => {
  await page.goto(base);
  await ready(page);
  await expect(page.locator(".status-badge")).toHaveText("Preliminar");
  await page.route("**/data/approval.json", (route) =>
    route.fulfill({ json: { status: "approved", version: "wrong" } }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Aprobación no corresponde",
  );
});
for (const [name, width, height] of [
  ["desktop", 1440, 900],
  ["laptop", 1366, 768],
  ["mobile", 390, 844],
  ["tablet", 768, 1024],
] as const) {
  test(`visual and accessibility review ${name} light/dark`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto(base);
    await ready(page);
    await expect(page.locator(".recharts-line-curve")).toBeVisible();
    if (width >= 1101)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= window.innerHeight,
        ),
      ).toBe(true);
    await expect(page.locator(".operator-logo img")).toHaveCount(5);
    mkdirSync(evidence, { recursive: true });
    for (const mode of ["light", "dark"] as const) {
      if (mode === "dark")
        await page.getByRole("button", { name: "Modo oscuro" }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
      await page.screenshot({
        path: path.join(evidence, `${name}-${mode}.png`),
        fullPage: true,
      });
    }
  });
}

test("monetary mode updates metrics and units; gas availability and price failure stay honest", async ({
  page,
}) => {
  await page.goto(base);
  await ready(page);
  await page
    .getByRole("button", { name: "Valor estimado", exact: true })
    .click();
  const r = release.production.find(
    (r) => r.fluid === "oil" && r.periodo === latest,
  )!;
  await expect(page.locator(".kpi-card--primary .kpi-value")).toContainText(
    number(
      metric(r, release.production, prices, "rate", "value").value! / 1e6,
      2,
    ),
  );
  await expect(page.locator(".kpi-card").nth(3)).toContainText(
    "Precio de referencia Brent",
  );
  await expect(
    page.getByRole("heading", { name: "Evolución de producción y valor" }),
  ).toBeVisible();
  await page.locator(".ranking-operators .ranking-row").first().click();
  expect(new URL(page.url()).searchParams.get("mode")).toBe("value");
  await page.getByRole("button", { name: "Volver al Resumen" }).click();
  await page.getByRole("button", { name: "Gas", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "no disponible para gas",
  );
  await expect(page.locator(".kpi-card--primary .kpi-value")).toContainText(
    "MMm³/d",
  );
  await page.route("**/data/prices.json", (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.goto(base);
  await ready(page);
  await expect(page.getByRole("status")).toContainText(
    "métricas físicas siguen disponibles",
  );
  await expect(page.locator(".kpi-card").nth(3)).toContainText("No disponible");
});

test("language persistence, exact ranking values, selected comparisons and zero-origin chart", async ({
  page,
}) => {
  await page.goto(base);
  await ready(page);
  const absolute = await page
    .locator(".kpi-card--primary .kpi-value")
    .innerText();
  await page.getByRole("button", { name: "Mensual", exact: true }).click();
  await expect(page.locator(".ranking-columns").first()).toContainText(
    "Mensual",
  );
  await expect(page.locator(".kpi-card--primary .kpi-value")).toHaveText(
    absolute,
  );
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.locator(".ranking-columns").first()).toContainText(
    "Monthly",
  );
  const top = prepareEntities(release.entities, "oil", "company", latest)
    .top[0];
  await expect(page.locator(".ranking-amount").first()).toHaveText(
    formatters("en").compact(top.volume),
  );
  await expect(page.locator(".ranking-amount").first()).toHaveAttribute(
    "title",
    `${formatters("en").number(top.volume, 0)} bbl`,
  );
  await expect(page.locator(".recharts-yAxis")).toHaveCount(0);
  await expect(page.locator(".line-chart")).toHaveAttribute(
    "data-physical-min",
    "0",
  );
  await expect(page.locator(".chart-end-label")).toHaveCount(1);
  await expect(page.locator(".chart-final")).toHaveCount(0);
  await page.reload();
  await ready(page);
  await expect(
    page.getByRole("button", { name: "English", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Monthly", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Year over year", exact: true })
    .click();
  await page.getByText("View data table", { exact: true }).click();
  await expect(page.locator("table")).toContainText(
    formatters("en").month(shiftMonth(latest, -12), true),
  );
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("combined monthly series, bounded tooltip, reversible KPI and compact table", async ({
  page,
}) => {
  await page.goto(base);
  await ready(page);
  await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(12);
  await expect(page.locator(".recharts-line-curve")).toBeVisible();
  await expect(page.locator(".recharts-yAxis")).toHaveCount(0);
  const info = page.getByRole("button", {
    name: "Metodología de Producción diaria",
    exact: true,
  });
  const before = await page.locator(".kpi-card").first().boundingBox();
  await info.hover();
  await expect(page.getByRole("tooltip")).toContainText("días calendario");
  await info.press("Enter");
  await expect(page.locator('.kpi-card[data-flipped="true"]')).toHaveCount(1);
  const back = page.getByRole("button", {
    name: "Volver a Producción diaria",
    exact: true,
  });
  await expect(back).toBeFocused();
  expect(await page.locator(".kpi-card").first().boundingBox()).toEqual(before);
  await page
    .getByRole("button", {
      name: "Metodología de Volumen mensual",
      exact: true,
    })
    .click();
  await expect(page.locator('.kpi-card[data-flipped="true"]')).toHaveCount(1);
  await page
    .getByRole("button", { name: "Volver a Volumen mensual", exact: true })
    .press("Space");
  await expect(page.locator('.kpi-card[data-flipped="true"]')).toHaveCount(0);
  await page.locator(".recharts-bar-rectangle").last().hover();
  await expect(page.locator(".chart-tooltip")).toContainText("20,76 M bbl");
  await expect(page.locator(".chart-tooltip")).toContainText("US$ 1.891,17 M");
  await page.getByText("Ver tabla de datos", { exact: true }).click();
  await expect(page.locator('time[datetime="2026-08-01"]').first()).toHaveText(
    "ago 26",
  );
  await page.getByRole("button", { name: "Gas", exact: true }).click();
  await expect(page.locator(".recharts-line-curve")).toHaveCount(0);
  await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(12);
  await expect(page.locator(".chart-context")).toContainText(
    "referencia nacional",
  );
});

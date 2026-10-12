import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import {
  productionCsv,
  productionPoints,
  productionKpis,
} from "../lib/production";
import { formatters } from "../lib/i18n";
import { validatePrices } from "../lib/metrics";
import { validateRelease } from "../lib/contract";
const rows = validateRelease(
  JSON.parse(readFileSync("public/data/release.json", "utf8")),
).production;
const prices = validatePrices(
  JSON.parse(readFileSync("public/data/prices.json", "utf8")),
);
const base = "/vaca-muerta-pulse/?tab=production&month=2026-08-01";
async function ready(page: any) {
  await expect(page.locator(".production-data tbody tr")).toHaveCount(36);
  await expect(
    page.locator(".production-evolution .recharts-line"),
  ).toHaveCount(1);
}
test("filter matrix updates real KPIs and retains navigation state", async ({
  page,
}) => {
  await page.goto(base);
  await ready(page);
  for (const language of ["es", "en"] as const) {
    await page
      .getByRole("button", {
        name: language === "es" ? "Español" : "English",
        exact: true,
      })
      .click();
    const f = formatters(language);
    for (const fluid of ["oil", "gas"] as const)
      for (const mode of ["volume", "value"] as const)
        for (const comparison of ["mom", "yoy"] as const) {
          await page
            .getByRole("button", {
              name: f.t(fluid === "oil" ? "Petróleo" : "Gas"),
              exact: true,
            })
            .click();
          await page
            .getByRole("button", {
              name: f.t(mode === "volume" ? "Volumen" : "Valor USD"),
              exact: true,
            })
            .click();
          await page
            .getByRole("button", {
              name: f.t(comparison === "mom" ? "Mensual" : "Interanual"),
              exact: true,
            })
            .click();
          const k = productionKpis(
            rows,
            fluid,
            "2026-08-01",
            prices,
            mode,
            comparison,
          );
          await expect(
            page.locator(".production-dashboard .kpi-card--primary .kpi-value"),
          ).toContainText(
            fluid === "gas" ? f.number(k.value, 2, 0) : f.compact(k.value),
          );
          const pts = productionPoints(
            rows,
            fluid,
            "2026-08-01",
            36,
            prices,
            mode,
          );
          await expect(
            page
              .locator(".production-data tbody tr")
              .first()
              .locator("td")
              .nth(comparison === "mom" ? 4 : 6),
          ).toHaveText(
            f.number(
              pts.at(-1)![comparison]! * (fluid === "gas" ? 1e6 : 1),
              2,
              0,
            ),
          );
          await expect(
            page.locator(".production-evolution .recharts-line"),
          ).toHaveCount(fluid === "gas" ? 0 : 1);
        }
  }
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await expect(page.locator(".ranking-card")).toHaveCount(2);
  await page.getByRole("tab", { name: "Production", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Gas", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator(".production-data tbody tr")).toHaveCount(36);
  await expect(
    page.getByRole("button", { name: "Year over year", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("download exactly matches raw data and selected range", async ({
  page,
}) => {
  await page.goto(base);
  await ready(page);
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(page.locator(".production-data tbody tr")).toHaveCount(44);
  const promise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar CSV", exact: true })
    .click();
  const path = await (await promise).path();
  expect(readFileSync(path!, "utf8")).toBe(
    "\uFEFF" +
      productionCsv(
        productionPoints(rows, "oil", "2026-08-01", 0, prices, "volume"),
        "oil",
        "volume",
      ),
  );
});
test("first month has no fabricated comparison or future observations", async ({
  page,
}) => {
  await page.goto(base);
  await ready(page);
  await page.getByLabel("Mes de producción").selectOption("2023-01-01");
  await expect(page.locator(".production-data tbody tr")).toHaveCount(1);
  await expect(
    page.locator(".production-dashboard .kpi-card").nth(1),
  ).toContainText("Sin comparador");
  await page.getByText("Ver comparación en tabla", { exact: true }).click();
  await expect(
    page.locator(".production-annual tbody tr").nth(1),
  ).toContainText("No disponible");
});
test("missing prices preserve physical data and hide monetary series", async ({
  page,
}) => {
  await page.route("**/data/prices.json", (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.goto(base);
  await expect(page.locator(".production-data tbody tr")).toHaveCount(36);
  await expect(
    page.locator(".production-evolution .recharts-line"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Valor USD", exact: true }).click();
  await expect(page.locator(".kpi-card--primary")).toContainText(
    "No disponible",
  );
});
test("responsive page and ES/EN light/dark accessibility", async ({ page }) => {
  await page.goto(base);
  await ready(page);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  for (const language of ["Español", "English"]) {
    await page.getByRole("button", { name: language, exact: true }).click();
    for (const dark of [false, true]) {
      if (dark)
        await page
          .getByRole("button", {
            name: language === "Español" ? "Modo oscuro" : "Dark mode",
            exact: true,
          })
          .click();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      if (dark)
        await page
          .getByRole("button", {
            name: language === "Español" ? "Modo claro" : "Light mode",
            exact: true,
          })
          .click();
    }
  }
});

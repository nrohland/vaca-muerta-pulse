import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
const base = "/vaca-muerta-pulse/";
const evidence =
  process.env.EVIDENCE_DIR ?? path.resolve("../../docs/evidence/history-ux");
async function ready(page: any) {
  await page.goto(base);
  await expect(page.locator(".kpi-card--primary")).toBeVisible();
  await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(36);
  mkdirSync(evidence, { recursive: true });
}

test("desktop historical coverage, simplified backs and ES/EN themes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page);
  await expect(
    page.getByRole("button", { name: "36m", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: path.join(evidence, "desktop-36m.png") });
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(44);
  await expect(page.locator(".history-coverage")).toContainText("Histórico disponible: ene 2023 – ago 2026");
  await page.screenshot({ path: path.join(evidence, "desktop-5years.png") });
  const info = page.getByRole("button", {
    name: "Metodología de Volumen mensual",
    exact: true,
  });
  const rect = await page.locator(".kpi-card").nth(1).boundingBox();
  await info.press("Enter");
  await expect(
    page.getByRole("button", { name: "Volver a Volumen mensual", exact: true }),
  ).toBeFocused();
  expect(await page.locator(".kpi-card").nth(1).boundingBox()).toEqual(rect);
  await expect(page.locator('.kpi-card[data-flipped="true"]')).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Ver metodología →", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: path.join(evidence, "kpi-back.png") });
  await page
    .getByRole("button", { name: "Volver a Volumen mensual", exact: true })
    .press("Space");
  for (const language of ["es", "en"] as const) {
    await page
      .getByRole("button", {
        name: language === "es" ? "Español" : "English",
        exact: true,
      })
      .click();
    for (const fluid of ["oil", "gas"] as const) {
      await page
        .getByRole("button", {
          name:
            fluid === "gas" ? "Gas" : language === "es" ? "Petróleo" : "Oil",
          exact: true,
        })
        .click();
      for (const theme of ["light", "dark"] as const) {
        if (theme === "dark")
          await page
            .getByRole("button", {
              name: language === "es" ? "Modo oscuro" : "Dark mode",
              exact: true,
            })
            .click();
        await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(44);
        await expect(page.locator(".production-evolution .recharts-line-curve")).toHaveCount(
          fluid === "oil" ? 1 : 0,
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if (theme === "dark")
          await page
            .getByRole("button", {
              name: language === "es" ? "Modo claro" : "Light mode",
              exact: true,
            })
            .click();
      }
    }
  }
});

test.describe("touchable historical chart", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  test("internal scrolling and bounded compact tooltip", async ({ page }) => {
    await ready(page);
    const scroll = page.locator(".production-evolution .chart-scroll");
    await expect(page.locator(".production-evolution .chart-scroll-hint")).toBeVisible();
    expect(await scroll.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(
      true,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator(".production-evolution").scrollIntoViewIfNeeded();
    await page.locator(".recharts-bar-rectangle").last().tap();
    await expect(page.locator(".chart-tooltip .tooltip-row")).toHaveCount(2);
    await expect(page.locator(".chart-tooltip")).not.toContainText(
      "Interanual",
    );
    await expect(page.locator(".chart-tooltip")).not.toContainText("Brent");
    const bounds = await scroll.boundingBox(),
      tooltip = await page.locator(".chart-tooltip").boundingBox();
    expect(tooltip!.x).toBeGreaterThanOrEqual(bounds!.x);
    expect(tooltip!.x + tooltip!.width).toBeLessThanOrEqual(
      bounds!.x + bounds!.width,
    );
    await page.screenshot({ path: path.join(evidence, "mobile-scroll.png") });
    const before = await scroll.evaluate((e) => e.scrollLeft);
    await scroll.evaluate((e) => {
      e.scrollLeft = 0;
    });
    expect(before).toBeGreaterThan(0);
    expect(await scroll.evaluate((e) => e.scrollLeft)).toBe(0);
    await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(36);
  });
});


test("summary has one full-width chart and keeps the wells KPI", async ({page}) => {
  await ready(page);
  await expect(page.locator(".evolution")).toHaveCount(1);
  await expect(page.locator(".wells-evolution")).toHaveCount(0);
  await expect(page.locator(".kpi-card")).toHaveCount(4);
  await expect(page.locator(".kpi-card").nth(2)).toContainText("2.678");
  await expect(page.locator(".chart-context")).toHaveCount(0);
  await expect(page.locator(".chart-scroll-hint")).toHaveCount(0);
});

"use client";
import { useEffect, useState } from "react";
import { defaultHistoryRange } from "../lib/history";

import { validatePrices, estimationNote, type Prices } from "../lib/metrics";
import { SummaryDashboard, GlobalFilters } from "./dashboard-components";
import {
  tabs,
  readSelection,
  destinationLabel,
  type Selection,
} from "../lib/navigation";
import {
  validateRelease,
  validateManifest,
  validatePair,
  validateApproval,
  sha256,
  type Release,
  type Manifest,
  type Approval,
} from "../lib/contract";
import { LocaleProvider } from "../lib/locale";
import {
  formatters,
  readLanguage,
  languageStorageKey,
  translations,
  type Language,
} from "../lib/i18n";
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "/vaca-muerta-pulse";
type Data = { release: Release; manifest: Manifest; approval: Approval | null };
const initial: Selection = {
  tab: "summary",
  fluid: "oil",
  mode: "volume",
  comparison: "yoy",
  month: "",
  operator: "",
  area: "",
};
export default function Page() {
  const [language, setLanguage] = useState<Language>("es");
  const { t, month, date } = formatters(language);
  function changeLanguage(next: Language) {
    setLanguage(next);
    try {
      localStorage.setItem(languageStorageKey, next);
    } catch {}
  }
  useEffect(() => {
    try {
      setLanguage(readLanguage(localStorage.getItem(languageStorageKey)));
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = language === "es" ? "es-AR" : "en-US";
    document.title = t("Vaca Muerta en datos");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        "content",
        t(
          "Producción mensual de petróleo y gas de Vaca Muerta. Vista previa de agregados oficiales.",
        ),
      );
  }, [language]);
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0),
    [selection, setSelection] = useState<Selection>(initial),
    [range, setRange] = useState(defaultHistoryRange),
    [dark, setDark] = useState(false),
    [prices, setPrices] = useState<Prices | null>(null),
    [priceError, setPriceError] = useState("");
  const { tab, fluid, month: period, mode, comparison } = selection;
  function readUrl() {
    return readSelection(window.location.search);
  }
  function update(patch: Partial<Selection>) {
    // URL updates are synchronous: rapid filter changes retain the latest context.
    const next = { ...readUrl(), ...patch };
    if (patch.tab) {
      if (patch.tab !== "operators") next.operator = "";
      if (patch.tab !== "areas") next.area = "";
    }
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(next)) {
      if (v) url.searchParams.set(k, v);
      else url.searchParams.delete(k);
    }
    window.history.pushState(null, "", url);
    setSelection(next);
  }
  useEffect(() => {
    setSelection(readUrl());
    const restore = () => setSelection(readUrl());
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const [dr, mr] = await Promise.all([
          fetch(`${base}/data/release.json`),
          fetch(`${base}/data/manifest.json`),
        ]);
        if (!dr.ok || !mr.ok) throw Error("No pudimos cargar los agregados.");
        const [bytes, manifestBytes] = await Promise.all([
          dr.arrayBuffer(),
          mr.arrayBuffer(),
        ]);
        const manifest = validateManifest(
          JSON.parse(new TextDecoder().decode(manifestBytes)),
        );
        if ((await sha256(bytes)) !== manifest.data_sha256)
          throw Error("La versión no coincide con su manifiesto.");
        const release = validateRelease(
          JSON.parse(new TextDecoder().decode(bytes)),
        );
        validatePair(release, manifest);
        const ar = await fetch(`${base}/data/approval.json`);
        let approval: Approval | null = null;
        if (ar.ok)
          approval = validateApproval(
            await ar.json(),
            manifest,
            await sha256(manifestBytes),
          );
        else if (ar.status !== 404)
          throw Error("No pudimos verificar el estado de publicación.");
        if (active) {
          setData({ release, manifest, approval });
          setSelection((prev) => {
            const next = {
              ...prev,
              month: manifest.source.accepted_periods.includes(prev.month)
                ? prev.month
                : [...manifest.source.accepted_periods].sort().at(-1)!,
            };
            const url = new URL(window.location.href);
            for (const [k, v] of Object.entries(next))
              if (v) url.searchParams.set(k, v);
            window.history.replaceState(null, "", url);
            return next;
          });
        }
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Datos no disponibles.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    if (!data) return;
    let active = true;
    setPrices(null);
    setPriceError("");
    (async () => {
      try {
        const [pr, vr] = await Promise.all([
          fetch(`${base}/data/prices.json`),
          fetch(`${base}/data/valuation-manifest.json`),
        ]);
        if (!pr.ok || !vr.ok)
          throw Error("Referencia de precios no disponible.");
        const priceBytes = await pr.arrayBuffer(),
          vm = await vr.json();
        if (
          vm.schema_version !== 1 ||
          vm.status !== "candidate" ||
          vm.release_sha256 !== data.manifest.data_sha256 ||
          vm.prices_sha256 !== (await sha256(priceBytes))
        )
          throw Error(
            "La referencia de precios no corresponde a esta versión.",
          );
        const result = validatePrices(
          JSON.parse(new TextDecoder().decode(priceBytes)),
        );
        if (active) setPrices(result);
      } catch (e) {
        if (active)
          setPriceError(
            e instanceof Error ? e.message : "Precio no disponible.",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [data]);
  const rows = data?.release.production ?? [];
  const current = rows.find((r) => r.fluid === fluid && r.periodo === period);
  const entities = data?.release.entities ?? [];
  function keyboardTab(
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let target = index;
    if (e.key === "ArrowRight") target = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft")
      target = (index + tabs.length - 1) % tabs.length;
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = tabs.length - 1;
    else return;
    e.preventDefault();
    update({ tab: tabs[target][0] });
    document.getElementById(`tab-${tabs[target][0]}`)?.focus();
  }
  return (
    <LocaleProvider language={language}>
      <a className="skip" href="#main">
        {t("Ir al contenido")}
      </a>
      <div className="page" data-fluid={fluid}>
        <header className="masthead">
          <a
            className="brand"
            href={`${base}/`}
            onClick={(e) => {
              e.preventDefault();
              update({ tab: "summary" });
            }}
          >
            {t("Vaca Muerta en datos")}
          </a>
          <div className="header-actions">
            <fieldset className="fluid-control language-control">
              <legend className="sr-only">{t("Idioma")}</legend>
              {(["es", "en"] as const).map((l) => (
                <button
                  key={l}
                  lang={l}
                  aria-pressed={language === l}
                  aria-label={l === "es" ? "Español" : "English"}
                  onClick={() => changeLanguage(l)}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </fieldset>
            <button
              className="theme-button"
              onClick={() => setDark((d) => !d)}
              aria-pressed={dark}
              aria-label={t(dark ? "Modo claro" : "Modo oscuro")}
              title={t(dark ? "Modo claro" : "Modo oscuro")}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {dark ? (
                  <>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                  </>
                ) : (
                  <path d="M20.5 14.2A8.7 8.7 0 0 1 9.8 3.5a8.7 8.7 0 1 0 10.7 10.7Z" />
                )}
              </svg>
            </button>
          </div>
        </header>
        <nav
          className="tabs"
          role="tablist"
          aria-label={t("Vistas de Vaca Muerta en datos")}
        >
          {tabs.map(([id, label], i) => (
            <button
              id={`tab-${id}`}
              key={id}
              role="tab"
              aria-selected={tab === id}
              aria-controls={tab === id ? `panel-${id}` : undefined}
              tabIndex={tab === id ? 0 : -1}
              onKeyDown={(e) => keyboardTab(e, i)}
              onClick={() => update({ tab: id })}
            >
              {t(label)}
            </button>
          ))}
        </nav>
        <main id="main">
          <GlobalFilters
            fluid={fluid}
            period={period}
            periods={data?.manifest.source.accepted_periods ?? []}
            mode={mode}
            comparison={comparison}
            onComparison={(comparison) => update({ comparison })}
            onMode={(mode) => update({ mode })}
            onFluid={(f) => update({ fluid: f })}
            onPeriod={(p) => update({ month: p })}
          />
          {priceError && !loading && (
            <p className="availability-note" role="status">
              {t(
                translations[priceError]
                  ? priceError
                  : "Referencia de precios no disponible.",
              )}{" "}
              {t("Las métricas físicas siguen disponibles.")}
            </p>
          )}
          {loading ? (
            <div className="state" role="status">
              {t("Cargando agregados oficiales y verificando integridad…")}
            </div>
          ) : error ? (
            <div className="state" role="alert">
              <h1>{t("Datos no disponibles")}</h1>
              <p>{t(translations[error] ? error : "Datos no disponibles.")}</p>
              <button onClick={() => setAttempt((n) => n + 1)}>
                {t("Reintentar")}
              </button>
            </div>
          ) : !current ? (
            <div className="state">
              <h1>{t("Sin datos para este período")}</h1>
              <button
                onClick={() =>
                  update({ month: data!.manifest.source.approved_period })
                }
              >
                {t("Volver al último mes disponible")}
              </button>
            </div>
          ) : (
            <section
              id={`panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
              tabIndex={0}
            >
              {tab === "summary" ? (
                <SummaryDashboard
                  mode={mode}
                  comparison={comparison}
                  prices={prices}
                  current={current}
                  rows={rows}
                  entities={entities}
                  fluid={fluid}
                  period={period}
                  range={range}
                  setRange={setRange}
                  onNavigate={(destination, id) =>
                    update({
                      tab: destination,
                      operator: destination === "operators" ? (id ?? "") : "",
                      area: destination === "areas" ? (id ?? "") : "",
                    })
                  }
                />
              ) : (
                <div className="state planned-view">
                  <p className="eyebrow">{t("Próximamente")}</p>
                  <h1>{destinationLabel(selection, entities, t)}</h1>
                  <p>
                    {t("Esta vista estará disponible en una próxima etapa.")}
                  </p>
                  <button
                    onClick={() =>
                      update({ tab: "summary", operator: "", area: "" })
                    }
                  >
                    {t("Volver al Resumen")}
                  </button>
                </div>
              )}
            </section>
          )}
        </main>
        <footer>
          <span>
            {t("Fuente:")}{" "}
            <a href="https://datos.energia.gob.ar/dataset/produccion-de-petroleo-y-gas-por-pozo">
              {t("Secretaría de Energía · Capítulo IV")}
            </a>
            {data && (
              <>
                {!data.approval && (
                  <span
                    className="status-badge"
                    title={t(
                      "Candidato validado técnicamente; promoción pública pendiente",
                    )}
                  >
                    {t("Preliminar")}
                  </span>
                )}
              </>
            )}
          </span>
          <details id="methodology" className="provenance">
            <summary>{t("Fuentes y metodología")}</summary>
            <p>
              {t(
                "Producción diaria = volumen mensual / días calendario. Volumen mensual = suma de la producción registrada. Pozos productivos = pozos únicos con producción positiva. Las comparaciones usan cada métrica y su período correspondiente; bases ausentes o cero no generan variaciones.",
              )}
            </p>
            <p>
              {t(
                "Universo: formación Vaca Muerta y recurso no convencional. Operador declarado por mes; transferencias de activos pueden modificar los rankings. Área: permiso o concesión. Los datos oficiales son revisables; se conserva el último snapshot validado y la promoción pública permanece pendiente.",
              )}
            </p>
            {data && (
              <div>
                <p>
                  {t(
                    "Producción: {period}. Ingesta: {ingested}. Versión preparada: {generated}. Publicación: {published}.",
                    {
                      period: month(data.manifest.source.approved_period),
                      ingested: date(data.manifest.source.ingested_at),
                      generated: date(data.manifest.generated_at),
                      published: data.approval
                        ? date(data.approval.approved_at)
                        : t("pendiente de aprobación"),
                    },
                  )}
                </p>
                {data.manifest.source.resources.map((r) => (
                  <p key={r.id}>
                    {t(
                      "{year}: fuente actualizada {updated}; extracción {extracted}.",
                      {
                        year: r.year ?? "—",
                        updated: date(r.source_last_modified),
                        extracted: date(r.extracted_at),
                      },
                    )}
                  </p>
                ))}
                <a download href={`${base}/data/manifest.json`}>
                  {t("Manifiesto de producción")}
                </a>
              </div>
            )}
            {prices && (
              <p>
                {t("Brent:")}{" "}
                <a href={prices.source.url}>
                  {t("EIA · promedio mensual USD/bbl")}
                </a>
                .{" "}
                {t(
                  "Actualizada {updated}; ingesta {retrieved}. Valor mensual = bbl × precio del mismo mes; diario = valor mensual / días calendario. Comparaciones calculadas sobre cada valor estimado. No representa facturación efectiva. Referencia uniforme para entidades; no incorpora calidad, descuentos, costos, regalías o tipo de cambio.",
                  {
                    updated: date(prices.source.source_updated_at),
                    retrieved: date(prices.source.retrieved_at),
                  },
                )}{" "}
                {t("Gas:")}{" "}
                <a href={prices.gas.reviewed_sources[0]}>
                  {t("precios nacionales")}
                </a>{" "}
                {t(
                  "revisados, sin serie comparable y conversión energética validadas.",
                )}
              </p>
            )}
            <p>{t("El gráfico combinado utiliza escalas independientes para volumen y USD, ambas desde cero. Comparar la evolución de cada serie, no sus alturas entre sí.")}</p>
            <p>
              {t(
                "Escala desde cero. Una vista porcentual o índice base 100 podría incorporarse en el futuro.",
              )}
            </p>
          </details>
        </footer>
      </div>
    </LocaleProvider>
  );
}

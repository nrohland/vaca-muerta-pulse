export type Language = "es" | "en";
export const locales = { es: "es-AR", en: "en-US" } as const;
export const languageStorageKey = "vm-language";
export function readLanguage(value: string | null): Language {
  return value === "en" ? "en" : "es";
}
// Spanish source messages are also the default locale. Variables never translate entity names.
export const translations: Record<string, string> = {
  "Vaca Muerta en datos": "Vaca Muerta in data",
  "Producción mensual de petróleo y gas de Vaca Muerta. Vista previa de agregados oficiales.":
    "Monthly oil and gas production from Vaca Muerta. Preview of official aggregates.",
  "Ir al contenido": "Skip to content",
  "Modo claro": "Light mode",
  "Modo oscuro": "Dark mode",
  Idioma: "Language",
  "Vistas de Vaca Muerta en datos": "Vaca Muerta views",
  Resumen: "Overview",
  Producción: "Production",
  Operadores: "Operators",
  Áreas: "Areas",
  Actividad: "Activity",
  Fluido: "Product",
  Petróleo: "Oil",
  Gas: "Gas",
  Período: "Period",
  "Mes de producción": "Production month",
  "Unidad de análisis": "Analysis unit",
  Volumen: "Volume",
  "Valor estimado": "Estimated value",
  "Comparación temporal": "Time comparison",
  Mensual: "Monthly",
  Interanual: "Year over year",
  "No disponible": "Unavailable",
  "Sin comparador": "No comparison data",
  "vs. {period}": "vs. {period}",
  "Metodología de {label}": "Methodology for {label}",
  "Detalle próximamente": "Details coming soon",
  "Próximamente: detalle de {label}": "Coming soon: details for {label}",
  "Evolución del valor estimado": "Estimated value over time",
  "Evolución de la producción": "Production over time",
  "Tasa diaria equivalente · {unit}": "Equivalent daily rate · {unit}",
  "Período de evolución": "Chart time range",
  "Producción · Próximamente": "Production · Coming soon",
  "USD/día estimados": "Estimated USD/day",
  "M USD/día": "M USD/day",
  "Ver tabla de datos": "View data table",
  "Tasa diaria equivalente del mes. Los meses o precios ausentes no equivalen a cero.":
    "Equivalent daily rate for each month. Missing months or prices do not mean zero.",
  Mes: "Month",
  "Tasa ({unit})": "Rate ({unit})",
  "Base de comparación": "Comparison period",
  "Brent: {price} USD/bbl · EIA": "Brent: {price} USD/bbl · EIA",
  "Principales operadores": "Leading operators",
  "Principales áreas": "Leading areas",
  "Top 5 · valor bruto estimado · USD": "Top 5 · estimated gross value · USD",
  "Top 5 · volumen mensual · {unit}": "Top 5 · monthly volume · {unit}",
  "{section} · Próximamente ↗": "{section} · Coming soon ↗",
  Operador: "Operator",
  Área: "Area",
  Cuota: "Share",
  "USD estimados": "Estimated USD",
  "Sin operadores para este período.": "No operators for this period.",
  "Sin áreas para este período.": "No areas for this period.",
  "Barras: participación en el total · escala 0–100%":
    "Bars: share of total · 0–100% scale",
  " · Referencia uniforme, no ingresos efectivos":
    " · Uniform reference, not actual revenue",
  "Resumen de Vaca Muerta": "Vaca Muerta overview",
  "Valor estimado no disponible para gas. Falta validar una referencia nacional comparable y la conversión energética. Se muestran unidades físicas.":
    "Estimated gas value is unavailable. A comparable national reference and energy conversion still need validation. Physical units are shown.",
  "Precio Brent no disponible para este período; el valor estimado permanece sin calcular.":
    "Brent price is unavailable for this period; estimated value remains unavailable.",
  "Valor diario estimado": "Estimated daily value",
  "Producción diaria": "Daily production",
  "Valor mensual estimado": "Estimated monthly value",
  "Volumen mensual": "Monthly volume",
  "Pozos productivos": "Producing wells",
  pozos: "wells",
  "Con producción positiva": "With positive production",
  "Precio de referencia Brent": "Brent reference price",
  "Valor bruto estimado": "Estimated gross value",
  "Promedio mensual · EIA": "Monthly average · EIA",
  "Estimación pendiente": "Estimate pending",
  "A precio Brent · estimación": "At Brent price · estimate",
  "Valor bruto estimado a precio Brent. No representa facturación efectiva.":
    "Estimated gross value at Brent price. Does not represent actual revenue.",
  "Referencia nacional y conversión energética sin validar.":
    "National reference and energy conversion not yet validated.",
  "Precio Brent no disponible para este mes. No se calcula un valor sin respaldo.":
    "Brent price is unavailable for this month. No value is calculated without a verified reference.",
  "{note} Fórmula: volumen mensual en bbl × {price} USD/bbl ({period}). Fuente: EIA. Actualizada {date}. Valor exacto: {value} USD. Comparaciones con volumen y precio de cada mes.":
    "{note} Formula: monthly volume in bbl × {price} USD/bbl ({period}). Source: EIA. Updated {date}. Exact value: {value} USD. Comparisons use each month’s volume and price.",
  "{help} Diario = valor mensual / {days} días calendario.":
    "{help} Daily = monthly value / {days} calendar days.",
  "Volumen mensual / {days} días calendario. Tasa exacta: {value} {unit}. Las comparaciones usan tasas diarias, no volúmenes mensuales.":
    "Monthly volume / {days} calendar days. Exact rate: {value} {unit}. Comparisons use daily rates, not monthly volumes.",
  "{volume}. Las comparaciones usan volúmenes mensuales; pueden diferir de la tasa diaria por los días de cada mes.":
    "{volume}. Comparisons use monthly volumes; they may differ from daily rates because of the number of days in each month.",
  "Pozos únicos con producción positiva de {fluid} durante {period}. Las comparaciones usan esta cantidad de pozos, no tasas ni volumen. Base ausente o cero: sin comparador.":
    "Unique wells with positive {fluid} production during {period}. Comparisons use this well count, not rates or volume. Missing or zero base: no comparison data.",
  "Europe Brent Spot Price FOB. Promedio mensual en USD/bbl, EIA ({date}). Las comparaciones usan precios. {note}":
    "Europe Brent Spot Price FOB. Monthly average in USD/bbl, EIA ({date}). Comparisons use prices. {note}",
  "Las métricas físicas siguen disponibles.":
    "Physical metrics remain available.",
  "Cargando agregados oficiales y verificando integridad…":
    "Loading official aggregates and checking integrity…",
  "Datos no disponibles": "Data unavailable",
  "Datos no disponibles.": "Data unavailable.",
  Reintentar: "Retry",
  "No pudimos cargar los agregados.": "Could not load the aggregates.",
  "La versión no coincide con su manifiesto.":
    "The release does not match its manifest.",
  "No pudimos verificar el estado de publicación.":
    "Could not verify publication status.",
  "Referencia de precios no disponible.": "Price reference unavailable.",
  "Precio no disponible.": "Price unavailable.",
  "La referencia de precios no corresponde a esta versión.":
    "The price reference does not match this release.",
  "Referencia de precios inválida": "Invalid price reference",
  "Precio mensual inválido": "Invalid monthly price",
  "Sin datos para este período": "No data for this period",
  "Volver al último mes disponible": "Return to the latest available month",
  Próximamente: "Coming soon",
  "Esta vista estará disponible en una próxima etapa.":
    "This view will be available in a future stage.",
  "Volver al Resumen": "Back to Overview",
  "Fuente:": "Source:",
  "Secretaría de Energía · Capítulo IV": "Secretaría de Energía · Chapter IV",
  " · Producción hasta {period}": " · Production through {period}",
  "Candidato validado técnicamente; promoción pública pendiente":
    "Technically validated candidate; public promotion pending",
  Preliminar: "Preliminary",
  " · Vaca Muerta · No convencional. ": " · Vaca Muerta · Unconventional. ",
  "Valorización del gas pendiente.": "Gas valuation pending.",
  "Fuentes y metodología": "Sources and methodology",
  "Universo: formación Vaca Muerta y recurso no convencional. Operador declarado por mes; transferencias de activos pueden modificar los rankings. Área: permiso o concesión. Los datos oficiales son revisables; se conserva el último snapshot validado y la promoción pública permanece pendiente.":
    "Scope: Vaca Muerta formation and unconventional resource. Operator declared each month; asset transfers may change rankings. Area: permit or concession. Official data can be revised; the latest validated snapshot is retained and public promotion remains pending.",
  "Producción: {period}. Ingesta: {ingested}. Versión preparada: {generated}. Publicación: {published}.":
    "Production: {period}. Ingested: {ingested}. Release prepared: {generated}. Publication: {published}.",
  "no informada": "not reported",
  "pendiente de aprobación": "pending approval",
  "{year}: fuente actualizada {updated}; extracción {extracted}.":
    "{year}: source updated {updated}; extracted {extracted}.",
  "Manifiesto de producción": "Production manifest",
  "EIA · promedio mensual USD/bbl": "EIA · monthly average USD/bbl",
  "Brent:": "Brent:",
  "Actualizada {updated}; ingesta {retrieved}. Valor mensual = bbl × precio del mismo mes; diario = valor mensual / días calendario. Comparaciones calculadas sobre cada valor estimado. No representa facturación efectiva. Referencia uniforme para entidades; no incorpora calidad, descuentos, costos, regalías o tipo de cambio.":
    "Updated {updated}; ingested {retrieved}. Monthly value = bbl × price for the same month; daily = monthly value / calendar days. Comparisons use each estimated value. Does not represent actual revenue. Uniform reference for entities; excludes quality, discounts, costs, royalties and exchange rates.",
  "Gas:": "Gas:",
  "precios nacionales": "national prices",
  "revisados, sin serie comparable y conversión energética validadas.":
    "reviewed; comparable history and energy conversion have not been validated.",
  "Escala desde cero. Una vista porcentual o índice base 100 podría incorporarse en el futuro.":
    "Scale starts at zero. A percentage change view or base-100 index may be added in the future.",
  "(zona no informada)": "(time zone not reported)",
};
// Contract errors remain diagnostic data; translate all known validation messages at the UI boundary.
Object.assign(translations, {
  "Fila inválida": "Invalid row",
  "Fluido o período inválido": "Invalid product or period",
  "Unidad inválida": "Invalid unit",
  "Métrica inválida": "Invalid metric",
  "Conteo inválido": "Invalid count",
  "Cobertura o volumen inválido": "Invalid coverage or volume",
  "Agregado preparado inválido": "Invalid prepared aggregate",
  "Entidad inválida": "Invalid entity",
  "Ranking inválido": "Invalid ranking",
  "Mes inválido": "Invalid month",
  "Contrato de release inválido": "Invalid release contract",
  "Mes duplicado": "Duplicate month",
  "Entidad duplicada": "Duplicate entity",
  "Entidad sin mes aceptado": "Entity without accepted month",
  "Mapa inválido": "Invalid map",
  "Agrupación inválida": "Invalid grouping",
  "Mapping inválido": "Invalid mapping",
  "Regla de operador inválida": "Invalid operator rule",
  "Procedencia legal inválida": "Invalid legal provenance",
  "Manifiesto inválido": "Invalid manifest",
  "Proveniencia inválida": "Invalid provenance",
  "Períodos aceptados duplicados o cutoff inconsistente":
    "Duplicate accepted periods or inconsistent cutoff",
  "Recursos inválidos": "Invalid resources",
  "Mes fuera del manifiesto": "Month outside manifest",
  "Snapshot aceptado ausente": "Missing accepted snapshot",
  "Falta último mes de un fluido": "Missing latest month for a product",
  "Aprobación no corresponde a esta versión y manifiesto":
    "Approval does not match this release and manifest",
  "Referencia geográfica inválida": "Invalid geographic reference",
});
export function formatters(language: Language) {
  const locale = locales[language];
  const t = (key: string, vars: Record<string, string | number> = {}) =>
    (language === "en" ? (translations[key] ?? key) : key).replace(
      /\{(\w+)\}/g,
      (_, k) => String(vars[k] ?? `{${k}}`),
    );
  const number = (
    value: number | null | undefined,
    decimals = 1,
    minimum = decimals,
  ) =>
    value == null
      ? t("No disponible")
      : new Intl.NumberFormat(locale, {
          maximumFractionDigits: decimals,
          minimumFractionDigits: minimum,
        }).format(value);
  const exact = (value: number | null | undefined) => number(value, 20, 0);
  const compact = (value: number | null | undefined) => {
    if (value == null) return t("No disponible");
    // Round representation only; promote 999.999K to 1M rather than showing 1,000K.
    const magnitude = Math.abs(value);
    const divisor = magnitude >= 999995 ? 1e6 : magnitude >= 999.995 ? 1e3 : 1;
    return `${number(value / divisor, 2, 0)}${divisor === 1 ? "" : `${language === "es" ? " " : ""}${divisor === 1e6 ? "M" : "K"}`}`;
  };
  const million = (value: number | null | undefined, decimals = 1) =>
    value == null ? t("No disponible") : number(value / 1e6, decimals);
  const month = (period: string, short = false) => {
    const text = new Intl.DateTimeFormat(locale, {
      month: short ? "short" : "long",
      year: short ? "2-digit" : "numeric",
      timeZone: "UTC",
    }).format(new Date(`${period}T00:00:00Z`));
    return short
      ? text
      : text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
  };
  const date = (value: string | null | undefined) => {
    if (!value) return t("no informada");
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const zoned = /(?:Z|[+-]\d\d:\d\d)$/.test(value);
    const d = new Date(dateOnly || zoned ? value : `${value}Z`);
    if (!Number.isFinite(d.getTime())) return t("no informada");
    return (
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        ...(!dateOnly ? { timeStyle: "short" as const } : {}),
        timeZone: "UTC",
      }).format(d) +
      (!dateOnly ? (zoned ? " UTC" : ` ${t("(zona no informada)")}`) : "")
    );
  };
  const percent = (v: number, signed = false) =>
    `${signed ? (v > 0 ? "+" : v < 0 ? "−" : "") : ""}${number(signed ? Math.abs(v) : v)}${language === "es" ? " " : ""}%`;
  return {
    language,
    locale,
    t,
    number,
    exact,
    compact,
    million,
    month,
    date,
    percent,
  };
}

"use client";
import { useId, useState, useEffect, useRef, type ReactNode } from "react";
import {
  Line,
  ComposedChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceDot,
} from "recharts";
import {
  availableRanges,
  prepareEntities,
  trend,
  type Entity,
  type Fluid,
  type Row,
} from "../lib/contract";
import { operatorName } from "../lib/operators";
import type { Tab } from "../lib/navigation";
import {
  metric,
  referencePrice,
  entityValue,
  entityComparison,
  comparisonOffset,
  shiftMonth,
  nonnegativeDomain,
  type Comparison,
  effectiveMode,
  estimationNote,
  type Mode,
  type Prices,
  type Metric,
} from "../lib/metrics";
import { useLocale } from "../lib/locale";
function Comparisons({
  metric: m,
  period,
  comparison,
}: {
  metric: Metric;
  period: string;
  comparison: Comparison;
}) {
  const { t, month } = useLocale();
  const base = month(shiftMonth(period, comparisonOffset(comparison)));
  return (
    <span title={t("vs. {period}", { period: base })}>
      <span className="comparison-label">
        {t(comparison === "mom" ? "Mensual" : "Interanual")}
      </span>{" "}
      <Change value={m[comparison]} compact />
      <span className="sr-only"> · {t("vs. {period}", { period: base })}</span>
    </span>
  );
}
const rateUnit = (f: Fluid) => (f === "oil" ? "bbl/d" : "MMm³/d");
const volumeUnit = (f: Fluid) => (f === "oil" ? "bbl" : "MMm³");
export function Change({
  value,
  compact = false,
}: {
  value: number | null | undefined;
  compact?: boolean;
}) {
  const { t, percent } = useLocale();
  if (value == null && compact)
    return (
      <span className="change neutral" title={t("Sin comparador")}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t("Sin comparador")}</span>
      </span>
    );
  return (
    <span
      className={`change ${value == null || value === 0 ? "neutral" : value > 0 ? "positive" : "negative"}`}
    >
      {value == null ? t("Sin comparador") : percent(value, true)}
    </span>
  );
}

// One KPI anatomy; visual prominence is a variant, not a separate component.
export function KpiCard({
  label,
  value,
  unit,
  context,
  variant = "secondary",
  state = "neutral",
  tooltip,
  onDetail,
  comparisons,
  flipped = false,
  onFlip,
  brief,
  methodPeriod,
  methodSource,
}: {
  label: string;
  flipped?: boolean;
  onFlip?: () => void;
  brief?: string;
  methodPeriod?: string;
  methodSource?: string;
  value: ReactNode;
  comparisons?: ReactNode;
  unit?: string;
  context: string;
  variant?: "primary" | "secondary";
  state?: "neutral" | "favorable" | "unfavorable";
  tooltip?: string;
  onDetail?: () => void;
}) {
  const { t, locale } = useLocale();
  const id = useId();
  const info = useRef<HTMLButtonElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const wasFlipped = useRef(false);
  useEffect(() => {
    if (flipped) back.current?.focus();
    // Returning through this card restores focus; switching cards must not steal it.
    else if (wasFlipped.current && document.activeElement === back.current)
      info.current?.focus();
    wasFlipped.current = flipped;
  }, [flipped]);
  return (
    <article
      className={`kpi-card kpi-card--${variant}`}
      data-state={state}
      data-flipped={flipped}
      onKeyDown={(e) => {
        if (e.key === "Escape" && flipped) {
          info.current?.focus();
          onFlip?.();
        }
      }}
    >
      <div className="kpi-inner">
        <div className="kpi-front" inert={flipped} aria-hidden={flipped}>
          <div className="metric-heading">
            <span className="metric-label">{label}</span>
            {tooltip && (
              <span className="metric-info">
                <button
                  ref={info}
                  type="button"
                  aria-label={t("Metodología de {label}", { label })}
                  aria-expanded={flipped}
                  aria-controls={`${id}-back`}
                  aria-describedby={`${id}-tip`}
                  onClick={onFlip}
                >
                  ⓘ
                </button>
                <span role="tooltip" id={`${id}-tip`} className="metric-tip">
                  {brief ?? label}
                </span>
              </span>
            )}
          </div>
          <div className="kpi-value">
            {value}
            {unit && <span>{unit}</span>}
          </div>
          {comparisons && <div className="kpi-comparisons">{comparisons}</div>}
          <div className="kpi-context">
            <span>{context}</span>
            {onDetail && (
              <button
                className="icon-action"
                onClick={onDetail}
                title={t("Detalle próximamente")}
                aria-label={t("Próximamente: detalle de {label}", {
                  label: label.toLocaleLowerCase(locale),
                })}
              >
                ↗
              </button>
            )}
          </div>
        </div>
        <div
          id={`${id}-back`}
          className="kpi-back"
          inert={!flipped}
          aria-hidden={!flipped}
        >
          <div className="kpi-back-heading">
            <strong>{label}</strong>
            <button
              ref={back}
              type="button"
              onClick={() => {
                info.current?.focus();
                onFlip?.();
              }}
              aria-label={t("Volver a {label}", { label })}
            >
              ↶
            </button>
          </div>
          <div className="kpi-methodology">
            <p>{tooltip}</p>
            <p>
              {t("Unidad: {unit} · Período: {period}", {
                unit: unit ?? t("No disponible"),
                period: methodPeriod ?? context,
              })}
            </p>
            <p>
              {methodSource ??
                t("Fuente: Secretaría de Energía · formación Vaca Muerta.")}
            </p>
            <a
              href="#methodology"
              onClick={() => {
                const detail = document.getElementById("methodology");
                if (detail instanceof HTMLDetailsElement) detail.open = true;
              }}
            >
              {t("Metodología completa")}
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
function ModuleCard({
  title,
  subtitle,
  controls,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle: string;
  controls?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section className={`module-card ${className}`} aria-labelledby={id}>
      <header className="module-heading">
        <div>
          <h2 id={id}>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="module-controls">
          {controls}
          {action}
        </div>
      </header>
      {children}
    </section>
  );
}
export function ChartCard(props: Parameters<typeof ModuleCard>[0]) {
  return <ModuleCard {...props} />;
}
export function GlobalFilters({
  fluid,
  period,
  periods,
  mode,
  comparison,
  onFluid,
  onPeriod,
  onMode,
  onComparison,
}: {
  fluid: Fluid;
  period: string;
  periods: string[];
  mode: Mode;
  comparison: Comparison;
  onFluid: (f: Fluid) => void;
  onPeriod: (p: string) => void;
  onMode: (m: Mode) => void;
  onComparison: (c: Comparison) => void;
}) {
  const { t, month } = useLocale();
  return (
    <div className="global-filters">
      <fieldset className="fluid-control">
        <legend className="sr-only">{t("Fluido")}</legend>
        {(["oil", "gas"] as Fluid[]).map((f) => (
          <button key={f} aria-pressed={fluid === f} onClick={() => onFluid(f)}>
            {t(f === "oil" ? "Petróleo" : "Gas")}
          </button>
        ))}
      </fieldset>
      <label className="period-selector">
        <span className="sr-only">{t("Período")}</span>
        <select
          aria-label={t("Mes de producción")}
          value={period}
          disabled={!periods.length}
          onChange={(e) => onPeriod(e.target.value)}
        >
          {periods
            .slice()
            .reverse()
            .map((p) => (
              <option key={p} value={p}>
                {month(p)}
              </option>
            ))}
        </select>
      </label>
      <fieldset className="fluid-control mode-control">
        <legend className="sr-only">{t("Unidad de análisis")}</legend>
        {(["volume", "value"] as Mode[]).map((m) => (
          <button key={m} aria-pressed={mode === m} onClick={() => onMode(m)}>
            {t(m === "volume" ? "Volumen" : "Valor estimado")}
          </button>
        ))}
      </fieldset>
      <fieldset className="fluid-control comparison-control">
        <legend className="sr-only">{t("Comparación temporal")}</legend>
        {(["mom", "yoy"] as Comparison[]).map((c) => (
          <button
            key={c}
            aria-pressed={comparison === c}
            onClick={() => onComparison(c)}
          >
            {t(c === "mom" ? "Mensual" : "Interanual")}
          </button>
        ))}
      </fieldset>
    </div>
  );
}
function TrendTooltip({
  active,
  label,
  fluid,
  prices,
  rows,
  comparison,
}: {
  active?: boolean;
  label?: string | number;
  fluid: Fluid;
  prices: Prices | null;
  rows: Row[];
  comparison: Comparison;
}) {
  const { t, physical, currency, number, month } = useLocale();
  const period = String(label ?? "");
  const row = rows.find((r) => r.fluid === fluid && r.periodo === period);
  if (!active || !row) return null;
  const volume = metric(row, rows, prices, "volume", "volume");
  const value = metric(row, rows, prices, "volume", "value");
  return (
    <div className="chart-tooltip">
      <span>{month(period)}</span>
      <strong>
        {t("Producción: {value}", { value: physical(volume.value, fluid) })}
      </strong>
      <span>
        {t(comparison === "mom" ? "Mensual" : "Interanual")}:{" "}
        <Change value={volume[comparison]} />
      </span>
      {fluid === "oil" && (
        <>
          <strong>
            {t("Valor estimado: {value}", { value: currency(value.value) })}
          </strong>
          <span>
            {t(comparison === "mom" ? "Mensual" : "Interanual")}:{" "}
            <Change value={value[comparison]} />
          </span>
          <span>
            {t("Brent: {price} USD/bbl · EIA", {
              price: number(referencePrice(prices, period, fluid), 2, 0),
            })}
          </span>
        </>
      )}
      <span>
        {t("vs. {period}", {
          period: month(shiftMonth(period, comparisonOffset(comparison))),
        })}
      </span>
    </div>
  );
}
export function Evolution({
  mode,
  prices,
  rows,
  fluid,
  period,
  range,
  setRange,
  onDetail,
  comparison,
}: {
  rows: Row[];
  mode: Mode;
  prices: Prices | null;
  fluid: Fluid;
  period: string;
  range: number;
  setRange: (n: number) => void;
  onDetail: () => void;
  comparison: Comparison;
}) {
  const { t, number, physical, currency, month } = useLocale();
  const ranges = availableRanges(rows, fluid, period);
  const selected = ranges.includes(range) ? range : (ranges[0] ?? 12);
  const series = trend(rows, fluid, period, selected).map((point) => {
    const row = rows.find(
      (r) => r.fluid === fluid && r.periodo === point.periodo,
    );
    const volume = row ? metric(row, rows, prices, "volume", "volume") : null;
    const value = row ? metric(row, rows, prices, "volume", "value") : null;
    return {
      ...point,
      physical: volume?.value ?? null,
      estimated: value?.value ?? null,
      physicalDelta: volume?.[comparison] ?? null,
      valueDelta: value?.[comparison] ?? null,
      base: shiftMonth(point.periodo, comparisonOffset(comparison)),
    };
  });
  const monetary = fluid === "oil";
  const last = series.at(-1);
  const lastValue = monetary ? last?.estimated : last?.physical;
  return (
    <ChartCard
      title={t(
        monetary
          ? "Evolución de producción y valor"
          : "Evolución de la producción",
      )}
      subtitle={t(
        monetary
          ? "Mensual · escalas independientes desde cero; alturas no comparables."
          : "Volumen mensual · escala desde cero.",
      )}
      className="evolution"
      controls={
        <div className="ranges" aria-label={t("Período de evolución")}>
          {ranges.map((n) => (
            <button
              key={n}
              aria-pressed={selected === n}
              onClick={() => setRange(n)}
            >
              {n}m
            </button>
          ))}
        </div>
      }
      action={
        <button className="text-action" onClick={onDetail}>
          {t("Producción · Próximamente")} <span aria-hidden="true">↗</span>
        </button>
      }
    >
      <div className="chart-legend">
        <span>
          <i className="legend-bar" aria-hidden="true" />
          {t("Producción física")} · {volumeUnit(fluid)}
        </span>
        {monetary && (
          <span>
            <i className="legend-line" aria-hidden="true" />
            {t("Valor estimado")} · USD
          </span>
        )}
      </div>
      <div
        className="line-chart"
        aria-hidden="true"
        data-physical-min="0"
        data-value-min="0"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={series}
            margin={{ left: 12, right: 24, top: 30, bottom: 8 }}
            barCategoryGap="22%"
          >
            <XAxis
              dataKey="periodo"
              tickFormatter={(v) => month(v, true)}
              padding={{ left: 12, right: 16 }}
              minTickGap={60}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickMargin={10}
              axisLine={false}
              tickLine={false}
            />
            <YAxis yAxisId="physical" hide domain={nonnegativeDomain} />
            <YAxis yAxisId="value" hide domain={nonnegativeDomain} />
            <Tooltip
              content={
                <TrendTooltip
                  fluid={fluid}
                  prices={prices}
                  rows={rows}
                  comparison={comparison}
                />
              }
              cursor={{ fill: "var(--chart-grid)" }}
            />
            <Bar
              yAxisId="physical"
              dataKey="physical"
              fill="var(--accent)"
              fillOpacity={mode === "value" ? 0.65 : 0.9}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            {monetary && (
              <Line
                yAxisId="value"
                type="linear"
                dataKey="estimated"
                stroke="var(--value-line)"
                strokeWidth={mode === "value" ? 3 : 2.5}
                dot={series.length === 1 ? { r: 4 } : false}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            {last && lastValue != null && (
              <ReferenceDot
                yAxisId={monetary ? "value" : "physical"}
                x={last.periodo}
                y={lastValue}
                r={4}
                fill={monetary ? "var(--value-line)" : "var(--accent)"}
                stroke="var(--surface)"
                label={({ viewBox }: any) => (
                  <text
                    className="chart-end-label"
                    x={viewBox.x - 10}
                    y={viewBox.y - 13}
                    textAnchor="end"
                    fill="var(--ink)"
                    fontSize={11}
                  >
                    {monetary
                      ? currency(lastValue)
                      : physical(lastValue, fluid)}
                  </text>
                )}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-context">
        {t(
          monetary
            ? "El selector Volumen / Valor estimado controla KPIs y rankings; aquí se muestran ambas series disponibles."
            : "Gas: valor estimado pendiente de una referencia nacional y conversión energética validadas.",
        )}
      </p>
      <details className="data-disclosure">
        <summary>{t("Ver tabla de datos")}</summary>
        <table>
          <caption>
            {t(
              "Valores mensuales. Los meses o precios ausentes no equivalen a cero.",
            )}
          </caption>
          <thead>
            <tr>
              <th>{t("Mes")}</th>
              <th>
                {t("Volumen mensual ({unit})", {
                  unit: fluid === "oil" ? "bbl" : "m³",
                })}
              </th>
              <th>{t(comparison === "mom" ? "Mensual" : "Interanual")}</th>
              {monetary && (
                <>
                  <th>{t("Valor mensual (USD estimados)")}</th>
                  <th>{t(comparison === "mom" ? "Mensual" : "Interanual")}</th>
                </>
              )}
              <th>{t("Base de comparación")}</th>
            </tr>
          </thead>
          <tbody>
            {series.map((r) => (
              <tr key={r.periodo}>
                <th>
                  <time
                    dateTime={r.periodo}
                    title={month(r.periodo)}
                    aria-label={month(r.periodo)}
                  >
                    {month(r.periodo, true)}
                  </time>
                </th>
                <td>
                  {number(
                    r.physical == null
                      ? null
                      : r.physical * (fluid === "gas" ? 1e6 : 1),
                    0,
                  )}
                </td>
                <td>
                  <Change value={r.physicalDelta} />
                </td>
                {monetary && (
                  <>
                    <td>{currency(r.estimated)}</td>
                    <td>
                      <Change value={r.valueDelta} />
                    </td>
                  </>
                )}
                <td>
                  <time
                    dateTime={r.base}
                    title={month(r.base)}
                    aria-label={month(r.base)}
                  >
                    {month(r.base, true)}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </ChartCard>
  );
}

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "/vaca-muerta-pulse";
const assets: Record<string, string> = {
  YPF: "YPF.svg",
  PLUSPETROL: "PLUSPETROL.svg",
  PAL: "PAL.png",
  PAM: "PAM.svg",
  TAU: "TAU.svg",
  TPT: "TPT.jpg",
  SHE: "SHE.jpg",
  PGR: "PGR.png",
  VST: "VST.svg",
};
const shortNames: Record<string, string> = {
  YPF: "YPF",
  PLUSPETROL: "Pluspetrol",
  PAL: "Pan American Energy",
  PAM: "Pampa Energía",
  TAU: "Total Austral",
  TPT: "Tecpetrol",
  SHE: "Shell",
  PGR: "Phoenix",
  VST: "Vista",
};
function OperatorLogo({ id }: { id: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={`operator-logo ${["PLUSPETROL", "PAM", "VST", "PAL", "PGR"].includes(id) ? "operator-logo--reverse" : ""}`}
      aria-hidden="true"
    >
      {assets[id] && !failed ? (
        <img
          src={`${base}/operators/${assets[id]}`}
          alt=""
          onError={() => setFailed(true)}
        />
      ) : (
        id.slice(0, 2)
      )}
    </span>
  );
}

export function RankingCard({
  mode,
  prices,
  entities,
  current,
  fluid,
  dimension,
  comparison,
  onNavigate,
}: {
  mode: Mode;
  prices: Prices | null;
  entities: Entity[];
  current: Row;
  fluid: Fluid;
  dimension: "company" | "area";
  comparison: Comparison;
  onNavigate: (tab: Tab, id?: string) => void;
}) {
  const { t, compact, number, currency, percent, month } = useLocale();
  const operators = dimension === "company",
    tab = operators ? "operators" : "areas",
    shown = prepareEntities(entities, fluid, dimension, current.periodo).top;
  return (
    <ModuleCard
      title={t(operators ? "Principales operadores" : "Principales áreas")}
      subtitle={t(
        mode === "value"
          ? "Top 5 · valor bruto estimado · USD"
          : "Top 5 · volumen mensual · {unit}",
        { unit: volumeUnit(fluid) },
      )}
      className={`ranking-card ${operators ? "ranking-operators" : "ranking-areas"}`}
      action={
        <button className="text-action" onClick={() => onNavigate(tab)}>
          {t("{section} · Próximamente ↗", {
            section: t(operators ? "Operadores" : "Áreas"),
          })}
        </button>
      }
    >
      <div className="ranking-columns" aria-hidden="true">
        <span>{t(operators ? "Operador" : "Área")}</span>
        <span>{t(mode === "value" ? "Valor estimado" : "Producción")}</span>
        {operators && <span>{t("Cuota")}</span>}
        <span>{t(comparison === "mom" ? "Mensual" : "Interanual")}</span>
      </div>
      <ol className="ranking-list">
        {shown.map((e) => {
          // Prepared volumes retain the true total-volume denominator in both comparisons.
          const share =
            current.volume > 0 &&
            (mode === "volume" ||
              referencePrice(prices, current.periodo, fluid) != null)
              ? (e.volume / current.volume) * 100
              : null;
          const label = operators
            ? operatorName(e.entity_id, e.entity_name)
            : e.entity_name;
          return (
            <li key={e.entity_id}>
              <button
                className="ranking-row"
                onClick={() => onNavigate(tab, e.entity_id)}
              >
                <span className="entity-name">
                  <span className="rank" aria-hidden="true">
                    {e.volume_rank.toString().padStart(2, "0")}
                  </span>
                  {operators && <OperatorLogo id={e.entity_id} />}
                  <span title={label}>
                    {operators ? (shortNames[e.entity_id] ?? label) : label}
                  </span>
                </span>
                <span className="bar-value">
                  <span className="mobile-label">
                    {t(mode === "value" ? "USD estimados" : "Producción")}
                  </span>
                  <span
                    className="ranking-amount"
                    title={
                      mode === "value"
                        ? currency(entityValue(e, prices, mode))
                        : `${number(entityValue(e, prices, mode), fluid === "oil" ? 0 : 2, 0)} ${volumeUnit(fluid)}`
                    }
                  >
                    {compact(entityValue(e, prices, mode))}
                  </span>
                </span>
                {operators && (
                  <span className="share-value">
                    <span className="mobile-label">{t("Cuota")}</span>
                    {share == null ? t("No disponible") : percent(share)}
                  </span>
                )}
                <span
                  className="yoy-value"
                  title={t("vs. {period}", {
                    period: month(
                      shiftMonth(current.periodo, comparisonOffset(comparison)),
                    ),
                  })}
                >
                  <span className="mobile-label">
                    {t(comparison === "mom" ? "Mensual" : "Interanual")}
                  </span>
                  <Change
                    value={entityComparison(e, prices, mode, comparison)}
                    compact
                  />
                </span>
                <span className="bar-track" aria-hidden="true">
                  <span style={{ width: `${share ?? 0}%` }} />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {!shown.length && (
        <p className="empty">
          {t(
            operators
              ? "Sin operadores para este período."
              : "Sin áreas para este período.",
          )}
        </p>
      )}
      <p className="ranking-scale">
        {t("Barras: participación en el total · escala 0–100%")}
        {mode === "value" && t(" · Referencia uniforme, no ingresos efectivos")}
      </p>
    </ModuleCard>
  );
}
export function SummaryDashboard({
  current,
  rows,
  entities,
  fluid,
  period,
  range,
  setRange,
  onNavigate,
  mode,
  prices,
  comparison,
}: {
  current: Row;
  rows: Row[];
  entities: Entity[];
  fluid: Fluid;
  period: string;
  range: number;
  setRange: (n: number) => void;
  onNavigate: (tab: Tab, id?: string) => void;
  mode: Mode;
  prices: Prices | null;
  comparison: Comparison;
}) {
  const { t, number, million, month, date } = useLocale();
  const [flipped, setFlipped] = useState<number | null>(null);
  const flipProps = (id: number) => ({
    methodPeriod: month(period),
    methodSource: t(
      id !== 2 && (monetary || (id === 3 && fluid === "oil"))
        ? "Fuente: EIA · Brent mensual; volumen: Secretaría de Energía."
        : "Fuente: Secretaría de Energía · formación Vaca Muerta.",
    ),
    flipped: flipped === id,
    onFlip: () => setFlipped((active) => (active === id ? null : id)),
  });
  const shownMode = effectiveMode(mode, fluid),
    monetary = shownMode === "value";
  const daily = metric(current, rows, prices, "rate", shownMode),
    monthly = metric(current, rows, prices, "volume", shownMode),
    wells = metric(current, rows, prices, "wells"),
    fourth = metric(current, rows, prices, monetary ? "price" : "estimate");
  const price = referencePrice(prices, period, fluid),
    note = t(estimationNote);
  const physicalVolume =
    fluid === "oil"
      ? `${number(current.volume, 0)} bbl`
      : `${number(current.volume * 1e6, 0)} m³ (${number(current.volume, 0)} MMm³)`;
  const valuationHelp =
    price == null
      ? t(
          fluid === "gas"
            ? "Referencia nacional y conversión energética sin validar."
            : "Precio Brent no disponible para este mes. No se calcula un valor sin respaldo.",
        )
      : t(
          "{note} Fórmula: volumen mensual en bbl × {price} USD/bbl ({period}). Fuente: EIA. Actualizada {date}. Valor presentado: {value} USD. Comparaciones con volumen y precio de cada mes.",
          {
            note,
            price: number(price, 2),
            period: month(period),
            date: date(prices?.source.source_updated_at),
            value: number(current.volume * price, 0),
          },
        );
  const comparisons = (m: Metric) => (
    <Comparisons metric={m} period={period} comparison={comparison} />
  );
  return (
    <>
      <h1 className="sr-only">{t("Resumen de Vaca Muerta")}</h1>
      {mode === "value" && fluid === "gas" && (
        <p className="availability-note" role="status">
          {t(
            "Valor estimado no disponible para gas. Falta validar una referencia nacional comparable y la conversión energética. Se muestran unidades físicas.",
          )}
        </p>
      )}
      {monetary && price == null && (
        <p className="availability-note" role="status">
          {t(
            "Precio Brent no disponible para este período; el valor estimado permanece sin calcular.",
          )}
        </p>
      )}
      <div className="kpi-grid">
        <KpiCard
          {...flipProps(0)}
          brief={t(
            monetary
              ? "Valor mensual a precio histórico Brent dividido por los días del mes."
              : "Volumen producido durante el mes dividido por sus días calendario.",
          )}
          variant="primary"
          label={t(monetary ? "Valor diario estimado" : "Producción diaria")}
          value={
            monetary
              ? million(daily.value, 2)
              : number(daily.value, fluid === "oil" ? 0 : 2)
          }
          unit={monetary ? t("M USD/día") : rateUnit(fluid)}
          context={month(period)}
          comparisons={comparisons(daily)}
          tooltip={
            monetary
              ? t("{help} Diario = valor mensual / {days} días calendario.", {
                  help: valuationHelp,
                  days: Number(current.days_in_month),
                })
              : t(
                  "Volumen mensual / {days} días calendario. Tasa presentada: {value} {unit}. Las comparaciones usan tasas diarias, no volúmenes mensuales.",
                  {
                    days: Number(current.days_in_month),
                    value: number(current.rate, fluid === "oil" ? 0 : 2, 0),
                    unit: rateUnit(fluid),
                  },
                )
          }
          onDetail={() => onNavigate("production")}
        />
        <KpiCard
          {...flipProps(1)}
          brief={t(
            monetary
              ? "Volumen mensual multiplicado por el precio Brent de ese mes."
              : "Volumen producido durante el mes seleccionado.",
          )}
          label={t(monetary ? "Valor mensual estimado" : "Volumen mensual")}
          value={
            monetary || fluid === "oil"
              ? million(monthly.value)
              : number(monthly.value, 1)
          }
          unit={monetary ? "M USD" : fluid === "oil" ? "M bbl" : "MMm³"}
          context={month(period)}
          comparisons={comparisons(monthly)}
          tooltip={
            monetary
              ? valuationHelp
              : t(
                  "{volume}. Las comparaciones usan volúmenes mensuales; pueden diferir de la tasa diaria por los días de cada mes.",
                  { volume: physicalVolume },
                )
          }
          onDetail={() => onNavigate("production")}
        />
        <KpiCard
          {...flipProps(2)}
          brief={t("Pozos únicos con producción positiva durante el mes.")}
          label={t("Pozos productivos")}
          value={number(wells.value, 0)}
          unit={t("pozos")}
          context={t("Con producción positiva")}
          comparisons={comparisons(wells)}
          tooltip={t(
            "Pozos únicos con producción positiva de {fluid} durante {period}. Las comparaciones usan esta cantidad de pozos, no tasas ni volumen. Base ausente o cero: sin comparador.",
            {
              fluid: t(fluid === "oil" ? "Petróleo" : "Gas").toLowerCase(),
              period: month(period),
            },
          )}
          onDetail={() => onNavigate("activity")}
        />
        <KpiCard
          {...flipProps(3)}
          brief={t(
            price == null
              ? "Referencia nacional y conversión energética sin validar."
              : monetary
                ? "Precio promedio mensual Brent utilizado como referencia, no precio efectivo de venta."
                : "Volumen mensual multiplicado por el precio Brent de ese mes.",
          )}
          label={t(
            monetary ? "Precio de referencia Brent" : "Valor bruto estimado",
          )}
          value={monetary ? number(fourth.value, 2) : million(fourth.value)}
          unit={
            fourth.value == null ? undefined : monetary ? "USD/bbl" : "M USD"
          }
          context={t(
            monetary
              ? "Promedio mensual · EIA"
              : fourth.value == null
                ? "Estimación pendiente"
                : "A precio Brent · estimación",
          )}
          comparisons={comparisons(fourth)}
          tooltip={
            monetary
              ? t(
                  "Europe Brent Spot Price FOB. Promedio mensual en USD/bbl, EIA ({date}). Las comparaciones usan precios. {note}",
                  { date: date(prices?.source.source_updated_at), note },
                )
              : valuationHelp
          }
        />
      </div>
      <Evolution
        rows={rows}
        fluid={fluid}
        period={period}
        range={range}
        setRange={setRange}
        mode={shownMode}
        prices={prices}
        comparison={comparison}
        onDetail={() => onNavigate("production")}
      />
      <div className="ranking-grid">
        {(["company", "area"] as const).map((dimension) => (
          <RankingCard
            key={dimension}
            entities={entities}
            current={current}
            fluid={fluid}
            dimension={dimension}
            mode={shownMode}
            prices={prices}
            comparison={comparison}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </>
  );
}

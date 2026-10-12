"use client";
import {
  useId,
  useState,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
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
  prepareEntities,
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
  type Mode,
  type Prices,
  type Metric,
} from "../lib/metrics";
import { useLocale } from "../lib/locale";
import {
  historyRanges,
  historyWindow,
  historyTicks,
  defaultHistoryRange,
} from "../lib/history";
import { MeasurementIcon } from "./icons";
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
    <span className="comparison-pair" title={t("vs. {period}", { period: base })}>
      <span className="comparison-label">
        {t(comparison === "mom" ? "Mensual" : "Interanual")}
      </span>
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
  methodSource,
}: {
  label: string;
  flipped?: boolean;
  onFlip?: () => void;
  brief?: string;
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
              {t("Ver metodología →")}
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
  subtitle?: string;
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
          {subtitle && <p>{subtitle}</p>}
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
            {m === "volume" ? (
              <MeasurementIcon />
            ) : (
              <span className="currency-symbol" aria-hidden="true">
                $
              </span>
            )}
            {t(m === "volume" ? "Volumen" : "Valor USD")}
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
}: {
  active?: boolean;
  label?: string | number;
  fluid: Fluid;
  prices: Prices | null;
  rows: Row[];
}) {
  const { t, physical, currency, monthYear } = useLocale();
  const row = rows.find(
    (r) => r.fluid === fluid && r.periodo === String(label ?? ""),
  );
  if (!active || !row) return null;
  const volume = metric(row, rows, prices, "volume", "volume");
  const value = metric(row, rows, prices, "volume", "value");
  return (
    <div className="chart-tooltip compact-chart-tooltip">
      <div className="tooltip-month">{monthYear(row.periodo)}</div>
      <div className="tooltip-row">
        <span>{t("Producción")}</span>
        <strong>{physical(volume.value, fluid)}</strong>
      </div>
      {fluid === "oil" && (
        <div className="tooltip-row">
          <span>{t("Valor estimado")}</span>
          <strong>{currency(value.value)}</strong>
        </div>
      )}
    </div>
  );
}
function WellsTooltip({active, payload}: {active?: boolean; payload?: readonly {payload?: {periodo: string; physical: number | null}}[]}) {
  const {t, number, monthYear} = useLocale();
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="chart-tooltip compact-chart-tooltip"><strong>{monthYear(point.periodo)}</strong><div className="tooltip-row"><span>{t("Pozos productivos")}</span><strong>{number(point.physical, 0)}</strong></div></div>;
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
  kind = "production",
  detailView = false,
}: {
  kind?: "production" | "wells";
  detailView?: boolean;
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
  const { t, number, physical, currency, month, historyMonth } = useLocale();
  const wells = kind === "wells";
  const selected = historyRanges.some((n) => n === range)
    ? range
    : defaultHistoryRange;
  const coverage = historyWindow(rows, fluid, period, selected);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [touchTooltip, setTouchTooltip] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setTouchTooltip(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const compactViewport = window.matchMedia("(max-width: 1100px)");
    const measure = () => setScrollable(compactViewport.matches && el.scrollWidth > el.clientWidth + 1);
    compactViewport.addEventListener("change", measure);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    measure();
    el.scrollLeft = el.scrollWidth;
    setScrollOffset(el.scrollLeft);
    return () => { observer.disconnect(); compactViewport.removeEventListener("change", measure); };
  }, [selected, fluid, period]);
  const series = coverage.points.map((point) => {
    const row = rows.find(
      (r) => r.fluid === fluid && r.periodo === point.periodo,
    );
    const volume = row ? metric(row, rows, prices, wells ? "wells" : "volume", "volume") : null;
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
  const monetary = !wells && fluid === "oil" && (!detailView || series.some(p => p.estimated != null));
  const last = series.at(-1);
  const lastValue = monetary ? last?.estimated : last?.physical;
  return (
    <ChartCard
      title={t(
        wells ? "Evolución de pozos productivos" : monetary
          ? "Evolución de producción y valor"
          : "Evolución de la producción",
      )}
      className={wells ? "evolution wells-evolution" : "evolution production-evolution"}
      controls={!wells &&
        <div className="ranges" role={detailView ? "group" : undefined} aria-label={t("Período de evolución")}>
          {historyRanges.map((n) => (
            <button
              key={n}
              aria-pressed={selected === n}
              onClick={() => setRange(n)}
            >
              {n === 0 ? t("Histórico") : `${n}m`}
            </button>
          ))}
        </div>
      }
      action={!detailView &&
        <button className="text-action" onClick={onDetail}>
          {t(wells ? "Actividad · Próximamente" : "Producción · Próximamente")} <span aria-hidden="true">↗</span>
        </button>
      }
    >
      <div className="chart-legend">
        <span>
          <i className="legend-bar" aria-hidden="true" />
          {wells ? t("Pozos productivos") : `${t("Producción física")} · ${volumeUnit(fluid)}`}
        </span>
        {monetary && (
          <span>
            <i className="legend-line" aria-hidden="true" />
            {t("Valor estimado")} · USD
          </span>
        )}
      </div>
      {(selected === 0 || coverage.partial) && (
        <p className="history-coverage" role="status">
          {t(
            "Histórico disponible: {start} – {end}",
            {
              count: coverage.available,
              requested: selected,
              start: coverage.start ? historyMonth(coverage.start) : "—",
              end: coverage.end ? historyMonth(coverage.end) : "—",
            },
          )}
        </p>
      )}
      <div
        className="chart-scroll"
        ref={scrollRef}
        onScroll={(e) => setScrollOffset(e.currentTarget.scrollLeft)}
        tabIndex={0}
        role="region"
        aria-label={t(wells ? "Gráfico desplazable de pozos productivos" : "Gráfico desplazable de producción y valor")}
      >
        <div
          className="line-chart"
          style={
            {
              "--history-width": `${series.length * 28 + 64}px`,
            } as CSSProperties
          }
          aria-hidden="true"
          data-physical-min="0"
          data-value-min="0"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              accessibilityLayer={!detailView}
              data={series}
              margin={{ left: 12, right: 24, top: 30, bottom: 8 }}
              barCategoryGap={coverage.requested >= 36 ? "15%" : "22%"}
            >
              <XAxis
                dataKey="periodo"
                tickFormatter={(v) => month(v, true)}
                padding={{ left: 12, right: 16 }}
                ticks={historyTicks(
                  series.map((p) => p.periodo),
                  coverage.requested,
                )}
                minTickGap={30}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                tickMargin={10}
                axisLine={false}
                tickLine={false}
              />
              <YAxis yAxisId="physical" hide domain={nonnegativeDomain} />
              <YAxis yAxisId="value" hide domain={nonnegativeDomain} />
              <Tooltip
                isAnimationActive={false}
                trigger={touchTooltip ? "click" : "hover"}
                position={
                  scrollable ? { x: scrollOffset + 12, y: 8 } : undefined
                }
                content={
                  wells ? <WellsTooltip /> : <TrendTooltip fluid={fluid} prices={prices} rows={rows} />
                }
                cursor={{ fill: "var(--chart-grid)" }}
              />
              {wells ? <Line yAxisId="physical" dataKey="physical" type="linear" stroke="var(--accent)" strokeWidth={2.5} dot={series.length === 1 ? {r: 4} : false} activeDot={{r: 4}} connectNulls={false} isAnimationActive={false} /> : <Bar
                yAxisId="physical"
                dataKey="physical"
                fill="var(--accent)"
                fillOpacity={mode === "value" ? 0.65 : 0.9}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />}
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
                      {wells ? number(lastValue, 0) : monetary
                        ? currency(lastValue)
                        : physical(lastValue, fluid)}
                    </text>
                  )}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      {scrollable && (
        <p className="chart-scroll-hint">
          {t("Deslizá para explorar los meses →")}
        </p>
      )}
      {!wells && !monetary && <p className="chart-context">{t(fluid === "gas" ? "Gas: valor estimado no disponible." : "Referencia de precios no disponible.")}</p>}
      {!detailView && <details className="data-disclosure">
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
                {wells ? t("Pozos productivos") : t("Volumen mensual ({unit})", {
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
                      : r.physical * (!wells && fluid === "gas" ? 1e6 : 1),
                    0,
                  )}
                </td>
                <td>
                  <Change value={r.physicalDelta} />
                </td>
                {monetary && (
                  <>
                    <td>
                      {r.estimated == null
                        ? t("No disponible")
                        : `${number(r.estimated, 2)} USD`}
                    </td>
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
      </details>}
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

export function RankingItem({
  position,
  logo,
  name,
  fullName,
  production,
  productionExact,
  participation,
  variation,
  comparison,
  comparisonPeriod,
  onSelect,
}: {
  position: number;
  logo?: ReactNode;
  name: string;
  fullName: string;
  production: ReactNode;
  productionExact: string;
  participation: number | null;
  variation: number | null;
  comparison: Comparison;
  comparisonPeriod: string;
  onSelect: () => void;
}) {
  const { t, percent } = useLocale();
  return (
    <li>
      <button
        className="ranking-row ranking-item"
        data-leader={position === 1}
        data-has-logo={!!logo}
        onClick={onSelect}
      >
        <span className="ranking-main">
          <span className="entity-name">
            <span className="rank">{position.toString().padStart(2, "0")}</span>
            {logo}
            <span className="ranking-name" title={fullName}>
              {name}
            </span>
          </span>
          <span
            className="share-value"
            title={t("Barras: participación en el total · escala 0–100%")}
          >
            <span className="sr-only">{t("Cuota")} </span>
            {participation == null
              ? t("No disponible")
              : percent(participation)}
          </span>
        </span>
        <span className="ranking-meta">
          <span className="bar-value">
            <span className="ranking-amount" title={productionExact}>
              {production}
            </span>
          </span>
          <span
            className="yoy-value"
            title={t("vs. {period}", { period: comparisonPeriod })}
          >
            <span className="ranking-comparison-label">
              {t(comparison === "mom" ? "Mensual" : "Interanual")}
            </span>
            <Change value={variation} compact />
          </span>
        </span>
        <span className="bar-track" aria-hidden="true">
          <span style={{ width: `${participation ?? 0}%` }} />
        </span>
      </button>
    </li>
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
  const { t, compact, number, month } = useLocale();
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
          const value = entityValue(e, prices, mode);
          return (
            <RankingItem
              key={e.entity_id}
              position={e.volume_rank}
              logo={operators ? <OperatorLogo id={e.entity_id} /> : undefined}
              name={operators ? (shortNames[e.entity_id] ?? label) : label}
              fullName={label}
              participation={share}
              production={
                <>
                  {compact(value)}
                  {value != null && (
                    <span className="ranking-unit">
                      {" "}
                      {mode === "value" ? "USD" : volumeUnit(fluid)}
                    </span>
                  )}
                </>
              }
              productionExact={
                mode === "value"
                  ? `${number(value, 2, 0)} USD`
                  : `${number(value, fluid === "oil" ? 0 : 2, 0)} ${volumeUnit(fluid)}`
              }
              variation={entityComparison(e, prices, mode, comparison)}
              comparison={comparison}
              comparisonPeriod={month(
                shiftMonth(current.periodo, comparisonOffset(comparison)),
              )}
              onSelect={() => onNavigate(tab, e.entity_id)}
            />
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
  const { t, number, million, month } = useLocale();
  const [flipped, setFlipped] = useState<number | null>(null);
  const flipProps = (id: number) => ({
    methodSource: t(
      id === 3 && monetary
        ? "Fuente: EIA."
        : id !== 2 && (monetary || (id === 3 && fluid === "oil"))
          ? "Fuente: Secretaría de Energía · EIA."
          : "Fuente: Secretaría de Energía.",
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
  const price = referencePrice(prices, period, fluid);
  const valuationHelp = t(
    price == null
      ? "Estimación pendiente: referencia monetaria sin validar para este período."
      : "Volumen mensual × precio del período. Estimación, no facturación efectiva.",
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
              ? "Promedio diario del valor estimado del mes."
              : "Promedio diario de producción del mes.",
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
          tooltip={t(
            monetary
              ? "Valor mensual estimado / días calendario. No representa facturación efectiva."
              : "Volumen mensual dividido por los días del período.",
          )}
          onDetail={() => onNavigate("production")}
        />
        <KpiCard
          {...flipProps(1)}
          brief={t(
            monetary
              ? "Producción valorizada a precio de referencia."
              : "Producción acumulada durante el mes.",
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
              : t("Suma de la producción registrada durante el mes.")
          }
          onDetail={() => onNavigate("production")}
        />
        <KpiCard
          {...flipProps(2)}
          brief={t("Pozos con producción positiva en el mes.")}
          label={t("Pozos productivos")}
          value={number(wells.value, 0)}
          unit={t("pozos")}
          context={t("Con producción positiva")}
          comparisons={comparisons(wells)}
          tooltip={t("Pozos únicos con producción positiva durante el mes.")}
          onDetail={() => onNavigate("activity")}
        />
        <KpiCard
          {...flipProps(3)}
          brief={t(
            price == null
              ? "Estimación monetaria no disponible."
              : monetary
                ? "Precio promedio mensual de referencia Brent."
                : "Producción valorizada a precio de referencia.",
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
                  "Promedio mensual Brent de referencia; no es el precio efectivo de venta.",
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

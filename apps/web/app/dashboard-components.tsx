"use client";
import { useId, useState, type ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceDot,
} from "recharts";
import {
  availableRanges,
  month,
  number,
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
  entityYoY,
  effectiveMode,
  estimationNote,
  type Mode,
  type Prices,
  type Metric,
} from "../lib/metrics";
const exact = (value: number | null) =>
  value == null
    ? "No disponible"
    : new Intl.NumberFormat("es-AR", { maximumFractionDigits: 20 }).format(
        value,
      );
const display = (value: number | null, decimals = 1) =>
  value == null ? "No disponible" : number(value, decimals);
const compact = (value: number | null, decimals = 1) =>
  value == null ? "No disponible" : number(value / 1e6, decimals);
function Comparisons({
  metric: m,
  period,
}: {
  metric: Metric;
  period: string;
}) {
  return (
    <>
      {(
        [
          ["YoY", -12, m.yoy],
          ["MoM", -1, m.mom],
        ] as const
      ).map(([label, offset, value]) => (
        <span key={label} title={`vs. ${comparisonMonth(period, offset)}`}>
          <span className="comparison-label">{label}</span>{" "}
          <Change value={value} compact />
        </span>
      ))}
    </>
  );
}
const rateUnit = (f: Fluid) => (f === "oil" ? "bbl/d" : "MMm³/d");
const volumeUnit = (f: Fluid) => (f === "oil" ? "bbl" : "MMm³");
export function periodTitle(p: string) {
  const label = month(p);
  return label.charAt(0).toLocaleUpperCase("es-AR") + label.slice(1);
}
function comparisonMonth(p: string, offset: number) {
  const d = new Date(`${p}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return month(d.toISOString().slice(0, 10));
}
export function Change({
  value,
  compact = false,
}: {
  value: number | null | undefined;
  compact?: boolean;
}) {
  if (value == null && compact)
    return (
      <span className="change neutral" title="Sin comparador">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Sin comparador</span>
      </span>
    );
  return (
    <span
      className={`change ${value == null || value === 0 ? "neutral" : value > 0 ? "positive" : "negative"}`}
    >
      {value == null
        ? "Sin comparador"
        : `${value > 0 ? "+" : value < 0 ? "−" : ""}${number(Math.abs(value))}%`}
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
}: {
  label: string;
  value: ReactNode;
  comparisons?: ReactNode;
  unit?: string;
  context: string;
  variant?: "primary" | "secondary";
  state?: "neutral" | "favorable" | "unfavorable";
  tooltip?: string;
  onDetail?: () => void;
}) {
  return (
    <article
      className={`kpi-card kpi-card--${variant}`}
      data-state={state}
      title={tooltip}
    >
      <div className="metric-heading">
        <span className="metric-label">{label}</span>
        {tooltip && (
          <details className="metric-help">
            <summary aria-label={`Metodología de ${label}`}>ⓘ</summary>
            <p>{tooltip}</p>
          </details>
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
            title="Detalle próximamente"
            aria-label={`Próximamente: detalle de ${label.toLocaleLowerCase("es-AR")}`}
          >
            ↗
          </button>
        )}
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
  onFluid,
  onPeriod,
  onMode,
}: {
  fluid: Fluid;
  period: string;
  periods: string[];
  mode: Mode;
  onFluid: (f: Fluid) => void;
  onPeriod: (p: string) => void;
  onMode: (m: Mode) => void;
}) {
  return (
    <div className="global-filters">
      <fieldset className="fluid-control">
        <legend className="sr-only">Fluido</legend>
        {(["oil", "gas"] as Fluid[]).map((f) => (
          <button key={f} aria-pressed={fluid === f} onClick={() => onFluid(f)}>
            {f === "oil" ? "Petróleo" : "Gas"}
          </button>
        ))}
      </fieldset>
      <label className="period-selector">
        <span className="sr-only">Período</span>
        <select
          aria-label="Mes de producción"
          value={period}
          disabled={!periods.length}
          onChange={(e) => onPeriod(e.target.value)}
        >
          {periods
            .slice()
            .reverse()
            .map((p) => (
              <option key={p} value={p}>
                {periodTitle(p)}
              </option>
            ))}
        </select>
      </label>
      <fieldset className="fluid-control mode-control">
        <legend className="sr-only">Unidad de análisis</legend>
        {(["volume", "value"] as Mode[]).map((m) => (
          <button key={m} aria-pressed={mode === m} onClick={() => onMode(m)}>
            {m === "volume" ? "Volumen" : "Valor estimado"}
          </button>
        ))}
      </fieldset>
    </div>
  );
}
function TrendTooltip({
  active,
  payload,
  label,
  fluid,
  mode,
  prices,
}: {
  active?: boolean;
  payload?: readonly { value?: number | string | (number | string)[] }[];
  label?: string | number;
  fluid: Fluid;
  mode: Mode;
  prices: Prices | null;
}) {
  const value = payload?.[0]?.value;
  if (!active || value == null || label == null) return null;
  return (
    <div className="chart-tooltip">
      <span>{periodTitle(String(label))}</span>
      <strong>
        {exact(Number(value))}{" "}
        {mode === "value" ? "USD/día estimados" : rateUnit(fluid)}
      </strong>
      {mode === "value" && (
        <span>
          Brent: {display(referencePrice(prices, String(label), fluid), 2)}{" "}
          USD/bbl · EIA
        </span>
      )}
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
}: {
  rows: Row[];
  mode: Mode;
  prices: Prices | null;
  fluid: Fluid;
  period: string;
  range: number;
  setRange: (n: number) => void;
  onDetail: () => void;
}) {
  const ranges = availableRanges(rows, fluid, period),
    selected = ranges.includes(range) ? range : (ranges[0] ?? 12),
    series = trend(rows, fluid, period, selected).map((point) => {
      const row = rows.find(
        (r) => r.fluid === fluid && r.periodo === point.periodo,
      );
      return {
        ...point,
        rate:
          mode === "value" && row
            ? metric(row, rows, prices, "rate", mode).value
            : mode === "value"
              ? null
              : point.rate,
      };
    });
  const unit = mode === "value" ? "USD/día estimados" : rateUnit(fluid);
  const last = series.at(-1);
  return (
    <ChartCard
      title={
        mode === "value"
          ? "Evolución del valor estimado"
          : "Evolución de la producción"
      }
      subtitle={`Tasa diaria equivalente · ${unit}`}
      className="evolution"
      controls={
        <div className="ranges" aria-label="Período de evolución">
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
          Producción · Próximamente <span aria-hidden="true">↗</span>
        </button>
      }
    >
      <div className="line-chart" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={series}
            margin={{ left: 0, right: 24, top: 22, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="periodo"
              tickFormatter={(v) =>
                new Intl.DateTimeFormat("es-AR", {
                  month: "short",
                  year: "2-digit",
                  timeZone: "UTC",
                }).format(new Date(`${v}T00:00:00Z`))
              }
              minTickGap={60}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickMargin={12}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={mode === "value" ? 75 : 65}
              domain={["auto", "auto"]}
              tickCount={3}
              tickFormatter={(v) =>
                mode === "value"
                  ? `${number(v / 1e6, 1)} M`
                  : number(v, fluid === "oil" ? 0 : 1)
              }
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickMargin={8}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={
                <TrendTooltip fluid={fluid} mode={mode} prices={prices} />
              }
              cursor={{ stroke: "var(--rule)" }}
            />
            <Line
              type="linear"
              dataKey="rate"
              stroke="var(--accent)"
              strokeWidth={2.5}
              dot={series.length === 1 ? { r: 4 } : false}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {last?.rate != null && (
              <ReferenceDot
                x={last.periodo}
                y={last.rate}
                r={4}
                fill="var(--accent)"
                stroke="var(--surface)"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {last?.rate != null && (
        <p className="chart-final">
          {periodTitle(last.periodo)} ·{" "}
          <strong>
            {number(last.rate, mode === "value" || fluid === "oil" ? 0 : 2)}{" "}
            {unit}
          </strong>
        </p>
      )}
      <details className="data-disclosure">
        <summary>Ver tabla de datos</summary>
        <table>
          <caption>
            Tasa diaria equivalente del mes. Los meses o precios ausentes no
            equivalen a cero.
          </caption>
          <thead>
            <tr>
              <th>Mes</th>
              <th>Tasa ({unit})</th>
            </tr>
          </thead>
          <tbody>
            {series.map((r) => (
              <tr key={r.periodo}>
                <th>{r.label}</th>
                <td>
                  {r.rate == null
                    ? "No disponible"
                    : number(
                        r.rate,
                        mode === "value" || fluid === "oil" ? 0 : 2,
                      )}
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
  onNavigate,
}: {
  mode: Mode;
  prices: Prices | null;
  entities: Entity[];
  current: Row;
  fluid: Fluid;
  dimension: "company" | "area";
  onNavigate: (tab: Tab, id?: string) => void;
}) {
  const operators = dimension === "company",
    tab = operators ? "operators" : "areas",
    shown = prepareEntities(entities, fluid, dimension, current.periodo).top;
  return (
    <ModuleCard
      title={operators ? "Principales operadores" : "Principales áreas"}
      subtitle={`Top 5 · ${mode === "value" ? "valor bruto estimado · USD" : `volumen mensual · ${volumeUnit(fluid)}`}`}
      className={`ranking-card ${operators ? "ranking-operators" : "ranking-areas"}`}
      action={
        <button className="text-action" onClick={() => onNavigate(tab)}>
          {operators ? "Operadores" : "Áreas"} · Próximamente ↗
        </button>
      }
    >
      <div className="ranking-columns" aria-hidden="true">
        <span>{operators ? "Operador" : "Área"}</span>
        <span>{mode === "value" ? "Valor estimado" : "Producción"}</span>
        {operators && <span>Cuota</span>}
        <span>YoY</span>
      </div>
      <ol className="ranking-list">
        {shown.map((e) => {
          // Display composition on a true 0–100% total-volume scale. No growth calculations in UI.
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
                    {mode === "value" ? "USD estimados" : "Producción"}
                  </span>
                  <span title={exact(entityValue(e, prices, mode))}>
                    {mode === "value"
                      ? `${compact(entityValue(e, prices, mode))} M`
                      : number(e.volume, fluid === "oil" ? 0 : 2)}
                  </span>
                </span>
                {operators && (
                  <span className="share-value">
                    <span className="mobile-label">Cuota</span>
                    {share == null ? "No disponible" : `${number(share)}%`}
                  </span>
                )}
                <span className="yoy-value">
                  <span className="mobile-label">YoY</span>
                  <Change value={entityYoY(e, prices, mode)} compact />
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
          Sin {operators ? "operadores" : "áreas"} para este período.
        </p>
      )}
      <p className="ranking-scale">
        Barras: participación en el total · escala 0–100%
        {mode === "value" && " · Referencia uniforme, no ingresos efectivos"}
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
}) {
  const shownMode = effectiveMode(mode, fluid),
    monetary = shownMode === "value";
  const daily = metric(current, rows, prices, "rate", shownMode);
  const monthly = metric(current, rows, prices, "volume", shownMode);
  const wells = metric(current, rows, prices, "wells");
  const fourth = metric(current, rows, prices, monetary ? "price" : "estimate");
  const price = referencePrice(prices, period, fluid);
  const physicalVolume =
    fluid === "oil"
      ? `${exact(current.volume)} bbl`
      : `${exact(current.volume * 1e6)} m³ (${exact(current.volume)} MMm³)`;
  const valuationHelp =
    price == null
      ? fluid === "gas"
        ? (prices?.gas.reason ?? "Referencia nacional sin validar.")
        : "Precio Brent no disponible para este mes. No se calcula un valor sin respaldo."
      : `${estimationNote} Fórmula: volumen mensual en bbl × ${number(price, 2)} USD/bbl (${periodTitle(period)}). Fuente: EIA. Actualizada ${prices?.source.source_updated_at}. Valor exacto: ${exact(current.volume * price)} USD. Comparaciones con volumen y precio de cada mes.`;
  return (
    <>
      <h1 className="sr-only">Resumen de Vaca Muerta</h1>
      {mode === "value" && fluid === "gas" && (
        <p className="availability-note" role="status">
          Valor estimado no disponible para gas. Falta validar una referencia
          nacional comparable y la conversión energética. Se muestran unidades
          físicas.
        </p>
      )}
      {monetary && price == null && (
        <p className="availability-note" role="status">
          Precio Brent no disponible para este período; el valor estimado
          permanece sin calcular.
        </p>
      )}
      <div className="kpi-grid">
        <KpiCard
          variant="primary"
          label={monetary ? "Valor diario estimado" : "Producción diaria"}
          value={
            monetary
              ? compact(daily.value, 2)
              : display(daily.value, fluid === "oil" ? 0 : 2)
          }
          unit={monetary ? "M USD/día" : rateUnit(fluid)}
          context={periodTitle(period)}
          comparisons={<Comparisons metric={daily} period={period} />}
          tooltip={
            monetary
              ? `${valuationHelp} Diario = valor mensual / ${current.days_in_month} días calendario.`
              : `Volumen mensual / ${current.days_in_month} días calendario. Tasa exacta: ${exact(current.rate)} ${rateUnit(fluid)}. YoY y MoM comparan tasas diarias, no volúmenes mensuales.`
          }
          onDetail={() => onNavigate("production")}
        />
        <KpiCard
          label={monetary ? "Valor mensual estimado" : "Volumen mensual"}
          value={
            monetary || fluid === "oil"
              ? compact(monthly.value)
              : display(monthly.value, 1)
          }
          unit={monetary ? "M USD" : fluid === "oil" ? "M bbl" : "MMm³"}
          context={periodTitle(period)}
          comparisons={<Comparisons metric={monthly} period={period} />}
          tooltip={
            monetary
              ? valuationHelp
              : `${physicalVolume}. YoY y MoM comparan volúmenes mensuales; pueden diferir de la tasa diaria por los días de cada mes.`
          }
          onDetail={() => onNavigate("production")}
        />
        <KpiCard
          label="Pozos productivos"
          value={display(wells.value, 0)}
          unit="pozos"
          context="Con producción positiva"
          comparisons={<Comparisons metric={wells} period={period} />}
          tooltip={`Pozos únicos con producción positiva de ${fluid === "oil" ? "petróleo" : "gas"} durante ${periodTitle(period)}. YoY y MoM comparan esta cantidad de pozos; no tasas ni volumen. Base ausente o cero: sin comparador.`}
          onDetail={() => onNavigate("activity")}
        />
        <KpiCard
          label={
            monetary ? "Precio de referencia Brent" : "Valor bruto estimado"
          }
          value={monetary ? display(fourth.value, 2) : compact(fourth.value)}
          unit={
            fourth.value == null ? undefined : monetary ? "USD/bbl" : "M USD"
          }
          context={
            monetary
              ? "Promedio mensual · EIA"
              : fourth.value == null
                ? "Estimación pendiente"
                : "A precio Brent · estimación"
          }
          comparisons={<Comparisons metric={fourth} period={period} />}
          tooltip={
            monetary
              ? `Europe Brent Spot Price FOB. Promedio mensual en USD/bbl, EIA (${prices?.source.source_updated_at}). YoY/MoM comparan precios. ${estimationNote}`
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
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </>
  );
}

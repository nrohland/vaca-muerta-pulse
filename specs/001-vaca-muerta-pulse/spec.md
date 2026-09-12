# Spec 001 — Barrilito

- **Estado:** Activa
- **Marca (UI / copy):** **Barrilito**. **Repo GitHub:** `vaca-muerta-pulse` (no se renombra).
- **Hito actual del repo:** 2 cerrado en warehouse (marts Barrilito + empresa/área). Next = Hito 3. Spike de portada: `apps/spike/` (ADR 0002).
- **Plan:** [plan.md](plan.md) · **Granos:** [data-model.md](data-model.md) · **Tasks:** [tasks.md](tasks.md)

## Problema

Argentina publica el **Capítulo IV** (producción de petróleo y gas por pozo) como datos abiertos de la Secretaría de Energía. El dataset es el mejor recorte público de **no convencional** en **Vaca Muerta**, pero no es un producto:

- La unidad de análisis (pozo-mes, a veces por formación) no está explicada para un lector no-upstream.
- Petróleo/agua en m³ y gas en miles de m³ conviven sin narrativa.
- Completaciones (fracturas / intervenciones) viven en **otro** recurso del mismo portal (Adjunto IV) y casi nunca se cruzan en una historia única (“producción sube porque se fracturó más”). Rigs, Brent, exportaciones y oleoductos **tampoco** están en el anual de producción: o son datasets SESCO hermanos, o son enriquecimiento / seed, o no hay source público.
- Las herramientas oficiales sirven para consultar un área o un pozo, no para una portada: *qué empresas, qué áreas, qué ritmo de actividad*.
- El dato oficial es **mensual**. No hay telemetría pública de barriles por segundo.

**Barrilito** existe para convertir esa materia prima en un **dashboard público de storytelling**. La portada es un contador de barriles que *parece* extrayéndose en tiempo real — y dice la verdad: es una **simulación honesta** interpolada desde la tasa del último mes de Capítulo IV, no un sensor.

El identificador técnico del repo sigue siendo `vaca-muerta-pulse`.

## Relato de producto (P0)

| Capa | Qué es | Qué no es |
| --- | --- | --- |
| Marca | **Barrilito** en UI y copy | Renombrar el repo |
| Headline | Contador de barriles “extrayéndose” con aspecto live | Telemetría de pozo / SCADA / alta frecuencia |
| Verdad del dato | Capítulo IV **mensual** oficial | Un feed intradía de Secretaría de Energía |
| Tasa | Mart: **bbl/día de cuenca** = `sum(prod_pet_m3) / días del mes` del último mes Cap. IV | Productividad `sum/sum(tef)` como headline; sensores |
| Front | Interpola esa tasa en el contador | Afirmar “producción en este segundo” sin disclaimer |
| Disclaimer **MUST** | Texto visible: *simulación a partir de datos mensuales oficiales* | Disclaimer solo en un footer escondido o en el README |

Extract Meltano (Hito 1, owner DE) permanece **mensual**. No hay claim de alta frecuencia en spec, plan ni UI.

## Usuarios

| Usuario | Qué necesita | Qué no |
| --- | --- | --- |
| Ciudadanía / prensa | Contador Barrilito + series claras, empresas, áreas, español; disclaimer visible | Creer que hay un sensor en cada pozo; export masivo ni API estable v1 |
| Analista energético amateur / estudiante | Grano honesto (mes), unidades (m³ y bbl), filtro no convencional | Reemplazo de un modelo de reservoir |
| Recruiter / peer de datos | Ver DE + AE + Front + SDD en un repo, con honestidad del “live” | Un notebook único sin warehouse; un fake de real-time |
| Contributor (DE/AE/Front/QA) | Specs y owners por folder | Specs implícitas en issues sueltos |

No hay usuario “operadora con datos privados” ni “trader con latencia intradía”.

## Requisitos

Prioridad **P0** = Hitos 1–3. **P1** = después, sin bloquear Barrilito v1.

### Datos (P0)

- R1. Ingerir producción Capítulo IV hacia BigQuery **raw** de forma reproducible (Meltano), con cadencia **mensual**.
- R2. Tablas de hechos particionadas y clustered según [architecture.md](../../docs/architecture.md).
- R3. Poder filtrar el recorte de producto: Vaca Muerta no convencional (`formacion = 'vaca muerta'` y `tipo_de_recurso = 'NO CONVENCIONAL'` en sample 2025; filtro en stg).
- R4. Exponer granos de [data-model.md](data-model.md): pozo-mes, empresa, área; completaciones si el source existe; **más** el mart de tasa Barrilito (Hito 2).
- R5. Conversión de petróleo **en marts y en YAML de métricas dbt**, no en el tap: `bbl = m³ × 6.28981077`. El mismo factor en SQL y en metrics YAML. No inventar sensores ni un segundo número mágico.

### Producto / UI (P0, Hito 3)

- R6. **Headline Barrilito:** contador interpolado de barriles “extrayéndose” a partir de la tasa **de cuenca** `bbl/día` del mart (`sum(prod_pet_m3) / days_in_month` del último mes Cap. IV). Aspecto live; verdad mensual. No usar `sum/sum(tef)` como ritmo de portada.
- R6b. El disclaimer **MUST** está a la vista junto al contador (no solo en un about): *simulación a partir de datos mensuales oficiales*.
- R7. KPIs del último período disponible (producción petróleo/gas, pozos activos o equivalente) **además** del headline; serie temporal (cuenca VM / no convencional) y ranking de empresas.
- R8. Vista de área (concesión / yacimiento — **elegir un grano de área** cuando se cierre el UNKNOWN).
- R9. Vista de completaciones **si** hay source; source Adjunto IV **encontrado** (Hito 1, no cargado en el job default). Si el mart no está, la UI dice “sin dato”.
- R10. Copy en español; números con unidad visible. Petróleo del headline en **bbl**; m³ disponible en otras vistas / tooltip.

### Ingeniería (P0)

- R11. Sin secretos en git; IAM mínimo.
- R12. Costo de demo compatible con free/cheap-tier (partitions, no scan de 2006–hoy en cada page load).
- R13. SDD: este folder es la verdad de alcance. Un cambio de marca, grano de tasa o disclaimer actualiza esta spec **antes** del código de UI/dbt.

### P1 (explícito, no ahora)

- API pública versionada, auth, mapas GIS pesados, cuenca extra, alertas Slack, dbt Cloud, i18n inglés de UI, desglose Barrilito por empresa como headline.
- **Fuentes hermanas SE / enriquecimiento** (cada una pide spec/ADR + Meltano **antes** de un KPI en UI). Catálogo y evidencia CKAN: [data-model.md](data-model.md) § Fuentes hermanas. No entran en Hito 3.
  - Adjunto IV → `fct_completions` (R9; resource ya en el tap, job aparte).
  - Perforación SESCO → actividad mensual de pozos en perforación (proxy, **no** rigs live).
  - Comercio exterior SESCO → volúmenes / destinos (recorte nacional; no es VM-only).
  - Seed de capacidad midstream (Oldelval / Otasa) con URL + fecha de cita, contrastada a producción Cap. IV.
  - Brent u otra serie macro **como tap de enriquecimiento documentado**, no como columna de Capítulo IV.

## Mapa de fuentes (Capítulo IV vs hermanas)

La portada v1 **solo** afirma lo que sale de Capítulo IV (producción pozo-mes) y de marts derivados. Nación publica **más** en el mismo portal, bajo normativas hermanas. Eso **no** autoriza a pintar el número como “dato Cap. IV”.

| Tema | ¿Dónde vive de verdad? | v1 / Hito 3 | Cómo se puede decir en UI |
| --- | --- | --- | --- |
| Producción pozo-mes, empresas, áreas, Barrilito | Capítulo IV (job Meltano default) | **In-scope** | Oficial SE, mensual |
| Etapas de fractura, arena, agua | [Adjunto IV](https://datos.gob.ar/dataset/energia-datos-fractura-pozos-hidrocarburos-adjunto-iv) | Source **encontrado**, no cargado | Empty state, o mart cuando haya load |
| Pozos en perforación (mensual) | [Perforación de pozos](https://datos.energia.gob.ar/dataset/perforacion-de-pozos-de-petroleo-y-gas) | P1 | “Pozos en perforación, SESCO mensual” — **nunca** “rigs activos ahora” |
| Rigs live (NCS / IAPG / EconoJournal) | Consultoras / prensa de nicho | **No-goal** | No es dato abierto de producto |
| Destinos / volúmenes de comercio | SESCO Comercio exterior (`ea145b70-…`); no el anual de producción | P1 | “Comercio exterior SE”, no Cap. IV |
| Oferta de crudo a destilería / terceros / stock | [Distribución de petróleo](https://datos.energia.gob.ar/dataset/distribucion-de-petroleo) | P1 | Offtake de yacimiento, **no** país de destino |
| Traza de oleoductos | Ductos Res. 319/93 (GIS anual) | P1 / mapa | Geometría DDJJ, **no** bbl/día de capacidad |
| Capacidad nominal Oldelval / Otasa | Comunicados de concesionarias | P1 seed citada | Constante con URL+fecha vs producción Cap. IV |
| Brent (`BZ=F` / API financiera) | Mercado internacional | P1 enriquecimiento | “Contexto macro, no Secretaría de Energía” |
| Breakeven USD/bbl | No hay serie pública reproducible | **Fuera** | No se muestra como KPI |

IDs, totales Datastore y caveats: [data-model.md](data-model.md) · [`extraction/resources/sibling-sources.yml`](../../extraction/resources/sibling-sources.yml).

## No-goals (v1)

- Telemetría de pozo, SCADA, o **afirmar** que Capítulo IV es tiempo real / intradía / alta frecuencia.
- Extraer Cap. IV con schedule distinto de **mensual** (no tocar `meltano.yml` en un PR de producto).
- Presentar Adjunto IV, perforación, comercio exterior, ductos, Brent o capacidad midstream **como si fueran columnas de Capítulo IV**.
- Rigs “en tiempo real” (NCS, IAPG, EconoJournal, Shale24) como source del warehouse o de un KPI sin disclaimer de prensa.
- **Breakeven** (ni “margen” Brent − 35 USD). No hay DDJJ ni CKAN que lo publique; se deja **fuera del análisis**.
- Fiscal, royalties, reservas.
- Brent / Yahoo / Alpha Vantage **en el Front** sin tap + spec (el peer pregunta de dónde salió).
- Optimización de fractura o geología de pozo (lateral length, etc.) salvo que el CSV de completaciones lo traiga **y** entre en el data-model.
- Reemplazar el [reporte avanzado de SE](https://www.se.gob.ar/datosupstream/consulta_avanzada/reporte.php).
- Ingesta de todas las cuencas como producto (raw puede ser amplio; Barrilito filtra).
- App móvil nativa.
- Implementar Next en el mismo PR que dbt (Hito 3 es aparte).

La simulación interpolada del contador **sí** está in-scope. Lo que está fuera es presentarla como medición en vivo.

## Métricas de éxito

| Señal | Target v1 (draft) |
| --- | --- |
| Tiempo a insight | En la portada se ve el contador Barrilito y se entiende el recorte VM no conv. sin SQL |
| Honestidad del live | Disclaimer *simulación a partir de datos mensuales oficiales* visible; cero copy que afirme sensores o alta frecuencia |
| Frescura | Load ≤ 7 días de un archivo Capítulo IV nuevo (proceso documentado; no 24/7) |
| Cobertura | Marts de producción pozo-mes + mart de tasa Barrilito (`bbl/día`); % de filas droppeadas documentado |
| Honestidad de fuentes | Cero KPI de rigs/Brent/export/capacidad/breakeven pintado como Capítulo IV; empty state o cita de source hermana |
| Costo BQ | Un recorrido típico del dashboard << 1 TiB/mes; alerta de presupuesto en GCP |
| Completaciones | Cero gráficos de completaciones sin source; UNKNOWNs visibles en data-model |
| Portfolio | Un peer recorre README → spec → architecture sin preguntar “dónde está el código” ni “¿esto es real-time de verdad?” |

Métricas de vanidad (stars, pageviews) no son DoD del Hito 3.

## Fuera de esta spec

Stack (Meltano vs Airbyte, etc.): [ADR 0001](../../docs/adrs/0001-stack-choices.md). Cortes de entrega: [plan.md](plan.md). Fórmula de la tasa: [data-model.md](data-model.md) (sección Barrilito).

# Data model — Spec 001

Granos para **Barrilito** (repo `vaca-muerta-pulse`). Raw Meltano = Hito 1 (`extraction/`). Marts dbt = Hito 2. Headline UI = Hito 3.

Leyenda:

- **CONFIRMED** = visto en CKAN DataStore (recurso 2025 `d774b5d7-0756-48fe-88f2-8729b57b22da` salvo que se indique otro). Dump: [`extraction/catalogs/`](../../extraction/catalogs/).
- **DRAFT** = diseño de producto; falta evidencia en warehouse / dbt.
- **UNKNOWN** = no afirmar. Cerrar en Hito 2 con tests sobre más años o marcar no-goal.

Nombres de marts (`fct_*`, `dim_*`) siguen **DRAFT** salvo los publicados en Hito 2: **`fct_barrilito_rate`**, **`fct_well_month`**, **`fct_company_month`**, **`dim_company`**, **`fct_area_month`**, **`dim_area`**, **`fct_completions`**, **`fct_completions_month`**. El alias `mart_barrilito_headline` no se usa.

Datasets físicos dbt (dev, US, Hito 2 IAM): `stg_cap4_dev` / `int_cap4_dev` / `marts_cap4_dev`. Source raw Hito 2: `raw_cap4_dev`. Detalle: [transform/docs/hito-2-bq-iam.md](../../transform/docs/hito-2-bq-iam.md).

## Fuentes

| Recurso | Uso | Estado |
| --- | --- | --- |
| Producción pozo-mes anual, CKAN DataStore / CSV | Hecho pozo-mes | **CONFIRMED.** Package `produccion-de-petroleo-y-gas-por-pozo`. Default 2025: `d774b5d7-0756-48fe-88f2-8729b57b22da` (total Datastore 991 844 al 2026-09-10). IDs por año: [`extraction/resources/cap4.yml`](../../extraction/resources/cap4.yml) |
| Capítulo IV - Pozos `cb5c0f04-7835-45cd-b982-3e25ca7d7751` | Dim pozo + geojson | **CONFIRMED que existe.** No está en el `meltano run` default (Hito 1). Coords **no** vienen en el anual de producción |
| Padrón primera producción `5578dd48-…` | `(idpozo, anio, mes)` | **CONFIRMED** schema mínimo; no es dim completa |
| Fracturas Adjunto IV `2280ad92-6ed3-403e-a095-50139863ab0d` | Hecho de actividad | **CONFIRMED resource + load.** ~4890 filas. Job Meltano `cap4-fracturas` (no el default de producción) |
| Consulta avanzada SE (HTML) | No es source de Meltano | Fuera de diseño |

Dataset portal: [energia-produccion-petroleo-gas-por-pozo-capitulo-iv](https://datos.gob.ar/dataset/energia-produccion-petroleo-gas-por-pozo-capitulo-iv) · origen [datos.energia.gob.ar](https://datos.energia.gob.ar/dataset/produccion-de-petroleo-y-gas-por-pozo).

**Cuidado:** hay clones “con identificador” (p.ej. 2025 `6f9f63bd-…`) con Datastore **truncado** (~90k). No usarlos como extract del año.

### Fuentes hermanas (Nación / SE; **no** Capítulo IV)

Harvest 2026-09-11. IDs: [`extraction/resources/sibling-sources.yml`](../../extraction/resources/sibling-sources.yml). Adjunto IV entra por el job **aparte** `cap4-fracturas`. El resto **no** está en Meltano. Un KPI de estos temas en UI exige load (o seed citada) **y** copy del source real. Relato de producto: [spec.md](spec.md) § Mapa de fuentes.

| Recurso | Qué es | Qué no es | Estado v1 |
| --- | --- | --- | --- |
| Adjunto IV `2280ad92-…` (~4890 filas). `cantidad_fracturas`, `arena_bombeada_*_tn`, `agua_inyectada_m3` | Etapas / insumos de fractura por pozo (fechas `fecha_inicio_fractura`) | Producción; rigs | Resource CONFIRMED; **cargado** (`cap4-fracturas` / loader Python). Grano 4 |
| [Perforación de pozos](https://datos.energia.gob.ar/dataset/perforacion-de-pozos-de-petroleo-gas) `af6838ef-…` “Pozos en Perforación” (477 446 filas). Grano `empresa × área × concepto × anio/mes`, campo `cantidad` | Conteo **mensual** SESCO de pozos en perforación (sample 2025 Neuquina: conceptos Explotación / Servicio) | Rigs activos intradía; Baker Hughes / NCS / IAPG | Package CONFIRMED. P1. Copy prohibida: “rigs ahora” |
| [Distribución de petróleo](https://datos.energia.gob.ar/dataset/distribucion-de-petroleo) `d9948c4a-…` (104 628). Conceptos CONFIRMED: *A Propias Destilerías*, *Entregado a Terceros*, *Stock en Yacimiento* (m³) | Offtake SESCO desde yacimiento | País de destino de exportación | Package CONFIRMED. P1 |
| Comercio exterior `ea145b70-…` “Importaciones / Exportaciones a partir del 2016” (1 378 842). Campos: `tipodecomercializacion` (`Exportación` / `Importación`), `producto`, `cantidad`, `monto`, `pais`, `empresa`, mes | Volúmenes y destinos **nacionales** (sample 2025 exp. con cantidad≠0: Chile, Paraguay, Brasil, EE.UU., …). Productos mezclan crudos por cuenca (`Cuenca Neuquina - Neuquen (Medanito)(m3)`) y combustibles | Recorte Pulse / Cap. IV; Brent | Resource CONFIRMED DataStore. P1. Join a VM = UNKNOWN |
| [Precios de comercio exterior](https://datos.energia.gob.ar/dataset/precios-de-comercio-exterior2) | ZIP (USD / miles m³ / Tn por empresa y país) | DataStore listo para el tap actual | Package CONFIRMED; formato ZIP. P1 |
| [Precio de exportación de crudo](https://datos.energia.gob.ar/dataset/precio-de-exportacion-de-petroleo-crudo) XLSX `605580fd-…` | Precio oficial de export de crudo argentino | Brent internacional | CONFIRMED file; sin DataStore |
| [Ductos Res. 319/93](https://datos.energia.gob.ar/dataset/instalaciones-hidrocarburos-ductos-res--319-93) CSV `857bd3ad-…` + SHP EPSG:4326 | Geometría anual de oleoductos / gasoductos (DDJJ Planos Base) | Capacidad nominal bbl/día Oldelval / Otasa | Package CONFIRMED. `datastore_search` 404 el 2026-09-11. P1 mapa |
| Comunicados Oldelval / Otasa | Capacidad **constante** de un tramo (seed con URL + fecha) | Serie oficial CKAN; telemetría de flujo | Solo seed citada, nunca “dato Cap. IV” |
| Yahoo `BZ=F` / Alpha Vantage / EIA | Enriquecimiento macro (Brent) | Secretaría de Energía | P1 con spec/ADR de tap. Copy: contexto global |
| NCS / IAPG / EconoJournal / Shale24 | Prensa o consultora | Dato abierto de producto | **No-goal** |
| Breakeven USD/bbl | — | No hay serie pública reproducible | **Fuera del análisis** (spec) |

**Cuidado perforación ≠ rigs:** filtrar “fecha de inicio de perforación de pozos nuevos” **no** produce un conteo Baker Hughes. El recurso usable hoy es `cantidad` mensual de pozos en perforación. Un número “rigs activos a mayo 2026” de un medio de nicho **no** entra al warehouse.

**Cuidado distribución ≠ exportación:** los tres `concepto` de `d9948c4a-…` son destilería propia / terceros / stock. Destinos de país están en comercio exterior (`pais`), no en distribución.

### Campos de producción (CONFIRMED en DataStore 2025)

| Campo | Significado | Unidad / tipo CKAN |
| --- | --- | --- |
| `idpozo` | Pozo por formación productiva | integer |
| `sigla` | Identificador de boca | text |
| `anio`, `mes` | Período de la DDJJ | integer |
| `periodo` | Primer día del mes (lo agrega el tap) | DATE `YYYY-MM-01` |
| `prod_pet` | Petróleo | m³ |
| `prod_gas` | Gas | miles de m³ |
| `prod_agua` | Agua | m³ |
| `iny_agua`, `iny_gas`, `iny_co2`, `iny_otro` | Inyecciones | raw sí; marts de storytelling no (salvo agua de producción) |
| `tef` | Tiempo efectivo | **CONFIRMED plausible días** en el recorte Pulse 2025 (warehouse: 0 nulls, min 0, max 31.0, 6115 ceros / 27936 > 0 de 34051 well-months). Cast explícito en Hito 2. Definición oficial / otros años = UNKNOWN |
| `vida_util` | | numeric; uso Pulse = UNKNOWN |
| `empresa`, `idempresa` | Quién declara | text |
| `formprod` | Código formación productiva (p.ej. `PROS`, `FIMP`) | text |
| `formacion` | Nombre formación | text, **minúsculas** en sample (`vaca muerta`) |
| `tipo_de_recurso` | | `CONVENCIONAL` / `NO CONVENCIONAL` / `SIN RESERVORIO` / `NO DISCRIMINADO` |
| `sub_tipo_recurso` | | `SHALE` / `TIGHT` / `''` |
| `cuenca`, `provincia` | Geo admin | text (`NEUQUINA`, …) |
| `idareapermisoconcesion`, `areapermisoconcesion` | Área permiso/concesión | text |
| `idareayacimiento`, `areayacimiento` | Yacimiento | text |
| `tipopozo`, `tipoestado`, `tipoextraccion` | | text |
| `clasificacion`, `subclasificacion`, `proyecto` | | text |
| `profundidad` | | numeric |
| `rectificado`, `habilitado` | flags `t`/`f` | text. 2025: 92 rectificado=`t` vs 991 752 `f` |
| `fechaingreso`, `fecha_data` | timestamps | |
| `observaciones`, `idusuario` | | no van a marts de portada |

No aparece `areahabilitada` en este schema. No aparecen `coordenadax`/`coordenaday` en el anual 2025 (sí en el extract pre-filtrado no-conv `b5b58cdc-…`).

**Clave:** en 2025, `idpozo × anio × mes` tiene **0 duplicados** (query `datastore_search_sql`). Incluir `formprod` no cambia nada: 0 dupes también. **UNKNOWN** si vale para 2006–2024/2026 — test dbt Hito 2.

## Recorte de producto (CONFIRMED strings; filtro en stg)

Incluir filas donde:

- `formacion = 'vaca muerta'` (literal minúsculas; `VACA MUERTA` / `Vaca Muerta` → 0 filas en 2025)
- **y** `tipo_de_recurso = 'NO CONVENCIONAL'`

Conteos 2025 (Datastore SQL):

| sub_tipo_recurso | n |
| --- | --- |
| SHALE | 33 991 |
| TIGHT | 36 |
| `''` | 24 |

Hay 2774 filas `formacion='vaca muerta'` **CONVENCIONAL** — **fuera** del Pulse v1.

Tight no-VM: no-goal (spec). El raw carga **todas las cuencas/años del resource**; el filtro vive en `stg`/`int`.

## Grano 1 — Pozo-mes (producción)

**Nombre (contrato Hito 2):** `fct_well_month`  
**Grano:** una fila = `idpozo` × `anio` × `mes` (CONFIRMED único en 2025).

| | |
| --- | --- |
| Clave | **CONFIRMED 2025:** `idpozo + anio + mes`. UNKNOWN otros años |
| Medidas | `prod_pet`, `prod_gas`, `prod_agua`, `tef` (+ inyecciones en raw) |
| Dims | `empresa` / `idempresa`, `areapermisoconcesion`, `areayacimiento`, `cuenca`, `tipo_de_recurso`, coords solo vía tap pozos |
| Partition raw | **CONFIRMED (loader):** `PARTITION BY TIMESTAMP_TRUNC(_sdc_batched_at, MONTH)` — instante de batch Meltano, **no** el mes de producción |
| Cluster raw | `empresa`, `idpozo`, `cuenca` — cableado en Meltano |
| Grano de negocio | **`periodo`** (DATE `YYYY-MM-01`, lo agrega el tap). `stg` **materializa** `periodo` para filtros/agregados. No usar `_sdc_batched_at` como mes Cap. IV |
| Partition mart `fct_well_month` | **No** `PARTITION BY periodo` en sandbox: el cap de 60 días expira particiones cuya fecha de columna es el mes Cap. IV 2025, y la tabla queda en 0 filas al materializar. Cluster `idempresa, idpozo`. Revisitar partition-by-periodo con billing. |

**Re-emit / rectificativas:** snapshot anual. Prod: `DELETE WHERE anio=@year` + append. Staging **dedupea** `idpozo+anio+mes` (2025 tenía 0 dupes; otros años UNKNOWN): prioriza `rectificado = t`, luego el batch Singer más reciente. El último mes Cap. IV (input de Barrilito) puede **reexpresarse** en un load posterior.

## Grano 2 — Empresa

**Nombre (contrato Hito 2 P1):** `fct_company_month` + `dim_company`  
**Grano:** empresa × mes, suma del recorte Pulse (VM no conv.).

| | |
| --- | --- |
| Clave empresa | **CONFIRMED** `idempresa` + texto `empresa`. Warehouse 2025 Pulse: **24** ids, 1:1 con nombres (0 `idempresa` con más de un string). Estabilidad temporal / operador ≠ titular = UNKNOWN (sin GLEIF; solo 2025 cargado) |
| Clave hecho | `idempresa` × `periodo` (DATE `YYYY-MM-01`). **Sparse:** hay fila solo si el operador tiene al menos un well-month ese mes (no hay date spine ni ceros inventados). Dim = 24 ids en 2025; dic-2025 = 22 company-months |
| Medidas | `prod_pet_m3` / `prod_gas_km3` / `prod_agua_m3`, `tef_sum`, `well_count`, `wells_with_oil` (distinct `idpozo` con petróleo > 0 ese mes). **UNKNOWN** pozos nuevos (no hay padrón de primera producción en el DAG) |
| Source | Solo `fct_well_month`. Front no lee `raw_*` |
| Partition / cluster | **No** `PARTITION BY periodo` en sandbox (mismo cap 60d). Cluster `idempresa` |

`dim_company` = DISTINCT `idempresa` del hecho (`any_value(empresa)`). Test singular falla si un id mapea a más de un nombre.

## Grano 3 — Área

**Nombre (contrato Hito 2 P1):** `fct_area_month` + `dim_area`

Columna `areahabilitada`: **no está** en el anual 2025.

Candidatos que **sí** existen:

1. `areapermisoconcesion` / `idareapermisoconcesion` — **preferido** (columnas CONFIRMED; mart P1 usa este par)
2. `areayacimiento` / `idareayacimiento` — drill-down (no es este mart)

Estabilidad de ids entre años = UNKNOWN (solo 2025 cargado).

| | |
| --- | --- |
| Clave hecho | `idareapermisoconcesion` × `periodo`. Sparse como empresa-mes (981 area-months en 2025 vs 83×12 = 996) |
| Warehouse 2025 Pulse | **83** áreas, 1:1 id/nombre (0 ids con más de un string; 0 blanks) |
| Medidas | mismas sumas que empresa-mes (`prod_*`, `tef_sum`, `well_count`, `wells_with_oil`) + `company_count` |
| Source | Solo `fct_well_month` |
| Partition / cluster | **No** `PARTITION BY periodo` en sandbox. Cluster `idareapermisoconcesion` |

## Grano 4 — Completaciones

**Nombre (contrato):** `fct_completions` (job) + `fct_completions_month` (mes de `fecha_inicio`)  
**Source CONFIRMED:** Adjunto IV `2280ad92-6ed3-403e-a095-50139863ab0d`.

| | |
| --- | --- |
| Grano | Una fila por `id_base_fractura_adjiv` (job). `cantidad_fracturas` = etapas (CONFIRMED en sample) |
| Join a producción | `idpozo` y `sigla` presentes. Calidad del join = **UNKNOWN** (sin test `relationships` a `fct_well_month`) |
| Arena / agua / presión | `arena_bombeada_*_tn`, `agua_inyectada_m3`, `presion_maxima_psi`, `longitud_rama_horizontal_m` CONFIRMED en schema |
| Fechas | `fecha_inicio_fractura`, `fecha_fin_fractura`. Mart DATE `fecha_inicio` = start. `anio`/`mes`/`periodo` del source pueden ser carga — **no** son el mes de fractura |
| Formación | `formacion_productiva` = `vaca muerta` (minúsculas, CONFIRMED). Recorte Pulse: **y** `tipo_reservorio = 'NO CONVENCIONAL'` (excluye VM CONVENCIONAL / NO DISCRIMINADO, igual que producción) |
| Partition / cluster | **No** `PARTITION BY fecha_inicio` en sandbox. Raw: MONTH(`_sdc_batched_at`) + CLUSTER `idpozo, cuenca, empresa_informante`. Mart: cluster `idpozo` |
| Warehouse 2026-09-12 | Raw **4890**; Pulse stg / `fct_completions` **2999** (2995 SHALE + 2 TIGHT + 2 blank); `fct_completions_month` **176** meses, **105 345** etapas (`2011-12` → `2026-12`). Load job `b7361833-12c9-453e-889a-746ef97008f8`. Evidencia: [extraction/docs/hito-2-adjunto-iv-load.md](../../extraction/docs/hito-2-adjunto-iv-load.md) |

Job Meltano default (`cap4-produccion`) **sigue** deseleccionando el stream. Load = job **`cap4-fracturas`** (o `scripts/load_fracturas_datastore.py` si no hay SA Meltano). Hito 3 lee estos marts; copy MUST Adjunto IV.

## Grano 5 — Barrilito / headline rate (contrato Hito 2)

Contrato para el contador de portada. **No hay sensores.** La tasa sale del último mes oficial de Capítulo IV (~últimos 30 días de DDJJ), no de telemetría.

**Nombre (contrato Hito 2):** `fct_barrilito_rate`  
**Alias retirado:** `mart_barrilito_headline` — no existe en YAML ni en BQ.

**Grano:** una fila = **un snapshot de producto** para el **último mes Capítulo IV** disponible, agregado al recorte Pulse (**total Vaca Muerta no convencional**, no por empresa ni por pozo). El ranking por `idempresa` / área vive en `fct_company_month` / `fct_area_month`, no en este mart.

| | |
| --- | --- |
| Clave | `periodo` del último mes Cap. IV (una fila). Sin surrogate `as_of_date` (no hizo falta). |
| Recorte | Mismo filtro que el resto del Pulse: `formacion = 'vaca muerta'` y `tipo_de_recurso = 'NO CONVENCIONAL'` (en `stg_produccion_pozo_mes`) |
| Medidas | `prod_pet_m3` (suma), `tef_sum`, `days_in_month`, `rate_m3_dia` / `rate_bbl_dia` (**cuenca** / `days_in_month`), `productivity_m3_dia` / `productivity_bbl_dia` (`sum/sum(tef)`, no headline), `rate_method=calendar_days`, frescura, `disclaimer` |
| Partition / cluster | Mart chico (una fila o histórico mensual corto). No heredar la partición raw `_sdc_batched_at` como grano |

### Fórmula (tasa diaria)

Cap. IV trae petróleo en **m³** al mes (source `prod_pet`; en stg/marts: `prod_pet_m3`). Se busca una tasa **por día de cuenca** para que el Front interpole el contador.

**Headline Barrilito** (siempre; `rate_method = calendar_days`):

```text
rate_m3_dia = sum(prod_pet_m3) / days_in_month(periodo)
```

Es la producción declarada del recorte Pulse **dividida por los días calendario del mes**. Dic-2025 Pulse (~2.91e6 m³ / 31) ≈ **590 000 bbl/día**. Eso es el orden de magnitud de “Vaca Muerta produce ~600k bbl/día”, no un promedio por pozo.

**Productividad** (KPI aparte; **no** es el headline):

```text
productivity_m3_dia = sum(prod_pet_m3) / nullif(sum(tef), 0)
```

`tef` *parece* días por pozo (warehouse Pulse 2025: 0 nulls, min 0, max 31.0). `sum(prod)/sum(tef)` ≈ **260 bbl/día por pozo-día** en dic-2025. El spike v1 (`apps/spike/barrilito_spike.ipynb`) usó esta cifra como portada por error. Definición oficial de `tef` / otros años = **UNKNOWN**.

**Conversión (factor fijo; el mismo en SQL y en YAML de métricas dbt):**

```text
bbl = m³ × 6.28981077
rate_bbl_dia = rate_m3_dia × 6.28981077
```

El Front **no** recalcula el factor. El mart expone `rate_bbl_dia` (cuenca) y `productivity_bbl_dia` (pozo-día). `rate_method`: `calendar_days`.

| Método | Estado | Por qué |
| --- | --- | --- |
| `sum(prod_pet_m3) / days_in_month` | **Headline**, cableado (`calendar_days`) | Ritmo de cuenca comparable a cifras públicas (~600k bbl/día) |
| `sum(prod_pet_m3) / nullif(sum(tef), 0)` | Columna `productivity_*`, no Barrilito | Productividad media por pozo-día; el spike v1 la usó mal como portada |
| Sensores / SCADA / grano horario | **Fuera de diseño** | Cap. IV no lo publica |

### Caveats (no promover a CONFIRMED)

- **Grano mensual:** último `periodo` de Capítulo IV, no 30 días móviles de telemetría. Copy: **último mes oficial**.
- **`tef` = 0:** no cambia el headline (el denominador es `days_in_month`). Sí anula `productivity_*` si `tef_sum = 0`. Warehouse 2025 Pulse: **6115** well-months con `tef = 0` (de 34051).
- **Rectificativas / re-emit:** el último mes puede corregirse en un load posterior. El contador sigue al mart, no a un cache eterno.
- **Partición raw vs negocio:** filtrar el mes de producción por `periodo` (stg), nunca por `_sdc_batched_at`.
- **Agregado total:** el headline no es “Barrilito por empresa” ni “por pozo”. Sumar el recorte Pulse entero y dividir por **días del mes**.
- **Productividad ≠ portada:** `sum/sum(tef)` ~260 bbl/pozo-día en dic-2025. No interpolar el contador con esa cifra.

## Dimensión pozo

**DRAFT `dim_well`:** de producción: `sigla`, `idpozo`, `profundidad`, `tipopozo`. Primera producción: recurso `5578dd48-…`. Coords: `capitulo_iv_pozos.geojson` (EPSG:4326). Validar un punto en Neuquén antes de GIS (Hito 2/3). El anual 2025 **no** trae `coordenadax`/`coordenaday`.

## Unidades (CONFIRMED en catálogo y sample; headline decidido)

Factor petróleo (constante de producto; **el mismo** en marts SQL y en YAML de métricas dbt Hito 2):

```text
bbl = m³ × 6.28981077
```

| Fluido | Source | Marts / UI |
| --- | --- | --- |
| Petróleo | m³ | Headline **Barrilito** default **bbl**. Marts también exponen m³ (tooltip, series, rankings). No un segundo factor. |
| Gas | miles de m³ | miles de m³ |
| Agua | m³ | m³ |

No convertir en Meltano. No convertir en el browser salvo leer `rate_bbl_dia` ya convertida.

## Relación entre granos (DRAFT)

```mermaid
erDiagram
  DIM_WELL ||--o{ FCT_WELL_MONTH : "idpozo CONFIRMED 2025"
  DIM_COMPANY ||--o{ FCT_WELL_MONTH : "idempresa o empresa"
  DIM_AREA ||--o{ FCT_WELL_MONTH : "areapermisoconcesion preferido"
  FCT_WELL_MONTH }o--|| FCT_COMPANY_MONTH : "suma"
  FCT_WELL_MONTH }o--|| FCT_AREA_MONTH : "suma"
  FCT_WELL_MONTH }o--|| FCT_BARRILITO_RATE : "agregado ultimo mes Cap IV"
  DIM_WELL ||--o{ FCT_COMPLETIONS : "idpozo / sigla"
```

Agregados empresa/área deben **reconciliar** con la suma del pozo-mes del mismo filtro (test dbt Hito 2). `fct_barrilito_rate` debe reconciliar `prod_pet_m3` con esa misma suma del último `periodo` (mismo recorte).

## Lo que este archivo no es

- No es un diccionario completo de Capítulo IV.
- No autoriza a inventar `well_id` surrogate opaco sin publicar la regla.
- No autoriza sensores ni un grano intradía para el contador Barrilito.
- No autoriza a etiquetar Adjunto IV, SESCO perforación/comercio/ductos, Brent o capacidad midstream como “Capítulo IV”.
- No autoriza breakeven ni rigs live como hecho.
- Cualquier cierre de UNKNOWN se hace **editando este archivo** en el PR que lo descubrió.

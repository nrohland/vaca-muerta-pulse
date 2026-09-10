# Barrilito

Dashboard público de **storytelling** sobre producción y completaciones no convencionales en **Vaca Muerta** (Cuenca Neuquina, Argentina), a partir de los datos abiertos del **Capítulo IV** de la Secretaría de Energía.

**Marca (UI / copy):** Barrilito. **Repo:** [`vaca-muerta-pulse`](https://github.com/nrohland/vaca-muerta-pulse) — el identificador GitHub **no** cambia.

Este repo es un **data product** de portfolio, **spec-driven**: primero specs y ADRs, después Meltano / dbt / Next.

> **Hito 1 (este árbol):** Meltano en [`extraction/`](extraction/README.md) → BigQuery `raw_cap4_dev` (año 2025: `COUNT(*)` **991 844**, delta 0). dbt y Next siguen sin implementar. Esta docs setea el relato Barrilito **antes** del código de Hito 2/3.

| Si sos… | Empezá por |
| --- | --- |
| Humano (producto / arquitectura) | este README → [specs/001](specs/001-vaca-muerta-pulse/spec.md) → [docs/architecture.md](docs/architecture.md) |
| Agente de código | [AGENTS.md](AGENTS.md) (orden de lectura obligatorio) |

---

## El contador (qué es y qué no)

La portada de Barrilito es un contador de barriles que *parece* **extrayéndose en tiempo real**.

La verdad: Capítulo IV es **mensual** y oficial. El “live” es una **simulación honesta**: el Front interpola una tasa **bbl/día** calculada en el mart (Hito 2) a partir del último mes Cap. IV / ~últimos 30 días de DDJJ. **No es telemetría** ni un sensor de pozo.

El extract Meltano sigue **mensual** (owner DE). La UI **MUST** mostrar: *simulación a partir de datos mensuales oficiales*.

Petróleo de source = m³. Headline = **bbl**, con `bbl = m³ × 6.28981077` (mismo factor en marts y en YAML de métricas). Detalle: [data-model.md](specs/001-vaca-muerta-pulse/data-model.md).

---

## El problema

Los datos de Capítulo IV son **públicos y ricos**, pero malos para contar una historia:

- CSVs anuales pesados (DDJJ abiertas y cerradas), publicados en [Datos Argentina](https://datos.gob.ar/dataset/energia-produccion-petroleo-gas-por-pozo-capitulo-iv) / CKAN de Energía.
- Grano poco obvio (pozo × mes, a veces por formación productiva).
- Unidades mixtas (petróleo y agua en m³, gas en miles de m³).
- Completaciones / fracturas en **otro** recurso, no siempre alineado al padrón de pozos.
- Consultas oficiales ([reporte avanzado SE](https://www.se.gob.ar/datosupstream/consulta_avanzada/reporte.php)) útiles para un pozo, no para una narrativa de cuenca.
- El dato **no** es alta frecuencia: no hay feed público de barriles por segundo.

Falta un producto que responda en minutos: *¿a qué ritmo se extrae shale en Vaca Muerta, quién produce, dónde, y cómo cambió el último año?* — sin fingir un SCADA.

## Objetivos

1. **Ingesta barata y reproducible** de Capítulo IV hacia BigQuery (particionado + clustered), cadencia **mensual**.
2. **Modelo analítico** (dbt `stg` → `int` → `marts`) con granos explícitos: pozo-mes, empresa, área, completaciones, y tasa Barrilito **bbl/día**.
3. **Dashboard público Barrilito** (Next.js + Tremor): headline = contador interpolado + disclaimer MUST; series y rankings, no un dump de tablas ni un fake de real-time.
4. **Costo** dentro de free/cheap-tier de GCP donde se pueda (on-demand BQ, pocos full scans).
5. **Spec-driven**: cambios grandes actualizan `specs/` y `docs/adrs/` *antes* que el código.

No-goals y métricas de éxito: [spec.md](specs/001-vaca-muerta-pulse/spec.md).

---

## Arquitectura (overview)

Detalle en [docs/architecture.md](docs/architecture.md). Decisión de stack: [ADR 0001](docs/adrs/0001-stack-choices.md).

### Flujo de datos

```mermaid
flowchart LR
  subgraph Fuente["Fuente pública"]
    SE["Secretaría de Energía<br/>Capítulo IV / CKAN"]
  end
  subgraph DE["extraction/ · DE"]
    M["Meltano mensual<br/>tap → target-bigquery"]
  end
  subgraph BQ["GCP BigQuery"]
    RAW["raw_*<br/>PARTITION + CLUSTER"]
    STG["stg"]
    INT["int"]
    MART["marts + tasa bbl/día"]
  end
  subgraph AE["transform/ · AE"]
    DBT["dbt Core"]
  end
  subgraph Front["apps/web · Front"]
    WEB["Barrilito<br/>Next.js + Tremor"]
  end
  SE --> M --> RAW
  RAW --> DBT
  DBT --> STG --> INT --> MART
  MART --> WEB
```

### Layout del repo

El folder Git sigue llamándose `vaca-muerta-pulse`. La marca de producto es Barrilito.

```mermaid
flowchart TB
  R["vaca-muerta-pulse"]
  R --> S["specs/ · producto Barrilito + DoD"]
  R --> D["docs/ · arquitectura + ADRs"]
  R --> E["extraction/ · Meltano · owner DE"]
  R --> T["transform/ · dbt · owner AE"]
  R --> A["apps/web/ · Next + Tremor · owner Front"]
  S --> S1["001-vaca-muerta-pulse/"]
  D --> ADR["adrs/0001-stack-choices.md"]
```

---

## Stack (objetivo)

| Capa | Tecnología | Dónde | Hito |
| --- | --- | --- | --- |
| Specs / docs | Markdown + Mermaid | `specs/`, `docs/` | 0 |
| Ingesta | Meltano (schedule **mensual**) | `extraction/` | **1 (ahora)** |
| Warehouse | BigQuery, `PARTITION` + `CLUSTER` | GCP | 1 |
| Transformación | dbt Core (`stg` → `int` → `marts` + tasa Barrilito) | `transform/` | 2 |
| UI | Next.js + Tremor (marca Barrilito) | `apps/web/` | 3 |
| Costo | GCP free/cheap-tier, on-demand, sin secretos en git | — | 1–3 |

---

## Roadmap

Detalle y criterios de aceptación: [plan.md](specs/001-vaca-muerta-pulse/plan.md).

| Hito | Qué | Código |
| --- | --- | --- |
| **0** Fundación SDD | Specs, ADRs, AGENTS.md, placeholders | mergeado / PR #1 |
| **1** Raw + Meltano | CKAN DataStore → BQ `raw_*` particionado; extract **mensual** | `extraction/` |
| **2** dbt | `stg` → `int` → `marts` + tests + tasa **bbl/día** | `transform/` |
| **3** Dashboard Barrilito | Contador interpolado + disclaimer MUST; Next + Tremor | `apps/web/` |

Checklist: [tasks.md](specs/001-vaca-muerta-pulse/tasks.md). Cómo correr Meltano: [extraction/README.md](extraction/README.md).

---

## Cómo contribuir

1. Leé [AGENTS.md](AGENTS.md) (roles, DoD, secretos) y la spec activa.
2. **SDD:** si el cambio es más que un typo, actualizá `specs/` y/o un ADR *antes* del código.
3. No implementes dbt o Next fuera de su hito (Hito 2 / 3). Meltano ya vive en `extraction/`; no cambies su schedule a sub-diario en un PR de UI.
4. Nunca commitees `.env`, JSON de service accounts, ni CSVs crudos pesados.
5. Un PR = un hito o una historia acotada; el owner del folder (DE / AE / Front) debe poder revisar en aislamiento.
6. QA: aceptar contra los criterios de [plan.md](specs/001-vaca-muerta-pulse/plan.md), no contra “el código corre”. El contador sin disclaimer **no** acepta.

## Índice de specs y docs

- [specs/README.md](specs/README.md) — cómo funcionan las specs
- [specs/001-vaca-muerta-pulse/spec.md](specs/001-vaca-muerta-pulse/spec.md) — problema, usuarios, requisitos (Barrilito)
- [specs/001-vaca-muerta-pulse/plan.md](specs/001-vaca-muerta-pulse/plan.md) — hitos 0–3
- [specs/001-vaca-muerta-pulse/data-model.md](specs/001-vaca-muerta-pulse/data-model.md) — granos + tasa Barrilito (DRAFT / UNKNOWN)
- [specs/001-vaca-muerta-pulse/tasks.md](specs/001-vaca-muerta-pulse/tasks.md) — Hito 1 + notas Hito 2/3
- [docs/architecture.md](docs/architecture.md)
- [docs/adrs/0001-stack-choices.md](docs/adrs/0001-stack-choices.md)

Placeholders de implementación: [extraction/](extraction/README.md) · [transform/](transform/README.md) · [apps/web/](apps/web/README.md)

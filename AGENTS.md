# AGENTS.md

Instrucciones para **coding agents** (y humanos que implementan). El relato de producto está en [README.md](README.md). Si hay conflicto entre “código útil” y esta guía, gana esta guía.

## 0. Qué es este repo ahora

Greenfield **spec-driven**. **Hito 2 en curso:** dbt Core vive en [`transform/`](transform/README.md). Meltano (Hito 1) está en [`extraction/`](extraction/README.md). **No** implementes Next.js hasta el Hito 3 ([plan.md](specs/001-vaca-muerta-pulse/plan.md)).

`apps/web/` sigue con README de owner, vacío de código a propósito.

## 1. Leé esto primero (en orden)

1. Este archivo.
2. [README.md](README.md) — problema, diagramas, hitos.
3. [specs/README.md](specs/README.md) — reglas SDD.
4. Spec activa: [specs/001-vaca-muerta-pulse/spec.md](specs/001-vaca-muerta-pulse/spec.md) y [plan.md](specs/001-vaca-muerta-pulse/plan.md).
5. [docs/architecture.md](docs/architecture.md) + [ADR 0001](docs/adrs/0001-stack-choices.md).
6. El README del folder que vas a tocar (`extraction/`, `transform/`, `apps/web/`).
7. Si tocás granos o columnas: [data-model.md](specs/001-vaca-muerta-pulse/data-model.md). UNKNOWN no se inventan: se marcan o se confirman con evidencia (sample de source / `INFORMATION_SCHEMA`).

No busques la app Next todavía: no está. Meltano **sí** está en `extraction/meltano.yml`. dbt **sí** está en `transform/dbt_project.yml`.

## 2. Spec-Driven Development (obligatorio)

- Cambio **grande** (nuevo tap, nuevo grano, nueva página, nuevo dataset BQ) → **actualizar spec/ADR/data-model antes** de abrir un PR de código.
- Cambio **chico** (typo, .gitignore, copy) → no hace falta spec nueva.
- No “completar” Hito 2 o 3 en un PR de Hito 1.
- Checklist de Hito 1: [tasks.md](specs/001-vaca-muerta-pulse/tasks.md). Tachá ítems solo cuando estén hechos en el repo (o documentados como N/A con motivo).

## 3. Mapa de folders y dueños

| Path | Owner | Hito | Qué hay hoy |
| --- | --- | --- | --- |
| `specs/` | todos (AE lidera granos) | 0+ | fuente de verdad de producto |
| `docs/` | todos (DE lidera BQ/Meltano) | 0+ | arquitectura + ADRs |
| `extraction/` | **DE** | 1 | Meltano + tap CKAN DataStore → target-bigquery |
| `transform/` | **AE** | 2 | dbt Core `stg` → `int` → `marts` (Barrilito `fct_barrilito_rate`) |
| `apps/web/` | **Front** | 3 | placeholder Next + Tremor |

No pongas modelos dbt en `extraction/`, ni taps Singer en `transform/`, ni queries a `raw_*` desde el front.

## 4. Límites de rol

**DE (Data Engineer)**  
Ingesta, IAM mínimo, datasets `raw_*`, `PARTITION`/`CLUSTER`, Meltano, costos de load, no-secretos. No diseña métricas de storytelling ni componentes UI.

**AE (Analytics Engineer)**  
dbt `stg` → `int` → `marts`, tests, granos, nombres de columnas de negocio. No duplica la lógica de tap. Cierra UNKNOWNs del data-model con evidencia.

**Front**  
Next.js + Tremor, narrativa, filtros, accesibilidad. Lee **marts** (o API/cache acordada), nunca tablas raw. No embebe JSON de service account en el cliente.

**QA**  
Acepta contra [plan.md](specs/001-vaca-muerta-pulse/plan.md) y tests de dbt / smoke de load / UI. No “LGTM porque el linter pasó” si falta el criterio de aceptación.

Un agente que actúa en un rol **no cruza** de folder salvo un cambio de contrato documentado en spec (ej. Front necesita una columna nueva en un mart → AE + `data-model.md`).

## 5. Definition of Done (cualquier PR)

- [ ] Specs/ADRs tocados si cambió comportamiento, grano, stack o hito.
- [ ] Sin secretos: no `.env`, no `*service-account*.json`, no keys en `meltano.yml` / `profiles.yml`.
- [ ] Owner del folder correcto; un hito por PR salvo acuerdo explícito.
- [ ] README del folder actualizado si cambió cómo se corre la pieza.
- [ ] Criterios de aceptación del hito en `plan.md` cubiertos o listados como follow-up con issue/spec.
- [ ] Mermaid / tablas rotas no se mergean: los diagramas del README deben seguir siendo válidos.
- [ ] Datos crudos pesados no versionados (ver `.gitignore`).

## 6. Secretos y GCP — nunca

- Service account JSON: **fuera del git** (secret manager, env del runner, archivo local gitignored).
- Variables: `BIGQUERY_PROJECT`, `GOOGLE_APPLICATION_CREDENTIALS`, tokens CKAN si existieran → `.env` gitignored. Hay `.env.example` y `extraction/.env.example` **sin valores de keys**.
- No subas dumps de Capítulo IV. Documentá URL + resource id (`extraction/resources/cap4.yml`).
- Si un comando imprime una key, no la dejes en logs del PR.

### MUST de Nicolás (no negociable)

- **Nunca** commitear `.env`, JSON de service account, tokens ni keys — ni en el diff, ni en el body del PR, ni en logs/chat.
- Flujo de merge: **author → QA → Security Analyst → solo Nicolás mergea**. Bots y agentes **nunca** aprueban ni mergean.

## 7. Cómo trabajar un hito

1. Confirmá el hito en `plan.md`.
2. Hito 1 → [tasks.md](specs/001-vaca-muerta-pulse/tasks.md) y `extraction/`.
3. Hito 2 → [tasks.md](specs/001-vaca-muerta-pulse/tasks.md) (sección Hito 2) y `transform/`.
4. Preferí evidencia (una query, un `meltano run` de un año, un `dbt parse` / `dbt test`) sobre prosa.
5. Si el source no coincide con el data-model, **actualizá el data-model** (UNKNOWN → confirmado) en el mismo PR o en uno previo, no dejes columnas fantasma.

## 8. Estilo de código (cuando exista)

- Nombres de folders/código en **inglés**; narrativa de producto en **español** (READMEs, specs).
- SQL: `stg_` / `int_` / `fct_` / `dim_` según [data-model.md](specs/001-vaca-muerta-pulse/data-model.md).
- Python/Node: formateo estándar del ecosistema del hito; no mezclar package managers sin ADR.

## 9. Lo que no tenés que hacer

- Scaffold de Next “para adelantar” el portfolio (dbt es Hito 2, ya está).
- Inventar granos de completaciones o IDs de empresa si el source no los confirma.
- Apuntar el dashboard a CSVs locales como arquitectura final.
- Snowflake, Airbyte, Streamlit u otro stack sin un ADR que reemplace el 0001.
- Scrapear el HTML de consulta avanzada de SE.

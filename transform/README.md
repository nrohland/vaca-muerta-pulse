# transform/ — dbt (Analytics Engineer)

**Estado:** placeholder. No hay proyecto dbt todavía. Eso es **Hito 2**.

**Owner:** Analytics Engineer (AE). Ver [AGENTS.md](../AGENTS.md).

Acá va a vivir la transformación:

- `dbt_project.yml`, `models/staging`, `models/intermediate`, `models/marts`
- tests (`unique`, `not_null`, relaciones) y sources sobre `raw_*`
- granos documentados en [data-model.md](../specs/001-vaca-muerta-pulse/data-model.md)

Hasta entonces, no inventar modelos “para adelantar”: el grano y los UNKNOWN se cierran con el primer load de Hito 1.

Referencias:

- [docs/architecture.md](../docs/architecture.md)
- [docs/adrs/0001-stack-choices.md](../docs/adrs/0001-stack-choices.md)
- [specs/001-vaca-muerta-pulse/plan.md](../specs/001-vaca-muerta-pulse/plan.md)

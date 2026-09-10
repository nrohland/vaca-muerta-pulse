# extraction/ — Meltano (Data Engineer)

**Estado:** placeholder. No hay proyecto Meltano todavía. Eso es **Hito 1**.

**Owner:** Data Engineer (DE). Ver [AGENTS.md](../AGENTS.md).

Acá va a vivir la ingesta:

- `meltano.yml` + plugins (tap → target-bigquery)
- variables de entorno (nunca keys en git; ver `.gitignore`)
- documentación de resources CKAN / CSVs del Capítulo IV

Hasta que exista código, la verdad de diseño está en:

1. [specs/001-vaca-muerta-pulse/plan.md](../specs/001-vaca-muerta-pulse/plan.md) — Hito 1
2. [specs/001-vaca-muerta-pulse/tasks.md](../specs/001-vaca-muerta-pulse/tasks.md) — checklist
3. [docs/architecture.md](../docs/architecture.md)
4. [docs/adrs/0001-stack-choices.md](../docs/adrs/0001-stack-choices.md)

No inicialices Meltano “de paso” en un PR de producto o de UI: Hito 1 es un cambio acotado a este folder + BigQuery raw.

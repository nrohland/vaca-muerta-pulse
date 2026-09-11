# apps/web — Next.js + Tremor (Front)

**Estado:** placeholder. No hay app todavía. Eso es **Hito 3**.

**Owner:** Front. Ver [AGENTS.md](../../AGENTS.md).

**Marca UI:** **Barrilito** (el repo se sigue llamando `vaca-muerta-pulse`).

Acá va a vivir el dashboard público (Next.js App Router + Tremor).

## Headline (Hito 3 — no hay código en este folder todavía)

- Leer del mart **`fct_barrilito_rate`** en dataset **`marts_cap4_dev`** (prod futuro: `marts_cap4`): columna **`rate_bbl_dia`**. Contrato: [transform/README.md](../../transform/README.md).
- Interpolar un contador de barriles “extrayéndose” (aspecto live). Capítulo IV es **mensual**; esto **no** es telemetría.
- **MUST** disclaimer visible junto al contador: *simulación a partir de datos mensuales oficiales*.
- Factor `bbl = m³ × 6.28981077`: lo aplica el mart, no el cliente. No inventar sensores ni queries a `raw_*`.

Contrato con datos (Hito 2+): leer **marts** de BigQuery (o una capa cacheada), nunca `raw_*`. Relato: [spec.md](../../specs/001-vaca-muerta-pulse/spec.md). Fórmula: [data-model.md](../../specs/001-vaca-muerta-pulse/data-model.md).

Hasta Hito 3:

- no scaffold de Next “por si acaso”
- no copiar secretos de GCP al front; si hay queries, service role en server / vistas públicas

Decisiones de interpolación / paleta / empty de completaciones: spike [`apps/spike/`](../spike/README.md) ([ADR 0002](../../docs/adrs/0002-ui-spike-notebook.md)). No cierra este hito.

Referencias:

- [docs/architecture.md](../../docs/architecture.md)
- [docs/adrs/0001-stack-choices.md](../../docs/adrs/0001-stack-choices.md)
- [specs/001-vaca-muerta-pulse/plan.md](../../specs/001-vaca-muerta-pulse/plan.md)

# apps/web — Next.js + Tremor (Front)

**Estado:** placeholder. No hay app todavía. Eso es **Hito 3**.

**Owner:** Front. Ver [AGENTS.md](../AGENTS.md).

Acá va a vivir el dashboard público de storytelling (Next.js App Router + Tremor).

Contrato con datos (Hito 2+): leer **marts** de BigQuery (o una capa cacheada), nunca `raw_*`. Las preguntas de producto están en [spec.md](../../specs/001-vaca-muerta-pulse/spec.md).

Hasta Hito 3:

- no scaffold de Next “por si acaso”
- no copiar secretos de GCP al front; si hay queries, service role en server / vistas públicas

Referencias:

- [docs/architecture.md](../../docs/architecture.md)
- [docs/adrs/0001-stack-choices.md](../../docs/adrs/0001-stack-choices.md)
- [specs/001-vaca-muerta-pulse/plan.md](../../specs/001-vaca-muerta-pulse/plan.md)

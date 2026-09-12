# ADR 0002 — Spike de UI en notebook (Next sigue siendo v1)

- **Estado:** Aceptado (spike). **No** reemplaza [0001](0001-stack-choices.md).
- **Fecha:** 2026-09-11
- **Owners:** AE (datos), Front (consume las decisiones en Hito 3)

## Contexto

Hito 2 dejó marts listos (`fct_barrilito_rate`, empresa, área). Hito 3 es Next.js + Tremor. Antes de scaffold, hace falta **ver** interpolación, disclaimer y rankings con datos reales sin pelear App Router.

## Decisión

Un notebook + snapshots CSV acotados en [`apps/spike/`](../../apps/spike/README.md):

- Lee marts (o sus CSV), nunca `raw_*`.
- Fija: reloj diario, paleta, copy MUST, empty de completaciones.
- Headline del spike **v2**: `prod_pet_m3 / days_in_month` (cuenca). v1 usó `prod / tef` por error.
- **No** es el artefacto público ni un cambio de stack.

Streamlit u otro kit de charts pueden reusar el mismo `data/` si hace falta; tampoco serían Hito 3.

## Consecuencias

- `apps/web/` sigue vacío hasta el PR de Next.
- Aceptación Hito 3 no se tilda con este spike.
- Un Front que copie tokens/fórmula desde el notebook **v2** (`barrilito_cuenca.ipynb`) no recalcula `6.28981077` y usa **tasa de cuenca**, no productividad.
- El notebook v1 (`barrilito_spike.ipynb`) interpoló `sum/sum(tef)` (~260 bbl/día). Queda histórico; no copiar su `rate_bbl_dia`.
- Si el spike se volviera el producto, haría falta un ADR que **sí** reemplace el 0001 (no es este).

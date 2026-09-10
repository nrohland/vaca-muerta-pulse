# Spec 001 — Vaca Muerta Pulse

- **Estado:** Activa
- **Hito actual del repo:** 1 (Meltano scaffold en `extraction/`). Load live a BQ pendiente de SA en `vaca-muerta-pulse`.
- **Plan:** [plan.md](plan.md) · **Granos:** [data-model.md](data-model.md) · **Tasks Hito 1:** [tasks.md](tasks.md)

## Problema

Argentina publica el **Capítulo IV** (producción de petróleo y gas por pozo) como datos abiertos de la Secretaría de Energía. El dataset es el mejor recorte público de **no convencional** en **Vaca Muerta**, pero no es un producto:

- La unidad de análisis (pozo-mes, a veces por formación) no está explicada para un lector no-upstream.
- Petróleo/agua en m³ y gas en miles de m³ conviven sin narrativa.
- Completaciones (fracturas / intervenciones) viven en **otro** recurso, de grano UNKNOWN, y casi nunca se cruzan en una historia única (“producción sube porque se fracturó más”).
- Las herramientas oficiales sirven para consultar un área o un pozo, no para una portada: *qué empresas, qué áreas, qué ritmo de actividad*.

**Vaca Muerta Pulse** existe para convertir esa materia prima en un **dashboard público de storytelling**: pocas preguntas bien respondidas, no un explorador de 80 columnas.

## Usuarios

| Usuario | Qué necesita | Qué no |
| --- | --- | --- |
| Ciudadanía / prensa | Series claras, empresas, áreas, lenguaje en español | Export masivo ni API estable v1 |
| Analista energético amateur / estudiante | Grano honesto, unidades, filtro no convencional | Reemplazo de un modelo de reservoir |
| Recruiter / peer de datos | Ver DE + AE + Front + SDD en un repo | Un notebook único sin warehouse |
| Contributor (DE/AE/Front/QA) | Specs y owners por folder | Specs implícitas en issues sueltos |

No hay usuario “operadora con datos privados” ni “trader con latencia intradía”.

## Requisitos

Prioridad **P0** = Hitos 1–3. **P1** = después, sin bloquear el Pulse v1.

### Datos (P0)

- R1. Ingerir producción Capítulo IV hacia BigQuery **raw** de forma reproducible (Meltano).
- R2. Tablas de hechos particionadas y clustered según [architecture.md](../../docs/architecture.md).
- R3. Poder filtrar el recorte de producto: Vaca Muerta no convencional (`formacion = 'vaca muerta'` y `tipo_de_recurso = 'NO CONVENCIONAL'` en sample 2025; filtro en stg).
- R4. Exponer granos de [data-model.md](data-model.md): pozo-mes, empresa, área; completaciones si el source existe.
- R5. Documentar unidades y cualquier conversión (m³ → bbl) en marts, no en el tap.

### Producto / UI (P0, Hito 3)

- R6. Portada con KPIs del último período disponible (producción petróleo, gas, pozos activos o equivalente).
- R7. Serie temporal (cuenca VM / no convencional) y ranking de empresas.
- R8. Vista de área (concesión / yacimiento — **elegir un grano de área** cuando se cierre el UNKNOWN).
- R9. Vista de completaciones **si** hay source; source Adjunto IV **encontrado** (Hito 1, no cargado en el job default). Si el mart no está, la UI dice “sin dato”.
- R10. Copy en español; números con unidad visible.

### Ingeniería (P0)

- R11. Sin secretos en git; IAM mínimo.
- R12. Costo de demo compatible con free/cheap-tier (partitions, no scan de 2006–hoy en cada page load).
- R13. SDD: este folder es la verdad de alcance.

### P1 (explícito, no ahora)

- API pública versionada, auth, mapas GIS pesados, cuenca extra, alertas Slack, dbt Cloud, i18n inglés de UI.

## No-goals (v1)

- Tiempo real / intradía.
- Precios, fiscal, royalties, reservas.
- Optimización de fractura o geología de pozo (lateral length, etc.) salvo que el CSV de completaciones lo traiga **y** entre en el data-model.
- Reemplazar el [reporte avanzado de SE](https://www.se.gob.ar/datosupstream/consulta_avanzada/reporte.php).
- Ingesta de todas las cuencas como producto (raw puede ser amplio; el Pulse filtra).
- App móvil nativa.
- Implementar dbt/Next en el mismo PR que Meltano (Hito 1).

## Métricas de éxito

| Señal | Target v1 (draft) |
| --- | --- |
| Tiempo a insight | En la portada se entiende “VM no conv. este mes vs hace 12 meses” sin SQL |
| Frescura | Load ≤ 7 días de un archivo Capítulo IV nuevo (proceso documentado; no 24/7) |
| Cobertura | Marts de producción pozo-mes para el recorte VM; % de filas droppeadas documentado |
| Costo BQ | Un recorrido típico del dashboard << 1 TiB/mes; alerta de presupuesto en GCP |
| Honestidad | Cero gráficos de completaciones sin source; UNKNOWNs visibles en data-model |
| Portfolio | Un peer recorre README → spec → architecture sin preguntar “dónde está el código” |

Métricas de vanidad (stars, pageviews) no son DoD del Hito 3.

## Fuera de esta spec

Stack (Meltano vs Airbyte, etc.): [ADR 0001](../../docs/adrs/0001-stack-choices.md). Cortes de entrega: [plan.md](plan.md).

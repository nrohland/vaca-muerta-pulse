# Barrilito: auditoría y registro de grill-me

Fecha: 1 de octubre de 2026. Estado: auditoría inicial terminada; entrevista pendiente. No se modificó código ni se ejecutaron cargas cloud. Las recomendaciones de este documento todavía no son decisiones del usuario.

## Bases verificadas

- Proyecto clonado en `work/vaca-muerta-pulse`, `main` en `1c1c30eb9e29901048cbd812eb14f46c109e4439`.
- Harness local: `/Users/nicolasrohland/Documents/Codex/agentic-harness`, `main` en `5fc98ce7ff370dcb2700de698c7af67ae9c69fd0`. El SHA coincide con el remoto. Release vigente consultada: `v1.0.0`.
- Leídos AGENTS, README, specs, plan, arquitectura, ADRs y documentación de los folders. Auditoría adicional de datos realizada por un agente de solo lectura, según el workflow de grill-me.
- Skill exacta localizada: `/Users/nicolasrohland/.codex/skills/grill-me/SKILL.md`. Remite a `/Users/nicolasrohland/.codex/skills/grilling/SKILL.md`: preguntas por rondas, decisiones dependientes después de sus prerrequisitos y entendimiento compartido antes de actuar.

## Qué conviene conservar

Meltano con tap Singer propio para CKAN DataStore, BigQuery, dbt con capas staging/intermediate/marts y Next.js como destino del frontend. El frontend todavía no existe: `apps/web/README.md` es un placeholder. El spike notebook y sus CSV son evidencia exploratoria, no el producto público.

Marca existente: **Barrilito**. Recorte implementado: `formacion = 'vaca muerta'` y `tipo_de_recurso = 'NO CONVENCIONAL'`. Grano de producción: `idpozo × anio × mes`, confirmado en el source 2025; estabilidad interanual pendiente. Área implementada: permiso/concesión, `idareapermisoconcesion × periodo`. Empresa: `idempresa × periodo`.

La tasa de cuenca ya usa días calendario: `sum(prod_pet_m3) × 6.28981077 / days_in_month`. La productividad basada en `tef` es otra métrica. La corrección está en PR #22; no copiar el notebook anterior.

## Ramas, PRs y CI

Consulta actual con GitHub CLI: 23 PRs históricos, ninguno abierto. Las ramas remotas conservan trabajos de hitos anteriores; no hay un frontend pendiente de integración que reutilizar. No hay issues registrados en la consulta realizada.

PRs relevantes:

- [#18: marts empresa/área](https://github.com/nrohland/vaca-muerta-pulse/pull/18).
- [#20: spike de portada](https://github.com/nrohland/vaca-muerta-pulse/pull/20).
- [#22: corrección de tasa de cuenca](https://github.com/nrohland/vaca-muerta-pulse/pull/22).
- [#23: Adjunto IV y completaciones](https://github.com/nrohland/vaca-muerta-pulse/pull/23), último merge de main.

El [check dbt de main](https://github.com/nrohland/vaca-muerta-pulse/actions/runs/35640411708) pasó, pero ejecutó **deps y parse**, no build/test en BigQuery. Los builds warehouse documentados son evidencia histórica del repo, no verificación nueva de esta sesión.

`ALLOW_FULL_YEAR_LOAD=true` está configurada. La consulta de nombres de secretos del repo solo mostró `GCP_SA_KEY`; no mostró `GCP_SA_KEY_DBT`. La SA separada de dbt está documentada, pero falta resolver acceso efectivo para nuevos builds sin reutilizar permisos de Meltano. No se consultaron valores de secretos.

El merge sigue reservado a Nicolás: author → QA → Security Analyst → Nicolás, según AGENTS. Se pueden preparar ramas, commits y PRs; no se aprobarán ni mergearán automáticamente.

## Brechas y riesgos concretos

| Prioridad | Hallazgo | Evidencia | Implicación |
| --- | --- | --- | --- |
| P0 | Histórico de petróleo disponible en snapshots: solo ene–dic 2025 | `apps/spike/data/monthly_pulse.csv`, 12 filas | No hay YoY calculable; hace falta backfill oficial |
| P0 | Cron fijo en 2025, dev con TRUNCATE | `extraction/meltano.yml:71`; `.github/workflows/extract-cap4.yml:120` | La próxima corrida puede borrar un backfill multianual |
| P0 | Reload borra antes de cargar | `extraction/scripts/prepare_year_load.py:157` | Un fallo puede dejar datos vacíos o parciales; falta promoción validada |
| P0 | Extracción no encadena dbt build/test | `.github/workflows/dbt-transform.yml:3` | Raw reciente no significa marts recientes |
| P0 | Headline usa máximo período sin aceptación de completitud | `transform/models/marts/fct_barrilito_rate.sql:6` | Un mes parcial puede convertirse en portada |
| P0 | No hay contrato YoY ni contribuciones | `transform/models/marts/` | Necesita comparación exacta con t−12, entradas, salidas y deltas negativos |
| P1 | Recargas no conservan versiones publicadas | `extraction/README.md`, estrategia reemit | Rectificado y timestamps no bastan para un historial de revisiones |
| P1 | Sparse por empresa/área; sin calendario de cobertura | `fct_company_month.sql`, `fct_area_month.sql` | Ausencia no equivale a cero; lag(12) no garantiza el mismo mes del año anterior |
| P1 | Dedupe prioriza rectificado sobre recencia | `stg_produccion_pozo_mes.sql:56` | Una t antigua puede ganar a una f reciente; faltan reglas y evidencia |
| P1 | IDs/nombres históricos no están probados | `dim_company.sql`, `dim_area.sql`, tests de un nombre por ID | Renombres o transferencias pueden romper builds o distorsionar lectura |
| P1 | Comparador de conteos no falla ante delta | `extraction/scripts/compare_source_count.py:127` | CI podría aceptar carga incompleta; también cuenta toda la tabla, no el año |
| P1 | Sandbox: restricciones DML y expiración de tablas | Evidencia de carga anual y `transform/docs/hito-2-bq-iam.md` | Confirmar estado cloud antes de elegir promoción y almacenamiento durable |
| P1 | Schema se descubre dinámicamente, sin contrato de drift suficiente | `tap_ckan_datastore/streams.py` | Cambios de campos/tipos/filtro pueden perder datos o romper extracción |

Snapshots verificados: headline 1 fila, empresas latest 22, áreas latest 83, todos dic-2025; company_top5 59 filas en 2025 y top 5 elegido por volumen dic-2025, no por crecimiento. No sirven para ranking YoY. Completaciones: 176 meses distintos, dic-2011 a dic-2026; otra fuente, **Adjunto IV**, con fechas futuras respecto del refresh. No amplían histórico de petróleo ni validan su frescura.

## Fuente oficial: consulta nueva

Consultado [CKAN oficial](https://datos.energia.gob.ar/api/3/action/package_show?id=produccion-de-petroleo-y-gas-por-pozo) el 1 de octubre de 2026:

- Recurso anual 2026: `fb7a47a0-cba9-4667-a004-6f6c1c346c23`, DataStore activo, metadata last_modified `2026-10-01T10:02:03.874866`.
- Consulta DataStore con filtro VM/no convencional y `sort=anio desc,mes desc`, `limit=1`: el último registro corresponde a **julio 2026**, total filtrado 22.537 registros.
- Esto prueba existencia de registros hasta julio, **no completitud mensual** ni autorización para publicarlo como mes cerrado.
- Metadata de los recursos anuales oficiales muestra modificaciones también en años anteriores. No demuestra por sí sola cambio de producción, pero hace necesario detectar y comparar revisiones históricas.
- No se mezclará la familia anual elegida con recursos alternativos DDJJ abiertas/cerradas sin validación explícita.

## Benchmark funcional y visual

Inspeccionado [vacamuerta.io](https://vacamuerta.io/) con navegador y lectura web. Su portada presenta BOE, petróleo, gas, participación y pozos, variación MoM, ranking de operadores por BOE, mapa y noticias. La fecha visible es mayo 2026. La captura inicial de texto mostró ceros transitorios; después de cargar el navegador los valores se renderizaron, por lo que no se consideran un fallo de datos.

Resuelve bien el acceso rápido a contexto energético y la navegación hacia operadores/mapa. Barrilito puede diferenciarse con foco petróleo, YoY prominente, explicación reconciliable de contribuyentes, período/cobertura inequívocos, metodología y versiones publicadas. No asumir superioridad de exactitud sin validación comparativa.

## Cómo usar realmente el harness

V1 es una API TypeScript, no un CLI universal ni un workflow listo para cualquier repo. Integración necesaria: `Planner.plan` / `collectProjectContext` → `runPlannedSteps` → `runStep`, con workspace, acceso explícito, archivos relevantes, dependencias directas, paths permitidos y verificación por paso. Cada ejecución usa un proceso Codex aislado y revisión de solo lectura; registra JSONL.

Node local 25.8.1 cumple el requisito >=22.18. Codex CLI 0.159.2 tiene autenticación local. El harness conserva ECC pinned y skills seleccionadas, sin carga global. Hay skills pertinentes de frontend en ECC: `frontend-design-direction`, `frontend-patterns`, `frontend-a11y`, `design-system`, `e2e-testing`; se cargaron para revisión inicial las pautas de dirección visual y design-quality. `antislop` está disponible como filtro local; el brief ya exige prevenir UI genérica durante el trabajo. No se instaló nada global ni se modificó AGENTS.

TypeSafe JEV: no hay `TYPESAFE_API_KEY` en el entorno local; su nombre sí existe en secretos de Actions del harness. Los workflows actuales de capture aceptan fixtures/planes de benchmark, **no planes de Barrilito**. Hay que añadir una integración/captura acotada para este proyecto y descargar sus decisiones, o proveer JEV mediante el entorno autorizado. No reutilizar respuestas de otro benchmark ni inventar decisiones. No usar el bypass externo de sandbox para el proyecto real.

Antes de implementación: plan concreto derivado del grill-me; steps pequeños con alcance DE/AE/Front; ramas y PRs revisables; QA y seguridad con evidencia; merge del propietario. Una propuesta de entrega estática generada desde marts, con snapshot validado y aprobado mensualmente, necesita ADR porque el repo prohíbe CSV locales como arquitectura final. Un artefacto generado por pipeline no equivale al CSV manual del spike.

## Checks ejecutados en esta sesión

| Check | Resultado |
| --- | --- |
| Harness `npm test` | 41/41 PASS |
| Harness `npm run typecheck` | PASS |
| Harness `python3 -m unittest discover -s benchmarks/analytics-engineering -p 'test_check_quality.py' -v` | 2/2 PASS |
| Harness `git diff --check` | PASS; árbol sin cambios |
| Proyecto `git status --short` | Limpio; sin modificaciones |
| Conteo/cobertura de los CSV del spike | Inspección reproducible con csv de Python, resultados arriba |
| Repo principal, ramas, PRs, últimos runs, variables y nombres de secretos | Consulta read-only con GitHub CLI |
| BigQuery, Meltano end-to-end, dbt build/test, frontend | No ejecutados en esta fase |

Los checks del harness no validan el producto Barrilito. La auditoría no satisface la Definition of Done del proyecto.

## Decisiones base: ya dadas por el usuario

| Tema | Decisión |
| --- | --- |
| Fuente y alcance | Capítulo IV oficial; formación Vaca Muerta |
| Métrica | Petróleo; bbl/d es tasa diaria equivalente |
| Comparación principal | YoY contra el mismo mes del año anterior |
| Ranking principal | Contribución absoluta al crecimiento YoY |
| Ranking secundario | Producción actual |
| Dimensiones | Empresa y área; pozos activos secundarios |
| Narrativa | Actualidad → evolución → explicación → empresas → áreas → metodología |
| Acceso | Web pública, sin login |
| Calidad | Metodología visible, revisiones trazables, datos validados, ingeniería reproducible |
| Operación | Mensual; primeras actualizaciones con revisión manual |
| Costos | Fijo objetivo USD 0; variables mínimos |
| Conversación | Parte de versión final; no bloquea publicar dashboard |
| Trabajo | Harness, pasos acotados, ramas/commits/PRs con evidencia, reutilizar lo bueno |

## Árbol de decisiones y primera ronda

Pendientes del usuario; ninguna recomendación se marca aprobada:

1. **Portada:** resolver conflicto con el contador animado previo. Recomiendo tasa mensual estática, YoY % y delta firmado bbl/d; contador fuera de home. Explicación directa: volumen mensual convertido a barriles, dividido por días calendario; no medición diaria.
2. **Horizonte:** recomiendo 36 meses por defecto y selector 24/36/60, hasta último mes aceptado. Ingerir 12 meses adicionales para comparación de toda la ventana máxima; verificar estabilidad histórica. Meses sin dato/comparador explícitos.
3. **Atribución:** recomiendo empresa operadora declarada en cada mes, con advertencia de transferencias; delta firmado de tasa, no abs(delta). Un traspaso puede mover producción entre empresas sin incrementar el total. No llamarlo crecimiento orgánico. Reconstruir cartera constante sería un trabajo adicional de identidad y fuentes.
4. **Aceptación mensual y revisiones:** recomiendo validar candidato, revisar completitud, reconciliación y cambios; conservar versión pública previa ante un fallo. Mostrar lag de datos y estado provisional cuando corresponda. Calendario con huecos, sin interpolación/cero automático. Historial de versiones y deltas de agregados; reevaluar históricos modificados. Definir cantidad de ciclos manuales y retención con el usuario.
5. **Chatbot:** resolver si primera versión final puede usar preguntas en lenguaje natural acotadas y cálculo determinista sobre snapshot público, o requiere LLM libre. Recomiendo alcance acotado, evidencia de período/fórmula/fuente por respuesta y ninguna consulta arbitraria al warehouse; LLM opcional con cuota posterior. No ofrecer forecast, causas sin evidencia, breakeven ni afirmaciones live.

Dependencias para la próxima ronda: composición definitiva de charts según portada; definición de concentración según atribución; diseño editorial y jerarquía; política detallada de revisiones/faltantes; aceptación verificable y corte dashboard/chatbot; confirmación del entendimiento compartido. Después: registrar decisiones, actualizar specs/ADRs y presentar plan de etapas antes de ejecutar.

## Respuestas del usuario: ronda 1

Se conserva la ronda original arriba como historia; esta sección registra las respuestas recibidas, sin convertir recomendaciones no respondidas en aprobación.

| Pregunta | Respuesta | Estado |
| --- | --- | --- |
| Q1 | «Podríamos mostrar variación MoM, no?» | Añadir MoM a la propuesta. El brief mantiene YoY principal mientras no se indique reemplazo. Contador vs tasa estática todavía pendiente. |
| Q2 | «no entiendo, abrir dónde? yo creo que mostraría últimos 12 meses, pero no sé en dónde te referís.» | Preferencia inicial: 12 meses. Se aclara que era la ventana inicial del gráfico de evolución en la home. No asumir aceptación de 36 meses. |
| Q3 | «Diría un pequeño ranking (top 5) de principales operadores en barriles extraídos y su crecimiento YoY» | Top 5 por volumen mensual de petróleo en barriles, con crecimiento YoY. Convivencia con contribuciones y regla de transferencias pendientes. |
| Q4 | «Acepto recomendación» | Aprobado: revisión manual primeros tres ciclos, promoción validada, mantener versión pública ante fallos, huecos sin interpolar ni convertir en cero y versiones/cambios de agregados trazables. |
| Q5 | «Preguntas acotadas podemos dejar» | Aprobado: conversación acotada; no exigir LLM libre para la primera versión. Fuente/cálculo/período por respuesta según recomendación aceptada. |

Consecuencias: la interfaz puede abrir con 12 meses pero necesita al menos 24 meses de datos para calcular YoY en toda esa ventana; permitir ampliar histórico no obliga a mostrarlo completo inicialmente. La tasa bbl/d y los barriles mensuales son métricas distintas: se debe comparar la misma unidad y el mismo grano en cada variación. MoM sobre volumen mensual puede reflejar diferente cantidad de días; para la portada se propone MoM/YoY de tasa equivalente bbl/d. Para el ranking solicitado se propone volumen mensual bbl y YoY de ese volumen, con labels explícitos.

## Ronda 2: decisiones aún pendientes

1. Portada: resolver contador anterior; propuesta tasa estática del último mes, YoY prominente, MoM secundario y período visible.
2. Contribución: conservar top 5 por volumen solicitado, y añadir explicación breve de deltas YoY por empresa/área para no confundir quién produce más con quién aumentó más.
3. Atribución: operadora declarada por mes, advertencia sobre transferencias; sin reconstrucción de cartera constante en v1.
4. Jerarquía de alcance: petróleo en narrativa principal; pozos secundarios; gas y completaciones de Adjunto IV fuera de home aunque sus pipelines existentes se conservan.

Propuesta de composición: actualidad y tasas → evolución (12 meses iniciales; ampliable) → contribución YoY con barras positivas/negativas y selección empresa/área → top 5 de productores por empresa/área → metodología/versiones. Concentración definida como cuota de producción del top 5 y cambio interanual en puntos porcentuales; no llamarla aceleración ni causa. Sin doble eje, torta, mapa decorativo ni curva suavizada sobre huecos. Solo estadísticas reconciliadas y afirmaciones descriptivas.

Propuesta de aceptación verificable, basada en el DoD del usuario: ejecución oficial de extracción→dbt build/test→artefacto público validado; duplicados/grano/fechas/schema/huecos y reconciliación; YoY por mes calendario y bases cero/nulas; conjunto empresa/área completo para contribuciones; publicación con revisión y rollback a versión aprobada; Next.js compilable, controles funcionales, revisión desktop/mobile y teclado; metodología, fuentes, fechas y versiones visibles; reproducción local documentada; evidencia de QA y seguridad por PR; costo fijo objetivo cero, sin warehouse consultado por visita. No afirmar completado con solo dbt parse ni usar el spike como datos finales.

## Respuestas del usuario: ronda 2

| Pregunta | Respuesta | Decisión |
| --- | --- | --- |
| Q6 | «Si» | Retirar contador animado; usar tasa equivalente mensual, período visible, YoY destacado y MoM secundario. |
| Q7 | «Ok, vamos con ambas y vemos cómo queda» | Top 5 por producción y explicación de contribuciones; composición inicial sujeta a revisión visual con datos reales. |
| Q8 | «Realmente no entendí esto, sigo tu recomendación.» | Usar operador declarado por mes. Explicar con ejemplo de adquisición de pozos: puede crecer una empresa sin que crezca el total. No atribuir causalidad/crecimiento orgánico. |
| Q9 | «Podríamos dejarlo como petróleo y un botón para mostrar lo mismo del gas» | Petróleo por defecto; selector Gas que cambia métricas, series, contribuciones y ranking del mismo recorte. Completaciones no forman parte de esta home. |

## Contrato consolidado para confirmación de entendimiento

- Barrilito, público, español, sin login. Home orientada a datos con diseño editorial; sin contador live.
- Selector Petróleo/Gas, inicial Petróleo. Filtro VM/no convencional conservado; gas procede de los mismos registros Capítulo IV, no de BOE ni de toda la cuenca.
- Petróleo: tasa bbl/d; volumen mensual bbl. Gas: tasa millones de m³/d (MMm³/d); volumen mensual millones de m³. Source `prod_gas_km3` en miles de m³ se convierte en dbt, no se usa factor de barriles. Tooltip explica unidades y días calendario.
- Actualidad: último mes aceptado, tasa, YoY destacado, MoM secundario, fuente y fecha de publicación. No confundir mes del dato con fecha de extracción.
- Serie: últimos 12 meses inicialmente; opción de ampliar histórico hasta 60 meses si existe cobertura validada. Backfill debe incluir los comparadores de 12 meses anteriores, hasta 72 meses si se ofrece YoY en toda la ventana larga.
- Explicación: contribución YoY en unidades de tasa, con positivos, negativos y resto reconciliable. Selector empresa/área. El área es permiso/concesión, ya definido por los marts existentes.
- Ranking: top 5 por volumen mensual, crecimiento YoY del mismo volumen; tabs empresa/área. Producción mensual y tasa diaria se identifican por separado para evitar confusión por días del mes.
- Concentración: cuota de producción del top 5 y cambio YoY en puntos porcentuales, si los comparadores y las identidades están validados; no llamarlo aceleración ni atribuir causas.
- Pozos secundarios: pozos con producción positiva del fluido seleccionado; no contar el padrón completo como pozos activos ni inferir operación física sin fuente.
- Operador informado en cada mes; advertencia por transferencias. Ante cambios de nombres con el mismo ID, mantener ID y mostrar nombre vigente/descripción histórica, sin fabricar genealogía empresarial.
- Mes global faltante: hueco; comparador faltante: sin comparación; base cero: porcentaje indefinido, mostrar delta y texto. Ausencia de una empresa/área solo se trata como cero si el snapshot del mes fue aceptado como íntegro y el contrato de fuente lo respalda; caso contrario desconocida.
- Tres primeros ciclos con revisión manual. Validaciones bloquean promoción defectuosa y mantienen versión pública previa. Revisiones trazables por release: fecha, recursos/checksums, cambios de agregados y versión de código. No promete retroactividad anterior a la primera captura conservada.
- Metodología, origen oficial, alcance y límites visibles; sin extrapolar series ni afirmar tiempo real. Preguntas conversacionales acotadas y respuestas calculadas con fuente, período y fórmula; no LLM libre obligatorio. Se puede publicar el dashboard antes de incorporar conversación.
- Mantener Meltano/BigQuery/dbt/Next.js. Proponer export estático de marts validados, generado por pipeline, para que no haya consultas BQ por visita y el hosting no requiera servidor permanente. Documentar trade-off y ADR antes de implementar. Dataset/sandbox y permisos reales siguen sujetos a comprobación antes de cargas.
- Definition of Done: pipeline oficial end-to-end y tests efectivos, UI funcional verificada desktop/mobile/teclado, métricas/rankings/contribuciones correctas para ambos fluidos, metodología/versiones, despliegue preparado sin costo fijo, README reproducible, evidencia de checks y QA/seguridad. Los bloqueos externos se reportan como pendientes; no se declara completo con fixtures o dbt parse.

Las decisiones de las rondas 1 y 2 están registradas. Queda la confirmación del entendimiento compartido para iniciar implementación, según la skill requerida. El modo de antislop se propone DURANTE el desarrollo, alineado al brief de evitar UI genérica; no instalación global ni modificación automática de AGENTS.

## Confirmación final

Nicolás respondió «Confirmado». El acuerdo consolidado petróleo/gas y antislop DURANTE está aceptado. Implementación autorizada; no repetir grill-me.

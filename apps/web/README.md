# Vaca Muerta en datos — Resumen

Iteración de Hito 3 autorizada el 9 de octubre de 2026: solo Resumen. El frontend local editorial del 6 de octubre se incorpora por primera vez al repositorio con una nueva composición modular, usando la skill analytics-ui del ZIP adjunto (leída en el entorno de trabajo; sin modificar el harness).

## Ejecutar y verificar

Node.js 22.13+; validado con Node 25.8.1. Desde `apps/web`:

```sh
npm ci
npm run dev
```

Abrir http://localhost:3000/vaca-muerta-pulse/.

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

El build estático queda en `out/`. Las pruebas de navegador sirven ese build localmente y generan capturas en `docs/evidence/resumen`. `EVIDENCE_DIR` permite cambiar la carpeta. No hay despliegue automático en esta entrega.

## Sistema de componentes

`app/dashboard-components.tsx` contiene KpiCard (principal/secundaria, contexto, unidad, estado, tooltip opcional), ModuleCard común, ChartCard, RankingCard y GlobalFilters. El tema está en `app/globals.css`. Producción diaria ocupa el doble que cada KPI secundario en desktop e incluye YoY/MoM en su propia card. Las otras tres cards muestran pozos productivos, volumen mensual y cuota Top 5 (campos existentes). Variaciones positivas verdes y negativas rojas por instrucción del usuario. Logos oficiales locales y nombres cortos por ID; razones sociales en tooltip. Overview cerrado sin scroll a 1440×900 y 1366×768; mobile apila módulos. Evolución usa Recharts, un trazo, tooltip y tabla accesible. Ver [ADR 0003](../../docs/adrs/0003-resumen-ui.md).

## Contrato de datos conservado

`lib/contract.ts`, `lib/operators.ts`, `public/data/release.json` y `manifest.json` son copias exactas de la entrega local del 6 de octubre. El release contiene agregados, no registros raw. Los cálculos de tasas, variaciones, ranking y pozos provienen de marts/export candidatos de #27, #29 y #31; no se cambian en este PR. El cliente verifica contrato, SHA-256 y manifiesto antes de mostrar métricas. La participación mostrada es volumen de entidad / volumen total; las barras usan escala real 0–100%. KPIs comparan tasas; YoY de ranking compara volumen mensual.

No se inventa aprobación: mientras no exista un `approval.json` válido se muestra Preliminar. Esto es una revisión del frontend sobre el snapshot oficial candidato, no promoción a producción. Petróleo: bbl/d y bbl mensuales; gas: MMm³/d y MMm³ mensuales. No hay contador live. Recorte: formación Vaca Muerta, no convencional. Área: permiso/concesión. Las transferencias de activos pueden cambiar rankings.

## Navegación progresiva

`lib/navigation.ts` define Resumen → Producción/Operadores/Áreas/Actividad → operador/área. Filtros e IDs se conservan en la URL, con atrás/adelante. Los destinos solo muestran Próximamente; no se incorporan las vistas locales de operadores o mapa ni se construyen drill-downs.

Alcance/aceptación: [resumen-ui.md](../../specs/001-vaca-muerta-pulse/resumen-ui.md). Hito 3 completo queda pendiente; sin cambios en extracción, dbt o harness.

## Iteración de actualidad y valorización (9 de octubre de 2026)

El Resumen conserva la arquitectura de cards de 003 y aplica [004-data-valuation](../../specs/004-data-valuation/spec.md) usando analytics-ui. Se reemplaza el snapshot por el candidato validado hasta agosto; septiembre parcial queda excluido. El cliente elige el máximo período aceptado y verifica cutoff, cobertura, contrato y hash.

`lib/metrics.ts` concentra comparaciones de cada KPI, valorización y adaptaciones parametrizadas para ambos fluidos. Volumen: tasa, volumen mensual, pozos, valor bruto estimado. Valor estimado: tasa USD/día, valor USD/mes, pozos, referencia Brent USD/bbl, evitando repetir el valor mensual en la cuarta card. La carga de precios es independiente de producción: errores de precios mantienen disponibles los agregados físicos.

`public/data/prices.json` contiene la historia mensual oficial de EIA y su procedencia; `valuation-manifest.json` vincula sus bytes y el release con SHA-256. `scripts/import_brent.py` (raíz del repo) importa la respuesta HTML mensual retenida de EIA sin interpolar. `scripts/bind_valuation.py --data-dir apps/web/public/data` vuelve a ligar los artefactos después de cada actualización. No usar precios nuevos sobre toda la historia. Gas queda sin valoración hasta resolver referencia nacional y conversión energética; se explica su indisponibilidad y mantiene la UI física.

Todas las cards conservan sus propias variaciones y ayuda metodológica accesible. El gráfico y rankings adaptan unidades y comparaciones al modo, con barras de participación sobre el total. `mode=volume|value` se conserva junto con fluido/mes al navegar. La fuente, estado y fechas viven en el footer desplegable. Los destinos pendientes se identifican como Próximamente.

La evidencia nueva y las limitaciones de ejecución están en [data-valuation](../../docs/evidence/data-valuation/README.md). Las descripciones anteriores corresponden a la primera iteración, no a este snapshot actualizado. Harness, configuración del runner y servidor de pruebas permanecen intactos; las expectativas UI se actualizan al contrato nuevo.

## Comparaciones e idiomas (005)

Se aplica analytics-ui conservando los componentes y artefactos de 004. `lib/i18n.ts` centraliza ES/EN, formatos Intl y mensajes; `lib/locale.tsx` comparte el idioma entre componentes. La preferencia se guarda en `localStorage` bajo `vm-language`, con fallback español cuando almacenamiento no está disponible. Se actualizan idioma del documento, título y descripción. Nombres propios permanecen intactos.

`comparison=mom|yoy` define exclusivamente la base temporal y se conserva junto con fluido/mes/modo en la URL. Por defecto interanual. KPIs, rankings, tooltip y tabla muestran sólo la comparación seleccionada e identifican el mes base. Las variaciones físicas de entidades siguen usando los campos preparados; las monetarias usan volumen y precio históricos de cada período, sin modificar datos o ranking.

Rankings muestran K/M con máximo dos decimales, valor completo y unidad en tooltip. El gráfico mantiene la serie física o monetaria, eje desde cero y máximo/ticks automáticos. La etiqueta del último punto aparece arriba a su izquierda, sin repetición bajo X. Una vista de cambio porcentual o índice base 100 queda como posible futura exploración; no se trunca el eje automáticamente.

Spec y evidencia: [005](../../specs/005-comparison-i18n/spec.md), [revisión UX](../../docs/evidence/comparison-i18n/README.md). Sin cambios de fuentes, pipeline, datos ni harness.

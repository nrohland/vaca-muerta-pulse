# Producción — revisión

Rama feat/production-drilldown, apilada sobre feat/resumen-history-ux (Resumen final, PR #36). Sin merge ni deploy. Skill analytics-ui disponible en el trabajo anterior y aplicada al sistema existente.

## Implementación

- Cuatro KPIs reutilizando KpiCard: total mensual; diferencia absoluta MoM/YoY; crecimiento acumulado enero–mes frente al mismo período del año previo; máximo mensual del histórico disponible hasta cutoff, con fecha. Se identifica la cobertura, sin afirmar récords anteriores al snapshot. Los acumulados exigen todos los meses y precios necesarios; máximo USD no disponible si falta alguna referencia.
- Evolution reutilizado con barras físicas y línea USD validada. Producción omite el enlace a sí misma y la tabla duplicada; Resumen conserva su comportamiento por defecto. Rango compartido 12/24/36/Histórico.
- Comparación de los últimos tres años por mes calendario y barras de cambios absolutos MoM/YoY, con referencia cero. Colores neutros para cambios de producción. Meses futuros o ausentes permanecen nulos; no hay interpolación.
- Tabla con volumen, tasa diaria, precio, USD estimados, diferencias y bases MoM/YoY. Scroll dentro del gráfico/tabla; tabla de altura acotada con encabezado fijo. CSV descargado con fechas ISO, unidades explícitas, precisión completa, campos vacíos para faltantes y ambas comparaciones. Gas: m³ en tabla/CSV, MMm³ en KPIs/gráficos, sin precio ni valor inventados.
- ES/EN, light/dark, filtros globales y navegación URL existente; rango retenido entre pestañas. Tooltips breves, reversos reutilizados, regiones enfocables, tablas con encabezados y alternativas de lectura para gráficos.

## Fuentes y límites

Snapshot candidato existente: 44 meses por fluido, enero 2023–agosto 2026. Los cuatro JSON públicos siguen idénticos byte a byte. Producción hereda validación de contrato, cutoff y hashes del flujo existente. Secretaría de Energía, Capítulo IV, formación Vaca Muerta y recurso no convencional. Catálogo oficial consultado el 11/10/2026: todos los IDs del manifiesto siguen presentes (metadata_modified 2026-10-11T10:01:53.545529). Referencia EIA Brent mensual revisada: agosto 2026 91,08 USD/bbl; valor = volumen del mes × precio del mismo mes. Estimación bruta, no ingresos realizados. Gas sin referencia nacional y conversión energética validadas. No se amplía el dataset ni se promueve su publicación.

Fuentes: https://datos.energia.gob.ar/api/3/action/package_show?id=produccion-de-petroleo-y-gas-por-pozo y https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=RBRTE&f=M.

## Validación

- 26 tests unitarios aprobados, tipos y build estático aprobados. Cinco tests nuevos cubren reconciliación de todas las diferencias preparadas, precios históricos, acumulados, bases cero, registros/precios ausentes, cutoff, comparación por calendario, precisión y unidades del CSV.
- Navegador integrado: 16 combinaciones ES/EN × petróleo/gas × volumen/valor × mensual/interanual, contrastadas automáticamente contra los cálculos del snapshot. ui-matrix.json y data-validation.json. Revisados 320/390/768/1440 px, sin overflow de página; responsive.json. ES oil light y EN gas dark capturados.
- CSV realmente descargado desde la UI: 44 filas de datos, igualdad exacta con producción histórica esperada (incluye BOM). Primer mes: sin comparadores y sin futuros meses fabricados. Tabla anual accesible contrastada.
- Navegación Resumen → Producción, recarga y retroceso conservan contexto. Resumen continúa con 4 KPIs, un gráfico y dos rankings. Función SummaryDashboard idéntica y CSS previo íntegro; sólo se agregan estilos de Producción. Harness, extracción, transformaciones y datos intactos.
- Teclado: Enter abre metodología, foco pasa a Volver; Space cierra y devuelve foco; una tarjeta abierta; sin overflow. Tooltip del cambio MoM validado en mobile con mes y base exactos.
- Axe WCAG 2/2.1 A/AA ejecutado en navegador integrado sobre una copia servida con instrumentación temporal (fuera del código/harness). Cero infracciones reportadas en ES light y EN gas dark a 390 px; 30 reglas aprobadas. Se corrigió foco en gráfico aria-hidden sólo en Producción y se añadió rol group al rango en esta vista. Casos de contraste de símbolos, SVG y celdas fuera del scroll aparecen como incomplete y requieren revisión humana; no equivalen a conformidad integral. Inspección visual realizada.
- Cinco tests Playwright agregados, pendientes de ejecución efectiva: el entorno bloquea Chromium antes de ejecutar (MachPort, Permission denied 1100), incluso después de instalar el navegador. No se consideran aprobados. Configuración y servidor de pruebas existentes sin cambios. El build y la UI integrada sí fueron comprobados.

## Capturas

desktop.jpg y mobile.jpg: ES/petróleo/volumen/YoY/36m. desktop-en-gas-dark.jpg y mobile-en-gas-dark.jpg: gas con USD solicitado y fallback físico. mobile-chart-tooltip.jpg: cambio MoM. production-oil-history.csv: descarga real.

## Reproducir

Desde apps/web: npm run typecheck; npm run build; node --experimental-strip-types --test tests/*.test.ts. En un entorno que permita Chromium: ESTRATO_TEST_PORT=4181 npx playwright test tests/production.spec.ts. Sin modificaciones al harness.

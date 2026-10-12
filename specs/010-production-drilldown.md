# Producción — Hito 3

Aplicar analytics-ui, apilado sobre Resumen final (`feat/resumen-history-ux`, PR #36). No modificar Resumen, otras pantallas, harness, pipeline ni snapshot. Front consume exclusivamente agregados y precios cuya integridad valida el flujo existente.

## Pregunta y jerarquía

Cómo evolucionó la producción, qué cambió en volumen o valor y cómo se compara con años anteriores. Reutilizar KpiCard, ChartCard, Evolution, filtros globales, ES/EN y temas.

Cuatro KPIs: producción mensual (o valor mensual en USD); cambio absoluto del mes contra mes previo o mismo mes del año previo; crecimiento del acumulado enero–mes contra igual período del año anterior; máximo mensual del histórico disponible hasta el mes seleccionado (con fecha). Crecimiento acumulado exige todos los meses en ambos años y todos los precios en modo USD. Máximo monetario requiere precios para todo el histórico evaluado; no inferir un récord desde una serie incompleta. Valores ausentes permanecen nulos. Base cero: cambio absoluto sí, porcentaje no.

## Exploración

Evolución reutilizada: barras físicas y línea USD únicamente con referencias validadas; sin interpolar huecos. Rango 12/24/36/Histórico. Comparación mensual entre los últimos tres años disponibles hasta cutoff: doce categorías calendario, nulos ante faltantes y meses futuros del año seleccionado. Cambio absoluto MoM/YoY de volumen mensual o valor mensual, eje firmado y referencia cero. No tratar variación de volumen como variación de tasa diaria.

Tabla visible con período, volumen (bbl o m³), tasa (bbl/d o m³/d), Brent USD/bbl, valor estimado, bases de comparación y cambios absolutos MoM/YoY de la métrica seleccionada. Mismo rango que gráficos. CSV con encabezados estables, fechas ISO, números sin redondear, unidades explícitas y campos vacíos para nulos (nunca cero fabricado); gas sin precios ni valor. Fuente y método visibles.

## Estado y aceptación

Reutilizar estado URL de fluido/mes/modo/comparación/pestaña y retroceso/avance. Rango compartido al navegar. Idioma y tema siguen el comportamiento existente. Desktop/mobile 320/390/768/1440, ES/EN, light/dark, filtros, tooltips, teclado, tabla y descarga. Tests de calendario, precios faltantes, cero, cutoff, acumulados y reconciliación contra snapshot; regresión Resumen sin cambios visuales. Capturas y evidencia. PR sin merge/deploy.

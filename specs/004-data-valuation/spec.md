# Resumen: actualidad, comparaciones y valorización

Alcance solicitado por Nicolás el 9 de octubre de 2026. Extiende 003 sin rediseñar la arquitectura aprobada. Autoriza trabajo DE/AE/Front en ingesta, validación, contrato derivado y presentación; no autoriza merge, deploy ni promoción de producción. Harness fuera de alcance.

## Auditoría previa

El recurso oficial anual estándar 2026 (`fb7a47a0-cba9-4667-a004-6f6c1c346c23`) descargable se actualizó 2026-10-09 10:04, con 663.675 filas: enero–agosto y septiembre parcial. DataStore todavía expone 561.000 filas enero–julio. La ingesta retenida del 1 de octubre usó DataStore; los marts y release conservados terminan en julio. No es evidencia de ausencia de agosto en el origen. No usar el recurso alternativo de DDJJ abiertas/cerradas ni los agregados nacionales de DatoPuro para sustituir el universo del producto.

Se debe conservar el CSV oficial completo con checksum, comparar schema/grano, normalizarlo como candidato aislado, revisar agosto y revisiones históricas, ejecutar el dbt existente y sus gates. Septiembre (4.108 filas nacionales, 26 VM frente a 3.404 VM agosto) queda fuera. Los meses aceptados son explícitos, el frontend elige su máximo validado; una descarga o metadata reciente nunca autoriza por sí sola un período nuevo. La promoción pública sigue separada.

## Definiciones y contrato derivado

- Universo sin cambios: `formacion = 'vaca muerta'` y `tipo_de_recurso = 'NO CONVENCIONAL'`. Petróleo m³ × 6,28981077 → bbl; gas fuente miles m³ / 1.000 → millones m³. Mes por anio/mes, días calendario; no usar fecha de carga como producción.
- Pozos: únicos con producción del fluido estrictamente positiva, sin alterar la definición existente. Comparar cantidades del mismo mes anterior/año anterior; base cero o mes ausente → null.
- Volumen y tasa diaria mantienen comparaciones independientes; meses con distinta duración pueden dar MoM distinto.
- Precio Brent: promedio mensual Europe Brent Spot Price FOB de EIA, USD/bbl. No sustituye precio argentino realizado. Cada período usa exclusivamente su propio precio, sin forward fill ni precio actual retroactivo.
- Valor mensual = bbl del mes × USD/bbl del mismo mes. Valor diario = valor mensual / días calendario. Comparaciones monetarias recalculadas con los precios de ambas bases. Datos/precios faltantes → null, jamás cero.
- Valorización es un contrato separado, derivado exclusivamente de marts validados, ligado al hash del release y a checksum/procedencia del precio. Sin raw en el frontend ni duplicar fórmulas en componentes.
- Gas requiere serie mensual nacional comparable y conversión energética documentada. Hasta resolver referencia/cobertura y poder calorífico, no se calcula valor ni se usa Henry Hub/Brent.
- Rankings por referencia uniforme: valor proporcional al volumen, cuota sobre total del universo, orden físico idéntico. No representan ingresos efectivos de entidades.

## UI con analytics-ui

Misma base KPI/Card, primary azul petróleo, evolución a todo el ancho, Top 5, logos, responsive y dark. Quitar título/subtítulo redundantes del Resumen y mover procedencia/estado al footer. Todos los KPIs tienen unidad, contexto, YoY/MoM y ayuda metodológica accesible.

Volumen: tasa diaria, volumen mensual, pozos, valor bruto estimado mensual. Valor estimado: tasa USD/día, valor mensual USD, pozos, precio Brent USD/bbl (con propias comparaciones). El precio reemplaza la cuarta card para evitar duplicar valor mensual. Gas conserva volumen y explica indisponibilidad monetaria; no bloquea información física. El estado URL incluye modo y se conserva al navegar; destinos no implementados se identifican como próximos.

Gráfico: serie única según modo, unidades coherentes, 12/24/36, gaps explícitos, último punto destacado, tooltip y tabla. Rankings más legibles, barras 0–100% con denominador total. Sin nuevas pantallas.

## Aceptación

Validación de fuente, fechas, grano, conversiones, revisiones, totales/desgloses, rankings, bases temporales, precios y valorizaciones; tests dbt y contrato derivado; typecheck/build. Evidencia desktop/tablet/mobile light/dark, controles, tooltips/tablas, próxima navegación y estados faltantes. PR sin merge/deploy, con evidencia y limitaciones honestas.

# Resumen final de Vaca Muerta

Aplicación de analytics-ui sin rediseño general. Rama `feat/resumen-history-ux`, PR #36. Sin merge ni deploy.

## Cambios

- Se elimina del Resumen la instancia de evolución de pozos; se conserva Evolution parametrizado para la futura Actividad y el KPI de pozos.
- Un único gráfico combinado a todo el ancho, con barras mensuales y línea de valor; cuatro KPIs y rankings de operadores/áreas conservados.
- Se quita el texto permanente del selector. El indicador de desplazamiento aparece sólo en viewport compacto y con overflow real. Gas conserva una explicación mínima de su valor no disponible.
- Rangos 12/24/36 e Histórico (36 predeterminado). Histórico usa todos los meses validados disponibles, sin límite fijo de 60. Se muestran fechas reales con año completo: «Histórico disponible: ene 2023 – ago 2026». Huecos internos continúan nulos, sin interpolación.
- Corrección funcional adicional: tooltip sin animación de posición para evitar recorte durante el desplazamiento mobile.

## Cobertura y fuentes

El catálogo oficial consultado el 11 de octubre de 2026 incluye recursos anteriores a 2023 (2022, 2021 y anteriores). Actualización de catálogo: 2026-10-11T10:01:53.545529. Evidencia derivada, IDs y hashes en `coverage.json`. No se confunde disponibilidad del catálogo con meses ya transformados y validados.

El pipeline/snapshot del dashboard contiene 44 meses continuos por producto, enero 2023–agosto 2026. El manifiesto relaciona los recursos oficiales de 2023–2026 con los meses validados; la auditoría anterior excluyó septiembre parcial. No se amplía ingesta ni se cambia el período publicado en esta simplificación. Los cuatro JSON públicos siguen idénticos byte a byte. El universo continúa siendo formación Vaca Muerta y recurso no convencional.

Fuente: https://datos.energia.gob.ar/api/3/action/package_show?id=produccion-de-petroleo-y-gas-por-pozo

## Validación

- 21 tests unitarios aprobados. Cubren formatos, contratos, cálculos, comparaciones, unidades, precios, rankings y calendario; se verifica Histórico sin límite de 60, huecos nulos y ausencia de mutación.
- Build estático y tipos aprobados. La primera compilación sufrió lectura lenta de dependencias; la compilación final terminó correctamente.
- Navegador integrado: 16 combinaciones ES/EN × petróleo/gas × volumen/valor USD × mensual/interanual. Siempre cuatro KPIs, un gráfico, unidades correctas, gas sin serie monetaria inventada y página sin overflow.
- Rangos 12/24/36/Histórico: 12/24/36/44 observaciones en ambos productos. Tabla histórica con 44 filas, importes completos y ausencia de comparadores tratada explícitamente. Enero 2023: un punto, sin comparadores inventados.
- Desktop 1440×900: gráfico 1376 px, igual ancho que KPIs, rankings lado a lado, sin indicador de scroll.
- Mobile 390×844, 320×844 y tablet 768×1024: ancho de documento igual al viewport. Mobile: gráfico 1072 px dentro de región de 324 px; tabla de 640 px dentro de su contenedor; rankings apilados. Scroll interno verificado por teclado y al navegar al último punto. Tooltip completo dentro del área visible: x45–266 dentro de x33–357.
- Cuatro reversos: Enter abre, foco en volver, una tarjeta abierta, Space regresa, sin overflow. Temas ES/petróleo y EN/gas en light/dark revisados.
- Casos de navegador actualizados. Playwright automático falla al arrancar Chromium (MachPort, permiso 1100), antes de ejecutar tests; no se considera aprobado. La validación de UI se realizó directamente en el navegador integrado. No se modificó el harness.

## Capturas

- `desktop.jpg`: Resumen final con 36 meses.
- `mobile.jpg`: página mobile completa.
- `mobile-chart.jpg`: gráfico desplazado y tooltip completo.
- `history.jpg`: cobertura histórica real.

## Archivos modificados

`apps/web/app/dashboard-components.tsx`, `apps/web/app/globals.css`, `apps/web/lib/history.ts`, `apps/web/lib/i18n.ts`; tests `i18n.test.ts`, `history-review.spec.ts`, `resumen.spec.ts`; spec `specs/008-summary-final.md`; evidencia `docs/evidence/summary-final`.

## Limitaciones

El histórico validado comienza en enero de 2023; ampliar años anteriores requiere ingesta y validación, no una simulación en UI. Gas mantiene valor económico no disponible por falta de referencia y conversión validadas. La aprobación de publicación permanece pendiente; no se promueve el snapshot. Runner automático Playwright/axe pendiente en un entorno que permita arrancar Chromium. Viewports mobile revisados; no se emuló un dispositivo táctil físico.

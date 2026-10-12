# Rankings visuales — revisión final

Usé analytics-ui sin modificar arquitectura, KPIs, gráfico, filtros, navegación, traducciones, fuentes ni cálculos. PR #36, rama feat/resumen-history-ux. Sin merge ni deploy.

## Cambios

RankingItem único para operadores y áreas: posición, logo opcional, nombre y participación como primera lectura; volumen/valor y comparación seleccionada en la línea secundaria; barra de 7 px, redondeada y con track sutil. Primera posición con peso tipográfico, fondo leve y mayor contraste en la barra. Logos 32×32 con contain. Áreas sin logo y participación visible sobre el mismo total real que ya utilizaba su barra. Se eliminan los encabezados de tabla compacta.

El encabezado y la información secundaria se distribuyen de forma independiente para que Year over year no estreche los nombres. Desktop: filas de aproximadamente 69 px, alineaciones consistentes. Mobile permite varias líneas en nombres y reorganiza metadatos cuando hace falta, sin ellipsis ni overflow horizontal.

## Validación

- 21 tests unitarios aprobados, tipos y build aprobados. Los tests existentes de UI se adaptaron al componente y verifican ahora la cuota en ambos rankings.
- Navegador integrado: 16 combinaciones ES/EN × petróleo/gas × volumen/valor USD × mensual/interanual. Diez filas, participaciones y barras contrastadas contra el total real del snapshot; tolerancia de serialización CSS 0,0001 puntos porcentuales. No se normaliza al líder: YPF 49,9%, Loma Campana 13,8%.
- Desktop 1440×900, tablet 768×1024, mobile 390×844 y 320×844: sin overflow de página ni truncamiento de nombres. Logos contenidos de 32×32, barras de 7 px. ES y EN en light/dark revisados; gas conserva el fallback físico cuando se pide USD.
- Enter sobre una fila navega a Operadores conservando producto, período, modo y comparación; retorno a Resumen comprobado.
- Cuatro JSON públicos idénticos byte a byte; hashes en data-integrity.json. metrics.ts, contract.ts, i18n.ts, page.tsx, extracción, transformaciones y harness intactos.
- Playwright automático: falla antes de ejecutar por MachPort/permiso 1100. No se considera aprobado; revisión UI directa registrada en ui-validation.json.

## Capturas

before-desktop.jpg / after-desktop.jpg y before-mobile.jpg / after-mobile.jpg. Capturas adicionales de dark mode ES/EN.

## Archivos

apps/web/app/dashboard-components.tsx, apps/web/app/globals.css, apps/web/tests/resumen.spec.ts, specs/009-ranking-items.md y docs/evidence/ranking-final.

## Limitaciones

Las existentes: valor monetario de gas sin referencia validada; runner Playwright bloqueado. No se agregó ninguna métrica ni se modificó su cálculo.

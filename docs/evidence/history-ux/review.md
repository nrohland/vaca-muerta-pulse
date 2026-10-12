# Vaca Muerta — historia y explicaciones compactas

Implementación en rama `feat/resumen-history-ux`, sobre el PR #35. Sin merge ni deploy. **Revisión visual y cuatro capturas pendientes de acceso al navegador.**

## Cambios implementados

- Rangos solicitados 12m, 24m, 36m y 5 años; predeterminado 36m. Ventana de presentación separada de los cálculos existentes, sin modificar `contract.ts` ni `metrics.ts`.
- Cobertura validada del snapshot vigente: **enero 2023–agosto 2026, 44 meses por producto**. Para 5 años se mantienen seleccionados 60 meses solicitados, se muestran los 44 reales y se comunica cobertura 44/60. No se generan observaciones anteriores al primer mes validado; los huecos internos permanecen nulos, con línea interrumpida y tabla sin datos.
- Marcas X espaciadas según rango; todos los meses permanecen en barras, línea y tabla. Barras limitadas en ancho para períodos largos, sin reducir altura por aumentar meses.
- Selector compacto con SVG neutral de medición y símbolo $, etiquetas **Volumen / Valor USD**, **Volume / USD Value**. La app no tenía un paquete de íconos instalado: se extendió el patrón SVG inline ya utilizado por el control de tema, con componente reutilizable; no se agregó una dependencia ni un ícono exclusivamente petrolero.
- Reversos: título, explicación breve, fuente condensada y **Ver metodología →**. Se quitaron fecha, unidades, valores y fórmulas extensas repetidas. Hover: una oración. Frente, métricas, foco/retorno, un único reverso y transición accesible se conservan. Las fórmulas detalladas quedan en Metodología.
- Tooltip gráfico: **mes/año + producción + valor bruto estimado**, exclusivamente. Números compactos y valores alineados a la derecha. Para gas sólo producción, conservando la explicación de disponibilidad fuera del tooltip. Tabla: volumen sin abreviaturas e importe completo con centavos y USD, comparaciones existentes y fechas accesibles.
- Mobile/tablet: 28 px mínimos por mes más márgenes, scroll interno, indicador sólo cuando hay overflow y región accesible. Inicio en el extremo reciente; tooltip táctil por click para puntero grueso y posición dentro del área visible. El resto de la página conserva su ancho.

## Pruebas

- **21 tests unitarios aprobados**, incluyendo cobertura real 12/24/36/60, 44 observaciones disponibles, rango seleccionado sin simulación, todos los meses, huecos nulos, ausencia de mutación y formatos ES/EN.
- **Tipos y build estático aprobados.** Los tests existentes siguen validando precios históricos, valores monetarios, comparaciones, totales/rankings, fuentes y unidades.
- Cuatro JSON públicos idénticos byte a byte a la base; hashes en `validation.json`. Sin cambios en pipeline, fuentes, `metrics.ts`, `contract.ts`, rankings ni harness.
- Casos de navegador preparados en `tests/history-review.spec.ts` y actualizados en `tests/resumen.spec.ts`: desktop 36m/5 años, reverso y foco, idiomas/temas/productos, mobile táctil y tooltip acotado, scroll interno y ausencia de overflow de página.
- **No se consideran aprobados los tests de navegador ni la validación visual.** Chromium no arranca por restricción macOS de MachPortRendezvousServer (permiso 1100). WebKit aborta al arrancar (exit 134). La herramienta de control del navegador integrado no está disponible en esta sesión. Se solicitó recuperar esa herramienta para completar la validación y capturas reales; no se sustituyen con imágenes de otra iteración.

## Capturas pendientes

1. Desktop con 36 meses.
2. Desktop con 5 años y cobertura parcial explícita.
3. Mobile con gráfico desplazable.
4. Reverso simplificado de KPI.

El caso de revisión guarda automáticamente las capturas en `docs/evidence/history-ux` cuando puede ejecutarse. Para repetirlo: `EVIDENCE_DIR=<directorio> npm run test:browser -- --grep 'desktop historical coverage|internal scrolling'`, desde `apps/web` en un entorno con navegador habilitado. No requiere cambios en el harness.

## Archivos

`apps/web/app/dashboard-components.tsx`, `globals.css`, `page.tsx`, nuevo `icons.tsx`; `lib/i18n.ts`, nuevo `history.ts`; tests de formatos, resumen y nuevo `history-review.spec.ts`; spec `specs/007-history-ux/spec.md` y evidencia de validación.

## Ajustes por comentarios de revisión

Se elimina la separación duplicada entre etiqueta de comparación y porcentaje (espacio de texto más margen CSS), usando un único gap de 4 px. Se reduce a 6 px el espacio valor/unidad del KPI. Los números y porcentajes localizados conservan sus helpers existentes y precisión.

Ambos rankings muestran ahora la unidad junto al valor compacto (bbl, MMm³ o USD); el tooltip monetario muestra el importe completo con máximo dos decimales. Las columnas se ajustan para alojar la unidad. El footer visible se limita a fuente, estado preliminar y enlace a Metodología; período, universo y limitaciones siguen disponibles dentro de la explicación expandible.

Validación de estos ajustes: 21 tests aprobados, tipos y build estático aprobados, diff sin errores. La revisión visual sigue pendiente del acceso al navegador. Gráfico adicional de pozos productivos propuesto al usuario, todavía no implementado.

## Evolución de pozos productivos

Se agrega la serie histórica de pozos productivos usando el conteo existente y el mismo componente de evolución parametrizado, ventana y filtro de petróleo/gas. Desktop comparte fila 2:1; tablet/mobile apilan. Rango único compartido, eje desde cero, tooltip compacto y tabla con conteos completos, sin interpolar faltantes. Se elimina el subtítulo visible sobre alturas no comparables y se conserva la explicación de escalas independientes en Metodología.

Tipos, build y los 21 tests unitarios aprobados. Casos de navegador actualizados para distinguir ambos gráficos y verificar conteos/rangos de pozos; ejecución y capturas siguen pendientes por indisponibilidad del control de navegador. Sin cambios en datos, cálculos ni harness.

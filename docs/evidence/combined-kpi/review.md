# Vaca Muerta — gráfico combinado y KPIs reversibles

Implementación en `feat/resumen-combined-kpi`, sobre la rama del PR #34. Sin merge ni deploy.

## Cambios

- `Evolution`: barras azul petróleo de volumen **mensual** y línea complementaria de valor bruto **mensual**, con escalas independientes desde cero y ejes Y ocultos. La leyenda indica unidades; el texto aclara que las alturas entre series no son comparables. El selector global modifica KPIs/rankings y enfatiza la serie elegida; el gráfico conserva ambas series disponibles. Rangos 12/24/36 meses conservados.
- Petróleo: valor = volumen mensual × precio Brent histórico del mismo mes, utilizando el cálculo y la fuente EIA existentes. Gas: sólo barras; valor pendiente de una referencia nacional y conversión energética validadas. Precios o períodos faltantes continúan siendo nulos.
- Tooltip combinado: ambas métricas, variación seleccionada propia de cada métrica, período base y Brent del mes. Formatos compartidos: producción compacta hasta dos decimales, unidades completas redondeadas sólo en presentación, USD explícitos y porcentajes sin espacios.
- `KpiCard`: botón real de información, tooltip breve al hover/foco y reverso metodológico. Un reverso activo; Enter/espacio/Escape, retorno del foco, caras inactivas `inert`, dimensiones estables y contraste light/dark. Fórmula/definición, unidad, fuente y período; enlace a metodología completa. Información extensa se desplaza dentro de la tarjeta.
- Se usa transición accesible de contenido de 300 ms: el giro 3D produjo caras en blanco en el navegador integrado WebKit. La alternativa está expresamente contemplada en el pedido. `prefers-reduced-motion` elimina la transición.
- Tabla: ambas métricas mensuales y sus comparaciones; fechas ES `ago 26` / EN `Aug 26`, con período completo accesible. En mobile, desplazamiento horizontal interno conserva seis columnas legibles, sin desbordar la página.
- Se conservaron navegación, filtros, rankings, preferencias ES/EN y dark mode; componentes únicos parametrizados para ambos productos. Se aplicó `analytics-ui` a jerarquía, reutilización, escalas y responsive.

## Validación

- 20 tests unitarios aprobados: contratos/datos, comparaciones físicas y monetarias, precios históricos, períodos ausentes, unidades, rankings, navegación y formatos ES/EN. Se agregó cobertura de moneda, precisión de presentación, porcentajes y fechas compactas.
- Validación de tipos y compilación estática aprobadas.
- Verificación directa en navegador integrado: 1440×900, 1366×768, 768×1024 y 390×844; ES/EN, light/dark, petróleo/gas, volumen/valor, mensual/interanual, 12/24/36 meses, tooltip, reversos, teclado y tabla. Laptop final: documento 1366×768, sin scroll. Mobile y tablet sin desbordamiento horizontal de la página.
- Agosto: tooltip físico `20,76 M bbl`, valor `US$ 1.891,17 M`; YoY físico `+27,2%`, monetario `+70,7%`. Comparación mensual monetaria `+13,3%`. Diferencias de comparación preservadas, no reutilizadas entre series.
- Runner Playwright: primero faltaba el ejecutable; se instaló en una carpeta temporal. Su arranque fue bloqueado por macOS (`MachPortRendezvousServer: Permission denied (1100)`) antes de ejecutar el caso. **E2E y axe automáticos no se consideran aprobados**; queda su ejecución en un entorno habilitado. No se modificó el harness para evitar ese bloqueo.
- Movimiento reducido: regla CSS verificada; no se pudo emular con el runner bloqueado.
- Los cuatro archivos JSON públicos son idénticos byte a byte a la base, con hashes en `data-integrity.json`. No se modificaron `metrics.ts`, `contract.ts`, extracción ni transformaciones.

## Archivos

`apps/web/app/dashboard-components.tsx`, `globals.css`, `page.tsx`; `lib/i18n.ts`; `tests/i18n.test.ts`, `tests/resumen.spec.ts`; especificación `specs/006-combined-kpi/spec.md`; evidencia de esta iteración.

## Capturas

- [Gráfico combinado ES](combined-chart-es.jpg)
- [Tooltip abierto](combined-tooltip-es.jpg)
- [KPI reverso](combined-kpi-back.jpg)
- [Tabla expandida](combined-table-es.jpg)
- [Mobile ES](combined-mobile-es.jpg)
- [Mobile reverso](combined-mobile-kpi-back.jpg)
- [Inglés light](combined-chart-en-light.jpg)
- [Inglés dark, modo monetario mensual](combined-chart-en-dark.jpg)
- [Tablet gas dark](combined-tablet-gas-dark.jpg)

Registro de validación: `ui-validation.json`. Integridad: `data-integrity.json`.

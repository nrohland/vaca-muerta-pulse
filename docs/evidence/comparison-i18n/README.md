# Vaca Muerta: formatos, comparación temporal e idiomas

[PR #34, borrador](https://github.com/nrohland/vaca-muerta-pulse/pull/34), sobre #33.

Iteración sobre la arquitectura aprobada, usando la skill analytics-ui. Rama `feat/resumen-comparison-i18n`, apilada sobre #33. Sin merge ni deploy.

## Cambios

1. Rankings comunes de operadores/áreas: K/M, máximo dos decimales y separadores localizados. YPF: `10,35 M` / `10.35M`; tooltip exacto: `10.353.165,95978535 bbl` / `10,353,165.95978535 bbl`. Las unidades también permanecen en encabezados. Sólo cambia representación; orden, valores y participaciones se conservan.
2. Selector Mensual / Interanual junto a los filtros: MoM vs mes anterior; YoY vs mismo mes del año anterior, sin acumulado. Por defecto interanual. Todas las cards, ambas dimensiones y tooltips/tabla muestran únicamente la comparación seleccionada. El valor absoluto del mes permanece igual. La URL conserva `comparison`, fluido, período y modo al navegar.
3. Gráfico: padding en ambos extremos y margen superior, punto final destacado y una sola etiqueta arriba a su izquierda, sin repetir el valor debajo de X. La tabla mantiene una alternativa accesible y ahora identifica comparación y período base.
4. Eje Y: cero explícito, máximo y divisiones automáticos legibles, también para USD. Las etiquetas de divisiones permanecen visibles en notebook. No se trunca la escala; una vista porcentual o índice base 100 queda documentada como posible ampliación futura.
5. ES/EN junto al tema, sin banderas. Diccionario y formatos centralizados con Intl.NumberFormat/DateTimeFormat, contexto compartido entre los componentes existentes. Preferencia en localStorage con fallback seguro; idioma del documento, título y descripción sincronizados. Navegación, controles, ayudas, estados, gráficos, rankings, metodología y fechas traducidos. Nombres propios preservados.

## Comparaciones y datos

- KPIs conservan las definiciones de `metrics.ts`: tasa, volumen mensual, pozos, estimación bruta o precio de referencia según el modo.
- Rankings físicos usan `mom_volume_pct` / `yoy_volume_pct` existentes en el snapshot validado. La comparación monetaria usa volumen actual y volumen base preparado × Brent de cada período. No se reutiliza el porcentaje físico para USD.
- El gráfico conserva las mismas tasas históricas; el selector sólo cambia la comparación en tooltip/tabla. Agosto físico: +4,1% mensual / +27,2% interanual. Agosto monetario: +13,3% mensual / +70,7% interanual. Base julio 2026 / agosto 2025, respectivamente.
- Base ausente o cero: sin comparador. Gas sigue sin valorización, con explicación en ambos idiomas y UI física disponible.
- `release.json`, `manifest.json`, `prices.json` y `valuation-manifest.json` son idénticos byte por byte a la rama de datos anterior. Los hashes están en `ux-data-integrity.json`. No se tocaron fuentes, extracción, dbt, definiciones ni harness.

## Archivos

- `apps/web/lib/i18n.ts`, `locale.tsx`: traducciones, formatos y contexto del idioma.
- `apps/web/app/page.tsx`, `dashboard-components.tsx`, `globals.css`: selectores, persistencia, ayudas, tabla, gráfico y presentación compacta.
- `apps/web/lib/metrics.ts`: comparación mensual de entidades utilizando bases preparadas y precios históricos; dominio desde cero.
- `apps/web/lib/navigation.ts`: filtro de comparación y títulos traducidos sin modificar nombres de entidades.
- Tests de formatos, datos, navegación y expectativas de navegador; README y spec 005.

## Validación

- **19 tests aprobados** de contrato, métricas, navegación y formatos; typecheck y build estático aprobados.
- Comparaciones de todas las entidades del snapshot contrastadas contra bases calendario preparadas y precios correspondientes. Valores absolutos y snapshot no mutados. Formatos ES/EN, fechas, porcentajes, magnitudes pequeñas/cero, ausencia de referencia y fallback de idioma comprobados.
- Revisión manual en navegador integrado: desktop 1440×900, notebook 1366×768, tablet 768×1024, mobile 390×844 y 320×740. Sin desborde horizontal, etiqueta final dentro del gráfico, dark/light y ambos idiomas. Desktop y notebook del Resumen cerrado conservan una pantalla; tablas/ayudas son expansiones deliberadas.
- Mensual/Interanual, petróleo/gas, volumen/valor, fechas, tooltip exacto, tabla con base, períodos sin comparador y persistencia de idioma tras recarga comprobados. Tooltip monetario agosto: 61.005.593,25655101 USD/día, +13,3% vs julio, Brent 91,08 USD/bbl.
- La suite Playwright fue intentada: el permiso de red permitió iniciar el servidor; Chromium se detuvo antes del test por `MachPortRendezvousServer: Permission denied (1100)` del sandbox de macOS. La suite UI y axe quedan pendientes en un entorno que permita lanzar el navegador. No se declaran aprobados. La revisión manual y los tests de cálculo se reportan por separado.

## Capturas

- [Español, interanual](ux-es-interanual-desktop.jpg)
- [Español, mensual](ux-es-mensual-desktop.jpg)
- [Inglés, interanual](ux-en-yearly-desktop.jpg)
- [Inglés, mensual](ux-en-monthly-desktop.jpg)
- [Inglés, dark mode](ux-en-yearly-dark-desktop.jpg)
- [Valor estimado, inglés](ux-en-monthly-value-dark-desktop.jpg)
- [Valor estimado, español](ux-es-mensual-value-dark-desktop.jpg)
- [Gas sin valorización](ux-es-gas-unavailable-desktop.jpg)
- [Tooltip monetario mensual](ux-en-monetary-tooltip-monthly.jpg)
- [Tablet con ayudas abiertas](ux-tablet-methodology-open.jpg)
- [Mobile 320 px con ayudas abiertas](ux-mobile-320-methodology-open.jpg)
- [Mobile, valor estimado](ux-value-mobile.jpg)

Metadatos de las capturas y comprobaciones manuales: `ux-ui-checks.json`. Las dimensiones efectivas se registran; las capturas de estimación de desktop son 1440×900.

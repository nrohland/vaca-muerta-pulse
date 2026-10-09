# Resumen: producción y valor mensual, información reversible

Aplicar analytics-ui al sistema aprobado, sin cambiar datos, cálculos, fuentes o harness.

- Evolución: barras de volumen mensual y línea de valor bruto mensual con precio histórico. Escalas independientes desde cero, ejes Y ocultos; leyenda con unidades, tooltip y tabla accesible. El modo global controla KPIs/rankings, no elimina series del gráfico combinado. Gas: sólo volumen y explicación de referencia monetaria pendiente. Ausencias se mantienen nulas.
- KPI base reutilizable: información breve al hover/foco, botón para reverso metodológico, un reverso activo, retorno accesible, caras inactivas inert, giro de 300ms y movimiento reducido. Dimensiones estables; contenido metodológico puede desplazarse dentro de la tarjeta y enlaza a metodología completa.
- Formatos centralizados ES/EN: tooltips compactos <=2 decimales, importes identificados USD, porcentajes <=1 decimal sin espacios; fechas de tabla MMM YY con período completo accesible. Datos originales intactos.
- Validar unidades/meses/precios, teclado/táctil, productos/modos/idiomas, light/dark y desktop/tablet/mobile. Sin merge/deploy.
- Escalas independientes: las alturas entre series no son comparables. Una futura vista porcentual/índice base 100 requiere otra especificación.

Decisión validada: el giro 3D produjo caras en blanco en WebKit del navegador integrado. Se usa la alternativa accesible solicitada: transición de contenido de 300 ms, caras inactivas inert y movimiento reducido. Tabla móvil: desplazamiento horizontal interno para mantener seis columnas legibles, sin desbordar la página.

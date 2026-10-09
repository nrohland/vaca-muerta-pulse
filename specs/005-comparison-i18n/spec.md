# Comparación temporal, formatos e idiomas del Resumen

Iteración Front autorizada por el usuario. Aplicar analytics-ui y conservar arquitectura, datos, fuentes y definiciones de 004. Sin cambios de extracción, dbt, artefactos públicos ni harness.

- Números compactos K/M, máximo dos decimales, representación localizada, tooltip exacto con unidad; mismo componente para operadores y áreas.
- Comparación global `comparison=mom|yoy`, por defecto interanual para conservar la comparación anterior de rankings. Mensual = mes anterior; interanual = mismo mes del año anterior, nunca acumulado. Un solo indicador por métrica. Valores absolutos y orden no cambian.
- Rankings usan bases de volumen preparadas del mart. Las estimaciones aplican el precio de cada base; ausencia o cero produce sin comparador. Tooltips y tabla del gráfico identifican fecha base.
- Idioma ES/EN junto al tema, sin banderas; diccionario y Intl centralizados, componentes compartidos, preferencia persistida en localStorage con fallback seguro, idioma del documento actualizado. Nombres propios conservados.
- Eje Y no negativo desde cero, máximo/ticks automáticos legibles. Último punto con etiqueta arriba a su izquierda, padding suficiente, sin duplicación bajo X. Vista porcentual o índice base 100 queda como posibilidad futura explícita, sin truncar automáticamente.
- Validar fórmulas contra snapshots existentes, formatos, ausencia de bases, persistencia/contexto, controles, desktop/tablet/mobile, ES/EN claro/oscuro y capturas. Si el runner automatizado continúa bloqueado, informar y mantener comprobación manual separada.

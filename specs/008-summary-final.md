# Cierre de Resumen

Usar analytics-ui sin rediseñar la arquitectura ni modificar métricas, fuentes o rankings. Quitar solamente la instancia de evolución de pozos del Resumen; conservar Evolution parametrizado para Actividad. Cuatro KPIs, un único gráfico combinado de ancho completo, rankings desktop en dos columnas y mobile apilados.

Rangos 12/24/36 meses y Histórico: calcular la extensión desde el primer mes real hasta el período seleccionado, sin límite fijo de 60 ni observaciones previas inventadas. Mantener huecos nulos. Mostrar Histórico disponible: MMM YYYY – MMM YYYY al elegir histórico o ante cobertura parcial. Fuente oficial puede tener más años que el snapshot validado; no ampliar ingesta en esta simplificación.

Quitar instrucciones redundantes del modo global. Mantener indicación breve de gas sin valor disponible. Hint de scroll únicamente en viewport pequeño con overflow real. Tooltip, tabla, KPI reversos, ES/EN y dark mode intactos. Validar en navegador integrado y pruebas disponibles. Sin merge/deploy ni cambios al harness.

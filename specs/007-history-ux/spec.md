# Resumen: historia y explicaciones compactas

Aplicar analytics-ui sin alterar datos, cálculos, KPIs o rankings.

- Rangos solicitados 12/24/36/60 meses, predeterminado 36. Mantener selección aunque la cobertura validada sea menor; limitar ventana al primer mes real y mostrar cobertura parcial. Mantener huecos internos nulos, sin interpolación. La fuente actual contiene 44 meses continuos por producto (ene 2023–ago 2026).
- Barras mensuales y línea USD con escalas independientes desde cero; marcas X adaptadas al rango. Mobile/tablet: ancho mínimo por mes, scroll dentro del gráfico, indicador y región accesible. Página sin overflow horizontal.
- Selector compacto con SVG neutro de medición siguiendo el sistema inline existente (no hay paquete de íconos instalado), símbolo $, etiquetas Volumen/Valor USD y Volume/USD Value.
- Reverso KPI: título, explicación breve, fuente y enlace Ver metodología →. Hover: una oración. Conservar foco, retorno, altura y transición accesible, sin explicaciones extensas.
- Tooltip gráfico: mes/año, producción y valor estimado exclusivamente. Datos con unidades completas en tabla; metodología detallada en footer. ES/EN y temas conservados.
- Validar cobertura, huecos, los cuatro rangos, productos/modos, responsive, desplazamiento, interacción y formatos. Rama/PR sin merge/deploy; harness intacto.

## Evolución de pozos junto al gráfico principal

A pedido del usuario, eliminar el subtítulo visible sobre alturas no comparables; mantener unidades en leyenda y explicar las escalas independientes en Metodología. En desktop, compartir fila 2:1 con evolución de pozos productivos (conteo único positivo existente, eje desde cero, sin agregar ni cambiar métricas). Reutilizar ventana histórica, filtros, gráfico, scroll, tooltip y tabla; compartir selector de rango, sin duplicarlo. Tablet/mobile apilan las cards. Mantener ES/EN y datos faltantes nulos.

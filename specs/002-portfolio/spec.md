# Barrilito público: contrato confirmado

Confirmado por Nicolás el 1 de octubre de 2026 tras dos rondas de grill-me. Esta spec reemplaza el alcance de UI de 001; conserva fuente, recorte y arquitectura de extracción/transformación existentes. La implementación no se considera completa sin evidencia end-to-end y revisión de publicación.

## Producto

Web pública en español sin login. Petróleo por defecto, selector Gas. El recorte sigue siendo formación Vaca Muerta y recurso no convencional del Capítulo IV oficial. No se mezcla BOE ni toda la cuenca. El contador animado de extracción se retira.

Narrativa: actualidad → evolución → contribuciones YoY → top 5 de productores → metodología. Diseño editorial/data journalism; sin grid de cards SaaS, decoraciones gratuitas ni gráficos redundantes. Antislop DURANTE, confirmado; dirección ENERGY 2 / RHYTHM 2 / MOTION 1. Gas cambia la narrativa completa y usa datos del mismo recorte, no números de petróleo relabelados.

## Métricas y gráficos

- Headline: tasa diaria equivalente del último mes aceptado. Petróleo bbl/d, gas millones de m³/d. YoY destacado, MoM secundario, fecha de datos y fecha de release distintas.
- Conversión en dbt: petróleo m³ × 6.28981077; gas source miles de m³ ÷ 1000 = millones de m³. Tasa = volumen mensual / días calendario. No se transforma en el frontend.
- Línea de evolución: 12 meses iniciales; ampliable 24/36/60 cuando hay cobertura. Sin suavizar huecos ni conectar meses ausentes. Comparadores calendario exactos, nunca lag(12) en serie sparse.
- Contribuciones: delta firmado de tasa YoY, empresa/área. Mostrar positivos, negativos y resto reconciliable. Universo incluye entidades de ambos meses. No abs(delta).
- Top 5: volumen mensual de petróleo en bbl / gas en millones de m³ y YoY del mismo volumen. Selector empresas/áreas. Área = permiso/concesión. Rankings por producción no se confunden con contribuciones.
- Concentración: cuota de producción top 5 y cambio YoY en puntos porcentuales cuando existe comparador. No llamarla aceleración ni causalidad.
- Pozos secundarios: producción positiva del fluido elegido, no todos los pozos del padrón.
- Empresa = operador declarado por mes. Una compra de activos puede cambiar el ranking sin aumentar la producción total; aviso visible. IDs preservados y nombre vigente; no fabricar reconstrucción de cartera constante.
- Fuente primaria y metodología visibles, descarga de agregados y versión pública identificable. Sin completaciones en home; el pipeline Adjunto IV existente se preserva.

## Calidad y operación

Fuente faltante ≠ cero. Período faltante implica hueco, base YoY/MoM faltante implica comparación nula; base cero permite delta pero porcentaje indefinido. Ausencia de entidad en mes aceptado solo puede rellenarse con cero si el contrato de snapshot íntegro lo permite y se registra esa regla.

Candidato no es release aprobada. Tres primeros ciclos requieren revisión manual de cobertura, esquema, reconciliación, cambios y meses nuevos. Fallo conserva última release. Versionar manifiesto de recursos, hashes, commits, tiempos y cambios agregados; no prometer historial anterior a la primera captura retenida. Reprocesar recursos históricos modificados; comprobar estabilidad de IDs/renombres con EDA.

Conversación final acotada y determinista sobre release pública: evolución, variaciones, rankings y concentración, con fuente/período/fórmula por respuesta. Rechazo honesto fuera de alcance. No LLM libre obligatorio; no forecast, causalidad, precio/breakeven ni datos intradía. No bloquea primer dashboard.

## Definition of Done

Pipeline oficial extracción → dbt build/test → export validado → web. Contratos raw de esquema/grano/duplicados/fechas y tests de paginación/idempotencia/fallo parcial; tests de meses faltantes/base cero/calendario y reconciliación de volúmenes/deltas. Web compilable, controles reales y estados vacíos, ambos fluidos, desktop/mobile/teclado, capturas. README reproducible, metodología, arquitectura/ADRs, versiones públicas, hosting sin costo fijo y costos variables controlados. QA y seguridad con evidencia. Solo Nicolás aprueba/mergea; bloqueos externos se declaran pendientes.

Plan y decisiones de auditoría: `docs/portfolio/grill-me.md`, `.harness/portfolio-plan.json`. No reinterpretar el DoD como solo parse, fixtures o PR creado.

## Revisión de producto confirmada: Estrato (2026-10-02)

Esta revisión sustituye la dirección visual y navegación anteriores. Nombre Estrato; favicon con tres estratos formando E. Composición clara/contemporánea elegida desde `outputs/propuestas-visuales/01-estrato.svg`: sans, fondo frío, densidad moderada, gráficos compactos; ENERGY 2 / RHYTHM 2 / MOTION 1. La primera versión editorial fue rechazada por Nicolás; no es referencia de acabado.

Pestañas reales Resumen, Operadores, Mapa y actividad, Metodología. El fluido y mes se conservan en todas; URL compartible y back/forward. La evolución y cada barra enlazan a su detalle, sin navegación larga por anclas. Resumen muestra tasa, YoY/MoM y pozos, evolución compacta y top 5 como barras horizontales. Retirar sección/gráfico «Qué explica el crecimiento»; los marts de contribución existentes pueden conservarse para trazabilidad pero no se muestran. Operadores tiene ranking completo con logos oficiales y evolución/áreas de la entidad elegida, tablas equivalentes y vuelta al ranking.

Petróleo teal, gas azul; signos de variación ▲ verde y ▼ rojo, cero neutral y sin comparador explícito. No reutilizar color del fluido para expresar aumento/descenso; anunciar incremento/descenso con texto accesible. Logos proceden de sitios oficiales con inventario de origen; fallback honesto de iniciales cuando no se obtiene asset, nunca imagen inventada ni proveedor runtime de logos.

Agrupación Pluspetrol aprobada: PCN y PLU se presentan como Pluspetrol. Mapping explícito versionado desde enero2023 en el histórico de publicación; conservar entidad legal original y regla para inspección. Sumar volúmenes antes de calcular comparación, tasa, ranking y concentración en dbt. No promediar porcentajes ni agrupar por similitud de nombres. No atribuir producción histórica de vendedores adquiridos retroactivamente al comprador. Las demás empresas mantienen IDs fuente hasta otra regla revisada.

Mapa y actividad: MapLibre GL JS + OpenFreeMap, fondo claro Positron, atribución visible, proveedor configurable y alternativa de tabla si mapa falla. Alcance VM dentro de cuenca Neuquina, sin ampliación nacional; formación y cuenca no son sinónimos. Geografía oficial versionada; validar coordenadas, CRS, claves, conteos y cobertura. Fuente de ubicaciones actual no garantiza ubicaciones históricas; fecha del catálogo y meses de producción separados. Mes y fluido rigen puntos y detalle. Actividad = producción declarada, pozos con producción positiva y estados/tipos de la fuente, sin inventar rigs, fracturas o perforaciones. Cargar datos mapa solo al abrir pestaña, sin BQ por visita.

La conversación acotada permanece en Operadores o Metodología, sin dominar el resumen. Hosting, revisión manual y Definition of Done anteriores permanecen.

# Vaca Muerta: actualización y valorización para revisión

[PR #33, borrador](https://github.com/nrohland/vaca-muerta-pulse/pull/33), rama `feat/resumen-data-valuation`, sobre la iteración aprobada #32.

Agosto de 2026 incorporado al Resumen de revisión. Septiembre existe en el archivo oficial, pero su cobertura es parcial y queda excluido. La arquitectura aprobada se conserva; se aplicó la skill analytics-ui del ZIP. Sin merge, deploy ni promoción pública. Harness intacto.

## 1. Auditoría de fechas y retraso

Fuente: [Secretaría de Energía, Capítulo IV](https://datos.gob.ar/dataset/energia-produccion-petroleo-gas-por-pozo-capitulo-iv), recurso anual estándar 2026 `fb7a47a0-cba9-4667-a004-6f6c1c346c23`. Se compararon metadata, DataStore y el CSV descargable, sin utilizar el recurso alternativo de DDJJ abiertas/cerradas.

| Etapa | Antes | Después de esta revisión |
|---|---|---|
| CSV oficial 2026 | No auditado por el frontend | Enero–agosto y septiembre parcial |
| API DataStore usada por la ingesta | Enero–julio, 561.000 filas | Sigue en julio al verificar el 9/10 |
| Archivos raw retenidos | Hasta julio, extracción 1/10 | CSV 2026 completo: 663.675 filas, incluye septiembre parcial |
| Capa física `fct_well_month` | Hasta julio, 109.073 filas VM | Hasta septiembre parcial, conservado para control |
| Marts de publicación | Hasta julio | Hasta agosto; 88 totales y 8.936 filas de entidades |
| Frontend en esta rama | Julio | Agosto como máximo validado automático |
| Publicación pública | Sin aprobación registrada | Pendiente; no deploy |

El retraso se encuentra en la ingesta: el CSV oficial está más actualizado que DataStore. Los gates de transformación/publicación no habían recibido agosto. [DatoPuro](https://datopuro.com.ar/indicadores/energia) señala agosto para agregados nacionales; sirve como señal para investigar, no como fuente de métricas de esta formación.

Agosto tiene 79.576 filas nacionales y 3.404 de Vaca Muerta. Septiembre tiene sólo 4.108 y 26, respectivamente. Por eso no se acepta septiembre. “Validado” significa revisión técnica del snapshot de registros disponibles, no cierre definitivo de declaraciones oficiales; los datos son revisables.

Fechas conservadas:

- Producción aceptada: agosto de 2026, mes derivado de anio/mes.
- Actualización del recurso oficial: `2026-10-09T10:04:00.449091` (API sin zona declarada).
- Extracción/normalización del candidato CSV: `2026-10-09T19:07:30.997493+00:00`.
- Ingesta del warehouse: `2026-10-09T19:14:31.383000+00:00`.
- Generación del release de revisión: `2026-10-09T19:18:34.059703+00:00`.
- Publicación: pendiente de aprobación; no se inventó una fecha.

## 2. Calidad y resultados

Universo exacto conservado: `formacion = 'vaca muerta'` y `tipo_de_recurso = 'NO CONVENCIONAL'`. No equivale a toda la producción argentina, toda la cuenca Neuquina ni todo el no convencional.

| Agosto 2026 | Petróleo | Gas |
|---|---:|---:|
| Producción diaria equivalente | 669.802,297503 bbl/d | 95,450029 MMm³/d |
| Volumen mensual | 20.763.871,222585 bbl | 2.958,950899 MMm³ |
| Pozos únicos con producción positiva | 2.678 | 2.884 |
| YoY de volumen/tasa (ambos meses de 31 días) | +27,2049% | +5,9538% |
| MoM de volumen/tasa (ambos meses de 31 días) | +4,1497% | −1,1816% |

Se preservaron las conversiones: petróleo m³ × 6,28981077; gas de miles de m³ / 1.000 para MMm³; tasa = volumen / días calendario. Los pozos se cuentan por fluido, no se suman entre productos.

La captura nueva agrega 29 filas VM de enero–julio y cambia 17 valores de petróleo y 17 de gas; no desaparecen claves anteriores. Esos meses se reprocesaron, además de agosto. El CSV completo tiene cero duplicados de idpozo/anio/mes. No hay volúmenes VM inválidos o negativos. Todas las filas VM 2026 conservan `rectificado=f`, `habilitado=t`; no se introdujo un filtro de estado nuevo.

La conciliación independiente contra archivos oficiales retenidos comprobó 112.506 filas VM de meses aceptados y 45.736 comparaciones numéricas: totales, pozos, unidades, tasas, entidades, orden de rankings, cuotas Top 5, YoY/MoM y bases cero/ausentes. Operadores mantienen la agrupación revisada PCN/PLU → Pluspetrol. Las barras usan participación sobre el total del universo, escala 0–100%.

## 3. Precios y metodología

Se utiliza [EIA: Europe Brent Spot Price FOB mensual](https://www.eia.gov/dnav/pet/hist/leafhandler.ashx?f=m&n=pet&s=rbrte), USD/bbl, actualización 7/10/2026. Historia retenida: 473 meses, último septiembre 2026; todos los meses de producción aceptados tienen precio. [FRED MCOILBRENTEU](https://fred.stlouisfed.org/series/MCOILBRENTEU) identifica EIA como fuente y confirma agosto 91,08 y julio 83,76. [World Bank Pink Sheet](https://www.worldbank.org/en/research/commodity-markets) ofrece otra historia mensual; se eligió EIA como origen directo y específico de Brent, sin mezclar proveedores.

- Valor bruto mensual = barriles del mes × Brent promedio de ese mismo mes.
- Valor diario equivalente = valor bruto mensual / días calendario del mes.
- YoY/MoM monetarios = (valor actual / valor de la base − 1) × 100; cada base usa su propio volumen y precio. Bases ausentes o cero → sin comparador.
- Precio faltante → no disponible; no forward fill ni precio actual aplicado a toda la historia.

Agosto: Brent 91,08 USD/bbl; valor bruto estimado 1.891.173.390,9531 USD, equivalente diario 61.005.593,2566 USD. YoY monetario +70,7061%, frente a +27,2049% físico. No representa facturación efectiva. No incorpora calidad, descuentos comerciales, costos, regalías ni diferencias entre precio argentino realizado y Brent. Las entidades comparten la referencia del producto/mes: los rankings monetarios no son ingresos efectivos individuales y mantienen el orden físico.

Gas: se revisaron [precios nacionales Res. 1/2018](https://datos.energia.gob.ar/dataset/precios-de-gas-natural) y [Plan Gas.Ar](https://www.argentina.gob.ar/economia/energia/hidrocarburos/plan-gasar). El CSV y DataStore de precios tienen 1.602 registros, enero 2019–mayo 2026, desagregados por cuenca, contrato y destino. No ofrecen una referencia de toda la formación hasta agosto. Plan Gas.Ar cubre compromisos y segmentos de demanda, no toda la producción. Tampoco se validó un poder calorífico comparable para convertir el volumen a MMBtu. No se aplicaron Brent, Henry Hub, precios fijos o factores energéticos supuestos al gas. El cálculo queda pendiente, con estado de indisponibilidad y componentes comunes ya preparados.

## 4. Cambios de UI y archivos

Mismas cards, primary azul petróleo, evolución a todo el ancho, logos, Top 5, navegación y dark mode. Se eliminó el título redundante; fuente, estado y fechas pasan al footer desplegable. Todas las cards tienen unidad, contexto, comparaciones propias y ayuda metodológica accesible.

En Volumen: producción diaria, volumen mensual, pozos y estimación bruta. En Valor estimado: valor diario, valor mensual, pozos y precio Brent del mes. La referencia de precio reemplaza la cuarta card para evitar repetir el valor mensual. Gas conserva unidades físicas y explica el modo monetario pendiente.

El gráfico conserva 12/24/36 meses, tooltip, tabla, gaps y acceso señalado como Próximamente. Destaca último punto y valor final. El modo adapta título, eje, tooltip y ranking; fluido/mes/modo se conservan en URL y navegación. La carga de precios no bloquea producción.

Archivos principales:

- `apps/web/app/dashboard-components.tsx`: KpiCard, ChartCard, RankingCard, GlobalFilters y Resumen reutilizados.
- `apps/web/app/page.tsx`, `globals.css`: carga independiente de precios, filtros, encabezado, trazabilidad y responsive.
- `apps/web/lib/metrics.ts`: fórmulas y adaptaciones separadas de presentación; `navigation.ts` conserva modo; `contract.ts` refuerza períodos validados.
- `apps/web/public/data/{release,manifest,prices,valuation-manifest}.json`: candidato agosto y referencia histórica ligados por SHA-256.
- `extraction/scripts/prepare_csv_candidate.py`, `contracts/production_csv.json`: alternativa explícita ante DataStore rezagado, sin promoción automática.
- `scripts/import_brent.py`, `bind_valuation.py`: importación trazable y vínculo de artefactos.
- Tests de contrato, métricas, UI y candidato CSV; READMEs, spec 004 y evidencia.

El pipeline dbt ejecutado corresponde al código existente de #25–31, commit `448a406c8cc87de425964d8d6aa412f608d67b71`, en checkout separado. No se copiaron ni reinventaron sus cálculos SQL. Dataset raw y capas candidatos aislados; `WRITE_EMPTY`, producción existente preservada. La capa física conserva septiembre parcial; sólo los marts de publicación con períodos aceptados alimentan el frontend. El mart legado `fct_barrilito_rate` usa el máximo raw y no debe usarse para esta publicación. El mapa opcional anterior no se expone en el nuevo release, porque no se reprocesaron sus marts; sus archivos se conservan y no existe una pantalla de mapa en esta entrega.

## 5. Pruebas y evidencia

- dbt: 87 nodos aprobados (11 modelos/seeds, 76 tests), sin warnings, errores o skips en la ejecución final. Selección indirecta cautelosa excluye tests que requieren marts de mapa fuera del alcance. La ejecución inicial había fallado en dos tests de mapa por tablas no construidas; se corrigió la selección y se volvió a ejecutar.
- Conciliación oficial: 45.736 comprobaciones numéricas, pass.
- Frontend: 15 tests de contrato/navegación/métricas, typecheck y build estático, pass.
- CSV: 3 tests de normalización, tipos, fechas, duplicados y preservación de universo raw, pass.
- Revisión manual con navegador integrado: desktop 1440×900, notebook 1366×768 sin scroll; tablet 768×1024; mobile 390×844 y 320×740 sin desborde horizontal. Light/dark, petróleo/gas, volumen/valor, filtros, 12/24/36, tablas, ayuda metodológica, tooltip final, teclado, atrás y estado de gas no disponible comprobados.
- Playwright: Chromium instalado y ejecución intentada; macOS sandbox bloquea `MachPortRendezvousServer` con Permission denied. La suite de navegador y axe no se declaran aprobadas. La revisión manual no sustituye una auditoría automatizada de accesibilidad. El estado de falta de precios/hash está cubierto por contrato y preparado en la suite UI; su interceptación de red queda pendiente de ese runner.

Capturas:

- [Desktop volumen claro](valuation-desktop-volume-light.jpg)
- [Desktop valor oscuro](valuation-desktop-value-dark.jpg)
- [Notebook](valuation-laptop-value-light.jpg)
- [Mobile volumen claro](valuation-mobile-volume-light.jpg)
- [Mobile valor oscuro](valuation-mobile-value-dark.jpg)
- [Tablet gas](valuation-tablet-gas-light.jpg)
- [Gas: valorización no disponible](valuation-mobile-gas-unavailable.jpg)
- [Tooltip físico](valuation-chart-tooltip.jpg), [tooltip monetario con Brent](valuation-price-tooltip.jpg)

Los metadatos de auditoría, checksums, conciliación y observaciones UI acompañan este informe. Los dumps raw grandes quedan fuera del repositorio.

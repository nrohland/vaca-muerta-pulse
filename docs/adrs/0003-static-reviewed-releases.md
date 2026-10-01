# ADR 0003: releases estáticas revisadas y charts editoriales

Estado: aceptado para implementación del alcance confirmado. Fecha: 2026-10-01.

## Contexto

El dashboard público se actualiza mensualmente y tiene costo fijo objetivo cero. El frontend aún no existe. Una query de BigQuery por visita añade latencia, secretos runtime y consumo ligado al tráfico; los CSV del spike no son una arquitectura publicable. El brief confirma petróleo/gas, YoY/MoM y contribuciones firmadas.

## Decisión

Mantener CKAN → Meltano → BigQuery → dbt. Publicar agregados exportados desde marts mediante pipeline versionado y validado. Next.js con export estático consume un JSON de release con manifiesto, controles y metodología; sin secretos de GCP en browser, sin lectura raw ni query por visita. El artefacto inicial se genera de fuente oficial: no se sustituye por números inventados o el spike.

Revisar manualmente candidatos de los primeros tres ciclos; conservar última versión aprobada ante fallos. Manifiesto incluye recursos, hash, período, timestamp de extracción/aceptación y commit; historial de cambios de agregados desde la primera release conservada. Datos raw grandes y credenciales fuera de git. Sandbox BQ puede expirar tablas: conservar artefactos de release y hacer rebuild reproducible; comprobar permisos/retención antes de configurar carga.

Charts: Recharts para línea con huecos y barras firmadas, con tablas/texto accesibles equivalentes. Reemplaza Tremor como kit UI previsto en ADR 0001, mantiene Next.js. Motivo: control editorial, métricas/labels personalizados y comparación firmada sin adoptar layout de dashboard genérico. Coste: CSS/components propios y verificación responsive/accessibility. No segundo motor de métricas en frontend.

Hosting previsto: GitHub Pages con Actions y Next export, sin backend persistente. Verificar cuotas y configuración del repo antes de activar. Un preview local no equivale a sitio publicado. Conversación acotada corre sobre agregados públicos y no necesita servidor/LLM.

## Alternativas

Next server con BQ: conserva acceso fresco pero no aporta al dato mensual y aumenta operaciones/costo. CSV manual del spike: no reproducible ni actualizable. Rehacer en DuckDB como warehouse: evita credenciales para demo, pero descarta inversiones de ingeniería; posible verificador offline, no sustituto del warehouse. Tremor: válido para prototipo, menos control sobre dirección editorial.

## Consecuencias

Datos tienen fecha de corte visible y aprobación manual. Las correcciones históricas cambian release y se documentan. Fuente, metodología, unidades y límites del operador declarado deben aparecer en la web. Separa implementación, validación en BQ y activación de publicación. Ninguna promesa de USD 0 de consumo ilimitado.

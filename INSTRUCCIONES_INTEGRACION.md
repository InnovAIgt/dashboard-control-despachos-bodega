# Integración — Control de despachos de bodega

Paquete preparado para `Prototipado_Dashboard_Intelfon`.

## Estructura

```text
dashboards/bodega/control-despachos/control-despachos.html
dashboards/bodega/control-despachos/data/facturas.json
scripts/actualizar-despachos.js
.github/workflows/actualizar-despachos.yml
apps-script/EnviarReporteSLA.gs
apps-script/appsscript.json
```

## Arquitectura final

```text
SAP
 ↓
GitHub Actions
 ↓
scripts/actualizar-despachos.js
 ↓
dashboards/bodega/control-despachos/data/facturas.json
 ↓
control-despachos.html
 ↓
Dashboard Centralizado
```

`server.js`, `config.js` y `mock-api.js` ya no son necesarios en producción.

## Secret obligatorio

En GitHub:

`Settings -> Secrets and variables -> Actions -> Secrets`

Crear:

- `SAP_API_KEY`

La credencial no se guarda en HTML, JSON ni JavaScript versionado.

## Variables opcionales

En `Settings -> Secrets and variables -> Actions -> Variables`:

- `SAP_API_URL`
- `SAP_YEAR` (default `2026`)
- `SAP_AUTH_TYPE` (default `header`)
- `SAP_HEADER_NAME` (default `X-API-Key`)
- `SAP_RUTA_LISTA`
- `SAP_AGRUPAR_POR_FACTURA` (default `true`)

## Actualización

El workflow está programado cada 5 minutos y también permite ejecución manual.

Solo hace commit cuando:
- cambian las facturas, o
- cambia el estado de error de SAP.

## Envío diario del reporte SLA por Gmail

Hay dos scripts independientes, cada uno envía un correo con un solo botón al reporte de su país:

- `apps-script/EnviarReporteGT.gs`: Guatemala, `reports/reporteSLA.html?pais=GT`.
- `apps-script/EnviarReporteSV.gs`: El Salvador, `reports/reporteSLA.html?pais=SV`.

Los dos correos abren el HTML publicado existente y pasan el código del país en la URL. Publica la
versión actualizada de `reports/reporteSLA.html` en GitHub Pages para que ese filtro se aplique.

Ambos correos se envían a `fernandozetatrading@gmail.com`. Cada script instala su propio activador
diario a las 8:00 a. m. en `America/Guatemala` (misma hora en El Salvador). Google puede ejecutar
los activadores de hora dentro de una ventana aproximada, no necesariamente exactamente al minuto.

### Configuración única

1. Inicia sesión con la cuenta Google remitente y abre [script.google.com](https://script.google.com).
2. Crea un proyecto y agrega el contenido de ambos scripts (`EnviarReporteGT.gs` y
   `EnviarReporteSV.gs`) como archivos `.gs` separados. Configura `America/Guatemala` en
   `Project Settings -> Time zone`; la zona también está declarada en `apps-script/appsscript.json`.
3. Ejecuta `probarEnvioReporteGT` y `probarEnvioReporteSV` para autorizar Gmail y comprobar que llegue
   un correo por país. Ambos scripts tienen el destinatario configurable al inicio.
4. Ejecuta una vez `instalarEnvioDiarioGT` y `instalarEnvioDiarioSV`. Deben quedar dos activadores:
   `enviarReporteGT` y `enviarReporteSV`, ambos diarios a las 8:00 a. m. El instalador elimina el
   antiguo activador combinado `enviarReporteSLA` para evitar correos duplicados.

No se requieren contraseñas SMTP, secretos de GitHub, Apps Passwords ni GitHub Actions para el envío.
Si cambia el destinatario, actualízalo en ambos scripts y guarda el proyecto.

## Prueba antes del merge

1. Copiar esta estructura a la rama de trabajo.
2. Configurar `SAP_API_KEY`.
3. Subir la rama.
4. Ir a `Actions -> Actualizar datos de despachos`.
5. Ejecutar `Run workflow` sobre esa rama.
6. Confirmar que `facturas.json` se llena.
7. Abrir `control-despachos.html`.
8. Crear y autorizar el proyecto de Google Apps Script siguiendo los pasos de configuración.
9. Ejecutar `probarEnvioReporteGT` y `probarEnvioReporteSV`; confirmar que llegue un correo por país.
10. Ejecutar `instalarEnvioDiarioGT` e `instalarEnvioDiarioSV` para activar ambos envíos diarios.

## Pendiente de registro

Todavía debe registrarse el módulo en:
- `assets/js/dashboards.js`
- `dashboard_centralizado.html` si el menú requiere entrada manual.

Ese paso conviene hacerlo con las versiones actuales de esos archivos para no pisar cambios recientes.

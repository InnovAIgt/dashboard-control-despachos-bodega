# Integración — Control de despachos de bodega

Paquete preparado para `Prototipado_Dashboard_Intelfon`.

## Estructura

```text
dashboards/bodega/control-despachos/control-despachos.html
dashboards/bodega/control-despachos/data/facturas.json
scripts/actualizar-despachos.js
scripts/enviar-reporte-sla.js
.github/workflows/actualizar-despachos.yml
.github/workflows/enviar-reporte-sla.yml
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

## Envío diario del reporte SLA por correo

`.github/workflows/enviar-reporte-sla.yml` envía el reporte diariamente a las 8:00 a. m. de Guatemala
y El Salvador (14:00 UTC). También se puede ejecutar manualmente desde
`Actions -> Enviar reporte diario de SLA`.
El correo incluye los indicadores globales y la tabla completa de reclamos abiertos; no depende del
país seleccionado en el navegador. El destinatario configurado actualmente es
`fernandozetatrading@gmail.com`; para cambiarlo, edita `SLA_EMAIL_TO` en el workflow.

Configurar en GitHub, en `Settings -> Secrets and variables -> Actions`:

**Variables** (se pueden modificar sin cambiar el código):

- `SLA_SMTP_HOST`: `smtp.office365.com` para Outlook/Microsoft 365 o `smtp.gmail.com` para Gmail.
- `SLA_SMTP_PORT`: `587` para Outlook/Microsoft 365 o `465` para Gmail.
- `SLA_SMTP_SECURE`: `false` para puerto 587 o `true` para puerto 465.
- `SLA_EMAIL_FROM`: opcional; por defecto se usa `SLA_SMTP_USER`.

**Secrets** (credenciales privadas; no agregarlas al repositorio):

- `SLA_SMTP_USER`: cuenta remitente de correo.
- `SLA_SMTP_PASSWORD`: contraseña de aplicación o credencial SMTP autorizada para esa cuenta.

Para Gmail, usar una contraseña de aplicación y tener habilitada la verificación en dos pasos. Para
Microsoft 365, la cuenta/tenant debe permitir SMTP AUTH. Si la organización bloquea SMTP, se debe
habilitar con el administrador o utilizar un servidor SMTP autorizado.

El workflow falla de forma visible si falta una variable/credencial o si el servidor rechaza el envío.
La ejecución manual envía un correo real a los destinatarios configurados; probar primero con una
dirección controlada.

## Prueba antes del merge

1. Copiar esta estructura a la rama de trabajo.
2. Configurar `SAP_API_KEY`.
3. Subir la rama.
4. Ir a `Actions -> Actualizar datos de despachos`.
5. Ejecutar `Run workflow` sobre esa rama.
6. Confirmar que `facturas.json` se llena.
7. Abrir `control-despachos.html`.
8. Configurar las variables y secretos del correo descritos arriba.
9. Ejecutar manualmente `Enviar reporte diario de SLA` y confirmar la recepción en
   `fernandozetatrading@gmail.com`.

## Pendiente de registro

Todavía debe registrarse el módulo en:
- `assets/js/dashboards.js`
- `dashboard_centralizado.html` si el menú requiere entrada manual.

Ese paso conviene hacerlo con las versiones actuales de esos archivos para no pisar cambios recientes.

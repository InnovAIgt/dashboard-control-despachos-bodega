# Integración — Control de despachos de bodega

Paquete preparado para `Prototipado_Dashboard_Intelfon`.

## Estructura

```text
dashboards/bodega/control-despachos/control-despachos.html
dashboards/bodega/control-despachos/data/facturas.json
scripts/actualizar-despachos.js
.github/workflows/actualizar-despachos.yml
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

## Prueba antes del merge

1. Copiar esta estructura a la rama de trabajo.
2. Configurar `SAP_API_KEY`.
3. Subir la rama.
4. Ir a `Actions -> Actualizar datos de despachos`.
5. Ejecutar `Run workflow` sobre esa rama.
6. Confirmar que `facturas.json` se llena.
7. Abrir `control-despachos.html`.

## Pendiente de registro

Todavía debe registrarse el módulo en:
- `assets/js/dashboards.js`
- `dashboard_centralizado.html` si el menú requiere entrada manual.

Ese paso conviene hacerlo con las versiones actuales de esos archivos para no pisar cambios recientes.

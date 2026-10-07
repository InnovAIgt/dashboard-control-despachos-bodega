'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(
  ROOT,
  'dashboards',
  'bodega',
  'control-despachos',
  'data',
  'facturas.json'
);

const CONFIG = {
  api: {
    urlPlantilla:
      process.env.SAP_API_URL ||
      'https://sapapi.red.com.sv/api/Procesos/facturasyear?year={year}&var_pais={pais}',
    year: Number(process.env.SAP_YEAR || 2026),
    paises: (process.env.SAP_PAISES || 'GT,SV')
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean),
    auth: {
      tipo: (process.env.SAP_AUTH_TYPE || 'header').toLowerCase(),
      token: process.env.SAP_API_KEY || '',
      headerNombre: process.env.SAP_HEADER_NAME || 'X-API-Key',
      queryParam: process.env.SAP_QUERY_PARAM || 'token'
    },
    timeoutMs: Number(process.env.SAP_TIMEOUT_MS || 20000),
    agruparPorFactura:
      String(process.env.SAP_AGRUPAR_POR_FACTURA || 'true').toLowerCase() !== 'false'
  },
  rutaLista: process.env.SAP_RUTA_LISTA || '',
  intervaloMin: Number(process.env.SAP_INTERVALO_MIN || 5),
  campos: {
    pais: process.env.SAP_CAMPO_PAIS || '',
    numeroFactura: process.env.SAP_CAMPO_FACTURA || '',
    fechaEmision: process.env.SAP_CAMPO_EMISION || '',
    fechaDespacho: process.env.SAP_CAMPO_DESPACHO || '',
    estatus: process.env.SAP_CAMPO_ESTATUS || '',
    codigoCliente: process.env.SAP_CAMPO_CODIGO_CLIENTE || '',
    nombreCliente: process.env.SAP_CAMPO_NOMBRE_CLIENTE || '',
    totalFactura: process.env.SAP_CAMPO_TOTAL || ''
  }
};

const VARIANTES = {
  pais: ['pais','Pais','PAIS','PAIS_CODIGO','paisCodigo','codigoPais','country','PaisID',
         'Pais_Codigo','pais_id','PaisId','ID_PAIS','paisCod'],
  numeroFactura: ['numeroFactura','NumeroFactura','numero_factura','NUM_FACTURA','Num_Factura',
                  'nFactura','nfactura','N_FACTURA','factura','FACTURA','Factura',
                  'numFactura','NumFactura','docNumero','NUMERO_FACTURA','numeroFact',
                  'NUM_DOCUMENTO','documento','Documento','noFactura','N_FACT'],
  fechaEmision: ['fechaEmision','FechaEmision','fecha_emision','FECHA_EMISION','Fecha_Emision',
                 'emision','Emision','EMISION','emission','Emission','fecha','Fecha','FECHA',
                 'fechaEmi','FECHA_EMI','fecha_emi','docDate','fecha_documento'],
  fechaDespacho: ['fechaDespacho','FechaDespacho','fecha_despacho','FECHA_DESPACHO',
                  'Fecha_Despacho','despacho','Despacho','DESPACHO','dispatch','Dispatch',
                  'fechaDesp','FECHA_DESP','fecha_desp','deliveryDate','fecha_entrega'],
  estatus: ['estatus','Estatus','ESTATUS','estado','Estado','ESTADO','status','Status','STATUS',
            'situacion','Situacion','estadoFactura','ESTADO_FACTURA'],
  codigoCliente: ['codigoCliente','CodigoCliente','codigo_cliente','CODIGO_CLIENTE','Codigo_Cliente',
                  'cliente','Cliente','CLIENTE','codCli','COD_CLIENTE','customerCode',
                  'codigo_cliente_id','CLIENTE_CODIGO'],
  nombreCliente: ['nombreCliente','NombreCliente','nombre_cliente','NOMBRE_CLIENTE','Nombre_Cliente',
                  'clienteNombre','nombreClienteText','NOMBRE_CLIENTE_TEXTO',
                  'RazonSocial','razonSocial','razon_social','RAZON_SOCIAL','razon',
                  'descripcionCliente','DESCRIPCION_CLIENTE','nombre','Nombre','NOMBRE',
                  'customerName','nombreClienteDescripcion'],
  totalFactura: ['totalFactura','TotalFactura','total_factura','TOTAL_FACTURA','Total_Factura',
                 'total','Total','TOTAL','monto','Monto','MONTO','importe','Importe','IMPORTE',
                 'valor','Valor','monedaTotal','MONEDA_TOTAL','totalMonto','TOTAL_MONTO',
                 'montoTotal','totalNeto','TOTAL_NETO','totalConImpuestos','TOTAL_FACT']
};

function leerCampo(fila, campo) {
  const preferido = CONFIG.campos[campo];
  if (preferido && fila[preferido] !== undefined) return fila[preferido];

  for (const alt of VARIANTES[campo] || []) {
    if (fila[alt] !== undefined && fila[alt] !== null && fila[alt] !== '') {
      return fila[alt];
    }
  }
  return undefined;
}

function normalizarFecha(v) {
  if (!v && v !== 0) return '';
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);

  if (typeof v === 'number') {
    const ms = Math.round((v - 25569) * 86400000);
    return new Date(ms).toISOString().slice(0, 10);
  }

  let s = String(v).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) {
    return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
  }

  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];

  return s;
}

function normalizarNumero(v) {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number') return v;

  let s = String(v).replace(/[^0-9.,-]/g, '');
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function normalizarPais(v) {
  const s = String(v || '').trim().toUpperCase();

  if (s === 'GT' || s.startsWith('GUATEMALA') || s === '1') return 'GT';
  if (s === 'SV' || s.startsWith('EL SALVADOR') || s.startsWith('SALVADOR') || s === '2') return 'SV';

  return s || 'GT';
}

function extraerLista(json) {
  if (Array.isArray(json)) return json;

  if (json && typeof json === 'object') {
    if (CONFIG.rutaLista && Array.isArray(json[CONFIG.rutaLista])) {
      return json[CONFIG.rutaLista];
    }

    for (const k of Object.keys(json)) {
      if (Array.isArray(json[k])) return json[k];
    }
  }

  return [];
}

function construirUrl(pais) {
  return CONFIG.api.urlPlantilla
    .replace('{year}', encodeURIComponent(CONFIG.api.year))
    .replace('{pais}', encodeURIComponent(pais));
}

function cabecerasAuth() {
  const a = CONFIG.api.auth;
  const h = { Accept: 'application/json' };

  if (!a.token || a.tipo === 'ninguno') return h;
  if (a.tipo === 'bearer') h.Authorization = 'Bearer ' + a.token;
  if (a.tipo === 'header') h[a.headerNombre || 'X-API-Key'] = a.token;

  return h;
}

async function consultarPais(pais) {
  let url = construirUrl(pais);
  const a = CONFIG.api.auth;

  if (a.token && a.tipo === 'query') {
    url +=
      (url.includes('?') ? '&' : '?') +
      encodeURIComponent(a.queryParam || 'token') +
      '=' +
      encodeURIComponent(a.token);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.api.timeoutMs);

  try {
    const r = await fetch(url, {
      headers: cabecerasAuth(),
      signal: ctrl.signal
    });

    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + r.statusText);

    const txt = await r.text();
    let json;

    try {
      json = JSON.parse(txt);
    } catch (_) {
      throw new Error('La respuesta no es JSON válido');
    }

    return extraerLista(json);
  } finally {
    clearTimeout(timer);
  }
}

function procesarFilas(filasCrudas, paisPorDefecto) {
  const mapa = new Map();

  for (const fila of filasCrudas) {
    if (!fila || typeof fila !== 'object') continue;

    const num = leerCampo(fila, 'numeroFactura');
    if (num === undefined || num === null || num === '') continue;

    const clave = String(num).trim();
    const pais = normalizarPais(leerCampo(fila, 'pais') || paisPorDefecto);

    const registro = {
      pais,
      numeroFactura: clave,
      fechaEmision: normalizarFecha(leerCampo(fila, 'fechaEmision')),
      fechaDespacho: normalizarFecha(leerCampo(fila, 'fechaDespacho')),
      estatus: String(leerCampo(fila, 'estatus') || '').trim(),
      codigoCliente: String(leerCampo(fila, 'codigoCliente') || '').trim(),
      nombreCliente: String(leerCampo(fila, 'nombreCliente') || '').trim(),
      totalFactura: normalizarNumero(leerCampo(fila, 'totalFactura')),
      docEntry: normalizarNumero(fila.docEntry || fila.DocEntry || fila.DOCENTRY)
    };

    if (CONFIG.api.agruparPorFactura) {
      if (mapa.has(clave)) {
        const prev = mapa.get(clave);
        prev.totalFactura += registro.totalFactura;

        if (!prev.fechaDespacho && registro.fechaDespacho) prev.fechaDespacho = registro.fechaDespacho;
        if (!prev.estatus && registro.estatus) prev.estatus = registro.estatus;
        if (!prev.nombreCliente && registro.nombreCliente) prev.nombreCliente = registro.nombreCliente;
        if (!prev.codigoCliente && registro.codigoCliente) prev.codigoCliente = registro.codigoCliente;
        if (prev.pais !== registro.pais) prev.pais = registro.pais;
      } else {
        mapa.set(clave, registro);
      }
    } else {
      mapa.set(clave + '#' + mapa.size, registro);
    }
  }

  return Array.from(mapa.values());
}

function leerAnterior() {
  try {
    if (!fs.existsSync(OUTPUT)) return null;
    return JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
  } catch (_) {
    return null;
  }
}

function estable(value) {
  return JSON.stringify(value);
}

async function main() {
  if (!CONFIG.api.auth.token && CONFIG.api.auth.tipo !== 'ninguno') {
    throw new Error(
      'Falta SAP_API_KEY. Configurá el secreto en GitHub Actions.'
    );
  }

  const anterior = leerAnterior();
  const prevFacturas = Array.isArray(anterior?.facturas) ? anterior.facturas : [];
  const prevPorPais = new Map(
    CONFIG.api.paises.map(p => [p, prevFacturas.filter(f => f.pais === p)])
  );

  const todas = [];
  const errores = [];
  let huboRespuestaNueva = false;

  console.log('Actualizando Control de Despachos...');
  console.log('Año:', CONFIG.api.year);
  console.log('Países:', CONFIG.api.paises.join(', '));

  for (const pais of CONFIG.api.paises) {
    try {
      const filas = await consultarPais(pais);
      if (!filas.length) throw new Error('la API no devolvió registros');

      const facturas = procesarFilas(filas, pais);
      todas.push(...facturas);
      huboRespuestaNueva = true;

      console.log(`✓ ${pais}: ${filas.length} filas -> ${facturas.length} facturas`);
    } catch (e) {
      const msg = `${pais}: ${e.message || e}`;
      errores.push(msg);
      console.error('✗', msg);

      const respaldoPais = prevPorPais.get(pais) || [];
      if (respaldoPais.length) {
        todas.push(...respaldoPais);
        console.log(`  ↳ se conservan ${respaldoPais.length} facturas del snapshot anterior`);
      }
    }
  }

  if (!todas.length) {
    throw new Error(
      'No se obtuvieron datos de SAP y no existe un snapshot anterior utilizable.'
    );
  }

  todas.sort((a, b) => {
    if (a.pais !== b.pais) return a.pais.localeCompare(b.pais);
    return String(a.numeroFactura).localeCompare(
      String(b.numeroFactura),
      'es',
      { numeric: true }
    );
  });

  const errorTexto = errores.length ? errores.join(' | ') : null;
  const prevError = anterior?.meta?.error || null;
  const datosCambiaron = estable(todas) !== estable(prevFacturas);
  const errorCambio = errorTexto !== prevError;
  const primeraVez = !anterior || !Array.isArray(anterior.facturas);

  if (!primeraVez && !datosCambiaron && !errorCambio) {
    console.log('Sin cambios. No se modifica facturas.json.');
    return;
  }

  const ahora = new Date().toISOString();
  const salida = {
    ok: todas.length > 0,
    facturas: todas,
    meta: {
      ultimoExito: huboRespuestaNueva
        ? ahora
        : (anterior?.meta?.ultimoExito || null),
      ultimoIntento: ahora,
      intervaloMin: CONFIG.intervaloMin,
      fuente: errores.length ? 'API + snapshot anterior' : 'API',
      error: errorTexto
    }
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(salida, null, 2) + '\n', 'utf8');

  console.log(
    `Snapshot actualizado: ${todas.length} facturas -> ${path.relative(ROOT, OUTPUT)}`
  );

  if (errores.length) console.warn('Advertencia:', errorTexto);
}

main().catch(err => {
  console.error('ERROR:', err.message || err);
  process.exitCode = 1;
});

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { escapeHtml, renderEmail, slaStatus } = require('../scripts/enviar-reporte-sla');

test('renders all-invoice KPIs and only open claims in the email detail', () => {
  const data = {
    facturas: [
      {
        pais: 'GT',
        numeroFactura: 'OPEN-<1>',
        fechaEmision: '2026-10-05',
        estatus: 'Abierta',
        nombreCliente: '<Cliente & Asociados>'
      },
      {
        pais: 'SV',
        numeroFactura: 'CLOSED-2',
        fechaEmision: '2026-10-06',
        fechaDespacho: '2026-10-07',
        estatus: 'Cerrada',
        nombreCliente: 'Cliente cerrado'
      },
      {
        pais: 'GT',
        numeroFactura: 'OPEN-3',
        fechaEmision: '2026-10-04',
        fechaDespacho: '2026-10-07',
        estatus: 'Abierta',
        nombreCliente: 'Cliente por vencer'
      },
      {
        pais: 'GT',
        numeroFactura: 'CLOSED-4',
        fechaEmision: '2026-10-02',
        fechaDespacho: '2026-10-07',
        estatus: 'Cerrada',
        nombreCliente: 'Cliente vencido'
      }
    ],
    meta: { ultimoExito: '2026-10-07T04:38:43.855Z' }
  };

  const html = renderEmail(data, new Date('2026-10-07T16:00:00Z'), '2026-10-07');
  const detailTable = html.slice(html.indexOf('<h2 style="margin-top:24px'), html.indexOf('</table>', html.indexOf('<h2 style="margin-top:24px')));

  assert.match(html, /SLA global/);
  assert.match(html, />25\.0%<\/div>/);
  assert.match(html, />4<\/div>/);
  assert.match(html, />1<\/div>/);
  assert.match(html, />2<\/div>/);
  assert.match(detailTable, /OPEN-&lt;1&gt;/);
  assert.match(detailTable, /&lt;Cliente &amp; Asociados&gt;/);
  assert.match(detailTable, /OPEN-3/);
  assert.doesNotMatch(detailTable, /CLOSED-2|CLOSED-4/);
  assert.equal((detailTable.match(/<tr>/g) || []).length, 2);
});

test('classifies undelivered invoices against the report date', () => {
  assert.equal(
    slaStatus({ fechaEmision: '2026-10-04' }, '2026-10-07').label,
    'Por vencer'
  );
  assert.equal(
    slaStatus({ fechaEmision: '2026-10-02' }, '2026-10-07').label,
    'Vencido'
  );
});

test('escapes dynamic HTML values', () => {
  assert.equal(escapeHtml(`<a title="x">&'`), '&lt;a title=&quot;x&quot;&gt;&amp;&#39;');
});

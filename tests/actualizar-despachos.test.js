'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { promisify } = require('node:util');

const execFile = promisify(childProcess.execFile);
const updaterPath = path.join(__dirname, '..', 'scripts', 'actualizar-despachos.js');

test('updates the successful API timestamp when invoice data is unchanged', async t => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'actualizar-despachos-'));
  const tempUpdater = path.join(tempRoot, 'scripts', 'actualizar-despachos.js');
  const snapshotPath = path.join(
    tempRoot,
    'dashboards',
    'bodega',
    'control-despachos',
    'data',
    'facturas.json'
  );
  fs.mkdirSync(path.dirname(tempUpdater), { recursive: true });
  fs.copyFileSync(updaterPath, tempUpdater);

  const server = http.createServer((request, response) => {
    const country = new URL(request.url, 'http://localhost').searchParams.get('var_pais');
    response.setHeader('Content-Type', 'application/json');
    const invoiceRows = [{
      pais: country,
      numeroFactura: country + '-123',
      fechaEmision: '2026-01-01',
      fechaDespacho: '',
      estatus: 'Abierta',
      codigoCliente: 'C1',
      nombreCliente: 'Cliente de prueba',
      totalFactura: 10,
      docEntry: 123,
      ItemCode: 'RADIO-X',
      Dscription: 'Radio portátil modelo X',
      Quantity: 4,
      Model: 'X',
      SerialNumbers: [{ InternalSerialNumber: 'SERIE-001' }]
    }];
    if (country === 'GT') {
      invoiceRows.push({
        ...invoiceRows[0],
        ItemCode: 'BATERIA-X',
        Dscription: 'Batería para radio modelo X',
        Quantity: 4,
        SerialNumbers: [{ InternalSerialNumber: 'SERIE-002' }]
      });
    }
    response.end(JSON.stringify(invoiceRows));
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const env = {
    ...process.env,
    SAP_API_URL: `http://127.0.0.1:${server.address().port}/?year={year}&var_pais={pais}`,
    SAP_API_KEY: 'test-token',
    SAP_AUTH_TYPE: 'header'
  };
  const runUpdater = () => execFile(process.execPath, [tempUpdater], { env });

  await runUpdater();
  const firstSnapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const originalInvoices = firstSnapshot.facturas;
  const guatemalaInvoice = originalInvoices.find(invoice => invoice.pais === 'GT');
  assert.equal(guatemalaInvoice.detalleArticulos.length, 2);
  assert.equal(guatemalaInvoice.detalleArticulos[0].ItemCode, 'RADIO-X');
  assert.equal(guatemalaInvoice.detalleArticulos[0].Quantity, 4);
  assert.deepEqual(
    guatemalaInvoice.detalleArticulos[0].SerialNumbers,
    [{ InternalSerialNumber: 'SERIE-001' }]
  );
  firstSnapshot.meta.ultimoExito = '2000-01-01T00:00:00.000Z';
  fs.writeFileSync(snapshotPath, JSON.stringify(firstSnapshot));

  await runUpdater();
  const refreshedSnapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

  assert.deepEqual(refreshedSnapshot.facturas, originalInvoices);
  assert.notEqual(refreshedSnapshot.meta.ultimoExito, '2000-01-01T00:00:00.000Z');
});

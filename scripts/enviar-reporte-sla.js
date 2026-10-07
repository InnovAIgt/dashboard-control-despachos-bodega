'use strict';

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const DATA_FILE = path.resolve(
  __dirname,
  '..',
  'dashboards',
  'bodega',
  'control-despachos',
  'data',
  'facturas.json'
);
const TIME_ZONE = 'America/Guatemala';
const numberFormatter = new Intl.NumberFormat('es-GT');
const dateFormatter = new Intl.DateTimeFormat('es-GT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC'
});
const dateTimeFormatter = new Intl.DateTimeFormat('es-GT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE
});

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function elapsedDays(start, end) {
  const startTime = parseDate(start);
  const endTime = parseDate(end);
  if (startTime === null || endTime === null || endTime < startTime) return null;
  return Math.floor((endTime - startTime) / 86400000);
}

function slaStatus(invoice, reportDate) {
  const days = elapsedDays(invoice.fechaEmision, invoice.fechaDespacho || reportDate);
  if (days === null) return { label: 'Sin fecha válida', color: '#92400e' };
  if (!invoice.fechaDespacho && days <= 2) return { label: 'Sin despacho', color: '#92400e' };
  if (days <= 2) return { label: 'En tiempo', color: '#166534' };
  if (days === 3) return { label: 'Por vencer', color: '#92400e' };
  return { label: 'Vencido', color: '#991b1b' };
}

function formatDate(value) {
  const timestamp = parseDate(value);
  return timestamp === null ? '—' : dateFormatter.format(timestamp);
}

function renderEmail(data, generatedAt, reportDate) {
  const invoices = data.facturas;
  const counts = { 'En tiempo': 0, 'Por vencer': 0, Vencido: 0 };

  invoices.forEach(invoice => {
    const label = slaStatus(invoice, reportDate).label;
    if (Object.prototype.hasOwnProperty.call(counts, label)) counts[label]++;
  });

  const openInvoices = invoices.filter(invoice =>
    String(invoice.estatus || '').trim().toLowerCase() === 'abierta'
  );
  const globalSla = invoices.length
    ? (counts['En tiempo'] / invoices.length * 100).toFixed(1)
    : '0.0';

  const cards = [
    ['SLA global', globalSla + '%', '#166534'],
    ['Facturas emitidas', numberFormatter.format(invoices.length), '#1d4ed8'],
    ['Despachos en tiempo', numberFormatter.format(counts['En tiempo']), '#166534'],
    ['Por vencer', numberFormatter.format(counts['Por vencer']), '#92400e'],
    ['Vencidas', numberFormatter.format(counts.Vencido), '#991b1b'],
    ['Reclamos abiertos', numberFormatter.format(openInvoices.length), '#991b1b']
  ];
  const cardHtml = cards.map(card =>
    '<td style="width:33.33%;padding:7px;vertical-align:top">' +
      '<div style="padding:15px;border:1px solid #e2e8f0;border-top:4px solid ' + card[2] +
        ';border-radius:8px;background:#f8fafc">' +
        '<div style="color:#475569;font-size:11px;font-weight:bold;text-transform:uppercase">' +
          card[0] + '</div>' +
        '<div style="margin-top:8px;color:#0f172a;font-size:23px;font-weight:bold">' +
          card[1] + '</div>' +
      '</div>' +
    '</td>'
  );

  const rows = openInvoices.length
    ? openInvoices.map(invoice => {
      const status = slaStatus(invoice, reportDate);
      return '<tr>' +
        '<td style="padding:9px;border-top:1px solid #e2e8f0">' + escapeHtml(invoice.pais || '—') + '</td>' +
        '<td style="padding:9px;border-top:1px solid #e2e8f0;color:#1d4ed8;font-weight:bold">' +
          escapeHtml(invoice.numeroFactura || '—') + '</td>' +
        '<td style="padding:9px;border-top:1px solid #e2e8f0">' +
          escapeHtml(invoice.nombreCliente || '—') + '</td>' +
        '<td style="padding:9px;border-top:1px solid #e2e8f0">' +
          escapeHtml(formatDate(invoice.fechaEmision)) + '</td>' +
        '<td style="padding:9px;border-top:1px solid #e2e8f0;color:' + status.color +
          ';font-weight:bold">' + escapeHtml(status.label) + '</td>' +
      '</tr>';
    }).join('')
    : '<tr><td colspan="5" style="padding:12px;text-align:center;color:#64748b">' +
        'No hay reclamos abiertos.</td></tr>';

  const lastUpdateDate = data.meta && data.meta.ultimoExito
    ? new Date(data.meta.ultimoExito)
    : null;
  const lastUpdate = lastUpdateDate && !Number.isNaN(lastUpdateDate.getTime())
    ? dateTimeFormatter.format(lastUpdateDate)
    : 'Sin actualización registrada';
  const sourceWarning = data.meta && data.meta.error
    ? '<p style="padding:12px;color:#991b1b;background:#fef2f2;border:1px solid #fecaca">' +
        'Aviso: el API reportó un error en la última actualización. Se envían los datos guardados.</p>'
    : '';

  return '<!doctype html><html lang="es"><body style="margin:0;padding:20px;background:#f1f5f9;' +
    'font-family:Segoe UI,Arial,sans-serif;color:#0f172a">' +
    '<main style="max-width:1000px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;' +
      'border-radius:12px;overflow:hidden">' +
      '<header style="padding:24px 28px;color:#fff;background:#1d4ed8">' +
        '<div style="font-size:11px;color:#bfdbfe;font-weight:bold;text-transform:uppercase">' +
          'Red Intelfon · Operación de bodega</div>' +
        '<h1 style="margin:8px 0;font-size:24px">Reporte diario de SLA de despachos</h1>' +
        '<div>Generado: ' + escapeHtml(dateTimeFormatter.format(generatedAt)) +
          ' · Datos del API: ' + escapeHtml(lastUpdate) + ' (hora de Guatemala)</div>' +
      '</header>' +
      '<section style="padding:20px 22px">' +
        sourceWarning +
        '<h2 style="font-size:17px">Indicadores globales · Todos los países</h2>' +
        '<table role="presentation" style="width:100%;border-collapse:collapse"><tbody>' +
          '<tr>' + cardHtml.slice(0, 3).join('') + '</tr>' +
          '<tr>' + cardHtml.slice(3).join('') + '</tr>' +
        '</tbody></table>' +
        '<h2 style="margin-top:24px;font-size:17px">Detalle de reclamos abiertos</h2>' +
        '<p style="color:#64748b;font-size:12px">Se incluyen únicamente facturas con estatus Abierta.</p>' +
        '<table style="width:100%;border-collapse:collapse;text-align:left;font-size:12px">' +
          '<thead><tr style="background:#f8fafc;color:#475569">' +
            '<th style="padding:10px">País</th><th style="padding:10px">Número de factura</th>' +
            '<th style="padding:10px">Nombre del cliente</th><th style="padding:10px">Fecha de emisión</th>' +
            '<th style="padding:10px">Estado del SLA</th>' +
          '</tr></thead><tbody>' + rows + '</tbody>' +
        '</table>' +
      '</section>' +
      '<footer style="padding:14px;color:#94a3b8;background:#f8fafc;text-align:center;font-size:10px">' +
        'Reporte automático de seguimiento de despachos</footer>' +
    '</main></body></html>';
}

async function main() {
  const recipients = (process.env.SLA_EMAIL_TO || '')
    .split(/[;,]/)
    .map(email => email.trim())
    .filter(Boolean);
  const host = (process.env.SLA_SMTP_HOST || '').trim();
  const username = process.env.SLA_SMTP_USER;
  const password = process.env.SLA_SMTP_PASSWORD;

  if (!recipients.length) throw new Error('Configura la variable SLA_EMAIL_TO en GitHub Actions.');
  if (!host || !username || !password) {
    throw new Error('Configura SLA_SMTP_HOST, SLA_SMTP_USER y SLA_SMTP_PASSWORD antes del envío.');
  }

  const rawData = fs.readFileSync(DATA_FILE, 'utf8');
  const data = JSON.parse(rawData);
  if (!data || !Array.isArray(data.facturas)) {
    throw new Error('El snapshot no contiene una lista válida de facturas.');
  }

  const generatedAt = new Date();
  const reportDate = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(generatedAt);
  const port = Number(process.env.SLA_SMTP_PORT || 587);
  const secure = String(process.env.SLA_SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: { user: username, pass: password }
  });
  const subjectDate = new Intl.DateTimeFormat('es-GT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TIME_ZONE
  }).format(generatedAt);

  await transporter.sendMail({
    from: process.env.SLA_EMAIL_FROM || username,
    to: recipients,
    subject: 'Reporte diario de SLA de despachos · ' + subjectDate,
    html: renderEmail(data, generatedAt, reportDate)
  });

  console.log('Reporte enviado a ' + recipients.length + ' destinatario(s).');
}

if (require.main === module) {
  main().catch(error => {
    console.error('No se pudo enviar el reporte SLA:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { escapeHtml, renderEmail, slaStatus };

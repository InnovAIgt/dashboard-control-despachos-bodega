const DESTINATARIO_REPORTE_SV = 'fernandozetatrading@gmail.com';
const URL_REPORTE_SOLO_SV =
  'https://innovaigt.github.io/dashboard-control-despachos-bodega/reports/reporteSLA.html?pais=SV';
const ZONA_HORARIA_REPORTE_SV = 'America/Guatemala';

function enviarReporteSV() {
  const fecha = Utilities.formatDate(new Date(), ZONA_HORARIA_REPORTE_SV, 'dd/MM/yyyy');
  const hora = Utilities.formatDate(new Date(), ZONA_HORARIA_REPORTE_SV, 'HH:mm');

  GmailApp.sendEmail(
    DESTINATARIO_REPORTE_SV,
    'Reporte diario de SLA · El Salvador · ' + fecha,
    'El reporte SLA de El Salvador está disponible en: ' + URL_REPORTE_SOLO_SV,
    {
      htmlBody: construirCorreoReporteSV(fecha, hora),
      name: 'Reporte SLA · El Salvador'
    }
  );

  console.log('Reporte SLA de El Salvador enviado a ' + DESTINATARIO_REPORTE_SV);
}

function probarEnvioReporteSV() {
  enviarReporteSV();
}

function instalarEnvioDiarioSV() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    const handler = trigger.getHandlerFunction();
    if (handler === 'enviarReporteSV' || handler === 'enviarReporteSLA') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('enviarReporteSV')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .inTimezone(ZONA_HORARIA_REPORTE_SV)
    .create();
}

function construirCorreoReporteSV(fecha, hora) {
  return '<!doctype html><html lang="es"><body style="margin:0;padding:24px;' +
    'background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0">' +
    '<tr><td align="center"><table role="presentation" width="600" cellspacing="0" ' +
    'cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e2e8f0;' +
    'border-radius:12px;overflow:hidden"><tr><td style="padding:24px 28px;color:#fff;' +
    'background:linear-gradient(135deg,#0f172a,#1d4ed8)">' +
    '<div style="color:#bfdbfe;font-size:11px;font-weight:bold;letter-spacing:1px;' +
    'text-transform:uppercase">Red Intelfon · El Salvador</div>' +
    '<h1 style="margin:10px 0 6px;font-size:24px">Reporte diario de SLA</h1>' +
    '<div style="color:#dbeafe;font-size:13px">' +
    escaparHtmlReporteSV(fecha) + ' · ' + escaparHtmlReporteSV(hora) +
    '</div></td></tr><tr><td style="padding:26px 28px">' +
    '<p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6">' +
    'Consulta las solicitudes de despacho abiertas de El Salvador, sus indicadores SLA y el detalle actualizado.</p>' +
    '<table role="presentation" cellspacing="0" cellpadding="0"><tr><td ' +
    'style="border-radius:7px;background:#1d4ed8"><a href="' + URL_REPORTE_SOLO_SV +
    '" style="display:inline-block;padding:13px 20px;color:#fff;font-size:14px;' +
    'font-weight:bold;text-decoration:none">Abrir reporte El Salvador</a>' +
    '</td></tr></table><p style="margin:20px 0 0;color:#64748b;font-size:11px;' +
    'line-height:1.5">El reporte se abre en el navegador; no se adjuntan archivos.</p>' +
    '</td></tr></table></td></tr></table></body></html>';
}

function escaparHtmlReporteSV(valor) {
  return String(valor == null ? '' : valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const appsScriptDirectory = path.join(__dirname, '..', 'apps-script');
const reportUrls = {
  GT: 'https://innovaigt.github.io/dashboard-control-despachos-bodega/reports/reporteSLA.html?pais=GT',
  SV: 'https://innovaigt.github.io/dashboard-control-despachos-bodega/reports/reporteSLA.html?pais=SV'
};

function loadCountryScripts() {
  const sentEmails = [];
  const makeTrigger = handler => ({
    handler,
    getHandlerFunction() { return this.handler; }
  });
  const triggers = [makeTrigger('enviarReporteSLA')];
  const context = {
    console,
    GmailApp: {
      sendEmail(...args) {
        sentEmails.push(args);
      }
    },
    Utilities: {
      formatDate(date, timeZone, pattern) {
        assert.equal(timeZone, 'America/Guatemala');
        return pattern === 'dd/MM/yyyy' ? '07/10/2026' : '08:00';
      }
    },
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger(trigger) {
        const index = triggers.indexOf(trigger);
        if (index !== -1) triggers.splice(index, 1);
      },
      newTrigger(handler) {
        const trigger = makeTrigger(handler);
        return {
          timeBased() { return this; },
          everyDays() { return this; },
          atHour(hour) { trigger.hour = hour; return this; },
          inTimezone(timeZone) { trigger.timeZone = timeZone; return this; },
          create() { triggers.push(trigger); }
        };
      }
    }
  };

  vm.createContext(context);
  const scriptPaths = [
    path.join(appsScriptDirectory, 'EnviarReporteGT.gs'),
    path.join(appsScriptDirectory, 'EnviarReporteSV.gs')
  ];
  for (const scriptPath of scriptPaths) {
    vm.runInContext(fs.readFileSync(scriptPath, 'utf8'), context, { filename: scriptPath });
  }

  return { context, sentEmails, triggers };
}

test('sends a separate, country-specific email for each report', () => {
  const script = loadCountryScripts();
  script.context.probarEnvioReporteGT();
  script.context.probarEnvioReporteSV();

  assert.equal(script.sentEmails.length, 2);
  const [gt, sv] = script.sentEmails;
  assert.equal(gt[0], 'fernandozetatrading@gmail.com');
  assert.match(gt[1], /Guatemala/);
  assert.ok(gt[2].includes(reportUrls.GT));
  assert.ok(gt[3].htmlBody.includes('href="' + reportUrls.GT + '"'));
  assert.match(gt[3].htmlBody, /Guatemala/);
  assert.equal(gt[3].attachments, undefined);

  assert.equal(sv[0], 'fernandozetatrading@gmail.com');
  assert.match(sv[1], /El Salvador/);
  assert.ok(sv[2].includes(reportUrls.SV));
  assert.ok(sv[3].htmlBody.includes('href="' + reportUrls.SV + '"'));
  assert.match(sv[3].htmlBody, /El Salvador/);
  assert.equal(sv[3].attachments, undefined);
});

test('dashboard locks the report to the country specified in the URL', () => {
  const reportDirectory = path.join(__dirname, '..', 'reports');
  const dashboard = fs.readFileSync(path.join(reportDirectory, 'reporteSLA.html'), 'utf8');
  assert.match(dashboard, /new URLSearchParams\(window\.location\.search\)\.get\("pais"\)/);
  assert.match(dashboard, /document\.body\.dataset\.reportCountry = fixedCountry/);
  assert.match(dashboard, /pais\.value = fixedCountry/);
});

test('shows a country-aware visual SLA legend using the report status thresholds', () => {
  const dashboard = fs.readFileSync(
    path.join(__dirname, '..', 'reports', 'reporteSLA.html'),
    'utf8'
  );
  assert.match(dashboard, /class="sla-guide" aria-label="Leyenda del SLA"/);
  assert.match(dashboard, /id="sla-guide-country"/);
  assert.match(dashboard, /sla-legend-dot ok/);
  assert.match(dashboard, /sla-legend-dot warning/);
  assert.match(dashboard, /sla-legend-dot late/);
  assert.match(dashboard, /sla-legend-dot total/);
  assert.match(dashboard, /En tiempo:<\/strong> de 0 a 2 días/);
  assert.match(dashboard, /Por vencer:<\/strong> día 3/);
  assert.match(dashboard, /Vencida:<\/strong> más de 3 días/);
  assert.match(dashboard, /solicitudes abiertas en tiempo ÷ total de solicitudes abiertas × 100/);
});

test('installs one daily trigger per country and removes the legacy combined trigger', () => {
  const script = loadCountryScripts();
  script.context.instalarEnvioDiarioGT();
  script.context.instalarEnvioDiarioSV();
  script.context.instalarEnvioDiarioGT();
  script.context.instalarEnvioDiarioSV();

  assert.deepEqual(
    script.triggers.map(({ handler, hour, timeZone }) => ({ handler, hour, timeZone })),
    [
      { handler: 'enviarReporteGT', hour: 8, timeZone: 'America/Guatemala' },
      { handler: 'enviarReporteSV', hour: 8, timeZone: 'America/Guatemala' }
    ]
  );
});

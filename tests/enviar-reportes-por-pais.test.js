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

test('refreshes the dashboard snapshot every five minutes without the Guatemala timezone label', () => {
  const dashboard = fs.readFileSync(
    path.join(__dirname, '..', 'reports', 'reporteSLA.html'),
    'utf8'
  );
  const updater = fs.readFileSync(
    path.join(__dirname, '..', 'scripts', 'actualizar-despachos.js'),
    'utf8'
  );
  const workflow = fs.readFileSync(
    path.join(__dirname, '..', '.github', 'workflows', 'actualizar-despachos.yml'),
    'utf8'
  );

  assert.match(dashboard, /window\.setInterval\(loadSnapshot, 5 \* 60 \* 1000\)/);
  assert.match(workflow, /cron: "\*\/5 \* \* \* \*"/);
  assert.match(updater, /!datosCambiaron && !errorCambio && !huboRespuestaNueva/);
  assert.doesNotMatch(dashboard, /hora de Guatemala/);
  assert.match(dashboard, /Actualización del API: <span id="actualizado">/);
});

test('uses the asset logo and swaps country flag and code positions in the header', () => {
  const dashboard = fs.readFileSync(
    path.join(__dirname, '..', 'reports', 'reporteSLA.html'),
    'utf8'
  );
  assert.match(dashboard, /class="header-logo" src="\.\.\/assets\/red256\.webp"/);
  assert.match(dashboard, /class="header-flags" id="header-flags"/);
  assert.match(dashboard, /class="header-country-code" id="header-country-code"/);
  assert.match(dashboard, /"\.\.\/assets\/imagen\.png"/);
  assert.match(dashboard, /"\.\.\/assets\/imagen%20\(1\)\.png"/);
  assert.match(dashboard, /setText\("header-country-code", code \|\| "GT \/ SV"\)/);
});

test('shows a country-aware SLA explanation in a single blue banner', () => {
  const dashboard = fs.readFileSync(
    path.join(__dirname, '..', 'reports', 'reporteSLA.html'),
    'utf8'
  );
  assert.match(dashboard, /<p class="sla-guide">/);
  assert.match(dashboard, /id="sla-guide-country"/);
  assert.match(dashboard, /background: #eff6ff/);
  assert.match(dashboard, /verde significa que la factura abierta tiene de 0 a 2 días/);
  assert.match(dashboard, /amarillo indica que está en el día 3/);
  assert.match(dashboard, /rojo significa que superó los 3 días/);
  assert.match(dashboard, /gris indica el total de facturas abiertas incluidas/);
  const dashboardText = dashboard.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.ok(dashboardText.includes(
    'solicitudes abiertas en tiempo ÷ total de solicitudes abiertas × 100'
  ));
  assert.doesNotMatch(dashboard, /sla-legend-dot/);
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

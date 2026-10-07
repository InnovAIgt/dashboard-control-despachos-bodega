'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scriptPath = path.join(__dirname, '..', 'apps-script', 'EnviarReporteSLA.gs');
const guatemalaReportUrl =
  'https://innovaigt.github.io/dashboard-control-despachos-bodega/reports/reporteSLA-Guatemala.html';
const elSalvadorReportUrl =
  'https://innovaigt.github.io/dashboard-control-despachos-bodega/reports/reporteSLA-El-Salvador.html';

function loadScript() {
  let sentEmail;
  let installedTrigger;
  const context = {
    console,
    GmailApp: {
      sendEmail(...args) {
        sentEmail = args;
      }
    },
    Utilities: {
      formatDate(date, timeZone, pattern) {
        return pattern === 'dd/MM/yyyy' ? '07/10/2026' : '08:00';
      }
    },
    ScriptApp: {
      getProjectTriggers: () => [],
      deleteTrigger() {},
      newTrigger(handler) {
        return {
          timeBased() { return this; },
          everyDays() { return this; },
          atHour(hour) { this.hour = hour; return this; },
          inTimezone(timeZone) { this.timeZone = timeZone; return this; },
          create() {
            installedTrigger = { handler, hour: this.hour, timeZone: this.timeZone };
          }
        };
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(fs.readFileSync(scriptPath, 'utf8'), context);
  return {
    context,
    get sentEmail() { return sentEmail; },
    get installedTrigger() { return installedTrigger; }
  };
}

test('sends a styled email with separate country report buttons', () => {
  const script = loadScript();
  script.context.probarEnvioReporteSLA();

  const [recipient, subject, textBody, options] = script.sentEmail;
  assert.equal(recipient, 'fernandozetatrading@gmail.com');
  assert.match(subject, /07\/10\/2026/);
  assert.ok(textBody.includes(guatemalaReportUrl));
  assert.ok(textBody.includes(elSalvadorReportUrl));
  assert.ok(options.htmlBody.includes('href="' + guatemalaReportUrl + '"'));
  assert.ok(options.htmlBody.includes('href="' + elSalvadorReportUrl + '"'));
  assert.match(options.htmlBody, /Abrir reporte Guatemala/);
  assert.match(options.htmlBody, /Abrir reporte El Salvador/);
  assert.match(options.htmlBody, /facturas abiertas/);
  assert.doesNotMatch(options.htmlBody, /reclamos abiertos/i);
  assert.match(options.htmlBody, /diseño original/);
  assert.equal(options.attachments, undefined);
});

test('installs one daily trigger for 8 a.m. Guatemala time', () => {
  const script = loadScript();
  script.context.instalarEnvioDiarioSLA();

  assert.deepEqual(script.installedTrigger, {
    handler: 'enviarReporteSLA',
    hour: 8,
    timeZone: 'America/Guatemala'
  });
});

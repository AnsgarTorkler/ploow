'use strict';
/* ============================================================
   BUILD-KONFIGURATION PRÜFEN
   electron-builder meldet Konfigurationsfehler erst, wenn der
   Bau schon läuft – nach der ganzen Testreihe und dem Packen.
   Das Schema liegt aber im installierten Paket bereit. Also
   wird hier vorher dagegen geprüft: schlägt es fehl, weiß man
   es in einer Sekunde statt nach zwei Minuten Wartezeit.

   Ohne installierte Entwicklungspakete wird der Abschnitt
   übersprungen, statt fälschlich rot zu werden.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { ok, gleich, gruppe, bilanz } = require('./hilfen');

const wurzel = path.join(__dirname, '..');
const paket = JSON.parse(fs.readFileSync(path.join(wurzel, 'package.json'), 'utf8'));

function ladeSchema() {
  try { return require(path.join(wurzel, 'node_modules', 'app-builder-lib', 'scheme.json')); }
  catch { return null; }
}
function ladeAjv() {
  try { return require(path.join(wurzel, 'node_modules', 'ajv')); }
  catch { return null; }
}

gruppe('Build-Konfiguration gegen das Schema von electron-builder');
const schema = ladeSchema(), Ajv = ladeAjv();

if (!schema || !Ajv) {
  ok(true, 'Übersprungen – electron-builder ist nicht installiert (npm install ausführen)');
} else {
  const ajv = new Ajv({ strict: false, allErrors: true, allowUnionTypes: true, validateFormats: false });
  let pruefe = null, ladefehler = null;
  try { pruefe = ajv.compile(schema); } catch (e) { ladefehler = e.message; }

  if (!pruefe) {
    ok(false, 'Das Schema ließ sich nicht laden: ' + ladefehler);
  } else {
    const gueltig = pruefe(paket.build);
    if (!gueltig) {
      (pruefe.errors || []).slice(0, 12).forEach(f => {
        ok(false, `build${f.instancePath || ''}: ${f.message}` +
          (f.params && f.params.additionalProperty ? ` („${f.params.additionalProperty}")` : ''));
      });
    }
    ok(gueltig, 'Die gesamte "build"-Konfiguration entspricht dem Schema');
  }

  /* Einzelne Stolpersteine, die das Schema zwar zulässt, die aber
     erfahrungsgemäß beim Bauen oder danach Ärger machen. */
  const win = schema.definitions.WindowsConfiguration.properties;
  const sign = schema.definitions.WindowsSigntoolConfiguration.properties;

  ok(!('publisherName' in (paket.build.win || {})),
     'publisherName steht nicht mehr direkt unter "win" – dort gehört es seit Fassung 25 nicht mehr hin');
  ok('publisherName' in sign, 'Sein Platz ist "win.signtoolOptions" (laut Schema)');

  Object.keys(paket.build.win || {}).forEach(k =>
    ok(k in win, `win.${k} ist ein bekannter Schlüssel`));

  const nsis = schema.definitions.NsisOptions.properties;
  Object.keys(paket.build.nsis || {}).forEach(k =>
    ok(k in nsis, `nsis.${k} ist ein bekannter Schlüssel`));
}

gruppe('Dateien, auf die die Konfiguration zeigt');
{
  const pfade = [
    paket.build.win && paket.build.win.icon,
    paket.build.linux && paket.build.linux.icon,
    paket.build.nsis && paket.build.nsis.installerIcon,
    paket.build.nsis && paket.build.nsis.uninstallerIcon,
    paket.build.nsis && paket.build.nsis.license,
    ...(paket.build.fileAssociations || []).map(f => f.icon)
  ].filter(Boolean);

  [...new Set(pfade)].forEach(p =>
    ok(fs.existsSync(path.join(wurzel, p)), `${p} ist vorhanden`));

  ok(fs.existsSync(path.join(wurzel, paket.main)), `Einstiegsdatei ${paket.main} ist vorhanden`);
  ['preload.js', 'index.html', 'src/main/storage.js'].forEach(f =>
    ok(fs.existsSync(path.join(wurzel, f)), `${f} ist vorhanden`));
}

gruppe('Was im Paket landet');
{
  const dateien = paket.build.files || [];
  ['main.js', 'preload.js', 'index.html'].forEach(f =>
    ok(dateien.includes(f), `${f} ist zum Mitliefern eingetragen`));
  ok(dateien.some(f => f.startsWith('src/')), 'Der Ordner src wird mitgeliefert');
  ok(dateien.some(f => f === '!test/**'), 'Die Testreihe wird nicht mitgeliefert');
  ok(dateien.some(f => f.startsWith('build/icon')), 'Das Symbol wird mitgeliefert');
}

bilanz();

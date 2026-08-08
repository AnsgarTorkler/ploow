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

gruppe('Der Bau-Ablauf auf GitHub');
{
  /* npm run dist baut auf Windows nur .exe. .dmg und .AppImage
     entstehen nur auf einem Mac beziehungsweise unter Linux –
     dafür ist dieser Ablauf da. Fehlt er oder stimmt er nicht mit
     der Konfiguration überein, zeigen zwei der vier Knöpfe auf der
     Produktseite ins Leere. */
  const datei = path.join(wurzel, '.github', 'workflows', 'release.yml');
  ok(fs.existsSync(datei), '.github/workflows/release.yml ist vorhanden');
  const w = fs.readFileSync(datei, 'utf8');

  ['windows-latest', 'macos-latest', 'ubuntu-latest'].forEach(s =>
    ok(w.includes(s), 'Es wird auch auf ' + s + ' gebaut'));

  ok(/tags:\s*\n\s*-\s*'v\*'/.test(w), 'Ausgelöst wird von einem Tag der Form v1.2.3');
  ok(/workflow_dispatch/.test(w), 'Und lässt sich von Hand starten');
  ok(/contents:\s*write/.test(w), 'Der Ablauf darf das Release befüllen');
  /* Der Bau veröffentlicht ausdrücklich NICHT. Die erste Fassung liess
     alle drei Systeme gleichzeitig ans Release schreiben – daraus wurden
     zwei Releases für eine Version, und die .dmg ging verloren, während
     ihr Blockmap ankam. Jetzt sammelt ein einziger Job am Ende ein. */
  ok(/--publish never/.test(w), 'Der Bau selbst veröffentlicht nicht');
  ok(!/--publish always/.test(w), 'Kein Job schreibt einzeln ans Release');
  ok(/needs: bauen/.test(w), 'Der Veröffentlichungsjob wartet auf alle drei Systeme');
  ok(/upload-artifact/.test(w) && /download-artifact/.test(w),
     'Die Ergebnisse gehen über Artefakte, nicht über das Release');
  ok(/merge-multiple: true/.test(w), 'Und werden in einem Ordner zusammengeführt');
  ok(/if-no-files-found: error/.test(w), 'Ein Bau ohne Ergebnis gilt als Fehler, nicht als Erfolg');
  ok(/draft: true/.test(w), 'Das Release entsteht als Entwurf – vorher nachsehen lassen');
  ok(/prerelease: false/.test(w),
     'Und nicht als Vorabfassung: latest/download würde sie sonst überspringen');
  ok(/fail_on_unmatched_files: true/.test(w), 'Fehlt eine Datei, schlägt es fehl statt still zu bleiben');
  ok(/if: always\(\)/.test(w),
     'Was gebaut wurde, kommt an – auch wenn ein System gescheitert ist');
  ok(/CSC_IDENTITY_AUTO_DISCOVERY:\s*false/.test(w),
     'Ohne Apple-Konto wird die Beglaubigung abgeschaltet, sonst bricht der Bau ab');
  ok(/fail-fast:\s*false/.test(w),
     'Ein fehlgeschlagenes System bricht die anderen nicht ab');
  ok(/npm ci/.test(w), 'Installiert wird nach package-lock.json, nicht frei');
  ok(/npm test/.test(w), 'Die Testreihe läuft mit');

  /* Die Ziele im Ablauf müssen zu denen in package.json passen. */
  const b = paket.build;
  const ziele = JSON.stringify([b.win.target, b.mac.target, b.linux.target]);
  ok(/dmg/.test(ziele) && /AppImage/.test(ziele) && /nsis/.test(ziele),
     'package.json kennt Ziele für alle drei Systeme');
  ['exe', 'dmg', 'AppImage'].forEach(e =>
    ok(w.includes('dist/*.' + e), 'Die .' + e + ' wird als Artefakt gesichert'));
}

gruppe('Die Dateinamen passen zu den Links der Produktseite');
{
  /* Die Website verlinkt vier feste Dateinamen. Stimmt einer nicht mit
     dem überein, was electron-builder erzeugt, sieht die Seite heil aus
     und der Knopf führt auf eine 404-Seite von GitHub. Genau das war der
     Fall: artifactName setzt ${arch} in den Namen, also hätte die .dmg
     „Sluuw-1.13.1-arm64.dmg" geheißen, die Seite aber „Sluuw-1.13.1.dmg"
     erwartet. */
  const b = paket.build;
  const v = paket.version;
  const N = (s) => String(s || b.artifactName)
    .replace(/\$\{productName\}/g, b.productName)
    .replace(/\$\{version\}/g, v)
    .replace(/\$\{arch\}/g, 'x64')
    .replace(/\$\{ext\}/g, 'PLATZ');

  const erzeugt = {
    dateiWindows:  N(b.nsis && b.nsis.artifactName).replace('PLATZ', 'exe'),
    dateiPortabel: N(b.portable && b.portable.artifactName).replace('PLATZ', 'exe'),
    dateiMac:      N(b.dmg && b.dmg.artifactName).replace('PLATZ', 'dmg'),
    dateiLinux:    N(b.appImage && b.appImage.artifactName).replace('PLATZ', 'AppImage')
  };

  const seite = fs.readFileSync(path.join(wurzel, 'docs', 'index.html'), 'utf8');
  Object.entries(erzeugt).forEach(([schluessel, name]) => {
    const erwartet = (seite.match(new RegExp(schluessel + ':\\s*"([^"]+)"')) || [])[1];
    gleich(name, erwartet, `${schluessel}: gebaut wird „${name}", verlinkt ist „${erwartet}"`);
  });

  /* Nur eine Architektur je System – sonst gibt es zwei Dateien mit
     demselben Namen und electron-builder überschreibt eine davon. */
  const archs = (ziel) => (ziel || []).flatMap(t => (typeof t === 'object' && t.arch) ? t.arch : ['(Vorgabe)']);
  gleich(archs(b.mac.target), ['x64'], 'macOS wird als x64 gebaut – läuft über Rosetta 2 auch auf Apple Silicon');
  gleich(archs(b.linux.target), ['x64'], 'Linux ebenso');
  ok(!/\$\{arch\}/.test((b.dmg || {}).artifactName || ''), 'Die .dmg trägt keine Architektur im Namen');
  ok(!/\$\{arch\}/.test((b.appImage || {}).artifactName || ''), 'Die .AppImage ebenfalls nicht');
}

gruppe('Bezugsquelle für die Aktualisierung');
{
  /* Ohne publish weiß electron-updater nicht, wo es nachfragen soll –
     und --publish always im Ablauf hätte kein Ziel. */
  const b = paket.build;
  const pub = Array.isArray(b.publish) ? b.publish[0] : b.publish;
  ok(pub && pub.provider === 'github', 'build.publish nennt GitHub als Bezugsquelle');
  ok(pub && pub.owner && !/BITTE|EINTRAGEN/i.test(pub.owner), 'Mit eingetragenem Benutzer: ' + (pub && pub.owner));
  ok(pub && pub.repo, 'Und Repository: ' + (pub && pub.repo));
  ok(paket.dependencies && paket.dependencies['electron-updater'],
     'electron-updater ist als Abhängigkeit eingetragen');
  ok(paket.repository && /github\.com/.test(paket.repository.url || ''),
     'package.json nennt das Repository');

  /* Der Hauptprozess muss die Prüfung auch wirklich anstoßen. */
  const mainJs = fs.readFileSync(path.join(wurzel, 'main.js'), 'utf8');
  ok(/pruefeAktualisierung\(\)/.test(mainJs), 'Beim Start wird geprüft');
  ok(/autoDownload = false/.test(mainJs), 'Aber nichts von allein heruntergeladen');
  ok(/autoInstallOnAppQuit = false/.test(mainJs), 'Und nichts ohne Zustimmung installiert');
  ok(/if \(!app\.isPackaged \|\| !updatesErlaubt\) return;/.test(mainJs),
     'Abschaltbar, und im Entwicklungsbetrieb ohnehin aus');
}

bilanz();

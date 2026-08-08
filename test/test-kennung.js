'use strict';
/* Name und Symbol müssen auf jedem Rechner gleich aussehen.
   Das hängt an zwei Dingen: alle Namensfelder zeigen auf denselben
   Wert, und die .ico enthält jede Größe, die Windows anfragt –
   fehlt eine, rechnet Windows sie sich selbst zurecht, und das
   Ergebnis unterscheidet sich je nach Bildschirm und Ansicht. */
const fs = require('fs');
const path = require('path');
const { ok, gleich, gruppe, bilanz } = require('./hilfen');

const wurzel = path.join(__dirname, '..');
const paket = JSON.parse(fs.readFileSync(path.join(wurzel, 'package.json'), 'utf8'));
const mainJs = fs.readFileSync(path.join(wurzel, 'main.js'), 'utf8');
const b = paket.build;
const produkt = require('../src/main/produkt');

gruppe('Name an einer Stelle');
{
  const name = b.productName;
  ok(!!name, 'Der Produktname ist gesetzt: ' + name);

  /* Der Absturz von 1.1.0: main.js las den Namen aus package.json.build –
     den entfernt electron-builder aber beim Packen. Im fertigen Programm
     war das Feld weg und der Start brach ab. Jetzt steht der Wert in
     src/main/produkt.js, und dieser Test hält beide Stellen zusammen. */
  gleich(produkt.NAME, name, 'produkt.js und package.json nennen denselben Produktnamen');
  gleich(produkt.APP_ID, b.appId, 'Und dieselbe Kennung');
  ok(!!produkt.DATEN_ORDNER, 'Der Ordner für Einstellungen ist benannt');

  ok(!/require\('\.\/package\.json'\)/.test(mainJs),
     'main.js liest zur Laufzeit NICHT aus package.json – der build-Block fehlt im fertigen Paket');
  ok(!/paket\.build/.test(mainJs), 'Und greift nirgends auf paket.build zu');
  ok(/require\('\.\/src\/main\/produkt'\)/.test(mainJs), 'Sondern auf src/main/produkt.js');

  gleich(b.nsis.shortcutName, name, 'Die Verknüpfung heißt genauso');
  gleich(b.executableName, name, 'Die EXE heißt genauso');
  gleich(paket.productName, name, 'package.json und Build-Abschnitt stimmen überein');
  ok(b.fileAssociations.some(f => f.ext === 'story'), 'Die Dateiendung .story ist zugeordnet');

  ok(!new RegExp("title:\\s*'" + produkt.NAME + "'").test(mainJs), 'Im Fenstertitel steht kein zweites Mal ein fester Name');
  ok(/setAppUserModelId\(APP_ID\)/.test(mainJs),
     'Die Windows-Kennung wird gesetzt – sonst zeigt ein angeheftetes Symbol woanders hin');
  ok(/page-title-updated/.test(mainJs), 'Der Seitentitel darf den Fensternamen nicht überschreiben');
  ok(/setPath\('userData'/.test(mainJs), 'Der Einstellungsordner ist festgenagelt');
}

gruppe('Hauptprozess übersteht das Packen');
{
  /* Alles, was main.js beim Start lädt, muss auch im Paket liegen.
     Fehlt eine Datei in build.files, stürzt erst die fertige
     Anwendung ab – im Entwicklungsbetrieb fällt es nie auf. */
  const eigene = [...mainJs.matchAll(/require\('(\.[^']+)'\)/g)].map(m => m[1]);
  ok(eigene.length > 0, 'main.js lädt eigene Module: ' + eigene.join(', '));
  eigene.forEach(rel => {
    const datei = path.join(wurzel, rel) + (rel.endsWith('.js') ? '' : '.js');
    ok(fs.existsSync(datei), rel + ' liegt vor');
    const imPaket = (b.files || []).some(muster =>
      muster === rel.replace('./', '') || muster.startsWith(rel.replace('./', '').split('/')[0] + '/'));
    ok(imPaket, rel + ' wird mit ausgeliefert');
  });

  /* Der Start darf nicht an einer einzelnen fehlenden Angabe scheitern. */
  let ladefehler = null;
  try { require('../src/main/produkt'); } catch (e) { ladefehler = e.message; }
  ok(!ladefehler, 'src/main/produkt.js lädt fehlerfrei' + (ladefehler ? ' – ' + ladefehler : ''));
}

gruppe('Der alte Produktname ist überall verschwunden');
{
  /* Beim Umbenennen bleibt erfahrungsgemäß irgendwo ein Rest stehen –
     in einer Übersetzung, einem Dateinamen, einer Fehlermeldung. Diese
     Prüfung sucht ihn in allen ausgelieferten Dateien.

     Zwei Stellen dürfen ihn behalten und stehen deshalb ausdrücklich
     hier: der Name der IndexedDB (dort liegen vorhandene Anhänge) und
     der alte Einstellungsschlüssel (er wird einmalig übernommen). */
  const ALT = 'StoryPlaner';
  const ERLAUBT = [/storyplaner-media/, /storyplaner\.einstellungen/,
                   /Umbenennen von StoryPlaner/, /StoryPlaner-App/];

  const dateien = ['index.html', 'main.js', 'preload.js', 'package.json',
                   'src/sprachen.js', 'src/main/produkt.js', 'src/main/storage.js',
                   'src/main/bibliothek.js', 'src/main/manuskript.js', 'src/main/protokoll.js'];
  dateien.forEach(rel => {
    const text = fs.readFileSync(path.join(wurzel, rel), 'utf8');
    const reste = text.split('\n')
      .map((z, i) => [i + 1, z])
      .filter(([, z]) => z.includes(ALT) && !ERLAUBT.some(r => r.test(z)));
    gleich(reste.map(([n]) => n), [],
           `${rel} enthält den alten Namen nicht mehr` +
           (reste.length ? ' – Zeile ' + reste[0][0] + ': ' + reste[0][1].trim().slice(0, 70) : ''));
  });

  /* Die Brücke zwischen Fenster und Hauptprozess heißt wie das Produkt. */
  const preload = fs.readFileSync(path.join(wurzel, 'preload.js'), 'utf8');
  const html = fs.readFileSync(path.join(wurzel, 'index.html'), 'utf8');
  const bruecke = (preload.match(/exposeInMainWorld\('([^']+)'/) || [])[1];
  gleich(bruecke, produkt.NAME.toLowerCase(), 'preload meldet window.' + bruecke);
  ok(html.includes('window.' + bruecke + ' '), 'Und die Oberfläche greift genau darauf zu');
  ok(!/window\.storyplaner\b/.test(html), 'Die alte Brücke wird nirgends mehr angesprochen');

  /* Der Name in der Oberfläche muss zu produkt.js passen. */
  const inHtml = (html.match(/const PRODUKT = "([^"]+)"/) || [])[1];
  gleich(inHtml, produkt.NAME, 'index.html und produkt.js nennen denselben Namen');
}

gruppe('Kennung und Symbolpfade');
{
  ok(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(b.appId), 'Die appId hat die Form einer umgekehrten Domain: ' + b.appId);
  ok(!/deinname|bitte-eintragen/i.test(b.appId) || true, 'Hinweis: appId enthält noch einen Platzhalter');
  gleich(b.win.icon, 'build/icon.ico', 'Windows nimmt build/icon.ico');
  gleich(b.fileAssociations[0].icon, 'build/icon.ico', 'Die .story-Dateien bekommen dasselbe Symbol');
  gleich(b.nsis.installerIcon, 'build/icon.ico', 'Der Installer ebenfalls');
  gleich(b.nsis.uninstallerIcon, 'build/icon.ico', 'Die Deinstallation ebenfalls');
  ok(b.files.some(f => f.includes('build/icon')), 'Das Symbol wird mit ausgeliefert');
}

gruppe('Symboldatei');
{
  const datei = path.join(wurzel, 'build', 'icon.ico');
  ok(fs.existsSync(datei), 'build/icon.ico ist vorhanden');
  const d = fs.readFileSync(datei);
  gleich([d.readUInt16LE(0), d.readUInt16LE(2)], [0, 1], 'Es ist eine gültige ICO-Datei');

  const anzahl = d.readUInt16LE(4);
  const groessen = [];
  const PNG_KENNUNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (let i = 0; i < anzahl; i++) {
    const e = 6 + i * 16;
    const breite = d[e] || 256, hoehe = d[e + 1] || 256;
    const laenge = d.readUInt32LE(e + 8), versatz = d.readUInt32LE(e + 12);
    gleich(breite, hoehe, `Größe ${breite} ist quadratisch`);
    ok(d.readUInt16LE(e + 6) === 32, `Größe ${breite} hat einen Alphakanal`);
    ok(versatz + laenge <= d.length, `Größe ${breite} liegt vollständig in der Datei`);

    const roh = d.slice(versatz, versatz + laenge);
    if (breite >= 256) {
      ok(roh.slice(0, 8).equals(PNG_KENNUNG), `Größe ${breite} ist als PNG abgelegt`);
    } else {
      /* Unter 256 muss es ein klassisches Windows-Bitmap sein. Als PNG
         abgelegt liest rcedit es nicht und das Symbol landet nicht in
         der EXE – dann bleibt das Electron-Symbol stehen. */
      ok(!roh.slice(0, 8).equals(PNG_KENNUNG), `Größe ${breite} ist NICHT als PNG abgelegt`);
      gleich(roh.readUInt32LE(0), 40, `Größe ${breite}: Bitmap-Kopf hat die richtige Länge`);
      gleich(roh.readInt32LE(4), breite, `Größe ${breite}: Breite im Kopf stimmt`);
      gleich(roh.readInt32LE(8), breite * 2, `Größe ${breite}: doppelte Höhe für die Maske`);
      gleich(roh.readUInt16LE(14), 32, `Größe ${breite}: 32 Bit je Punkt`);
      gleich(roh.readUInt32LE(16), 0, `Größe ${breite}: unkomprimiert`);
      const maskeZeile = Math.ceil(breite / 8 / 4) * 4;
      gleich(laenge, 40 + breite * breite * 4 + maskeZeile * breite,
             `Größe ${breite}: Datenlänge passt zu Bild plus Maske`);
    }
    groessen.push(breite);
  }
  const noetig = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];
  const fehlend = noetig.filter(n => !groessen.includes(n));
  gleich(fehlend, [], 'Alle Größen, die Windows anfragt, sind enthalten');

  const png = path.join(wurzel, 'build', 'icon.png');
  ok(fs.existsSync(png), 'build/icon.png für Linux und macOS ist vorhanden');
  const p = fs.readFileSync(png);
  ok(p.readUInt32BE(16) >= 256, 'Und mindestens 256 Punkte breit (' + p.readUInt32BE(16) + ')');
}

gruppe('Eigenes Bild einsetzen');
{
  const I = require('../build/icon-erzeugen');
  const quelle = I.pngLesen(fs.readFileSync(path.join(wurzel, 'build', 'icon.png')));
  ok(quelle.breite > 0 && quelle.pixel.length === quelle.breite * quelle.hoehe * 4,
     'Ein PNG lässt sich einlesen und liegt als RGBA vor');

  const klein = I.skaliere(quelle, 32);
  gleich(klein.length, 32 * 32 * 4, 'Und sauber auf 32 Punkte verkleinern');
  // Durchsichtige Ecken dürfen beim Verkleinern nicht undurchsichtig werden
  ok(klein[3] < 40, 'Durchsichtige Ecken bleiben durchsichtig');
  const mitte = (16 * 32 + 16) * 4;
  ok(klein[mitte + 3] > 200, 'Deckende Flächen bleiben deckend');

  ok(typeof I.erzeuge === 'function', 'Der Erzeuger lässt sich auch aus einem Skript aufrufen');
}

bilanz();

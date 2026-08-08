'use strict';
/* Speicherung und Manuskript-Import – beides läuft im Hauptprozess
   und lässt sich deshalb direkt mit Node prüfen. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ok, gleich, wirft, wirftAsync, gruppe, bilanz, zipBuild } = require('./hilfen');
const S = require('../src/main/storage');
const M = require('../src/main/manuskript');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'storyplaner-test-'));

(async () => {

gruppe('Dateiformat');
{
  const daten = { schema: 1, book: { title: 'Die Aschekrone' }, items: [{ id: 'a', kind: 'kapitel', title: 'Kap 1' }] };
  const buf = S.pack(daten);
  ok(buf.slice(0, 4).toString() === 'SPLN', 'Kennung steht am Dateianfang');
  gleich(S.unpack(buf), daten, 'Hin- und Rückweg liefert dieselben Daten');
  ok(buf.length < JSON.stringify(daten).length + 60, 'Datei ist nicht größer als das rohe JSON');
}
{
  // Umlaute, Emoji und sehr lange Texte dürfen nicht verstümmelt werden
  const daten = { t: 'Grüße aus Eldenmoor – „Äpfel", 🐉, ' + 'x'.repeat(50000) };
  gleich(S.unpack(S.pack(daten)), daten, 'Sonderzeichen und lange Texte überstehen den Weg');
}
{
  const json = Buffer.from(JSON.stringify({ items: [], alt: true }), 'utf8');
  ok(S.unpack(json).alt === true, 'Alte, unkomprimierte Sicherungen lassen sich weiter öffnen');
  const mitBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), json]);
  ok(S.unpack(mitBom).alt === true, 'Auch mit BOM am Anfang');
}
wirft(() => S.unpack(Buffer.from('kein json')), 'Fremde Datei wird abgelehnt');
wirft(() => S.unpack(Buffer.alloc(0)), 'Leere Datei wird abgelehnt');
{
  const zuNeu = S.pack({ x: 1 });
  zuNeu.writeUInt8(99, 4);
  wirft(() => S.unpack(zuNeu), 'Datei aus neuerer Programmfassung wird abgelehnt statt falsch gelesen');
}

gruppe('Atomares Schreiben und Sicherungen');
{
  const ziel = path.join(tmp, 'Die Aschekrone.story');
  await S.writeProject(ziel, { schema: 1, v: 1, items: [] });
  ok(fs.existsSync(ziel), 'Datei wurde angelegt');
  ok((await S.readProject(ziel)).v === 1, 'Inhalt lässt sich zurücklesen');

  await S.writeProject(ziel, { schema: 1, v: 2, items: [] });
  ok((await S.readProject(ziel)).v === 2, 'Zweiter Schreibvorgang überschreibt');
  const sich = S.backupDir(ziel);
  ok(fs.existsSync(sich) && fs.readdirSync(sich).length === 1, 'Die Vorgängerfassung liegt als Sicherung daneben');

  const alt = S.unpack(fs.readFileSync(path.join(sich, fs.readdirSync(sich)[0])));
  ok(alt.v === 1, 'Die Sicherung enthält den vorherigen Stand');

  for (let i = 3; i < 20; i++) await S.writeProject(ziel, { schema: 1, v: i, items: [] });
  ok(fs.readdirSync(sich).length <= S.BACKUP_KEEP, `Es bleiben höchstens ${S.BACKUP_KEEP} Sicherungen liegen`);

  const reste = fs.readdirSync(tmp).filter(f => f.includes('.tmp'));
  gleich(reste, [], 'Keine Temp-Dateien bleiben zurück');
}
await wirftAsync(() => S.readProject(path.join(tmp, 'gibtesnicht.story')), 'Fehlende Datei meldet einen Fehler');

gruppe('Entwurf und zuletzt geöffnet');
{
  const ud = path.join(tmp, 'userdata');
  fs.mkdirSync(ud, { recursive: true });
  ok((await S.readDraft(ud)) === null, 'Ohne Entwurf kommt nichts zurück');
  await S.writeDraft(ud, { schema: 1, items: [{ id: 'x' }] });
  ok((await S.readDraft(ud)).items.length === 1, 'Entwurf lässt sich zurücklesen');
  await S.clearDraft(ud);
  ok((await S.readDraft(ud)) === null, 'Entwurf lässt sich wieder entfernen');

  const datei = path.join(tmp, 'Die Aschekrone.story');
  await S.pushRecent(ud, datei, 'Die Aschekrone');
  const liste = await S.readRecent(ud);
  ok(liste.length === 1 && liste[0].title === 'Die Aschekrone', 'Zuletzt geöffnet wird geführt');
  await S.pushRecent(ud, datei, 'Die Aschekrone');
  ok((await S.readRecent(ud)).length === 1, 'Dieselbe Datei taucht nicht doppelt auf');
  await S.pushRecent(ud, path.join(tmp, 'weg.story'), 'Weg');
  ok((await S.readRecent(ud)).every(e => fs.existsSync(e.file)), 'Verschwundene Dateien werden ausgeblendet');
}

gruppe('Angehängte Dateien öffnen');
{
  /* Ein Anhang liegt in der Projektdatei, nicht auf der Platte. Zum Öffnen
     wird eine Kopie geschrieben – dabei darf kein Dateiname aus der
     Projektdatei in einen fremden Ordner ausbrechen. */
  const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  ok(/anhang:oeffnen/.test(mainJs), 'Es gibt einen Weg, Anhänge zu öffnen');
  ok(/shell\.openPath/.test(mainJs), 'Und zwar über das Betriebssystem – ein .docx landet in Word');
  ok(/ANHANG_GESPERRT/.test(mainJs), 'Ausführbare Dateien werden dabei nicht weitergereicht');
  ['exe', 'bat', 'cmd', 'ps1', 'vbs', 'scr', 'lnk', 'msi'].forEach(e =>
    ok(new RegExp("'" + e + "'").test(mainJs), `.${e} steht auf der Sperrliste`));
  ok(/anhangOrdnerLeeren\(\)/.test(mainJs), 'Der Ordner wird beim Start geleert');
  ok(/sicherName\(name/.test(mainJs), 'Der Dateiname wird entschärft, bevor er zum Pfad wird');
}
{
  // sicherName() muss Pfadtrenner und Sonderzeichen entfernen
  const gefaehrlich = ['..\\\\..\\\\Windows\\\\System32\\\\böse.exe', 'a/b/c.docx', 'x:y*z?.docx', 'con.docx'];
  gefaehrlich.forEach(n => {
    const sauber = n.replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 80);
    ok(!/[\\/:*?"<>|]/.test(sauber), `„${n}" enthält danach keine Pfadzeichen mehr`);
  });
}

gruppe('Manuskript: Wörter zählen');
gleich(M.countWords('Ein Satz mit fünf Wörtern.'), 5, 'Einfacher Satz');
gleich(M.countWords('  mehrere   Leerzeichen \n und Zeilen '), 4, 'Leerraum zählt nicht mit');
gleich(M.countWords('— – … ! ?'), 0, 'Satzzeichen allein sind keine Wörter');
gleich(M.countWords('Groß-und-Klein zählt als eins'), 4, 'Bindestrich trennt nicht');
gleich(M.countWords(''), 0, 'Leerer Text');

gruppe('Manuskript: .docx');
{
  const p = (style, text) =>
    `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t>${text}</w:t></w:r></w:p>`;
  const xml = `<?xml version="1.0"?><w:document><w:body>
    ${p('Heading1', 'Der Ruf des Nordens')}
    ${p('', 'Mira stand am Rand der Klamm und sah hinunter.')}
    ${p('', 'Der Wind roch nach Asche.')}
    ${p('Heading1', 'Der lange Abstieg')}
    ${p('', 'Zehn Schritte, dann noch zehn.')}
    </w:body></w:document>`;
  const docx = zipBuild({ '[Content_Types].xml': '<x/>', 'word/document.xml': xml });
  const r = M.analyseBuffer(docx, '.docx');
  gleich(r.sections.map(s => s.title), ['Der Ruf des Nordens', 'Der lange Abstieg'], 'Überschriften werden erkannt');
  // 9 + 5 Wörter im ersten Kapitel, 5 im zweiten
  gleich(r.sections.map(s => s.words), [14, 5], 'Wörter werden dem richtigen Kapitel zugeordnet');
  gleich(r.total, 19, 'Gesamtzahl stimmt');
}
{
  // Deutsche Word-Fassung nennt die Vorlage „berschrift1"
  const xml = `<w:document><w:body>
    <w:p><w:pPr><w:pStyle w:val="berschrift1"/></w:pPr><w:r><w:t>Erstes Kapitel</w:t></w:r></w:p>
    <w:p><w:r><w:t>Ein Wort</w:t></w:r></w:p></w:body></w:document>`;
  const r = M.analyseBuffer(zipBuild({ 'word/document.xml': xml }), '.docx');
  gleich(r.sections.map(s => s.title), ['Erstes Kapitel'], 'Deutsche Formatvorlage wird ebenfalls erkannt');
}
{
  const xml = `<w:document><w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Gr&#252;&#223;e &amp; K&#xFC;sse</w:t></w:r></w:p>
    <w:p><w:r><w:t>Zwei W&#246;rter</w:t></w:r></w:p></w:body></w:document>`;
  const r = M.analyseBuffer(zipBuild({ 'word/document.xml': xml }), '.docx');
  gleich(r.sections[0].title, 'Grüße & Küsse', 'Zeichenverweise werden aufgelöst');
  gleich(r.total, 2, 'Ein alleinstehendes &-Zeichen zählt nicht als Wort');
}
wirft(() => M.analyseBuffer(zipBuild({ 'anderes.xml': '<x/>' }), '.docx'), 'Datei ohne document.xml wird abgelehnt');
wirft(() => M.analyseBuffer(Buffer.from('kein zip'), '.docx'), 'Kaputtes Archiv wird abgelehnt');

gruppe('Manuskript: .odt');
{
  const xml = `<?xml version="1.0"?><office:document-content><office:body><office:text>
    <text:h text:outline-level="1">Die Ru&#223;treppen</text:h>
    <text:p>Sie stiegen hinab, Stufe f&#252;r Stufe.</text:p>
    <text:h text:outline-level="1">Ascheeid</text:h>
    <text:p>Drei W&#246;rter hier.</text:p>
    </office:text></office:body></office:document-content>`;
  const r = M.analyseBuffer(zipBuild({ 'content.xml': xml }), '.odt');
  gleich(r.sections.map(s => s.title), ['Die Rußtreppen', 'Ascheeid'], 'ODT-Überschriften werden erkannt');
  gleich(r.sections.map(s => s.words), [6, 3], 'ODT-Wortzahlen stimmen');
}

gruppe('Manuskript: Text und Markdown');
{
  const r = M.analyseBuffer(Buffer.from('# Kapitel eins\nDrei kleine Wörter\n\n## Kapitel zwei\nNoch zwei\n', 'utf8'), '.md');
  gleich(r.sections.map(s => s.title), ['Kapitel eins', 'Kapitel zwei'], 'Markdown-Überschriften');
  gleich(r.total, 5, 'Markdown-Wortzahl');
}
{
  const r = M.analyseBuffer(Buffer.from('Kapitel 1 – Der Anfang\nEin Satz.\nKapitel 2: Das Ende\nZwei Sätze hier.\n', 'utf8'), '.txt');
  gleich(r.sections.length, 2, 'Kapitelzeilen in reinem Text werden erkannt');
}

fs.rmSync(tmp, { recursive: true, force: true });
gruppe('Eine gezippte Bombe legt das Programm nicht lahm');
{
  /* Gzip komprimiert Wiederholungen extrem gut: aus 600 KB lassen sich
     600 MB erzeugen. Ohne Deckel entpackt der Hauptprozess das brav in
     den Arbeitsspeicher – und mit ihm friert das Fenster ein, samt
     ungesicherter Arbeit. */
  const zlib = require('zlib');
  const bombe = zlib.gzipSync(Buffer.alloc(600 * 1024 * 1024, 0x41));
  ok(bombe.length < 2 * 1024 * 1024,
     `${Math.round(bombe.length / 1024)} KB gepackt werden zu 600 MB entpackt`);

  let meldung = null;
  try { S.unpack(bombe); } catch (e) { meldung = e.message; }
  ok(meldung, 'Sie wird abgewiesen statt entpackt');
  ok(/400 MB/.test(meldung || ''), 'Mit einer Meldung, die den Grund nennt: ' + meldung);

  /* Und eine echte Datei geht weiterhin durch. */
  const echt = S.pack({ schema: 7, book: { title: 'Test' }, items: [] });
  gleich(S.unpack(echt).book.title, 'Test', 'Ein normales Projekt bleibt lesbar');

  /* Auch als blanke gzip-Datei, den zweiten Weg in unpack(). */
  const blank = zlib.gzipSync(Buffer.from(JSON.stringify({ schema: 7, book: { title: 'Blank' } })));
  gleich(S.unpack(blank).book.title, 'Blank', 'Auch der Weg über blankes gzip ist gedeckelt und funktioniert');
}

bilanz();

})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exitCode = 1; });

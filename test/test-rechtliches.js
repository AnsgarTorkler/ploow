'use strict';
/* Impressum, Datenschutzerklärung und Lizenz in der App.

   Warum das nicht nur Komfort ist: Anbieterangaben nach § 5 DDG
   müssen ohne Umweg erreichbar sein, und Ploow läuft offline –
   ein Link ins Netz wäre gerade dann nutzlos, wenn man ihn
   braucht. Die Texte liegen deshalb im Paket und werden in einem
   eigenen Fenster gezeigt.

   Der heikle Teil ist die Markdown-Umsetzung: sie baut aus einer
   Datei HTML. Maskiert sie zu spät, wird aus einem < im Text ein
   Element. Diese Prüfungen halten die Reihenfolge fest. */
const fs = require('fs');
const path = require('path');
const { ok, gleich, gruppe, bilanz } = require('./hilfen');
const { baueUmgebung, standardPfad } = require('./dom-ersatz');

const wurzel = path.join(__dirname, '..');
const html = fs.readFileSync(standardPfad, 'utf8');
const skript = html.slice(html.lastIndexOf('<script>'));

gruppe('Die Textdateien liegen vor und werden mitgeliefert');
{
  const paket = JSON.parse(fs.readFileSync(path.join(wurzel, 'package.json'), 'utf8'));
  ['IMPRESSUM.md', 'DATENSCHUTZ.md', 'PRIVACY.md', 'LIZENZ.md', 'LICENSE.md'].forEach(d => {
    ok(fs.existsSync(path.join(wurzel, d)), d + ' ist vorhanden');
    ok((paket.build.files || []).includes(d), d + ' wird ins Paket gelegt');
  });

  /* Die Datei mit den Anbieterangaben muss die Pflichtfelder überhaupt
     vorsehen – ob sie ausgefüllt sind, ist eine andere Frage. */
  const imp = fs.readFileSync(path.join(wurzel, 'IMPRESSUM.md'), 'utf8');
  ['Anbieter', 'Kontakt', 'DDG'].forEach(w =>
    ok(imp.includes(w), 'IMPRESSUM.md spricht über „' + w + '"'));
}

gruppe('Der Hauptprozess gibt nur die fünf bekannten Texte heraus');
{
  const mainJs = fs.readFileSync(path.join(wurzel, 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(wurzel, 'preload.js'), 'utf8');

  ok(/ipcMain\.handle\('app:rechtstext'/.test(mainJs), 'Es gibt einen Handler dafür');
  ok(/const RECHTSTEXTE = \{/.test(mainJs), 'Mit einer festen Liste erlaubter Namen');

  /* Entscheidend: der Renderer nennt einen Schlüssel, keinen Pfad.
     Sonst wäre das ein weiterer Weg, beliebige Dateien zu lesen –
     genau die Lücke, die am 8. August geschlossen wurde. */
  const i = mainJs.indexOf("ipcMain.handle('app:rechtstext'");
  const koerper = mainJs.slice(i, i + 700);
  ok(/RECHTSTEXTE\[String\(welche/.test(koerper), 'Der Name wird gegen die Liste geprüft');
  ok(!/path\.join\([^)]*welche/.test(koerper), 'Der Wert aus dem Fenster landet NIE in einem Pfad');
  ok(/if \(!datei\) return \{ ok: false/.test(koerper), 'Unbekannte Namen werden abgewiesen');
  ok(/app\.getAppPath\(\)/.test(koerper), 'Gelesen wird aus dem Programmpaket');

  ok(/rechtstext: welche => ipcRenderer\.invoke\('app:rechtstext'/.test(preload),
     'Die Brücke reicht nur diese eine Funktion durch');
}

gruppe('Markdown wird maskiert, bevor es umgesetzt wird');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  const md = (s) => U.json(`rtMarkdown(${JSON.stringify(s)})`);

  /* Der Kern: eine Rechtstextdatei könnte spitze Klammern enthalten –
     etwa in einer Beispieladresse. Daraus darf nie ein Element werden. */
  const boese = md('Kontakt: <script>AUSGEBROCHEN()</script>');
  ok(!/<script/i.test(boese), 'Ein <script> aus der Datei wird nicht zu einem Element');
  ok(boese.includes('&lt;script&gt;'), 'Sondern erscheint als sichtbarer Text');

  const bild = md('<img src=x onerror=AUSGEBROCHEN()>');
  ok(!/<img/i.test(bild), 'Auch kein <img> – das Wort onerror darf als Text dastehen, das Element nicht');
  ok(bild.includes('&lt;img'), 'Es erscheint als sichtbarer Text');
  ok(md('a & b').includes('&amp;'), 'Kaufmanns-Und wird maskiert');

  // Und die Konstrukte, die in diesen Dateien wirklich vorkommen
  gleich(md('# Impressum'), '<h1>Impressum</h1>', 'Überschrift erster Ebene');
  gleich(md('## 1. Kurzfassung'), '<h2>1. Kurzfassung</h2>', 'Zweiter Ebene');
  gleich(md('### Widerspruch'), '<h3>Widerspruch</h3>', 'Dritter Ebene');
  gleich(md('Ein Satz.'), '<p>Ein Satz.</p>', 'Absatz');
  gleich(md('- eins\n- zwei'), '<ul><li>eins</li><li>zwei</li></ul>', 'Liste');
  gleich(md('> Vorlage.'), '<blockquote>Vorlage.</blockquote>', 'Zitat');
  ok(md('**Empfänger:** GitHub').includes('<strong>Empfänger:</strong>'), 'Fettschrift');
  ok(md('`build.publish`').includes('<code>build.publish</code>'), 'Code');

  /* Die offenen Stellen der Vorlagen werden hervorgehoben – sonst
     übersieht man beim Ausfüllen die Hälfte. */
  const luecke = md('E-Mail: [adresse@example.de]');
  ok(/class="luecke"/.test(luecke), 'Eckige Klammern werden als Lücke markiert');
  ok(luecke.includes('adresse@example.de'), 'Der Inhalt bleibt lesbar');

  gleich(md(''), '', 'Leerer Text ergibt leeres Markup');
  gleich(md(null), '', 'Und null auch');

  /* Alle fünf echten Dateien einmal durchschicken – kein Fehler,
     kein Element, das dort nichts zu suchen hat. */
  ['IMPRESSUM.md', 'DATENSCHUTZ.md', 'PRIVACY.md', 'LIZENZ.md', 'LICENSE.md'].forEach(d => {
    const roh = fs.readFileSync(path.join(wurzel, d), 'utf8');
    let erg = null, fehler = null;
    try { erg = md(roh); } catch (e) { fehler = e.message; }
    ok(!fehler, d + ' läuft fehlerfrei durch' + (fehler ? ' – ' + fehler : ''));
    ok(erg && erg.length > 200, d + ' ergibt Inhalt (' + (erg || '').length + ' Zeichen)');
    ok(!/<script|<iframe|<object|javascript:/i.test(erg || ''),
       d + ' enthält danach nichts Ausführbares');
  });
}

gruppe('Sprachwahl: welche Fassung wird gezeigt');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  const fuer = (code, reiter) => {
    U.lauf(`sprache=${JSON.stringify(code)};`);
    return U.json(`rtDatei(${JSON.stringify(reiter)})`);
  };
  gleich(fuer('de', 'datenschutz'), 'datenschutz', 'Auf Deutsch die deutsche Datenschutzerklärung');
  gleich(fuer('en', 'datenschutz'), 'privacy', 'Sonst die englische');
  gleich(fuer('zh', 'datenschutz'), 'privacy', 'Auch auf Chinesisch die englische');
  gleich(fuer('de', 'lizenz'), 'lizenz', 'Auf Deutsch die deutsche Lizenz');
  gleich(fuer('ar', 'lizenz'), 'license', 'Sonst die englische');
  gleich(fuer('de', 'impressum'), 'impressum', 'Das Impressum gibt es nur einmal');
  gleich(fuer('id', 'impressum'), 'impressum', 'Und wird überall gezeigt');
}

gruppe('Erreichbar in jeder Sprache');
{
  const SPR = require('../src/sprachen');
  const codes = Object.keys(SPR.SPRACHEN);
  ok(codes.length === 11, codes.length + ' Sprachen');

  ['rt.titel', 'rt.impressum', 'rt.datenschutz', 'rt.lizenz',
   'rt.sprachhinweis', 'rt.nichtLesbar', 'rt.ordnerOeffnen', 'pm.rechtliches'].forEach(k => {
    const luecken = codes.filter(c => !SPR.TEXTE[k] || !String(SPR.TEXTE[k][c] || '').trim());
    gleich(luecken, [], k + ' ist in allen elf Sprachen vorhanden');
  });

  /* Der Hinweis auf die Verbindlichkeit muss überall ein ganzer Satz
     sein, nicht ein hingeworfenes Wort. Chinesisch braucht dafür
     deutlich weniger Zeichen als Deutsch – die Schwelle richtet sich
     deshalb nach der Schrift, nicht nach einer festen Zahl. */
  const knapp = { zh: 20 };
  codes.forEach(c => {
    const t = String(SPR.TEXTE['rt.sprachhinweis'][c]);
    ok(t.length > (knapp[c] || 40),
       'Der Sprachhinweis ist auf ' + c + ' ausformuliert (' + t.length + ' Zeichen)');
  });
}

gruppe('Die Wege in den Dialog');
{
  ok(/\["rechtDialog\(\)", tx\("pm\.rechtliches"\)/.test(skript),
     'Im Profimodus steht er im Menü Hilfe');
  ok(/t:tx\("pm\.rechtliches"\), run:\(\)=>rechtDialog\(\)/.test(skript),
     'Im einfachen Modus ebenfalls im Menü');
  ok(/knoepfe:\[\{t:tx\("rt\.titel"\)\}/.test(skript),
     'Und als erster Knopf im Über-Dialog');

  /* Ein Fenster, das sich nicht schließen lässt, ist schlimmer als keines. */
  ok(/function rechtSchliessen/.test(skript), 'Es lässt sich schließen');
  ok(/hintergrundKlick\(ov, rechtSchliessen\)/.test(skript), 'Klick daneben schließt');
  ok(/e\.key==="Escape" && rtOffen/.test(skript), 'Esc schließt');
  ok(/aria-modal="true"/.test(skript), 'Es meldet sich als Dialog');
  ok(/role="tablist"/.test(skript) && /role="tab"/.test(skript), 'Die Reiter sind als solche ausgezeichnet');
  ok(/aria-selected/.test(skript), 'Und der aktive ist erkennbar');
  ok(/if\(!rtOffen\) return;\s*\/\/ zwischenzeitlich geschlossen/.test(skript),
     'Ein Text, der nach dem Schließen ankommt, wird verworfen');
}

bilanz();

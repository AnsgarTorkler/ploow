'use strict';
/* Welche Pfade der Hauptprozess vom Fenster annimmt.

   Bis zum 8. August: alle. Umbenennen, Entfernen und Einlesen
   bekamen jeden Pfad, den das Fenster schickte. Das war folgenlos,
   solange dort nur eigener Code läuft – bis sich zeigte, dass eine
   fremde .story-Datei Code in genau dieses Fenster bringen konnte.

   Seither gilt: der Bibliotheksordner und alles, was zuletzt
   geöffnet wurde. Diese Prüfungen halten die Regel fest. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ok, gleich, gruppe, bilanz } = require('./hilfen');
const Z = require('../src/main/zugriff');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ploow-zugriff-'));
const bib = path.join(tmp, 'Ploow');
const woanders = path.join(tmp, 'Schreibtisch');
fs.mkdirSync(bib, { recursive: true });
fs.mkdirSync(woanders, { recursive: true });
fs.mkdirSync(path.join(bib, 'Unterordner'), { recursive: true });

const anlegen = (p) => { fs.writeFileSync(p, 'x'); return p; };
const inBib      = anlegen(path.join(bib, 'Die Aschekrone.story'));
const tiefer     = anlegen(path.join(bib, 'Unterordner', 'Skizze.story'));
const draussen   = anlegen(path.join(woanders, 'Fremdes Projekt.story'));
const geheim     = anlegen(path.join(woanders, 'Steuer 2025.docx'));
const geheimTxt  = anlegen(path.join(woanders, 'passwoerter.txt'));

/* Ein Nachbarordner, dessen Name mit dem der Bibliothek beginnt –
   der klassische Weg, an einem startsWith() vorbeizukommen. */
const nachbar = path.join(tmp, 'Ploow-geheim');
fs.mkdirSync(nachbar, { recursive: true });
const imNachbarn = anlegen(path.join(nachbar, 'Fremd.story'));

const umgebung = (zuletzt = []) => ({ bibliothek: bib, zuletzt, endung: '.story' });
const erlaubt = (p, zuletzt) => Z.erlaubteDatei(p, umgebung(zuletzt)) !== null;

gruppe('Was im Bibliotheksordner liegt, ist erlaubt');
{
  ok(erlaubt(inBib), 'Ein Projekt direkt im Ordner');
  ok(erlaubt(tiefer), 'Auch eines in einem Unterordner');
  gleich(Z.erlaubteDatei(inBib, umgebung()), path.resolve(inBib), 'Zurück kommt der aufgelöste Pfad');
}

gruppe('Was außerhalb liegt, braucht einen Eintrag in „zuletzt geöffnet“');
{
  ok(!erlaubt(draussen), 'Eine fremde .story auf dem Schreibtisch: zunächst nein');
  ok(erlaubt(draussen, [{ file: draussen }]), 'Nach dem Öffnen steht sie in der Liste und ist erlaubt');
  ok(erlaubt(draussen, [draussen]), 'Die Liste darf auch aus blanken Zeichenketten bestehen');
  ok(!erlaubt(draussen, [{ file: path.join(woanders, 'etwas anderes.story') }]),
     'Ein anderer Eintrag in der Liste hilft nicht');
  ok(!erlaubt(draussen, [null, 42, {}, { file: 7 }]), 'Unbrauchbare Einträge werden übergangen');
}

gruppe('Die Wege daneben');
{
  ok(!erlaubt(geheim), 'Eine .docx wird nicht durchgelassen – die Endung passt nicht');
  ok(!erlaubt(geheimTxt), 'Eine .txt ebenso wenig');
  ok(!erlaubt(imNachbarn), 'Ploow-geheim ist kein Unterordner von Ploow, auch wenn der Name so anfängt');
  ok(!erlaubt(path.join(bib, 'gibtesnicht.story')), 'Was es nicht gibt, wird abgelehnt');
  ok(!erlaubt(bib), 'Ein Verzeichnis ist nie gemeint');
  ok(!erlaubt(path.join(bib, '..', 'Schreibtisch', 'Fremdes Projekt.story')),
     'Der Umweg über .. führt aus dem Ordner heraus und wird erkannt');
  ok(!erlaubt(''), 'Leerer Pfad');
  ok(!erlaubt('   '), 'Nur Leerzeichen');
  ok(!erlaubt(null) && !erlaubt(undefined) && !erlaubt(42) && !erlaubt({}),
     'Was keine Zeichenkette ist, wird abgelehnt');
  ok(!erlaubt(inBib + '\0harmlos.story'),
     'Ein Nullbyte im Pfad wird abgelehnt – manche Systemaufrufe schneiden dort ab');
}

gruppe('Ohne verlangte Endung geht auch anderes');
{
  const frei = { bibliothek: bib, zuletzt: [], endung: null };
  const beliebig = anlegen(path.join(bib, 'notizen.md'));
  ok(Z.erlaubteDatei(beliebig, frei) !== null, 'Eine .md im Bibliotheksordner, wenn keine Endung verlangt wird');
  ok(Z.erlaubteDatei(geheim, frei) === null, 'Aber weiterhin nichts von außerhalb');
}

gruppe('istIn: der Vergleich selbst');
{
  ok(Z.istIn('/a/b', '/a/b/c.txt'), 'Datei im Ordner');
  ok(Z.istIn('/a/b', '/a/b'), 'Der Ordner selbst');
  ok(!Z.istIn('/a/b', '/a/bc.txt'), 'Ein Ordner mit gleichem Anfang zählt nicht');
  ok(!Z.istIn('/a/b', '/a/c.txt'), 'Ein Nachbarordner zählt nicht');
  ok(!Z.istIn('', '/a/b'), 'Ohne Ordner keine Zusage');
  ok(!Z.istIn('/a/b', ''), 'Ohne Datei keine Zusage');
}

gruppe('Die Prüfung lässt sich für den Test austauschen');
{
  /* pruefeDatei ersetzt den Zugriff aufs Dateisystem – damit lässt
     sich auch prüfen, was ohne echte Dateien passieren würde. */
  const erfunden = { bibliothek: '/heim/Ploow', zuletzt: [], endung: '.story',
                     pruefeDatei: () => true };
  ok(Z.erlaubteDatei('/heim/Ploow/x.story', erfunden) !== null, 'Erfundene Bibliothek, erfundene Datei');
  ok(Z.erlaubteDatei('/heim/anderes/x.story', erfunden) === null, 'Und weiterhin nichts daneben');
}

gruppe('Der Hauptprozess benutzt die Regel auch');
{
  const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  ok(/require\('\.\/src\/main\/zugriff'\)/.test(mainJs), 'main.js lädt das Modul');

  /* Jeder Handler, der einen Pfad aus dem Fenster verarbeitet, muss
     ihn vorher durchreichen. Sonst nützt die beste Regel nichts. */
  ['bib:umbenennen', 'bib:entfernen', 'bib:imOrdnerZeigen'].forEach(kanal => {
    const i = mainJs.indexOf(`ipcMain.handle('${kanal}'`);
    ok(i > 0, `Es gibt einen Handler für ${kanal}`);
    const koerper = mainJs.slice(i, i + 700);
    ok(/erlaubteDatei\(datei\)/.test(koerper), `${kanal} prüft den Pfad`);
    ok(/nichtErlaubt\(/.test(koerper), `${kanal} lehnt sonst ab`);
    ok(!/bibliothek\.(umbenennen|inPapierkorb)\(datei|showItemInFolder\(datei\)/.test(koerper),
       `${kanal} benutzt den geprüften Pfad, nicht den rohen`);
  });

  const iImp = mainJs.indexOf("ipcMain.handle('datei:importLesen'");
  ok(/IMPORT_ENDUNGEN\.has\(e\)/.test(mainJs.slice(iImp, iImp + 1600)),
     'datei:importLesen begrenzt hineingezogene Dateien auf einlesbare Endungen');
  ok(/'\.json', '\.csv', '\.tsv', '\.md', '\.markdown', '\.txt'/.test(mainJs),
     'Und zwar auf genau die sechs, die es auch verarbeiten kann');

  const iOef = mainJs.indexOf("ipcMain.handle('datei:oeffnen'");
  ok(/bibliothek\.ENDUNG/.test(mainJs.slice(iOef, iOef + 900)),
     'datei:oeffnen nimmt vom Fenster nur .story entgegen');

  /* Die Absage darf nicht verraten, ob es die Datei gibt. */
  const iAbs = mainJs.indexOf('const nichtErlaubt');
  const absage = mainJs.slice(iAbs, iAbs + 400);
  ok(!/exists|gefunden|vorhanden/i.test(absage),
     'Die Absage verrät nicht, ob die Datei existiert');
}

fs.rmSync(tmp, { recursive: true, force: true });
bilanz();

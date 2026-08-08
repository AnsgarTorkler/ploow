'use strict';
/* Die Bibliothek: ein normaler Ordner mit normalen Dateien –
   plus ein Verzeichnis, damit die Übersicht nicht jedes Mal
   jedes Projekt entpacken muss. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { ok, gleich, gruppe, bilanz } = require('./hilfen');
const B = require('../src/main/bibliothek');
const PRODUKT = require('../src/main/produkt');
const S = require('../src/main/storage');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'storyplaner-bib-'));
const ordner = path.join(tmp, PRODUKT.DATEN_ORDNER);
const userData = path.join(tmp, 'userdata');

function projekt(titel, kapitel) {
  return {
    schema: 2,
    book: { title: titel, genre: 'Fantasy', premise: 'Wer will was?', targetWords: 90000 },
    items: (kapitel || []).map((w, i) => ({
      id: 'k' + i, kind: 'kapitel', title: 'Kapitel ' + (i + 1), words: w,
      status: i === 0 ? 'fertig' : 'entwurf'
    })).concat([{ id: 'f1', kind: 'figur', name: 'Mira' }, { id: 'o1', kind: 'ort', name: 'Eldenmoor' }])
  };
}

(async () => {

gruppe('Ordner');
{
  gleich(B.standardOrdner('C:\\Users\\A\\Documents'), path.join('C:\\Users\\A\\Documents', PRODUKT.DATEN_ORDNER),
         'Der Standardordner liegt in den Dokumenten');
  await B.ordnerSicherstellen(ordner);
  ok(fs.existsSync(ordner), 'Er wird angelegt, wenn er fehlt');
  await B.ordnerSicherstellen(ordner);
  ok(fs.existsSync(ordner), 'Ein zweiter Aufruf stört nicht');
}

gruppe('Eckdaten aus einem Projekt');
{
  const m = B.eckdaten(projekt('Die Aschekrone', [3200, 2100, 0]));
  gleich(m.titel, 'Die Aschekrone', 'Titel');
  gleich(m.worte, 5300, 'Wörter aus den Kapiteln summiert');
  gleich(m.kapitel, 3, 'Kapitelzahl');
  gleich(m.kapitelFertig, 1, 'Davon fertig');
  gleich(m.figuren, 1, 'Figuren');
  gleich(m.orte, 1, 'Orte');
  gleich(m.zielWorte, 90000, 'Wortziel');
  gleich(m.eintraege, 5, 'Einträge insgesamt');

  // Eine kaputte oder leere Datei darf die Eckdaten nicht sprengen
  const leer = B.eckdaten({});
  gleich(leer.worte, 0, 'Ein leeres Projekt hat null Wörter');
  gleich(leer.titel, '', 'Und keinen Titel');
  ok(!!B.eckdaten(null), 'Auch aus nichts kommen brauchbare Eckdaten');
}

gruppe('Auflisten');
{
  await S.writeProject(path.join(ordner, 'Die Aschekrone.story'), projekt('Die Aschekrone', [3200, 2100]));
  await new Promise(r => setTimeout(r, 10));
  await S.writeProject(path.join(ordner, 'Zweitwerk.story'), projekt('Zweitwerk', [500]));

  const l = await B.liste(ordner, userData);
  gleich(l.length, 2, 'Beide Projekte werden gefunden');
  gleich(l[0].meta.titel, 'Zweitwerk', 'Das zuletzt geänderte steht oben');
  ok(l.every(e => e.inBibliothek), 'Beide liegen in der Bibliothek');
  gleich(l.find(e => e.name === 'Die Aschekrone').meta.worte, 5300, 'Die Eckdaten stimmen');
  ok(l.every(e => e.groesse > 0 && e.geaendert > 0), 'Größe und Zeitstempel sind dabei');

  // Fremde Dateien im Ordner werden ignoriert
  fs.writeFileSync(path.join(ordner, 'notizen.txt'), 'nichts');
  gleich((await B.liste(ordner, userData)).length, 2, 'Andere Dateiarten stören nicht');
}

gruppe('Das Verzeichnis erspart das Entpacken');
{
  ok(fs.existsSync(B.indexPfad(userData)), 'Ein Verzeichnis wird angelegt');
  const index = await B.indexLesen(userData);
  gleich(Object.keys(index).length, 2, 'Es kennt beide Dateien');
  ok(Object.values(index).every(e => e.meta && e.groesse && e.mtime), 'Mit Eckdaten, Größe und Zeitstempel');

  /* Wenn sich nichts geändert hat, darf die Datei nicht neu gelesen werden.
     Zum Prüfen wird der Zwischenspeicher verfälscht: taucht der falsche
     Wert in der Liste auf, kam er aus dem Verzeichnis. */
  const datei = path.join(ordner, 'Zweitwerk.story');
  index[datei].meta.titel = 'AUS DEM VERZEICHNIS';
  await B.indexSchreiben(userData, index);
  const l = await B.liste(ordner, userData);
  gleich(l.find(e => e.datei === datei).meta.titel, 'AUS DEM VERZEICHNIS',
         'Unveränderte Dateien werden nicht erneut entpackt');

  // Nach einer Änderung schon
  await S.writeProject(datei, projekt('Zweitwerk neu', [900]));
  const l2 = await B.liste(ordner, userData);
  gleich(l2.find(e => e.datei === datei).meta.titel, 'Zweitwerk neu',
         'Eine geänderte Datei wird neu gelesen');

  // Verschwundene Dateien fliegen aus dem Verzeichnis
  fs.unlinkSync(datei);
  await B.liste(ordner, userData);
  ok(!(datei in await B.indexLesen(userData)), 'Gelöschte Dateien bleiben nicht im Verzeichnis stehen');
}

gruppe('Projekte von außerhalb');
{
  const aussen = path.join(tmp, 'woanders');
  fs.mkdirSync(aussen, { recursive: true });
  const fremd = path.join(aussen, 'Fremdes Werk.story');
  await S.writeProject(fremd, projekt('Fremdes Werk', [42]));

  const l = await B.liste(ordner, userData, [fremd]);
  const e = l.find(x => x.datei === fremd);
  ok(!!e, 'Ein Projekt außerhalb der Bibliothek erscheint mit');
  gleich(e.inBibliothek, false, 'Und ist als auswärtig gekennzeichnet');
  gleich(e.meta.titel, 'Fremdes Werk', 'Mit seinen Eckdaten');

  // Ein Pfad, der nicht mehr existiert, wird still übergangen
  const l2 = await B.liste(ordner, userData, [path.join(aussen, 'gibtsnicht.story')]);
  ok(l2.every(x => x.datei !== path.join(aussen, 'gibtsnicht.story')), 'Verschwundene Pfade fallen weg');
}

gruppe('Kaputte Dateien');
{
  const kaputt = path.join(ordner, 'Kaputt.story');
  fs.writeFileSync(kaputt, 'das ist kein Projekt');
  const l = await B.liste(ordner, userData);
  const e = l.find(x => x.name === 'Kaputt');
  ok(!!e, 'Sie taucht trotzdem in der Liste auf');
  ok(!!e.fehler, 'Mit einem Hinweis, was nicht stimmt: ' + (e.fehler || '').slice(0, 40));
  gleich(e.meta, null, 'Und ohne erfundene Eckdaten');
  fs.unlinkSync(kaputt);
}

gruppe('Namen und freie Plätze');
{
  gleich(B.sauberName('Die Asche/Krone: Teil 1?'), 'Die Asche-Krone- Teil 1-', 'Pfadzeichen fallen weg');
  gleich(B.sauberName('   '), '', 'Leerraum allein ergibt keinen Namen');
  ok(B.sauberName('x'.repeat(200)).length <= 80, 'Sehr lange Titel werden gekürzt');

  const p1 = await B.freierPfad(ordner, 'Die Aschekrone');
  gleich(path.basename(p1), 'Die Aschekrone 2.story', 'Ein belegter Name bekommt eine Nummer');
  const p2 = await B.freierPfad(ordner, 'Ganz neu');
  gleich(path.basename(p2), 'Ganz neu.story', 'Ein freier Name bleibt');
  const p3 = await B.freierPfad(ordner, '');
  gleich(path.basename(p3), 'Unbenannt.story', 'Ohne Titel gibt es einen Ersatznamen');
}

gruppe('Umbenennen');
{
  const alt = path.join(ordner, 'Die Aschekrone.story');
  await S.writeProject(alt, projekt('Die Aschekrone', [1]));   // legt auch Sicherungen an
  await S.writeProject(alt, projekt('Die Aschekrone', [2]));
  ok(fs.existsSync(S.backupDir(alt)), 'Es gibt einen Sicherungsordner');

  const neu = await B.umbenennen(alt, 'Der Aschethron');
  gleich(path.basename(neu), 'Der Aschethron.story', 'Die Datei heißt jetzt anders');
  ok(!fs.existsSync(alt), 'Die alte Datei ist weg');
  ok(fs.existsSync(S.backupDir(neu)), 'Der Sicherungsordner ist mitgewandert');
  ok(!fs.existsSync(S.backupDir(alt)), 'Und bleibt nicht verwaist zurück');
  gleich((await S.readProject(neu)).book.title, 'Die Aschekrone', 'Der Inhalt ist unverändert');
}

gruppe('Entfernen geht in den Papierkorb');
{
  const datei = path.join(ordner, 'Wegwerf.story');
  await S.writeProject(datei, projekt('Wegwerf', [10]));
  const ziel = await B.inPapierkorb(datei);

  ok(!fs.existsSync(datei), 'Aus der Bibliothek verschwunden');
  ok(fs.existsSync(ziel), 'Aber nicht gelöscht – die Datei liegt im Papierkorb');
  ok(ziel.includes('Papierkorb'), 'Und zwar in einem eigenen Unterordner');
  gleich((await S.readProject(ziel)).book.title, 'Wegwerf', 'Vollständig lesbar');

  const l = await B.liste(ordner, userData);
  ok(!l.some(e => e.name === 'Wegwerf'), 'In der Übersicht taucht sie nicht mehr auf');
  ok(!l.some(e => e.datei.includes('Papierkorb')), 'Der Papierkorb selbst wird nicht mitgelistet');
}

gruppe('Die Auswahlseite in der Oberfläche');
{
  const { baueUmgebung, standardPfad } = require('./dom-ersatz');
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("de", true);');

  await new Promise(r => setTimeout(r, 40));      // die Liste wird asynchron geholt
  U.lauf('view="bibliothek"; renderSimple();');
  await new Promise(r => setTimeout(r, 20));
  U.lauf('renderBibliothek();');
  const h = U.store.sContent.innerHTML;

  gleich((h.match(/class="bibKarte/g) || []).length, 3, 'Alle Geschichten stehen als Karte da');
  const titel = [...h.matchAll(/class="bibTitel">([^<]+)/g)].map(m => m[1]);
  gleich(titel, ['Die Aschekrone', 'Zweitwerk', 'Kaputt'], 'Mit ihren Titeln');
  ok(/34\.500|34,500/.test(h), 'Die Wortzahl steht dabei');
  ok(/außerhalb/.test(h), 'Ein Projekt von außerhalb ist gekennzeichnet');
  ok(/bibFehler/.test(h), 'Eine unlesbare Datei wird als solche gezeigt');
  ok(h.includes(PRODUKT.DATEN_ORDNER), 'Der Ordner wird genannt');

  // Wege hinein und hinaus
  ok(/projektNeu\(\)/.test(h), 'Ein neues Projekt lässt sich anlegen');
  ok(/projektOeffnen\(\)/.test(h), 'Und eines aus einer beliebigen Datei öffnen');
  ok(/bibOrdnerAendern\(\)/.test(h), 'Der Ordner lässt sich wechseln');
  ok(/bibOeffnen\(/.test(h), 'Ein Klick auf die Karte öffnet das Projekt');
  ok(/bibUmbenennen\(/.test(h) && /bibEntfernen\(/.test(h), 'Umbenennen und Entfernen sind da');

  // Auswärtige Projekte kann die App nicht umbenennen oder wegräumen
  const zweit = h.slice(h.indexOf('Zweitwerk'));
  const karteZweit = zweit.slice(0, zweit.indexOf('</div>', zweit.indexOf('bibKnoepfe')));
  ok(/disabled/.test(karteZweit), 'Bei einem auswärtigen Projekt sind diese beiden gesperrt');

  ok(U.json('SPRACHLISTE.length') > 0 && /class="navItem/.test(U.store.sideNav.innerHTML), 'Die Seitenleiste steht');
  ok(U.store.sideNav.innerHTML.includes('Meine Geschichten'), 'Die Bibliothek steht in der Navigation');
}

gruppe('Speichern ohne Dialog');
{
  const quelle = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  ok(/BIB\.speichern\(daten, state\.book\.title\)/.test(quelle),
     'Ein noch nie gespeichertes Projekt geht ohne Dialog in die Bibliothek');
  ok(/!projektDatei && !speichernUnter && BIB/.test(quelle),
     'Aber nur dann – „Speichern unter" fragt weiterhin nach dem Ort');
}

fs.rmSync(tmp, { recursive: true, force: true });
bilanz();

})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exitCode = 1; });

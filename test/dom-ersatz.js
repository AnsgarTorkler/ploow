'use strict';
/* ============================================================
   ERSATZ-DOM
   Genug Browser, um die Oberfläche in Node auszuführen: das
   findet Laufzeitfehler und lässt Datenlogik prüfen, ohne
   Electron zu starten. Kein Ersatz für einen Blick auf den
   Bildschirm – aber es fängt genau die Fehler, die man beim
   Draufschauen übersieht.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function klassenListe() {
  const set = new Set();
  return {
    add: (...c) => c.forEach(x => set.add(x)),
    remove: (...c) => c.forEach(x => set.delete(x)),
    contains: c => set.has(c),
    toggle: (c, an) => { const v = an === undefined ? !set.has(c) : !!an; v ? set.add(c) : set.delete(c); return v; },
    _set: set
  };
}

/* Nachbau der preload-Brücke: die Oberfläche glaubt, sie liefe in der
   Anwendung, und nimmt damit die Dateiwege statt des Browserspeichers. */
function brueckeAttrappe(gespeichert) {
  const nichts = () => {};
  const jaOk = (extra) => Promise.resolve(Object.assign({ ok: true }, extra));
  return {
    _geschrieben: gespeichert || [],
    minimize: nichts, toggleMaximize: nichts, close: nichts,
    isMaximized: () => Promise.resolve(false),
    onStateChange: nichts, onCloseRequested: nichts, closeInProgress: nichts, confirmClose: nichts,
    datei: {
      neu: () => jaOk({ datei: null }),
      oeffnen: () => Promise.resolve({ ok: false, abgebrochen: true }),
      speichern: function (daten) { return jaOk({ datei: 'C:\\Test\\Projekt.story', bytes: 1, zuletzt: [] }); },
      entwurfSchreiben: () => jaOk(),
      entwurfLesen: () => jaOk({ daten: null }),
      entwurfVerwerfen: () => jaOk(),
      zuletzt: () => jaOk({ zuletzt: [] }),
      exportieren: () => jaOk({ datei: 'C:\\Test\\Export.md' }),
      importieren: () => Promise.resolve({ ok: false, abgebrochen: true }),
      onOeffnenAnfrage: nichts
    },
    manuskript: { lesen: () => Promise.resolve({ ok: false, abgebrochen: true }) },
    bib: {
      liste: () => jaOk({
        ordner: 'C:\\Users\\A\\Documents\\Sluuw',
        eintraege: [
          { datei: 'C:\\Users\\A\\Documents\\Sluuw\\Die Aschekrone.story',
            name: 'Die Aschekrone', inBibliothek: true, groesse: 2400000, geaendert: Date.now() - 3600e3,
            meta: { titel: 'Die Aschekrone', genre: 'Fantasy', worte: 34500, kapitel: 24, kapitelFertig: 7,
                    zielWorte: 90000, figuren: 31, orte: 19, eintraege: 120, schema: 2 }, fehler: null },
          { datei: 'D:\\Woanders\\Zweitwerk.story',
            name: 'Zweitwerk', inBibliothek: false, groesse: 120000, geaendert: Date.now() - 5 * 86400e3,
            meta: { titel: 'Zweitwerk', genre: 'Krimi', worte: 800, kapitel: 2, kapitelFertig: 0,
                    zielWorte: 0, figuren: 3, orte: 1, eintraege: 9, schema: 2 }, fehler: null },
          { datei: 'C:\\Users\\A\\Documents\\Sluuw\\Kaputt.story',
            name: 'Kaputt', inBibliothek: true, groesse: 20, geaendert: Date.now() - 9 * 86400e3,
            meta: null, fehler: 'Das ist keine Sluuw-Datei.' }
        ]
      }),
      speichern: () => jaOk({ datei: 'C:\\Users\\A\\Documents\\Sluuw\\Neu.story', bytes: 1, zuletzt: [] }),
      ordnerWaehlen: () => jaOk({ ordner: 'D:\\Neuer Ordner' }),
      ordnerOeffnen: () => jaOk(),
      umbenennen: () => jaOk({ datei: 'C:\\Users\\A\\Documents\\Sluuw\\Neuer Name.story' }),
      entfernen: () => jaOk({ papierkorb: 'x' }),
      imOrdnerZeigen: () => jaOk()
    },
    app: {
      info: () => jaOk({ version: '1.1.0', electron: '43', chrome: '1' }),
      ordnerZeigen: () => jaOk(),
      protokolliere: nichts,
      onAktualisierung: nichts,
      aktualisierungPruefen: () => Promise.resolve({ ok: false, grund: 'entwicklungsbetrieb' }),
      aktualisierungLaden: nichts, aktualisierungInstallieren: nichts,
      updateEinstellung: nichts
    }
  };
}

function baueUmgebung(htmlPfad, optionen) {
  optionen = optionen || {};
  const html = fs.readFileSync(htmlPfad, 'utf8');
  const js = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const body = html.slice(html.indexOf('<body>'), html.indexOf('<script>'));
  const ids = [...body.matchAll(/id="([^"]+)"/g)].map(m => m[1]);

  const store = {};
  function el(id, tag) {
    const e = {
      id: id || '', tagName: (tag || 'DIV').toUpperCase(), _html: '', value: '', textContent: '',
      style: new Proxy({}, { get: (t, k) => t[k] || '', set: (t, k, v) => (t[k] = v, true) }),
      dataset: {}, children: [], parentElement: null, disabled: false,
      classList: klassenListe(),
      addEventListener() {}, removeEventListener() {}, focus() {}, select() {}, click() {},
      /* Angehängte Elemente mit id landen im Verzeichnis – sonst fände
         getElementById() sie nicht, und Overlays wie die Detailseite
         wären im Test unsichtbar, obwohl die App sie gebaut hat. */
      appendChild(c) { this.children.push(c); if (c && c.id) store[c.id] = c; return c; },
      remove() { if (this.id && store[this.id] === this) delete store[this.id]; },
      setAttribute() {}, getAttribute() { return null; },
      querySelector() { return el('', 'div'); }, querySelectorAll() { return []; },
      closest() { return null; },
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }),
      offsetWidth: 200, offsetHeight: 200, scrollTop: 0,
      get innerHTML() { return this._html; },
      set innerHTML(v) { this._html = String(v); }
    };
    return e;
  }
  ids.forEach(id => store[id] = el(id));

  /* Elemente, die eine Renderfunktion selbst per innerHTML erzeugt,
     kann dieser Ersatz nicht nachbilden – deshalb werden unbekannte
     ids angelegt statt zu scheitern. Dass beim Auswerten des Skripts
     kein $() ins Leere greift, prüft test-durchgaengig.js statisch. */
  const fehlende = [];
  let streng = false;
  const document = {
    documentElement: el('html'), body: el('body'),
    /* Standardmäßig werden unbekannte ids angelegt (siehe oben). Ein
       Test, der gerade prüfen will, ob etwas *vorhanden* ist – etwa ein
       Aufklappmenü –, schaltet das mit strengeIds(true) ab. */
    getElementById: id => store[id] || (streng ? null : (store[id] = el(id))),
    createElement: t => el('', t),
    querySelector: sel => store['__' + sel] || (store['__' + sel] = el('', 'div')),
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    activeElement: { tagName: 'BODY' }
  };
  const localStorage = {
    _d: {},
    getItem(k) { return k in this._d ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; }
  };
  const sandbox = {
    document, localStorage, console,
    addEventListener() {}, removeEventListener() {}, innerWidth: 1280, innerHeight: 800, close() {},
    navigator: { userAgent: 'node' }, location: { href: '' },
    setTimeout, clearTimeout, setInterval, clearInterval,
    Date, Math, JSON, Object, Array, String, Number, Boolean, Set, Map, WeakMap, RegExp, Error, Promise,
    isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, atob: s => Buffer.from(s, 'base64').toString('binary'),
    Blob: class {}, URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
    FileReader: class {}, indexedDB: {}, Image: class {},
    requestAnimationFrame: cb => setTimeout(cb, 0)
  };
  /* Im Browser sind window und der globale Bereich dasselbe Objekt. Die
     Sprachdatei schreibt sich an window – ohne diese Brücke fände die
     Oberfläche sie nicht. */
  sandbox.window = sandbox;
  sandbox.window.document = document;
  sandbox.window.localStorage = localStorage;
  if (optionen.alsAnwendung) sandbox.window.sluuw = brueckeAttrappe();
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  /* Die Sprachdatei liegt im HTML in einem eigenen Skriptblock. Der Ersatz
     führt alle Blöcke der Reihe nach aus, sonst fehlten die Übersetzungen. */
  const bloecke = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  bloecke.forEach((code, i) => vm.runInContext(code, sandbox, { filename: 'block' + (i + 1) + '.js' }));

  /* Rückfragen vor dem Löschen werden im Testlauf bejaht. Geprüft wird,
     was danach mit den Daten passiert; dass die Rückfrage überhaupt
     gestellt wird, prüft test-durchgaengig.js eigens.
     Wer den Dialog selbst durchspielen will, setzt U.sandbox.dlgFrage neu. */
  if (optionen.rueckfragenJa !== false) {
    vm.runInContext('loeschenBestaetigt = async () => true;', sandbox);
  }

  return {
    store, sandbox, localStorage, fehlende,
    strengeIds: (an) => { streng = an !== false; },
    lauf: (code) => vm.runInContext(code, sandbox),
    json: (ausdruck) => JSON.parse(vm.runInContext(`JSON.stringify(${ausdruck})`, sandbox))
  };
}

module.exports = { baueUmgebung, brueckeAttrappe, standardPfad: path.join(__dirname, '..', 'index.html') };

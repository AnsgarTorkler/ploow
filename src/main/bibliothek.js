'use strict';
/* ============================================================
   BIBLIOTHEK
   Projekte, die „in der App" gespeichert werden, landen als ganz
   normale Dateien in einem Ordner, den die Nutzerin auch im
   Explorer findet und mitnehmen kann. Es gibt also keinen
   verborgenen App-Speicher – nur einen voreingestellten Ort.

   Damit die Übersicht nicht jedes Mal jede Datei entpacken muss,
   liegt neben der Bibliothek ein Verzeichnis mit den Eckdaten.
   Es wird nur dort erneuert, wo sich Größe oder Zeitstempel
   geändert haben; verschwundene Dateien fliegen raus. Das
   Verzeichnis ist reiner Zwischenspeicher – geht es verloren,
   wird es beim nächsten Blick neu aufgebaut.
   ============================================================ */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const speicher = require('./storage');
const produkt = require('./produkt');

const ENDUNG = '.story';

/* ---------- Ordner ---------- */
/* Der Name kommt aus produkt.js, nicht als Zeichenkette hierher.
   Beim Wechsel von Ploow auf Sluuw stand er als einziger Ort im
   Projekt fest verdrahtet und wurde von der Umbenennung übersehen –
   ein Test hat es gefunden, ein Nutzer hätte einen falsch benannten
   Ordner in seinen Dokumenten gehabt. */
function standardOrdner(dokumente) {
  return path.join(dokumente, produkt.DATEN_ORDNER);
}
async function ordnerSicherstellen(ordner) {
  await fsp.mkdir(ordner, { recursive: true });
  return ordner;
}

/* ---------- Eckdaten eines Projekts ---------- */
function eckdaten(daten) {
  const b = (daten && daten.book) || {};
  const items = Array.isArray(daten && daten.items) ? daten.items : [];
  const zaehle = art => items.filter(i => i && i.kind === art).length;
  const kapitel = items.filter(i => i && i.kind === 'kapitel');
  return {
    titel: String(b.title || '').slice(0, 200),
    genre: String(b.genre || '').slice(0, 200),
    praemisse: String(b.premise || '').slice(0, 400),
    zielWorte: Number.isFinite(+b.targetWords) ? +b.targetWords : 0,
    worte: kapitel.reduce((n, c) => n + (+c.words || 0), 0),
    kapitel: kapitel.length,
    kapitelFertig: kapitel.filter(c => c.status === 'fertig').length,
    figuren: zaehle('figur'),
    orte: zaehle('ort'),
    eintraege: items.length,
    schema: (daten && Number.isFinite(+daten.schema)) ? +daten.schema : 1
  };
}

/* ---------- Verzeichnis ---------- */
function indexPfad(userDataDir) { return path.join(userDataDir, 'bibliothek-index.json'); }

async function indexLesen(userDataDir) {
  try { return JSON.parse(await fsp.readFile(indexPfad(userDataDir), 'utf8')) || {}; }
  catch { return {}; }
}
async function indexSchreiben(userDataDir, index) {
  try {
    await fsp.mkdir(userDataDir, { recursive: true });
    await speicher.writeAtomic(indexPfad(userDataDir), Buffer.from(JSON.stringify(index), 'utf8'));
  } catch { /* nur Zwischenspeicher – ein Fehler hier darf nichts aufhalten */ }
}

/* ---------- Auflisten ---------- */
async function liste(ordner, userDataDir, zusatzPfade) {
  await ordnerSicherstellen(ordner).catch(() => {});
  const index = await indexLesen(userDataDir);

  /* Dateien im Bibliotheksordner plus alles, was von außen dazukommt
     (zuletzt geöffnete Projekte, die woanders liegen). */
  let imOrdner = [];
  try {
    imOrdner = (await fsp.readdir(ordner))
      .filter(f => f.toLowerCase().endsWith(ENDUNG))
      .map(f => path.join(ordner, f));
  } catch { /* Ordner nicht lesbar – dann eben nur die externen */ }

  const alle = [...new Set([...imOrdner, ...(zusatzPfade || []).filter(Boolean)])];
  const eintraege = [];
  const neuerIndex = {};

  for (const datei of alle) {
    let st;
    try { st = await fsp.stat(datei); } catch { continue; }   // verschwunden
    const schluessel = datei;
    const bekannt = index[schluessel];
    const unveraendert = bekannt && bekannt.groesse === st.size && bekannt.mtime === st.mtimeMs;

    let meta = unveraendert ? bekannt.meta : null;
    let fehler = null;
    if (!meta) {
      try { meta = eckdaten(await speicher.readProject(datei)); }
      catch (e) { fehler = e.message; meta = null; }
    }

    neuerIndex[schluessel] = { groesse: st.size, mtime: st.mtimeMs, meta };
    eintraege.push({
      datei,
      name: path.basename(datei, ENDUNG),
      inBibliothek: path.dirname(datei) === ordner,
      groesse: st.size,
      geaendert: st.mtimeMs,
      meta,
      fehler
    });
  }

  await indexSchreiben(userDataDir, neuerIndex);
  // Zuletzt geändert zuerst – so steht oben, woran man arbeitet
  eintraege.sort((a, b) => b.geaendert - a.geaendert);
  return eintraege;
}

/* ---------- Dateinamen ---------- */
function sauberName(titel) {
  return String(titel || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/* Findet einen freien Namen: „Die Aschekrone", dann „Die Aschekrone 2" … */
async function freierPfad(ordner, titel) {
  const basis = sauberName(titel) || 'Unbenannt';
  let name = basis, n = 1;
  while (fs.existsSync(path.join(ordner, name + ENDUNG))) {
    n++; name = basis + ' ' + n;
    if (n > 999) { name = basis + ' ' + Date.now(); break; }
  }
  return path.join(ordner, name + ENDUNG);
}

/* ---------- Umbenennen und Entfernen ---------- */
async function umbenennen(datei, neuerTitel) {
  const ordner = path.dirname(datei);
  const ziel = await freierPfad(ordner, neuerTitel);
  if (path.resolve(ziel) === path.resolve(datei)) return datei;
  await fsp.rename(datei, ziel);
  // Sicherungsordner wandert mit, sonst verwaist er
  const altSich = speicher.backupDir(datei), neuSich = speicher.backupDir(ziel);
  if (fs.existsSync(altSich)) await fsp.rename(altSich, neuSich).catch(() => {});
  return ziel;
}

/* Gelöscht wird nicht wirklich: die Datei wandert in einen Unterordner.
   Ein Manuskript endgültig zu entfernen ist nichts, was ein Klick tun
   sollte – wer es wirklich loswerden will, findet es im Papierkorb. */
async function inPapierkorb(datei) {
  const ordner = path.join(path.dirname(datei), 'Papierkorb');
  await fsp.mkdir(ordner, { recursive: true });
  const stempel = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const ziel = path.join(ordner, path.basename(datei, ENDUNG) + ' (' + stempel + ')' + ENDUNG);
  await fsp.rename(datei, ziel);
  const sich = speicher.backupDir(datei);
  if (fs.existsSync(sich)) await fsp.rm(sich, { recursive: true, force: true }).catch(() => {});
  return ziel;
}

module.exports = {
  ENDUNG, standardOrdner, ordnerSicherstellen, liste, eckdaten,
  freierPfad, sauberName, umbenennen, inPapierkorb,
  indexPfad, indexLesen, indexSchreiben
};

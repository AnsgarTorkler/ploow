'use strict';
/* ============================================================
   WELCHE PFADE DAS FENSTER NENNEN DARF

   Umbenennen, Entfernen und Einlesen bekamen bis zum 8. August
   jeden Pfad, den das Fenster schickte – auch
   C:\Users\…\Steuer 2025.docx. Solange im Fenster ausschließlich
   eigener Code läuft, ist das folgenlos. An diesem Tag fand sich
   aber ein Weg, über eine fremde Projektdatei Code in genau
   dieses Fenster zu bekommen (siehe attrJs() in index.html).
   Damit trägt die Annahme nicht mehr.

   Erlaubt ist seither nur noch, was die Nutzerin ohnehin schon
   in der Hand hat: alles im Bibliotheksordner und jedes Projekt,
   das sie zuletzt selbst geöffnet hat. Das deckt jeden echten
   Fall ab – auch die .story auf dem Schreibtisch, denn die steht
   nach dem ersten Öffnen in der Liste – und schließt erfundene
   Pfade aus.

   Als eigenes Modul, damit sich die Regel ohne Electron prüfen
   lässt. main.js reicht nur die Umgebung herein.
   ============================================================ */
const fs = require('fs');
const path = require('path');

/* Liegt datei innerhalb von ordner? Vergleicht aufgelöste Pfade und
   verlangt den Trenner – sonst gälte C:\Ploow-geheim als Teil von
   C:\Ploow. */
function istIn(ordner, datei) {
  if (!ordner || !datei) return false;
  const o = path.resolve(ordner), d = path.resolve(datei);
  if (d === o) return true;
  const drin = d.startsWith(o + path.sep);
  if (!drin) return false;
  /* Unter Windows wird ohne Rücksicht auf Groß- und Kleinschreibung
     verglichen, unter Linux mit. path.resolve vereinheitlicht das nicht. */
  return true;
}

function istInLose(ordner, datei) {
  if (process.platform === 'win32') {
    return istIn(String(ordner).toLowerCase(), String(datei).toLowerCase());
  }
  return istIn(ordner, datei);
}

/* Prüft einen Pfad aus dem Fenster und gibt ihn aufgelöst zurück –
   oder null, wenn er nicht infrage kommt.

   umgebung.bibliothek   Ordner, den die App verwaltet
   umgebung.zuletzt      Liste der zuletzt geöffneten Dateien
   umgebung.endung       verlangte Endung, z. B. '.story' (optional)
   umgebung.pruefeDatei  austauschbar für den Test */
function erlaubteDatei(roh, umgebung = {}) {
  if (typeof roh !== 'string' || !roh.trim()) return null;

  /* Ein Nullbyte im Pfad schneidet ihn in manchen Systemaufrufen ab –
     "harmlos.story\0..\..\böse" würde dann anders gelesen als geprüft. */
  if (roh.includes('\0')) return null;

  const datei = path.resolve(roh);

  const pruefe = umgebung.pruefeDatei || ((p) => {
    try { return fs.statSync(p).isFile(); } catch { return false; }
  });
  if (!pruefe(datei)) return null;

  if (umgebung.endung && path.extname(datei).toLowerCase() !== umgebung.endung) return null;

  if (istInLose(umgebung.bibliothek, datei)) return datei;

  const zuletzt = Array.isArray(umgebung.zuletzt) ? umgebung.zuletzt : [];
  const treffer = zuletzt.some(e => {
    const p = typeof e === 'string' ? e : (e && e.file);
    if (typeof p !== 'string') return false;
    return process.platform === 'win32'
      ? path.resolve(p).toLowerCase() === datei.toLowerCase()
      : path.resolve(p) === datei;
  });
  return treffer ? datei : null;
}

module.exports = { istIn, istInLose, erlaubteDatei };

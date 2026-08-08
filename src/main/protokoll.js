'use strict';
/* ============================================================
   ABSTURZ- UND FEHLERPROTOKOLL
   Bewusst lokal: die App verschickt nichts. Wenn etwas schiefgeht,
   landet es in einer Textdatei, die man im Programm öffnen und
   dem Support anhängen kann. Kein Konto, kein Netzwerk, kein
   fremder Dienst – das passt zum Versprechen der App.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const MAX_BYTES = 512 * 1024;
let file = null;

function init(userDataDir) {
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    file = path.join(userDataDir, 'protokoll.txt');
    // Wird die Datei zu groß, bleibt nur die zweite Hälfte stehen
    const st = fs.statSync(file, { throwIfNoEntry: false });
    if (st && st.size > MAX_BYTES) {
      const buf = fs.readFileSync(file);
      fs.writeFileSync(file, buf.slice(buf.length - MAX_BYTES / 2));
    }
  } catch { file = null; }
  return file;
}

function schreibe(stufe, nachricht, extra) {
  const zeile = `[${new Date().toISOString()}] ${stufe} ${nachricht}` +
    (extra ? '\n' + String(extra).split('\n').slice(0, 20).join('\n') : '') + '\n';
  try { if (file) fs.appendFileSync(file, zeile); } catch {}
  if (stufe === 'FEHLER') console.error(zeile.trim());
}

const info = (m, e) => schreibe('INFO  ', m, e);
const fehler = (m, e) => schreibe('FEHLER', m, e);

/* Alles, was sonst still im Nichts verschwinden würde, wird festgehalten. */
function fangeAllesAb() {
  process.on('uncaughtException', e => fehler('Unbehandelter Fehler im Hauptprozess: ' + e.message, e.stack));
  process.on('unhandledRejection', e => fehler('Unbehandeltes Versprechen: ' + (e && e.message), e && e.stack));
}

module.exports = { init, info, fehler, fangeAllesAb, pfad: () => file };

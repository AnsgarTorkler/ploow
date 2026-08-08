'use strict';
/* ============================================================
   SPRACHDATEI IN DIE OBERFLÄCHE EINBETTEN
   src/sprachen.js ist die einzige Quelle. Die Testreihe lädt sie
   direkt, die Oberfläche braucht sie aber im HTML: ein
   <script src="…"> würde an der Inhaltssicherheitsrichtlinie
   scheitern, weil die Seite über file:// geöffnet wird und
   'self' dort keine verlässliche Herkunft ist.

   Also wird der Inhalt zwischen zwei Marken in index.html
   kopiert. Ein Test vergleicht beide Stellen und schlägt an,
   wenn jemand nur eine davon ändert.

   Aufruf: node build/sprachen-einbetten.js
   ============================================================ */
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const QUELLE = path.join(WURZEL, 'src', 'sprachen.js');
const ZIEL = path.join(WURZEL, 'index.html');

const ANFANG = '/* ===== SPRACHEN-ANFANG (erzeugt aus src/sprachen.js) ===== */';
const ENDE = '/* ===== SPRACHEN-ENDE ===== */';

function inhalt() {
  return fs.readFileSync(QUELLE, 'utf8').replace(/\r\n/g, '\n').trim();
}

function einbetten() {
  const roh = fs.readFileSync(ZIEL, 'utf8');
  const crlf = roh.includes('\r\n');
  const html = roh.replace(/\r\n/g, '\n');

  const a = html.indexOf(ANFANG);
  const e = html.indexOf(ENDE);
  if (a < 0 || e < 0) throw new Error('Die Marken fehlen in index.html – bitte ANFANG und ENDE eintragen.');

  const neu = html.slice(0, a + ANFANG.length) + '\n' + inhalt() + '\n' + html.slice(e);
  fs.writeFileSync(ZIEL, crlf ? neu.replace(/\n/g, '\r\n') : neu, 'utf8');
  return { zeichen: inhalt().length };
}

/* Prüft, ob die eingebettete Fassung noch der Quelle entspricht. */
function istAktuell() {
  const html = fs.readFileSync(ZIEL, 'utf8').replace(/\r\n/g, '\n');
  const a = html.indexOf(ANFANG), e = html.indexOf(ENDE);
  if (a < 0 || e < 0) return false;
  return html.slice(a + ANFANG.length, e).trim() === inhalt();
}

if (require.main === module) {
  const r = einbetten();
  console.log('Sprachdatei eingebettet: ' + r.zeichen + ' Zeichen aus src/sprachen.js');
}

module.exports = { einbetten, istAktuell, ANFANG, ENDE, QUELLE, ZIEL };

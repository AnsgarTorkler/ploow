'use strict';
/* ============================================================
   PROGRAMMSYMBOL ERZEUGEN
   Erzeugt build/icon.ico und build/icon.png in allen Größen,
   die Windows anfragt. Genau darum geht es: fehlt eine Größe,
   rechnet Windows sie sich selbst zurecht – und zwar je nach
   Bildschirmauflösung und Ansicht anders. Dann sieht dasselbe
   Programm auf zwei Rechnern verschieden aus. Sind alle Größen
   enthalten, ist das Symbol überall identisch.

   Aufruf:
     node build/icon-erzeugen.js              → gezeichnetes Motiv
     node build/icon-erzeugen.js logo.png     → aus eigenem Bild

   Liegt build/logo.png vor, wird es ohne Argument automatisch
   benutzt. Quellbild bitte quadratisch und mindestens 512×512.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* Windows fragt genau diese Kantenlängen ab (100 %, 125 %, 150 %, 200 % Skalierung). */
const GROESSEN = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];

const HG = [0x1a, 0x19, 0x1f];
const AKZENT = [0xe2, 0xa1, 0x63];
const ZEILE = [0x8e, 0x88, 0x99];

/* ---------- PNG schreiben ---------- */
let crcTabelle = null;
function crc32(buf) {
  if (!crcTabelle) {
    crcTabelle = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTabelle[i] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ crcTabelle[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}
function chunk(typ, daten) {
  const laenge = Buffer.alloc(4); laenge.writeUInt32BE(daten.length, 0);
  const kopf = Buffer.from(typ, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([kopf, daten])), 0);
  return Buffer.concat([laenge, kopf, daten, crc]);
}
function pngSchreiben(breite, hoehe, pixel) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(breite, 0); ihdr.writeUInt32BE(hoehe, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const zeilen = [];
  for (let y = 0; y < hoehe; y++) {
    zeilen.push(Buffer.from([0]));
    zeilen.push(pixel.slice(y * breite * 4, (y + 1) * breite * 4));
  }
  const idat = zlib.deflateSync(Buffer.concat(zeilen), { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- PNG lesen ----------
   Nur so viel, wie für Bildquellen nötig ist: 8 Bit pro Kanal,
   nicht verschränkt, alle fünf Filtertypen, Graustufen, RGB,
   Palette und die Varianten mit Alphakanal. */
function pngLesen(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Das ist keine PNG-Datei.');
  let off = 8, ihdr = null, idat = [], palette = null, trns = null;
  while (off + 8 <= buf.length) {
    const laenge = buf.readUInt32BE(off);
    const typ = buf.slice(off + 4, off + 8).toString('ascii');
    const daten = buf.slice(off + 8, off + 8 + laenge);
    if (typ === 'IHDR') ihdr = {
      breite: daten.readUInt32BE(0), hoehe: daten.readUInt32BE(4),
      tiefe: daten[8], farbtyp: daten[9], verschraenkt: daten[12]
    };
    else if (typ === 'PLTE') palette = daten;
    else if (typ === 'tRNS') trns = daten;
    else if (typ === 'IDAT') idat.push(daten);
    else if (typ === 'IEND') break;
    off += 12 + laenge;
  }
  if (!ihdr) throw new Error('PNG ohne Kopfdaten.');
  if (ihdr.tiefe !== 8) throw new Error('Nur PNG mit 8 Bit je Kanal – bitte umspeichern.');
  if (ihdr.verschraenkt) throw new Error('Verschränkte („interlaced") PNG werden nicht gelesen – bitte ohne Interlace speichern.');

  const kanaele = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.farbtyp];
  if (!kanaele) throw new Error('Unbekannter PNG-Farbtyp: ' + ihdr.farbtyp);

  const roh = zlib.inflateSync(Buffer.concat(idat));
  const { breite, hoehe } = ihdr;
  const bpp = kanaele;
  const schrittweite = breite * bpp;
  const gefiltert = Buffer.alloc(hoehe * schrittweite);

  for (let y = 0; y < hoehe; y++) {
    const filter = roh[y * (schrittweite + 1)];
    const quelle = roh.slice(y * (schrittweite + 1) + 1, (y + 1) * (schrittweite + 1));
    const ziel = gefiltert.slice(y * schrittweite, (y + 1) * schrittweite);
    const oben = y > 0 ? gefiltert.slice((y - 1) * schrittweite, y * schrittweite) : null;
    for (let x = 0; x < schrittweite; x++) {
      const a = x >= bpp ? ziel[x - bpp] : 0;
      const b = oben ? oben[x] : 0;
      const c = oben && x >= bpp ? oben[x - bpp] : 0;
      let v = quelle[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      ziel[x] = v & 0xff;
    }
  }

  // Auf RGBA vereinheitlichen
  const rgba = Buffer.alloc(breite * hoehe * 4);
  for (let i = 0, n = breite * hoehe; i < n; i++) {
    const q = i * bpp, z = i * 4;
    if (ihdr.farbtyp === 0) { rgba[z] = rgba[z + 1] = rgba[z + 2] = gefiltert[q]; rgba[z + 3] = 255; }
    else if (ihdr.farbtyp === 4) { rgba[z] = rgba[z + 1] = rgba[z + 2] = gefiltert[q]; rgba[z + 3] = gefiltert[q + 1]; }
    else if (ihdr.farbtyp === 2) { rgba[z] = gefiltert[q]; rgba[z + 1] = gefiltert[q + 1]; rgba[z + 2] = gefiltert[q + 2]; rgba[z + 3] = 255; }
    else if (ihdr.farbtyp === 6) { gefiltert.copy(rgba, z, q, q + 4); }
    else if (ihdr.farbtyp === 3) {
      const idx = gefiltert[q];
      if (!palette) throw new Error('PNG mit Palette, aber ohne Palettendaten.');
      rgba[z] = palette[idx * 3]; rgba[z + 1] = palette[idx * 3 + 1]; rgba[z + 2] = palette[idx * 3 + 2];
      rgba[z + 3] = trns && idx < trns.length ? trns[idx] : 255;
    }
  }
  return { breite, hoehe, pixel: rgba };
}

/* ---------- Verkleinern ----------
   Flächenmittel statt Nachbarpunkt: nur so bleiben feine Linien
   in den kleinen Größen erkennbar, statt wegzufallen.
   Gerechnet wird mit vormultipliziertem Alpha, sonst zieht
   Farbe aus durchsichtigen Bereichen in die Kanten. */
function skaliere(quelle, n) {
  const { breite: bw, hoehe: bh, pixel } = quelle;
  const ziel = Buffer.alloc(n * n * 4);
  for (let y = 0; y < n; y++) {
    const y0 = Math.floor(y * bh / n), y1 = Math.max(y0 + 1, Math.floor((y + 1) * bh / n));
    for (let x = 0; x < n; x++) {
      const x0 = Math.floor(x * bw / n), x1 = Math.max(x0 + 1, Math.floor((x + 1) * bw / n));
      let r = 0, g = 0, b = 0, a = 0, anzahl = 0;
      for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
        const i = (sy * bw + sx) * 4, al = pixel[i + 3] / 255;
        r += pixel[i] * al; g += pixel[i + 1] * al; b += pixel[i + 2] * al;
        a += pixel[i + 3]; anzahl++;
      }
      const z = (y * n + x) * 4, ma = a / anzahl;
      ziel[z + 3] = Math.round(ma);
      const teiler = anzahl * (ma / 255) || 1;
      ziel[z] = Math.min(255, Math.round(r / teiler));
      ziel[z + 1] = Math.min(255, Math.round(g / teiler));
      ziel[z + 2] = Math.min(255, Math.round(b / teiler));
    }
  }
  return ziel;
}

/* ---------- Ersatzmotiv, falls kein eigenes Bild da ist ---------- */
function zeichne(n) {
  const p = Buffer.alloc(n * n * 4);
  const r = Math.max(2, Math.round(n * 0.22));
  const setze = (x, y, farbe, alpha) => {
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    const i = (y * n + x) * 4, a = alpha === undefined ? 1 : alpha;
    if (a <= 0) return;
    const va = p[i + 3] / 255, ea = a + va * (1 - a);
    for (let k = 0; k < 3; k++) p[i + k] = Math.round((farbe[k] * a + p[i + k] * va * (1 - a)) / (ea || 1));
    p[i + 3] = Math.round(ea * 255);
  };
  const drin = (x, y) => {
    const dx = Math.min(x, n - 1 - x), dy = Math.min(y, n - 1 - y);
    if (dx >= r || dy >= r) return 1;
    const ex = r - dx, ey = r - dy, d = Math.sqrt(ex * ex + ey * ey);
    return Math.max(0, Math.min(1, r - d + 0.5));
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const a = drin(x, y); if (a > 0) setze(x, y, HG, a);
  }
  const spineB = Math.max(2, Math.round(n * 0.13));
  for (let y = 0; y < n; y++) for (let x = 0; x < spineB; x++) {
    const a = drin(x, y); if (a > 0) setze(x, y, AKZENT, a);
  }
  const links = Math.round(n * 0.28), dicke = Math.max(1, Math.round(n * 0.075));
  [[0.30, 0.56], [0.47, 0.66], [0.64, 0.44]].forEach(([oben, breiteAnteil]) => {
    const y0 = Math.round(n * oben), rechts = links + Math.round(n * breiteAnteil);
    for (let y = y0; y < y0 + dicke; y++) for (let x = links; x < Math.min(rechts, n - Math.round(n * 0.12)); x++) {
      setze(x, y, ZEILE, 0.85);
    }
  });
  return p;
}

/* ---------- Einzelbild als DIB ----------
   Eine .ico kann ihre Bilder auf zwei Arten enthalten: als PNG oder
   als klassisches Windows-Bitmap (DIB). PNG ist seit Vista erlaubt
   und spart Platz – aber die Werkzeuge, die das Symbol in die EXE
   schreiben (rcedit), lesen zuverlässig nur DIB. Sind alle Größen
   als PNG abgelegt, bleibt am Ende das Electron-Symbol stehen.

   Deshalb: alles bis 128 als DIB, nur die 256er als PNG. Genau so
   machen es auch übliche Symbol-Werkzeuge. */
function dibSchreiben(n, pixel /* RGBA */) {
  const maskeZeile = Math.ceil(n / 8 / 4) * 4;      // auf 4 Byte aufgefüllt
  const xorBytes = n * n * 4, andBytes = maskeZeile * n;

  const kopf = Buffer.alloc(40);
  kopf.writeUInt32LE(40, 0);
  kopf.writeInt32LE(n, 4);
  kopf.writeInt32LE(n * 2, 8);        // doppelte Höhe: Bild + Maske
  kopf.writeUInt16LE(1, 12);          // Ebenen
  kopf.writeUInt16LE(32, 14);         // Bit je Punkt
  kopf.writeUInt32LE(0, 16);          // unkomprimiert
  kopf.writeUInt32LE(xorBytes + andBytes, 20);

  // Bilddaten: von unten nach oben, Reihenfolge BGRA
  const xor = Buffer.alloc(xorBytes);
  for (let y = 0; y < n; y++) {
    const quelle = (n - 1 - y) * n * 4, ziel = y * n * 4;
    for (let x = 0; x < n; x++) {
      const q = quelle + x * 4, z = ziel + x * 4;
      xor[z] = pixel[q + 2]; xor[z + 1] = pixel[q + 1]; xor[z + 2] = pixel[q]; xor[z + 3] = pixel[q + 3];
    }
  }
  // Maske bleibt leer – bei 32 Bit entscheidet der Alphakanal.
  // Vorhanden sein muss sie trotzdem, sonst ist die Datei ungültig.
  return Buffer.concat([kopf, xor, Buffer.alloc(andBytes)]);
}

/* ---------- ICO packen ---------- */
function icoPacken(bilder) {
  const kopf = Buffer.alloc(6);
  kopf.writeUInt16LE(0, 0); kopf.writeUInt16LE(1, 2); kopf.writeUInt16LE(bilder.length, 4);
  const eintraege = [], daten = [];
  let versatz = 6 + bilder.length * 16;
  bilder.forEach(({ n, buf }) => {
    const e = Buffer.alloc(16);
    e[0] = n >= 256 ? 0 : n; e[1] = n >= 256 ? 0 : n;
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(versatz, 12);
    eintraege.push(e); daten.push(buf); versatz += buf.length;
  });
  return Buffer.concat([kopf, ...eintraege, ...daten]);
}

/* ---------- Ablauf ---------- */
/* ---------- macOS: .icns ----------
   electron-builder verlangt für macOS eine .icns und ersetzt dazu
   einfach die Endung: aus build/icon.png wird build/icon.icns. Fehlt
   die, bricht der Bau ab – genau daran ist der erste Lauf auf
   macos-latest gescheitert.

   Das Format ist einfach: die Kennung 'icns', die Gesamtlänge, dann
   je Bild ein Vierbuchstaben-Typ, die Länge einschließlich dieser
   acht Bytes, und die rohen PNG-Daten. Seit macOS 10.7 dürfen die
   Einträge PNG sein – ein eigener Kodierer ist also nicht nötig.

   Welcher Typ welche Kantenlänge bedeutet, ist von Apple festgelegt.
   1024 lassen wir weg: die Vorlage hat 512, und Hochrechnen macht
   das Symbol nur unscharf, nicht größer. */
const ICNS_TYPEN = [
  ['icp4', 16], ['icp5', 32], ['ic11', 32],   // ic11 = 16 bei doppelter Auflösung
  ['icp6', 64], ['ic12', 64],                 // ic12 = 32 bei doppelter Auflösung
  ['ic07', 128],
  ['ic08', 256], ['ic13', 256],               // ic13 = 128 bei doppelter Auflösung
  ['ic09', 512], ['ic14', 512]                // ic14 = 256 bei doppelter Auflösung
];

function icnsPacken(pngNachGroesse) {
  const bloecke = [];
  for (const [typ, n] of ICNS_TYPEN) {
    const png = pngNachGroesse[n];
    if (!png) continue;
    const kopf = Buffer.alloc(8);
    kopf.write(typ, 0, 4, 'ascii');
    kopf.writeUInt32BE(png.length + 8, 4);
    bloecke.push(kopf, png);
  }
  const inhalt = Buffer.concat(bloecke);
  const kopf = Buffer.alloc(8);
  kopf.write('icns', 0, 4, 'ascii');
  kopf.writeUInt32BE(inhalt.length + 8, 4);
  return Buffer.concat([kopf, inhalt]);
}

function erzeuge(quellPfad) {
  let quelle = null, herkunft = 'gezeichnetes Motiv';
  if (quellPfad && fs.existsSync(quellPfad)) {
    quelle = pngLesen(fs.readFileSync(quellPfad));
    herkunft = path.basename(quellPfad) + ` (${quelle.breite}×${quelle.hoehe})`;
    if (quelle.breite !== quelle.hoehe) {
      console.warn('Hinweis: Das Bild ist nicht quadratisch – Windows verzerrt es. Besser vorher zuschneiden.');
    }
    if (Math.min(quelle.breite, quelle.hoehe) < 256) {
      console.warn('Hinweis: Das Bild ist kleiner als 256 Punkte. Die großen Symbolgrößen werden dadurch unscharf.');
    }
  }
  const bilder = GROESSEN.map(n => {
    const pixel = quelle ? skaliere(quelle, n) : zeichne(n);
    // Bis 128 als DIB, damit rcedit das Symbol in die EXE schreiben kann;
    // die 256er als PNG, sonst wird die Datei unnötig groß.
    return { n, buf: n >= 256 ? pngSchreiben(n, n, pixel) : dibSchreiben(n, pixel), art: n >= 256 ? 'PNG' : 'DIB' };
  });
  fs.writeFileSync(path.join(__dirname, 'icon.ico'), icoPacken(bilder));
  const gross = quelle ? skaliere(quelle, 512) : zeichne(256);
  fs.writeFileSync(path.join(__dirname, 'icon.png'), pngSchreiben(quelle ? 512 : 256, quelle ? 512 : 256, gross));

  /* Und die .icns für macOS. Jede benötigte Kantenlänge einmal als PNG. */
  const nach = {};
  [...new Set(ICNS_TYPEN.map(([, n]) => n))].forEach(n => {
    const pixel = quelle ? skaliere(quelle, n) : zeichne(n);
    nach[n] = pngSchreiben(n, n, pixel);
  });
  fs.writeFileSync(path.join(__dirname, 'icon.icns'), icnsPacken(nach));

  return { herkunft, groessen: GROESSEN, icns: Object.keys(nach).map(Number).sort((a, b) => a - b) };
}

if (require.main === module) {
  const arg = process.argv[2];
  const vorgabe = path.join(__dirname, 'logo.png');
  const quelle = arg ? path.resolve(arg) : (fs.existsSync(vorgabe) ? vorgabe : null);
  const r = erzeuge(quelle);
  console.log('Quelle:  ' + r.herkunft);
  console.log('Größen:  ' + r.groessen.join(', ') + ' px');
  console.log('Erzeugt: build/icon.ico, build/icon.png und build/icon.icns');
  console.log('.icns:   ' + r.icns.join(', ') + ' px');
  if (!quelle) console.log('\nEigenes Bild verwenden: als build/logo.png ablegen (quadratisch, 512×512 oder größer),\ndann "npm run icon" erneut ausführen.');
}

module.exports = { erzeuge, pngLesen, pngSchreiben, dibSchreiben, skaliere, icoPacken,
                   icnsPacken, ICNS_TYPEN, GROESSEN };

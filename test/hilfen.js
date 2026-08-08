'use strict';
/* Kleine Testhilfen – bewusst ohne Testframework, damit die App
   keine Entwicklungsabhängigkeiten braucht, die niemand pflegt. */
const zlib = require('zlib');

let pass = 0, fail = 0;
const failures = [];

function ok(bedingung, name) {
  if (bedingung) { pass++; console.log('  ✓ ' + name); }
  else { fail++; failures.push(name); console.log('  ✗ ' + name); }
}
function gleich(ist, soll, name) {
  const a = JSON.stringify(ist), b = JSON.stringify(soll);
  ok(a === b, name + (a === b ? '' : `  (ist ${a}, erwartet ${b})`));
}
function wirft(fn, name) {
  try { fn(); ok(false, name + ' (kein Fehler geworfen)'); }
  catch { ok(true, name); }
}
async function wirftAsync(fn, name) {
  try { await fn(); ok(false, name + ' (kein Fehler geworfen)'); }
  catch { ok(true, name); }
}
function gruppe(titel) { console.log('\n' + titel); }
function bilanz() {
  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  if (fail) { console.log('Fehlgeschlagen:\n- ' + failures.join('\n- ')); process.exitCode = 1; }
  return fail === 0;
}

/* Minimaler ZIP-Schreiber – nur für die Tests, nicht für die App. */
function zipBuild(files) {
  const chunks = [], central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const data = Buffer.from(content, 'utf8');
    const comp = zlib.deflateRawSync(data);
    const crc = crc32(data);
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(0, 6);
    loc.writeUInt16LE(8, 8); loc.writeUInt32LE(0, 10);
    loc.writeUInt32LE(crc, 14); loc.writeUInt32LE(comp.length, 18); loc.writeUInt32LE(data.length, 22);
    loc.writeUInt16LE(nameBuf.length, 26); loc.writeUInt16LE(0, 28);
    chunks.push(loc, nameBuf, comp);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8); cen.writeUInt16LE(8, 10); cen.writeUInt32LE(0, 12);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += loc.length + nameBuf.length + comp.length;
  }
  const cenBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cenBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([Buffer.concat(chunks), cenBuf, eocd]);
}

let table = null;
function crc32(buf) {
  if (!table) {
    table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}

module.exports = { ok, gleich, wirft, wirftAsync, gruppe, bilanz, zipBuild };

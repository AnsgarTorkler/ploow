'use strict';
/* ============================================================
   WORTZAHLEN AUS DEM ECHTEN MANUSKRIPT
   Bisher tippte man die Wortzahl je Kapitel von Hand ein – die
   Fortschrittsanzeige war damit nur so genau wie die Buchhaltung.
   Dieses Modul liest .docx, .odt, .rtf, .txt und .md und zählt
   nach Überschriften getrennt.

   Bewusst ohne Fremdbibliothek: .docx und .odt sind ZIP-Archive,
   und zlib bringt Node schon mit. Weniger Abhängigkeiten heißt
   weniger Angriffsfläche und keine Lizenzfragen.
   ============================================================ */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

/* ---------- Minimaler ZIP-Leser ---------- */
const SIG_EOCD = 0x06054b50, SIG_CEN = 0x02014b50, SIG_LOC = 0x04034b50;

function findEOCD(buf) {
  const min = Math.max(0, buf.length - 66 * 1024);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) return i;
  }
  return -1;
}

function zipEntries(buf) {
  const eocd = findEOCD(buf);
  if (eocd < 0) throw new Error('Kein gültiges ZIP-Archiv (Ende nicht gefunden).');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  if (off === 0xffffffff) throw new Error('ZIP64-Archive werden nicht unterstützt.');
  const entries = [];
  for (let i = 0; i < count && off + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(off) !== SIG_CEN) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.slice(off + 46, off + 46 + nameLen).toString('utf8');
    entries.push({ name, method, compSize, localOff });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function zipRead(buf, name) {
  const e = zipEntries(buf).find(x => x.name === name);
  if (!e) return null;
  if (buf.readUInt32LE(e.localOff) !== SIG_LOC) throw new Error('Beschädigter ZIP-Eintrag.');
  const nameLen = buf.readUInt16LE(e.localOff + 26);
  const extraLen = buf.readUInt16LE(e.localOff + 28);
  const start = e.localOff + 30 + nameLen + extraLen;
  const raw = buf.slice(start, start + e.compSize);
  if (e.method === 0) return raw;                 // unkomprimiert abgelegt
  if (e.method === 8) return zlib.inflateRawSync(raw);
  throw new Error('Unbekanntes Kompressionsverfahren im Archiv: ' + e.method);
}

/* ---------- Text und Wörter ---------- */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, g) => {
    if (g[0] === '#') {
      const code = g[1] === 'x' || g[1] === 'X' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENT[g] !== undefined ? ENT[g] : m;
  });
}

/* Ein Wort ist alles, was mindestens einen Buchstaben oder eine Ziffer enthält.
   Bindestriche und Apostrophe trennen nicht – „Groß-und-Klein" ist ein Wort. */
function countWords(text) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return 0;
  return t.split(' ').filter(w => /[\p{L}\p{N}]/u.test(w)).length;
}

function pushSection(out, title, text) {
  const words = countWords(text);
  if (!title && !words) return;
  out.push({ title: (title || '').trim().slice(0, 200), words });
}

/* ---------- .docx ---------- */
function parseDocx(buf) {
  const xmlBuf = zipRead(buf, 'word/document.xml');
  if (!xmlBuf) throw new Error('In dieser .docx-Datei fehlt word/document.xml.');
  const xml = xmlBuf.toString('utf8');
  const sections = [];
  let title = '', text = '';
  const paras = xml.split(/<w:p[\s>]/).slice(1);
  for (const p of paras) {
    const body = p.slice(0, p.indexOf('</w:p>') < 0 ? p.length : p.indexOf('</w:p>'));
    const style = (body.match(/<w:pStyle[^>]*w:val="([^"]*)"/) || [])[1] || '';
    // Word nennt die Formatvorlage je nach Sprachfassung anders
    const isHeading = /^(heading|berschrift|Überschrift)/i.test(style);
    const level = parseInt((style.match(/(\d+)\s*$/) || [])[1] || '9', 10);
    let content = '';
    body.replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, (m, g) => { content += decodeEntities(g) + ' '; return m; });
    if (body.includes('<w:tab/>')) content = content.replace(/\s+/g, ' ');
    if (isHeading && level <= 2) {
      pushSection(sections, title, text);
      title = content.trim(); text = '';
    } else {
      text += content + '\n';
    }
  }
  pushSection(sections, title, text);
  return sections;
}

/* ---------- .odt ---------- */
function parseOdt(buf) {
  const xmlBuf = zipRead(buf, 'content.xml');
  if (!xmlBuf) throw new Error('In dieser .odt-Datei fehlt content.xml.');
  const xml = xmlBuf.toString('utf8');
  const sections = [];
  let title = '', text = '';
  const re = /<text:(h|p)\b([^>]*)>([\s\S]*?)<\/text:\1>/g;
  let m;
  while ((m = re.exec(xml))) {
    const tag = m[1], attrs = m[2];
    const content = decodeEntities(m[3].replace(/<[^>]+>/g, ' '));
    const level = parseInt((attrs.match(/text:outline-level="(\d+)"/) || [])[1] || '9', 10);
    if (tag === 'h' && level <= 2) {
      pushSection(sections, title, text);
      title = content.trim(); text = '';
    } else {
      text += content + '\n';
    }
  }
  pushSection(sections, title, text);
  return sections;
}

/* ---------- .rtf (grob, reicht zum Zählen) ---------- */
function parseRtf(buf) {
  let s = buf.toString('latin1');
  s = s.replace(/\\'([0-9a-fA-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
  s = s.replace(/\\u(-?\d+)\??/g, (m, d) => String.fromCharCode(((+d) + 65536) % 65536));
  s = s.replace(/\{\\\*[\s\S]*?\}/g, ' ');
  s = s.replace(/\\par[d]?\b/g, '\n').replace(/\\[a-zA-Z]+-?\d*\s?/g, ' ');
  s = s.replace(/[{}]/g, ' ');
  return splitPlain(s);
}

/* ---------- .txt und .md ---------- */
function splitPlain(text) {
  const sections = [];
  let title = '', body = '';
  for (const line of text.split(/\r?\n/)) {
    const md = line.match(/^\s{0,3}#{1,2}\s+(.*)$/);
    const kap = line.match(/^\s*(?:Kapitel|KAPITEL|Chapter)\s+([\wIVXLC]+)\b[.:\-–—]?\s*(.*)$/);
    if (md || kap) {
      pushSection(sections, title, body);
      title = md ? md[1].trim() : line.trim();
      body = '';
    } else {
      body += line + '\n';
    }
  }
  pushSection(sections, title, body);
  return sections;
}

/* ---------- Einstieg ---------- */
function analyseBuffer(buf, ext) {
  ext = String(ext || '').toLowerCase();
  let sections;
  if (ext === '.docx') sections = parseDocx(buf);
  else if (ext === '.odt') sections = parseOdt(buf);
  else if (ext === '.rtf') sections = parseRtf(buf);
  else sections = splitPlain(buf.toString('utf8'));
  sections = sections.filter(s => s.title || s.words);
  return { sections, total: sections.reduce((n, s) => n + s.words, 0) };
}

function analyseFile(file) {
  const buf = fs.readFileSync(file);
  const r = analyseBuffer(buf, path.extname(file));
  return Object.assign({ file, name: path.basename(file) }, r);
}

module.exports = { analyseFile, analyseBuffer, countWords, zipRead, zipEntries, splitPlain };

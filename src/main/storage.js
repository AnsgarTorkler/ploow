'use strict';
/* ============================================================
   SPEICHERUNG VON .story-DATEIEN
   Eine .story-Datei ist gzip-komprimiertes JSON. Das hebt den
   früheren 4,8-MB-Deckel des Browserspeichers auf, hält die
   Datei klein (Bilddaten komprimieren gut) und bleibt trotzdem
   ein einziges, verschiebbares Dokument.

   Geschrieben wird niemals direkt in die Zieldatei: erst in eine
   Nachbardatei, dann fsync, dann umbenennen. Bricht der Strom
   mitten im Speichern weg, ist die alte Fassung noch vollständig.
   ============================================================ */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const zlib = require('zlib');
const os = require('os');

const MAGIC = Buffer.from('SPLN');      // Kennung am Dateianfang
const FORMAT = 1;                        // Dateiformat (nicht das Datenschema)
const BACKUP_KEEP = 12;                  // so viele Sicherungen bleiben liegen
/* Obergrenze beim Entpacken. Gzip komprimiert Wiederholungen extrem gut:
   aus wenigen hundert Kilobyte lassen sich Gigabyte erzeugen. Ohne Deckel
   würde eine so gebaute .story-Datei den Hauptprozess vollaufen lassen –
   und mit ihm das ganze Programm, samt ungesicherter Arbeit im Fenster.
   400 MB entpackt sind weit mehr, als ein echtes Projekt je erreicht. */
const MAX_ENTPACKT = 400 * 1024 * 1024;
function entpacke(buf) {
  try {
    return zlib.gunzipSync(buf, { maxOutputLength: MAX_ENTPACKT });
  } catch (e) {
    if (/maxOutputLength|larger than|too large|exceed/i.test(e.message || '')) {
      throw new Error('Diese Datei entpackt sich auf über '
        + Math.round(MAX_ENTPACKT / 1048576) + ' MB und wird nicht geladen.');
    }
    throw e;
  }
}

/* ---------- Serialisieren ---------- */
function pack(stateObj) {
  const json = Buffer.from(JSON.stringify(stateObj), 'utf8');
  const body = zlib.gzipSync(json, { level: 6 });
  const head = Buffer.alloc(5);
  MAGIC.copy(head, 0);
  head.writeUInt8(FORMAT, 4);
  return Buffer.concat([head, body]);
}

function unpack(buf) {
  if (!buf || !buf.length) throw new Error('Die Datei ist leer.');
  // Eigenes Format
  if (buf.length > 5 && buf.slice(0, 4).equals(MAGIC)) {
    const format = buf.readUInt8(4);
    if (format > FORMAT) {
      throw new Error('Diese Datei wurde mit einer neueren Version von Ploow geschrieben.');
    }
    return JSON.parse(entpacke(buf.slice(5)).toString('utf8'));
  }
  // Blanke gzip-Datei
  if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    return JSON.parse(entpacke(buf).toString('utf8'));
  }
  // Unkomprimiertes JSON (exportierte Sicherungen aus älteren Fassungen)
  const text = buf.toString('utf8').replace(/^﻿/, '').trim();
  if (text.startsWith('{')) return JSON.parse(text);
  throw new Error('Das ist keine Ploow-Datei.');
}

/* ---------- Atomar schreiben ---------- */
async function writeAtomic(target, buf) {
  const dir = path.dirname(target);
  await fsp.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, '.' + path.basename(target) + '.' + process.pid + '.tmp');
  let fh;
  try {
    fh = await fsp.open(tmp, 'w');
    await fh.writeFile(buf);
    await fh.sync();          // erst wenn die Daten wirklich auf der Platte sind …
  } finally {
    if (fh) await fh.close().catch(() => {});
  }
  /* Unter Windows kann das Umbenennen scheitern, wenn ein Virenscanner oder
     die Dateivorschau die Zieldatei gerade offen hält. Das ist kein echter
     Fehler, sondern geht nach einem Moment durch – also kurz erneut versuchen. */
  let letzter;
  for (let versuch = 0; versuch < 5; versuch++) {
    try { await fsp.rename(tmp, target); return; }
    catch (e) {
      letzter = e;
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(e.code)) break;
      await new Promise(r => setTimeout(r, 60 * (versuch + 1)));
    }
  }
  await fsp.unlink(tmp).catch(() => {});
  throw letzter;
}

/* ---------- Rollierende Sicherungen ---------- */
function backupDir(target) {
  return path.join(path.dirname(target), path.basename(target, path.extname(target)) + '.sicherungen');
}

async function rotateBackup(target) {
  let old;
  try { old = await fsp.readFile(target); } catch { return; }   // noch keine Vorgängerfassung
  const dir = backupDir(target);
  await fsp.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  await fsp.writeFile(path.join(dir, stamp + path.extname(target)), old);
  const files = (await fsp.readdir(dir)).filter(f => f.endsWith(path.extname(target))).sort();
  for (const f of files.slice(0, Math.max(0, files.length - BACKUP_KEEP))) {
    await fsp.unlink(path.join(dir, f)).catch(() => {});
  }
}

/* ---------- Öffentliche Schnittstelle ---------- */
async function readProject(file) {
  const buf = await fsp.readFile(file);
  return unpack(buf);
}

async function writeProject(file, stateObj, { backup = true } = {}) {
  const buf = pack(stateObj);
  if (backup) await rotateBackup(file).catch(() => {});
  await writeAtomic(file, buf);
  return { bytes: buf.length };
}

/* Zwischenspeicher für noch nie gespeicherte Projekte: geht nichts verloren,
   wenn jemand eine Stunde tippt und dann der Rechner abstürzt. */
function draftPath(userDataDir) {
  return path.join(userDataDir, 'entwurf.autosave');
}
async function writeDraft(userDataDir, stateObj) {
  await writeAtomic(draftPath(userDataDir), pack(stateObj));
}
async function readDraft(userDataDir) {
  try { return unpack(await fsp.readFile(draftPath(userDataDir))); } catch { return null; }
}
async function clearDraft(userDataDir) {
  await fsp.unlink(draftPath(userDataDir)).catch(() => {});
}

/* ---------- Zuletzt geöffnet ---------- */
function recentPath(userDataDir) { return path.join(userDataDir, 'zuletzt.json'); }

async function readRecent(userDataDir) {
  try {
    const list = JSON.parse(await fsp.readFile(recentPath(userDataDir), 'utf8'));
    if (!Array.isArray(list)) return [];
    // Verschwundene Dateien fliegen still raus
    const out = [];
    for (const e of list) {
      if (e && typeof e.file === 'string' && fs.existsSync(e.file)) out.push(e);
    }
    return out.slice(0, 10);
  } catch { return []; }
}

async function pushRecent(userDataDir, file, title) {
  const list = (await readRecent(userDataDir)).filter(e => e.file !== file);
  list.unshift({ file, title: title || path.basename(file), at: new Date().toISOString() });
  await fsp.mkdir(userDataDir, { recursive: true }).catch(() => {});
  await writeAtomic(recentPath(userDataDir), Buffer.from(JSON.stringify(list.slice(0, 10), null, 2), 'utf8'));
  return list.slice(0, 10);
}

module.exports = {
  pack, unpack, writeAtomic, readProject, writeProject, MAX_ENTPACKT,
  backupDir, rotateBackup,
  writeDraft, readDraft, clearDraft, draftPath,
  readRecent, pushRecent, recentPath,
  FORMAT, BACKUP_KEEP
};

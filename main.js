'use strict';
/* ============================================================
   HAUPTPROZESS
   Verantwortlich für Fenster, Dateidialoge und alles, was das
   Betriebssystem betrifft. Die Oberfläche selbst hat weder
   Node-Zugriff noch Netzwerkfreiheit – sie fragt hier nach.
   ============================================================ */
const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');

const protokoll = require('./src/main/protokoll');
const speicher = require('./src/main/storage');
const manuskript = require('./src/main/manuskript');
const bibliothek = require('./src/main/bibliothek');
const zugriff = require('./src/main/zugriff');

/* ------------------------------------------------------------
   NAME UND KENNUNG
   Die Werte stehen in src/main/produkt.js. Sie aus package.json
   zu lesen wäre naheliegend gewesen – funktioniert aber nur im
   Entwicklungsbetrieb: electron-builder entfernt den "build"-
   Block beim Packen, im fertigen Programm ist er nicht mehr da.
   Ein Test hält beide Stellen deckungsgleich.
   ------------------------------------------------------------ */
const produkt = require('./src/main/produkt');
const APP_NAME = produkt.NAME;
const APP_ID = produkt.APP_ID;

/* Windows gruppiert und heftet Fenster über die AppUserModelID an die
   Taskleiste. Ohne sie kann ein angeheftetes Symbol nach einem Update
   auf ein anderes zeigen als die Verknüpfung im Startmenü. */
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

/* Der Einstellungsordner hängt sonst am Produktnamen. Würde der Name
   später geändert, läge die Liste der zuletzt geöffneten Projekte
   plötzlich woanders und wäre für die Nutzerin verschwunden.
   Deshalb wird der Pfad hier einmal festgenagelt. */
app.setName(APP_NAME);
app.setPath('userData', path.join(app.getPath('appData'), produkt.DATEN_ORDNER));

const USERDATA = app.getPath('userData');
protokoll.init(USERDATA);
protokoll.fangeAllesAb();

let win = null;
let aktuelleDatei = null;      // Pfad der offenen .story-Datei, null = noch nie gespeichert
let schliessenErzwingen = false;

/* Nur eine Instanz: sonst schreiben zwei Fenster in dieselbe Datei. */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    const datei = argv.find(a => a.toLowerCase().endsWith('.story'));
    if (datei && fs.existsSync(datei)) win.webContents.send('datei:oeffnenAnfrage', datei);
  });
}

/* ------------------------------------------------------------
   FENSTER
   ------------------------------------------------------------ */
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 620,
    title: APP_NAME,
    frame: false,
    backgroundColor: '#121116',
    show: false,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      devTools: !app.isPackaged        // im fertigen Programm aus, beim Entwickeln an
    }
  });

  win.loadFile('index.html');
  win.once('ready-to-show', () => win.show());

  /* Ohne das hier würde der <title> der Seite den Fensternamen überschreiben –
     in Taskleiste und Alt+Tab stünde dann die lange Seitenüberschrift statt
     des Programmnamens, und zwar je nach geöffneter Ansicht unterschiedlich. */
  win.on('page-title-updated', e => { e.preventDefault(); win.setTitle(APP_NAME); });

  const sendState = () => {
    if (win && !win.isDestroyed()) win.webContents.send('fenster:zustand', win.isMaximized());
  };
  win.on('maximize', sendState);
  win.on('unmaximize', sendState);
  win.webContents.on('did-finish-load', () => {
    sendState();
    const datei = process.argv.find(a => a.toLowerCase().endsWith('.story'));
    if (datei && fs.existsSync(datei)) win.webContents.send('datei:oeffnenAnfrage', datei);
  });

  /* Vor dem Schließen fragt die Oberfläche nach ungesicherten Änderungen.
     Antwortet sie nicht – etwa nach einem Absturz der Anzeige –, geht das
     Fenster nach zwei Sekunden trotzdem zu. Ein Programm, das sich nicht
     mehr schließen lässt, wäre schlimmer als ein verlorener Absatz. */
  let schliessenTimer = null;
  win.on('close', e => {
    if (schliessenErzwingen || !win) return;
    if (win.webContents.isDestroyed() || win.webContents.isCrashed()) return;
    e.preventDefault();
    win.webContents.send('app:schliessenAngefragt');
    clearTimeout(schliessenTimer);
    schliessenTimer = setTimeout(() => {
      protokoll.fehler('Oberfläche antwortete nicht auf die Schließen-Anfrage – Fenster wird geschlossen');
      schliessenErzwingen = true;
      if (win && !win.isDestroyed()) win.close();
    }, 2000);
  });
  ipcMain.on('app:schliessenLaeuft', () => clearTimeout(schliessenTimer));

  win.on('closed', () => { win = null; });

  win.webContents.on('render-process-gone', (_e, d) =>
    protokoll.fehler('Oberfläche abgestürzt: ' + d.reason, d.exitCode));
  win.webContents.on('unresponsive', () => protokoll.fehler('Oberfläche reagiert nicht'));
}

/* ------------------------------------------------------------
   ABSICHERUNG
   Die Oberfläche zeigt Inhalte an, die aus importierten Dateien
   stammen können. Selbst wenn dort etwas durchrutscht, darf es
   das Fenster nicht wegnavigieren, kein zweites Fenster öffnen
   und nichts nach außen schicken.
   ------------------------------------------------------------ */
function sichereApp() {
  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-navigate', (ev, url) => {
      const erlaubt = url.startsWith('file://') && url.includes('index.html');
      if (!erlaubt) { ev.preventDefault(); protokoll.fehler('Navigation blockiert: ' + url); }
    });
    contents.setWindowOpenHandler(({ url }) => {
      // Externe Verweise gehen in den Systembrowser, nie in ein App-Fenster
      if (/^https?:\/\//.test(url)) shell.openExternal(url).catch(() => {});
      else protokoll.fehler('Fensteröffnung blockiert: ' + url);
      return { action: 'deny' };
    });
    contents.on('will-attach-webview', ev => ev.preventDefault());
  });

  session.defaultSession.setPermissionRequestHandler((_wc, berechtigung, cb) => {
    protokoll.info('Berechtigung verweigert: ' + berechtigung);
    cb(false);   // Kamera, Mikrofon, Ort, Benachrichtigungen: nichts davon braucht die App
  });
  session.defaultSession.setPermissionCheckHandler(() => false);
}

/* ------------------------------------------------------------
   HILFSFUNKTIONEN
   ------------------------------------------------------------ */
const FILTER = [{ name: 'Ploow-Projekt', extensions: ['story'] }];
const MANUSKRIPT_FILTER = [{ name: 'Manuskript', extensions: ['docx', 'odt', 'rtf', 'txt', 'md'] }];

function sicherName(titel) {
  return String(titel || 'Unbenannt').replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 80) || 'Unbenannt';
}
const ok = (daten) => Object.assign({ ok: true }, daten);
const fehler = (e, wo) => {
  protokoll.fehler(wo + ': ' + (e && e.message), e && e.stack);
  return { ok: false, fehler: (e && e.message) || 'Unbekannter Fehler' };
};

async function oeffneUndMelde(datei) {
  const daten = await speicher.readProject(datei);
  aktuelleDatei = datei;
  const liste = await speicher.pushRecent(USERDATA, datei, daten && daten.book && daten.book.title);
  return ok({ datei, daten, zuletzt: liste });
}

/* ------------------------------------------------------------
   SCHNITTSTELLE ZUR OBERFLÄCHE
   ------------------------------------------------------------ */
ipcMain.on('fenster:minimieren', () => win && win.minimize());
ipcMain.on('fenster:maximieren', () => win && (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.on('fenster:schliessen', () => win && win.close());
ipcMain.handle('fenster:istMaximiert', () => (win ? win.isMaximized() : false));
ipcMain.on('app:schliessenBestaetigt', () => { schliessenErzwingen = true; if (win) win.close(); });

ipcMain.handle('datei:neu', async () => { aktuelleDatei = null; return ok({ datei: null }); });

/* ------------------------------------------------------------
   BIBLIOTHEK
   Ein ganz normaler Ordner – voreingestellt in den Dokumenten.
   „In der App gespeichert" heißt also nur: an einem Ort, den die
   App kennt. Die Dateien bleiben sichtbar, verschiebbar und
   sicherbar wie alle anderen auch.
   ------------------------------------------------------------ */
function bibliotheksOrdner() {
  const eigener = einstellungen.bibliothek;
  return eigener || bibliothek.standardOrdner(app.getPath('documents'));
}
let einstellungen = { bibliothek: null };
const einstellungenPfad = () => path.join(USERDATA, 'programm.json');
try { Object.assign(einstellungen, JSON.parse(fs.readFileSync(einstellungenPfad(), 'utf8'))); } catch {}
function einstellungenSichern() {
  try { fs.writeFileSync(einstellungenPfad(), JSON.stringify(einstellungen, null, 2)); }
  catch (e) { protokoll.fehler('Programmeinstellungen: ' + e.message); }
}

/* ------------------------------------------------------------
   WELCHE PFADE DAS FENSTER NENNEN DARF
   Die Regel steht in src/main/zugriff.js, damit sie sich ohne
   Electron prüfen lässt. Hier wird nur die Umgebung gereicht.
   ------------------------------------------------------------ */
async function erlaubteDatei(roh, { nurStory = true } = {}) {
  return zugriff.erlaubteDatei(roh, {
    bibliothek: bibliotheksOrdner(),
    zuletzt: await speicher.readRecent(USERDATA),
    endung: nurStory ? bibliothek.ENDUNG : null
  });
}

/* Einheitliche Absage. Bewusst ohne Angabe, ob die Datei existiert –
   sonst ließe sich die Platte darüber abfragen. */
const nichtErlaubt = (was) => {
  protokoll.fehler('Zugriff abgelehnt (' + was + ')');
  return { ok: false, fehler: 'Auf diese Datei greift Ploow nicht zu. '
    + 'Es lassen sich nur Projekte aus dem Geschichten-Ordner und zuletzt geöffnete Projekte bearbeiten.' };
};

ipcMain.handle('bib:liste', async () => {
  try {
    const ordner = bibliotheksOrdner();
    const zuletzt = (await speicher.readRecent(USERDATA)).map(e => e.file);
    return ok({ ordner, eintraege: await bibliothek.liste(ordner, USERDATA, zuletzt) });
  } catch (e) { return fehler(e, 'Bibliothek lesen'); }
});

/* Speichern ohne Dialog: das Projekt bekommt einen Platz in der Bibliothek. */
ipcMain.handle('bib:speichern', async (_e, { daten, titel }) => {
  try {
    const ordner = await bibliothek.ordnerSicherstellen(bibliotheksOrdner());
    const ziel = aktuelleDatei && path.dirname(aktuelleDatei) === ordner
      ? aktuelleDatei
      : await bibliothek.freierPfad(ordner, titel);
    const { bytes } = await speicher.writeProject(ziel, daten);
    aktuelleDatei = ziel;
    await speicher.clearDraft(USERDATA).catch(() => {});
    const liste = await speicher.pushRecent(USERDATA, ziel, titel);
    return ok({ datei: ziel, bytes, zuletzt: liste });
  } catch (e) { return fehler(e, 'In der Bibliothek speichern'); }
});

ipcMain.handle('bib:ordnerWaehlen', async () => {
  try {
    const r = await dialog.showOpenDialog(win, {
      title: 'Ordner für deine Geschichten wählen',
      defaultPath: bibliotheksOrdner(),
      properties: ['openDirectory', 'createDirectory']
    });
    if (r.canceled || !r.filePaths[0]) return { ok: false, abgebrochen: true };
    einstellungen.bibliothek = r.filePaths[0];
    einstellungenSichern();
    return ok({ ordner: einstellungen.bibliothek });
  } catch (e) { return fehler(e, 'Ordner wählen'); }
});

ipcMain.handle('bib:ordnerOeffnen', async () => {
  try { await shell.openPath(await bibliothek.ordnerSicherstellen(bibliotheksOrdner())); return ok(); }
  catch (e) { return fehler(e, 'Ordner öffnen'); }
});

ipcMain.handle('bib:umbenennen', async (_e, { datei, titel }) => {
  try {
    const geprueft = await erlaubteDatei(datei);
    if (!geprueft) return nichtErlaubt('umbenennen');
    const neu = await bibliothek.umbenennen(geprueft, titel);
    if (aktuelleDatei === geprueft) aktuelleDatei = neu;
    return ok({ datei: neu });
  } catch (e) { return fehler(e, 'Umbenennen'); }
});

ipcMain.handle('bib:entfernen', async (_e, { datei }) => {
  try {
    const geprueft = await erlaubteDatei(datei);
    if (!geprueft) return nichtErlaubt('entfernen');
    const ziel = await bibliothek.inPapierkorb(geprueft);
    if (aktuelleDatei === geprueft) aktuelleDatei = null;
    return ok({ papierkorb: ziel });
  } catch (e) { return fehler(e, 'Entfernen'); }
});

ipcMain.handle('bib:imOrdnerZeigen', async (_e, { datei }) => {
  try {
    const geprueft = await erlaubteDatei(datei);
    if (!geprueft) return nichtErlaubt('im Ordner zeigen');
    shell.showItemInFolder(geprueft);
    return ok();
  } catch (e) { return fehler(e, 'Im Ordner zeigen'); }
});

ipcMain.handle('datei:oeffnen', async (_e, vorgegeben) => {
  try {
    /* Ein vorgegebener Pfad kommt entweder aus dem Doppelklick auf eine
       .story oder aus der Liste „zuletzt geöffnet". Beides sind
       Projektdateien – alles andere ist nicht gemeint. Der Ordner wird
       hier bewusst NICHT eingeschränkt: eine .story auf dem Schreibtisch
       muss sich beim ersten Mal öffnen lassen, sonst wäre die
       Dateizuordnung wertlos. Gelesen wird ohnehin nur, was sich als
       Projekt entpacken lässt. */
    let datei = vorgegeben;
    if (datei && path.extname(String(datei)).toLowerCase() !== bibliothek.ENDUNG) {
      return nichtErlaubt('öffnen');
    }
    if (!datei) {
      const r = await dialog.showOpenDialog(win, {
        title: 'Projekt öffnen', filters: FILTER, properties: ['openFile']
      });
      if (r.canceled || !r.filePaths[0]) return { ok: false, abgebrochen: true };
      datei = r.filePaths[0];
    }
    return await oeffneUndMelde(datei);
  } catch (e) { return fehler(e, 'Öffnen'); }
});

ipcMain.handle('datei:speichern', async (_e, { daten, speichernUnter, titel }) => {
  try {
    let ziel = aktuelleDatei;
    if (!ziel || speichernUnter) {
      const r = await dialog.showSaveDialog(win, {
        title: speichernUnter ? 'Projekt speichern unter' : 'Projekt speichern',
        defaultPath: ziel || path.join(app.getPath('documents'), sicherName(titel) + '.story'),
        filters: FILTER
      });
      if (r.canceled || !r.filePath) return { ok: false, abgebrochen: true };
      ziel = r.filePath.toLowerCase().endsWith('.story') ? r.filePath : r.filePath + '.story';
    }
    const { bytes } = await speicher.writeProject(ziel, daten);
    aktuelleDatei = ziel;
    await speicher.clearDraft(USERDATA).catch(() => {});
    const liste = await speicher.pushRecent(USERDATA, ziel, titel);
    return ok({ datei: ziel, bytes, zuletzt: liste });
  } catch (e) { return fehler(e, 'Speichern'); }
});

/* Zwischenspeicher für Projekte, die noch keine Datei haben. */
ipcMain.handle('datei:entwurfSchreiben', async (_e, daten) => {
  try { await speicher.writeDraft(USERDATA, daten); return ok(); }
  catch (e) { return fehler(e, 'Entwurf'); }
});
ipcMain.handle('datei:entwurfLesen', async () => ok({ daten: await speicher.readDraft(USERDATA) }));
ipcMain.handle('datei:entwurfVerwerfen', async () => { await speicher.clearDraft(USERDATA); return ok(); });

ipcMain.handle('datei:zuletzt', async () => ok({ zuletzt: await speicher.readRecent(USERDATA) }));

ipcMain.handle('datei:exportieren', async (_e, { inhalt, name, endung, beschreibung }) => {
  try {
    const r = await dialog.showSaveDialog(win, {
      title: 'Exportieren',
      defaultPath: path.join(app.getPath('documents'), sicherName(name) + endung),
      filters: [{ name: beschreibung || 'Datei', extensions: [endung.replace('.', '')] }]
    });
    if (r.canceled || !r.filePath) return { ok: false, abgebrochen: true };
    const daten = typeof inhalt === 'string' ? Buffer.from(inhalt, 'utf8') : Buffer.from(inhalt);
    await speicher.writeAtomic(r.filePath, daten);
    return ok({ datei: r.filePath });
  } catch (e) { return fehler(e, 'Export'); }
});

/* ------------------------------------------------------------
   PROJEKT ALS ORDNER AUSGEBEN
   Die Oberfläche baut die Dateiliste, hier wird sie geschrieben.
   Jeder Pfad wird Stück für Stück gesäubert und muss unterhalb des
   gewählten Ordners bleiben – eine erfundene Angabe wie "../.."
   darf nicht aus dem Zielordner herausführen.
   ------------------------------------------------------------ */
ipcMain.handle('datei:ordnerExport', async (_e, { ordnerName, dateien }) => {
  try {
    if (!Array.isArray(dateien) || !dateien.length) return { ok: false, fehler: 'Nichts auszugeben.' };
    if (dateien.length > 20000) return { ok: false, fehler: 'Mehr als 20 000 Dateien werden nicht ausgegeben.' };

    const r = await dialog.showOpenDialog(win, {
      title: 'Zielordner wählen',
      defaultPath: app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory']
    });
    if (r.canceled || !r.filePaths[0]) return { ok: false, abgebrochen: true };

    const wurzel = path.join(r.filePaths[0], sicherName(ordnerName) || 'Projekt');
    fs.mkdirSync(wurzel, { recursive: true });

    let n = 0;
    for (const d of dateien) {
      const teile = String(d && d.pfad || '').split('/')
        .filter(t => t && t !== '.' && t !== '..')
        .map(sicherName).filter(Boolean);
      if (!teile.length) continue;
      const ziel = path.join(wurzel, ...teile);
      /* Doppelter Boden: der fertige Pfad muss im Zielordner liegen. */
      const drin = path.resolve(ziel).startsWith(path.resolve(wurzel) + path.sep);
      if (!drin) continue;
      fs.mkdirSync(path.dirname(ziel), { recursive: true });
      fs.writeFileSync(ziel, String(d.inhalt == null ? '' : d.inhalt), 'utf8');
      n++;
    }
    return ok({ ordner: wurzel, anzahl: n });
  } catch (e) { return fehler(e, 'Ordner-Export'); }
});

ipcMain.handle('datei:importieren', async () => {
  try {
    const r = await dialog.showOpenDialog(win, {
      title: 'Sicherung importieren',
      filters: [{ name: 'Ploow-Sicherung', extensions: ['story', 'json'] }],
      properties: ['openFile']
    });
    if (r.canceled || !r.filePaths[0]) return { ok: false, abgebrochen: true };
    const daten = speicher.unpack(fs.readFileSync(r.filePaths[0]));
    return ok({ daten, name: path.basename(r.filePaths[0]) });
  } catch (e) { return fehler(e, 'Import'); }
});

/* Freies JSON einlesen: hier wird nur gelesen und geparst. Was die Datei
   enthält, entscheidet die Oberfläche zusammen mit der Nutzerin – der
   Hauptprozess trifft dazu bewusst keine Annahmen. */
const JSON_GRENZE = 64 * 1024 * 1024;
/* Was sich über „Datei einlesen" verarbeiten lässt. Gilt nur für Pfade,
   die aus dem Fenster kommen – siehe die Begründung im Handler. */
const IMPORT_ENDUNGEN = new Set(['.json', '.csv', '.tsv', '.md', '.markdown', '.txt']);
/* Liest eine Datei zum Einlesen: JSON, CSV oder Markdown. Der Aufrufer
   bekommt den Rohtext und die Endung; das Zerlegen macht die Oberfläche,
   damit die Zuordnung dort in einem Zug mit der Vorschau passiert. */
ipcMain.handle('datei:importLesen', async (e, pfad) => {
  try {
    let datei = typeof pfad === 'string' && pfad ? pfad : null;
    if (!datei) {
      const r = await dialog.showOpenDialog(win, {
        title: 'Datei einlesen',
        filters: [
          { name: 'Alle unterstützten', extensions: ['json', 'csv', 'tsv', 'md', 'markdown', 'txt'] },
          { name: 'JSON', extensions: ['json'] },
          { name: 'Tabelle (CSV/TSV)', extensions: ['csv', 'tsv'] },
          { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
          { name: 'Alle Dateien', extensions: ['*'] }
        ],
        properties: ['openFile']
      });
      if (r.canceled || !r.filePaths[0]) return { ok: false, abgebrochen: true };
      datei = r.filePaths[0];
    }
    /* Kam der Pfad aus dem Fenster – also aus einer hineingezogenen Datei –,
       muss die Endung zu dem passen, was hier überhaupt eingelesen werden
       kann. Ohne das ließe sich über diesen Weg jede beliebige Textdatei
       auf der Platte auslesen, etwa Schlüssel oder Zugangsdaten. Aus dem
       Auswahlfenster kommt der Pfad von der Nutzerin selbst und ist frei. */
    if (pfad) {
      const e = path.extname(String(datei)).toLowerCase();
      if (!IMPORT_ENDUNGEN.has(e)) return nichtErlaubt('einlesen ' + (e || 'ohne Endung'));
    }
    if (!fs.existsSync(datei) || !fs.statSync(datei).isFile()) return { ok: false, fehler: 'Datei nicht gefunden.' };

    const groesse = fs.statSync(datei).size;
    if (groesse > JSON_GRENZE) {
      return { ok: false, fehler: `Die Datei ist ${Math.round(groesse / 1048576)} MB groß. Mehr als ${JSON_GRENZE / 1048576} MB werden nicht eingelesen.` };
    }
    const text = fs.readFileSync(datei, 'utf8').replace(/^\ufeff/, '');
    const endung = path.extname(datei).slice(1).toLowerCase();
    return ok({ text, endung, name: path.basename(datei) });
  } catch (e2) { return fehler(e2, 'Datei einlesen'); }
});

ipcMain.handle('datei:jsonLesen', async () => {
  try {
    const r = await dialog.showOpenDialog(win, {
      title: 'JSON-Datei einlesen',
      filters: [{ name: 'JSON-Datei', extensions: ['json'] }, { name: 'Alle Dateien', extensions: ['*'] }],
      properties: ['openFile']
    });
    if (r.canceled || !r.filePaths[0]) return { ok: false, abgebrochen: true };

    const datei = r.filePaths[0];
    const groesse = fs.statSync(datei).size;
    if (groesse > JSON_GRENZE) {
      return { ok: false, fehler: `Die Datei ist ${Math.round(groesse / 1048576)} MB groß. Mehr als ${JSON_GRENZE / 1048576} MB werden nicht eingelesen.` };
    }

    const text = fs.readFileSync(datei, 'utf8').replace(/^﻿/, '');
    let daten;
    try { daten = JSON.parse(text); }
    catch (e) {
      // Zeilennummer aus der Fehlermeldung holen, das hilft beim Suchen
      const pos = (e.message.match(/position (\d+)/) || [])[1];
      const zeile = pos ? text.slice(0, +pos).split('\n').length : null;
      return { ok: false, fehler: 'Die Datei ist kein gültiges JSON' + (zeile ? ` (Zeile ${zeile})` : '') + ': ' + e.message };
    }
    return ok({ daten, name: path.basename(datei) });
  } catch (e) { return fehler(e, 'JSON lesen'); }
});

/* ------------------------------------------------------------
   ANGEHÄNGTE DATEIEN ÖFFNEN
   Anhänge liegen in der Projektdatei, nicht als eigene Datei auf
   der Platte. Zum Öffnen wird deshalb eine Kopie in einen Ordner
   unter dem Benutzerverzeichnis geschrieben und dem System
   übergeben – ein .docx landet damit in Word.

   Der Ordner wird beim Programmstart geleert, damit sich dort
   keine Kopien fremder Manuskripte ansammeln.
   ------------------------------------------------------------ */
const ANHANG_ORDNER = path.join(USERDATA, 'geoeffnete-anhaenge');

function anhangOrdnerLeeren() {
  try {
    if (!fs.existsSync(ANHANG_ORDNER)) return;
    for (const f of fs.readdirSync(ANHANG_ORDNER)) {
      try { fs.unlinkSync(path.join(ANHANG_ORDNER, f)); } catch {}
    }
  } catch (e) { protokoll.info('Anhangordner nicht aufräumbar: ' + e.message); }
}

/* Dateiendungen, die beim Öffnen Schaden anrichten könnten, werden nicht
   an das Betriebssystem weitergereicht – auch nicht auf Wunsch. */
const ANHANG_GESPERRT = new Set(['exe','com','bat','cmd','scr','pif','msi','msp','ps1','psm1',
  'vbs','vbe','js','jse','wsf','wsh','hta','cpl','jar','lnk','reg','inf','dll','sys','scf','url']);

ipcMain.handle('anhang:oeffnen', async (_e, { name, daten }) => {
  try {
    const sicher = sicherName(name || 'anhang');
    const endung = path.extname(sicher).slice(1).toLowerCase();
    if (ANHANG_GESPERRT.has(endung)) {
      return { ok: false, fehler: 'Dateien mit der Endung .' + endung + ' werden aus Sicherheitsgründen nicht geöffnet. '
        + 'Hänge sie aus und öffne sie bewusst außerhalb des Programms, wenn du der Quelle vertraust.' };
    }
    fs.mkdirSync(ANHANG_ORDNER, { recursive: true });
    const ziel = path.join(ANHANG_ORDNER, sicher);
    await speicher.writeAtomic(ziel, Buffer.from(daten, 'base64'));
    const meldung = await shell.openPath(ziel);
    if (meldung) return { ok: false, fehler: meldung, datei: ziel };
    return ok({ datei: ziel });
  } catch (e) { return fehler(e, 'Anhang öffnen'); }
});

ipcMain.handle('anhang:imOrdnerZeigen', async (_e, { name, daten }) => {
  try {
    /* Dieselbe Sperre wie beim Öffnen. Sie fehlte hier – damit ließ sich
       eine .exe aus einer fremden Projektdatei zwar nicht starten, aber
       auf die Platte schreiben und im Explorer markiert anzeigen, wo ein
       Doppelklick nahe liegt. Eine Sperre mit einer Hintertür ist keine. */
    const sicher = sicherName(name || 'anhang');
    const endung = path.extname(sicher).slice(1).toLowerCase();
    if (ANHANG_GESPERRT.has(endung)) {
      return { ok: false, fehler: 'Dateien mit der Endung .' + endung
        + ' werden aus Sicherheitsgründen nicht auf die Platte geschrieben.' };
    }
    fs.mkdirSync(ANHANG_ORDNER, { recursive: true });
    const ziel = path.join(ANHANG_ORDNER, sicher);
    await speicher.writeAtomic(ziel, Buffer.from(daten, 'base64'));
    shell.showItemInFolder(ziel);
    return ok({ datei: ziel });
  } catch (e) { return fehler(e, 'Anhang zeigen'); }
});

/* Wortzahl eines angehängten Manuskripts, ohne dass es je auf der Platte lag. */
ipcMain.handle('anhang:wortzahl', async (_e, { name, daten }) => {
  try {
    const buf = Buffer.from(daten, 'base64');
    return ok(manuskript.analyseBuffer(buf, path.extname(name || '')));
  } catch (e) { return { ok: false, fehler: e.message }; }
});

ipcMain.handle('manuskript:lesen', async () => {
  try {
    const r = await dialog.showOpenDialog(win, {
      title: 'Manuskript auswählen', filters: MANUSKRIPT_FILTER, properties: ['openFile', 'multiSelections']
    });
    if (r.canceled || !r.filePaths.length) return { ok: false, abgebrochen: true };
    const dateien = r.filePaths.map(f => manuskript.analyseFile(f));
    return ok({ dateien });
  } catch (e) { return fehler(e, 'Manuskript lesen'); }
});

ipcMain.handle('app:info', async () => ok({
  version: app.getVersion(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  protokoll: protokoll.pfad(),
  verpackt: app.isPackaged
}));

ipcMain.handle('app:ordnerZeigen', async (_e, was) => {
  try {
    if (was === 'protokoll' && protokoll.pfad()) shell.showItemInFolder(protokoll.pfad());
    else if (was === 'sicherungen' && aktuelleDatei) shell.openPath(speicher.backupDir(aktuelleDatei));
    else shell.openPath(USERDATA);
    return ok();
  } catch (e) { return fehler(e, 'Ordner zeigen'); }
});

ipcMain.on('protokoll:fehler', (_e, { nachricht, spur }) =>
  protokoll.fehler('Oberfläche: ' + nachricht, spur));

/* ------------------------------------------------------------
   AKTUALISIERUNG

   Seit dem 8. August eingerichtet: electron-updater ist
   installiert, und package.json nennt unter build.publish das
   GitHub-Repository als Bezugsquelle. Beim Start fragt Ploow
   dort nach, ob es eine neuere Fassung gibt.

   Das ist der EINZIGE Netzzugriff im ganzen Programm. Er ist
   abschaltbar (Einstellungen → Aktualisierung), lädt nichts von
   allein herunter (autoDownload = false) und installiert nichts
   ohne Zustimmung. Übertragen wird dabei nur, was jeder
   HTTP-Abruf überträgt – kein Inhalt aus Projekten.

   Wichtig: Website und Datenschutzerklärung beschreiben genau
   das. Wer hier etwas ändert, muss beide mitziehen.

   electron-updater bleibt trotzdem optional eingebunden: wird es
   aus package.json entfernt, läuft die App weiter, statt beim
   Start zu scheitern.
   ------------------------------------------------------------ */
let updater = null, updaterGeprueft = false;
let updatesErlaubt = true;      // wird von der Oberfläche gesetzt

function melde(stand, extra) {
  if (win && !win.isDestroyed()) win.webContents.send('app:aktualisierung', Object.assign({ stand }, extra));
}

/* Lädt electron-updater beim ersten Bedarf und hängt die Ereignisse ein. */
function holeUpdater() {
  if (updaterGeprueft) return updater;
  updaterGeprueft = true;
  try { updater = require('electron-updater').autoUpdater; }
  catch {
    protokoll.info('electron-updater ist nicht installiert – Aktualisierung ist abgeschaltet');
    return (updater = null);
  }
  try {
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.logger = { info: protokoll.info, warn: protokoll.info, error: protokoll.fehler, debug: () => {} };
    updater.on('update-available', i => melde('verfuegbar', { version: i.version }));
    updater.on('update-not-available', () => melde('keine', { version: app.getVersion() }));
    updater.on('download-progress', p => melde('laedt', { prozent: Math.round(p.percent || 0) }));
    updater.on('update-downloaded', i => melde('geladen', { version: i.version }));
    updater.on('error', e => {
      protokoll.fehler('Aktualisierung: ' + e.message);
      melde('fehler', { fehler: e.message });
    });
  } catch (e) {
    protokoll.fehler('Aktualisierung nicht einrichtbar: ' + e.message);
    updater = null;
  }
  return updater;
}

/* Automatische Prüfung beim Start – nur wenn erlaubt und wenn es ein
   fertiges Programm ist. Im Entwicklungsbetrieb wäre sie sinnlos. */
function pruefeAktualisierung() {
  if (!app.isPackaged || !updatesErlaubt) return;
  const u = holeUpdater();
  if (!u) return;
  u.checkForUpdates().catch(e => protokoll.info('Aktualisierungsprüfung nicht möglich: ' + e.message));
}

ipcMain.on('app:updateEinstellung', (_e, an) => {
  updatesErlaubt = !!an;
  protokoll.info('Aktualisierungsprüfung ' + (updatesErlaubt ? 'eingeschaltet' : 'abgeschaltet'));
});

ipcMain.handle('app:aktualisierungPruefen', async () => {
  const u = holeUpdater();
  if (!u) return { ok: false, grund: 'nicht-eingerichtet' };
  if (!app.isPackaged) return { ok: false, grund: 'entwicklungsbetrieb' };
  melde('suche');
  try { await u.checkForUpdates(); return { ok: true }; }
  catch (e) { melde('fehler', { fehler: e.message }); return { ok: false, grund: 'fehler', fehler: e.message }; }
});

ipcMain.on('app:aktualisierungLaden', () => {
  const u = holeUpdater(); if (u) u.downloadUpdate().catch(() => {});
});
ipcMain.on('app:aktualisierungInstallieren', () => {
  const u = holeUpdater(); if (!u) return;
  schliessenErzwingen = true;
  u.quitAndInstall();
});

/* ------------------------------------------------------------ */
app.whenReady().then(() => {
  sichereApp();
  anhangOrdnerLeeren();     // Kopien vom letzten Mal nicht liegen lassen
  createWindow();
  pruefeAktualisierung();
  protokoll.info('Gestartet, Version ' + app.getVersion());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('open-file', (e, datei) => {      // macOS: Doppelklick auf eine .story-Datei
  e.preventDefault();
  if (win) win.webContents.send('datei:oeffnenAnfrage', datei);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

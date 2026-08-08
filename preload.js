'use strict';
/* ============================================================
   BRÜCKE ZWISCHEN OBERFLÄCHE UND HAUPTPROZESS
   Die Oberfläche bekommt genau diese Funktionen – keine
   Dateisystem-Rechte, kein Node, kein require. Jede Funktion
   ist eine geschlossene Aufgabe, kein durchgereichter Zugriff.
   ============================================================ */
const { contextBridge, ipcRenderer } = require('electron');

const nurFunktion = f => (typeof f === 'function' ? f : () => {});

contextBridge.exposeInMainWorld('ploow', {

  /* ---- Fenster ---- */
  minimize: () => ipcRenderer.send('fenster:minimieren'),
  toggleMaximize: () => ipcRenderer.send('fenster:maximieren'),
  close: () => ipcRenderer.send('fenster:schliessen'),
  isMaximized: () => ipcRenderer.invoke('fenster:istMaximiert'),
  onStateChange: cb => ipcRenderer.on('fenster:zustand', (_e, max) => nurFunktion(cb)(!!max)),

  /* ---- Schließen mit Rückfrage ---- */
  onCloseRequested: cb => ipcRenderer.on('app:schliessenAngefragt', () => nurFunktion(cb)()),
  closeInProgress: () => ipcRenderer.send('app:schliessenLaeuft'),
  confirmClose: () => ipcRenderer.send('app:schliessenBestaetigt'),

  /* ---- Projektdateien ---- */
  datei: {
    neu: () => ipcRenderer.invoke('datei:neu'),
    oeffnen: pfad => ipcRenderer.invoke('datei:oeffnen', typeof pfad === 'string' ? pfad : undefined),
    speichern: (daten, speichernUnter, titel) =>
      ipcRenderer.invoke('datei:speichern', { daten, speichernUnter: !!speichernUnter, titel: String(titel || '') }),
    entwurfSchreiben: daten => ipcRenderer.invoke('datei:entwurfSchreiben', daten),
    entwurfLesen: () => ipcRenderer.invoke('datei:entwurfLesen'),
    entwurfVerwerfen: () => ipcRenderer.invoke('datei:entwurfVerwerfen'),
    zuletzt: () => ipcRenderer.invoke('datei:zuletzt'),
    exportieren: (inhalt, name, endung, beschreibung) =>
      ipcRenderer.invoke('datei:exportieren', { inhalt, name, endung, beschreibung }),
    importieren: () => ipcRenderer.invoke('datei:importieren'),
    jsonLesen: () => ipcRenderer.invoke('datei:jsonLesen'),
    /* Ohne Pfad öffnet sich ein Auswahlfenster, mit Pfad wird die
       hineingezogene Datei gelesen. */
    importLesen: (pfad) => ipcRenderer.invoke('datei:importLesen', pfad || null),
    ordnerExport: (auftrag) => ipcRenderer.invoke('datei:ordnerExport', auftrag),
    onOeffnenAnfrage: cb => ipcRenderer.on('datei:oeffnenAnfrage', (_e, p) => nurFunktion(cb)(p))
  },

  /* ---- Manuskript einlesen ---- */
  manuskript: {
    lesen: () => ipcRenderer.invoke('manuskript:lesen')
  },

  /* ---- Bibliothek: der Ordner, den die App verwaltet ---- */
  bib: {
    liste: () => ipcRenderer.invoke('bib:liste'),
    speichern: (daten, titel) => ipcRenderer.invoke('bib:speichern', { daten, titel: String(titel || '') }),
    ordnerWaehlen: () => ipcRenderer.invoke('bib:ordnerWaehlen'),
    ordnerOeffnen: () => ipcRenderer.invoke('bib:ordnerOeffnen'),
    umbenennen: (datei, titel) => ipcRenderer.invoke('bib:umbenennen', { datei: String(datei), titel: String(titel || '') }),
    entfernen: datei => ipcRenderer.invoke('bib:entfernen', { datei: String(datei) }),
    imOrdnerZeigen: datei => ipcRenderer.invoke('bib:imOrdnerZeigen', { datei: String(datei) })
  },

  /* ---- Angehängte Dateien ---- */
  anhang: {
    oeffnen: (name, daten) => ipcRenderer.invoke('anhang:oeffnen', { name: String(name || ''), daten: String(daten || '') }),
    imOrdnerZeigen: (name, daten) => ipcRenderer.invoke('anhang:imOrdnerZeigen', { name: String(name || ''), daten: String(daten || '') }),
    wortzahl: (name, daten) => ipcRenderer.invoke('anhang:wortzahl', { name: String(name || ''), daten: String(daten || '') })
  },

  /* ---- Programm ---- */
  app: {
    info: () => ipcRenderer.invoke('app:info'),
    ordnerZeigen: was => ipcRenderer.invoke('app:ordnerZeigen', String(was || '')),
    protokolliere: (nachricht, spur) =>
      ipcRenderer.send('protokoll:fehler', { nachricht: String(nachricht), spur: String(spur || '') }),
    onAktualisierung: cb => ipcRenderer.on('app:aktualisierung', (_e, d) => nurFunktion(cb)(d)),
    aktualisierungPruefen: () => ipcRenderer.invoke('app:aktualisierungPruefen'),
    aktualisierungLaden: () => ipcRenderer.send('app:aktualisierungLaden'),
    aktualisierungInstallieren: () => ipcRenderer.send('app:aktualisierungInstallieren'),
    updateEinstellung: an => ipcRenderer.send('app:updateEinstellung', !!an)
  }
});

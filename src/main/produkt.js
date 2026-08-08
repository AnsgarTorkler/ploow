'use strict';
/* ============================================================
   PRODUKTANGABEN
   Name und Kennung stehen hier – nicht in package.json, weil
   electron-builder den "build"-Block beim Packen entfernt.
   Zur Laufzeit wäre er im fertigen Programm also nicht mehr da,
   und genau daran ist die Version 1.1.0 beim Start abgestürzt.

   Damit die Angaben trotzdem nicht auseinanderlaufen, vergleicht
   test/test-kennung.js diese Datei mit package.json. Wer nur
   eine von beiden ändert, bekommt einen roten Test.
   ============================================================ */
module.exports = {
  /* Erscheint in Fenster, Taskleiste, Startmenü und Verknüpfung.
     Muss mit build.productName in package.json übereinstimmen. */
  NAME: 'Sluuw',

  /* Windows gruppiert und heftet Fenster über diese Kennung an die
     Taskleiste. Muss mit build.appId übereinstimmen und darf nach
     der ersten Veröffentlichung nie mehr geändert werden. */
  APP_ID: 'de.torkler.sluuw',

  /* Ordner für Einstellungen, zuletzt geöffnete Projekte und das
     Protokoll. Bewusst unabhängig vom Produktnamen: wird das
     Programm später umbenannt, sollen die Daten dort bleiben. */
  DATEN_ORDNER: 'Sluuw'
};

# Auslieferung

Was noch zu tun ist, bevor Ploow verkauft werden kann – und was schon fertig ist.

## Vor dem ersten Verkauf zwingend erledigen

### 1. Platzhalter ausfüllen

In `package.json` steht an drei Stellen `BITTE-EINTRAGEN`:

| Feld | Bedeutung |
|---|---|
| `author.name`, `author.email` | Erscheint in den Dateieigenschaften der EXE |
| `build.appId` | Eindeutige Kennung, umgekehrte Domain, z. B. `de.deinname.storyplaner`. **Nach der ersten Veröffentlichung nicht mehr ändern** – sonst gilt jede Aktualisierung als anderes Programm |
| `build.copyright` | Rechteinhaber |

Der Herausgebername (`publisherName`) kommt erst dazu, wenn das
Signaturzertifikat da ist – siehe Punkt 2. Er muss **exakt** dem Namen im
Zertifikat entsprechen, sonst schlägt später die Update-Prüfung fehl.

Ebenso auszufüllen sind die Rechtstexte. Sie liegen zweisprachig vor und
enthalten alle `[…]`-Markierungen:

| Deutsch | Englisch |
|---|---|
| `LIZENZ.md` | `LICENSE.md` |
| `DATENSCHUTZ.md` | `PRIVACY.md` |
| `IMPRESSUM.md` | – (Pflicht nach § 5 DDG, gilt nur in Deutschland) |

Die englischen Fassungen beschreiben **denselben Vertrag nach deutschem Recht**,
sie sind Übersetzungen und keine eigenständigen Verträge nach US-Recht. Am Ende
von `LICENSE.md` steht eine Klausel, welche Sprachfassung im Zweifel gilt –
entscheide dich dort für eine und streiche die andere.

**Die deutschen Fassungen nicht löschen.** Wenn du dich an Kundinnen in
Deutschland richtest, müssen Lizenz und Datenschutzerklärung auf Deutsch
vorliegen; eine nur englische Fassung wird gegenüber Verbrauchern hier nicht
wirksam einbezogen. Umgekehrt brauchst du die englische für alle anderen Märkte.

**Lass die Texte anwaltlich prüfen** – sie sind Vorlagen, keine Rechtsberatung.

> **Zur Lizenz im Installer:** `build.nsis.license` zeigt derzeit auf
> `LIZENZ.md`. NSIS zeigt dort nur `.txt`, `.rtf` oder `.html` sauber an –
> Markdown erscheint als Rohtext. Vor der Veröffentlichung also eine
> `build/license_de.txt` und `build/license_en.txt` daraus erzeugen; NSIS wählt
> dann automatisch nach der Sprache des Installers.

### 2. Code-Signing-Zertifikat besorgen

Ohne Signatur zeigt Windows SmartScreen bei jedem Download eine Warnung
(„Der Computer wurde durch Windows geschützt"). Erfahrungsgemäß bricht ein
großer Teil der Interessenten dort ab. Das ist die größte verbleibende Hürde
zwischen dir und einem verkaufbaren Programm.

- **OV-Zertifikat** (Organisation Validated): günstiger, Reputation baut sich
  erst über Downloads auf – die Warnung verschwindet also nicht sofort.
- **EV-Zertifikat** (Extended Validation): teurer, gilt bei SmartScreen ab dem
  ersten Tag als vertrauenswürdig, liegt auf einem Hardware-Token.

Seit Juni 2023 verlangen alle Zertifizierungsstellen, dass der private Schlüssel
auf einem Hardware-Token oder in einem HSM liegt. Rein dateibasierte `.pfx`
gibt es nicht mehr; plane das für den Signaturvorgang ein.

Anbieter vergleichen (Preise ändern sich, deshalb hier bewusst keine Zahlen):
DigiCert, Sectigo, GlobalSign, SSL.com. Für Einzelpersonen ist die Prüfung
aufwendiger als für eingetragene Firmen – Bearbeitungszeit einplanen.

Ist das Zertifikat da, in `package.json` unter `build.win` ergänzen:

```json
"signtoolOptions": {
  "publisherName": "Name laut Zertifikat",
  "certificateSubjectName": "Name laut Zertifikat",
  "signingHashAlgorithms": ["sha256"]
}
```

und `verifyUpdateCodeSignature` auf `true` setzen.

> **Achtung, häufige Falle:** Seit electron-builder 25 liegen `publisherName`,
> `certificateFile` und die übrigen Signaturangaben **unter
> `win.signtoolOptions`**, nicht mehr direkt unter `win`. Stehen sie an der
> alten Stelle, bricht der Bau mit der wenig hilfreichen Meldung
> „configuration.win should be one of these: null" ab. `npm test` prüft das
> vorher und nennt den Schlüssel beim Namen.

### 3. Aktualisierung: nur noch die Bezugsquelle fehlt

**Fertig gebaut ist alles außer der Quelle:**

- Ausschalter in den Einstellungen (⚙️ → Aktualisierung). Standardmäßig an; wer
  ihn ausschaltet, hat eine App, die keinerlei Netzwerkverbindung aufbaut. Die
  Entscheidung liegt im lokalen Speicher, nicht in der Projektdatei – ein
  weitergegebenes Projekt überschreibt sie also nicht.
- Knopf „Jetzt prüfen" für die manuelle Suche.
- Statuszeile mit allen Fällen: sucht, aktuell, verfügbar, lädt (mit
  Fortschrittsbalken), heruntergeladen, fehlgeschlagen, nicht eingerichtet.
- Rückfrage vor dem Herunterladen und vor dem Neustart. Ungesicherte Änderungen
  werden vor dem Neustart gespeichert.
- `electron-updater` wird erst geladen, wenn es gebraucht wird. Fehlt das Paket,
  läuft die App normal weiter und schreibt eine Zeile ins Protokoll.

**Was du noch tun musst**, sobald du weißt, woher die Updates kommen sollen:

```bash
npm install electron-updater
```

und in `package.json` innerhalb von `"build"` ergänzen:

```json
"publish": [
  { "provider": "github", "owner": "DEIN-KONTO", "repo": "storyplaner" }
]
```

Eigener Webserver statt GitHub:

```json
"publish": [
  { "provider": "generic", "url": "https://deine-domain.de/updates/" }
]
```

Dort müssen dann die Installer **und** die von electron-builder erzeugte
`latest.yml` liegen. HTTPS ist Pflicht – über HTTP lädt electron-updater nicht.

Veröffentlicht wird mit `electron-builder --publish always`.

> **Datenschutz:** Sobald eine Quelle hinterlegt ist, fragt die App beim Start
> dort nach und überträgt dabei IP-Adresse, Version und Betriebssystem. Der
> passende Abschnitt steht bereits in `DATENSCHUTZ.md` – dann Adresse und
> Speicherdauer eintragen. Richtest du keine Updates ein, streiche den Abschnitt.

> **Signatur:** Wenn du später signierst, `verifyUpdateCodeSignature` in
> `package.json` auf `true` setzen und sicherstellen, dass `publisherName` exakt
> dem Zertifikat entspricht. Sonst lehnt die Update-Prüfung das heruntergeladene
> Paket ab.

## Name und Symbol auf jedem Rechner gleich

Beides ist fest im Installer verankert – es kommt nicht vom Rechner der
Nutzerin. Damit es überall identisch aussieht, müssen zwei Dinge stimmen.

### Der Name steht an genau einer Stelle

`build.productName` in `package.json`. Alles andere zieht sich den Wert von
dort:

| Wo der Name auftaucht | Woher er kommt |
|---|---|
| Installationsordner, Startmenü, Systemsteuerung | `build.productName` |
| Verknüpfung auf dem Desktop | `build.nsis.shortcutName` |
| Dateiname der EXE | `build.executableName` |
| Taskleiste, Alt+Tab, Fenstertitel | `src/main/produkt.js` |

Die Laufzeitwerte stehen **nicht** in `package.json`, obwohl das naheliegend
wäre: electron-builder entfernt den `build`-Block beim Packen. Ein `main.js`,
das `paket.build.productName` liest, läuft im Entwicklungsbetrieb einwandfrei
und stürzt im fertigen Programm beim Start ab – genau daran ist die erste
Fassung von 1.1.0 gescheitert. Deshalb `src/main/produkt.js`; `npm test`
vergleicht beide Stellen und schlägt an, wenn nur eine geändert wurde.

Ebenfalls vorher kaputt: die Seite setzt einen eigenen `<title>`, und der hat
den Fensternamen überschrieben. In der Taskleiste stand deshalb die lange
Seitenüberschrift. Jetzt weist `main.js` das ab.

Ebenfalls neu: `app.setAppUserModelId(appId)`. Windows gruppiert und heftet
Fenster über diese Kennung an die Taskleiste. Fehlt sie, kann ein angeheftetes
Symbol nach einem Update auf etwas anderes zeigen als die Verknüpfung im
Startmenü – ein häufiger Grund dafür, dass „dasselbe" Programm auf zwei
Rechnern verschieden aussieht.

**Wenn du den Namen änderst:** `build.productName`, `build.nsis.shortcutName`,
`build.executableName` und `NAME` in `src/main/produkt.js` gemeinsam anpassen,
dann `npm test` – die Testreihe schlägt an, wenn eines davon abweicht.
`DATEN_ORDNER` in `produkt.js` bleibt dabei stehen, damit bei einer Umbenennung
nicht die zuletzt geöffneten Projekte und die Einstellungen verschwinden. Die
`appId` **nie** ändern, sobald einmal veröffentlicht wurde.

### Dein eigenes Symbol einsetzen

1. Bild als **`build/logo.png`** ablegen: quadratisch, mindestens 512 × 512,
   ohne Interlace, 8 Bit je Kanal. Durchsichtiger Hintergrund ist erlaubt.
2. `npm run icon`
3. `npm run dist`

Der Erzeuger schreibt `build/icon.ico` mit allen zehn Größen, die Windows
anfragt: 16, 20, 24, 32, 40, 48, 64, 96, 128 und 256. **Das ist der eigentliche
Punkt.** Fehlt eine Größe, rechnet Windows sie sich selbst zurecht – abhängig
von Bildschirmauflösung, Skalierung und Ansicht. Genau daher kommt es, dass ein
Symbol auf dem einen Rechner scharf und auf dem anderen matschig wirkt. Sind
alle Größen enthalten, nimmt Windows immer die passende und rechnet nie selbst.

Verkleinert wird mit Flächenmittel und vormultipliziertem Alpha, damit feine
Linien in 16 × 16 nicht verschwinden und durchsichtige Ränder keine Farbränder
bekommen. Ohne Quellbild zeichnet das Skript ein schlichtes Ersatzmotiv.

**Zum inneren Aufbau:** Größen bis 128 liegen als klassisches Windows-Bitmap in
der Datei, nur die 256er als PNG. Das ist kein Detail – `rcedit`, das Werkzeug,
mit dem electron-builder das Symbol in die EXE schreibt, liest PNG-Einträge
nicht zuverlässig. Sind alle Größen als PNG abgelegt, läuft der Bau ohne
Fehlermeldung durch, und die EXE trägt trotzdem weiter das Electron-Symbol.
`npm test` prüft die Ablageart jeder einzelnen Größe.

Dasselbe `icon.ico` verwenden EXE, Verknüpfung, Installer, Deinstallation und
die `.story`-Dateien – eingetragen in `package.json`, alle auf denselben Pfad.

### Beim Testen: Windows merkt sich alte Symbole

Nach dem Austausch kann die alte Grafik hängen bleiben. Das ist der
Symbolzwischenspeicher von Windows, kein Fehler im Programm:

```
ie4uinit.exe -show
```

Falls das nicht reicht, ab- und wieder anmelden. Auf einem frischen Rechner
tritt das nicht auf.

## Bauen

```bash
npm install          # einmalig
npm run icon         # Symbol aus build/logo.png erzeugen (nur nötig, wenn geändert)
npm test             # Testreihe, läuft auch automatisch vor dist
npm run dist         # Installer und portable Fassung in dist/
```

`npm run dist` bricht ab, wenn ein Test fehlschlägt. Das ist Absicht.

## Was bereits erledigt ist

- **Speicherung in echten Dateien.** Projekte sind `.story`-Dateien (gzip-JSON).
  Geschrieben wird immer erst in eine Nebendatei, dann umbenannt – ein Absturz
  mitten im Speichern kann die alte Fassung nicht mehr zerstören. Vor jedem
  Schreiben wandert der Vorgängerstand in den Ordner `<Projektname>.sicherungen`,
  zwölf Stände bleiben liegen. Der frühere 4,8-MB-Deckel ist damit weg.
- **Bibliothek statt verborgenem App-Speicher.** „In der App gespeichert"
  heißt: in einem Ordner, den die App kennt – voreingestellt
  `Dokumente\Ploow`, in den Einstellungen änderbar. Die Dateien liegen
  sichtbar im Explorer, lassen sich mitnehmen, sichern und weitergeben. Ein
  neues Projekt wandert beim ersten Strg+S ohne Dialog dorthin; „Speichern
  unter" fragt weiterhin nach dem Ort.

  Die Seite **„Meine Geschichten"** zeigt alle Projekte als Karten mit Titel,
  Genre, Wortzahl, Fortschritt, Größe und Änderungszeit. Projekte, die
  woanders liegen, erscheinen mit – als „außerhalb" gekennzeichnet. Von dort
  aus: öffnen, umbenennen, im Ordner zeigen, entfernen. Öffnen geht weiterhin
  auch über den Dateidialog oder per Doppelklick auf eine `.story`-Datei.

  **Entfernen löscht nicht.** Die Datei wandert in den Unterordner
  `Papierkorb`. Ein Manuskript endgültig zu vernichten ist nichts, was ein
  Klick tun sollte.

  Damit die Übersicht nicht bei jedem Aufruf jedes Projekt entpacken muss,
  liegt im Benutzerordner ein Verzeichnis mit den Eckdaten. Es wird nur dort
  erneuert, wo Größe oder Zeitstempel sich geändert haben, und ist reiner
  Zwischenspeicher – geht es verloren, baut es sich neu auf.
- **Mehrere Projekte**, Öffnen/Speichern/Speichern unter, zuletzt geöffnete
  Projekte, Doppelklick auf `.story` im Explorer, Nachfrage bei ungesicherten
  Änderungen. Wer noch nie gespeichert hat, verliert trotzdem nichts: der Stand
  liegt als Entwurf im Benutzerdatenordner und wird beim nächsten Start
  angeboten.
- **Umzug der Altdaten.** Beim ersten Start übernimmt die App ein Projekt, das
  noch im Browserspeicher der Vorgängerfassung liegt, und weist auf das
  Speichern als Datei hin.
- **Sicherheit.** Content-Security-Policy ohne Netzwerkzugriff, gefilterte
  Bildquellen und Farben, eingelesene Sicherungen werden Feld für Feld neu
  aufgebaut statt übernommen, blockierte Navigation und Fensteröffnung,
  verweigerte Geräteberechtigungen, Sandbox im Anzeigeprozess.
- **Schemaversion** in jeder Datei samt Migrationskette; Dateien aus neueren
  Programmfassungen werden abgelehnt statt halb gelesen.
- **Rückgängig und Wiederherstellen** über Strg+Z und Strg+Y, 60 Schritte tief.
- **Eigene Dialoge** statt der zwölf Systemdialoge.
- **Suche** mit zwischengespeichertem Index und verzögerter Eingabe; die
  Scrollposition bleibt stehen.
- **Wortzahlen aus dem Manuskript** (.docx, .odt, .rtf, .txt, .md) – die
  Fortschrittsanzeige beruht damit auf dem echten Text statt auf Handeingaben.
- **Zusammenarbeit mit einer KI über Dateien.** „Für eine KI ausgeben" schreibt
  den Projektstand samt Feldbeschreibung als Markdown; die Antwort liest man mit
  „JSON-Datei einlesen" wieder ein. Bewusst über Dateien statt über eine
  Netzverbindung: die App verschickt weiterhin nichts von sich aus, und du
  entscheidest bei jedem Schritt, was das Gerät verlässt. Die
  Datenschutzerklärung bleibt dadurch gültig, wie sie ist. Ein Test hält den
  Rundweg dicht – jeder Schlüssel, unter dem die App etwas ausgibt, muss beim
  Wiedereinlesen dieselbe Art ergeben.
- **Dateien an jeden Eintrag anhängen** – Kapitel, Folgen, Figuren, Orte, Welt,
  Plot-Punkte, Ereignisse, Ideen. Word-Dokumente, PDF, Tabellen und Bilder
  bekommen ein eigenes Symbol; ein Klick öffnet sie im zugehörigen Programm,
  ein .docx also in Word. Bei Kapiteln und Folgen steht daneben „Wortzahl":
  damit wandert die Wortzahl aus dem angehängten Manuskript in den Eintrag.
  Anhänge liegen mit in der Projektdatei und wandern beim Weitergeben mit.
  Zum Öffnen wird eine Kopie in den Benutzerordner geschrieben, der beim
  nächsten Start geleert wird. Ausführbare Dateien (.exe, .bat, .ps1 und
  Verwandte) werden dabei bewusst **nicht** an das System weitergereicht.
- **Freies JSON einlesen** für Dateien, die nicht aus Ploow stammen. Die
  App durchsucht die Datei nach Listen von Objekten – auch verschachtelt –,
  schlägt je Liste eine Eintragsart und eine Feldzuordnung vor und zeigt beides
  mit Beispielwerten zur Prüfung. Erst danach wird angelegt. Auswahlfelder
  bekommen dabei Schlüssel statt Anzeigetexte („Protagonistin" → `protagonist`),
  sonst stünde auf den Karten ein Fragezeichen. Fremde Dateien laufen durch
  dieselbe Säuberung wie jeder andere Import.
- **Fehlerprotokoll** in `protokoll.txt` im Benutzerdatenordner, lokal, ohne
  Versand.
- **Aktualisierung** mit Ausschalter, manueller Prüfung, Fortschrittsanzeige und
  Rückfragen – es fehlt nur die Bezugsquelle (siehe Punkt 3).
- **Einstellungen ohne falsche Angaben.** Der frühere 5-MB-Balken erschien auch
  dann, wenn er längst nicht mehr galt. Er taucht jetzt nur noch auf, wenn die
  App im Browser läuft; in der Anwendung stehen dort Speicherort, Umfang und
  Sicherungsordner.
- **Eine Palette für beide Oberflächen.** Der Profi-Modus hatte eigene, wärmere
  Farben und eine zweite Palette für Hell. Beides ist weg: seine
  `--p-*`-Variablen sind jetzt reine Rollennamen und zeigen auf dieselben Farben
  wie der einfache Modus. Wer die Palette nachbessert, ändert sie damit an einer
  einzigen Stelle für beide Oberflächen und beide Themen.
- **Name und Symbol** überall aus einer Quelle: Produktname zur Laufzeit aus
  `package.json`, Windows-Kennung gesetzt, Seitentitel überschreibt den
  Fensternamen nicht mehr, Symbol in allen zehn von Windows angefragten Größen.
  Ein eigenes Bild kommt über `build/logo.png` plus `npm run icon` hinein.
- **Testreihe** ohne Fremdbibliotheken: `npm test`. Der erste Durchgang prüft
  die Build-Konfiguration gegen das Schema von electron-builder – Fehler dort
  fallen in einer Sekunde auf statt erst nach dem Packen.

## Was bewusst offen bleibt

- **Kein Manuskript-Editor.** Ploow plant, geschrieben wird woanders. Der
  Wortzahl-Import schließt die Lücke halb. Ob ein eigener Editor dazukommt, ist
  eine Produktentscheidung, keine technische.
- **Keine Cloud, keine Synchronisierung.** Absicht – das ist Teil des
  Versprechens und der Grund, warum die Datenschutzerklärung so kurz ist.
- **Die Übersetzung ist nicht vollständig.** Übersetzt sind Navigation,
  Kopfzeile, Übersicht, Titelleiste, Projektmenü, das **gesamte
  Einstellungsfenster**, Anhänge, Zeitangaben und die Dialogknöpfe – also
  alles, was ständig auf dem Bildschirm steht. **Noch deutsch** sind die
  Formularfelder samt Beschriftungen, die Auswahllisten (Rollen, Ortsarten,
  Kategorien), die Meldungstexte und die langen Erklärungen in den
  Import-Dialogen. Wer eine andere Sprache wählt, bekommt also eine gemischte
  Oberfläche.

  **Standardsprache ist Englisch.** Wer nichts einstellt, sieht die englische
  Oberfläche – für ein international angebotenes Programm die sinnvollere
  Vorgabe. Die Sprachnamen in der Auswahl kommen aus `Intl.DisplayNames`, sie
  stehen also immer in der laufenden Oberflächensprache und müssen nicht
  gepflegt werden.

  Der Rest steckt in rund 230 weiteren Zeichenketten. Der Weg dahin ist
  vorgezeichnet: Schlüssel in `src/sprachen.js` ergänzen, im Code `tx("…")`
  einsetzen, `npm run sprachen`, `npm test`. Die Testreihe meldet jede Sprache,
  in der ein Schlüssel fehlt.

  **Die Übersetzungen sind ungeprüft.** Vor dem Verkauf in einem Sprachraum
  sollte jemand drübersehen, der die Sprache spricht – besonders bei Arabisch,
  Urdu, Bengalisch und Hindi.
- **Rahmenloses Fenster.** Kostet unter Windows das Aero-Snap-Menü beim
  Überfahren des Maximieren-Knopfes. Wer das zurückwill: in `main.js`
  `frame: false` entfernen und stattdessen `titleBarStyle: 'hidden'` mit
  `titleBarOverlay` setzen.

# Ploow – Produktseite

Eine einzelne HTML-Datei, ohne Bibliotheken und ohne Build-Schritt – wie die
Anwendung selbst. Sieben Sprachen (Deutsch, Englisch, Chinesisch, Hindi,
Spanisch, Französisch, Arabisch), hell und dunkel, Arabisch von rechts nach
links.

---

## 1. Was Sie noch eintragen müssen

Ganz oben im `<script>`-Block von `index.html` steht ein Kasten `KONFIG`.
**Das ist die einzige Stelle, die Sie anfassen müssen.**

```js
const KONFIG = {
  benutzer: "BITTE-EINTRAGEN",   // ← Ihr GitHub-Benutzername
  repo:     "ploow",             // ← Name des Repositorys
  storeAdresse: "",              // ← leer lassen, bis Ploow im Store steht
  version:      "1.13.1",
  dateiWindows: "Ploow-1.13.1-x64.exe",
  ...
};
```

Aus `benutzer` und `repo` entstehen alle Links von allein:

| Knopf | Ziel |
|---|---|
| Windows | `…/releases/latest/download/Ploow-1.13.1-x64.exe` |
| Ohne Installation | `…/releases/latest/download/Ploow-1.13.1-portabel.exe` |
| macOS | `…/releases/latest/download/Ploow-1.13.1.dmg` |
| Linux | `…/releases/latest/download/Ploow-1.13.1.AppImage` |
| Alle Fassungen | `…/releases` |

`releases/latest/download/` zeigt **immer** auf die neueste Veröffentlichung.
Die Seite bleibt also richtig, ohne dass jemand sie anfasst – nur die
Dateinamen in `KONFIG` müssen bei einer neuen Version mitwandern, weil die
Versionsnummer im Namen steckt.

> **Hinweis zu macOS und Linux:** `npm run dist` baut auf einem Windows-Rechner
> nur die Windows-Fassungen. Solange es keine `.dmg` und keine `.AppImage` im
> Release gibt, führen diese beiden Knöpfe ins Leere. Entweder Sie bauen auf
> den jeweiligen Systemen (oder über GitHub Actions), oder Sie nehmen die
> beiden Knöpfe vorerst aus `index.html` heraus.

---

## 2. Bildschirmfotos

Die sechs Bilder **liegen in `docs/bilder/`** und sind eingebunden. Fehlt eines,
erscheint an seiner Stelle ein beschrifteter Platzhalter mit dem Dateinamen –
die Seite bleibt also benutzbar.

> **Drei davon sollten neu aufgenommen werden.** Sie sind vor den Korrekturen
> vom 8. August entstanden und zeigen genau die Fehler, die inzwischen behoben
> sind:
>
> * `kapitel.png` – jedes Kapitel steht doppelt darin (der alte
>   Verdopplungsfehler beim Beispielprojekt).
> * `figuren.png` – oben rechts steht „0 connections", und die Karten haben
>   keine Bilder. Nach der Korrektur hat das Beispiel sechs Beziehungen.
> * `welt-karten.png` – die Karte zeigt das Ploow-Logo und hat null
>   Markierungen. Das Beispielprojekt bringt jetzt „Das Aschereich" mit drei
>   Markierungen mit.
>
> Vorgehen: Beispielprojekt frisch laden, die drei Ansichten erneut
> aufnehmen, Dateien im Ordner `docs/bilder/` ersetzen. `node pruefen.js` prüft
> danach Format, Breite und Dateigröße.

| Datei | Was darauf zu sehen sein sollte |
|---|---|
| `bilder/kapitel.png` | Die Kapitelliste mit Status, Fortschrittsbalken und Wortzahlen. Am besten mit einigen gefüllten Kapiteln, nicht leer. |
| `bilder/figuren.png` | Die Beziehungsansicht – gern das **Netz** oder den **Stammbaum**, das ist ungewöhnlicher als Karteikarten. |
| `bilder/welt-karten.png` | Eine **Karte mit Markierungen**, idealerweise mit geöffnetem Vorschaustreifen rechts. |
| `bilder/handlung.png` | Das **Handlungs-Board** mit mehreren Akten und farbigen Handlungssträngen. |
| `bilder/mindmap.png` | Die **Mindmap** mit Kacheln, freiem Text und einem Notizzettel. |
| `bilder/import-export.png` | Die **Einlese-Vorschau** mit Feldzuordnung – oder der Ordner-Export im Explorer. |

**Empfehlung zur Aufnahme**

* Seitenverhältnis 16 : 10, mindestens 1600 × 1000 Punkte.
* Im **dunklen** Thema aufnehmen, wenn möglich – es passt zu beiden Fassungen
  der Seite besser als helle Bilder auf dunklem Grund.
* Demodaten laden (`Datei → Demodaten laden`), damit nichts leer wirkt.
* Fenster auf etwa 1440 Punkte Breite ziehen, dann wirkt nichts gequetscht.
* Als PNG speichern.

---

## 3. Ankündigungen pflegen

Im `<script>`-Block steht unter `KONFIG` die Liste `MELDUNGEN`. Eine neue
Meldung kommt **oben** hinein:

```js
{
  datum: "2026-09-01",
  de: {t:"Überschrift",       x:"Ein bis zwei Sätze."},
  en: {t:"Headline",          x:"One or two sentences."}
  // zh, hi, es, fr, ar können fehlen – dann greift Englisch
}
```

Fehlt eine Sprache, fällt die Meldung auf Englisch zurück, dann auf Deutsch.
Sie müssen also nicht sofort siebenfach übersetzen. Das Datum wird in der
jeweiligen Sprache ausgeschrieben.

---

## 4. Auf GitHub Pages veröffentlichen

**Variante A – einfachster Weg (Ordner `docs/`)**

1. Der Ordner heißt bereits `docs/` – GitHub Pages liest nur von dort oder aus dem Wurzelverzeichnis.
2. Auf github.com → *Settings* → *Pages*
3. *Source*: `Deploy from a branch`, Branch `main`, Ordner `/docs`
4. Nach etwa einer Minute liegt die Seite unter
   `https://BENUTZER.github.io/ploow/`

**Variante B – eigenes Repository**

Ein Repository `BENUTZER.github.io` anlegen, den Inhalt dieses Ordners
hineinlegen. Die Seite liegt dann direkt unter `https://BENUTZER.github.io/`.

**Eigene Domain**

Eine Datei `CNAME` mit der Domain als einzigem Inhalt daneben legen, und beim
Anbieter der Domain einen CNAME-Eintrag auf `BENUTZER.github.io` setzen.

---

## 5. Was bewusst nicht drin ist

* **Keine Zählpixel, keine Cookies, kein Zugriff auf fremde Server.** Die Seite
  lädt nur die eigenen Dateien. Damit braucht sie auch kein Cookie-Banner.
* **Keine Schriften von Google.** Die Seite nimmt, was auf dem Gerät liegt.
  Das lädt schneller und schickt keine Adressdaten an Dritte – bei einer
  Anwendung, die mit „ohne Internet" wirbt, wäre alles andere unglaubwürdig.
* **Keine Bibliothek.** Das ganze Verhalten sind etwa 120 Zeilen JavaScript.

---

## 6. Noch zu erledigen

- [ ] `KONFIG.benutzer` eintragen
- [x] Sechs Bildschirmfotos nach `docs/bilder/` legen
- [ ] Drei davon nach den Korrekturen neu aufnehmen (siehe Abschnitt 2)
- [ ] Ein Release auf GitHub anlegen und die `.exe` anhängen
- [ ] `LICENSE.md` und `PRIVACY.md` im Repository-Wurzelverzeichnis haben
      (die Fußzeile verlinkt darauf)
- [ ] Impressumspflicht prüfen – in Deutschland gilt sie auch für
      Ein-Personen-Projekte, sobald etwas angeboten wird. Die Datei
      `IMPRESSUM.md` liegt bereits im Projekt, ist aber noch nicht ausgefüllt.

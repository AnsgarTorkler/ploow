# Datenschutzerklärung für Ploow

> **Vorlage.** Die mit `[…]` markierten Stellen ausfüllen. Der Text beschreibt die
> Software so, wie sie gebaut ist – wenn du später Funktionen ergänzt, die ins
> Netz gehen (Telemetrie, Konten, Cloud-Sicherung, Absturzberichte), muss diese
> Erklärung mitwachsen. Keine Rechtsberatung.

**Verantwortlicher im Sinne der DSGVO:**
[Vor- und Nachname bzw. Firma], [Straße Hausnummer], [PLZ Ort]
E-Mail: [adresse@example.de], Telefon: [Nummer]
**Stand:** [Datum]

## 1. Kurzfassung

Ploow ist ein Programm, das auf deinem Gerät läuft. Deine Texte, Figuren und
Notizen verlassen dein Gerät nicht. Es gibt kein Konto, keine Cloud, keine
Zählpixel und keine Nutzungsstatistik.

Eine einzige Ausnahme: Beim Start fragt Ploow bei GitHub nach, ob eine neuere
Fassung vorliegt. Dabei werden keine Inhalte übertragen. Diese Prüfung lässt
sich in den Einstellungen abschalten – dann findet überhaupt keine
Netzwerkkommunikation mehr statt. Näheres in Abschnitt 3.

## 2. Was auf deinem Gerät gespeichert wird

Die Software legt folgende Daten lokal ab:

- **Projektdateien** (`.story`) an dem Ort, den du beim Speichern wählst. Sie
  enthalten deine Buchdaten, Figuren, Notizen, Bilder und angehängten Dateien.
- **Sicherungskopien** der jeweils letzten zwölf Speicherstände in einem Ordner
  neben der Projektdatei.
- **Programmeinstellungen und zuletzt geöffnete Projekte** im
  Benutzerdatenordner der Anwendung.
- **Ein Fehlerprotokoll** (`protokoll.txt`) im selben Ordner. Es enthält
  Zeitpunkte und technische Fehlermeldungen, keine Inhalte deiner Projekte. Du
  kannst es jederzeit über „Über Ploow → Protokoll zeigen" einsehen und
  löschen.

Diese Daten verlassen dein Gerät nur, wenn du selbst eine Datei weitergibst.

## 3. Aktualisierungen

Beim Start ruft Ploow eine Datei auf den Servern von GitHub ab, um die dort
hinterlegte Versionsnummer mit der eigenen zu vergleichen. Die Adresse lautet

    https://github.com/AnsgarTorkler/ploow/releases/

**Was dabei übertragen wird:** technisch bedingt deine IP-Adresse sowie die
Angaben, die jeder HTTP-Abruf mitschickt – Programmversion, Betriebssystem und
Prozessorarchitektur als Teil der Programmkennung. **Nicht übertragen werden**
Inhalte aus deinen Projekten, Dateinamen, Dateipfade oder eine Kennung, die dich
oder dein Gerät wiedererkennbar machen würde.

**Empfänger:** GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA
94107, USA. Die Übermittlung in die USA stützt sich auf das
EU-US Data Privacy Framework, dem GitHub beigetreten ist. Die
Datenschutzerklärung von GitHub findest du unter
https://docs.github.com/site-policy/privacy-policies.

**Rechtsgrundlage:** berechtigtes Interesse an der Sicherheit und Funktions-
fähigkeit der Software (Art. 6 Abs. 1 lit. f DSGVO).

**Speicherdauer:** Wir selbst speichern nichts – die Anfrage erreicht uns nicht,
sondern nur GitHub. Wie lange GitHub Server-Protokolle vorhält, bestimmt GitHub.

**Widerspruch:** Die Prüfung lässt sich unter *Einstellungen → Aktualisierung*
abschalten. Danach baut Ploow keinerlei Netzwerkverbindung mehr auf. Eine
gefundene Aktualisierung wird außerdem nie von allein geladen oder installiert –
beides geschieht nur auf deinen Klick.

## 4. Kauf und Support

Beim Kauf über [Zahlungsanbieter / Shop] werden die dort angegebenen Daten
verarbeitet; es gilt zusätzlich die Datenschutzerklärung von [Anbieter].
Schreibst du uns eine Support-Anfrage, verarbeiten wir deine E-Mail-Adresse und
den Inhalt der Anfrage, um sie zu beantworten (Art. 6 Abs. 1 lit. b bzw. f DSGVO).
Wir löschen Support-Nachrichten nach [Zeitraum].

## 5. Deine Rechte

Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung
(Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit
(Art. 20) und Widerspruch (Art. 21 DSGVO). Wende dich dafür an die oben genannte
Adresse. Außerdem steht dir ein Beschwerderecht bei einer Aufsichtsbehörde zu,
etwa bei [zuständige Landesdatenschutzbehörde].

Da wir durch die Nutzung der Software selbst keine personenbezogenen Daten
erhalten, können wir zu deinen Projektinhalten weder Auskunft geben noch sie
löschen – diese Daten liegen ausschließlich bei dir.

## 6. Datensicherheit

Die Software führt ihre Anzeigeoberfläche ohne Systemrechte aus, verweigert alle
Geräteberechtigungen (Kamera, Mikrofon, Standort, Benachrichtigungen) und
unterbindet das Nachladen von Inhalten aus dem Netz. Eingelesene Fremddateien
werden vor der Anzeige gefiltert.

Für den Schutz der Projektdateien auf deinem Gerät – etwa durch
Festplattenverschlüsselung und regelmäßige Sicherungen – bist du selbst
verantwortlich.

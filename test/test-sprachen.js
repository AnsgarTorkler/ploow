'use strict';
/* ============================================================
   SPRACHEN
   Geprüft wird dreierlei: dass keine Sprache Lücken hat, dass
   die eingebettete Fassung noch der Quelle entspricht, und dass
   die Oberfläche in jeder Sprache fehlerfrei zeichnet.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { ok, gleich, gruppe, bilanz } = require('./hilfen');
const { baueUmgebung, standardPfad } = require('./dom-ersatz');
const S = require('../src/sprachen');
const Einbetten = require('../build/sprachen-einbetten');

gruppe('Auswahl der Sprachen');
{
  gleich(S.REIHENFOLGE.length, 11, 'Deutsch plus die zehn meistgesprochenen Sprachen');
  gleich(S.REIHENFOLGE[0], 'de', 'Deutsch steht in der Liste vorn');
  /* Reihenfolge nach Sprecherzahl (Ethnologue 2026) */
  gleich(S.REIHENFOLGE, ['de','en','zh','hi','es','ar','fr','bn','pt','id','ur'],
         'Danach nach Sprecherzahl geordnet');

  S.REIHENFOLGE.forEach(code => {
    const s = S.SPRACHEN[code];
    ok(!!s, code + ' ist beschrieben');
    ok(!!s.eigen, code + ' nennt sich selbst: ' + s.eigen);
    ok(!!s.deutsch, code + ' hat einen deutschen Namen: ' + s.deutsch);
    ok(typeof s.rtl === 'boolean', code + ' gibt die Schreibrichtung an');
  });
  gleich(S.REIHENFOLGE.filter(c => S.SPRACHEN[c].rtl), ['ar', 'ur'],
         'Von rechts nach links laufen Arabisch und Urdu');
  gleich(Object.keys(S.SPRACHEN).sort(), [...S.REIHENFOLGE].sort(),
         'Keine Sprache ist beschrieben, aber nicht gelistet – und umgekehrt');
}

gruppe('Keine Lücken in den Übersetzungen');
{
  const schluessel = Object.keys(S.TEXTE);
  ok(schluessel.length > 60, `${schluessel.length} Textschlüssel`);

  const luecken = [];
  schluessel.forEach(k => {
    S.REIHENFOLGE.forEach(code => {
      const wert = S.TEXTE[k][code];
      if (!wert || !String(wert).trim()) luecken.push(`${k} → ${code}`);
    });
  });
  gleich(luecken.slice(0, 10), [], 'Jeder Schlüssel ist in allen elf Sprachen gefüllt');

  // Platzhalter müssen in jeder Sprache gleich vorkommen, sonst fehlt eine Zahl
  const platzhalterFehler = [];
  schluessel.forEach(k => {
    const soll = (String(S.TEXTE[k].de).match(/\{\d+\}/g) || []).sort().join(',');
    S.REIHENFOLGE.forEach(code => {
      const ist = (String(S.TEXTE[k][code]).match(/\{\d+\}/g) || []).sort().join(',');
      if (ist !== soll) platzhalterFehler.push(`${k} → ${code} (${ist || 'keine'} statt ${soll || 'keine'})`);
    });
  });
  gleich(platzhalterFehler.slice(0, 10), [], 'Platzhalter wie {0} stehen in jeder Sprache');

  // Kürzel der Eintragsarten
  Object.keys(S.ARTKUERZEL).forEach(art => {
    const fehlend = S.REIHENFOLGE.filter(c => !S.ARTKUERZEL[art][c]);
    gleich(fehlend, [], `Kürzel für ${art} in allen Sprachen`);
  });
}

gruppe('Eingebettete Fassung ist aktuell');
{
  ok(Einbetten.istAktuell(),
     'Die Sprachdatei in index.html entspricht src/sprachen.js – sonst "npm run sprachen" ausführen');

  const html = fs.readFileSync(standardPfad, 'utf8');
  ok(html.includes(Einbetten.ANFANG) && html.includes(Einbetten.ENDE), 'Beide Marken stehen im HTML');
  ok(!/<script src=/.test(html),
     'Die Oberfläche lädt kein externes Skript – das würde an der Inhaltssicherheitsrichtlinie scheitern');
}

gruppe('Die Oberfläche spricht alle Sprachen');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('loadDemo();');
  gleich(U.json('Object.keys(TEXTE).length'), Object.keys(S.TEXTE).length,
         'Die Oberfläche sieht dieselben Texte wie die Testreihe');

  S.REIHENFOLGE.forEach(code => {
    let fehler = null;
    try { U.lauf(`setSprache(${JSON.stringify(code)}, true); view="dash"; renderSimple();`); }
    catch (e) { fehler = e.message; }
    ok(!fehler, `${code}: die Übersicht zeichnet` + (fehler ? ' – ' + fehler : ''));

    const nav = U.store.sideNav.innerHTML;
    const namen = [...nav.matchAll(/class="lbl">([^<]+)</g)].map(m => m[1]);
    ok(namen.length >= 13, `${code}: alle Navigationspunkte sind beschriftet`);
    ok(!namen.some(n => /^nav\./.test(n)), `${code}: kein roher Schlüssel steht auf dem Bildschirm`);
  });

  // Alle Ansichten in einer nicht-lateinischen und einer rechtsläufigen Sprache
  ['zh', 'ar'].forEach(code => {
    U.lauf(`setSprache(${JSON.stringify(code)}, true);`);
    ['dash','kapitel','figur','akte','beat','rel','notiz','stats'].forEach(v => {
      let f = null;
      try { U.lauf(`view=${JSON.stringify(v)}; renderSimple();`); } catch (e) { f = e.message; }
      ok(!f, `${code}/${v} zeichnet` + (f ? ' – ' + f : ''));
    });
  });
}

gruppe('Englisch ist die Standardsprache');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  gleich(U.json('sprache'), 'en', 'Ohne gespeicherte Wahl startet die App auf Englisch');
  gleich(U.json('EINST_STANDARD.sprache'), 'en', 'So steht es auch in den Vorgaben');
  gleich(U.sandbox.document.documentElement.lang, 'en', 'Und im lang-Attribut');

  const html = fs.readFileSync(standardPfad, 'utf8');
  ok(/<html lang="en"/.test(html), 'Schon im Markup steht en, bevor das Skript läuft');

  // Eine gespeicherte Wahl geht vor
  U.localStorage.setItem('storyplaner.einstellungen', JSON.stringify({ sprache: 'fr' }));
  U.lauf('einstellungenLaden();');
  gleich(U.json('sprache'), 'fr', 'Eine getroffene Wahl schlägt die Vorgabe');
}

gruppe('Rückfall, wenn etwas fehlt');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("es", true);');
  gleich(U.json('tx("nav.kapitel")'), S.TEXTE['nav.kapitel'].es, 'Vorhandener Text kommt aus der gewählten Sprache');

  // Fehlt der Eintrag, greift Englisch, dann Deutsch – nie eine leere Stelle
  U.lauf('TEXTE["test.nurDeutsch"] = {de:"Nur deutsch"};');
  gleich(U.json('tx("test.nurDeutsch")'), 'Nur deutsch', 'Fehlt die Sprache, greift Deutsch');
  U.lauf('TEXTE["test.mitEnglisch"] = {de:"Deutsch", en:"English"};');
  gleich(U.json('tx("test.mitEnglisch")'), 'English', 'Englisch geht dabei vor');
  gleich(U.json('tx("gibt.esNicht")'), 'gibt.esNicht',
         'Ein unbekannter Schlüssel bleibt sichtbar, statt still zu verschwinden');

  gleich(U.json('tx("zeit.vorMin", 12)'), S.TEXTE['zeit.vorMin'].es.replace('{0}', '12'), 'Platzhalter werden gefüllt');
}

gruppe('Schreibrichtung');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  [['de', 'ltr'], ['en', 'ltr'], ['ar', 'rtl'], ['ur', 'rtl'], ['zh', 'ltr']].forEach(([code, richtung]) => {
    U.lauf(`setSprache(${JSON.stringify(code)}, true);`);
    gleich(U.sandbox.document.documentElement.dir, richtung, `${code} läuft ${richtung}`);
    gleich(U.sandbox.document.documentElement.lang, code, `${code} steht im lang-Attribut`);
    gleich(U.sandbox.document.body.classList.contains('rtl'), richtung === 'rtl', `${code}: Klasse rtl passt`);
  });

  // Die Regeln für rechtsläufige Schrift müssen vorhanden sein
  const css = fs.readFileSync(standardPfad, 'utf8').match(/<style>([\s\S]*)<\/style>/)[1];
  ['body.rtl .tlWrap', 'body.rtl .kCard', 'body.rtl .sideSearch'].forEach(sel =>
    ok(css.includes(sel), `Es gibt eine Regel für ${sel}`));
}

gruppe('Die Sprache gehört zum Rechner, nicht zum Buch');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("fr");');
  gleich(U.json('einstellungen.sprache'), 'fr', 'Die Wahl steht in den Programmeinstellungen');
  ok(!('sprache' in U.json('state')), 'Und nicht im Projekt – ein weitergegebenes Buch stellt nichts um');

  // Übersteht einen Neustart
  U.lauf('sprache="de"; einstellungenLaden();');
  gleich(U.json('sprache'), 'fr', 'Nach dem nächsten Start ist sie wieder da');

  // Unbekannte Sprache fällt auf Deutsch zurück
  U.lauf('setSprache("klingonisch", true);');
  gleich(U.json('sprache'), 'en', 'Eine unbekannte Sprache landet bei Englisch');
}

gruppe('Auswahl in den Einstellungen');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('loadDemo(); setSprache("de", true); renderOpts();');
  const html = U.store.optsSprache.innerHTML;
  S.REIHENFOLGE.forEach(code => {
    ok(html.includes(`setSprache('${code}')`), `${code} steht zur Auswahl`);
    ok(html.includes(S.SPRACHEN[code].eigen), `${code} wird in eigener Schrift genannt: ${S.SPRACHEN[code].eigen}`);
  });
  ok(/class="sprachKnopf aktiv"/.test(html), 'Die laufende Sprache ist hervorgehoben');
  ok(html.includes('dir="rtl"'), 'Rechtsläufige Sprachen werden auch in der Auswahl richtig gesetzt');

  /* Die zweite Zeile nennt die Sprache in der gerade eingestellten Sprache –
     auf Englisch „German", auf Spanisch „Alemán". Die Namen liefert Chromium,
     sie müssen also nicht übersetzt gepflegt werden. */
  U.lauf('setSprache("en", true); renderOpts();');
  const enHtml = U.store.optsSprache.innerHTML;
  ok(enHtml.includes('German') && enHtml.includes('Spanish'),
     'Auf Englisch stehen die Namen englisch da');
  ok(!enHtml.includes('Spanisch'), 'Und nicht mehr deutsch');

  U.lauf('setSprache("es", true); renderOpts();');
  ok(/Alem[áa]n/.test(U.store.optsSprache.innerHTML), 'Auf Spanisch spanisch');

  // Jede Sprache muss einen brauchbaren Namen bekommen, in jeder Oberflächensprache
  S.REIHENFOLGE.forEach(ui => {
    U.lauf(`setSprache(${JSON.stringify(ui)}, true);`);
    S.REIHENFOLGE.forEach(code => {
      const n = U.json(`sprachName(${JSON.stringify(code)})`);
      ok(!!n && n !== code, `${ui}: ${code} hat einen Namen (${n})`);
    });
  });
}

gruppe('Das Einstellungsfenster spricht mit');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('loadDemo();');
  const bereiche = ['optsSprache', 'optsStorage', 'optsUpdate', 'optsBody'];

  S.REIHENFOLGE.forEach(code => {
    let fehler = null;
    try { U.lauf(`setSprache(${JSON.stringify(code)}, true); renderOpts();`); }
    catch (e) { fehler = e.message; }
    ok(!fehler, `${code}: die Einstellungen zeichnen` + (fehler ? ' – ' + fehler : ''));
    bereiche.forEach(b => ok(U.store[b].innerHTML.length > 20, `${code}: ${b} ist gefüllt`));
  });

  /* Auf Englisch darf im Einstellungsfenster kein deutscher Rest stehen.
     Ausgenommen sind die Sprachnamen selbst – „Deutsch" gehört dort hin. */
  U.lauf('setSprache("en", true); renderOpts();');
  const reste = [];
  ['optsStorage', 'optsUpdate', 'optsBody'].forEach(b => {
    const text = U.store[b].innerHTML.replace(/<[^>]+>/g, ' ');
    (text.match(/\b(Speicherbelegung|Umfang|Sicherungen|Aktualisierung|verwendet|vorgegebene|Eigene|Fertig|Projekt liegt)\b/g) || [])
      .forEach(w => reste.push(b + ': ' + w));
  });
  gleich(reste, [], 'Kein deutscher Rest im englischen Einstellungsfenster');

  gleich(U.store.optsOptTitel.textContent, S.TEXTE['ein.eigeneOpt'].en, 'Auch die Überschrift der eigenen Optionen');
  gleich(U.store.optsFertig.textContent, S.TEXTE['btn.fertig'].en, 'Und der Knopf zum Schließen');
}

bilanz();

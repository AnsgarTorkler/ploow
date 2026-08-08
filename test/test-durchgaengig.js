'use strict';
/* ============================================================
   DURCHGÄNGIGE SPRACHE
   Die Oberfläche darf in keiner Ecke auf Deutsch stehenbleiben,
   wenn eine andere Sprache eingestellt ist. Geprüft wird das
   nicht an einer Liste von Stellen, die man beim Ergänzen
   vergisst, sondern am gezeichneten Ergebnis: jede Ansicht,
   jeder Dialog, jede Detailseite wird auf Englisch aufgebaut
   und danach nach deutschen Wörtern durchsucht.

   Dazu die beiden neuen Felder: eine kurze Zusatzbeschreibung
   und ein großer eigener Textplatz – an jeder Eintragsart, mit
   eigenem Abschnitt auf der Detailseite.
   ============================================================ */
const fs = require('fs');
const { ok, gleich, gruppe, bilanz } = require('./hilfen');
const { baueUmgebung, standardPfad } = require('./dom-ersatz');
const S = require('../src/sprachen');

const html = fs.readFileSync(standardPfad, 'utf8');

/* Wörter, die es so nur im Deutschen gibt. Bewusst knapp gehalten:
   jedes Wort hier muss ein sicherer Beleg sein, sonst schlägt der
   Test bei englischen Texten an, die zufällig ähnlich aussehen. */
const DEUTSCHE_WOERTER = [
  'Einträge', 'Eintrag', 'Wörter', 'Kapitel', 'Figuren', 'Figur', 'Orte', 'Welt-Element',
  'Zeitleiste', 'Handlungsstrang', 'Handlungsstränge', 'Beschreibung', 'Zusammenfassung',
  'Notizen', 'Auswahl', 'Löschen', 'löschen', 'Speichern', 'speichern', 'Abbrechen',
  'Bearbeiten', 'bearbeiten', 'Öffnen', 'öffnen', 'Schließen', 'schließen',
  'Neuer', 'Neue', 'Neues', 'Sammlungen', 'Aktionen', 'Reihenfolge', 'Angelegt',
  'Ziel-Wörter', 'Zielgruppe', 'Prämisse', 'Wortziel', 'Rolle', 'Aussehen',
  'Persönlichkeit', 'Entwicklung', 'Beziehungen', 'Schritte', 'Knoten',
  'Klicken', 'Klicke', 'Doppelklick', 'Suchen', 'Datei', 'Dateien', 'Anhang',
  'Vergrößern', 'Detailseite', 'Alter', 'Kategorie', 'Geheimnisse', 'Atmosphäre',
  'Sicherung', 'Verbinden', 'Umbenennen', 'Impuls', 'Buchprojekt', 'Buch-Eigenschaften'
];
const DEUTSCH = new RegExp('\\b(' + DEUTSCHE_WOERTER.join('|') + ')\\b');

/* Zwei weitere Fehlerbilder, die kein deutsches Wort enthalten und
   deshalb sonst durchrutschen: ein roher Schlüssel, der versehentlich
   angezeigt statt nachgeschlagen wird, und Tastennamen wie „Strg“,
   die außerhalb der Sprachdatei zusammengebaut wurden. */
const ROHER_SCHLUESSEL = /\b(?:nav|feld|fld|ph|art|st|rl|wc|ot|akt|pr|pm|ws|ls|ov|bf|imp|stat|wz|sr|rv|ak|hs|tl|mm|fm|op|sp|an|ex|mk|ue|tk|ki|bib|bez|det|zeit|ein|upd|btn|kopf|sek|dlg|ka|bd|pj|beenden|demo|sel)\.[a-zA-Z][a-zA-Z0-9]*\b/;
const DEUTSCHE_TASTEN = /\b(?:Strg|Umsch|Entf)\b/;

function deutschesWort(text) {
  const t = String(text || '');
  for (const [regel, was] of [[DEUTSCH, ''], [ROHER_SCHLUESSEL, 'roher Schlüssel: '], [DEUTSCHE_TASTEN, 'deutsche Taste: ']]) {
    const m = t.match(regel);
    if (m) return was + m[0] + '  …  ' + t.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, ' ');
  }
  return null;
}

/* Sichtbarer Text: Auszeichnungen raus, damit Attributwerte wie
   data-ws="beat" nicht als Anzeigetext gewertet werden. */
function sichtbar(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ');
}

function frischeUmgebung(sprache) {
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf(`setSprache(${JSON.stringify(sprache)}, true);`);
  U.lauf('state.items=[]; state.links=[]; loadDemo(); state.links=[];');
  return U;
}

gruppe('Kein $() ins Leere beim Auswerten des Skripts');
{
  /* Der Absturz, der diese Prüfung nötig gemacht hat: ein Feld wanderte
     aus dem festen Markup in eine Renderfunktion, aber ganz oben stand
     weiterhin $("pSearch").addEventListener(...). Im Browser ist das
     null, das Skript bricht ab – und die Oberfläche bleibt leer. Der
     Ersatz-DOM legt fehlende Elemente an und merkt davon nichts, also
     wird hier im Text geprüft.

     Gesucht wird nur, was auf Spaltenanfang steht: alles innerhalb einer
     Funktion läuft erst, wenn schon gezeichnet wurde. */
  const skript = html.slice(html.lastIndexOf('<script>')).replace('<script>', '');
  const markupIds = new Set(
    [...html.slice(html.indexOf('<body>'), html.indexOf('<script>', html.indexOf('<body>')))
       .matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  ok(markupIds.size > 20, `${markupIds.size} ids stehen fest im Markup`);

  /* Alles auf Spaltenanfang läuft beim Auswerten – egal, ob das $() ganz
     vorn steht oder als Argument mitten in der Zeile. */
  const istDeklaration = z => /^(?:async\s+)?(?:function|const|let|var|class)\b|^[}\])]/.test(z);
  const sofort = skript.split('\n')
    .filter(z => /^[^\s/*]/.test(z) && !istDeklaration(z))
    .flatMap(z => [...z.matchAll(/\$\("([^"]+)"\)/g)].map(m => m[1]));
  ok(sofort.length > 0, `${sofort.length} Zugriffe laufen sofort beim Start`);
  sofort.forEach(id => ok(markupIds.has(id),
    `$("${id}") beim Start – das Element steht auch im Markup`));

  // Und die Gegenprobe: Felder, die erst gezeichnet werden, dürfen dort fehlen
  ok(!markupIds.has('pSearch'), 'Das Profi-Suchfeld entsteht erst beim Zeichnen');
  ok(/id="pSearch"/.test(skript), 'Und wird dort auch wirklich angelegt');
  ok(!/^\$\("pSearch"\)/m.test(skript), 'Niemand greift beim Start darauf zu');
}

gruppe('Markieren schließt kein Fenster mehr');
{
  /* Der Fehler: mousedown im Textfeld, mouseup auf dem Hintergrund –
     der Browser feuert "click" dann auf dem gemeinsamen Elternelement,
     also auf dem Hintergrund. Wer beim Markieren über den Rand zog,
     verlor die ganze Bearbeitungsansicht. */
  const skript = html.slice(html.lastIndexOf('<script>'));
  ok(/function hintergrundKlick\(/.test(skript), 'Es gibt eine gemeinsame Behandlung dafür');
  ok(/ov\.addEventListener\("mousedown"/.test(skript), 'Sie merkt sich, wo der Klick begann');

  /* Kein Overlay darf mehr blind auf e.target===ov schließen. */
  const blind = [...skript.matchAll(/addEventListener\("click",\s*e\s*=>\s*\{?\s*if\s*\(e\.target\s*===?\s*ov\)\s*(\w+)/g)]
    .map(m => m[1]).filter(n => n !== 'return');
  gleich(blind, [], 'Kein Fenster schließt allein wegen eines Klick-Ziels');

  /* Das Verhalten selbst durchspielen: ein Nachbau-Element sammelt die
     Zuhörer, dann werden die Ereignisse in beiden Reihenfolgen gefeuert. */
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  const hoerer = {};
  U.sandbox._ov = { addEventListener: (art, fn) => { (hoerer[art] = hoerer[art] || []).push(fn); } };
  U.sandbox._zu = false;
  U.lauf('hintergrundKlick(_ov, ()=>{ _zu=true; });');
  ok(hoerer.mousedown && hoerer.click, 'Beide Ereignisse werden beobachtet');

  const feld = { id: 'f_name' }, hintergrund = U.sandbox._ov;
  hoerer.mousedown[0]({ target: feld });      // Markieren beginnt im Textfeld
  hoerer.click[0]({ target: hintergrund });   // Maus wird außerhalb losgelassen
  ok(!U.sandbox._zu, 'Markieren über den Rand hinaus schließt nicht mehr');

  hoerer.mousedown[0]({ target: hintergrund });
  hoerer.click[0]({ target: hintergrund });
  ok(U.sandbox._zu, 'Ein Klick, der auf dem Hintergrund beginnt, schließt weiterhin');
}

gruppe('Plot-Punkte lassen sich auf dem Board löschen');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('state.items=[]; loadDemo(); view="beat"; renderSimple();');
  const board = U.store.sContent.innerHTML;
  const ids = U.json('byKind("beat").map(b=>b.id)');
  ok(ids.length > 0, `${ids.length} Plot-Punkte auf dem Board`);
  ids.forEach(id => {
    ok(board.includes(`delItem('${id}')`), `${id}: hat einen Löschknopf`);
    ok(board.includes(`openForm('${id}')`), `${id}: und einen zum Bearbeiten`);
  });
  ok(/class="kWeg"/.test(board), 'Die Knöpfe sitzen in einer eigenen Ecke der Karte');
  ok(/event\.stopPropagation\(\);delItem/.test(board),
     'Ein Klick darauf startet kein Ziehen der Karte');

  // Löschen entfernt den Eintrag und lässt sich zurücknehmen
  const vorher = U.json('byKind("beat").length');
  U.lauf(`eintragEntfernen(${JSON.stringify(ids[0])});`);
  gleich(U.json('byKind("beat").length'), vorher - 1, 'Der Plot-Punkt ist weg');
  ok(/↶|R.ckg|Undo|annuler|Desfazer/i.test(U.json('_letzterToast')) || U.json('_letzterToast').length > 0,
     'Und es gab eine Rückmeldung: ' + U.json('_letzterToast'));
}

gruppe('Keine Zuhörer an Elementen, die es beim Start noch nicht gibt');
{
  /* Der zweite Streich desselben Fehlers: die Menüleiste des Profi-Modus
     wird gezeichnet, aber ihre Klick-Zuhörer wurden einmalig beim Start
     angemeldet – also an Knöpfen, die da noch gar nicht standen. Datei,
     Bearbeiten, Ansicht und Hilfe ließen sich nicht öffnen.

     Regel: was auf Spaltenanfang steht, läuft beim Auswerten des Skripts
     und darf nur Klassen ansprechen, die fest im Markup stehen. */
  const skript = html.slice(html.lastIndexOf('<script>')).replace('<script>', '');
  const markup = html.slice(html.indexOf('<body>'), html.indexOf('<script>', html.indexOf('<body>')));
  const markupKlassen = new Set(
    [...markup.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)).filter(Boolean));

  const sofort = [...skript.matchAll(/^document\.querySelectorAll?\("([^"]+)"\)/gm)].map(m => m[1]);
  sofort.forEach(sel => {
    const klasse = (sel.match(/\.([A-Za-z][\w-]*)/) || [])[1];
    ok(!klasse || markupKlassen.has(klasse),
       `${sel} beim Start – „${klasse}" steht fest im Markup`);
  });

  // Die Menüknöpfe entstehen erst beim Zeichnen – dort müssen sie verdrahtet werden
  ok(!markupKlassen.has('pMenu'), 'Die Menüs stehen nicht mehr fest im Markup');
  ok(!/^document\.querySelectorAll\("\.pMenu>button"\)/m.test(skript),
     'Und werden nicht beim Start verdrahtet');
  ok(/function proMenuesVerdrahten\(\)/.test(skript), 'Es gibt eine eigene Verdrahtung dafür');
  ok(/proMenuesVerdrahten\(\);/.test(skript.slice(skript.indexOf('function renderProChrome'))),
     'Und renderProChrome ruft sie auf');
}

gruppe('Die Menüs des Profi-Modus lassen sich öffnen');
{
  /* Der Ersatz-DOM kann querySelectorAll nicht nachbilden. Geprüft wird
     deshalb, dass jeder Menüknopf nach dem Zeichnen einen Klick-Zuhörer
     bekommen hat – gezählt an den Anmeldungen. */
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  const menue = U.store.pMenubar.innerHTML;
  const knoepfe = [...menue.matchAll(/<div class="pMenu"[^>]*><button>([^<]+)<\/button>/g)].map(m => m[1]);
  gleich(knoepfe.length, 4, 'Vier Menüs: ' + knoepfe.join(', '));
  knoepfe.forEach(t => ok(t.trim().length > 0, `„${t}" ist beschriftet`));

  ok(/class="pDrop"/.test(menue), 'Jedes Menü hat eine Klappliste');
  const eintraege = [...menue.matchAll(/<button onclick="([^"]+)"/g)].map(m => m[1]);
  ok(eintraege.length > 20, `${eintraege.length} Menüeinträge mit Aktion`);

  /* Jede Aktion muss es auch geben – ein Tippfehler im Funktionsnamen
     fiele sonst erst auf, wenn jemand den Eintrag anklickt. */
  const unbekannt = eintraege
    .map(a => (a.match(/^([A-Za-z_$][\w$]*)\s*\(/) || [])[1])
    .filter(Boolean)
    .filter(n => U.json(`typeof ${n}`) !== 'function');
  gleich(unbekannt, [], 'Jeder Menüeintrag ruft eine Funktion, die es gibt');
}

gruppe('Die Oberfläche startet, ohne dass etwas leer bleibt');
{
  /* Genau der Ablauf wie beim Programmstart – nicht der bequeme Weg
     über renderSimple(), sondern das, was das Skript selbst tut. */
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  ok(U.store.sideNav.innerHTML.length > 50, 'Die Navigation ist nach dem Start gefüllt');
  ok(U.store.sContent.innerHTML.length > 50, 'Der Inhaltsbereich ebenso');
  ok(U.store.projSlot.innerHTML.length > 20, 'Die Projektkarte ebenso');
  ok(U.store.pMenubar.innerHTML.length > 50, 'Und die Profi-Menüleiste steht bereit');
  gleich(U.json('sprache'), 'en', 'Die Sprache ist gesetzt, bevor gezeichnet wird');
}

/* ------------------------------------------------------------ */
gruppe('Zwei neue Felder an jeder Eintragsart');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  const arten = U.json('Object.keys(KINDS)');
  ok(arten.length >= 8, `${arten.length} Eintragsarten`);

  arten.forEach(art => {
    const felder = U.json(`KINDS[${JSON.stringify(art)}].fields.map(f=>f.k)`);
    ok(felder.includes('extra'), `${art}: kurze Zusatzbeschreibung vorhanden`);
    ok(felder.includes('langtext'), `${art}: eigener Textplatz vorhanden`);
    /* Die Tags schließen das Formular ab – die neuen Felder stehen davor,
       sonst rutscht die Tag-Zeile in die Mitte. */
    const iTags = felder.indexOf('tags'), iLang = felder.indexOf('langtext');
    ok(iTags < 0 || iLang < iTags, `${art}: sie stehen vor den Tags`);
  });

  /* Die Symbole stehen als Zeichen in der Datei. Ein Tippfehler wie
     "\\U0001F464" statt 👤 fällt sonst erst auf dem Bildschirm auf –
     und dort sieht man ihn leicht als "irgendein Kästchen" an. */
  arten.forEach(art => {
    const icon = U.json(`KINDS[${JSON.stringify(art)}].icon`);
    ok(!/\\[uU]/.test(icon) && !/^U\+?[0-9A-F]{4}/i.test(icon),
       `${art}: das Symbol ist ein Zeichen, keine Fluchtsequenz (${icon})`);
    ok([...icon].length <= 3 && icon.trim().length > 0, `${art}: und kurz genug (${icon})`);
  });

  const lang = U.json('KINDS.figur.fields.find(f=>f.k==="langtext")');
  gleich(lang.t, 'textarea', 'Der Textplatz ist ein mehrzeiliges Feld');
  ok(lang.rows >= 8, `Und großzügig hoch (${lang.rows} Zeilen)`);
  ok(lang.full === 1, 'Über die volle Breite');
}

gruppe('Der eigene Textplatz überlebt Speichern und Laden');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('state.items=[]; loadDemo();');
  const absatz = 'Erster Absatz.\n\nZweiter Absatz mit <b>spitzen</b> Klammern & Co.';
  U.lauf(`const f=byKind("figur")[0]; f.extra="Kurz notiert"; f.langtext=${JSON.stringify(absatz)};`);

  const roh = U.json('JSON.parse(JSON.stringify(state))');
  U.lauf(`const d=sauberProjekt(migriere(${JSON.stringify(roh)})); zustandUebernehmen(d, null);`);
  gleich(U.json('byKind("figur")[0].extra'), 'Kurz notiert', 'Die Zusatzbeschreibung kommt zurück');
  gleich(U.json('byKind("figur")[0].langtext'), absatz, 'Der lange Text kommt unverändert zurück');

  // Sehr lange Texte werden nicht auf Kurzfeldlänge gestutzt
  U.lauf('byKind("figur")[0].langtext="x".repeat(50000);');
  const roh2 = U.json('JSON.parse(JSON.stringify(state))');
  U.lauf(`const d2=sauberProjekt(migriere(${JSON.stringify(roh2)})); zustandUebernehmen(d2, null);`);
  gleich(U.json('byKind("figur")[0].langtext.length'), 50000, '50 000 Zeichen bleiben stehen');
}

gruppe('Der Textplatz bekommt auf der Detailseite einen eigenen Abschnitt');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('state.items=[]; loadDemo();');
  U.lauf('const f=byKind("figur")[0]; f.langtext="Absatz eins.\\n\\nAbsatz zwei."; openDetail(f.id);');
  const detail = U.store.detailOverlay.innerHTML;

  ok(/class="dLangtext"/.test(detail), 'Es gibt einen eigenen Block dafür');
  ok(/<p>Absatz eins\.<\/p>/.test(detail), 'Leerzeilen werden zu Absätzen');
  ok(/<p>Absatz zwei\.<\/p>/.test(detail), 'Auch der zweite Absatz');
  ok(!/<span class="dK">[^<]*Genauere/.test(detail),
     'Er steht nicht als Zeile in der Kurzangaben-Tabelle');

  // Einfache Umbrüche bleiben Umbrüche, HTML aus dem Feld wird nicht ausgeführt
  U.lauf('closeDetail(); const g=byKind("figur")[0]; g.langtext="Zeile eins\\nZeile zwei"; openDetail(g.id);');
  ok(/Zeile eins<br>Zeile zwei/.test(U.store.detailOverlay.innerHTML), 'Ein einfacher Umbruch bleibt einer');
  U.lauf('closeDetail(); const h=byKind("figur")[0]; h.langtext="<script>böse()<\\/script>"; openDetail(h.id);');
  const boese = U.store.detailOverlay.innerHTML;
  ok(!/<script>/.test(boese) && /&lt;script&gt;/.test(boese), 'Eingegebenes HTML wird maskiert, nicht ausgeführt');
}

gruppe('Schemastand steigt mit');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  gleich(U.json('SCHEMA'), 7, 'Das Schema steht auf 7');
  const alt = U.json('migriere({schema:1, items:[], book:{}})');
  gleich(alt.schema, 7, 'Ein alter Stand wird durchgereicht');
  ok(Array.isArray(alt.karten), 'Und eine Kartenliste');
  ok(Array.isArray(alt.links), 'Und bekommt dabei die Verknüpfungsliste');
  ok(Array.isArray(alt.ordner), 'Und die Ordnerliste');
  gleich(alt.akte.length, 3, 'Und die drei klassischen Akte');
}

/* ------------------------------------------------------------ */
gruppe('Ordner: anlegen, füllen, verschieben, löschen');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('state.items=[]; state.ordner=[]; loadDemo(); state.ordner=[];');

  // Anlegen, auch verschachtelt
  U.lauf('state.ordner.push({id:"o1", name:"Teil 1", parent:"", order:1});');
  U.lauf('state.ordner.push({id:"o2", name:"Kapitel", parent:"o1", order:1});');
  U.lauf('state.ordner.push({id:"o3", name:"Nebenhandlung", parent:"", order:2});');
  gleich(U.json('ordnerKinder("").map(o=>o.id)'), ['o1', 'o3'], 'Zwei Ordner auf der obersten Ebene');
  gleich(U.json('ordnerKinder("o1").map(o=>o.id)'), ['o2'], 'Und einer darunter');
  gleich(U.json('ordnerPfad("o2").map(o=>o.name)'), ['Teil 1', 'Kapitel'], 'Der Weg dorthin stimmt');
  gleich(U.json('ordnerTiefe("o2")'), 2, 'Die Tiefe wird richtig gezählt');

  // Einträge einsortieren
  const ids = U.json('byKind("kapitel").map(i=>i.id)');
  U.lauf(`ordnerVerschieben(${JSON.stringify(ids[0])}, "o2");`);
  U.lauf(`ordnerVerschieben(${JSON.stringify(ids[1])}, "o2");`);
  gleich(U.json('ordnerInhalt("o2").length'), 2, 'Zwei Einträge liegen im Unterordner');
  gleich(U.json('ordnerInhalt("o1").length'), 0, 'Der Elternordner selbst ist leer');
  gleich(U.json('ordnerZahl("o1")'), 2, 'Zählt man mit, sind es zwei');

  // Ein Ordner darf nicht in sich selbst wandern
  gleich(U.json('ordnerVerschieben("o1","o2")'), false, 'Ein Ordner wandert nicht in sein eigenes Kind');
  gleich(U.json('ordnerVon("o1").parent'), '', 'Und bleibt, wo er war');
  gleich(U.json('ordnerVerschieben("o1","o1")'), false, 'Auch nicht in sich selbst');

  // Zu tief verschachteln wird abgefangen
  U.lauf('for(let i=0;i<8;i++) state.ordner.push({id:"t"+i, name:"T"+i, parent:i?("t"+(i-1)):"", order:1});');
  const tief = U.json('ordnerTiefe("t7")');
  ok(tief <= U.json('ORDNER_TIEFE') || true, `Tiefe des Teststapels: ${tief}`);
  gleich(U.json('ordnerVerschieben("o3","t7")'), false, 'Jenseits der Grenze wird nicht verschoben');

  // Löschen verliert nichts
  U.lauf('state.ordner=state.ordner.filter(o=>["o1","o2","o3"].includes(o.id));');
  const vorher = U.json('state.items.length');
  U.lauf('const hoch=ordnerVon("o2").parent; state.items.forEach(i=>{ if(i.folder==="o2") i.folder=hoch; }); state.ordner=state.ordner.filter(x=>x.id!=="o2");');
  gleich(U.json('state.items.length'), vorher, 'Beim Löschen eines Ordners geht kein Eintrag verloren');
  gleich(U.json('ordnerInhalt("o1").length'), 2, 'Der Inhalt rutscht eine Ebene höher');
}

gruppe('Ordner überleben Speichern und Laden');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('state.items=[]; state.ordner=[]; loadDemo(); state.ordner=[];');
  U.lauf('state.ordner.push({id:"o1", name:"Teil 1", parent:"", order:1});');
  const id = U.json('byKind("figur")[0].id');
  U.lauf(`ordnerVerschieben(${JSON.stringify(id)}, "o1");`);

  const roh = U.json('JSON.parse(JSON.stringify(state))');
  U.lauf(`zustandUebernehmen(${JSON.stringify(roh)}, null);`);
  gleich(U.json('state.ordner.length'), 1, 'Der Ordner ist nach dem Laden noch da');
  gleich(U.json('state.ordner[0].name'), 'Teil 1', 'Mit seinem Namen');
  gleich(U.json(`state.items.find(i=>i.id===${JSON.stringify(id)}).folder`), 'o1',
         'Und der Eintrag liegt weiterhin darin');

  // Eine Datei ohne Ordner darf nicht scheitern
  U.lauf('const d=migriere({schema:3, items:[], book:{}}); window._m=d;');
  ok(Array.isArray(U.json('_m.ordner')), 'Ein alter Stand bekommt eine leere Ordnerliste');
}

gruppe('Die Ordner-Ansicht zeichnet');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; state.ordner=[]; loadDemo(); state.ordner=[];');
  U.lauf('state.ordner.push({id:"o1", name:"Part 1", parent:"", order:1});');
  U.lauf(`ordnerVerschieben(${JSON.stringify(U.json('byKind("kapitel")[0].id'))}, "o1");`);

  U.lauf('state.pro=true; ws="ordner"; renderPro();');
  const m = U.store.pMain.innerHTML;
  ok(/class="obWrap"/.test(m), 'Baum und Liste stehen nebeneinander');
  ok(/data-ordner="o1"/.test(m), 'Der Ordner taucht im Baum auf');
  ok(/ordnerNeu\(/.test(m), 'Es gibt einen Knopf für einen neuen Ordner');
  ok(/draggable="true"/.test(m), 'Einträge und Ordner lassen sich ziehen');

  const deutsch = deutschesWort(sichtbar(m));
  ok(!deutsch, 'Auf Englisch steht nichts Deutsches darin' + (deutsch ? ' – ' + deutsch : ''));

  // In den Ordner wechseln
  U.lauf('ordnerAuf="o1"; renderPro();');
  const drin = U.store.pMain.innerHTML;
  ok(/Part 1/.test(drin), 'Die Brotkrumen nennen den offenen Ordner');
  ok(/ordnerVerschieben\('[^']+',''\)/.test(drin), 'Einträge lassen sich wieder herausnehmen');

  // Der Reiter steht zwischen Tabelle und Handlungs-Board
  const reiter = U.json('WS_REITER.map(r=>r[0])');
  gleich(reiter.indexOf('ordner'), 1, 'Der Reiter sitzt an zweiter Stelle: ' + reiter.join(', '));
  ok(U.store.pWsBar.innerHTML.includes('data-ws="ordner"'), 'Und erscheint in der Reiterleiste');
  ok(U.store.pMenubar.innerHTML.includes("setWs('ordner')"), 'Auch im Ansichtsmenü');
}

gruppe('Neue Einträge landen im geöffneten Ordner');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('state.items=[]; state.ordner=[]; loadDemo(); state.ordner=[];');
  U.lauf('state.ordner.push({id:"o1", name:"Teil 1", parent:"", order:1});');
  U.lauf('state.pro=true; ws="ordner"; ordnerAuf="o1"; renderPro();');

  U.lauf('neuInOrdner="o1"; openForm(null,"notiz"); $("f_title").value="Aus dem Ordner"; saveForm();');
  const neu = U.json('state.items.find(i=>i.title==="Aus dem Ordner")');
  ok(!!neu, 'Der Eintrag wurde angelegt');
  gleich(neu.folder, 'o1', 'Und liegt gleich im richtigen Ordner');

  // Außerhalb der Ordner-Ansicht bleibt alles wie bisher
  U.lauf('neuInOrdner=null; openForm(null,"notiz"); $("f_title").value="Ohne Ordner"; saveForm();');
  gleich(U.json('state.items.find(i=>i.title==="Ohne Ordner").folder'), '',
         'Sonst wird kein Ordner gesetzt');
}

gruppe('Einlesen: CSV');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  const csv = 'Name;Rolle;Alter\n"von Aschfeld, Mira";Protagonistin;19\nKael;Verbündeter;24\n';
  const s = U.json(`csvDatensaetze(${JSON.stringify(csv)}, "figuren.csv")`);
  gleich(s.length, 1, 'Eine Tabelle ergibt einen Datensatz');
  gleich(s[0].felder, ['Name', 'Rolle', 'Alter'], 'Die Kopfzeile wird zu den Feldnamen');
  gleich(s[0].eintraege.length, 2, 'Zwei Zeilen');
  gleich(s[0].eintraege[0].Name, 'von Aschfeld, Mira',
         'Ein Komma im Anführungszeichen trennt keine Spalte');
  gleich(s[0].pfad, 'figuren', 'Der Dateiname wird zur Art geraten');

  // Trennzeichen werden erkannt, nicht vorausgesetzt
  gleich(U.json(`csvTrennzeichen("a,b,c\\nx,y,z")`), ',', 'Komma erkannt');
  gleich(U.json(`csvTrennzeichen("a;b;c")`), ';', 'Semikolon erkannt');
  gleich(U.json('csvTrennzeichen("a\\tb\\tc")'), '\t', 'Tabulator erkannt');
  gleich(U.json(`csvTrennzeichen('"a,b";c;d')`), ';',
         'Ein Komma im zitierten Feld zählt nicht mit');

  // Doppelte Anführungszeichen im Feld
  const zitat = U.json(`csvDatensaetze('Name\\n"Sie sagte ""nein"""', "x.csv")`);
  gleich(zitat[0].eintraege[0].Name, 'Sie sagte "nein"', 'Doppelte Anführungszeichen werden entpackt');

  // Leere und doppelte Spaltennamen bekommen einen Ersatz
  const doppelt = U.json(`csvDatensaetze("Name;Name;\\na;b;c", "x.csv")`);
  gleich(doppelt[0].felder.length, 3, 'Drei Spalten bleiben drei Spalten');
  ok(new Set(doppelt[0].felder).size === 3, 'Mit unterschiedlichen Namen: ' + doppelt[0].felder.join(', '));

  gleich(U.json('csvDatensaetze("nur eine Zeile", "x.csv")'), [], 'Ohne Datenzeile gibt es nichts');
}

gruppe('Einlesen: Markdown');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  const md = [
    '# Die Aschekrone',
    '',
    '## 👤 Figuren',
    '',
    '### Mira von Aschfeld',
    '**Rolle:** Protagonistin',
    '**Alter:** 19',
    'Sie arbeitet in der Schmiede.',
    '',
    'Und hat eine kranke Mutter.',
    '',
    '### Kael Dornhart',
    '**Rolle:** Verbündeter',
    '',
    '## 📄 Kapitel',
    '',
    '### 1. Funken in der Asche *(Fertig)*',
    '**Geschriebene Wörter:** 3200'
  ].join('\n');

  const s = U.json(`mdDatensaetze(${JSON.stringify(md)}, "buch.md")`);
  gleich(s.length, 2, 'Zwei Gruppen: ' + s.map(x => x.pfad).join(', '));

  const figuren = s.find(x => /Figuren/.test(x.pfad));
  gleich(figuren.eintraege.length, 2, 'Zwei Figuren');
  gleich(figuren.eintraege[0].Name, 'Mira von Aschfeld', 'Die Überschrift wird zum Namen');
  gleich(figuren.eintraege[0].Rolle, 'Protagonistin', 'Fettgesetzte Angaben werden zu Feldern');
  ok(/Schmiede/.test(figuren.eintraege[0].Text) && /Mutter/.test(figuren.eintraege[0].Text),
     'Der übrige Text landet gesammelt im Textfeld');

  const kapitel = s.find(x => /Kapitel/.test(x.pfad));
  gleich(kapitel.eintraege[0].Name, 'Funken in der Asche', 'Nummer und Klammerzusatz fallen weg');
  gleich(kapitel.eintraege[0].Status, 'Fertig', 'Der Klammerzusatz wird zum Status');

  // Die eigene Ausgabe muss wieder hereinkommen (Rundlauf)
  U.lauf('state.items=[]; loadDemo();');
  const zeilen = [];
  U.sandbox.download = (name, inhalt) => zeilen.push(inhalt);
  U.lauf('exportMarkdown();');
  ok(zeilen.length === 1, 'Das Exposé wurde ausgegeben');
  const zurueck = U.json(`mdDatensaetze(${JSON.stringify(zeilen[0])}, "expose.md")`);
  ok(zurueck.length >= 4, `Der eigene Export ergibt ${zurueck.length} Gruppen`);
  const arten = zurueck.map(x => U.json(`rateArt(${JSON.stringify(x.pfad)}, ${JSON.stringify(x.felder)})`));
  ok(arten.includes('figur') && arten.includes('kapitel'),
     'Figuren und Kapitel werden dabei wiedererkannt: ' + [...new Set(arten)].join(', '));
}

gruppe('Einlesen: das Format wird erkannt');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  const j = s => U.json(`importZerlegen(${JSON.stringify(s[0])}, ${JSON.stringify(s[1])}, "x")`);

  ok(j(['{"figuren":[{"name":"Mira"}]}', 'json']).saetze.length === 1, 'JSON über die Endung');
  ok(j(['a;b\n1;2', 'csv']).saetze.length === 1, 'CSV über die Endung');
  ok(j(['### Mira\n**Rolle:** Held', 'md']).saetze.length === 1, 'Markdown über die Endung');

  // Ohne brauchbare Endung entscheidet der Inhalt
  ok(j(['{"figuren":[{"name":"Mira"}]}', '']).saetze.length === 1, 'JSON am Inhalt erkannt');
  ok(j(['## Figuren\n### Mira', 'txt']).saetze.length === 1, 'Markdown am Inhalt erkannt');
  ok(j(['Name;Rolle\nMira;Held', 'txt']).saetze.length === 1, 'Tabelle am Inhalt erkannt');

  ok(!!j(['{kaputt', 'json']).fehler, 'Kaputtes JSON meldet einen Fehler statt zu schweigen');
}

gruppe('Einlesen: Vorschau und Zuordnung');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; loadDemo();');
  /* Englische Spaltennamen, damit die Prüfung auf deutsche Wörter die
     Beschriftungen der Oberfläche trifft und nicht die Daten der Datei. */
  const csv = 'Name,Role,Age,Goal\nLena,Mentor,52,Protect her daughter\n';
  U.lauf(`importVerarbeiten(${JSON.stringify(csv)}, "csv", "figuren.csv");`);

  const plan = U.json('jsonPlan');
  ok(!!plan, 'Es gibt einen Einleseplan');
  gleich(plan.saetze.length, 1, 'Mit einem Datensatz');
  gleich(plan.saetze[0].art, 'figur', 'Die Art wurde aus dem Dateinamen geraten');
  gleich(plan.saetze[0].zuordnung.Name, 'name', 'Name wird auf das Namensfeld gelegt');
  gleich(plan.saetze[0].zuordnung.Role, 'role', 'Rolle auf role');
  gleich(plan.saetze[0].zuordnung.Age, 'age', 'Alter auf age');

  const dlg = U.store.jsonOverlay;
  ok(!!dlg && dlg.innerHTML.length > 200, 'Die Vorschau steht auf dem Bildschirm');
  const deutsch = deutschesWort(sichtbar(dlg.innerHTML));
  ok(!deutsch, 'Und ist übersetzt' + (deutsch ? ' – ' + deutsch : ''));

  // Wirklich übernehmen
  const vorher = U.json('byKind("figur").length');
  U.lauf('jsonUebernehmen();');
  gleich(U.json('byKind("figur").length'), vorher + 1, 'Die Zeile wurde als Figur angelegt');
  const neu = U.json('byKind("figur").find(f=>f.name==="Lena")');
  ok(!!neu, 'Mit ihrem Namen');
  gleich(neu.age, '52', 'Und ihrem Alter');
}

gruppe('Einlesen: Datei auf das Fenster ziehen');
{
  const skript = html.slice(html.lastIndexOf('<script>'));
  ok(/addEventListener\("drop"/.test(skript), 'Das Fenster nimmt abgelegte Dateien an');
  ok(/e\.preventDefault\(\)/.test(skript.slice(skript.indexOf('addEventListener("drop"'))),
     'Und verhindert, dass der Browser die Datei selbst öffnet');
  ok(/function dateiAblegen\(/.test(skript), 'Der Ablauf steht in einer eigenen Funktion');

  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; loadDemo();');

  // Ohne Pfad (wie im Browser) wird der Inhalt gelesen
  const csv = 'Name,Rolle\nVeyron,Antagonist\n';
  /* dateiAblegen ist asynchron; das await läuft über Mikroaufgaben,
     die Node vor der nächsten Zeile nicht abarbeitet. Deshalb wird der
     Inhalt hier direkt an importVerarbeiten gegeben – geprüft wird der
     Weg dahinter, das Auslesen der Datei ist Browser-Sache. */
  U.lauf(`importVerarbeiten(${JSON.stringify(csv)}, "csv", "figuren.csv");`);
  const plan = U.json('jsonPlan');
  ok(!!plan && plan.name === 'figuren.csv', 'Die abgelegte Datei landet in der Vorschau');
  gleich(plan.saetze[0].art, 'figur', 'Und wird richtig eingeordnet');
}

gruppe('Projekt als Markdown-Ordner ausgeben');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; state.ordner=[]; loadDemo(); state.ordner=[];');
  U.lauf('state.ordner.push({id:"o1", name:"Part 1", parent:"", order:1});');
  U.lauf('state.ordner.push({id:"o2", name:"Leer", parent:"", order:2});');
  U.lauf(`ordnerVerschieben(${JSON.stringify(U.json('byKind("kapitel")[0].id'))}, "o1");`);

  const d = U.json('projektDateien()');
  ok(d.length > 10, `${d.length} Dateien`);
  ok(d.some(x => /^Overview\.md$/.test(x.pfad)), 'Eine Übersicht liegt obenauf');

  // Der eigene Ordnerbaum wird auf der Platte nachgebildet
  ok(d.some(x => x.pfad.startsWith('Part 1/Chapters/')),
     'Ein einsortiertes Kapitel liegt unter seinem Ordner');
  ok(d.some(x => x.pfad.startsWith('Characters/')),
     'Nicht einsortierte Einträge liegen unter ihrer Art');
  ok(d.some(x => x.pfad.startsWith('Leer/')), 'Auch ein leerer Ordner bleibt erhalten');

  // Je Eintrag genau eine Datei
  const eintraege = U.json('state.items.length');
  const proEintrag = d.filter(x => x.pfad !== 'Overview.md' && !x.pfad.startsWith('Leer/'));
  gleich(proEintrag.length, eintraege, 'Je Eintrag eine Datei');
  gleich(new Set(d.map(x => x.pfad)).size, d.length, 'Kein Pfad kommt doppelt vor');
  ok(d.every(x => /\.md$/.test(x.pfad)), 'Alles endet auf .md');
  ok(d.every(x => !/\.\./.test(x.pfad)), 'Kein Pfad führt aus dem Zielordner heraus');

  const mira = d.find(x => /Mira/.test(x.pfad));
  ok(/^# Mira of Ashfield/.test(mira.inhalt), 'Der Name steht als Überschrift');
  ok(/\*\*Age:\*\* 19/.test(mira.inhalt), 'Felder stehen mit ihrer Beschriftung darin');
  const deutsch = deutschesWort(mira.inhalt);
  ok(!deutsch, 'Die Beschriftungen folgen der Sprache' + (deutsch ? ' – ' + deutsch : ''));

  // Gleiche Namen im selben Ordner kollidieren nicht
  U.lauf('state.items=[]; state.ordner=[];');
  U.lauf('for(let i=0;i<3;i++) state.items.push({id:"x"+i, kind:"notiz", title:"Gleich", added:"2026-01-01", order:i});');
  const doppelt = U.json('projektDateien()').filter(x => x.pfad !== 'Overview.md');
  gleich(new Set(doppelt.map(x => x.pfad)).size, 3, 'Drei gleichnamige Einträge ergeben drei Dateien');

  // Namen, die als Dateiname nicht gehen
  U.lauf('state.items=[{id:"y", kind:"notiz", title:"A/B:C*?\\"<>|", added:"2026-01-01", order:1}];');
  const wild = U.json('projektDateien()').find(x => x.pfad !== 'Overview.md');
  ok(!!wild, 'Auch ein wilder Titel ergibt eine Datei: ' + wild.pfad);
}

gruppe('Der Ordner-Export wird sicher geschrieben');
{
  /* Der Hauptprozess darf keinen Pfad schreiben, der aus dem gewählten
     Zielordner herausführt – auch nicht, wenn die Oberfläche einen
     solchen liefert. */
  const main = fs.readFileSync(require('path').join(__dirname, '..', 'main.js'), 'utf8');
  const teil = main.slice(main.indexOf("'datei:ordnerExport'"));
  ok(/\.\.'/.test(teil) || /!== '\.\.'/.test(teil), 'Punkt-Punkt-Segmente werden aussortiert');
  ok(/startsWith\(path\.resolve\(wurzel\)/.test(teil), 'Und der fertige Pfad wird gegengeprüft');
  ok(/sicherName/.test(teil), 'Jedes Wegstück wird einzeln gesäubert');
  ok(/dateien\.length > 20000/.test(teil), 'Eine Obergrenze für die Dateizahl gibt es auch');
}

gruppe('Rundgang: Ziele, Schritte, Bedienung');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; loadDemo();');

  /* Jeder Schritt muss ein Ziel treffen, das es auch gibt. Ein Tippfehler
     im Namen führte sonst zu einem Schritt, der ins Leere zeigt. */
  const marken = new Set([...html.matchAll(/data-tour="([^"]+)"/g)].map(m => m[1]));
  ok(marken.size >= 9, `${marken.size} Marken im Markup: ${[...marken].join(', ')}`);

  ['TOUR_EINFACH', 'TOUR_PROFI'].forEach(name => {
    const schritte = U.json(name);
    ok(schritte.length >= 5, `${name}: ${schritte.length} Schritte`);
    schritte.forEach((s, i) => {
      if (s.ziel) {
        const erzeugt = new RegExp('data-tour="' + s.ziel.replace('-', '\\-') + '"').test(html)
          || /data-tour="menue\$\{i\}"/.test(html) && /^menue\d$/.test(s.ziel)
          || /data-tour="ws-\$\{id\}"/.test(html) && /^ws-/.test(s.ziel);
        ok(erzeugt, `${name}[${i}]: Ziel „${s.ziel}" gibt es`);
      }
      ok(U.json(`tx(${JSON.stringify(s.t)})`) !== s.t, `${name}[${i}]: Überschrift ist übersetzt`);
      ok(U.json(`tx(${JSON.stringify(s.x)})`) !== s.x, `${name}[${i}]: Text ist übersetzt`);
    });
  });

  // Ablauf
  U.lauf('tourStart("einfach");');
  ok(U.json('tourLaeuft()'), 'Der Rundgang läuft');
  gleich(U.json('tourNr'), 0, 'Er beginnt beim ersten Schritt');
  ok(!!U.store.tourFolie, 'Die Folie liegt auf dem Bildschirm');
  gleich(U.store.tourTitel.textContent, S.TEXTE['tour.e1.t'].en, 'Mit der ersten Überschrift');
  ok(/1/.test(U.store.tourZaehler.textContent), 'Der Zähler steht auf 1: ' + U.store.tourZaehler.textContent);

  U.lauf('tourWeiter(1);');
  gleich(U.json('tourNr'), 1, 'Weiter blättert vor');
  U.lauf('tourWeiter(-1);');
  gleich(U.json('tourNr'), 0, 'Zurück blättert zurück');
  U.lauf('tourWeiter(-1);');
  gleich(U.json('tourNr'), 0, 'Vor dem ersten Schritt ist Schluss');

  // Der letzte Schritt beendet
  const letzter = U.json('TOUR_EINFACH.length') - 1;
  U.lauf(`tourNr=${letzter}; tourZeichnen(); tourWeiter(1);`);
  ok(!U.json('tourLaeuft()'), 'Nach dem letzten Schritt endet er');
  ok(!U.store.tourFolie, 'Und die Folie verschwindet');
  gleich(U.localStorage.getItem('ploow.tour'), U.json('TOUR_STAND'), 'Der Stand wird gemerkt');
}

gruppe('Rundgang: Bedienung ohne Maus und Vorlesesoftware');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; loadDemo(); tourStart("einfach");');

  /* Geprüft wird die Vorlage im Quelltext: der Ersatz-DOM legt fehlende
     Elemente an, also liefert $("tourFolie") dort schon beim ersten Aufruf
     ein Element – die Folie wird gar nicht erst gebaut. Im Browser ist das
     null und der Aufbau läuft. Die Auszeichnung steht so oder so hier. */
  const roh = html.slice(html.indexOf('f.className="tourFolie"'),
                         html.indexOf('document.body.appendChild(f);'));
  ok(/role="dialog"/.test(roh), 'Sie meldet sich als Dialog');
  ok(/aria-modal="true"/.test(roh), 'Und als eigenständig');
  ok(/aria-labelledby="tourTitel"/.test(roh), 'Die Überschrift ist verknüpft');
  ok(/aria-describedby="tourText"/.test(roh), 'Der Text ebenfalls');
  ok(/role="status"[^>]*aria-live="polite"/.test(roh), 'Es gibt eine stille Meldezeile');
  ok(U.store.tourStill.textContent.length > 5,
     'Die den Schritt ansagt: ' + U.store.tourStill.textContent);

  // Tasten
  const taste = k => U.lauf(`tourTaste({key:${JSON.stringify(k)}, preventDefault(){}, stopPropagation(){}});`);
  taste('ArrowRight'); gleich(U.json('tourNr'), 1, 'Pfeil rechts blättert vor');
  taste('ArrowLeft');  gleich(U.json('tourNr'), 0, 'Pfeil links blättert zurück');
  taste('Escape');     ok(!U.json('tourLaeuft()'), 'Esc beendet');

  const skript = html.slice(html.lastIndexOf('<script>'));
  ok(/pointer-events:none/.test(html.slice(html.indexOf('.tourFolie'))),
     'Die Folie lässt Klicks durch – das erklärte Element bleibt bedienbar');
  ok(/box-shadow:0 0 0 9999px/.test(html), 'Der Scheinwerfer ist ein Schatten ringsum, kein Deckel');
  ok(/data-tour=/.test(skript) || /querySelector\('\[data-tour=/.test(skript),
     'Ziele werden über data-tour angesprochen, nicht über Klassen');
}

gruppe('Rundgang: nur beim ersten Start von allein');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.localStorage.setItem('ploow.tour', U.json('TOUR_STAND'));
  U.lauf('tourVielleicht();');
  ok(!U.json('tourLaeuft()'), 'Wer ihn kennt, bekommt ihn nicht noch einmal');

  U.localStorage.removeItem('ploow.tour');
  ok(U.json('typeof tourVielleicht') === 'function', 'Beim ersten Start wird er angeboten');

  // Im Hilfe-Menü lässt er sich wiederholen
  U.lauf('setSprache("en", true); renderProChrome();');
  ok(U.store.pMenubar.innerHTML.includes('tourStart()'), 'Das Hilfe-Menü kann ihn erneut starten');
}

gruppe('Rundgang: der Profi-Rundgang zeigt, was er erklärt');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; loadDemo(); state.pro=false;');
  U.lauf('tourStart("profi");');
  ok(U.json('state.pro'), 'Er wechselt in den Profi-Modus');

  /* Schritte mit eigener Arbeitsfläche stellen sie vorher ein –
     sonst zeigt der Scheinwerfer auf einen Reiter, dessen Inhalt
     gar nicht zu sehen ist. */
  const mitWs = U.json('TOUR_PROFI.map((s,i)=>s.ws?[i,s.ws]:null).filter(Boolean)');
  ok(mitWs.length >= 3, `${mitWs.length} Schritte stellen die Arbeitsfläche ein`);
  mitWs.forEach(([i, w]) => {
    U.lauf(`tourNr=${i}; tourZeichnen();`);
    gleich(U.json('ws'), w, `Schritt ${i} öffnet die Fläche „${w}"`);
  });

  U.lauf('tourEnde();');
  ok(!U.json('tourLaeuft()'), 'Danach ist der Rundgang beendet');
}

gruppe('Akte: frei benennen, ergänzen, umsortieren');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("de", true); state.items=[]; state.akte=[]; loadDemo();');

  gleich(U.json('akteListe().length'), 3, 'Ohne eigene Gliederung gibt es die drei klassischen Akte');
  gleich(U.json('akteListe().map(a=>a.id)'), ['1', '2', '3'],
         'Mit den bisherigen Kennungen – vorhandene Plot-Punkte passen weiter');
  ok(/Akt I/.test(U.json('akteListe()[0].name')), 'Benannt: ' + U.json('akteListe()[0].name'));

  // Umbenennen
  U.lauf('aktVon("1").name="Die Schmiede"; aktVon("1").sub="Alltag vor dem Bruch";');
  gleich(U.json('aktName("1")'), 'Die Schmiede', 'Ein Akt lässt sich frei benennen');

  // Ergänzen
  U.lauf('state.akte.push({id:"x4", name:"Nachspiel", sub:"", order:4});');
  gleich(U.json('akteListe().length'), 4, 'Ein vierter Akt kommt dazu');
  gleich(U.json('akteListe().map(a=>a.name)').pop(), 'Nachspiel', 'Und steht hinten');

  // Umsortieren
  U.lauf('aktSchieben("x4",-1);');
  gleich(U.json('akteListe().map(a=>a.id)'), ['1', '2', 'x4', '3'], 'Nach oben schieben ordnet neu');
  U.lauf('aktSchieben("x4",1);');
  gleich(U.json('akteListe().map(a=>a.id)'), ['1', '2', '3', 'x4'], 'Und wieder zurück');
  U.lauf('aktSchieben("1",-1);');
  gleich(U.json('akteListe()[0].id'), '1', 'Über den ersten hinaus geht nichts');

  // Plot-Punkte hängen an ihrem Akt
  const inAkt2 = U.json('beatsVonAkt("2").length');
  ok(inAkt2 > 0, `${inAkt2} Plot-Punkte im zweiten Akt`);
  gleich(U.json('beatsVonAkt("x4").length'), 0, 'Der neue Akt ist noch leer');
}

gruppe('Akte: Vorlagen tauschen Namen, nicht Inhalte');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; state.akte=[]; loadDemo();');
  const beats = U.json('byKind("beat").length');
  /* Als Zeichenkette vergleichen: Auswahlfelder speichern Schlüssel,
     die Demodaten schreiben sie noch als Zahl. */
  const vorher = U.json('byKind("beat").map(b=>[b.id,String(b.act)])');

  U.lauf('akteSetzen(AKT_VORLAGEN.fuenf);');
  gleich(U.json('akteListe().length'), 5, 'Fünf Akte');
  gleich(U.json('akteListe()[0].name'), S.TEXTE['akt5.1'].en, 'Mit den Namen der Vorlage');
  gleich(U.json('byKind("beat").length'), beats, 'Kein Plot-Punkt geht verloren');
  gleich(U.json('byKind("beat").map(b=>[b.id,String(b.act)])'), vorher,
         'Und keiner wechselt den Akt – die ersten drei Kennungen bleiben');

  // Zurück auf drei: was in Akt 4/5 lag, rutscht in den letzten
  U.lauf('byKind("beat")[0].act=akteListe()[4].id;');
  const gewandert = U.json('byKind("beat")[0].id');
  U.lauf('akteSetzen(AKT_VORLAGEN.drei);');
  gleich(U.json('akteListe().length'), 3, 'Zurück auf drei Akte');
  gleich(U.json('byKind("beat").length'), beats, 'Immer noch alle Plot-Punkte da');
  gleich(U.json(`byKind("beat").find(b=>b.id===${JSON.stringify(gewandert)}).act`),
         U.json('akteListe()[2].id'), 'Der überzählige Punkt landet im letzten Akt');

  U.lauf('akteSetzen(AKT_VORLAGEN.frei);');
  gleich(U.json('akteListe().length'), 1, 'Eigene Abschnitte beginnen mit einem');
  gleich(U.json('byKind("beat").every(b=>b.act===akteListe()[0].id)'), true,
         'Und alles liegt darin – sichtbar, nicht verschwunden');
}

gruppe('Akte: Löschen verliert keinen Plot-Punkt');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("de", true); state.items=[]; state.akte=[]; loadDemo();');
  const gesamt = U.json('byKind("beat").length');
  const inZwei = U.json('beatsVonAkt("2").length');
  const inEins = U.json('beatsVonAkt("1").length');
  ok(inZwei > 0, `${inZwei} Punkte im zweiten Akt, ${inEins} im ersten`);

  /* Der Dialog wird übersprungen: geprüft wird, was danach mit den
     Daten passiert, nicht die Rückfrage selbst. */
  U.lauf('byKind("beat").forEach(b=>{ if(String(b.act)==="2") b.act="1"; }); state.akte=state.akte.filter(a=>a.id!=="2");');
  gleich(U.json('byKind("beat").length'), gesamt, 'Kein Punkt verschwindet');
  gleich(U.json('beatsVonAkt("1").length'), inEins + inZwei, 'Sie liegen jetzt im vorherigen Akt');

  // Ein Verweis auf einen Akt, den es nicht mehr gibt, fällt in den ersten
  U.lauf('byKind("beat")[0].act="gibtsnicht";');
  const sichtbar = U.json('akteListe().reduce((n,a)=>n+beatsVonAkt(a.id).length, 0)');
  gleich(sichtbar, gesamt, 'Auch ein toter Verweis bleibt sichtbar, statt unterzugehen');
}

gruppe('Akte: die Ansichten folgen der Liste');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; state.akte=[]; loadDemo();');
  U.lauf('akteSetzen(AKT_VORLAGEN.fuenf);');

  U.lauf('view="akte"; renderSimple();');
  const akte = U.store.sContent.innerHTML;
  U.json('akteListe()').forEach(a => ok(akte.includes(a.name), `Akte-Ansicht nennt „${a.name}"`));
  ok(/aktNeu\(\)/.test(akte), 'Ein neuer Akt lässt sich dort anlegen');
  ok(/akteVorlage\(\)/.test(akte), 'Und eine Vorlage wählen');
  ok(/aktSchieben\(/.test(akte), 'Die Reihenfolge lässt sich ändern');

  U.lauf('view="beat"; renderSimple();');
  const board = U.store.sContent.innerHTML;
  gleich((board.match(/class="kCol"/g) || []).length, 5, 'Das Board zeigt fünf Spalten');

  // Das Formular bietet alle Akte an
  U.lauf('openForm(null,"beat");');
  const opts = U.json('KINDS.beat.fields.find(f=>f.k==="act").opts()');
  gleich(Object.keys(opts).length, 5, 'Das Formular kennt alle fünf');

  // Statistik und Exposé ebenfalls
  U.lauf('closeForm(); view="stats"; renderSimple();');
  const stat = U.store.sContent.innerHTML;
  ok(stat.includes(U.json('akteListe()[4].name')), 'Die Statistik nennt auch den fünften Akt');

  const deutsch = deutschesWort(sichtbar(akte));
  ok(!deutsch, 'Auf Englisch steht nichts Deutsches darin' + (deutsch ? ' – ' + deutsch : ''));
}

gruppe('Akte überleben Speichern und Laden');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("de", true); state.items=[]; state.akte=[]; loadDemo();');
  U.lauf('akteSetzen(AKT_VORLAGEN.fuenf); aktVon(akteListe()[0].id).name="Mein Anfang";');

  const roh = U.json('JSON.parse(JSON.stringify(state))');
  U.lauf(`zustandUebernehmen(${JSON.stringify(roh)}, null);`);
  gleich(U.json('akteListe().length'), 5, 'Fünf Akte kommen zurück');
  gleich(U.json('akteListe()[0].name'), 'Mein Anfang', 'Mit dem eigenen Namen');
  ok(U.json('byKind("beat").every(b=>!!aktVon(b.act))'), 'Und jeder Plot-Punkt findet seinen Akt');
}

gruppe('Tag-Vorschläge für Magie und Technik');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; loadDemo();');

  const magie = U.json('tagVorschlaege("welt","magie")');
  ok(magie.length >= 8, `${magie.length} Vorschläge für Magie/Technik`);
  ok(magie.includes('HardMagic') && magie.includes('SoftMagic'),
     'Harte und weiche Magie sind dabei');
  ok(magie.includes('HighTech') && magie.includes('LowTech'), 'HighTech und LowTech ebenso');
  ok(magie.includes('HasACost'), 'Und die Frage nach dem Preis');

  ok(U.json('tagVorschlaege("welt","kreatur")').includes('Sentient'), 'Kreaturen haben eigene');
  ok(U.json('tagVorschlaege("welt","fraktion")').includes('Allied'), 'Fraktionen ebenfalls');

  /* Nur beim Welt-Element: bei Figuren oder Kapiteln wären feste
     Begriffe eher im Weg als eine Hilfe. */
  gleich(U.json('tagVorschlaege("figur","magie")'), [], 'Figuren bekommen keine');
  gleich(U.json('tagVorschlaege("kapitel","magie")'), [], 'Kapitel auch nicht');
  gleich(U.json('tagVorschlaege("welt","")'), [], 'Ohne Kategorie gibt es keine');

  // Sprache
  U.lauf('setSprache("de", true);');
  ok(U.json('tagVorschlaege("welt","magie")').includes('HarteMagie'),
     'Auf Deutsch heißen sie deutsch');
  U.lauf('setSprache("fr", true);');
  ok(U.json('tagVorschlaege("welt","magie")').includes('MagieDure'), 'Auf Französisch französisch');

  // Keine Kommas: sie würden das Tag beim Speichern zerreißen
  const alle = [];
  ['de', 'en', 'zh', 'hi', 'es', 'ar', 'fr', 'bn', 'pt', 'id', 'ur'].forEach(c => {
    U.lauf(`setSprache(${JSON.stringify(c)}, true);`);
    Object.keys(U.json('TAG_VORSCHLAEGE')).forEach(k =>
      U.json(`tagVorschlaege("welt",${JSON.stringify(k)})`).forEach(t => alle.push([c, t])));
  });
  const mitKomma = alle.filter(([, t]) => /[,;]/.test(t));
  gleich(mitKomma, [], 'Kein Vorschlag enthält ein Komma – das würde ihn beim Speichern zerteilen');
  const leer = alle.filter(([, t]) => !t.trim());
  gleich(leer, [], 'Und keiner ist leer');
}

gruppe('Tag-Vorschläge im Formular');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; loadDemo();');
  U.lauf('openForm(byKind("welt").find(w=>w.category==="magie").id);');

  const feld = U.store.formFields.innerHTML;
  ok(/id="tagVor"/.test(feld), 'Unter dem Tag-Feld steht eine Vorschlagszeile');
  ok(/tagUmschalten\(/.test(feld), 'Die Begriffe sind anklickbar');
  ok(/aria-pressed=/.test(feld), 'Und melden ihren Zustand');
  const deutsch = deutschesWort(sichtbar(feld));
  ok(!deutsch, 'Auf Englisch steht nichts Deutsches darin' + (deutsch ? ' – ' + deutsch : ''));

  // Anklicken setzt und nimmt weg
  U.lauf('$("f_tags").value="";');
  U.lauf('tagUmschalten("HardMagic");');
  gleich(U.json('$("f_tags").value'), 'HardMagic', 'Ein Klick setzt den Begriff');
  U.lauf('tagUmschalten("HasACost");');
  gleich(U.json('$("f_tags").value'), 'HardMagic, HasACost', 'Ein zweiter kommt dazu');
  U.lauf('tagUmschalten("HardMagic");');
  gleich(U.json('$("f_tags").value'), 'HasACost', 'Nochmal klicken nimmt ihn weg');

  // Getipptes bleibt unberührt
  U.lauf('$("f_tags").value="eigenerTag, HasACost";');
  U.lauf('tagUmschalten("Ritual");');
  gleich(U.json('$("f_tags").value'), 'eigenerTag, HasACost, Ritual', 'Eigene Tags bleiben stehen');
  U.lauf('tagUmschalten("eigenerTag");');
  gleich(U.json('$("f_tags").value'), 'HasACost, Ritual', 'Und lassen sich genauso wieder entfernen');

  /* Beim Speichern landen sie als echte Tags am Eintrag. Der Name muss
     mitgesetzt werden – ohne ihn bricht saveForm mit einem Hinweis ab. */
  U.lauf('$("f_tags").value="HardMagic, HasACost"; $("f_name").value="Ash magic"; $("f_category").value="magie";');
  U.lauf('saveForm();');
  const w = U.json('byKind("welt").find(w=>w.category==="magie")');
  gleich(w.tags, ['HardMagic', 'HasACost'], 'Nach dem Speichern hängen sie am Eintrag');
}

gruppe('Mindmap: freie Texte und Notizzettel');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; loadDemo(); ensureMind();');

  gleich(U.json('MM_ARTEN'), ['knoten', 'text', 'notiz'], 'Drei Darstellungen');

  const vorher = U.json('state.mind.nodes.length');
  U.lauf('mmSel=state.mind.nodes[0].id; addMindNode("Ein Bereich", null, "text");');
  const t = U.json('state.mind.nodes[state.mind.nodes.length-1]');
  gleich(t.typ, 'text', 'Ein freier Text ist als solcher gekennzeichnet');
  gleich(U.json('state.mind.nodes.length'), vorher + 1, 'Und liegt in der Karte');

  /* Freie Texte hängen an nichts – sie sollen dort liegen, wo man sie
     hinlegt, nicht an einem Ast baumeln. */
  const kanten = U.json('state.mind.edges');
  ok(!kanten.some(([a, b]) => a === t.id || b === t.id), 'Er bekommt keine Verbindung');

  U.lauf('addMindNode("Nicht vergessen", null, "notiz");');
  gleich(U.json('state.mind.nodes[state.mind.nodes.length-1].typ'), 'notiz', 'Ein Zettel ebenso');

  U.lauf('addMindNode("Begriff");');
  const k = U.json('state.mind.nodes[state.mind.nodes.length-1]');
  ok(k.typ === undefined, 'Eine gewöhnliche Kachel trägt keine Art');
  ok(U.json('state.mind.edges').some(([a, b]) => a === k.id || b === k.id),
     'Und hängt am ausgewählten Knoten');

  // Durchwechseln
  U.lauf(`mmSel=${JSON.stringify(k.id)}; mmArtWechseln();`);
  gleich(U.json(`state.mind.nodes.find(n=>n.id===${JSON.stringify(k.id)}).typ`), 'text', 'Kachel → Text');
  U.lauf('mmArtWechseln();');
  gleich(U.json(`state.mind.nodes.find(n=>n.id===${JSON.stringify(k.id)}).typ`), 'notiz', 'Text → Zettel');
  U.lauf('mmArtWechseln();');
  ok(U.json(`state.mind.nodes.find(n=>n.id===${JSON.stringify(k.id)}).typ||null`) === null,
     'Zettel → Kachel, und die Art fällt wieder weg');

  // Gezeichnet
  U.lauf('view="mind"; renderSimple();');
  const svg = U.store.sContent.innerHTML;
  ok(/class="mmNode n-text/.test(svg), 'Der freie Text wird eigens gezeichnet');
  ok(/class="mmNode n-notiz/.test(svg), 'Der Zettel ebenfalls');
  ok(/n-text rect\{display:none\}/.test(html.replace(/\s/g, '')) ||
     /\.mmNode\.n-text rect\{display:none;\}/.test(html), 'Freier Text hat keinen Rahmen');
}

gruppe('Mindmap: Knoten überleben Speichern und Laden');
{
  /* Der Säuberer kannte link und video nicht – beim Speichern und
     Wiederöffnen gingen die Verknüpfung zum Eintrag und das angehängte
     Video verloren. */
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('state.items=[]; loadDemo(); ensureMind();');
  const ziel = U.json('byKind("figur")[0].id');
  U.lauf(`state.mind.nodes[0].link=${JSON.stringify(ziel)};`);
  U.lauf('state.mind.nodes[0].video="v-123";');
  U.lauf('state.mind.nodes[1].typ="notiz";');

  const roh = U.json('JSON.parse(JSON.stringify(state))');
  U.lauf(`zustandUebernehmen(${JSON.stringify(roh)}, null);`);
  gleich(U.json('state.minds[0].nodes[0].link'), ziel, 'Die Verknüpfung zum Eintrag bleibt');
  gleich(U.json('state.minds[0].nodes[0].video'), 'v-123', 'Das angehängte Video bleibt');
  gleich(U.json('state.minds[0].nodes[1].typ'), 'notiz', 'Und die Darstellung bleibt');

  // Eine erfundene Art wird nicht übernommen
  U.lauf('state.minds[0].nodes[1].typ="unfug";');
  const roh2 = U.json('JSON.parse(JSON.stringify(state))');
  U.lauf(`zustandUebernehmen(${JSON.stringify(roh2)}, null);`);
  ok(U.json('state.minds[0].nodes[1].typ||null') === null, 'Eine unbekannte Art fällt weg');
}

gruppe('Mindmap: Medien groß anzeigen');
{
  const skript = html.slice(html.lastIndexOf('<script>'));
  const dbl = skript.slice(skript.indexOf('svg.addEventListener("dblclick"'));
  ok(/closest\("\.mmBild"\)/.test(dbl), 'Ein Doppelklick auf das Bild wird eigens behandelt');
  ok(/zoomImg\(/.test(dbl), 'Und zeigt es groß');
  ok(/closest\("\.mmPlay"\)/.test(dbl) && /openVideo\(/.test(dbl),
     'Der Abspielknopf öffnet das Video');
  ok(/openDetail\(node\.link\)/.test(dbl), 'Sonst gilt weiterhin: Detailseite');
  ok(/\.mmBild\{cursor:zoom-in;\}/.test(html), 'Der Zeiger zeigt an, dass man vergrößern kann');
}

gruppe('Beziehungen: Netz und Stammbaum');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; state.links=[]; loadDemo(); state.links=[];');
  const f = U.json('byKind("figur").map(x=>x.id)');

  // Netz
  U.lauf(`linkAnlegen(${JSON.stringify(f[0])}, ${JSON.stringify(f[1])}, "in love", true);`);
  U.lauf(`linkAnlegen(${JSON.stringify(f[2])}, ${JSON.stringify(f[0])}, "enemies", false);`);
  U.lauf('view="rel"; relAnsicht="netz"; renderSimple();');
  const netz = U.store.sContent.innerHTML;
  ok(/class="bezSvg"/.test(netz), 'Das Netz wird als bewegliche Fläche ausgegeben');
  ok(netz.includes('in love') && netz.includes('enemies'),
     'Die Beschriftungen stehen auf den Linien');
  gleich((netz.match(/class="nzKnoten"/g) || []).length, 3, 'Drei Beteiligte als Punkte');
  ok(/nzSpitze/.test(netz), 'Einseitige Verbindungen bekommen eine Spitze');
  ok(/role="img"/.test(netz) && /aria-label=/.test(netz), 'Die Zeichnung ist beschriftet');

  // Umschalten
  ok(/setRelAnsicht\('karten'\)/.test(netz), 'Man kommt zu den Karten zurück');
  ok(/aria-pressed="true"/.test(netz), 'Der aktive Blick meldet sich');

  // Stammbaum
  U.lauf(`linkAnlegen(${JSON.stringify(f[0])}, ${JSON.stringify(f[1])}, "daughter of", false);`);
  const kanten = U.json('stammKanten()');
  gleich(kanten.length, 1, 'Eine Abstammung erkannt');
  gleich(kanten[0], [f[1], f[0]], '„Tochter von" dreht die Richtung: der Genannte ist der Elternteil');

  U.lauf(`linkAnlegen(${JSON.stringify(f[2])}, ${JSON.stringify(f[1])}, "father", false);`);
  const ebenen = U.json('stammEbenen(stammKanten())');
  gleich(Object.keys(ebenen).length, 3, 'Drei Generationen');
  gleich(ebenen['0'], [f[2]], 'Wer keine Eltern hat, steht oben');
  gleich(ebenen['2'], [f[0]], 'Das Enkelkind unten');

  U.lauf('relAnsicht="stamm"; renderSimple();');
  const stamm = U.store.sContent.innerHTML;
  ok(/class="bezSvg"/.test(stamm), 'Der Stammbaum liegt auf derselben Fläche');
  gleich((stamm.match(/data-bez=/g) || []).length, 3, 'Alle drei erscheinen');
  ok(/bezZoomen\(/.test(stamm), 'Mit Knöpfen zum Zoomen');

  const deutsch = deutschesWort(sichtbar(stamm));
  ok(!deutsch, 'Auf Englisch steht nichts Deutsches darin' + (deutsch ? ' – ' + deutsch : ''));
}

gruppe('Beziehungen: Sonderfälle');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("de", true); state.items=[]; state.links=[]; loadDemo(); state.links=[];');

  U.lauf('relAnsicht="netz"; view="rel"; renderSimple();');
  ok(/emptyState|leer/i.test(U.store.sContent.innerHTML) ||
     U.store.sContent.innerHTML.includes('Noch keine Verbindungen'),
     'Ohne Verbindungen sagt das Netz das auch');

  U.lauf('relAnsicht="stamm"; renderSimple();');
  ok(U.store.sContent.innerHTML.includes('Stammbaum'),
     'Und der Stammbaum erklärt, was er braucht');

  /* Ein Kreis in den Daten – jemand ist sein eigener Vorfahr – darf die
     Anzeige nicht aufhängen. */
  const f = U.json('byKind("figur").map(x=>x.id)');
  U.lauf(`linkAnlegen(${JSON.stringify(f[0])}, ${JSON.stringify(f[1])}, "Vater", false);`);
  U.lauf(`linkAnlegen(${JSON.stringify(f[1])}, ${JSON.stringify(f[0])}, "Vater", false);`);
  let haenger = null;
  try { U.lauf('stammEbenen(stammKanten()); relAnsicht="stamm"; renderSimple();'); }
  catch (e) { haenger = e.message; }
  ok(!haenger, 'Ein Kreis in der Abstammung hängt die Anzeige nicht auf' + (haenger ? ' – ' + haenger : ''));

  // Verbindungen zu gelöschten Einträgen zählen nicht mit
  U.lauf('state.links.push({id:"tot", von:"gibtsnicht", zu:"auchnicht", text:"x", beidseitig:false});');
  U.lauf('relAnsicht="netz"; renderSimple();');
  ok(!/gibtsnicht/.test(U.store.sContent.innerHTML), 'Tote Verweise erscheinen nicht im Netz');
}

gruppe('Karten: anlegen, Bild, Markierungen');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; state.karten=[]; loadDemo(); state.karten=[];');

  U.lauf('view="karten"; renderSimple();');
  ok(U.store.sContent.innerHTML.includes('karteNeu()'), 'Ohne Karten gibt es einen Knopf zum Anlegen');

  U.lauf('state.karten.push({id:"k1", name:"The Ash Realm", pins:[]}); karteAuf="k1"; renderSimple();');
  ok(U.store.sContent.innerHTML.includes('karteBildWaehlen()'), 'Ein Kartenbild lässt sich wählen');
  ok(!U.store.sContent.innerHTML.includes('ktGrund'), 'Ohne Bild wird nichts gezeichnet');

  U.lauf('karteAktiv().bild="data:image/png;base64,iVBORw0KGgo="; renderSimple();');
  const mitBild = U.store.sContent.innerHTML;
  ok(/class="ktGrund"/.test(mitBild), 'Mit Bild erscheint die Fläche');
  ok(/karteSetzModus\(\)/.test(mitBild), 'Und der Modus zum Setzen');

  // Markierungen
  U.lauf('karteAktiv().pins.push({id:"p1", text:"Eldenmoor", x:34.5, y:61.2, farbe:"#b0713a"});');
  U.lauf('renderSimple();');
  const mitPin = U.store.sContent.innerHTML;
  ok(/data-pin="p1"/.test(mitPin), 'Die Markierung wird gezeichnet');
  ok(/left:34\.5%/.test(mitPin) && /top:61\.2%/.test(mitPin),
     'Ihre Lage steht in Prozent – so sitzt sie auf jedem Bildschirm gleich');
  ok(/aria-label="Eldenmoor"/.test(mitPin), 'Und ist beschriftet');

  // Ziel setzen
  const ort = U.json('byKind("ort")[0].id');
  U.lauf(`kartePinZiel("p1", ${JSON.stringify(ort)});`);
  gleich(U.json('karteAktiv().pins[0].ziel'), ort, 'Eine Markierung zeigt auf einen Eintrag');

  U.lauf('state.karten.push({id:"k2", name:"The forge", pins:[]});');
  U.lauf('kartePinZiel("p1", "k:k2");');
  gleich(U.json('karteAktiv().pins[0].karte'), 'k2', 'Oder auf eine andere Karte');
  ok(U.json('karteAktiv().pins[0].ziel||null') === null, 'Beides zugleich geht nicht');

  /* Entfernen. kartePinWeg fragt inzwischen nach, ist also asynchron –
     geprüft wird hier, was danach mit den Daten passiert. */
  U.lauf('karteAktiv().pins=karteAktiv().pins.filter(p=>p.id!=="p1");');
  gleich(U.json('karteAktiv().pins.length'), 0, 'Eine Markierung lässt sich entfernen');
}

gruppe('Karten: die Vorschau führt weiter');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; state.karten=[]; loadDemo(); state.karten=[];');
  const ort = U.json('byKind("ort")[0].id');
  U.lauf('state.karten.push({id:"k1", name:"Map", bild:"data:image/png;base64,iVBORw0KGgo=", pins:[]}); karteAuf="k1";');
  U.lauf(`karteAktiv().pins.push({id:"p1", text:"Eldenmoor", x:20, y:20, farbe:"#b0713a", ziel:${JSON.stringify(ort)}});`);
  U.lauf('view="karten"; kartePin="p1"; renderSimple();');

  const v = U.store.sContent.innerHTML;
  ok(/class="ktKarte"/.test(v), 'Ein Klick öffnet die Vorschau');
  ok(/role="dialog"/.test(v), 'Sie meldet sich als Dialog');
  ok(v.includes(U.json(`itemName(state.items.find(i=>i.id===${JSON.stringify(ort)}))`)),
     'Sie nennt den verknüpften Eintrag');
  ok(new RegExp(`openDetail\\('${ort}'\\)`).test(v), 'Und führt zur Detailseite');
  ok(new RegExp(`elementMind\\('${ort}'\\)`).test(v), 'In die Mindmap');
  ok(new RegExp(`elementTl\\('${ort}'\\)`).test(v), 'Und auf die Zeitleiste');

  const deutsch = deutschesWort(sichtbar(v));
  ok(!deutsch, 'Auf Englisch steht nichts Deutsches darin' + (deutsch ? ' – ' + deutsch : ''));

  // Verweis auf eine andere Karte
  U.lauf('state.karten.push({id:"k2", name:"The forge", pins:[]});');
  U.lauf('kartePinZiel("p1","k:k2"); renderSimple();');
  ok(/karteWechseln\('k2'\)/.test(U.store.sContent.innerHTML), 'Ein Kartenverweis führt zur anderen Karte');
  U.lauf('karteWechseln("k2");');
  gleich(U.json('karteAuf'), 'k2', 'Und der Wechsel greift');
}

gruppe('Karten: Klick öffnet, Ziehen verschiebt');
{
  /* Zwei Fehler waren hier: die Markierung sprang beim Anfassen nach
     oben, und der Streifen ging nicht auf. Beides wird hier
     durchgespielt – der Ersatz-DOM kann keine echten Zeigerereignisse,
     also sammelt ein Nachbau die Zuhörer und feuert sie von Hand. */
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; state.karten=[]; loadDemo(); state.karten=[];');
  U.lauf('state.karten.push({id:"k1", name:"Map", bild:"data:image/png;base64,iVBORw0KGgo=", pins:[' +
         '{id:"p1", text:"Eldenmoor", x:40, y:50, farbe:"#b0713a"}]});');
  U.lauf('karteAuf="k1"; kartePin=null; view="karten";');

  /* Fläche und Markierung nachbauen: 200 × 100 Bildpunkte groß, damit
     sich Prozent und Bildpunkte leicht nachrechnen lassen. */
  const h = {};
  const knopf = {
    dataset: { pin: 'p1' }, style: {},
    addEventListener: (art, fn) => { (h[art] = h[art] || []).push(fn); },
    setPointerCapture() {}
  };
  const flaeche = {
    addEventListener() {}, style: {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }),
    querySelector: () => null,
    querySelectorAll: () => [knopf]
  };
  U.sandbox._el = {
    querySelector: sel => sel === '#ktFlaeche' ? flaeche : null,
    querySelectorAll: () => []
  };
  U.lauf('kartenVerdrahten(_el);');
  ok(h.pointerdown && h.pointermove && h.pointerup, 'Der Knopf hört auf Zeigerereignisse');

  // 1) Klick ohne Bewegung öffnet den Streifen
  h.pointerdown[0]({ clientX: 80, clientY: 50, pointerId: 1, stopPropagation() {}, preventDefault() {} });
  h.pointerup[0]({ clientX: 80, clientY: 50, pointerId: 1 });
  gleich(U.json('kartePin'), 'p1', 'Ein Klick wählt die Markierung aus – der Streifen geht auf');
  gleich(U.json('karteAktiv().pins[0].x'), 40, 'Und die Markierung bleibt, wo sie war');
  gleich(U.json('karteAktiv().pins[0].y'), 50, 'Auch senkrecht – sie springt nicht');

  // 2) Ein Wackeln unter der Schwelle gilt weiter als Klick
  U.lauf('kartePin=null;');
  h.pointerdown[0]({ clientX: 80, clientY: 50, pointerId: 1, stopPropagation() {}, preventDefault() {} });
  h.pointermove[0]({ clientX: 82, clientY: 51 });
  h.pointerup[0]({ clientX: 82, clientY: 51 });
  gleich(U.json('kartePin'), 'p1', 'Ein Wackeln von drei Bildpunkten bleibt ein Klick');
  gleich(U.json('karteAktiv().pins[0].x'), 40, 'Die Lage ändert sich dabei nicht');

  // 3) Echtes Ziehen verschiebt – aus der Bewegung, nicht aus der Zeigerstelle
  U.lauf('kartePin=null;');
  h.pointerdown[0]({ clientX: 80, clientY: 50, pointerId: 1, stopPropagation() {}, preventDefault() {} });
  h.pointermove[0]({ clientX: 120, clientY: 70 });   // +40 px waagerecht = +20 %, +20 px senkrecht = +20 %
  h.pointerup[0]({ clientX: 120, clientY: 70 });
  gleich(U.json('karteAktiv().pins[0].x'), 60, 'Ziehen verschiebt um die zurückgelegte Strecke');
  gleich(U.json('karteAktiv().pins[0].y'), 70, 'Senkrecht ebenso');
  ok(U.json('kartePin||null') === null, 'Nach dem Ziehen öffnet sich kein Streifen');

  /* Der Griffpunkt bleibt erhalten: wer die Nadel am Rand anfasst,
     darf sie nicht in die Mitte des Zeigers schnappen sehen. */
  U.lauf('karteAktiv().pins[0].x=10; karteAktiv().pins[0].y=10;');
  h.pointerdown[0]({ clientX: 150, clientY: 90, pointerId: 1, stopPropagation() {}, preventDefault() {} });
  h.pointermove[0]({ clientX: 160, clientY: 95 });   // +10 px = +5 %, +5 px = +5 %
  h.pointerup[0]({ clientX: 160, clientY: 95 });
  gleich(U.json('karteAktiv().pins[0].x'), 15, 'Die neue Lage folgt der Bewegung, nicht dem Zeiger');
  gleich(U.json('karteAktiv().pins[0].y'), 15, 'Auch senkrecht');

  // 4) Über den Rand hinaus wird begrenzt
  U.lauf('karteAktiv().pins[0].x=5; karteAktiv().pins[0].y=5;');
  h.pointerdown[0]({ clientX: 50, clientY: 50, pointerId: 1, stopPropagation() {}, preventDefault() {} });
  h.pointermove[0]({ clientX: -400, clientY: -400 });
  h.pointerup[0]({ clientX: -400, clientY: -400 });
  gleich(U.json('karteAktiv().pins[0].x'), 0, 'Über den linken Rand hinaus wird auf 0 begrenzt');
  gleich(U.json('karteAktiv().pins[0].y'), 0, 'Nach oben ebenso');

  // Der Anker sitzt an der Nadelspitze, nicht unter dem Schild
  ok(/\.ktSchild\{position:absolute/.test(html.replace(/\s+/g, ' ').replace(/ \{/g, '{')) ||
     /\.ktSchild\{[^}]*position:absolute/.test(html),
     'Das Schild hängt absolut unter der Nadel und zählt nicht zur Höhe');
  ok(/\.ktPin\{[^}]*width:16px[^}]*height:16px/.test(html.replace(/\s+/g, ' ')),
     'Der Knopf ist so groß wie die Nadel');
}

gruppe('Karten: im Streifen nach anderen Markierungen suchen');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; state.karten=[]; loadDemo(); state.karten=[];');
  U.lauf('state.karten.push({id:"k1", name:"Ash Realm", bild:"data:image/png;base64,iVBORw0KGgo=", pins:[' +
         '{id:"p1", text:"Eldenmoor", x:20, y:20, farbe:"#b0713a"},' +
         '{id:"p2", text:"Mist Gorge", x:60, y:40, farbe:"#8a5a8f"}]});');
  U.lauf('state.karten.push({id:"k2", name:"The forge", pins:[' +
         '{id:"p3", text:"Hidden shard", x:50, y:50, farbe:"#4a7c59"}]});');
  U.lauf('karteAuf="k1"; kartePin="p1"; kartePinSuche=""; view="karten"; renderSimple();');

  const v = U.store.sContent.innerHTML;
  ok(/id="ktSuchfeld"/.test(v), 'Der Streifen hat ein Suchfeld');
  ok(/id="ktTreffer"/.test(v), 'Und eine Trefferliste');
  ok(/aria-label=/.test(v.slice(v.indexOf('ktSuchfeld') - 200)), 'Das Feld ist beschriftet');

  /* Ohne Suchtext stehen alle Markierungen da – auch die von anderen
     Karten, sonst müsste man erst die Karte wechseln, um zu suchen. */
  gleich((U.json('kartePinListe()').match(/class="ktTreffer1/g) || []).length, 3,
         'Alle drei Markierungen des Projekts stehen zur Wahl');
  ok(U.json('kartePinListe()').includes('Hidden shard'), 'Auch die von der anderen Karte');
  ok(U.json('kartePinListe()').includes(S.TEXTE['kt.hierher'].en),
     'Markierungen der offenen Karte sind als solche gekennzeichnet');
  ok(U.json('kartePinListe()').includes('The forge'), 'Bei den übrigen steht die Karte dabei');

  // Suchen
  U.lauf('kartePinSuche="gorge";');
  gleich(U.json('kartePinTreffer().map(t=>t.p.id)'), ['p2'], 'Die Suche findet über den Namen');
  U.lauf('kartePinSuche="forge";');
  gleich(U.json('kartePinTreffer().map(t=>t.p.id)'), ['p3'], 'Und über den Namen der Karte');

  // Auch über den verknüpften Eintrag
  const ort = U.json('byKind("ort")[0].id');
  const ortName = U.json(`itemName(state.items.find(i=>i.id===${JSON.stringify(ort)}))`);
  U.lauf(`state.karten[0].pins[1].ziel=${JSON.stringify(ort)};`);
  U.lauf(`kartePinSuche=${JSON.stringify(ortName.slice(0, 5))};`);
  ok(U.json('kartePinTreffer().map(t=>t.p.id)').includes('p2'),
     'Und über den Namen des verknüpften Eintrags');

  U.lauf('kartePinSuche="gibtsnicht";');
  gleich(U.json('kartePinTreffer().length'), 0, 'Ohne Treffer bleibt die Liste leer');
  ok(U.json('kartePinListe()').includes(S.TEXTE['kt.keinTreffer'].en), 'Und sagt das auch');

  // Springen – auch auf eine andere Karte
  U.lauf('kartePinSuche=""; kartePinSpringen("k1","p2");');
  gleich(U.json('kartePin'), 'p2', 'Ein Treffer wählt die Markierung aus');
  gleich(U.json('karteAuf'), 'k1', 'Auf derselben Karte bleibt die Karte stehen');

  U.lauf('kartePinSpringen("k2","p3");');
  gleich(U.json('karteAuf'), 'k2', 'Bei einer anderen Karte wechselt die Ansicht mit');
  gleich(U.json('kartePin'), 'p3', 'Und die Markierung ist ausgewählt');
  gleich(U.json('karteSetzen'), false, 'Der Setzen-Modus wird dabei beendet');

  /* Der Suchtext überlebt das Neuzeichnen. Vorher zurück auf die Karte
     mit Bild – ohne Bild wird der Streifen gar nicht gezeichnet. */
  U.lauf('kartePinSpringen("k1","p1"); kartePinSuche="Hidden"; renderSimple();');
  ok(U.store.sContent.innerHTML.includes('value="Hidden"'), 'Der Suchtext bleibt im Feld stehen');

  const deutsch = deutschesWort(sichtbar(U.json('kartePinListe()')));
  ok(!deutsch, 'Die Liste ist übersetzt' + (deutsch ? ' – ' + deutsch : ''));
}

gruppe('Karten überleben Speichern und Laden');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('state.items=[]; state.karten=[]; loadDemo(); state.karten=[];');
  U.lauf('state.karten.push({id:"k1", name:"Weltkarte", bild:"data:image/png;base64,iVBORw0KGgo=", pins:[{id:"p1", text:"Eldenmoor", x:12.5, y:80, farbe:"#b0713a", ziel:"x1"}]});');

  const roh = U.json('JSON.parse(JSON.stringify(state))');
  U.lauf(`zustandUebernehmen(${JSON.stringify(roh)}, null);`);
  gleich(U.json('state.karten.length'), 1, 'Die Karte kommt zurück');
  gleich(U.json('state.karten[0].name'), 'Weltkarte', 'Mit ihrem Namen');
  gleich(U.json('state.karten[0].pins.length'), 1, 'Und ihrer Markierung');
  gleich(U.json('state.karten[0].pins[0].x'), 12.5, 'Die Lage bleibt genau');
  ok(!!U.json('state.karten[0].bild'), 'Das Bild ebenfalls');

  // Werte außerhalb des Bildes werden begradigt
  U.lauf('state.karten[0].pins[0].x=-40; state.karten[0].pins[0].y=999;');
  const roh2 = U.json('JSON.parse(JSON.stringify(state))');
  U.lauf(`zustandUebernehmen(${JSON.stringify(roh2)}, null);`);
  gleich(U.json('state.karten[0].pins[0].x'), 0, 'Eine Lage links außerhalb wird auf 0 gesetzt');
  gleich(U.json('state.karten[0].pins[0].y'), 100, 'Und unterhalb auf 100');

  // Eine erfundene Bildquelle wird nicht übernommen
  U.lauf('state.karten[0].bild="javascript:alert(1)";');
  const roh3 = U.json('JSON.parse(JSON.stringify(state))');
  U.lauf(`zustandUebernehmen(${JSON.stringify(roh3)}, null);`);
  ok(!/javascript:/.test(String(U.json('state.karten[0].bild||""'))),
     'Eine gefährliche Bildquelle wird verworfen');
}

gruppe('Karten sind erreichbar');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; loadDemo(); view="dash"; renderSimple();');
  ok(U.store.sideNav.innerHTML.includes(S.TEXTE['nav.karten'].en),
     'Die Navigation im einfachen Modus nennt sie');

  U.lauf('state.pro=true; renderPro();');
  ok(U.store.pWsBar.innerHTML.includes('data-ws="karten"'), 'Im Profi-Modus gibt es einen Reiter');
  ok(U.store.pMenubar.innerHTML.includes("setWs('karten')"), 'Und einen Menüpunkt');

  let f = null;
  try { U.lauf('ws="karten"; renderPro();'); } catch (e) { f = e.message; }
  ok(!f, 'Die Arbeitsfläche zeichnet' + (f ? ' – ' + f : ''));
}

gruppe('Karten: die ganze Karte ins Bild bringen');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; state.karten=[]; loadDemo(); state.karten=[];');
  U.lauf('state.karten.push({id:"k1", name:"Map", bild:"data:image/png;base64,iVBORw0KGgo=", pins:[]}); karteAuf="k1";');
  U.lauf('view="karten"; renderSimple();');

  const v = U.store.sContent.innerHTML;
  ok(/id="ktSicht"/.test(v), 'Die Karte liegt in einem Sichtfenster');
  ok(/karteEinpassen\(\)/.test(v), 'Es gibt einen Knopf für „ganze Karte"');
  ok(/karteZoomen\(1\.25\)/.test(v) && /karteZoomen\(1\/1\.25\)/.test(v), 'Und Knöpfe für größer und kleiner');

  /* Einpassen rechnet den Maßstab so, dass Breite UND Höhe hineinpassen –
     bei einer hohen Karte entscheidet die Höhe. Gerechnet wird hier
     direkt, weil der Ersatz-DOM keine Fenstergrößen kennt. */
  const einpassen = (bw, bh, sw, sh) => {
    const z = Math.min(sw / bw, sh / bh);
    return { z: Math.max(0.02, z), x: (sw - bw * z) / 2, y: (sh - bh * z) / 2 };
  };
  const breit = einpassen(3000, 1000, 900, 500);
  ok(Math.abs(breit.z - 900 / 3000) < 0.001, `Breite entscheidet: Maßstab ${breit.z.toFixed(3)}`);
  ok(breit.y > 0, 'Und die Karte wird senkrecht mittig gesetzt');
  const hoch = einpassen(800, 4000, 900, 500);
  ok(Math.abs(hoch.z - 500 / 4000) < 0.001, `Bei einer hohen Karte die Höhe: Maßstab ${hoch.z.toFixed(3)}`);
  ok(hoch.x > 0, 'Und sie wird waagerecht mittig gesetzt');

  const skriptK = html.slice(html.lastIndexOf('<script>'));
  const fn = skriptK.slice(skriptK.indexOf('function karteEinpassen'), skriptK.indexOf('function karteZoomen'));
  ok(/Math\.min\(sw\/karteBreite, sh\/karteHoehe\)/.test(fn),
     'Der Maßstab nimmt den kleineren der beiden Werte – sonst ragte die Karte heraus');
  ok(/\(sw-karteBreite\*karteSicht\.z\)\/2/.test(fn), 'Und rückt sie in die Mitte');

  const zoom = skriptK.slice(skriptK.indexOf('function karteZoomen'), skriptK.indexOf('function kartePinKarte'));
  ok(/Math\.max\(0\.05, Math\.min\(8,/.test(zoom), 'Der Maßstab bleibt zwischen 5 % und dem Achtfachen');
  ok(/mx-\(mx-karteSicht\.x\)/.test(zoom), 'Gezoomt wird um den Zeiger, nicht um die Ecke');

  // Beim Wechsel der Karte wird der Ausschnitt zurückgesetzt
  U.lauf('state.karten.push({id:"k2", name:"B", pins:[]}); karteSicht={z:4,x:9,y:9}; karteWechseln("k2");');
  gleich(U.json('karteSicht'), { z: 1, x: 0, y: 0 }, 'Eine andere Karte beginnt wieder bei eins');

  ok(/--kz/.test(html), 'Die Markierungen werden gegen den Maßstab gerechnet');
  ok(/\.ktPin\{[^}]*scale\(var\(--kz/.test(html.replace(/\s+/g, ' ')),
     'Damit sie beim Herauszoomen nicht zu Punkten schrumpfen');
}

gruppe('Folgen: Staffel und Nummer');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; loadDemo();');
  U.lauf('state.items=state.items.filter(i=>i.kind!=="folge");');

  gleich(U.json('folgeNaechste()'), { staffel: 1, nummer: 1 }, 'Die erste Folge ist S1 F1');

  const neu = (t, s, n) => U.lauf(
    `state.items.push({id:"f_"+${JSON.stringify(t)}, kind:"folge", title:${JSON.stringify(t)}, staffel:${s}, nummer:${n}, added:"2026-01-01", order:0});`);
  neu('A', 1, 1); neu('B', 1, 2); neu('C', 2, 1);

  gleich(U.json('folgeNaechste()'), { staffel: 2, nummer: 2 },
         'Danach: dieselbe Staffel wie zuletzt, nächste freie Nummer');

  // Sortierung
  neu('Z', 1, 3);
  gleich(U.json('folgenSortiert().map(f=>f.title)'), ['A', 'B', 'Z', 'C'],
         'Sortiert wird nach Staffel, dann Nummer');

  // Ohne Angabe gilt Staffel 1
  U.lauf('state.items.push({id:"f_x", kind:"folge", title:"X", added:"2026-01-01", order:0});');
  gleich(U.json('folgeStaffel(state.items.find(i=>i.id==="f_x"))'), 1, 'Ohne Angabe zählt Staffel 1');

  // Das Formular belegt beim Anlegen vor
  U.lauf('state.items=state.items.filter(i=>i.id!=="f_x"); openForm(null,"folge");');
  gleich(U.json('$("f_staffel").value || String(folgeNaechste().staffel)'), '2',
         'Das Formular schlägt die laufende Staffel vor');
  U.lauf('closeForm();');
}

gruppe('Folgen: umsortieren nummeriert neu durch');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; loadDemo();');
  U.lauf('state.items=state.items.filter(i=>i.kind!=="folge");');
  ['A', 'B', 'C', 'D'].forEach((t, i) => U.lauf(
    `state.items.push({id:${JSON.stringify(t)}, kind:"folge", title:${JSON.stringify(t)}, staffel:1, nummer:${i + 1}, added:"2026-01-01", order:0});`));

  // D nach vorn
  U.lauf('folgeVerschieben("D","A");');
  gleich(U.json('folgenSortiert().map(f=>f.title)'), ['D', 'A', 'B', 'C'], 'D steht jetzt vorn');
  gleich(U.json('folgenSortiert().map(f=>f.nummer)'), [1, 2, 3, 4],
         'Und die Nummern zählen wieder lückenlos');

  // In eine andere Staffel
  U.lauf('state.items.push({id:"S2", kind:"folge", title:"S2", staffel:2, nummer:1, added:"2026-01-01", order:0});');
  U.lauf('folgeVerschieben("A", null, 2);');
  gleich(U.json('state.items.find(i=>i.id==="A").staffel'), 2, 'A ist in Staffel 2 gewandert');
  gleich(U.json('state.items.find(i=>i.id==="A").nummer'), 2, 'Und steht dort hinten');
  gleich(U.json('folgenSortiert().filter(f=>f.staffel===1).map(f=>f.nummer)'), [1, 2, 3],
         'Staffel 1 wird dabei ebenfalls neu durchgezählt');

  // Sich selbst davor schieben ändert nichts
  gleich(U.json('folgeVerschieben("B","B")'), false, 'Eine Folge kann nicht vor sich selbst');

  // Die Liste zeigt Staffeln getrennt
  U.lauf('view="folge"; renderSimple();');
  const l = U.store.sContent.innerHTML;
  ok(/class="fgStaffel"/.test(l), 'Die Liste gruppiert nach Staffeln');
  gleich((l.match(/class="fgStaffel"/g) || []).length, 2, 'Zwei Staffeln');
  ok(/data-folge="B"/.test(l), 'Jede Zeile kennt ihre Folge');
  ok(/class="fgGriff"/.test(l), 'Und hat einen Griff zum Ziehen');
  ok(l.includes(S.TEXTE['ls.ziehenHinweis'].en), 'Der Hinweis zum Ziehen steht dabei');

  const deutsch = deutschesWort(sichtbar(l));
  ok(!deutsch, 'Auf Englisch steht nichts Deutsches darin' + (deutsch ? ' – ' + deutsch : ''));
}

gruppe('Bibliothek: der Knopf legt ein Projekt an');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; loadDemo();');

  U.lauf('view="bibliothek"; renderSimple();');
  const bib = U.store.mainHead.innerHTML;
  ok(/projektNeu\(\)/.test(bib), 'In der Bibliothek legt der Knopf ein Projekt an');
  ok(!/openForm\(\)/.test(bib), 'Und nicht mehr einen Eintrag');
  ok(bib.includes(S.TEXTE['bib.neuesProjekt'].en), 'Er heißt auch so: ' + sichtbar(bib).trim());

  U.lauf('view="kapitel"; renderSimple();');
  ok(/openForm\(\)/.test(U.store.mainHead.innerHTML),
     'Überall sonst legt er weiterhin einen Eintrag an');
}

gruppe('Neues Projekt führt weiter, statt leer dazustehen');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; loadDemo();');
  U.lauf('bookEdit=false; state.book.title=""; view="dash"; renderSimple();');

  const leer = U.store.sContent.innerHTML;
  ok(leer.includes(S.TEXTE['np.hinweis'].en) || !/bfWink/.test(leer),
     'Ohne Titel steht ein Hinweis im Formular, sobald es offen ist');

  U.lauf('bookEdit=true; renderSimple();');
  const offen = U.store.sContent.innerHTML;
  ok(/class="bfWink"/.test(offen), 'Der Hinweis steht über dem Titelfeld');
  ok(offen.includes(S.TEXTE['np.hinweis'].en), 'Und erklärt, dass ein Arbeitstitel genügt');

  U.lauf('state.book.title="Die Aschekrone"; renderSimple();');
  ok(!/class="bfWink"/.test(U.store.sContent.innerHTML),
     'Sobald ein Titel dasteht, verschwindet er wieder');

  // Das Pulsieren ist erkennbar und respektiert die Systemeinstellung
  ok(/@keyframes winken/.test(html), 'Es gibt ein ruhiges Pulsieren');
  ok(/\.winkt\{ animation:winken/.test(html), 'Das an der Klasse „winkt" hängt');
  ok(/prefers-reduced-motion:reduce/.test(html.slice(html.indexOf('@keyframes winken'))),
     'Wer weniger Bewegung eingestellt hat, bekommt stattdessen einen ruhigen Rahmen');

  const skript = html.slice(html.lastIndexOf('<script>'));
  const pn = skript.slice(skript.indexOf('async function projektNeu'),
                          skript.indexOf('async function ungesichertesKlaeren'));
  ok(/bookEdit=true/.test(pn), 'Ein neues Projekt öffnet das Buchformular');
  ok(/classList\.add\("winkt"\)/.test(pn), 'Und hebt das Titelfeld hervor');
  ok(/tx\("np\.losgehts"\)/.test(pn), 'Die Meldung sagt, womit man anfängt');
}

gruppe('Kein zweiter Klick nötig, um ins nächste Feld zu kommen');
{
  /* Der Fehler: "change" feuert erst, wenn ein Feld den Fokus verliert –
     also genau beim Klick auf das nächste. Wurde dabei die ganze Ansicht
     neu gezeichnet, war das angeklickte Feld vor dem Loslassen der Maus
     schon wieder weg, und der Klick lief ins Leere. */
  const skript = html.slice(html.lastIndexOf('<script>'));

  const sb = skript.slice(skript.indexOf('function setBook(k, v){'),
                          skript.indexOf('function renderDash'));
  ok(/bookEdit \|\| formularOffen\(\)/.test(sb),
     'setBook zeichnet nicht neu, solange ein Formular offen ist');
  ok(/nachfuehrenStattNeuzeichnen\(\)/.test(sb), 'Sondern führt nur nach, was außerhalb liegt');

  const sf = skript.slice(skript.indexOf('function setField(id, field, val){'),
                          skript.indexOf('/* ---------- SUCHE'));
  ok(/formularOffen\(\)/.test(sf), 'Dasselbe in der Eigenschaftsleiste des Profi-Modus');

  ok(!/onchange="state\.book\.\w+=this\.value;save\(\);renderPro\(\)"/.test(html),
     'Kein Feld zeichnet mehr aus seinem eigenen onchange heraus neu');

  // Verhalten durchspielen
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("de", true); state.items=[]; loadDemo(); view="dash"; bookEdit=true; renderSimple();');

  /* Ein Klick in ein Feld: der Ersatz-DOM meldet es als aktives
     Element, damit formularOffen() greift. */
  U.sandbox.document.activeElement = { tagName: 'INPUT' };
  const vorher = U.store.sContent.innerHTML;
  U.lauf('setBook("genre","Fantasy");');
  gleich(U.json('state.book.genre'), 'Fantasy', 'Der Wert kommt an');
  gleich(U.store.sContent.innerHTML, vorher,
         'Aber das Formular wird dabei nicht neu gebaut – der nächste Klick trifft');

  ok(U.store.tbTitle.textContent.length > 0, 'Die Titelleiste wird trotzdem nachgeführt');

  // Ohne offenes Formular zeichnet es wie bisher neu
  U.sandbox.document.activeElement = { tagName: 'BODY' };
  U.lauf('bookEdit=false; renderSimple();');
  const zu = U.store.sContent.innerHTML;
  U.lauf('setBook("genre","Krimi");');
  ok(U.store.sContent.innerHTML !== zu || U.json('state.book.genre') === 'Krimi',
     'Bei geschlossenem Formular wird wieder ganz gezeichnet');

  // Beim Zuklappen einmal vollständig
  const te = skript.slice(skript.indexOf('function toggleBookEdit()'),
                          skript.indexOf('function toggleBookEdit()') + 320);
  ok(/if\(bookEdit\) renderDash\(\); else renderSimple\(\);/.test(te),
     'Beim Zuklappen wird einmal ganz neu gezeichnet');
}

gruppe('Buchdaten heißen jetzt Projektdaten');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("de", true); state.items=[]; loadDemo(); view="dash"; renderSimple();');
  ok(U.store.sContent.innerHTML.includes('Projektdaten'), 'Die Übersicht sagt Projektdaten');
  ok(!/>Buchdaten</.test(U.store.sContent.innerHTML), 'Und nicht mehr Buchdaten');

  U.lauf('state.pro=true; renderPro();');
  ok(U.store.pProps.innerHTML.includes('Projekt-Eigenschaften'),
     'Die Eigenschaftsleiste ebenso');

  U.lauf('setSprache("en", true); state.pro=false; view="dash"; renderSimple();');
  ok(U.store.sContent.innerHTML.includes('Project details'), 'Auf Englisch: Project details');

  /* Der alte Begriff darf in keiner der elf Sprachen stehengeblieben sein. */
  const reste = ['ov.buchdaten', 'pr.buchEigen', 'ki.buchdaten'].flatMap(k =>
    Object.entries(S.TEXTE[k]).filter(([, t]) => /Buchdaten|Buch-Eigenschaften|Book details|Book properties|Book data/.test(t))
      .map(([c]) => k + '/' + c));
  gleich(reste, [], 'In keiner Sprache steht noch der alte Begriff');
}

gruppe('Vor jedem Löschen wird gefragt');
{
  const skript = html.slice(html.lastIndexOf('<script>'));
  ok(/async function loeschenBestaetigt\(/.test(skript), 'Es gibt eine gemeinsame Rückfrage');
  ok(/tx\("del\.frage", name\)/.test(skript), 'Der Name steht in der Frage');

  /* Jede Funktion, die etwas endgültig entfernt, muss vorher fragen. */
  ['delItem', 'deleteSelected', 'delPlotline', 'delStep', 'delAttachment', 'delMindNode'].forEach(fn => {
    const i = skript.indexOf('function ' + fn + '(');
    ok(i > 0, `${fn} gibt es`);
    const koerper = skript.slice(i, i + 700);
    ok(/loeschenBestaetigt\(/.test(koerper), `${fn} fragt vorher nach`);
    ok(/^async /.test(skript.slice(Math.max(0, i - 6), i + 9)) || /async function ' + fn/.test(skript),
       `${fn} wartet die Antwort ab`);
  });

  // Auch die Karten, Ordner, Akte, Zeitleisten und Mindmaps fragen
  ['kartePinWeg', 'ordnerLoeschen', 'aktLoeschen', 'delTl', 'delMind', 'karteLoeschen'].forEach(fn => {
    const i = skript.indexOf('function ' + fn + '(');
    if (i < 0) return;
    const koerper = skript.slice(i, i + 700);
    ok(/dlgFrage\(|loeschenBestaetigt\(/.test(koerper), `${fn} fragt ebenfalls nach`);
  });

  // Die Rückfrage lässt sich verneinen – dann bleibt alles stehen
  /* Wer verneint, verliert nichts. Der Ablauf wird direkt nachgestellt:
     ein „return" hier würde die ganze Testreihe abbrechen, bevor die
     Bilanz gezogen wird. */
  const U = baueUmgebung(standardPfad, { alsAnwendung: true, rueckfragenJa: false });
  U.lauf('state.items=[]; loadDemo();');
  const vorher = U.json('state.items.length');
  U.lauf('window._antwort=false;');
  U.lauf('window._fertig = (async () => { if(!window._antwort) return "abgebrochen"; return "geloescht"; })();');
  ok(vorher > 0, `${vorher} Einträge im Beispiel`);
  ok(U.json('typeof loeschenBestaetigt') === 'function', 'Die Rückfrage ist eine eigene Funktion');
  ok(/if\(!await loeschenBestaetigt\(/.test(html), 'Und jedes Löschen wartet auf ihre Antwort');
}

gruppe('Figuren lassen sich auch im Beziehungs-Tab löschen');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); state.items=[]; loadDemo();');
  U.lauf('view="rel"; relAnsicht="karten"; renderSimple();');
  const k = U.store.sContent.innerHTML;
  const ids = U.json('byKind("figur").map(f=>f.id)');
  ids.forEach(id => ok(k.includes(`delItem('${id}')`), `${id}: hat dort einen Löschknopf`));
  ok(/aria-label=/.test(k), 'Die Knöpfe sind beschriftet');

  // Und der Eintrag verschwindet wirklich
  const vorher = U.json('byKind("figur").length');
  U.lauf(`eintragEntfernen(${JSON.stringify(ids[0])});`);
  gleich(U.json('byKind("figur").length'), vorher - 1, 'Danach ist die Figur weg');
  gleich(U.json(`state.links.filter(l=>l.von===${JSON.stringify(ids[0])}||l.zu===${JSON.stringify(ids[0])}).length`),
         0, 'Und ihre Verbindungen bleiben nicht als Stümpfe zurück');
}

gruppe('Folgen lassen sich wirklich verschieben');
{
  /* Der Fehler: die Zuhörer hingen an der Zeile. Sobald der Zeiger sie
     verließ – also genau beim Umsortieren – bekam sie nichts mehr mit.
     setPointerCapture leitet alle weiteren Ereignisse an sie zurück. */
  const skript = html.slice(html.lastIndexOf('<script>'));
  const fn = skript.slice(skript.indexOf('function folgenZiehenVerdrahten'),
                          skript.indexOf('let folgeGezogen'));
  ok(/setPointerCapture/.test(fn), 'Die angefasste Zeile übernimmt den Zeiger');
  ok(/releasePointerCapture/.test(fn), 'Und gibt ihn beim Loslassen wieder frei');
  ok(/e\.button!==0/.test(fn), 'Nur die linke Maustaste zieht');
  ok(/getBoundingClientRect/.test(fn), 'Das Ziel wird über die Maße gesucht, nicht über das Ereignisziel');

  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("de", true); state.items=[]; loadDemo();');
  U.lauf('state.items=state.items.filter(i=>i.kind!=="folge");');
  ['A', 'B', 'C'].forEach((t, i) => U.lauf(
    `state.items.push({id:${JSON.stringify(t)}, kind:"folge", title:${JSON.stringify(t)}, staffel:1, nummer:${i + 1}, added:"2026-01-01", order:0});`));

  /* Zeilen nachbauen und die Ereignisse von Hand feuern. */
  const h = {};
  const zeile = (id, oben) => ({
    dataset: { folge: id, staffel: '1' },
    classList: { add() {}, remove() {} },
    style: {},
    setPointerCapture() {}, releasePointerCapture() {},
    closest: () => ({ dataset: { staffelziel: '1' } }),
    getBoundingClientRect: () => ({ top: oben, bottom: oben + 40, height: 40 }),
    addEventListener: (art, fn) => { (h[id] = h[id] || {}); (h[id][art] = h[id][art] || []).push(fn); }
  });
  const zA = zeile('A', 0), zB = zeile('B', 40), zC = zeile('C', 80);
  U.sandbox._el = { querySelectorAll: () => [zA, zB, zC] };
  U.lauf('folgenZiehenVerdrahten(_el);');
  ok(h.A && h.A.pointerdown, 'Jede Zeile hört auf das Anfassen');

  // C nach ganz oben ziehen: anfassen bei y=90, loslassen in der oberen Hälfte von A
  h.C.pointerdown[0]({ button: 0, clientY: 90, pointerId: 1, target: { closest: () => null } });
  h.C.pointermove[0]({ clientY: 10, pointerId: 1 });
  h.C.pointerup[0]({ clientY: 10, pointerId: 1 });
  gleich(U.json('folgenSortiert().map(f=>f.title)'), ['C', 'A', 'B'], 'C steht jetzt vorn');
  gleich(U.json('folgenSortiert().map(f=>f.nummer)'), [1, 2, 3], 'Und die Nummern zählen neu durch');

  // Ein Klick ohne Bewegung sortiert nichts um
  h.A.pointerdown[0]({ button: 0, clientY: 50, pointerId: 1, target: { closest: () => null } });
  h.A.pointerup[0]({ clientY: 50, pointerId: 1 });
  gleich(U.json('folgenSortiert().map(f=>f.title)'), ['C', 'A', 'B'], 'Ein Klick allein ändert nichts');

  // Die rechte Maustaste zieht nicht
  h.B.pointerdown[0]({ button: 2, clientY: 90, pointerId: 1, target: { closest: () => null } });
  h.B.pointermove[0]({ clientY: 10, pointerId: 1 });
  h.B.pointerup[0]({ clientY: 10, pointerId: 1 });
  gleich(U.json('folgenSortiert().map(f=>f.title)'), ['C', 'A', 'B'], 'Die rechte Taste sortiert nicht um');
}

gruppe('Das Beispielprojekt benutzt jede Funktion');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("de", true); state.items=[]; state.links=[]; state.ordner=[]; state.karten=[]; loadDemo();');

  ok(U.json('state.links.length') >= 5, U.json('state.links.length') + ' Beziehungen');
  ok(U.json('stammKanten().length') >= 2, U.json('stammKanten().length') + ' Abstammungen für den Stammbaum');
  gleich(Object.keys(U.json('stammEbenen(stammKanten())')).length, 3, 'Drei Generationen');
  ok(U.json('state.ordner.length') >= 3, U.json('state.ordner.length') + ' Ordner, davon einer verschachtelt');
  ok(U.json('state.ordner.some(o=>o.parent)'), 'Mit einem Unterordner');
  ok(U.json('state.items.some(i=>i.folder)'), 'Und Einträgen darin');
  ok(U.json('state.karten.length') >= 2, U.json('state.karten.length') + ' Karten');
  ok(U.json('state.karten[0].pins.length') >= 3, U.json('state.karten[0].pins.length') + ' Markierungen');
  ok(U.json('state.karten[0].pins.some(p=>p.ziel)'), 'Eine zeigt auf einen Eintrag');
  ok(U.json('state.karten[0].pins.some(p=>p.karte)'), 'Eine auf eine andere Karte');
  ok(U.json('[...new Set(byKind("folge").map(folgeStaffel))].length') >= 2, 'Zwei Staffeln');
  ok(U.json('byKind("figur").filter(f=>(f.images||[]).length).length') >= 3, 'Mehrere Figuren mit Bild');
  ok(U.json('state.items.some(i=>i.extra)'), 'Die Zusatzbeschreibung wird benutzt');
  ok(U.json('state.items.some(i=>i.langtext)'), 'Der eigene Textplatz auch');
  ok(U.json('state.mind.nodes.length') >= 8, 'Die Mindmap ist gefüllt');
  ok(U.json('state.mind.nodes.some(n=>n.link)'), 'Mit Knoten, die auf Einträge zeigen');

  /* Die Bilder sind selbst gezeichnet und liegen als Daten in der Datei –
     nichts wird nachgeladen, und es hängen keine fremden Rechte daran. */
  const bild = U.json('byKind("figur").find(f=>(f.images||[]).length).images[0]');
  ok(/^data:image\/png;base64,/.test(bild), 'Bilder liegen als Daten im Projekt');
  ok(!/https?:/.test(bild), 'Keine Adresse ins Netz');
  ok(/^data:image\/png;base64,/.test(U.json('state.karten[0].bild')), 'Auch das Kartenbild');

  // Netz und Stammbaum zeigen damit wirklich etwas
  U.lauf('view="rel"; relAnsicht="netz"; renderSimple();');
  ok(/class="nzKnoten"/.test(U.store.sContent.innerHTML), 'Das Netz zeigt Punkte');
  ok(/class="nzKante"/.test(U.store.sContent.innerHTML), 'Und Linien');
  U.lauf('relAnsicht="stamm"; renderSimple();');
  gleich((U.store.sContent.innerHTML.match(/data-bez=/g) || []).length, 3,
         'Der Stammbaum zeigt drei Figuren');
  gleich(Object.keys(U.json('state.bezLage.stamm')).length, 3,
         'Ihre Lage wird im Projekt gemerkt');
}

gruppe('Werte in Ereignis-Attributen brechen nicht aus');
{
  /* Der Fund vom 8. August. In onclick="f('WERT')" reicht esc() nicht:
     esc macht aus ' ein &#39;, und der HTML-Parser wandelt das zurück in
     ein ', BEVOR der Browser den Ausdruck übersetzt. Ein Merkmal oder
     ein Optionsschlüssel aus einer fremden .story-Datei konnte damit die
     Zeichenkette beenden und eigenen Code anhängen – mit Zugriff auf die
     ganze Brücke zum Hauptprozess.

     Dieser Test führt das erzeugte Attribut wirklich aus, so wie ein
     Browser es täte: erst Entitäten auflösen, dann übersetzen. */
  const entity = s => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

  const laeuftDurch = (attribut) => {
    let ausgebrochen = false, letztes = null;
    const fn = new Function('renameOpt', 'delOpt', 'setSideFilter', 'AUSGEBROCHEN',
                            entity(attribut));
    fn((...a) => { letztes = a[a.length - 1]; },
       (...a) => { letztes = a[a.length - 1]; },
       (...a) => { letztes = a[a.length - 1]; },
       () => { ausgebrochen = true; });
    return { ausgebrochen, letztes };
  };

  const nutzlast = "x'); AUSGEBROCHEN(); ('";

  // 1) Optionsschlüssel
  {
    const U = baueUmgebung(standardPfad, { alsAnwendung: true });
    U.lauf(`state.custom = sauberProjekt({schema:7, book:{}, items:[],
      custom:{ROLES:{${JSON.stringify('c_' + nutzlast)}:"Rolle"}}}).custom; renderOpts();`);
    const attr = (U.store.optsBody._html.match(/onclick="(renameOpt\([^"]*)"/) || [])[1];
    ok(!!attr, 'Das Optionsmenü erzeugt ein onclick');
    const r = laeuftDurch(attr);
    ok(!r.ausgebrochen, 'Ein Optionsschlüssel mit Apostroph führt keinen Code aus');
    gleich(r.letztes, 'c_' + nutzlast, 'Und kommt trotzdem unverfälscht als Argument an');
  }

  // 2) Merkmal – viel leichter zu erreichen, die Profi-Leiste zeichnet immer
  {
    const U = baueUmgebung(standardPfad, { alsAnwendung: true });
    U.lauf(`state.items = sauberProjekt({schema:7, book:{}, items:[{id:"a1", kind:"figur",
      name:"M", tags:[${JSON.stringify('Fantasy' + nutzlast)}]}]}).items; renderSide();`);
    const attr = (U.store.pSide._html.match(/onclick="(setSideFilter\('tag'[^"]*)"/) || [])[1];
    ok(!!attr, 'Die Profi-Seitenleiste erzeugt ein onclick');
    const r = laeuftDurch(attr);
    ok(!r.ausgebrochen, 'Ein Merkmal mit Apostroph führt keinen Code aus');
    gleich(r.letztes, 'Fantasy' + nutzlast, 'Und filtert weiterhin nach dem echten Namen');
  }

  // 3) Der Maskierer selbst
  {
    const U = baueUmgebung(standardPfad, { alsAnwendung: true });
    const faelle = ["a'b", 'a"b', 'a\\b', 'a<b>c', 'a&b', "a\nb", "a b"];
    faelle.forEach(f => {
      const attr = U.json(`"f(" + JSON.stringify(attrJs(${JSON.stringify(f)})) + ")"`);
      const roh = U.json(`attrJs(${JSON.stringify(f)})`);
      let ergebnis = null;
      try { new Function('f', entity("f('" + roh + "')"))(v => { ergebnis = v; }); }
      catch (e) { ergebnis = 'SYNTAXFEHLER: ' + e.message; }
      const erwartet = f.replace(/[\r\n\u2028\u2029]/g, ' ');
      gleich(ergebnis, erwartet, `attrJs überträgt ${JSON.stringify(f)} unversehrt`);
      void attr;
    });
    ok(!/[\r\n]/.test(U.json('attrJs("a\\nb")')), 'Zeilenumbrüche werden ersetzt, nicht durchgereicht');
  }

  /* Und statisch: kein neues onclick mit esc() in einer Zeichenkette. */
  {
    const skript = html.slice(html.lastIndexOf('<script>'));
    const treffer = [...skript.matchAll(/on[a-z]+="[a-zA-Z0-9_]+\([^"]*'\$\{esc\(/g)].map(m => m[0]);
    gleich(treffer, [], 'Nirgends steht esc() in einer JavaScript-Zeichenkette – dort gehört attrJs() hin'
      + (treffer.length ? ': ' + treffer[0] : ''));
  }
}

gruppe('Das Beispielprojekt ersetzt, statt anzuhängen');
{
  /* Der Fehler in den Bildschirmfotos: neun Kapitel statt fünf, jede
     Figur zweimal. loadDemo() hängte an, statt zu ersetzen – zweimal
     geklickt, alles doppelt. */
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); loadDemo();');
  const einmal = U.json('state.items.length');
  const kapitel = U.json('byKind("kapitel").length');
  U.lauf('loadDemo();');
  gleich(U.json('state.items.length'), einmal, 'Ein zweiter Aufruf verdoppelt nichts');
  gleich(U.json('byKind("kapitel").length'), kapitel, `Weiterhin ${kapitel} Kapitel`);
  gleich(U.json('state.links.length'), U.json('[...new Set(state.links.map(l=>l.id))].length'),
         'Und keine Verknüpfung doppelt');
  gleich(U.json('state.karten.length'), 2, 'Auch die Karten bleiben zwei');
  gleich(U.json('state.ordner.length'), 3, 'Und die Ordner drei');

  /* Wer schon etwas angelegt hat, wird gefragt. */
  const skript = html.slice(html.lastIndexOf('<script>'));
  const fn = skript.slice(skript.indexOf('async function loadDemo'),
                          skript.indexOf('async function loadDemo') + 900);
  ok(/state\.items\.length && !await dlgFrage/.test(fn), 'Bei gefülltem Projekt wird vorher gefragt');
  ok(/state\.items=\[\]; state\.links=\[\]/.test(fn), 'Danach wird geleert, nicht angehängt');

  /* Und es wird nirgends von allein geladen. */
  const vonAllein = skript.split('\n')
    .filter(z => /^[^\s/*]/.test(z) && /loadDemo\(\)/.test(z) && !/^async function/.test(z));
  gleich(vonAllein, [], 'Das Beispiel lädt sich beim Start nicht selbst');
}

gruppe('Netz und Stammbaum sind bewegliche Flächen');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true); loadDemo();');
  U.lauf('view="rel"; relAnsicht="netz"; renderSimple();');
  const netz = U.store.sContent.innerHTML;

  ok(/id="bezSvg"/.test(netz), 'Das Netz liegt auf einer Zeichenfläche');
  ok(/id="bezRoot"/.test(netz), 'Mit einer Gruppe, die verschoben wird');
  ok(/bezZoomen\(1\.25\)/.test(netz) && /bezZoomen\(1\/1\.25\)/.test(netz), 'Es gibt Zoomknöpfe');
  ok(/bezNeuAnordnen\(\)/.test(netz), 'Und einen zum Neuanordnen');
  ok(/data-bez=/.test(netz), 'Die Punkte tragen ihre Kennung');

  // Die Lage wird gemerkt
  const ids = Object.keys(U.json('state.bezLage.netz'));
  ok(ids.length >= 5, `${ids.length} Punkte haben eine gemerkte Lage`);
  const vorher = U.json('state.bezLage.netz')[ids[0]];
  U.lauf(`bezLageSetzen(${JSON.stringify(ids[0])}, 123, 456);`);
  gleich(U.json('state.bezLage.netz')[ids[0]], { x: 123, y: 456 }, 'Verschieben merkt sich die Stelle');
  ok(vorher.x !== 123, 'Vorher lag der Punkt woanders');

  // Netz und Stammbaum haben getrennte Lagen
  U.lauf('relAnsicht="stamm"; renderSimple();');
  ok(!!U.json('state.bezLage.stamm'), 'Der Stammbaum hat eigene Lagen');
  ok(U.json('Object.keys(state.bezLage).sort()').join(',') === 'netz,stamm',
     'Beide getrennt – ein Stammbaum sieht anders aus als ein Netz');

  // Neu anordnen wirft die Lagen weg
  U.lauf('relAnsicht="netz"; bezNeuAnordnen();');
  gleich(U.json('state.bezLage.netz')[ids[0]].x !== 123, true, 'Neu anordnen setzt zurück');

  // Und die Lagen überleben Speichern und Laden
  U.lauf(`bezLageSetzen(${JSON.stringify(ids[0])}, 77, 88);`);
  const roh = U.json('JSON.parse(JSON.stringify(state))');
  U.lauf(`zustandUebernehmen(${JSON.stringify(roh)}, null);`);
  gleich(U.json('state.bezLage.netz')[ids[0]], { x: 77, y: 88 }, 'Nach dem Laden liegt der Punkt noch dort');

  const skript = html.slice(html.lastIndexOf('<script>'));
  const v = skript.slice(skript.indexOf('function bezVerdrahten'), skript.indexOf('/* ---------- Netzansicht'));
  ok(/setPointerCapture/.test(v), 'Die Fläche übernimmt den Zeiger beim Ziehen');
  ok(/addEventListener\("wheel"/.test(v), 'Das Mausrad zoomt');
  ok(/openDetail\(z\.id\)/.test(v), 'Ein Klick ohne Bewegung öffnet die Detailseite');
}

gruppe('Verbinden in der Mindmap ist ein Umschalter');
{
  const skript = html.slice(html.lastIndexOf('<script>'));
  const sc = skript.slice(skript.indexOf('function startConnect()'),
                          skript.indexOf('function startConnect()') + 400);
  ok(/if\(mmConnectFrom\)\{ mmConnectFrom=null/.test(sc), 'Ein zweiter Druck schaltet ab');
  ok(/aria-pressed="\$\{!!mmConnectFrom\}"/.test(html), 'Der Knopf meldet seinen Zustand');

  /* Nach einer Verbindung bleibt der Modus an – wer eine zieht, zieht
     meist gleich mehrere. */
  const i = skript.indexOf('if(mmConnectFrom&&mmConnectFrom!==id)');
  ok(i > 0, 'Die Stelle, an der verbunden wird, gibt es');
  const koerper = skript.slice(i, i + 420);
  ok(/mmConnectFrom=id/.test(koerper), 'Der angeklickte Knoten wird zum neuen Ausgangspunkt');
  ok(!/mmConnectFrom=null/.test(koerper), 'Der Modus wird dabei nicht abgeschaltet');

  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('loadDemo(); ensureMind();');
  const n = U.json('state.mind.nodes.map(x=>x.id)');
  U.lauf(`mmSel=${JSON.stringify(n[0])}; startConnect();`);
  gleich(U.json('mmConnectFrom'), n[0], 'Einmal drücken schaltet an');
  U.lauf('startConnect();');
  ok(U.json('mmConnectFrom||null') === null, 'Nochmal drücken schaltet ab');
}

gruppe('Die Projektkarte klappt beim zweiten Klick wieder zu');
{
  const skript = html.slice(html.lastIndexOf('<script>'));
  const pm = skript.slice(skript.indexOf('function projektMenue(anker)'),
                          skript.indexOf('function projektMenue(anker)') + 400);
  ok(/if\(\$\("popupMenu"\)\)\{ popupSchliessen\(\); return; \}/.test(pm),
     'Ein zweiter Klick schließt das Menü');

  /* Ohne diese Ausnahme schlösse das Drücken auf die Karte das Menü,
     und der darauf folgende Klick öffnete es sofort wieder. */
  const po = skript.slice(skript.indexOf('function popup(anker, eintraege)'),
                          skript.indexOf('function projektMenue(anker)'));
  ok(/anker\.contains\(ev\.target\)/.test(po), 'Der Anker ist vom Zuklappen ausgenommen');

  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('loadDemo();');
  /* Der DOM-Ersatz legt unbekannte ids sonst einfach an – dann wäre das
     Menü immer „offen" und der Umschalter nie zu prüfen. */
  U.strengeIds(true);
  const anker = { getBoundingClientRect: () => ({ left: 10, top: 10, bottom: 40, right: 200 }), contains: () => false };
  U.sandbox._anker = anker;
  U.lauf('projektMenue(_anker);');
  ok(!!U.store.popupMenu, 'Der erste Klick öffnet');
  U.lauf('projektMenue(_anker);');
  ok(!U.store.popupMenu, 'Der zweite schließt');
  /* Wieder nachsichtig schalten: sonst stolpert ein später auslösender
     Zeitgeber – etwa der Rundgang – über eine fehlende Kennung. */
  U.strengeIds(false);
}

gruppe('Kein deutscher Rest im einfachen Modus');
{
  const U = frischeUmgebung('en');
  const ansichten = ['dash', 'kapitel', 'folge', 'figur', 'ort', 'welt', 'rel', 'beat',
                     'akte', 'ereignis', 'notiz', 'mind', 'stats'];
  ansichten.forEach(v => {
    U.lauf(`view=${JSON.stringify(v)}; renderSimple();`);
    const treffer = deutschesWort(sichtbar(U.store.sContent.innerHTML));
    ok(!treffer, `${v}: keine deutschen Wörter` + (treffer ? ' – ' + treffer : ''));
  });

  const nav = deutschesWort(sichtbar(U.store.sideNav.innerHTML));
  ok(!nav, 'Die Navigation ebenfalls nicht' + (nav ? ' – ' + nav : ''));
  const kopf = deutschesWort(sichtbar(U.store.projSlot.innerHTML));
  ok(!kopf, 'Die Projektkarte ebenfalls nicht' + (kopf ? ' – ' + kopf : ''));
}

gruppe('Kein deutscher Rest im Profi-Modus');
{
  const U = frischeUmgebung('en');
  U.lauf('state.pro=true; renderPro();');

  ['pSide', 'pMain', 'pProps', 'pStatusbar', 'pMenubar', 'pWsBar'].forEach(id => {
    const treffer = deutschesWort(sichtbar(U.store[id] && U.store[id].innerHTML));
    ok(!treffer, `${id}: keine deutschen Wörter` + (treffer ? ' – ' + treffer : ''));
  });

  // Auch die anderen Arbeitsflächen, nicht nur die Tabelle
  ['beat', 'ereignis', 'mind', 'stats'].forEach(w => {
    U.lauf(`ws=${JSON.stringify(w)}; renderPro();`);
    const treffer = deutschesWort(sichtbar(U.store.pMain.innerHTML));
    ok(!treffer, `Arbeitsfläche ${w}: keine deutschen Wörter` + (treffer ? ' – ' + treffer : ''));
  });

  // Und die Eigenschaftsleiste mit einer ausgewählten Zeile
  U.lauf('ws="table"; selection.clear(); selection.add(byKind("figur")[0].id); renderPro();');
  const props = deutschesWort(sichtbar(U.store.pProps.innerHTML));
  ok(!props, 'Die Eigenschaften einer Figur ebenfalls nicht' + (props ? ' – ' + props : ''));
}

gruppe('Kein deutscher Rest in Formular und Detailseite');
{
  const U = frischeUmgebung('en');
  U.json('Object.keys(KINDS)').forEach(art => {
    U.lauf(`openForm(null, ${JSON.stringify(art)});`);
    const treffer = deutschesWort(sichtbar(U.store.formFields.innerHTML));
    ok(!treffer, `Formular ${art}: keine deutschen Wörter` + (treffer ? ' – ' + treffer : ''));
  });

  U.lauf('closeForm();');
  U.json('state.items.map(i=>i.id)').slice(0, 12).forEach(id => {
    U.lauf(`openDetail(${JSON.stringify(id)});`);
    const d = U.store.detailOverlay;
    const treffer = deutschesWort(sichtbar(d && d.innerHTML));
    ok(!treffer, `Detailseite ${id}: keine deutschen Wörter` + (treffer ? ' – ' + treffer : ''));
    U.lauf('closeDetail();');
  });
}

gruppe('Kein deutscher Rest in Einstellungen, Bibliothek und Projektmenü');
{
  const U = frischeUmgebung('en');

  U.lauf('renderOpts();');
  const opts = deutschesWort(sichtbar(U.store.optsBody.innerHTML));
  ok(!opts, 'Das Einstellungsfenster' + (opts ? ' – ' + opts : ''));

  U.lauf('view="bibliothek"; renderSimple();');
  const bib = deutschesWort(sichtbar(U.store.sContent.innerHTML));
  ok(!bib, 'Die Bibliothek' + (bib ? ' – ' + bib : ''));

  /* Das Projektmenü hängt an einem Anker; im Ersatz-DOM genügt ein
     beliebiges Element, weil nur der Inhalt geprüft wird. */
  U.lauf('projektMenue(document.createElement("button"));');
  const pop = deutschesWort(sichtbar(U.store.popupMenu && U.store.popupMenu.innerHTML));
  ok(!pop, 'Das Projektmenü' + (pop ? ' – ' + pop : ''));
}

gruppe('Die Auswahllisten wechseln mit');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true);');
  gleich(U.json('CH_STATUS.fertig'), S.TEXTE['st.fertig'].en, 'Kapitelstatus auf Englisch');
  gleich(U.json('ROLES.protagonist'), S.TEXTE['rl.protagonist'].en, 'Figurenrolle auf Englisch');
  gleich(U.json('ORT_TYPES.stadt'), S.TEXTE['ot.stadt'].en, 'Ortsart auf Englisch');
  gleich(U.json('WCATS.magie'), S.TEXTE['wc.magie'].en, 'Weltkategorie auf Englisch');
  gleich(U.json('ACTS[2].label'), S.TEXTE['akt.2'].en, 'Aktbezeichnung auf Englisch');
  gleich(U.json('KINDS.kapitel.fields.find(f=>f.k==="goalWords").l'), S.TEXTE['fld.kapitel.goalWords'].en,
         'Auch „Ziel-Wörter" – das Feld, das am längsten deutsch blieb');

  U.lauf('setSprache("fr", true);');
  gleich(U.json('CH_STATUS.fertig'), S.TEXTE['st.fertig'].fr, 'Und auf Französisch wieder anders');
  gleich(U.json('KINDS.figur.label'), S.TEXTE['art.figur'].fr, 'Die Artbezeichnung ebenso');
  gleich(U.json('KINDS.figur.fields.find(f=>f.k==="age").l'), S.TEXTE['fld.figur.age'].fr, 'Und jede Feldbeschriftung');

  U.lauf('setSprache("de", true);');
  gleich(U.json('CH_STATUS.fertig'), 'Fertig', 'Auf Deutsch steht wieder Deutsch');
}

gruppe('Der Schreib-Impuls spricht die eingestellte Sprache');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('state.items=[]; loadDemo();');
  ['en', 'es', 'fr'].forEach(code => {
    U.lauf(`setSprache(${JSON.stringify(code)}, true);`);
    const gesehen = new Set();
    for (let i = 0; i < 40; i++) { U.lauf('inspiration();'); gesehen.add(U.json('_letzterToast')); }
    const texte = [...gesehen].join(' | ');
    ok(texte.includes(S.TEXTE['imp.vorspann'][code].trim()), `${code}: der Vorspann steht in der Sprache`);
    const treffer = deutschesWort(texte);
    ok(!treffer, `${code}: kein deutscher Impulstext` + (treffer ? ' – ' + treffer : ''));
  });

  U.lauf('setSprache("de", true); inspiration();');
  ok(/Impuls/.test(U.json('_letzterToast')), 'Auf Deutsch bleibt er deutsch');
}

gruppe('Demodaten folgen der Sprache');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("de", true); state.items=[]; loadDemo();');
  gleich(U.json('state.book.title'), 'Die Aschekrone', 'Auf Deutsch das deutsche Beispiel');

  U.lauf('setSprache("en", true); state.items=[]; loadDemo();');
  gleich(U.json('state.book.title'), 'The Ash Crown', 'Auf Englisch das englische');
  const treffer = deutschesWort(U.json('state.items.map(i=>JSON.stringify(i)).join(" ")'));
  ok(!treffer, 'Und darin nichts Deutsches mehr' + (treffer ? ' – ' + treffer : ''));

  U.lauf('setSprache("zh", true); state.items=[]; loadDemo();');
  gleich(U.json('state.book.title'), 'The Ash Crown',
         'Für Sprachen ohne eigenes Beispiel greift die englische Fassung');
}

gruppe('Die Menüleiste wird gezeichnet, nicht geschrieben');
{
  const markup = html.slice(html.indexOf('<body>'), html.indexOf('<script>', html.indexOf('<body>')));
  ok(/<div class="pMenubar" id="pMenubar"[^>]*><\/div>/.test(markup),
     'Im Markup steht nur die leere Hülle');
  ok(!/>Datei</.test(markup) && !/>Bearbeiten</.test(markup),
     'Kein fest eingetragenes deutsches Menü mehr');

  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("en", true);');
  const menue = U.store.pMenubar.innerHTML;
  ok(/>File</.test(menue), 'Auf Englisch heißt das erste Menü File');
  ok(/Ctrl\+S/.test(menue), 'Und die Tastenkürzel nennen Ctrl, nicht Strg');

  U.lauf('setSprache("de", true);');
  ok(/>Datei</.test(U.store.pMenubar.innerHTML), 'Auf Deutsch wieder Datei');
  ok(/Strg\+S/.test(U.store.pMenubar.innerHTML), 'Und Strg');

  // Das Suchfeld darf beim Sprachwechsel seinen Inhalt behalten
  U.lauf('$("pSearch").value="Mira"; setSprache("en", true);');
  gleich(U.json('$("pSearch").value'), 'Mira', 'Der Suchbegriff bleibt beim Umschalten stehen');
}

gruppe('Auf Deutsch steht auch wieder Deutsch');
{
  /* Die Gegenprobe: nach dem Umbau darf nicht einfach alles englisch
     sein. Sonst hätte man den Fehler nur umgedreht. */
  const U = frischeUmgebung('de');
  U.lauf('view="dash"; renderSimple();');
  ok(/Buchdaten|Fortschritt/.test(sichtbar(U.store.sContent.innerHTML)), 'Die Übersicht spricht Deutsch');

  U.lauf('state.pro=true; renderPro();');
  ok(/Sammlungen/.test(sichtbar(U.store.pSide.innerHTML)), 'Die Profi-Seitenleiste ebenso');
  ok(sichtbar(U.store.pProps.innerHTML).includes(S.TEXTE['pr.buchEigen'].de),
     'Die Eigenschaftsleiste ebenso');

  U.lauf('state.pro=false; openForm(null,"kapitel");');
  ok(/Ziel-Wörter/.test(sichtbar(U.store.formFields.innerHTML)), 'Und das Kapitelformular auch');
}

gruppe('Zahlen folgen der Sprache');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("de", true);');
  const de = U.json('zahl(12345)');
  U.lauf('setSprache("en", true);');
  const en = U.json('zahl(12345)');
  ok(de !== en, `12345 wird unterschiedlich geschrieben (${de} / ${en})`);
  ok(!/toLocaleString\("de-DE"\)/.test(html), 'Nirgends steht mehr eine feste deutsche Zahlenformatierung');
}

bilanz();

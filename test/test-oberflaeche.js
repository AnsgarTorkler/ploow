'use strict';
/* Oberfläche: rendert alles fehlerfrei, filtert Fremddaten,
   migriert alte Stände und macht Änderungen rückgängig. */
const { ok, gleich, gruppe, bilanz } = require('./hilfen');
const { baueUmgebung, standardPfad } = require('./dom-ersatz');

const U = baueUmgebung(standardPfad);
const { store, lauf, json } = U;

/* Diese Reihe prüft deutsche Wortlaute. Seit die App standardmäßig auf
   Englisch startet, muss sie die Sprache selbst festlegen – sonst prüft
   sie Texte, die gar nicht mehr angezeigt werden. */
lauf('setSprache("de", true);');

gruppe('Start');
ok(true, 'Die Oberfläche läuft ohne Fehler durch');
lauf('loadDemo();');
ok(json('state.items.length') > 0, 'Demodaten lassen sich laden');

gruppe('Alle Ansichten zeichnen');
['dash','kapitel','folge','figur','ort','welt','rel','beat','akte','ereignis','notiz','stats','mind'].forEach(v => {
  let laenge = 0, fehler = null;
  try { lauf(`view=${JSON.stringify(v)}; renderSimple();`); laenge = store.sContent.innerHTML.length; }
  catch (e) { fehler = e.message; }
  ok(!fehler && laenge > 60, `${v}${fehler ? ' – ' + fehler : ` (${laenge} Zeichen)`}`);
});
{
  let fehler = null;
  try { lauf('setPro(true); renderAll(); setPro(false); renderAll();'); } catch (e) { fehler = e.message; }
  ok(!fehler, 'Profi-Modus hin und zurück' + (fehler ? ' – ' + fehler : ''));
}

gruppe('Aufbau der Übersicht');
lauf('view="dash"; renderSimple();');
{
  const ov = store.sContent.innerHTML, nav = store.sideNav.innerHTML, kopf = store.mainHead.innerHTML;
  ok(ov.includes('statStrip'), 'Kennzahlenleiste');
  ok(/class="spark"/.test(ov), 'Verlaufsdiagramm');
  /* Die Beschriftungen kommen aus der Sprachdatei – sie hier noch einmal
     abzuschreiben hieße, sie bei jeder Umbenennung zweimal zu ändern. */
  const T = require('../src/sprachen').TEXTE;
  ok(ov.includes(T['ov.buchdaten'].de) && ov.includes(T['ov.aenderungen'].de), 'Beide Karten');
  ok(/kTag kt-/.test(ov), 'Art-Marken in den Änderungen');
  ['Beziehungen','Akte','Mindmap','Schreib-Impuls','Exposé-Export','Statistik','Zeitstrahl']
    .forEach(t => ok(nav.includes(t), 'Seitenleiste enthält ' + t));
  ok(/class="cnt"/.test(nav), 'Zähler in der Seitenleiste');
  ok(kopf.includes('Hinzufügen') && kopf.includes('Ideen'), 'Kopfzeile mit beiden Knöpfen');
  ok(store.projSlot.innerHTML.includes('projektMenue'), 'Projektkarte öffnet das Projektmenü');
  ok(store.tbTitle.textContent.includes(require('../src/main/produkt').NAME + ' —'), 'Titelleiste beschriftet');
}

gruppe('Fremde Daten werden gefiltert');
{
  const boese = 'x" onerror="window.__geknackt=1';
  gleich(json(`safeSrc(${JSON.stringify(boese)})`), '', 'Bildquelle mit Anführungszeichen wird verworfen');
  gleich(json('safeSrc("javascript:alert(1)")'), '', 'javascript:-Adresse wird verworfen');
  gleich(json('safeSrc("https://fremd.example/bild.png")'), '', 'Externe Adresse wird verworfen');
  gleich(json('safeSrc("data:image/svg+xml;base64,PHN2Zz4=")'), '', 'SVG-Datenadresse wird verworfen');
  ok(json('safeSrc("data:image/png;base64,iVBORw0KGgo=")').startsWith('data:image/png'), 'Echtes PNG bleibt erhalten');
  gleich(json('safeColor("red; background:url(//x)")'), 'var(--accent)', 'Bastelfarbe wird ersetzt');
  gleich(json('safeColor("#b0713a")'), '#b0713a', 'Gültige Farbe bleibt');
  gleich(json('safeMedia("https://fremd.example/x.mp4")'), '', 'Externe Medienadresse wird verworfen');
}
{
  // Eine manipulierte Sicherung darf nichts in die Oberfläche schmuggeln
  const boese = {
    items: [{
      kind: 'figur', id: 'a', name: 'Mira" onload="window.__geknackt=1',
      images: ['x" onerror="window.__geknackt=1', 'data:image/png;base64,iVBORw0KGgo='],
      boshaft: '<script>window.__geknackt=1<\/script>', role: 'protagonist'
    }],
    plotlines: [{ id: 'p', name: 'Strang', color: 'red;background:url(//x)' }],
    book: { title: 'Test', targetWords: '9999' }
  };
  lauf(`window.__boese = ${JSON.stringify(boese)};`);
  const sauber = json('sauberProjekt(migriere(window.__boese))');
  gleich(sauber.items[0].images.length, 1, 'Nur das echte Bild überlebt');
  ok(!('boshaft' in sauber.items[0]), 'Unbekannte Felder fallen weg');
  gleich(sauber.plotlines[0].color, 'var(--accent)', 'Manipulierte Farbe wird ersetzt');
  gleich(sauber.book.targetWords, 9999, 'Zahlen werden zu Zahlen');
  gleich(sauber.schema, json('SCHEMA'), 'Schemanummer wird gesetzt');

  // Der Name mit Anführungszeichen bleibt als Text erhalten, wird aber beim Zeichnen maskiert
  lauf('state.items=[sauberEintrag(window.__boese.items[0])]; view="figur"; renderSimple();');
  const html = store.sContent.innerHTML;
  ok(!/onload="window.__geknackt/.test(html), 'Kein ausführbares Attribut im gezeichneten HTML');
  ok(html.includes('&quot;') || html.includes('Mira'), 'Der Name erscheint trotzdem');
  ok(json('typeof window.__geknackt') === 'undefined', 'Nichts wurde ausgeführt');
}
{
  let fehler = null;
  try { lauf('sauberProjekt({nichts:true})'); } catch (e) { fehler = e.message; }
  ok(!!fehler, 'Eine Datei ohne Einträge wird abgelehnt');
}

gruppe('Schema und Migration');
{
  lauf(`window.__alt = {items:[
    {kind:"welt", id:"w1", name:"Eldenmoor", category:"ort", rules:"nebelig"},
    {kind:"figur", id:"f1", name:"Mira", image:"data:image/png;base64,iVBORw0KGgo=", added:"2024-01-05"},
    {kind:"ereignis", id:"e1", title:"Brand"}
  ], book:{title:"Alt"}};`);
  const m = json('migriere(window.__alt)');
  gleich(m.schema, json('SCHEMA'), 'Alter Stand bekommt die aktuelle Schemanummer');
  gleich(m.items[0].kind, 'ort', 'Welt-Element der Kategorie „Ort" wird ein Ort');
  gleich(m.items[0].secrets, 'nebelig', 'Regeln wandern in Geheimnisse');
  gleich(m.items[1].images.length, 1, 'Einzelbild wird zur Bildliste');
  gleich(m.items[2].tl, 'default', 'Ereignis bekommt eine Zeitleiste');
  ok(!!m.items[1].touched, 'Änderungszeitpunkt wird ergänzt');
}
{
  let fehler = null;
  try { lauf('migriere({schema:99, items:[]})'); } catch (e) { fehler = e.message; }
  ok(!!fehler, 'Eine Datei aus einer neueren Fassung wird abgelehnt statt falsch gelesen');
}

gruppe('Rückgängig und Wiederherstellen');
{
  lauf('loadDemo(); undoStapel=[]; redoStapel=[]; merkeSchritt();');
  const vorher = json('state.items.length');
  lauf('state.items.push({id:"neu1",kind:"notiz",title:"Frischer Einfall",added:todayStr(),order:99}); save();');
  gleich(json('state.items.length'), vorher + 1, 'Eintrag angelegt');
  lauf('rueckgaengig();');
  gleich(json('state.items.length'), vorher, 'Rückgängig entfernt ihn wieder');
  lauf('wiederherstellen();');
  gleich(json('state.items.length'), vorher + 1, 'Wiederherstellen bringt ihn zurück');
  ok(json('state.items.some(i=>i.id==="neu1")'), 'Und zwar denselben Eintrag');
}
{
  // Bilder dürfen den Stapel nicht sprengen, müssen aber erhalten bleiben
  lauf(`state.items[0].images=["data:image/png;base64,iVBORw0KGgo="]; save();
        state.items[0].title="Geändert"; save(); rueckgaengig();`);
  gleich(json('state.items[0].images.length'), 1, 'Bilder überstehen das Rückgängigmachen');
}

gruppe('Suche');
{
  lauf('loadDemo(); suchIndexLeeren();');
  const treffer = json('state.items.filter(i=>matches(i,"mira")).length');
  ok(treffer > 0, 'Suche findet etwas');
  gleich(json('state.items.filter(i=>matches(i,"MIRA")).length'), treffer, 'Groß- und Kleinschreibung egal');
  gleich(json('state.items.filter(i=>matches(i,"")).length'), json('state.items.length'), 'Leere Suche zeigt alles');
  // Der Zwischenspeicher muss nach einer Änderung neu greifen
  lauf('const i=state.items[0]; i.title="Zwiebelturm"; touch(i.id);');
  ok(json('matches(state.items[0],"zwiebelturm")'), 'Geänderter Eintrag wird sofort gefunden');
}

gruppe('Einstellungen');
{
  lauf('renderOpts();');
  const sp = store.optsStorage.innerHTML;
  ok(!json('!!DATEI'), 'Diese Umgebung läuft ohne Dateizugriff (Browserbetrieb)');
  ok(/von rund 5 MB/.test(sp), 'Im Browserbetrieb steht die Grenze weiterhin da – dort gilt sie ja');
  ok(sp.includes('installierten Anwendung'), 'Mit dem Hinweis, dass sie in der Anwendung nicht gilt');

  const up = store.optsUpdate.innerHTML;
  ok(up.includes('Aktualisierung'), 'Abschnitt Aktualisierung ist da');
  ok(up.includes('class="switch'), 'Ausschalter ist da');
  ok(up.includes('Jetzt prüfen'), 'Prüfknopf ist da');
}
{
  gleich(json('einstellungen.updates'), true, 'Aktualisierungssuche ist zunächst an');
  lauf('setUpdates(false);');
  gleich(json('einstellungen.updates'), false, 'Sie lässt sich abschalten');
  ok(!/class="switch on/.test(store.optsUpdate.innerHTML), 'Der Schalter zeigt das auch an');
  lauf('einstellungen=Object.assign({},EINST_STANDARD); einstellungenLaden();');
  gleich(json('einstellungen.updates'), false, 'Die Entscheidung übersteht einen Neustart');
  lauf('setUpdates(true);');
  gleich(json('einstellungen.updates'), true, 'Und lässt sich wieder einschalten');
}
{
  const faelle = [
    ['{stand:"suche"}', 'Es wird gesucht'],
    ['{stand:"keine"}', 'aktuell'],
    ['{stand:"verfuegbar", version:"1.2.0"}', '1.2.0'],
    ['{stand:"laedt", prozent:40}', '40 %'],
    ['{stand:"geladen", version:"1.2.0"}', 'Neustart'],
    ['{stand:"fehler", fehler:"kein Netz"}', 'kein Netz'],
    ['{stand:"nicht-eingerichtet"}', 'keine Bezugsquelle']
  ];
  faelle.forEach(([zustand, erwartet]) => {
    lauf(`updateStand=${zustand};`);
    ok(json('updateStandText()').includes(erwartet), 'Statustext bei ' + zustand.slice(8, 30) + ' …');
  });
}

gruppe('Wortzahlen und Verlauf');
{
  /* loadDemo() fragt inzwischen nach, wenn schon etwas da ist – hier wird
     bei leerem Projekt geladen, dann läuft es ohne Rückfrage durch. */
  lauf('state.items=[]; loadDemo();');
  const summe = json('totalWords()');
  ok(summe > 0, 'Wortsumme wird gebildet');
  gleich(json('wordSeries(29).length'), 29, 'Der Verlauf hat 29 Stützstellen');
  lauf('trackWords();');
  ok(json('state.history[todayStr()]') === summe, 'Der heutige Stand wird festgehalten');
}

gruppe('JSON einlesen: Datensätze finden');
{
  lauf(`window.__j1 = {
    story: { characters: [
      { name: "Mira von Aschfeld", rolle: "Protagonistin", alter: 17, motivation: "den Thron retten" },
      { name: "Kael", rolle: "Mentor", alter: 54, motivation: "Wiedergutmachung" }
    ]},
    kapitel: [ { titel: "Der Ruf des Nordens", zusammenfassung: "Mira bricht auf", wortzahl: 3200 } ]
  };`);
  const s = json('jsonDatensaetze(window.__j1)');
  gleich(s.length, 2, 'Beide Listen werden gefunden, auch die verschachtelte');
  gleich(s.map(x => x.pfad).sort(), ['kapitel', 'story.characters'], 'Mit ihrem Pfad');
  gleich(s.find(x => x.pfad === 'story.characters').eintraege.length, 2, 'Anzahl der Einträge stimmt');
  gleich(s.find(x => x.pfad === 'kapitel').felder, ['titel', 'zusammenfassung', 'wortzahl'], 'Feldnamen werden gesammelt');
}
{
  // Eine blanke Liste ganz oben
  lauf('window.__j2 = [{name:"Eldenmoor", beschreibung:"Nebelig"}];');
  const s = json('jsonDatensaetze(window.__j2)');
  gleich(s.length, 1, 'Liste auf oberster Ebene wird erkannt');
  // Ein einzelnes Objekt ohne Liste
  lauf('window.__j3 = {name:"Mira", rolle:"Protagonistin"};');
  gleich(json('jsonDatensaetze(window.__j3).length'), 1, 'Auch ein einzelnes Objekt ist ein Datensatz');
  // Gar nichts Brauchbares
  gleich(json('jsonDatensaetze({a:1, b:"x"}).length'), 1, 'Flaches Objekt wird als ein Eintrag gelesen');
  gleich(json('jsonDatensaetze([1,2,3]).length'), 0, 'Eine Liste aus Zahlen ist kein Datensatz');
  gleich(json('jsonDatensaetze(null).length'), 0, 'Nichts drin, nichts gefunden');
}
{
  // Ringe in den Daten dürfen nicht in eine Endlosschleife führen
  lauf('window.__ring = {a:{}}; window.__ring.a.zurueck = window.__ring; window.__ringOk = jsonDatensaetze(window.__ring).length >= 0;');
  ok(json('window.__ringOk'), 'Selbstbezügliche Daten führen nicht in eine Endlosschleife');
}

gruppe('JSON einlesen: Art und Felder raten');
{
  gleich(json('rateArt("story.characters", [])'), 'figur', 'Pfad „characters" wird zu Figur');
  gleich(json('rateArt("kapitelListe", [])'), 'kapitel', 'Pfad „kapitel" wird zu Kapitel');
  gleich(json('rateArt("schauplaetze", [])'), 'ort', 'Pfad „schauplaetze" wird zu Ort');
  gleich(json('rateArt("timeline", [])'), 'ereignis', 'Pfad „timeline" wird zu Ereignis');
  gleich(json('rateArt("egal", ["rolle","motivation"])'), 'figur', 'Ohne Pfadhinweis entscheiden die Feldnamen');
  gleich(json('rateArt("egal", ["wortzahl"])'), 'kapitel', 'Wortzahl deutet auf ein Kapitel');
  gleich(json('rateArt("kramkiste", ["blah"])'), 'notiz', 'Unklares landet als Idee statt im Nichts');
  gleich(json('rateArt("story.welt.orte", [])'), 'ort', 'Der letzte Pfadteil entscheidet, nicht der erste');
  gleich(json('rateArt("plotpunkte", [])'), 'beat', 'Plot-Punkte werden erkannt');
  gleich(json('rateArt("mainCharacters", [])'), 'figur', 'Auch als Teilwort im Schlüssel');
  // „ort" steckt auch in „wortliste" – reines Teilwort-Raten wäre hier falsch
  gleich(json('rateArt("wortliste", ["wortzahl"])'), 'kapitel', 'Aus „wortliste" wird kein Ort');
  gleich(json('rateArt("antwortbogen", ["blah"])'), 'notiz', 'Und aus „antwortbogen" auch nicht');
}
{
  const z = json('rateZuordnung("figur", ["name","rolle","alter","persönlichkeit","irgendwas"])');
  gleich(z.name, 'name', 'name wird erkannt');
  gleich(z['rolle'], 'role', 'rolle wird zu role');
  gleich(z['alter'], 'age', 'alter wird zu age');
  gleich(z['persönlichkeit'], 'personality', 'Umlaute stören die Erkennung nicht');
  gleich(z['irgendwas'], '', 'Unbekanntes bleibt unzugeordnet');
}
{
  // Ohne Namensfeld muss trotzdem eines gewählt werden, sonst heißt alles gleich
  const z = json('rateZuordnung("figur", ["bezeichnung","blabla"])');
  ok(Object.values(z).includes('name'), 'Ohne klaren Namen wird ein Feld dafür bestimmt');
  // Ein Zielfeld darf nicht doppelt belegt werden
  const z2 = json('rateZuordnung("figur", ["name","charaktername"])');
  const doppelt = Object.values(z2).filter(v => v === 'name');
  gleich(doppelt.length, 1, 'Kein Zielfeld wird doppelt belegt');
}

gruppe('JSON einlesen: Einträge bauen');
{
  lauf(`window.__roh = [
    { name:"Mira", rolle:"Protagonistin", alter:17, tags:["mutig","jung"], extras:{augen:"grau"} },
    { name:"Kael", rolle:"Mentor", alter:"unbekannt" }
  ];
  window.__zu = {name:"name", rolle:"role", alter:"age", tags:"tags", extras:"appearance"};`);
  const e = json('jsonZuEintraegen(window.__roh, "figur", window.__zu)');
  gleich(e.length, 2, 'Beide Einträge entstehen');
  gleich(e[0].name, 'Mira', 'Der Name kommt an');
  gleich(e[0].age, '17', 'Zahlen werden zu Text, wo Text erwartet wird');
  gleich(e[0].tags, ['mutig', 'jung'], 'Listen werden zu Tags');
  gleich(e[0].appearance, 'augen: grau', 'Verschachtelte Objekte werden lesbar statt [object Object]');
  gleich(e[0].kind, 'figur', 'Die Art ist gesetzt');
  ok(!('extras' in e[0]), 'Das Quellfeld selbst landet nicht im Eintrag');
}
{
  // Fremde Dateien laufen durch dieselbe Säuberung wie jeder Import
  lauf(`window.__boes = [{ n:'x" onerror="window.__geknackt=1', b:"harmlos" }];
        window.__zub = {n:"name", b:"personality"};`);
  const e = json('jsonZuEintraegen(window.__boes, "figur", window.__zub)');
  gleich(e.length, 1, 'Auch verdächtige Daten kommen an');
  lauf('state.items=[]; state.items.push(...jsonZuEintraegen(window.__boes,"figur",window.__zub)); view="figur"; renderSimple();');
  ok(!/onerror="window.__geknackt/.test(store.sContent.innerHTML), 'Aber nichts davon wird ausführbar gezeichnet');
  ok(json('typeof window.__geknackt') === 'undefined', 'Nichts wurde ausgeführt');
}
{
  /* Auswahlfelder speichern Schlüssel, nicht Anzeigetexte. „Protagonistin"
     muss zu „protagonist" werden, sonst zeigt die Karte ein Fragezeichen. */
  lauf(`window.__sel = [
    {name:"Mira", rolle:"Protagonistin"},
    {name:"Kael", rolle:"mentor"},
    {name:"Nox",  rolle:"⚔️ Antagonist/in"},
    {name:"Vex",  rolle:"Erzschurke vom Dienst"}
  ]; window.__zusel = {name:"name", rolle:"role"};`);
  const e = json('jsonZuEintraegen(window.__sel, "figur", window.__zusel)');
  gleich(e[0].role, 'protagonist', 'Beschriftung „Protagonistin" wird zum Schlüssel');
  gleich(e[1].role, 'mentor', 'Ein bereits richtiger Schlüssel bleibt stehen');
  gleich(e[2].role, 'antagonist', 'Auch mit Emoji davor');
  ok(!!e[3].role, 'Unbekannte Rolle bekommt einen gültigen Wert statt eines leeren Feldes');
  ok(json(`Object.keys(ROLES).includes(${JSON.stringify(e[3].role)})`), 'Und zwar einen aus der Liste');

  lauf('window.__st = [{titel:"Kap 1", status:"Entwurf"}]; window.__zust = {titel:"title", status:"status"};');
  gleich(json('jsonZuEintraegen(window.__st, "kapitel", window.__zust)')[0].status, 'entwurf',
         'Groß geschriebener Status wird zugeordnet');
}
{
  lauf('window.__ohne = [{ irgendwas: "nur das" }];');
  const e = json('jsonZuEintraegen(window.__ohne, "notiz", {irgendwas:"text"})');
  gleich(e[0].title, '(ohne Titel)', 'Ein Eintrag ohne Namen bekommt einen Platzhalter statt leer zu bleiben');
}
{
  const wert = json('jsonWert({a:1, b:[2,3], c:null, d:"x"})');
  gleich(wert, 'a: 1 · b: 2, 3 · d: x', 'Beliebige Werte werden lesbar gemacht');
  gleich(json('jsonWert(null)'), '', 'Nichts bleibt nichts');
}

gruppe('Detailseite: Zusammenfassung, Angaben, Beziehungen');
{
  /* loadDemo() hängt an, statt zu ersetzen – ohne Leeren griffe der Test
     auf Reste aus der vorigen Gruppe zu. */
  /* loadDemo() legt inzwischen selbst Verknüpfungen an, damit Netz und
     Stammbaum im Beispiel etwas zeigen. Hier soll bei null begonnen
     werden, also wird die Liste danach geleert. */
  lauf('state.items=[]; state.links=[]; loadDemo(); state.links=[];');
  lauf(`window.__a = byKind("figur")[0]; window.__b = byKind("figur")[1];
        window.__o = byKind("ort")[0];
        window.__a.summary = "Eine kurze Beschreibung in Prosa.";
        openDetail(window.__a.id);`);
  const h = store.detailOverlay.innerHTML;

  ok(/class="dFliess">Eine kurze Beschreibung/.test(h), 'Die Zusammenfassung steht als Fließtext oben');
  const zeilen = [...h.matchAll(/class="dK">([^<]+)</g)].map(m => m[1]);
  ok(zeilen.length >= 4, `Die kurzen Angaben stehen als Zeilen darunter (${zeilen.length})`);
  ok(zeilen.includes('Rolle') && zeilen.includes('Alter'), 'Mit Beschriftung links und Wert rechts');
  ok(!zeilen.some(z => /Beziehungen zu anderen/.test(z)),
     'Das Beziehungs-Textfeld steht nicht mehr in der Tabelle, sondern bei den Beziehungen');
  ok(/class="bezNotiz"/.test(h), 'Sondern dort als Notiz');

  ok(/linkHinzufuegen\(/.test(h), 'Es gibt einen Knopf zum Hinzufügen');
  ok(/go\('rel'\)/.test(h), 'Und einen zur Gesamtansicht');
}
{
  // Figuren haben jetzt ein Feld für die Kurzbeschreibung
  const felder = json('KINDS.figur.fields.map(f=>f.k)');
  ok(felder.includes('summary'), 'Figuren haben ein Feld für die Kurzbeschreibung');
  gleich(felder[2], 'summary', 'Es steht weit vorn, direkt nach Name und Rolle');
}

gruppe('Beziehungen sind echte Verknüpfungen');
{
  /* loadDemo() legt inzwischen selbst Verknüpfungen an, damit Netz und
     Stammbaum im Beispiel etwas zeigen. Hier soll bei null begonnen
     werden, also wird die Liste danach geleert. */
  lauf('state.items=[]; state.links=[]; loadDemo(); state.links=[];');
  lauf(`window.__a = byKind("figur")[0]; window.__b = byKind("figur")[1]; window.__o = byKind("ort")[0];`);
  lauf(`window.__l1 = linkAnlegen(window.__a.id, window.__b.id, "Mentor", false);
        window.__l2 = linkAnlegen(window.__a.id, window.__o.id, "Heimatplanet", false);
        window.__l3 = linkAnlegen(window.__b.id, window.__a.id, "Tochter", true);`);
  gleich(json('state.links.length'), 3, 'Drei Verknüpfungen angelegt');

  /* Eine Beziehung gehört keinem der beiden Einträge, sondern liegt
     dazwischen – sie muss deshalb auf beiden Seiten erscheinen. */
  gleich(json('linksVon(window.__a.id).length'), 3, 'Bei der Figur erscheinen alle drei');
  gleich(json('linksVon(window.__o.id).length'), 1, 'Beim Ort die eine');

  const ausSichtA = json('linksVon(window.__a.id).map(x=>x.richtung)');
  gleich(ausSichtA, ['hin', 'hin', 'beide'], 'Die Richtung wird aus Sicht des Betrachteten bestimmt');
  const ausSichtO = json('linksVon(window.__o.id).map(x=>x.richtung)');
  gleich(ausSichtO, ['her'], 'Vom anderen Ende aus zeigt der Pfeil zurück');

  gleich(json('linksVon(window.__b.id).map(x=>x.ziel.id===window.__a.id)'), [true, true],
         'Das Ziel ist immer der jeweils andere Eintrag');
}
{
  // Selbstbezug und Unfug werden nicht angelegt
  gleich(json('linkAnlegen(window.__a.id, window.__a.id, "sich selbst")'), null,
         'Ein Eintrag lässt sich nicht mit sich selbst verknüpfen');
  gleich(json('linkAnlegen("", window.__b.id, "x")'), null, 'Ohne Ausgangspunkt entsteht nichts');
}
{
  // Beim Löschen eines Eintrags dürfen keine halben Verbindungen übrig bleiben
  lauf('state.items=[]; state.links=[]; loadDemo(); state.links=[]; window.__x=byKind("figur")[0]; window.__y=byKind("figur")[1];');
  lauf('linkAnlegen(window.__x.id, window.__y.id, "Freund", true);');
  gleich(json('state.links.length'), 1, 'Eine Verknüpfung steht');
  lauf('eintragEntfernen(window.__y.id);');
  gleich(json('state.links.length'), 0, 'Nach dem Löschen des Ziels ist sie mit weg');
}
{
  /* Auch beim Öffnen einer Datei: zeigt eine Verknüpfung ins Leere,
     stünde sonst eine Karte ohne Namen auf der Detailseite. */
  lauf(`window.__roh = {
    schema: 3,
    book: {title:"Test"},
    items: [{kind:"figur", id:"f1", name:"Mira"}, {kind:"figur", id:"f2", name:"Kael"}],
    links: [
      {id:"l1", von:"f1", zu:"f2", text:"Mentor", beidseitig:false},
      {id:"l2", von:"f1", zu:"gibtsnicht", text:"ins Leere", beidseitig:false},
      {id:"l3", von:"f1", zu:"f1", text:"sich selbst", beidseitig:false}
    ]};`);
  const sauber = json('sauberProjekt(migriere(window.__roh))');
  gleich(sauber.links.length, 1, 'Verwaiste und selbstbezügliche Verknüpfungen werden beim Öffnen entfernt');
  gleich(sauber.links[0].text, 'Mentor', 'Die gültige bleibt');
}
{
  // Alte Projekte bekommen die Liste ergänzt, ohne den Freitext zu verlieren
  lauf(`window.__alt2 = {schema:2, book:{title:"Alt"},
        items:[{kind:"figur", id:"f1", name:"Mira", relations:"Schwester von Kael"}]};`);
  const m = json('migriere(window.__alt2)');
  gleich(m.schema, json('SCHEMA'), 'Schema wird angehoben');
  gleich(m.links, [], 'Die Liste der Verknüpfungen entsteht leer');
  gleich(m.items[0].relations, 'Schwester von Kael', 'Der bisherige Freitext bleibt unangetastet');
}

gruppe('Dateien an Einträge anhängen');
{
  lauf('loadDemo();');
  // Jede Art muss Anhänge aufnehmen können, nicht nur Kapitel
  json('Object.keys(KINDS)').forEach(art => {
    const html = json(`(function(){const it=byKind(${JSON.stringify(art)})[0]; return it?attachSection(it):null;})()`);
    ok(html !== null && /Angehängte Dateien/.test(html), `${art} kann Dateien anhängen`);
  });
}
{
  // Word und Verwandtes bekommen ein eigenes Symbol statt der Büroklammer
  const faelle = [
    ['kapitel.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '📝'],
    ['notiz.odt', '', '📝'],
    ['alt.doc', '', '📝'],
    ['recherche.pdf', 'application/pdf', '📕'],
    ['zahlen.xlsx', '', '📊'],
    ['exposee.txt', 'text/plain', '📃'],
    ['bild.png', 'image/png', '🖼️'],
    ['unbekannt.dat', '', '📎']
  ];
  faelle.forEach(([name, mime, symbol]) =>
    gleich(json(`fileIcon(${JSON.stringify(mime)}, ${JSON.stringify(name)})`), symbol, `${name} → ${symbol}`));
}
{
  lauf(`window.__k = byKind("kapitel")[0];
        window.__k.files = [
          {id:"a1", name:"Kapitel 1.docx", type:"file", mime:""},
          {id:"a2", name:"Stimmung.png",   type:"image", img:"data:image/png;base64,iVBORw0KGgo="},
          {id:"a3", name:"Recherche.pdf",  type:"file", mime:"application/pdf"}
        ];`);
  const html = json('attachSection(window.__k)');
  ok(/Kapitel 1\.docx/.test(html), 'Der Dateiname steht in der Liste');
  ok(/anhangWortzahl\(/.test(html), 'Für das Word-Dokument gibt es „Wortzahl"');
  ok((html.match(/anhangWortzahl\(/g) || []).length === 1, 'Aber nicht für das PDF');
  ok(/anhangImOrdner\(/.test(html), 'Und einen Weg in den Ordner');
  ok(/openAttachment\(/.test(html), 'Klicken öffnet die Datei');
  ok(/Angehängte Dateien \(3\)/.test(html), 'Die Anzahl stimmt');

  // Bilder werden weiterhin als Vorschau gezeigt, nicht als Zeile
  ok(/cursor:zoom-in/.test(html), 'Bilder bleiben Vorschaubilder');
}
{
  // Wortzahl nur bei Arten, die überhaupt Wörter zählen
  ['figur', 'ort', 'welt', 'beat', 'ereignis', 'notiz'].forEach(art => {
    const html = json(`(function(){
      const it=byKind(${JSON.stringify(art)})[0]; if(!it) return "";
      it.files=[{id:"x", name:"Text.docx", type:"file", mime:""}];
      return attachSection(it);
    })()`);
    ok(!/anhangWortzahl\(/.test(html), `${art} bekommt keinen Wortzahl-Knopf`);
  });
}
{
  ok(json('istManuskript({type:"file", name:"a.docx"})'), '.docx gilt als Manuskript');
  ok(json('istManuskript({type:"file", name:"A.ODT"})'), 'Groß geschrieben ebenfalls');
  ok(!json('istManuskript({type:"file", name:"a.pdf"})'), '.pdf nicht');
  ok(!json('istManuskript({type:"image", name:"a.docx"})'), 'Ein Bild nicht, egal wie es heißt');
}
{
  // Der Anhang-Knopf im Formular erscheint nur bei bestehenden Einträgen
  lauf('openForm(byKind("figur")[0].id);');
  gleich(store.fAttachBtn.style.display, 'inline-block', 'Beim Bearbeiten kann man anhängen');
  lauf('closeForm(); openForm(null, "figur");');
  gleich(store.fAttachBtn.style.display, 'none', 'Bei einem noch nicht angelegten Eintrag nicht');
  lauf('closeForm();');
}

gruppe('Ausgabe für eine KI und zurück');
{
  lauf('loadDemo(); window.__aus=null; download=(n,i)=>{window.__aus={name:n, text:i};}; kiExport();');
  const aus = json('window.__aus');
  ok(!!aus, 'Es wird eine Datei geschrieben');
  ok(/\.md$/.test(aus.name), 'Als Markdown: ' + aus.name);
  ok(aus.text.includes('Die Aschekrone'), 'Der Buchtitel steht darin');
  ok(aus.text.includes('Was es schon gibt'), 'Und der vorhandene Bestand');

  /* Das Beispiel muss gültiges JSON sein – sonst ahmt die KI einen
     kaputten Aufbau nach und die Antwort lässt sich nicht einlesen. */
  const block = (aus.text.match(/```json\n([\s\S]*?)\n```/) || [])[1];
  ok(!!block, 'Ein JSON-Beispiel ist enthalten');
  let geparst = null, fehler = null;
  try { geparst = JSON.parse(block); } catch (e) { fehler = e.message; }
  ok(!!geparst, 'Das Beispiel ist gültiges JSON' + (fehler ? ' – ' + fehler : ''));
  ok(!/\/\//.test(block), 'Und enthält keine Kommentare, die JSON ungültig machen würden');

  // Jede Art wird mit ihren echten Feldnamen beschrieben
  json('Object.keys(KINDS)').forEach(art => {
    const felder = json(`KINDS[${JSON.stringify(art)}].fields.filter(f=>f.t!=="image").map(f=>f.k)`);
    const fehlend = felder.filter(f => !aus.text.includes(f));
    gleich(fehlend, [], `Alle Felder von ${art} sind beschrieben`);
  });
}
{
  /* Der Rundweg muss sich schließen: der Schlüssel, unter dem die App
     eine Art ausgibt, muss beim Wiedereinlesen dieselbe Art ergeben.
     „handlung" tat das zunächst nicht und wäre als Idee gelandet. */
  json('Object.keys(KINDS)').forEach(art => {
    const schluessel = json(`kiSchluessel(${JSON.stringify(art)})`);
    gleich(json(`rateArt(${JSON.stringify(schluessel)}, [])`), art,
           `"${schluessel}" wird wieder als ${art} erkannt`);
  });
}
{
  // Ein leeres Projekt darf die Ausgabe nicht zerlegen
  lauf('state.items=[]; state.plotlines=[]; state.book={title:"",genre:"",premise:"",theme:"",audience:"",targetWords:0,deadline:""};');
  let fehler = null;
  try { lauf('kiExport();'); } catch (e) { fehler = e.message; }
  ok(!fehler, 'Auch ein leeres Projekt lässt sich ausgeben' + (fehler ? ' – ' + fehler : ''));
  ok(json('window.__aus').text.includes('Noch nichts angelegt'), 'Mit einem Hinweis statt leerer Abschnitte');
}

gruppe('Zahlen überleben das Speichern');
{
  /* Der Fehler: sauberText() verwarf alles, was keine Zeichenkette war.
     Der Akt eines Plot-Punktes wird aber als Zahl gespeichert – das Board
     schreibt beim Ziehen einer Karte +act hinein. Nach dem nächsten Öffnen
     war der Akt leer, und da das Board nur die Akte 1 bis 3 zeichnet,
     verschwanden sämtliche Plot-Punkte spurlos. */
  gleich(json('sauberText(2)'), '2', 'Eine Zahl wird zu Text statt verworfen');
  gleich(json('sauberText(0)'), '0', 'Auch die Null');
  gleich(json('sauberText(true)'), 'true', 'Wahrheitswerte ebenfalls');
  gleich(json('sauberText(null)'), '', 'Nichts bleibt nichts');
  gleich(json('sauberText({a:1})'), '', 'Objekte gehören nicht in ein Textfeld');
  gleich(json('sauberText(NaN)'), '', 'Keine Zahl ist auch kein Text');
}
{
  lauf('loadDemo();');
  const vorher = json('byKind("beat").length');
  ok(vorher > 0, `Die Demodaten haben ${vorher} Plot-Punkte`);

  // Genau das macht das Board beim Ziehen einer Karte
  lauf('setField(byKind("beat")[0].id, "act", 2);');
  lauf('window.__g = JSON.parse(JSON.stringify(state)); zustandUebernehmen(window.__g, null);');
  gleich(json('byKind("beat").length'), vorher, 'Nach Speichern und Öffnen sind alle noch da');
  ok(json('byKind("beat").every(b=>["1","2","3"].includes(String(b.act)))'),
     'Und jeder hat weiterhin einen gültigen Akt');

  lauf('view="beat"; renderSimple();');
  const karten = (store.sContent.innerHTML.match(/class="kCard"/g) || []).length;
  gleich(karten, vorher, 'Das Board zeigt sie auch alle an');

  lauf('view="akte"; renderSimple();');
  const zeilen = (store.sContent.innerHTML.match(/class="sceneRow"/g) || []).length;
  ok(zeilen >= vorher, 'Und die Akt-Ansicht ebenfalls');
}
{
  // Das Board schreibt den Akt jetzt als Schlüssel, nicht als Zahl
  const quelle = require('fs').readFileSync(standardPfad, 'utf8');
  ok(/setField\(e\.dataTransfer\.getData\("text\/plain"\),"act",String\(/.test(quelle),
     'Der Drop-Handler speichert den Akt als Zeichenkette');
}
{
  /* Akte stehen in fremden Dateien selten als blanke Ziffer da. */
  lauf(`window.__akt = jsonZuEintraegen(
    [{t:"A",a:"Akt I"},{t:"B",a:"II"},{t:"C",a:"Akt 3"},{t:"D",a:"erster Akt"},
     {t:"E",a:2},{t:"F",a:"third act"},{t:"G",a:"Setup"}],
    "beat", {t:"title", a:"act"});`);
  gleich(json('window.__akt.map(e=>e.act)'), ['1','2','3','1','2','3','1'],
         'Römisch, ausgeschrieben, als Zahl und mit Vorsilbe wird richtig zugeordnet');
  ok(json('window.__akt.every(e=>["1","2","3"].includes(e.act))'),
     'Auch Unbekanntes landet in einem gültigen Akt statt im Nichts');
}

gruppe('Beide Oberflächen, eine Palette');
{
  const css = require('fs').readFileSync(standardPfad, 'utf8').match(/<style>([\s\S]*)<\/style>/)[1];
  const block = (css.match(/body\.pro\{[\s\S]*?\}/) || [''])[0];
  const rollen = [...block.matchAll(/(--p-[a-z0-9-]+)\s*:\s*([^;]+);/g)];

  ok(rollen.length >= 12, 'Der Profi-Modus benennt seine Farbrollen');
  const eigene = rollen.filter(([, , wert]) => /#[0-9a-f]{3,8}|rgba?\(/i.test(wert));
  gleich(eigene.map(e => e[1]), [], 'Keine Rolle hat noch einen eigenen Farbwert');
  ok(rollen.every(([, , wert]) => /var\(--/.test(wert)),
     'Jede Rolle zeigt auf eine Farbe des einfachen Modus');
  ok(!/\[data-theme="light"\]\s*body\.pro/.test(css),
     'Es gibt keine zweite Palette für den hellen Profi-Modus mehr');

  // Die Farben, auf die verwiesen wird, müssen in beiden Themen gesetzt sein
  const hell = (css.match(/:root\{[\s\S]*?\n\}/) || [''])[0];
  const dunkel = (css.match(/\[data-theme="dark"\]\{[\s\S]*?\n\}/) || [''])[0];
  const zeigtAuf = [...new Set(rollen.map(([, , w]) => (w.match(/var\((--[a-z0-9-]+)\)/) || [])[1]).filter(Boolean))];
  zeigtAuf.forEach(name => {
    ok(hell.includes(name + ':') && dunkel.includes(name + ':'),
       `${name} ist in Hell und Dunkel gesetzt`);
  });

  // Feste Farbwerte im Profi-Bereich: nur noch Weiß auf farbigem Grund
  const proZeilen = css.split('\n').filter(z => /^\s*(\.p[A-Z]|body\.pro)/.test(z));
  const verdaechtig = proZeilen.filter(z => /#[0-9a-f]{3,6}\b/i.test(z) && !/#fff\b|#ffffff\b/i.test(z));
  gleich(verdaechtig, [], 'Keine übrig gebliebenen Festfarben in den Profi-Regeln');
}

gruppe('Als Anwendung: Dateiwege statt Browserspeicher');
{
  const A = baueUmgebung(standardPfad, { alsAnwendung: true });
  ok(A.json('!!DATEI'), 'Die Oberfläche erkennt den Dateizugriff');

  A.lauf('setSprache("de", true); loadDemo(); renderOpts();');
  const sp = A.store.optsStorage.innerHTML;
  ok(!/5 MB/.test(sp), 'Der 5-MB-Deckel wird nicht mehr angezeigt');
  ok(!/Speicherbelegung/.test(sp), 'Auch die Überschrift „Speicherbelegung" ist weg');
  ok(sp.includes('Größenbeschränkung gibt es nicht'),
     'Stattdessen steht dort, dass es keine Grenze gibt');
  ok(sp.includes('sicherungen'), 'Der Sicherungsordner wird genannt');
  ok(sp.includes('Noch nicht gespeichert'), 'Ohne Datei steht das auch so da');

  // Projektname und Dateiname erscheinen, sobald gespeichert wurde
  A.lauf('projektDatei="C:\\\\Buecher\\\\Die Aschekrone.story"; renderOpts();');
  ok(A.store.optsStorage.innerHTML.includes('Die Aschekrone.story'), 'Nach dem Speichern steht der Dateiname da');

  // Rendern und Speichern dürfen auch auf diesem Weg nicht scheitern
  let fehler = null;
  try { A.lauf('view="dash"; renderSimple(); save();'); } catch (e) { fehler = e.message; }
  ok(!fehler, 'Zeichnen und Speichern laufen durch' + (fehler ? ' – ' + fehler : ''));
  ok(A.json('ungesichert') === true, 'Eine Änderung wird als ungesichert vermerkt');
  ok(A.store.tbSaved.textContent.includes('ungesichert'), 'Und in der Titelleiste angezeigt');
}

bilanz();

'use strict';
/* ============================================================
   NICHTS DARF AUS SEINEM KASTEN LAUFEN
   Zwei Fehler, die im Betrieb aufgefallen sind, hatten dieselbe
   Bauart und wären mit dieser Prüfung nie ausgeliefert worden:

   1. „Speichern und beenden": der Knopf schrumpfte im Flex-Kasten
      unter seine Textbreite, und weil er nicht umbrechen darf,
      stand der Text seitlich über dem Rahmen.
   2. Der Dateiname in der Projektkarte lief über den Rand hinaus,
      obwohl Auslassungspunkte gesetzt waren – die wirken auf
      inline-Elementen aber nicht.

   Ohne Browser lässt sich kein Layout ausmessen. Prüfbar ist
   aber, ob die Regeln überhaupt wirken können.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { ok, gleich, gruppe, bilanz } = require('./hilfen');
const { baueUmgebung, standardPfad } = require('./dom-ersatz');

const html = fs.readFileSync(standardPfad, 'utf8');
/* Kommentare vorher entfernen: sonst hängen sie am folgenden Selektor
   und der Vergleich schlägt fehl, obwohl die Regel richtig ist. */
const css = html.match(/<style>([\s\S]*)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, '');
const regeln = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
  .map(([, sel, decl]) => ({ sel: sel.trim().replace(/\s+/g, ' '), decl }));

/* Eigenschaften eines Selektors können über mehrere Regeln verteilt sein,
   deshalb werden alle passenden zusammengezogen. */
const regelFuer = (selektor) => regeln
  .filter(r => r.sel.split(',').map(x => x.trim()).includes(selektor))
  .map(r => r.decl).join(';');

gruppe('Auslassungspunkte können auch wirklich kürzen');
{
  /* overflow und text-overflow greifen bei nicht ersetzten inline-Elementen
     nicht. Wer kürzen will, muss also display setzen – oder ein Flex-Kind
     sein, das dadurch ohnehin zum Block wird. */
  const betroffen = regeln.filter(r => /text-overflow:\s*ellipsis/.test(r.decl));
  ok(betroffen.length > 5, `${betroffen.length} Regeln kürzen Text mit Auslassungspunkten`);

  betroffen.forEach(({ sel, decl }) => {
    const kannKuerzen = /display:/.test(decl) || /flex:/.test(decl)
      || /flex-shrink:/.test(decl) || /flex-basis:/.test(decl)
      || /\b(td|th)\b/.test(sel);
    ok(kannKuerzen, `${sel} kann kürzen (display, flex oder Tabellenzelle)`);
  });
}

gruppe('Knöpfe treten nicht aus ihrem Rahmen');
{
  const btn = regelFuer('.btn');
  ok(/flex-shrink:\s*0/.test(btn), 'Knöpfe schrumpfen nicht unter ihre Textbreite');
  ok(/max-width:\s*100%/.test(btn), 'Und werden nie breiter als ihr Kasten');
  ok(/white-space:\s*nowrap/.test(btn), 'Beschriftungen brechen normalerweise nicht um');

  ok(/flex-wrap:\s*wrap/.test(regelFuer('.modalBtns')),
     'In Dialogen dürfen die Knöpfe stattdessen umbrechen');
  ok(/white-space:\s*normal/.test(regelFuer('.modalBtns .btn')),
     'Und im äußersten Fall auch die Beschriftung selbst');
}

gruppe('Lange Wörter sprengen keine Karte');
{
  const brechend = regeln.filter(r => /overflow-wrap:\s*(anywhere|break-word)/.test(r.decl)
                                   || /word-break:\s*break-word/.test(r.decl));
  ok(brechend.length >= 5, `${brechend.length} Regeln brechen überlange Wörter um`);

  ['.dlgText', '.mCard h3', '.toast'].forEach(sel => {
    const passend = regeln.some(r => r.sel.split(',').map(x => x.trim()).includes(sel)
                                  && /overflow-wrap|word-break/.test(r.decl));
    ok(passend, `${sel} bricht überlange Wörter um`);
  });
}

gruppe('Was tatsächlich gezeichnet wird');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('loadDemo();');

  /* Ein sehr langer Name ohne Leerzeichen ist der harte Fall: ohne
     Umbruchregel schiebt er die Karte auf, ohne Kürzung läuft er heraus. */
  const brocken = 'Donaudampfschifffahrtsgesellschaftskapitaenspatentpruefungskommission'.repeat(2);
  U.lauf(`state.book.title = ${JSON.stringify(brocken)};
          state.items[0].title = ${JSON.stringify(brocken)};
          projektDatei = "C:\\\\Ein\\\\sehr\\\\tiefer\\\\Pfad\\\\${brocken}.story";`);

  let fehler = null;
  try { U.lauf('view="dash"; renderSimple();'); } catch (e) { fehler = e.message; }
  ok(!fehler, 'Die Übersicht zeichnet auch mit einem übermäßig langen Titel');

  const karte = U.store.projSlot.innerHTML;
  ok(/class="pT"/.test(karte) && /class="pS"/.test(karte), 'Die Projektkarte ist vollständig');
  ok(karte.length < 4000, 'Und bläht sich nicht auf');

  ['kapitel', 'figur', 'akte', 'beat', 'notiz'].forEach(v => {
    let f = null;
    try { U.lauf(`view=${JSON.stringify(v)}; renderSimple();`); } catch (e) { f = e.message; }
    ok(!f, `${v} zeichnet mit langen Namen` + (f ? ' – ' + f : ''));
  });
}

gruppe('Dialoge bleiben im Fenster');
{
  ok(/max-height:\s*46vh/.test(regelFuer('.dlgText')), 'Langer Dialogtext bekommt eine eigene Bildlaufleiste');
  ok(/overflow-y:\s*auto/.test(regelFuer('.dlgText')), 'Und rollt statt den Dialog zu strecken');

  const overlay = regelFuer('.overlay');
  ok(/overflow-y:\s*auto/.test(overlay), 'Das Fenster dahinter rollt ebenfalls');

  const modal = regelFuer('.modal');
  ok(/max-width:\s*100%/.test(modal), 'Kein Dialog wird breiter als das Fenster');

  const popup = regelFuer('.popupMenu');
  ok(/max-height:\s*calc\(100vh/.test(popup), 'Das Projektmenü passt sich der Fensterhöhe an');
  ok(/overflow-y:\s*auto/.test(popup), 'Und rollt bei vielen Einträgen');
}

gruppe('Bedienbarkeit ohne Maus und mit Vorlesesoftware');
{
  /* Ein Symbol allein sagt einer Vorlesesoftware nichts. title wird je nach
     Programm gar nicht oder nur verzögert vorgelesen – aria-label immer. */
  const markup = html.slice(html.indexOf('<body>'), html.indexOf('<script>'));
  const knoepfe = [...markup.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)];
  const ohneText = knoepfe.filter(([ganz, inhalt]) => !inhalt.replace(/<[^>]+>/g, '').trim());
  ok(ohneText.length > 0, `${ohneText.length} Knöpfe ohne sichtbaren Text`);
  ohneText.forEach(([ganz]) => {
    const kennung = (ganz.match(/(?:id|class)="([^"]*)"/) || [])[1] || ganz.slice(0, 40);
    ok(/aria-label=/.test(ganz), `Knopf „${kennung}" hat ein aria-label`);
  });

  // Schalter melden ihren Zustand
  ['proSwitch', 'proSwitchPro'].forEach(id => {
    const knopf = (markup.match(new RegExp('<button[^>]*id="' + id + '"[^>]*>')) || [''])[0];
    ok(/role="switch"/.test(knopf), `${id} ist als Schalter ausgezeichnet`);
    ok(/aria-checked=/.test(knopf), `${id} meldet seinen Zustand`);
  });

  ok(/<input id="sSearch"[^>]*aria-label=/.test(markup), 'Das Suchfeld ist beschriftet');
}

gruppe('Beschriftungen gehören zu ihrem Feld');
{
  const U = baueUmgebung(standardPfad, { alsAnwendung: true });
  U.lauf('setSprache("de", true); loadDemo();');

  /* Ein <label> ohne for gehört zu keinem Feld. Ein Klick darauf setzt
     dann keinen Fokus, und Vorlesesoftware nennt das Feld nicht beim Namen. */
  U.json('Object.keys(KINDS)').forEach(art => {
    U.lauf(`openForm(null, ${JSON.stringify(art)});`);
    const felder = U.store.formFields.innerHTML;
    const labels = [...felder.matchAll(/<label([^>]*)>/g)].map(m => m[1]);
    ok(labels.length > 0, `${art}: das Formular hat Beschriftungen`);
    const ohneFor = labels.filter(a => !/for=/.test(a));
    gleich(ohneFor, [], `${art}: jede Beschriftung zeigt auf ihr Feld`);

    // Und das Ziel muss es auch geben
    const ziele = [...felder.matchAll(/<label[^>]*for="([^"]+)"/g)].map(m => m[1]);
    const fehlend = ziele.filter(id => !new RegExp('id="' + id + '"').test(felder));
    gleich(fehlend, [], `${art}: jedes Ziel einer Beschriftung ist vorhanden`);
  });
  U.lauf('closeForm();');

  const markup = html.slice(html.indexOf('<body>'), html.indexOf('<script>'));
  ok(/<label for="kindPick"/.test(markup), 'Auch die Auswahl der Eintragsart ist beschriftet');
}

gruppe('Nur eine Hauptregion ist sichtbar');
{
  const markup = html.slice(html.indexOf('<body>'), html.indexOf('<script>'));
  const mains = markup.match(/<main[^>]*>/g) || [];
  gleich(mains.length, 2, 'Es gibt zwei <main> – eines je Oberfläche');

  /* Das ist zulässig, weil immer nur eine der beiden Oberflächen im
     Dokument steht; die andere ist display:none und damit auch für
     Vorlesesoftware nicht vorhanden. */
  const css = html.match(/<style>([\s\S]*)<\/style>/)[1];
  ok(/#proUI\{display:none/.test(css.replace(/\s/g, '')), 'Der Profi-Modus ist zunächst ausgeblendet');
  ok(/body\.pro#simpleUI\{display:none;?\}/.test(css.replace(/\s/g, '')),
     'Und im Profi-Modus verschwindet der einfache Modus');
}

gruppe('Farben stehen bei den Themenfarben');
{
  const css = html.match(/<style>([\s\S]*)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, '');
  const wurzel = (css.match(/:root\{[\s\S]*?\n\}/) || [''])[0];
  const dunkel = (css.match(/\[data-theme="dark"\]\{[\s\S]*?\n\}/) || [''])[0];

  ['kapitel','folge','figur','ort','welt','beat','ereignis','notiz'].forEach(art => {
    ['bg','fg'].forEach(teil => {
      const name = `--kt-${art}-${teil}`;
      ok(wurzel.includes(name) && dunkel.includes(name), `${name} ist in beiden Themen gesetzt`);
    });
  });

  // In den Regeln selbst darf keine Festfarbe mehr stehen
  const markenRegeln = css.split('\n').filter(z => /^\.kt-/.test(z.trim()));
  const mitFestfarbe = markenRegeln.filter(z => /#[0-9a-f]{3,6}\b/i.test(z));
  gleich(mitFestfarbe, [], 'Die Marken-Regeln nutzen nur noch Variablen');
}

bilanz();

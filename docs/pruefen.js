/* Prüft die Produktseite ohne Browser: Auszeichnung, Vollständigkeit
   der Übersetzungen und die erzeugten Adressen. */
const fs=require('fs');
const h=fs.readFileSync('index.html','utf8');
let ok=0, fehler=[];
const p=(b,n)=>{ if(b){ok++;} else fehler.push(n); };

const js=h.slice(h.lastIndexOf('<script>')+8, h.lastIndexOf('</script>'));
const sandbox={document:{querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>({setAttribute(){},style:{},classList:{add(){}}}),documentElement:{dataset:{}},body:{dataset:{}}},
  window:{matchMedia:()=>({matches:false})}, navigator:{language:'de'}, localStorage:{getItem:()=>null,setItem(){}}};
const vm=require('vm');
const ctx=vm.createContext(Object.assign({console}, sandbox));
// nur die Datenteile auswerten
const teil=js.slice(0, js.indexOf('let sprache'));
vm.runInContext(teil+'; this._K=KONFIG; this._T=TEXTE; this._S=SPRACHEN; this._M=MELDUNGEN;', ctx);
const K=ctx._K, T=ctx._T, S=ctx._S, M=ctx._M;

const codes=Object.keys(S);
p(codes.length===7, 'Sieben Sprachen: '+codes.join(', '));
p(S.ar.rtl===true, 'Arabisch läuft von rechts nach links');

const luecken=[];
Object.keys(T).forEach(k=>codes.forEach(c=>{ if(!T[k][c]||!String(T[k][c]).trim()) luecken.push(k+'/'+c); }));
p(luecken.length===0, 'Keine Lücken in den Übersetzungen'+(luecken.length?': '+luecken.slice(0,6).join(', '):''));
p(Object.keys(T).length>=45, Object.keys(T).length+' Textschlüssel');

// Jeder data-t im Markup muss es geben
const benutzt=[...h.matchAll(/data-t="([^"]+)"/g)].map(m=>m[1]);
const fehlend=benutzt.filter(k=>!T[k]);
p(fehlend.length===0, benutzt.length+' Verweise im Markup, alle vorhanden'+(fehlend.length?': '+fehlend.join(', '):''));

// Und umgekehrt: Schlüssel, die niemand benutzt (nur Hinweis)
const imSkript=[...js.matchAll(/tx\("([^"]+)"\)/g)].map(m=>m[1]);
const inListen=['f1.t','f1.x','f2.t','f2.x','f3.t','f3.x','f4.t','f4.x','f5.t','f5.x','f6.t','f6.x'];
const unbenutzt=Object.keys(T).filter(k=>!benutzt.includes(k)&&!imSkript.includes(k)&&!inListen.includes(k));
p(unbenutzt.length===0, 'Kein Textschlüssel liegt brach'+(unbenutzt.length?': '+unbenutzt.join(', '):''));

// Adressen
const wurzel='https://github.com/'+K.benutzer+'/'+K.repo;
/* Umgekehrt zur ersten Fassung: jetzt darf KEIN Platzhalter mehr
   dastehen, sonst zeigen alle acht Adressen auf ein Repository, das
   es nicht gibt. */
p(!/BITTE|EINTRAGEN|example/i.test(K.benutzer), 'Der Benutzername ist eingetragen: ' + K.benutzer);
p(/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(K.benutzer),
  'Und hat die Form eines GitHub-Benutzernamens');
p(K.dateiWindows.endsWith('.exe'), 'Windows-Datei: '+K.dateiWindows);
p(js.includes('releases/latest/download/'), 'Die Links zeigen immer auf die neueste Fassung');

// Meldungen
p(Array.isArray(M)&&M.length>0, M.length+' Ankündigung(en) hinterlegt');
p(M.every(m=>m.datum&&m.en), 'Jede Meldung hat Datum und englische Fassung');

// Auszeichnung
p(/<html lang="de">/.test(h), 'lang steht im Markup');
p(/name="viewport"/.test(h), 'Für kleine Bildschirme vorbereitet');
p(!/<script src=|<link[^>]*href="http/.test(h), 'Keine fremden Server – kein Cookie-Banner nötig');
p(!/googleapis|gtag|analytics/i.test(h), 'Keine Zählpixel');
p((h.match(/<section/g)||[]).length>=4, 'Vier Abschnitte: Funktionen, Download, Neuigkeiten, Installation');
p(/aria-disabled="true"/.test(h), 'Der Store-Knopf ist als „demnächst" gekennzeichnet');
p(/onerror="bildFehlt\(this\)"/.test(h), 'Fehlende Bilder werden aufgefangen');
p(/prefers-color-scheme: dark/.test(h), 'Hell oder dunkel folgt dem System');
p(/dir  = rtl/.test(js)||/documentElement.dir/.test(js), 'Die Leserichtung wird gesetzt');

// macOS-Anleitung vollständig
['inst.mac1','inst.mac2','inst.mac3'].forEach(k=>p(!!T[k], 'macOS-Schritt vorhanden: '+k));
p(/Rechtsklick/.test(T['inst.mac1'].de)&&/Öffnen/.test(T['inst.mac1'].de), 'Rechtsklick statt Doppelklick steht drin');
p(/Store/.test(T['inst.winX'].de), 'Der Store wird Windows-Nutzern nahegelegt');

/* Die Farben müssen denen der Anwendung entsprechen – sonst wirken die
   Bildschirmfotos auf der Seite wie aufgeklebt. */
{
  const app=fs.readFileSync('../index.html','utf8');
  const holen=(t,v)=>{const m=t.match(new RegExp('--'+v+':\\s*([^;]+);'));return m?m[1].trim():null;};
  const hell=h.slice(h.indexOf(':root{'), h.indexOf('html[data-thema="dunkel"]'));
  const dunkel=h.slice(h.indexOf('html[data-thema="dunkel"]'));
  const appHell=app.slice(app.indexOf(':root{'), app.indexOf('[data-theme="dark"]'));
  const appDunkel=app.slice(app.indexOf('[data-theme="dark"]'));
  [['bg','grund'],['panel','flaeche'],['panel2','flaeche2'],['text','text'],
   ['text2','text2'],['text3','text3'],['accent','akzent'],['border','linie'],
   ['line-strong','linie2'],['chip','chip']].forEach(([a,w])=>{
    p(holen(appHell,a)===holen(hell,w),   'hell: --'+a+' = --'+w+' ('+holen(appHell,a)+' / '+holen(hell,w)+')');
    p(holen(appDunkel,a)===holen(dunkel,w),'dunkel: --'+a+' = --'+w+' ('+holen(appDunkel,a)+' / '+holen(dunkel,w)+')');
  });
}

/* Die Versionsnummer steckt in den Dateinamen der Herunterladeknöpfe.
   Bleibt sie beim Veröffentlichen stehen, zeigen alle vier Knöpfe auf
   Dateien, die es im Release nicht gibt – die Seite sieht heil aus und
   ist trotzdem kaputt. */
{
  const paket=JSON.parse(fs.readFileSync(__dirname+'/../package.json','utf8'));
  p(K.version===paket.version, 'KONFIG.version stimmt mit package.json überein ('+K.version+' / '+paket.version+')');
  ['dateiWindows','dateiPortabel','dateiMac','dateiLinux'].forEach(f=>{
    p(String(K[f]).includes(paket.version), f+' nennt die aktuelle Version: '+K[f]);
  });
}

/* Die sechs Bildschirmfotos. Fehlt eines, zeigt die Seite zwar einen
   Platzhalter statt eines kaputten Bildes – aber gemerkt hätte man es
   erst im Browser. */
{
  const erwartet=[...h.matchAll(/bild:"(bilder\/[^"]+)"/g)].map(m=>m[1]);
  p(erwartet.length===6, erwartet.length+' Bildschirmfotos sind eingebunden');
  erwartet.forEach(rel=>{
    const datei=__dirname+'/'+rel;
    const da=fs.existsSync(datei);
    p(da, rel+' liegt vor');
    if(!da) return;
    const d=fs.readFileSync(datei);
    p(d.slice(1,4).toString()==='PNG', rel+' ist ein gültiges PNG');
    const br=d.readUInt32BE(16), ho=d.readUInt32BE(20);
    p(br>=1600, rel+' ist breit genug: '+br+'×'+ho);
    /* Über 600 KB wird die Seite auf einer Mobilverbindung zäh. */
    p(d.length<600*1024, rel+' bleibt unter 600 KB ('+Math.round(d.length/1024)+' KB)');
  });
  p(/object-position:center top/.test(h), 'Der Bildausschnitt beginnt oben, nicht in der Mitte');
}

/* Doppelklick vergrößert ein Bildschirmfoto. Im halben Spaltenformat ist
   die Oberfläche darauf sonst nicht zu erkennen. */
{
  p(/ondblclick="bildGross\(this\)"/.test(h), 'Doppelklick auf ein Bild vergrößert es');
  p(/onkeydown="if\(event\.key==='Enter'/.test(h), 'Mit der Tastatur geht es auch (Enter oder Leertaste)');
  p(/tabindex="0"/.test(h)&&/role="button"/.test(h), 'Die Bilder sind mit der Tabulatortaste erreichbar');
  p(/title="\$\{esc\(tx\("ui\.vergroessern"\)\)\}"/.test(h), 'Der Hinweis dazu ist übersetzt');
  p(/function bildSchliessen\(\)/.test(js), 'Es gibt einen Weg zurück');
  p(/e\.key === "Escape"/.test(js), 'Esc schließt');
  p(/if\(!e\.target\.closest\("figure"\)\) bildSchliessen\(\)/.test(js),
    'Ein Klick daneben schließt, ein Klick auf das Bild nicht');
  p(/aria-modal/.test(js)&&/\.focus\(\)/.test(js), 'Die Großansicht meldet sich als Dialog und nimmt den Fokus');
  p(/bildSchliessen\(\);\s*\/\* sonst/.test(js), 'Ein Sprachwechsel räumt die Großansicht weg');
  p(/\.grossbild\{position:fixed/.test(h), 'Die Großansicht liegt über der Seite');
  p(/max-width:100%; max-height:100%; width:auto; height:auto/.test(h),
    'Das Bild wird eingepasst, nicht über seine Auflösung hinaus gestreckt');
  p(/inset-inline-end/.test(h), 'Der Schließknopf sitzt auch auf Arabisch richtig');
  p(/function tippGross/.test(js)&&/\(hover: none\)/.test(js),
    'Ohne Maus genügt ein Tippen – sonst wäre die Großansicht am Telefon unerreichbar');
  ['ui.vergroessern','ui.schliessen'].forEach(k=>p(!!T[k], 'Textschlüssel vorhanden: '+k));
}

/* Seit die Update-Prüfung eingeschaltet ist, geht Ploow einmal beim
   Start ins Netz. Die Seite darf dann nicht mehr das Gegenteil
   behaupten – das wäre nicht nur ungenau, sondern datenschutzrechtlich
   eine falsche Angabe. */
{
  const heikel = /ohne Internet|no internet|keine Netzwerkverbindung|makes no network|vollständig offline|fully offline/i;
  const treffer = Object.keys(T).filter(k => codes.some(c => heikel.test(String(T[k][c]||''))));
  p(treffer.length===0, 'Keine Aussage mehr, Ploow gehe nie ins Netz'+(treffer.length?': '+treffer.join(', '):''));

  const nennt = k => codes.every(c => /Aktualisierung|update|更新|अपडेट|actualiza|mises? à jour|التحديث/i.test(String(T[k][c]||'')));
  p(nennt('foot.rechte'), 'Die Fußzeile nennt die Aktualisierungsprüfung in jeder Sprache');
  p(nennt('f6.x'), 'Und der Abschnitt „Ihre Daten bleiben Ihre“ ebenfalls');

  const abschaltbar = k => codes.every(c => String(T[k][c]||'').length > 40);
  p(abschaltbar('foot.rechte'), 'In jeder Sprache ausformuliert, nicht nur ein Wort');
}

console.log(ok+' Prüfungen bestanden'+(fehler.length?', '+fehler.length+' fehlgeschlagen':''));
if(fehler.length){ fehler.forEach(f=>console.log('  ✗ '+f)); process.exitCode=1; }

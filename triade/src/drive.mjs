/* ═══════════════════════════════════════════════════════════
   Pilote Chrome — vérifie l'application dans un vrai navigateur.

   node src/drive.mjs [dossier-captures]

   Pourquoi ce fichier plutôt qu'une capture d'écran : Chrome en mode
   « headless » refuse une fenêtre de moins de 500 px de large, donc toute
   mesure faite ainsi porte sur un écran qui n'existe pas. Ici on passe par
   le protocole DevTools, qui émule vraiment un téléphone de 390 px, et qui
   remonte en plus les erreurs JavaScript — invisibles sur une capture.
   ═══════════════════════════════════════════════════════════ */

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://127.0.0.1:8931/index.html';
const PORT = 9333;
const SHOTS = process.argv[2] || '/tmp/triade-shots';
const PHONE = { width: 390, height: 844, deviceScaleFactor: 1, mobile: true };
const DESKTOP = { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false };

mkdirSync(SHOTS, { recursive: true });

/* ─── Sonde de mise en page, exécutée dans la page ─── */
const PROBE = `(() => {
  // Lecture d'une couleur calculée. Renvoie null si le format n'est pas reconnu :
  // annoncer un contraste faux serait pire que ne rien annoncer.
  const lire = (c) => {
    if (!c) return null;
    let m = c.match(/^rgba?\\(([^)]+)\\)/);
    if (m) {
      const p = m[1].split(/[\\s,\\/]+/).filter(Boolean).map(Number);
      if (p.length < 3 || p.some(isNaN)) return null;
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    m = c.match(/^color\\(srgb\\s+([^)]+)\\)/);
    if (m) {
      const p = m[1].split(/[\\s\\/]+/).filter(Boolean).map(Number);
      if (p.length < 3 || p.some(isNaN)) return null;
      return { r: p[0]*255, g: p[1]*255, b: p[2]*255, a: p.length > 3 ? p[3] : 1 };
    }
    return null; // oklab, lab, color(display-p3…) : non traité volontairement
  };
  const surImpose = (av, ar) => ({            // av sur ar, alpha simple
    r: av.r*av.a + ar.r*(1-av.a),
    g: av.g*av.a + ar.g*(1-av.a),
    b: av.b*av.a + ar.b*(1-av.a), a: 1
  });
  const lum = (o) => {
    const v = [o.r, o.g, o.b].map(x => { x /= 255; return x <= 0.03928 ? x/12.92 : Math.pow((x+0.055)/1.055, 2.4); });
    return 0.2126*v[0] + 0.7152*v[1] + 0.0722*v[2];
  };
  const ratio = (a,b) => { const l1=lum(a), l2=lum(b); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); };

  // Fond RÉEL derrière un texte : on empile les couches semi-transparentes.
  // Un dégradé sur le chemin rend la mesure impossible → null.
  const fond = (el) => {
    const couches = [];
    let n = el;
    while (n && n !== document.documentElement) {
      const st = getComputedStyle(n);
      // Le fond de page porte un dégradé très plat : on retient sa couleur de
      // base, dont la teinte la plus claire est le blanc — le cas défavorable.
      if (st.backgroundImage && st.backgroundImage !== 'none' && n !== document.body) return null;
      const c = lire(st.backgroundColor);
      if (c === null && st.backgroundColor && st.backgroundColor !== 'rgba(0, 0, 0, 0)') return null;
      if (c && c.a > 0.001) { couches.unshift(c); if (c.a >= 0.999) break; }
      n = n.parentElement;
    }
    const racine = lire(getComputedStyle(document.documentElement).backgroundColor) || { r:255, g:255, b:255, a:1 };
    let base = racine.a >= 0.999 ? racine : { r:255, g:255, b:255, a:1 };
    for (const c of couches) base = c.a >= 0.999 ? c : surImpose(c, base);
    return base;
  };
  const nom = (el) => el.tagName.toLowerCase() + (el.id ? '#'+el.id : '') +
    (typeof el.className === 'string' && el.className.trim() ? '.'+el.className.trim().split(/\\s+/).slice(0,3).join('.') : '');

  const W = innerWidth, H = innerHeight;
  const r = { fenetre:[W,H], theme: document.documentElement.dataset.theme,
    page:[document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    deborde:[], petites:[], petitesAssumees:0, contrastes:[], nonMesurables:0, coupes:[] };

  for (const el of document.querySelectorAll('body *')) {
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || +st.opacity === 0) continue;
    const b = el.getBoundingClientRect();
    if (!b.width && !b.height) continue;

    if (st.position !== 'fixed' && (b.right > W + 1 || b.left < -1)) {
      let p = el.parentElement, glissant = false;
      while (p) { const ov = getComputedStyle(p).overflowX;
        if (ov === 'auto' || ov === 'scroll' || ov === 'hidden') { glissant = true; break; } p = p.parentElement; }
      if (!glissant) r.deborde.push({ el: nom(el), l: Math.round(b.left), r: Math.round(b.right) });
    }

    const propre = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());

    // Commandes secondaires assumées petites (liens texte discrets) : comptées à part.
    const secondaire = el.matches('.effacer, .hchip, .det-btn');
    if (['BUTTON','A','INPUT','TEXTAREA'].includes(el.tagName) && (b.height < 40 || b.width < 40)) {
      if (secondaire) r.petitesAssumees++;
      else r.petites.push({ el: nom(el), t:[Math.round(b.width), Math.round(b.height)] });
    }

    // Texte tronqué par un conteneur trop court : seulement si l'élément porte
    // lui-même du texte, sinon les décors en débordement volontaire font du bruit.
    if (propre && el.scrollHeight > el.clientHeight + 2 && st.overflowY === 'hidden')
      r.coupes.push({ el: nom(el), visible: el.clientHeight, reel: el.scrollHeight });

    if (propre && el.textContent.trim().length > 1) {
      const bg = fond(el);
      const fg = lire(st.color);
      if (bg === null || fg === null) { r.nonMesurables++; continue; }
      const ct = ratio(fg.a >= 0.999 ? fg : surImpose(fg, bg), bg);
      const px = parseFloat(st.fontSize);
      const gras = +st.fontWeight >= 700;
      const seuil = (px >= 24 || (px >= 18.66 && gras)) ? 3 : 4.5;
      if (ct < seuil) r.contrastes.push({ el: nom(el), ratio: Math.round(ct*100)/100, seuil, px,
        txt: el.textContent.trim().slice(0,30) });
    }
  }
  return r;
})()`;

/* ─── Client du protocole DevTools ─── */
let ws, nextId = 1;
const attente = new Map();
const erreurs = [];

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((ok, ko) => {
    attente.set(id, { ok, ko });
    setTimeout(() => { if (attente.has(id)) { attente.delete(id); ko(new Error('délai dépassé : ' + method)); } }, 20000);
  });
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function evalJS(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('exception dans la page : ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}

async function tap(sel) {
  const box = await evalJS(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return null;
    e.scrollIntoView({ block: 'center', behavior: 'instant' });
    const b = e.getBoundingClientRect();
    return { x: b.left + b.width/2, y: b.top + b.height/2, w: b.width, h: b.height };
  })()`);
  if (!box || box.w === 0) throw new Error('cible introuvable ou invisible : ' + sel);
  for (const type of ['mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
  await pause(230);
}

async function shot(nom) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SHOTS, nom + '.png'), Buffer.from(data, 'base64'));
}

async function metrics(m) { await send('Emulation.setDeviceMetricsOverride', m); }

let visite = 0;
let attendueM = PHONE;
async function goto(hash, m = PHONE) {
  attendueM = m;
  await metrics(m);
  // Un simple changement d'ancre ne recharge PAS le document : la page garderait
  // l'état de l'essai précédent (thème compris). On force un document neuf.
  await send('Page.navigate', { url: BASE + '?v=' + (++visite) + (hash || '') });
  await pause(900);
  /* L'émulation peut ne pas avoir pris pendant la navigation : on la repose et on
     vérifie. Mesurer une page à 433 px en croyant tester 390 ne prouve rien. */
  for (let i = 0; i < 3; i++) {
    const w = await evalJS('innerWidth');
    if (w === m.width) return;
    await metrics(m);
    await pause(250);
  }
}

/* ─── Calibrage de la sonde ───
   Quatre cas dont le résultat est connu d'avance, dont un fond semi-transparent
   et un color-mix : si l'un tombe à côté, le reste du rapport ne vaut rien. */
async function calibre() {
  const cas = await evalJS(`(() => {
    const d = document.createElement('div');
    d.id = 'CAL';
    d.style.cssText = 'position:fixed;left:0;top:0;background:#fff;z-index:9999';
    d.innerHTML = [
      '<p style="color:#000;background:#fff">noir sur blanc</p>',
      '<p style="color:#777;background:#fff">gris moyen sur blanc</p>',
      '<p style="background:#fff"><span style="display:block;background:rgba(0,0,0,.5)"><b style="color:#fff;font-weight:400">blanc sur noir a 50 pourcent</b></span></p>',
      '<p style="color:#fff;background:color-mix(in srgb, #000 50%, #fff)">blanc sur color-mix</p>'
    ].join('');
    document.body.appendChild(d);
    return true;
  })()`);
  if (!cas) throw new Error('calibrage impossible');
  const r = await evalJS(PROBE.replace("document.querySelectorAll('body *')", "document.querySelectorAll('#CAL p, #CAL b')"));
  await evalJS(`document.getElementById('CAL').remove()`);

  // La sonde ne signale que ce qui est SOUS le seuil : on relit les ratios trouvés.
  const trouve = {};
  for (const c of r.contrastes) trouve[c.txt.slice(0, 12)] = c.ratio;
  const attendu = { 'gris moyen s': 4.48, 'blanc sur noi': 3.95, 'blanc sur col': 3.95 };
  const ecarts = [];
  for (const [cle, val] of Object.entries(attendu)) {
    const got = trouve[cle.slice(0, 12)];
    if (got === undefined) ecarts.push(`${cle} : non mesuré (attendu ${val})`);
    else if (Math.abs(got - val) > 0.12) ecarts.push(`${cle} : ${got} au lieu de ${val}`);
  }
  if (trouve['noir sur blan'] !== undefined) ecarts.push('noir sur blanc signalé à tort comme insuffisant');
  if (r.nonMesurables > 0) ecarts.push(`${r.nonMesurables} cas de calibrage jugés non mesurables`);
  if (ecarts.length) throw new Error('SONDE NON FIABLE — ' + ecarts.join(' | '));
  console.log('sonde calibrée : gris/blanc, alpha 50 % et color-mix lus correctement');
}

/* ─── Rapport ─── */
const bilan = [];

async function verifie(titre) {
  const r = await evalJS(PROBE);
  const soucis = [];
  if (r.fenetre[0] !== attendueM.width)
    soucis.push(`MESURE NON VALABLE : fenêtre de ${r.fenetre[0]} px au lieu de ${attendueM.width}`);
  if (r.deborde.length) soucis.push(`déborde ×${r.deborde.length} : ` + r.deborde.slice(0, 5).map((d) => d.el + ' →' + d.r).join(', '));
  if (r.petites.length) soucis.push(`cibles <40px ×${r.petites.length} : ` + r.petites.slice(0, 5).map((d) => d.el + ' ' + d.t.join('×')).join(', '));
  if (r.coupes.length) soucis.push(`texte coupé ×${r.coupes.length} : ` + r.coupes.slice(0, 4).map((d) => d.el).join(', '));
  for (const c of r.contrastes.slice(0, 8)) soucis.push(`contraste ${c.ratio} < ${c.seuil} · ${c.el} « ${c.txt} » (${c.px}px)`);
  bilan.push({ titre, fenetre: r.fenetre.join('×'), theme: r.theme, page: r.page.join('×'), soucis });
  return r;
}

/* ─── Déroulé ─── */
async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    '--no-first-run', '--no-default-browser-check', '--user-data-dir=/tmp/triade-chrome-profil',
    'about:blank'
  ], { stdio: 'ignore' });

  let cible = null;
  for (let i = 0; i < 60 && !cible; i++) {
    await pause(250);
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      cible = l.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch { /* Chrome démarre encore */ }
  }
  if (!cible) { chrome.kill(); throw new Error('Chrome injoignable'); }

  ws = new WebSocket(cible.webSocketDebuggerUrl);
  await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });

  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && attente.has(m.id)) {
      const { ok, ko } = attente.get(m.id);
      attente.delete(m.id);
      m.error ? ko(new Error(m.error.message)) : ok(m.result);
      return;
    }
    if (m.method === 'Runtime.exceptionThrown')
      erreurs.push('exception : ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type))
      erreurs.push(m.params.type + ' console : ' + m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
    if (m.method === 'Log.entryAdded' && ['error'].includes(m.params.entry.level))
      erreurs.push('log : ' + m.params.entry.text + ' (' + (m.params.entry.url || '') + ')');
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  /* Le cache HTTP de Chrome survit au profil et au vidage des caches applicatifs :
     sans cela le pilote refuse de tester (à juste titre) et ne sait pas se débloquer. */
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });

  let planté = null;
  const ATTENDUS = 26;   // nombre de contrôles du scénario complet

  /* ─── L'instrument avant tout : que teste-t-on vraiment ? ───
     Un serveur éteint ne provoque pas d'erreur visible : le service worker sert
     alors sa copie en cache, et le rapport porte sur une version périmée. On
     compare donc l'empreinte de build servie par le RÉSEAU à celle de la page. */
  let attendu;
  try {
    const html = await (await fetch(BASE)).text();
    attendu = html.match(/name="triade-build" content="([^"]+)"/)?.[1];
    if (!attendu) throw new Error('pas d’empreinte de build dans la page servie');
    const sons = ['createOscillator', 'AudioContext', 'new Audio(', '.play()'].filter((m) => html.includes(m));
    if (sons.length) throw new Error('du code de son subsiste dans la page : ' + sons.join(', '));
  } catch (e) {
    console.error('LE SERVEUR LOCAL NE RÉPOND PAS sur ' + BASE + ' — rien n’a été vérifié.');
    console.error('   Lancer : python3 -m http.server 8931 --bind 127.0.0.1 --directory .');
    try { ws.close(); } catch {} chrome.kill(); process.exit(2);
  }

  try {
    try {
      /* Service worker et caches vidés : ils n'ont rien à faire dans un essai. */
      await goto('');
      await evalJS(`(async () => {
        if (navigator.serviceWorker) {
          const rs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(rs.map(r => r.unregister()));
        }
        if (window.caches) {
          const ks = await caches.keys();
          await Promise.all(ks.map(k => caches.delete(k)));
        }
        return true;
      })()`);
      await goto('');
      const servi = await evalJS(`document.querySelector('meta[name="triade-build"]')?.content || 'aucune'`);
      if (servi !== attendu) throw new Error(
        'la page testée n’est PAS la version du disque (page ' + servi + ' ≠ fichier ' + attendu + ') — cache à vider');
      console.log('build vérifié : ' + attendu + ' (page et fichier identiques)');

    /* 0 — L'instrument avant la mesure */
    await goto('');
    await calibre();

    /* 1 — Accueil, thème clair */
    await evalJS(`localStorage.clear()`);
    await goto('');
    await verifie('accueil · clair · 390px');
    await shot('01-accueil-clair');

    /* 2 — Accueil, thème sombre */
    await evalJS(`localStorage.setItem('triade:v1', JSON.stringify({theme:'dark'}))`);
    await goto('');
    await verifie('accueil · sombre · 390px');
    await shot('02-accueil-sombre');

    /* 3 — Séance, thème clair */
    await evalJS(`localStorage.setItem('triade:v1', JSON.stringify({theme:'light'}))`);
    await goto('#/socle');
    await verifie('séance Socle · clair · 390px');
    await shot('03-seance-haut');

    /* 4 — Défilement jusqu'au bloc de force, puis ouverture des détails */
    await evalJS(`document.querySelector('#bloc-1').scrollIntoView({block:'start',behavior:'instant'}); scrollBy(0,-120)`);
    await pause(350);
    await shot('04-seance-force');
    await tap('.det-btn');
    await verifie('séance · détails ouverts');
    await shot('05-details-ouverts');

    /* 4b — Les deux barres collantes ne doivent ni se chevaucher ni masquer un titre.
       Le titre visé doit être visible ET cliquable là où on croit le voir. */
    for (const pill of ['3', '2']) {
      await tap(`[data-bloc="${pill}"]`);
      await pause(700);
      const g = await evalJS(`(() => {
        const h = document.querySelector('.s-head').getBoundingClientRect();
        const n = document.querySelector('.blocnav').getBoundingClientRect();
        const b = document.querySelector('#bloc-${pill} .bloc-name').getBoundingClientRect();
        const centre = document.elementFromPoint(b.left + 4, b.top + b.height / 2);
        return { ecart: Math.round(n.top - h.bottom), titreSousBarre: Math.round(b.top - n.bottom),
                 auDessus: centre ? (centre.className || centre.tagName) : 'rien',
                 actif: document.querySelector('.tab.on')?.textContent.trim(),
                 actifAttendu: document.querySelector('.tab.on') === document.querySelectorAll('[data-bloc]')[${pill}] };
      })()`);
      bilan.push({ titre: `barres collantes · bloc ${pill} visé`, fenetre: '—', theme: '—', page: '—',
        soucis: [
          Math.abs(g.ecart) > 1 ? `barre des blocs décalée de ${g.ecart} px sous l’en-tête` : null,
          g.titreSousBarre < 0 ? `le titre du bloc est masqué de ${-g.titreSousBarre} px par la barre` : null,
          g.titreSousBarre > 90 ? `le titre s’arrête ${g.titreSousBarre} px trop bas` : null,
          /bloc-name/.test(String(g.auDessus)) ? null : `au point du titre on trouve : ${g.auDessus}`,
          g.actifAttendu ? null : `onglet actif : « ${g.actif} » au lieu du bloc ${+pill + 1}`
        ].filter(Boolean) });
    }
    await shot('04b-barres-collantes');

    /* 5 — Cocher une série : la PASTILLE apparaît, pas le plein écran */
    await evalJS(`document.querySelector('[data-ex="a-squat"]').scrollIntoView({block:'center',behavior:'instant'})`);
    await pause(250);
    await tap('[data-set="a-squat"][data-i="0"]');
    const p1 = await evalJS(`(() => {
      const mini = document.getElementById('restmini'), veil = document.getElementById('rest');
      const b = mini.getBoundingClientRect();
      const el = document.elementFromPoint(b.left + b.width/2, b.top + b.height/2);
      return { mini: getComputedStyle(mini).display, veil: getComputedStyle(veil).display,
               t: document.getElementById('mini-time').textContent,
               ctx: document.getElementById('mini-ctx').textContent,
               barre: document.getElementById('mini-bar').style.width,
               basDeLecran: Math.round(innerHeight - b.bottom), hauteur: Math.round(b.height),
               dessus: !el ? 'rien' : el.closest('#restmini') ? 'la pastille' : (el.id || el.className || el.tagName) };
    })()`);
    await pause(1500);
    const p2 = await evalJS(`document.getElementById('mini-time').textContent`);
    await shot('06-repos-pastille');
    bilan.push({ titre: 'une série cochée → pastille, pas plein écran', fenetre: '—', theme: '—', page: '—',
      soucis: [
        p1.mini === 'flex' ? null : 'la pastille ne s’affiche pas',
        p1.veil === 'none' ? null : 'le plein écran s’ouvre encore tout seul',
        p1.t !== p2 ? null : 'le décompte est figé (' + p1.t + ')',
        /2:2\d|2:3\d/.test(p1.t) ? null : 'durée de départ inattendue : ' + p1.t + ' (2\'30 attendues pour le squat)',
        /[Ss]quat/.test(p1.ctx) ? null : 'la pastille ne dit pas de quel exercice il s’agit : ' + p1.ctx,
        p1.barre && p1.barre !== '' ? null : 'pas de barre d’avancement dans la pastille',
        p1.basDeLecran < 120 ? null : 'pastille à ' + p1.basDeLecran + ' px du bas, hors zone du pouce',
        p1.hauteur >= 48 ? null : 'pastille de ' + p1.hauteur + ' px de haut',
        p1.dessus === 'la pastille' ? null : 'la pastille est recouverte par : ' + p1.dessus
      ].filter(Boolean) });

    /* 5a2 — Alignement DANS la pastille : mêmes lignes de base, tout centré.
       Un overflow:hidden sur un élément de texte décale sa ligne de base en CSS —
       le défaut est invisible à l'œil nu et se mesure. */
    const al = await evalJS(`(() => {
      const p = document.getElementById('restmini');
      const P = p.getBoundingClientRect();
      const base = (sel) => { const el = p.querySelector(sel); if (!el) return null;
        const s = document.createElement('span'); s.textContent = 'x';
        s.style.cssText = 'display:inline-block;width:0;overflow:hidden';
        el.appendChild(s); const r = s.getBoundingClientRect(); s.remove();
        return Math.round(r.bottom - P.top); };
      const centre = (sel) => { const el = p.querySelector(sel); if (!el) return null;
        const r = el.getBoundingClientRect();
        return Math.round((r.top + r.height / 2) - (P.top + P.height / 2)); };
      const bar = p.querySelector('#mini-bar').getBoundingClientRect();
      return { bTemps: base('#mini-time'), bLib: base('#mini-lab, #mini-ctx'), bPlus: base('#mini-plus'),
               cStop: centre('#mini-stop'), cPlus: centre('#mini-plus'),
               barDebord: Math.round(bar.width - P.width) };
    })()`);
    bilan.push({ titre: 'pastille · lignes de base et centrage', fenetre: '—', theme: '—', page: '—',
      soucis: [
        al.bTemps === al.bLib ? null : `temps et libellé sur deux lignes de base (${al.bTemps} vs ${al.bLib})`,
        al.bTemps === al.bPlus ? null : `temps et « +30 » sur deux lignes de base (${al.bTemps} vs ${al.bPlus})`,
        Math.abs(al.cStop) <= 1 ? null : `bouton de reprise décentré de ${al.cStop} px`,
        Math.abs(al.cPlus) <= 1 ? null : `bouton « +30 » décentré de ${al.cPlus} px`,
        al.barDebord <= 0 ? null : `la barre d’avancement dépasse de ${al.barDebord} px`
      ].filter(Boolean) });

    /* 5b — Le grand décompte reste accessible d'un appui, et se replie */
    await tap('#mini-open');
    const g1 = await evalJS(`({ veil: getComputedStyle(document.getElementById('rest')).display,
                                mini: getComputedStyle(document.getElementById('restmini')).display })`);
    await shot('06b-repos-plein-ecran');
    await tap('#rest-min');
    const g2 = await evalJS(`({ veil: getComputedStyle(document.getElementById('rest')).display,
                                mini: getComputedStyle(document.getElementById('restmini')).display })`);
    bilan.push({ titre: 'plein écran à la demande, puis replié', fenetre: '—', theme: '—', page: '—',
      soucis: [
        g1.veil === 'grid' && g1.mini === 'none' ? null : 'l’appui sur la pastille n’ouvre pas le grand décompte',
        g2.veil === 'none' && g2.mini === 'flex' ? null : 'impossible de revenir à la pastille'
      ].filter(Boolean) });
    await tap('#mini-stop');

    /* 5b2 — Le repos se lance depuis l'exercice, avec SA durée, et s'ajuste pour lui */
    const r1 = await evalJS(`document.querySelector('[data-rest="a-squat"] .num').textContent`);
    await tap('[data-rest="a-squat"]');
    const r2 = await evalJS(`({ mini: getComputedStyle(document.getElementById('restmini')).display,
                                t: document.getElementById('mini-time').textContent })`);
    await tap('#mini-plus');
    await pause(400);
    const r3 = await evalJS(`(() => ({
      chip: document.querySelector('[data-rest="a-squat"] .num').textContent,
      garde: /"rests":\{[^}]*a-squat/.test(localStorage.getItem('triade:v1') || '')
    }))()`);
    await shot('06c-repos-par-exercice');
    await tap('#mini-stop');
    bilan.push({ titre: 'repos lancé depuis l’exercice et ajusté pour lui', fenetre: '—', theme: '—', page: '—',
      soucis: [
        /2.30/.test(r1) ? null : 'le bouton de repos du squat affiche « ' + r1 + " » au lieu de 2'30",
        r2.mini === 'flex' ? null : 'l’appui sur le repos de l’exercice ne lance rien',
        /2:2\d|2:3\d/.test(r2.t) ? null : 'durée lancée : ' + r2.t + ' au lieu du repos de l’exercice',
        r3.chip !== r1 ? null : 'le + 30 s ne met pas à jour le repos de l’exercice (' + r3.chip + ')',
        r3.garde ? null : 'le repos ajusté n’est pas conservé pour cet exercice'
      ].filter(Boolean) });

    /* 5b3 — Chaque exercice du poste porte SON repos, y compris le deuxième du banc */
    const dr = await evalJS(`(() => {
      const b = document.querySelector('[data-rest="a-rowing-hal"]');
      return b ? b.querySelector('.num').textContent.trim() : null;
    })()`);
    if (dr) { await tap('[data-rest="a-rowing-hal"]'); }
    const drOk = dr ? await evalJS(`getComputedStyle(document.getElementById('restmini')).display`) : 'none';
    if (dr) await tap('#mini-stop');
    bilan.push({ titre: 'le deuxième exercice du banc porte son propre repos', fenetre: '—', theme: '—', page: '—',
      soucis: [dr ? null : 'pas de bouton de repos sur le rowing haltère',
               /1 min/.test(dr || '') ? null : 'le repos du rowing affiche « ' + dr + ' » au lieu de 1 min',
               dr && drOk === 'flex' ? null : 'le bouton du rowing ne lance pas le repos'].filter(Boolean) });

    /* 5c — Régler la charge sans clavier */
    const av = await evalJS(`document.querySelector('[data-load="a-squat"]').value`);
    await tap('[data-step="a-squat"][data-dir="1"]');
    await pause(350);
    const ap = await evalJS(`document.querySelector('[data-load="a-squat"]').value`);
    await tap('[data-step="a-squat"][data-dir="1"]');
    await pause(350);
    const ap2 = await evalJS(`document.querySelector('[data-load="a-squat"]').value`);
    await tap('[data-step="a-squat"][data-dir="-1"]');
    await pause(350);
    const ap3 = await evalJS(`document.querySelector('[data-load="a-squat"]').value`);
    bilan.push({ titre: 'charge réglable sans clavier (pas de 2,5 kg)', fenetre: '—', theme: '—', page: '—',
      soucis: [
        ap !== av ? null : 'le bouton + ne change rien (' + av + ')',
        ap2 !== ap ? null : 'le deuxième appui sur + ne change rien (' + ap + ')',
        ap3 === ap ? null : 'le bouton − ne revient pas à la valeur précédente (' + ap3 + ' au lieu de ' + ap + ')'
      ].filter(Boolean) });

    /* 5d — L'avancement de la séance doit se voir dans l'en-tête */
    const prog = await evalJS(`(() => {
      const f = document.getElementById('s-prog-fill');
      return { largeur: f ? f.style.width : null, sous: document.getElementById('s-head-sub')?.textContent };
    })()`);
    bilan.push({ titre: 'avancement visible dans l’en-tête', fenetre: '—', theme: '—', page: '—',
      soucis: [
        prog.largeur && prog.largeur !== '0%' ? null : 'la barre reste à ' + prog.largeur,
        /\d+\/\d+ séries/.test(prog.sous || '') ? null : 'le décompte de séries manque : ' + prog.sous
      ].filter(Boolean) });

    /* 6 — La série cochée reste cochée, la charge s'enregistre */
    await evalJS(`(() => {
      const inp = document.querySelector('[data-load="a-squat"]');
      inp.value = '82,5';
      inp.dispatchEvent(new Event('change'));
    })()`);
    await pause(500);   // l'écriture en mémoire est volontairement différée
    const etat = await evalJS(`(() => {
      const d = document.querySelector('[data-set="a-squat"][data-i="0"]');
      const brut = localStorage.getItem('triade:v1') || '';
      return { cochee: d.classList.contains('on'),
               enregistre: /82\\.5/.test(brut),
               relu: document.querySelector('[data-load="a-squat"]').value };
    })()`);
    bilan.push({ titre: 'série cochée + charge enregistrée', fenetre: '—', theme: '—', page: '—',
      soucis: [
        etat.cochee ? null : 'la série cochée est retombée',
        etat.enregistre ? null : 'la charge n’est pas dans la mémoire locale',
        etat.relu === '82,5' ? null : 'le champ affiche « ' + etat.relu + " » au lieu de 82,5"
      ].filter(Boolean) });

    /* 7 — Un exercice de poste a ses propres séries : elles se cochent et lancent son repos */
    await goto('#/socle');
    await tap('[data-set="a-couche-hal"][data-i="0"]');
    const suivi = await evalJS(`(() => {
      const pts = [...document.querySelectorAll('[data-set="a-couche-hal"]')];
      return { total: pts.length, on: pts.filter(d => d.classList.contains('on')).length,
               minuteur: getComputedStyle(document.getElementById('restmini')).display,
               temps: document.getElementById('mini-time').textContent };
    })()`);
    bilan.push({ titre: 'séries propres à chaque exercice du poste', fenetre: '—', theme: '—', page: '—',
      soucis: [suivi.total === 4 ? null : 'le développé haltères montre ' + suivi.total + ' séries au lieu de 4',
               suivi.on === 1 ? null : 'la série cochée n’est pas retenue (' + suivi.on + ')',
               suivi.minuteur === 'flex' ? null : 'cocher une série ne lance pas le repos',
               /0:5\d|1:00/.test(suivi.temps) ? null : 'repos lancé à ' + suivi.temps + ' au lieu de 1 min'].filter(Boolean) });
    await shot('07-series-par-exercice');
    await tap('#mini-stop');

    /* 8 — Les feuilles modales */
    await goto('');
    for (const [sel, nom] of [['#t-tabata', '08-tabata'], ['#t-guide', '09-methode'], ['#t-set', '10-reglages'], ['#t-timer', '11-minuteur']]) {
      await tap(sel);
      await verifie('feuille ' + nom.slice(3));
      await shot(nom);
      const ouvert = await evalJS(`getComputedStyle(document.getElementById('sheet')).display`);
      if (ouvert !== 'flex') bilan.push({ titre: 'feuille ' + nom, fenetre: '—', theme: '—', page: '—', soucis: ['ne s’ouvre pas'] });
      await evalJS(`document.getElementById('sheet').classList.remove('on')`);
      await pause(150);
    }

    /* 8b — L'écran des sources, atteint depuis la méthode, et le retour */
    await tap('#t-guide');
    await tap('#g-src');
    const src = await evalJS(`(() => {
      const s = document.getElementById('sheet-in');
      return { titre: s.querySelector('.sheet-title')?.textContent,
               etudes: (s.textContent.match(/coll\\./g) || []).length,
               retour: !!document.getElementById('p-back') };
    })()`);
    await verifie('écran des sources');
    await shot('08b-pourquoi-ces-exercices');
    await tap('#p-back');
    const retourOk = await evalJS(`document.querySelector('#sheet-in .sheet-title').textContent`);
    bilan.push({ titre: 'sources · accès depuis la méthode et retour', fenetre: '—', theme: '—', page: '—',
      soucis: [
        /Pourquoi/.test(src.titre || '') ? null : 'titre inattendu : ' + src.titre,
        src.etudes >= 5 ? null : 'seulement ' + src.etudes + ' études citées',
        src.retour ? null : 'pas de bouton de retour',
        /Comment mener/.test(retourOk) ? null : 'le retour ne ramène pas à la méthode (' + retourOk + ')'
      ].filter(Boolean) });
    await evalJS(`document.getElementById('sheet').classList.remove('on')`);
    await pause(150);

    /* 9 — Tabata lancé */
    await tap('#t-tabata');
    await tap('#tb-go');
    await pause(600);
    const tb = await evalJS(`(() => ({ affiche: getComputedStyle(document.getElementById('tab')).display,
      phase: document.getElementById('tab-phase').textContent, temps: document.getElementById('tab-time').textContent }))()`);
    await shot('12-tabata-en-cours');
    bilan.push({ titre: 'tabata lancé', fenetre: '—', theme: '—', page: '—',
      soucis: [tb.affiche === 'grid' ? null : 'ne démarre pas', tb.phase ? null : 'pas de phase affichée'].filter(Boolean) });
    await tap('#tab-stop');

    /* 9b — Aucun son : on espionne toute création d'objet audio pendant un tabata
       mené jusqu'à la fin (c'est le parcours qui sonnait le plus). */
    await goto('');
    await evalJS(`(() => {
      window.__audio = 0;
      const piege = new Proxy(function () {}, { construct() { window.__audio++; return { state: 'running', createOscillator() { window.__audio++; return {}; } }; } });
      window.AudioContext = piege; window.webkitAudioContext = piege; window.Audio = piege;
      const p = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { window.__audio++; return p.apply(this, arguments); };
      return true;
    })()`);
    await evalJS(`localStorage.setItem('triade:v1', JSON.stringify({ tabata: { prep: 0, work: 5, rest: 5, rounds: 1 } }))`);
    await goto('');
    /* Le piège doit être reposé après le rechargement. */
    await evalJS(`(() => {
      window.__audio = 0;
      const piege = new Proxy(function () {}, { construct() { window.__audio++; return { state: 'running', createOscillator() { window.__audio++; return {}; } }; } });
      window.AudioContext = piege; window.webkitAudioContext = piege; window.Audio = piege;
      return true;
    })()`);
    await tap('#t-tabata');
    await tap('#tb-go');
    await pause(7000);
    const audio = await evalJS(`({ n: window.__audio, tabFini: getComputedStyle(document.getElementById('tab')).display })`);
    bilan.push({ titre: 'aucun son produit (tabata mené à son terme)', fenetre: '—', theme: '—', page: '—',
      soucis: [
        audio.n === 0 ? null : audio.n + ' objet(s) audio créés — il reste du son',
        audio.tabFini === 'none' ? null : 'le tabata ne s’est pas terminé, l’essai ne prouve rien'
      ].filter(Boolean) });

    /* 10 — Grand écran */
    await goto('#/charniere', DESKTOP);
    await verifie('séance Charnière · grand écran 1280px');
    await shot('13-desktop');

    /* 11 — Toutes les séances passées en revue, thème sombre */
    await evalJS(`localStorage.setItem('triade:v1', JSON.stringify({theme:'dark'}))`);
    for (const k of ['socle', 'charniere', 'amplitude']) {
      await goto('#/' + k);
      await verifie('séance ' + k + ' · sombre · 390px');
      await evalJS(`scrollTo(0, document.body.scrollHeight)`);
      await pause(300);
      await shot('14-' + k + '-sombre-bas');
    }
    } catch (e) {
      planté = e;
    }
  } finally {
    /* ─── Impression du bilan ─── */
    if (planté) {
      bilan.push({ titre: 'LE SCÉNARIO S’EST ARRÊTÉ EN COURS DE ROUTE', fenetre: '—', theme: '—', page: '—',
        soucis: [planté.message, 'contrôles joués : ' + bilan.length + ' sur ' + ATTENDUS + ' — le reste n’a PAS été vérifié'] });
    } else if (bilan.length < ATTENDUS) {
      bilan.push({ titre: 'SCÉNARIO INCOMPLET', fenetre: '—', theme: '—', page: '—',
        soucis: [bilan.length + ' contrôles joués sur ' + ATTENDUS + ' attendus'] });
    }
    console.log('\n══════ BILAN ══════');
    let n = 0;
    for (const b of bilan) {
      const ok = b.soucis.length === 0;
      if (!ok) n += b.soucis.length;
      console.log(`${ok ? '✓' : '✗'} ${b.titre}  [${b.fenetre}${b.theme !== '—' ? ' · ' + b.theme : ''}${b.page !== '—' ? ' · page ' + b.page : ''}]`);
      for (const s of b.soucis) console.log('     · ' + s);
    }
    const utiles = erreurs.filter((e) => !/favicon|manifest|sw\.js|service worker/i.test(e));
    console.log(`\nerreurs JavaScript : ${utiles.length}`);
    for (const e of [...new Set(utiles)].slice(0, 12)) console.log('   ! ' + e);
    console.log(`\n${n} point${n > 1 ? 's' : ''} à corriger · captures dans ${SHOTS}`);
    try { ws.close(); } catch {}
    chrome.kill();
    process.exit(n + utiles.length > 0 ? 1 : 0);
  }
}

main().catch((e) => { console.error('ÉCHEC DU PILOTE : ' + e.message); process.exit(2); });

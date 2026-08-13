/* ═══════════════════════════════════════════════════════════
   TRIADE — application
   Un seul fichier, aucune dépendance, tout en mémoire locale.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var P = JSON.parse(document.getElementById('payload').textContent);
  var FIG = JSON.parse(document.getElementById('figures').textContent);
  var KEY = 'triade:v1';
  var app = document.getElementById('app');

  /* ─────────── Petits outils ─────────── */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function daysBetween(iso) {
    if (!iso) return null;
    var p = iso.split('-');
    var a = new Date(+p[0], +p[1] - 1, +p[2]);
    var b = new Date();
    a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0);
    return Math.round((b - a) / 86400000);
  }

  function agoLabel(iso) {
    var d = daysBetween(iso);
    if (d === null) return 'jamais faite';
    if (d === 0) return "aujourd'hui";
    if (d === 1) return 'hier';
    if (d < 7) return 'il y a ' + d + ' jours';
    if (d < 14) return 'il y a 1 semaine';
    if (d < 31) return 'il y a ' + Math.floor(d / 7) + ' semaines';
    return 'il y a plus d’un mois';
  }

  function fmtNum(v) {
    if (v == null || v === '') return '';
    var n = Math.round(Number(v) * 100) / 100;
    return String(n).replace('.', ',');
  }

  function parseNum(s) {
    if (s == null) return NaN;
    var v = String(s).replace(',', '.').replace(/[^\d.\-]/g, '');
    return v === '' ? NaN : Number(v);
  }

  function mmss(sec) {
    sec = Math.max(0, Math.round(sec));
    return Math.floor(sec / 60) + ':' + pad(sec % 60);
  }

  function restLabel(sec) {
    if (!sec) return null;
    if (sec % 60 === 0) return (sec / 60) + ' min';
    if (sec < 60) return sec + ' sec';
    return Math.floor(sec / 60) + "'" + pad(sec % 60);
  }

  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  var toastT;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }

  /* ─────────── Pictogrammes ─────────── */
  var I = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5z"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .33 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.06 1.7 1.7 0 0 0-.33-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-1.5zM8 7h7M8 11h7"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13m0 0 5-5m-5 5-5-5M4 21h16"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V3m0 0 5 5m-5-5L7 8M4 21h16"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" style="width:9px;height:9px;display:inline-block;vertical-align:baseline"><path d="M7 4l13 8-13 8z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
  };

  /* ─────────── Mémoire locale ─────────── */
  var S = {
    theme: 'auto',
    loads: {},   // exId -> [{d:'YYYY-MM-DD', v:82.5}]
    notes: {},   // exId -> texte
    sets: {},    // date -> { exId: [bool,...] }
    rounds: {},  // date -> { ssId: n }
    hist: {},    // sessionKey -> ['YYYY-MM-DD', ...]
    rests: {},   // exId | ssId -> repos ajusté à la main pour cet exercice
    tabata: { work: 20, rest: 10, rounds: 8, prep: 10 },
    lastTimer: 90
  };

  function loadState() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      ['theme', 'lastTimer'].forEach(function (k) { if (o[k] != null) S[k] = o[k]; });
      ['loads', 'notes', 'sets', 'rounds', 'hist', 'rests'].forEach(function (k) { if (o[k]) S[k] = o[k]; });
      if (o.tabata) for (var k in o.tabata) S.tabata[k] = o.tabata[k];
    } catch (e) { console.warn('mémoire illisible', e); }
  }

  var saveT;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(S)); }
      catch (e) { toast('Mémoire du navigateur pleine'); }
    }, 180);
  }

  /* ─────────── Thème ─────────── */
  var mq = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme() {
    var dark = S.theme === 'dark' || (S.theme === 'auto' && mq.matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  mq.addEventListener('change', function () { if (S.theme === 'auto') applyTheme(); });

  /* ─────────── Accès au programme ─────────── */
  function allItems(sess) {
    var out = [];
    sess.blocs.forEach(function (b) { b.items.forEach(function (it) { out.push(it); }); });
    return out;
  }

  function exercisesOf(item) {
    return item.type === 'superset' ? item.exercises : [item];
  }

  function findEx(id) {
    for (var k in P.sessions) {
      var items = allItems(P.sessions[k]);
      for (var i = 0; i < items.length; i++) {
        var list = exercisesOf(items[i]);
        for (var j = 0; j < list.length; j++) if (list[j].id === id) return list[j];
      }
    }
    return null;
  }

  function findAny(id) {
    for (var k in P.sessions) {
      var items = allItems(P.sessions[k]);
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) return items[i];
        var list = exercisesOf(items[i]);
        for (var j2 = 0; j2 < list.length; j2++) if (list[j2].id === id) return list[j2];
      }
    }
    return null;
  }

  /* Repos de CET exercice : celui du programme, ou celui que tu as réglé toi-même. */
  function restOf(id) {
    var o = findAny(id);
    if (S.rests[id] != null) return S.rests[id];
    return (o && o.rest) || 0;
  }

  function setRestOf(id, sec) {
    var o = findAny(id);
    sec = Math.min(600, Math.max(15, sec));
    if (o && o.rest === sec) delete S.rests[id]; else S.rests[id] = sec;
    save();
  }

  /* ─────────── Suivi du jour ─────────── */
  function todaySets(exId, n) {
    var d = today();
    S.sets[d] = S.sets[d] || {};
    var a = S.sets[d][exId];
    if (!Array.isArray(a) || a.length !== n) {
      a = [];
      for (var i = 0; i < n; i++) a.push(false);
      S.sets[d][exId] = a;
    }
    return a;
  }

  function todayRounds(ssId) {
    var d = today();
    S.rounds[d] = S.rounds[d] || {};
    if (typeof S.rounds[d][ssId] !== 'number') S.rounds[d][ssId] = 0;
    return S.rounds[d][ssId];
  }

  function sessionUnits(sess) {
    var total = 0, done = 0;
    allItems(sess).forEach(function (it) {
      if (it.type === 'superset') {
        total += it.rounds;
        done += Math.min(it.rounds, todayRounds(it.id));
      } else {
        total += it.sets || 1;
        todaySets(it.id, it.sets || 1).forEach(function (v) { if (v) done++; });
      }
    });
    return { total: total, done: done };
  }

  function exCount(sess) {
    var n = 0;
    allItems(sess).forEach(function (it) { n += exercisesOf(it).length; });
    return n;
  }

  function markSessionDone(key) {
    var d = today();
    S.hist[key] = S.hist[key] || [];
    if (S.hist[key].indexOf(d) === -1) { S.hist[key].push(d); S.hist[key].sort(); }
    save();
  }

  function lastDone(key) {
    var h = S.hist[key];
    return h && h.length ? h[h.length - 1] : null;
  }

  function thisWeekCount(key) {
    var h = S.hist[key] || [];
    var now = new Date();
    var dow = (now.getDay() + 6) % 7;           // lundi = 0
    var monday = new Date(now); monday.setDate(now.getDate() - dow); monday.setHours(0, 0, 0, 0);
    return h.filter(function (d) {
      var p = d.split('-');
      return new Date(+p[0], +p[1] - 1, +p[2]) >= monday;
    }).length;
  }

  /* ─────────── Charges ─────────── */
  function loadHist(exId) { return S.loads[exId] || []; }

  function lastLoad(exId) {
    var h = loadHist(exId);
    return h.length ? h[h.length - 1] : null;
  }

  function suggestLoad(ex) {
    var h = loadHist(ex.id);
    if (!h.length) return null;
    var last = h[h.length - 1].v;
    var step = ex.step || 2.5;
    // Deux séances de suite à la même charge : il est temps de monter.
    var same = 1;
    for (var i = h.length - 2; i >= 0; i--) { if (h[i].v === last) same++; else break; }
    return { value: same >= 2 ? last + step : last, up: same >= 2, same: same };
  }

  function setLoad(exId, val) {
    var h = S.loads[exId] = S.loads[exId] || [];
    var d = today();
    if (h.length && h[h.length - 1].d === d) h[h.length - 1].v = val;
    else h.push({ d: d, v: val });
    if (h.length > 40) h.splice(0, h.length - 40);
    save();
  }

  /* ═══════════ ACCUEIL ═══════════ */
  function renderHome() {
    document.body.style.removeProperty('--a');
    document.body.style.removeProperty('--a2');

    var keys = P.order;
    var weekTotal = keys.reduce(function (n, k) { return n + thisWeekCount(k); }, 0);

    var cards = keys.map(function (k) {
      var s = P.sessions[k];
      var u = sessionUnits(s);
      var pct = u.total ? Math.round(u.done / u.total * 100) : 0;
      return '' +
        '<button class="card" data-go="' + k + '" style="--a:' + s.accent + '">' +
          '<span class="card-code">' + esc(s.code) + '</span>' +
          '<span class="card-body">' +
            '<span class="card-title">' + esc(s.title) + '</span>' +
            '<span class="card-sub">' + esc(s.subtitle) + '</span>' +
            '<span class="card-meta">' + exCount(s) + ' exercices · ' + esc(s.duration) +
              ' · ' + esc(agoLabel(lastDone(k))) + '</span>' +
            (u.done ?
              '<span class="card-prog">' +
                '<span class="bar"><span class="bar-fill" style="width:' + pct + '%"></span></span>' +
                '<span class="card-prog-txt">' + u.done + '/' + u.total + ' séries</span>' +
              '</span>' : '') +
          '</span>' +
        '</button>';
    }).join('');

    var dots = keys.map(function (k) {
      var on = thisWeekCount(k) > 0;
      return '<div class="week-dot' + (on ? ' on' : '') + '" style="--dotcolor:' + P.sessions[k].accent + '" title="' + esc(P.sessions[k].title) + '"></div>';
    }).join('');

    app.innerHTML = '' +
      '<div class="wrap">' +
        '<header class="top"><div class="top-row">' +
          '<div>' +
            '<h1 class="brand-name">' + esc(P.meta.name) + '</h1>' +
            '<p class="brand-sub">' + esc(P.meta.tagline) + '</p>' +
          '</div>' +
          '<div class="icon-btn-row">' +
            '<button class="icon-btn" id="theme-btn" aria-label="Changer de thème"></button>' +
            '<button class="icon-btn" id="set-btn" aria-label="Réglages">' + I.gear + '</button>' +
          '</div>' +
        '</div></header>' +

        '<div class="week">' +
          '<div>' +
            '<div class="week-label">Cette semaine</div>' +
            '<div class="week-count">' + weekTotal + ' séance' + (weekTotal > 1 ? 's' : '') + ' sur 3</div>' +
          '</div>' +
          '<div class="week-dots">' + dots + '</div>' +
        '</div>' +

        '<div class="deck">' + cards + '</div>' +

        '<div class="section-label">Outils</div>' +
        '<div class="tools">' +
          '<button class="tool" id="t-timer"><div class="tool-ico">' + I.timer + '</div><div class="tool-name">Minuteur</div><div class="tool-sub">Repos libre</div></button>' +
          '<button class="tool" id="t-tabata"><div class="tool-ico">' + I.bolt + '</div><div class="tool-name">Tabata</div><div class="tool-sub">Intervalles</div></button>' +
          '<button class="tool" id="t-guide"><div class="tool-ico">' + I.book + '</div><div class="tool-name">Méthode</div><div class="tool-sub">Comment progresser</div></button>' +
          '<button class="tool" id="t-set"><div class="tool-ico">' + I.gear + '</div><div class="tool-name">Réglages</div><div class="tool-sub">Thème, données</div></button>' +
        '</div>' +

        '<p class="foot">' + esc(P.meta.cycle) + '<br>Tout est enregistré sur cet appareil uniquement.</p>' +
      '</div>';

    paintThemeBtn();

    $$('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { location.hash = '#/' + b.getAttribute('data-go'); });
    });
    $('#theme-btn').addEventListener('click', cycleTheme);
    $('#set-btn').addEventListener('click', sheetSettings);
    $('#t-set').addEventListener('click', sheetSettings);
    $('#t-timer').addEventListener('click', sheetTimer);
    $('#t-tabata').addEventListener('click', sheetTabata);
    $('#t-guide').addEventListener('click', sheetGuide);

    window.scrollTo(0, 0);
  }

  function paintThemeBtn() {
    var b = $('#theme-btn');
    if (!b) return;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    b.innerHTML = dark ? I.moon : I.sun;
  }

  function cycleTheme() {
    S.theme = S.theme === 'auto' ? 'light' : (S.theme === 'light' ? 'dark' : 'auto');
    applyTheme(); paintThemeBtn(); save();
    toast('Thème : ' + (S.theme === 'auto' ? 'automatique' : S.theme === 'light' ? 'clair' : 'sombre'));
  }

  /* ═══════════ VUE SÉANCE ═══════════ */
  var curKey = null;

  function renderSession(key) {
    curKey = key;
    var s = P.sessions[key];
    document.body.style.setProperty('--a', s.accent);
    document.body.style.setProperty('--a2', s.accent2);

    var nav = s.blocs.map(function (b, i) {
      return '<button class="tab' + (i === 0 ? ' on' : '') + '" data-bloc="' + i + '">' + esc(b.name.split('—')[0].trim()) + '</button>';
    }).join('');

    var blocs = s.blocs.map(function (b, bi) {
      var items = b.items.map(function (it, ii) {
        return it.type === 'superset' ? renderSuperset(it, ii) : renderEx(it, ii + 1, false);
      }).join('');
      /* Le poste est un creux teinté ; chaque exercice est une carte posée dedans.
         Sans ce contraste, un titre de poste et un exercice se ressemblaient. */
      return '' +
        '<section class="bloc" id="bloc-' + bi + '">' +
          '<div class="bloc-head">' +
            '<span class="bloc-n">' + esc(b.n) + '</span>' +
            '<span class="bloc-name">' + esc(b.name) + '</span>' +
            '<span class="bloc-dur">' + esc(b.duration || '') + '</span>' +
          '</div>' +
          (b.sub ? '<div class="bloc-sub">' + esc(b.sub) + '</div>' : '') +
          '<div class="bloc-corps">' + items + '</div>' +
        '</section>';
    }).join('');

    app.innerHTML = '' +
      '<header class="s-head"><div class="wrap"><div class="s-head-in">' +
        '<button class="back" id="back" aria-label="Retour">' + I.back + '</button>' +
        '<div class="s-head-txt">' +
          '<div class="s-head-sub" id="s-head-sub">Séance ' + esc(s.code) + '</div>' +
          '<h1 class="s-head-title">' + esc(s.title) + '</h1>' +
        '</div>' +
        '<button class="s-head-btn" id="quick-timer">' + I.timer + '<span id="quick-timer-lab">' + S.lastTimer + 's</span></button>' +
      '</div>' +
        '<div class="s-prog"><div class="s-prog-fill" id="s-prog-fill"></div></div>' +
      '</div></header>' +
      '<nav class="blocnav"><div class="blocnav-in" id="blocnav">' + nav + '</div></nav>' +
      '<div class="wrap">' +
        '<div class="s-intro">' + esc(s.intro) + '</div>' +
        blocs +
        '<p class="foot">Séance ' + esc(s.code) + ' · ' + esc(s.duration) + '<br>' + esc(agoLabel(lastDone(key))) + '</p>' +
      '</div>';

    wireSession(s);
    majAvancement();
    window.scrollTo(0, 0);
  }

  function renderSuperset(ss, idx) {
    var done = todayRounds(ss.id);
    var dots = '';
    for (var i = 1; i <= ss.rounds; i++) {
      dots += '<button class="pt ronde' + (i <= done ? ' on' : '') + '" data-round="' + ss.id + '" data-n="' + i + '" aria-label="Tour ' + i + '">' +
        (i <= done ? I.check : i) + '</button>';
    }
    var exs = ss.exercises.map(function (e, i) { return renderEx(e, i + 1, true); }).join('');
    var rs = restOf(ss.id);
    return '' +
      '<div class="ss" data-ss="' + ss.id + '">' +
        '<div class="ss-head">' +
          '<span class="ss-badge">Superset · ' + ss.rounds + ' tours</span>' +
          (rs ? '<button class="repos" data-rest="' + ss.id + '" aria-label="Lancer le repos du superset">' +
            I.timer + '<span class="num">' + esc(restLabel(rs)) + '</span></button>' : '') +
          '<span class="ss-note">' + esc(ss.label || '') + '</span>' +
        '</div>' +
        exs +
        '<div class="ss-rounds">' +
          '<span class="ss-rounds-lab">Tours</span>' + dots +
          (done ? '<button class="effacer" data-resetss="' + ss.id + '">effacer</button>' : '') +
        '</div>' +
      '</div>';
  }

  /* Ce que le cuivre du schéma désigne. Les échauffements n'ont pas de muscle
     visé — la ligne disparaît alors au lieu d'annoncer un travail qui n'est
     pas le but de l'exercice. */
  function musclesTexte(id) {
    var m = FIG.muscles[id];
    if (!m) return '';
    var directs = [], soutien = [];
    Object.keys(m).forEach(function (k) { (m[k] >= 1 ? directs : soutien).push(k); });
    if (!directs.length) return '';
    return '<div class="fig-mus-txt">Travaille <b>' + esc(directs.join(' · ')) + '</b>' +
      (soutien.length ? '<span> — en soutien : ' + esc(soutien.join(', ')) + '</span>' : '') +
      '</div>';
  }

  function renderEx(ex, n, inSuper) {
    /* Une ligne de méta remplace les quatre cases : même information, aucun pavé. */
    var duree = /min|sec|s$/.test(String(ex.reps));
    var meta = [duree ? esc(ex.reps) : (ex.sets + ' × ' + esc(ex.reps))];
    if (ex.tempo && /\d/.test(String(ex.tempo))) meta.push('tempo ' + esc(ex.tempo));
    if (ex.loadHint) meta.push('repère ' + esc(ex.loadHint));

    var rs = inSuper ? 0 : restOf(ex.id);
    var arr = todaySets(ex.id, ex.sets || 1);
    var allDone = !inSuper && arr.every(function (v) { return v; });

    var setsHtml = '';
    if (!inSuper) {
      var dots = arr.map(function (on, i) {
        return '<button class="pt' + (on ? ' on' : '') + '" data-set="' + ex.id + '" data-i="' + i + '" aria-label="Série ' + (i + 1) + '">' +
          (on ? I.check : (i + 1)) + '</button>';
      }).join('');
      setsHtml = '<div class="rang series">' + dots +
        (arr.some(function (v) { return v; }) ? '<button class="effacer" data-reset="' + ex.id + '">effacer</button>' : '') +
        '</div>';
    }

    return '' +
      '<article class="exo' + (allDone ? ' done' : '') + '" data-ex="' + ex.id + '">' +
        '<div class="exo-tete">' +
          '<div class="exo-txt">' +
            '<div class="exo-name">' + esc(ex.name) + (allDone ? '<span class="exo-fait">✓</span>' : '') + '</div>' +
            '<div class="exo-sub">' + esc(ex.sub) + '</div>' +
            '<div class="exo-meta num">' + meta.join(' · ') + '</div>' +
          '</div>' +
          (rs ? '<button class="repos" data-rest="' + ex.id + '" aria-label="Lancer le repos de cet exercice">' +
            I.timer + '<span class="num">' + esc(restLabel(rs)) + '</span></button>' : '') +
        '</div>' +
        setsHtml +
        '<div class="zone-charge">' + (ex.trackLoad ? renderLoad(ex) : '') + '</div>' +
        '<div class="det">' +
          '<button class="det-btn">Comment le faire' + I.chevron + '</button>' +
          '<div class="det-body">' +
            /* Ordre du volet : on regarde le geste, on se met en place, on
               exécute, on vérifie — l'ordre dans lequel ça arrive au poste. */
            (FIG.svg[ex.id] ? '<div class="note-block fig-zone">' + FIG.svg[ex.id] +
              '<div class="fig-leg"><span class="fig-leg-a"></span>départ' +
              '<span class="fig-leg-b"></span>fin</div>' + musclesTexte(ex.id) +
              '</div>' : '') +
            (ex.setup ? '<div class="note-block"><div class="note-k"><span class="kdot"></span>Mise en place</div>' +
              '<div class="note-t">' + esc(ex.setup) + '</div></div>' : '') +
            '<div class="note-block"><div class="note-k"><span class="kdot"></span>Exécution</div>' +
              '<div class="note-t">' + esc(ex.execution) + '</div></div>' +
            (ex.reussi ? '<div class="note-block"><div class="note-k ok"><span class="kdot"></span>C’est bien fait quand</div>' +
              '<div class="note-t ok">' + esc(ex.reussi) + '</div></div>' : '') +
            (ex.avoid ? '<div class="note-block"><div class="note-k warn"><span class="kdot"></span>À éviter</div>' +
              '<div class="note-t warn">' + esc(ex.avoid) + '</div></div>' : '') +
            (ex.alt ? '<div class="note-block"><div class="note-k alt"><span class="kdot"></span>Alternative</div>' +
              '<div class="note-t alt">' + esc(ex.alt) + '</div></div>' : '') +
            (ex.trackLoad ? '<div class="note-block hist-zone">' + renderHist(ex) + '</div>' : '') +
            '<div class="note-block" style="margin-bottom:0"><div class="note-k"><span class="kdot"></span>Ma note</div>' +
              '<textarea class="myn" data-note="' + ex.id + '" placeholder="Ressenti, réglage de la machine, siège n°4…">' + esc(S.notes[ex.id] || '') + '</textarea></div>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  /* L'historique des charges quitte l'écran de séance pour le volet des détails. */
  function renderHist(ex) {
    var h = loadHist(ex.id);
    if (h.length < 2) return '';
    return '<div class="note-k"><span class="kdot"></span>Historique</div>' +
      '<div class="load-hist">' + h.slice(-10).reverse().map(function (x) {
        return '<button class="hchip" data-hist="' + ex.id + '" data-d="' + x.d + '"><b>' + fmtNum(x.v) + '</b><span>' +
          x.d.slice(8) + '/' + x.d.slice(5, 7) + '</span></button>';
      }).join('') + '</div>';
  }

  function renderLoad(ex) {
    var last = lastLoad(ex.id);
    var sg = suggestLoad(ex);
    var h = loadHist(ex.id);
    var todayVal = (h.length && h[h.length - 1].d === today()) ? h[h.length - 1].v : '';

    var sugg = sg ? '<button class="sugg" data-sugg="' + ex.id + '" data-v="' + sg.value + '">' +
      (sg.up ? '↑ ' : '= ') + fmtNum(sg.value) + ' kg</button>' : '';

    return '' +
      '<div class="rang charge">' +
        '<button class="pas" data-step="' + ex.id + '" data-dir="-1" aria-label="Baisser la charge">−</button>' +
        '<div class="poids-box">' +
          '<input class="poids num" type="text" inputmode="decimal" data-load="' + ex.id + '" value="' + esc(fmtNum(todayVal)) + '" placeholder="—" aria-label="Charge en kilos">' +
          '<span class="poids-unit">kg</span>' +
        '</div>' +
        '<button class="pas" data-step="' + ex.id + '" data-dir="1" aria-label="Monter la charge">+</button>' +
        sugg +
      '</div>' +
      (last ? '<div class="dernier">dernière fois <b>' + fmtNum(last.v) + ' kg</b> · ' + esc(agoLabel(last.d)) + '</div>' : '');
  }

  /* ─────────── Interactions de la séance ─────────── */
  /* Hauteur réelle de l'en-tête : la barre des blocs et les ancres s'y calent,
     sinon un titre qui passe à la ligne masque le haut de chaque bloc. */
  function mesureEntete() {
    var h = $('.s-head');
    if (!h) return 0;
    var v = Math.round(h.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--head-h', v + 'px');
    return v;
  }

  function decalage() {
    var h = $('.s-head'), n = $('.blocnav');
    return (h ? h.getBoundingClientRect().height : 65) + (n ? n.getBoundingClientRect().height : 58) + 12;
  }

  window.addEventListener('resize', function () { if (curKey) mesureEntete(); });

  function wireSession(s) {
    $('#back').addEventListener('click', function () { location.hash = ''; });

    $('#quick-timer').addEventListener('click', function () { sheetTimer(); });

    // Navigation par blocs
    $$('[data-bloc]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = $('#bloc-' + b.getAttribute('data-bloc'));
        if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - decalage(), behavior: 'smooth' });
      });
    });
    mesureEntete();
    setupSpy();

    // Séries
    app.addEventListener('click', onSessionClick);

    // Charges
    $$('[data-load]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var id = inp.getAttribute('data-load');
        var v = parseNum(inp.value);
        if (isNaN(v) || v < 0) { inp.value = ''; return; }
        setLoad(id, v);
        refreshLoad(id);
        toast(fmtNum(v) + ' kg enregistré');
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') inp.blur(); });
    });

    // Notes
    $$('[data-note]').forEach(function (ta) {
      ta.addEventListener('input', function () {
        S.notes[ta.getAttribute('data-note')] = ta.value;
        save();
      });
    });

    // Détails
    $$('.det-btn').forEach(function (b) {
      b.addEventListener('click', function () { b.parentNode.classList.toggle('open'); });
    });
  }

  function onSessionClick(e) {
    var t = e.target.closest ? e.target.closest('button') : null;
    if (!t) return;

    // une série
    if (t.hasAttribute('data-set')) {
      var id = t.getAttribute('data-set');
      var i = +t.getAttribute('data-i');
      var ex = findEx(id);
      var arr = todaySets(id, ex.sets || 1);
      arr[i] = !arr[i];
      save();
      markSessionDone(curKey);
      refreshSets(id);
      buzz(18);
      if (arr[i] && restOf(id) && i < arr.length - 1) startRest(restOf(id), ex.name, id);
      return;
    }

    // un tour de superset
    if (t.hasAttribute('data-round')) {
      var ssId = t.getAttribute('data-round');
      var n = +t.getAttribute('data-n');
      var cur = todayRounds(ssId);
      S.rounds[today()][ssId] = (cur === n) ? n - 1 : n;
      save();
      markSessionDone(curKey);
      var ss = findSuperset(ssId);
      refreshRounds(ssId);
      buzz(18);
      if (S.rounds[today()][ssId] === n && ss && restOf(ssId) && n < ss.rounds) startRest(restOf(ssId), 'Tour ' + n + ' sur ' + ss.rounds, ssId);
      return;
    }

    if (t.hasAttribute('data-reset')) {
      var rid = t.getAttribute('data-reset');
      var rex = findEx(rid);
      var a = todaySets(rid, rex.sets || 1);
      for (var k = 0; k < a.length; k++) a[k] = false;
      save(); refreshSets(rid);
      return;
    }

    if (t.hasAttribute('data-resetss')) {
      var sid = t.getAttribute('data-resetss');
      S.rounds[today()][sid] = 0;
      save(); refreshRounds(sid);
      return;
    }

    if (t.hasAttribute('data-rest')) {
      var rid = t.getAttribute('data-rest');
      var ro = findAny(rid);
      startRest(restOf(rid), (ro && ro.name) || 'Repos', rid);
      buzz(14);
      return;
    }

    if (t.hasAttribute('data-step')) {
      var eid = t.getAttribute('data-step');
      var dir = +t.getAttribute('data-dir');
      var e2 = findEx(eid);
      var inp0 = $('[data-load="' + eid + '"]');
      var base = parseNum(inp0 && inp0.value);
      if (isNaN(base)) { var l0 = lastLoad(eid); base = l0 ? l0.v : 0; }
      var pas = e2.step || 2.5;
      var nv = Math.max(0, Math.round((base + dir * pas) / pas) * pas);
      setLoad(eid, nv);
      refreshLoad(eid);
      buzz(14);
      return;
    }

    if (t.hasAttribute('data-sugg')) {
      var sid2 = t.getAttribute('data-sugg');
      var v = +t.getAttribute('data-v');
      setLoad(sid2, v);
      refreshLoad(sid2);
      toast(fmtNum(v) + ' kg enregistré');
      return;
    }

    if (t.hasAttribute('data-hist')) {
      sheetEditHist(t.getAttribute('data-hist'), t.getAttribute('data-d'));
      return;
    }
  }

  function findSuperset(id) {
    for (var k in P.sessions) {
      var items = allItems(P.sessions[k]);
      for (var i = 0; i < items.length; i++) if (items[i].type === 'superset' && items[i].id === id) return items[i];
    }
    return null;
  }

  /* Avancement de la séance : lisible d'un coup d'œil sans quitter l'exercice. */
  function majAvancement() {
    if (!curKey) return;
    var u = sessionUnits(P.sessions[curKey]);
    var f = $('#s-prog-fill');
    if (f) f.style.width = (u.total ? Math.round(u.done / u.total * 100) : 0) + '%';
    var sub = $('#s-head-sub');
    if (sub) sub.textContent = 'Séance ' + P.sessions[curKey].code + ' · ' + u.done + '/' + u.total + ' séries';
  }

  function refreshSets(exId) {
    var ex = findEx(exId);
    var arr = todaySets(exId, ex.sets || 1);
    var card = $('[data-ex="' + exId + '"]');
    if (!card) return;
    $$('[data-set="' + exId + '"]', card).forEach(function (d, i) {
      var on = !!arr[i];
      d.classList.toggle('on', on);
      d.innerHTML = on ? I.check : (i + 1);
    });
    majAvancement();

    var zone = $('.series', card);
    var eff = zone ? $('.effacer', zone) : null;
    var qq = arr.some(function (v) { return v; });
    if (zone && qq && !eff) {
      eff = document.createElement('button');
      eff.className = 'effacer';
      eff.setAttribute('data-reset', exId);
      eff.textContent = 'effacer';
      zone.appendChild(eff);
    } else if (eff && !qq) { eff.remove(); }

    var all = arr.every(function (v) { return v; });
    card.classList.toggle('done', all);
    var nom = $('.exo-name', card);
    if (nom) {
      var marque = $('.exo-fait', nom);
      if (all && !marque) {
        marque = document.createElement('span');
        marque.className = 'exo-fait';
        marque.textContent = '✓';
        nom.appendChild(marque);
      } else if (marque && !all) { marque.remove(); }
    }
  }

  function refreshRounds(ssId) {
    var done = todayRounds(ssId);
    var zone = $('[data-ss="' + ssId + '"] .ss-rounds');
    $$('[data-round="' + ssId + '"]').forEach(function (d, i) {
      var on = (i + 1) <= done;
      d.classList.toggle('on', on);
      d.innerHTML = on ? I.check : (i + 1);
    });
    majAvancement();
    if (!zone) return;
    var eff = $('.effacer', zone);
    if (done && !eff) {
      eff = document.createElement('button');
      eff.className = 'effacer';
      eff.setAttribute('data-resetss', ssId);
      eff.textContent = 'effacer';
      zone.appendChild(eff);
    } else if (eff && !done) { eff.remove(); }
  }

  function refreshLoad(exId) {
    var card = $('[data-ex="' + exId + '"]');
    if (!card) return;
    var box = $('.zone-charge', card);
    if (!box) return;
    box.innerHTML = renderLoad(findEx(exId));
    var hz = $('.hist-zone', card);
    if (hz) hz.innerHTML = renderHist(findEx(exId));
    var inp = $('[data-load="' + exId + '"]', card);
    if (inp) {
      inp.addEventListener('change', function () {
        var v = parseNum(inp.value);
        if (isNaN(v) || v < 0) { inp.value = ''; return; }
        setLoad(exId, v); refreshLoad(exId);
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') inp.blur(); });
    }
  }

  /* ─────────── Repère de bloc au défilement ─────────── */
  var spyHandler = null;

  function setupSpy() {
    if (spyHandler) window.removeEventListener('scroll', spyHandler);
    var blocs = $$('.bloc');
    var pills = $$('[data-bloc]');
    var nav = $('#blocnav');
    if (!blocs.length || !nav) return;
    var ticking = false, lastIdx = -1;

    function update() {
      ticking = false;
      var y = window.scrollY + decalage() + 24;
      var idx = 0;
      for (var i = 0; i < blocs.length; i++) if (blocs[i].offsetTop <= y) idx = i;
      if (idx === lastIdx) return;
      lastIdx = idx;
      pills.forEach(function (p, i) { p.classList.toggle('on', i === idx); });
      var btn = pills[idx];
      if (btn) {
        var target = btn.offsetLeft - nav.clientWidth / 2 + btn.clientWidth / 2;
        nav.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
      }
    }

    spyHandler = function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', spyHandler, { passive: true });
    update();
  }

  /* ═══════════ ÉCRAN ═══════════ */
  /* Aucun son : la fin de repos se signale par la vibration (quand l’appareil la
     gère) et par la pastille qui passe au vert. */

  var lock = null;

  function keepAwake() {
    try {
      if ('wakeLock' in navigator && !lock) {
        navigator.wakeLock.request('screen').then(function (l) {
          lock = l;
          l.addEventListener('release', function () { lock = null; });
        }).catch(function () {});
      }
    } catch (e) {}
  }

  function releaseAwake() { try { if (lock) { lock.release(); lock = null; } } catch (e) {} }

  /* ═══════════ MINUTEUR DE REPOS ═══════════ */
  var restEnd = 0, restTotal = 0, restTick = null;

  var restOwner = null;

  function startRest(sec, ctx, owner) {
    if (!sec) return;
    restTotal = sec;
    restEnd = Date.now() + sec * 1000;
    restOwner = owner || null;
    S.lastTimer = sec; save();
    var lab = $('#quick-timer-lab');
    if (lab) lab.textContent = restLabel(sec);
    $('#rest-ctx').textContent = ctx || 'Repos';
    var court = String(ctx || 'repos');
    if (court.length > 17) court = court.slice(0, 16).trim() + '…';
    $('#mini-ctx').textContent = court;
    /* Par défaut on n'occupe PAS l'écran : la pastille suffit, le plein écran
       reste accessible d'un appui pour qui veut le gros décompte. */
    $('#restmini').classList.remove('fini');
    $('#restmini').classList.add('on');
    $('#rest').classList.remove('on');
    document.body.classList.add('timer-on');
    keepAwake();
    tickRest();
    clearInterval(restTick);
    restTick = setInterval(tickRest, 200);
  }

  var lastCount = -1;

  function tickRest() {
    var left = (restEnd - Date.now()) / 1000;
    if (left <= 0) {
      $('#rest-time').textContent = '0:00';
      $('#mini-time').textContent = '0:00';
      $('#rest-jauge').style.width = '0%';
      endRest(true);
      return;
    }
    $('#rest-time').textContent = mmss(left);
    $('#mini-time').textContent = mmss(left);
    $('#mini-bar').style.width = Math.max(0, Math.min(100, left / restTotal * 100)) + '%';
    $('#rest-jauge').style.width = Math.max(0, Math.min(100, left / restTotal * 100)) + '%';
    var c = Math.ceil(left);
    if (c <= 3 && c !== lastCount) { lastCount = c;buzz(15); }
  }

  function reduireRepos() {
    $('#rest').classList.remove('on');
    $('#restmini').classList.add('on');
  }

  function ouvrirRepos() {
    $('#restmini').classList.remove('on');
    $('#rest').classList.add('on');
  }

  function endRest(rang) {
    clearInterval(restTick); restTick = null;
    lastCount = -1;
    $('#rest').classList.remove('on');
    releaseAwake();
    var mini = $('#restmini');
    if (rang) {
      /* Fin de repos : la pastille passe au vert quelques secondes plutôt que de
         disparaître sans rien dire. */ buzz([90, 60, 90]);
      mini.classList.add('on', 'fini');
      $('#mini-time').textContent = 'Reprends';
      $('#mini-bar').style.width = '100%';
      setTimeout(function () {
        mini.classList.remove('on', 'fini');
        document.body.classList.remove('timer-on');
      }, 3500);
    } else {
      mini.classList.remove('on', 'fini');
      document.body.classList.remove('timer-on');
    }
  }

  function ajuste(delta) {
    restEnd += delta * 1000;
    restTotal = Math.max(15, restTotal + delta);
    if (restEnd - Date.now() < 1000) { endRest(false); return; }
    tickRest();
    if (restOwner) {
      setRestOf(restOwner, restTotal);
      var el = $('[data-rest="' + restOwner + '"] .num');
      if (el) el.textContent = restLabel(restOf(restOwner));
      toast('Repos de cet exercice : ' + restLabel(restOf(restOwner)));
    }
  }

  $('#rest-plus').addEventListener('click', function () { ajuste(30); });
  $('#rest-minus').addEventListener('click', function () { ajuste(-15); });
  $('#mini-plus').addEventListener('click', function () { ajuste(30); });
  $('#rest-skip').addEventListener('click', function () { endRest(false); });
  $('#rest-min').addEventListener('click', reduireRepos);
  $('#mini-open').addEventListener('click', ouvrirRepos);
  $('#mini-stop').addEventListener('click', function () { endRest(false); });

  /* ═══════════ TABATA ═══════════ */
  var T = { on: false, phase: 'prep', round: 0, end: 0, paused: false, left: 0, tick: null };

  function tabStart() {
    var c = S.tabata;
    T.on = true; T.round = 0; T.paused = false;
    $('#tab').classList.add('on');
    keepAwake();
    tabPhase('prep', c.prep);
    clearInterval(T.tick);
    T.tick = setInterval(tabTick, 120);
  }

  function tabPhase(ph, sec) {
    T.phase = ph;
    T.end = Date.now() + sec * 1000;
    T.total = sec;
    var v = $('#tab');
    v.classList.remove('phase-work', 'phase-rest', 'phase-prep');
    v.classList.add(ph === 'work' ? 'phase-work' : ph === 'rest' ? 'phase-rest' : 'phase-prep');
    $('#tab-phase').textContent = ph === 'work' ? 'effort' : ph === 'rest' ? 'repos' : 'départ';
    $('#tab-round').textContent = ph === 'prep'
      ? 'Prêt · ' + S.tabata.rounds + ' tours de ' + S.tabata.work + ' s'
      : 'Tour ' + Math.max(1, T.round) + ' sur ' + S.tabata.rounds;
    buzz(ph === 'work' ? [70, 40, 70] : 40);
  }

  function tabTick() {
    if (!T.on || T.paused) return;
    var left = (T.end - Date.now()) / 1000;
    if (left <= 0) { tabAdvance(); return; }
    $('#tab-time').textContent = String(Math.ceil(left));
    $('#tab-jauge').style.width = Math.max(0, Math.min(100, left / T.total * 100)) + '%';
    var c = Math.ceil(left);
    if (c <= 3 && c !== T.lastC) { T.lastC = c;}
  }

  function tabAdvance() {
    var c = S.tabata;
    T.lastC = -1;
    if (T.phase === 'prep') { T.round = 1; tabPhase('work', c.work); return; }
    if (T.phase === 'work') {
      if (T.round >= c.rounds) { tabEnd(true); return; }
      tabPhase('rest', c.rest); return;
    }
    T.round++; tabPhase('work', c.work);
  }

  function tabEnd(finished) {
    T.on = false;
    clearInterval(T.tick); T.tick = null;
    $('#tab').classList.remove('on');
    releaseAwake();
    if (finished) { setTimeout(function () {}, 260);
      buzz([120, 80, 120, 80, 200]);
      toast('Tabata terminé · ' + S.tabata.rounds + ' tours');
    }
  }

  $('#tab-pause').addEventListener('click', function () {
    if (!T.on) return;
    if (T.paused) { T.end = Date.now() + T.left * 1000; T.paused = false; $('#tab-pause').textContent = 'Pause'; }
    else { T.left = (T.end - Date.now()) / 1000; T.paused = true; $('#tab-pause').textContent = 'Reprendre'; }
  });
  $('#tab-next').addEventListener('click', function () { if (T.on) tabAdvance(); });
  $('#tab-stop').addEventListener('click', function () { tabEnd(false); });

  /* ═══════════ FEUILLES MODALES ═══════════ */
  function openSheet(html) {
    $('#sheet-in').innerHTML = '<div class="grip"></div>' + html;
    $('#sheet').classList.add('on');
  }

  function closeSheet() { $('#sheet').classList.remove('on'); }

  $('#sheet').addEventListener('click', function (e) { if (e.target.id === 'sheet') closeSheet(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if ($('#sheet').classList.contains('on')) closeSheet();
    else if ($('#rest').classList.contains('on')) endRest(false);
    else if ($('#tab').classList.contains('on')) tabEnd(false);
  });

  /* ─── Minuteur libre ─── */
  function sheetTimer() {
    var presets = [45, 60, 75, 90, 120, 150, 180, 240];
    openSheet(
      '<h2 class="sheet-title">Minuteur de repos</h2>' +
      '<p class="sheet-sub">Choisis une durée. L’écran reste allumé, et la pastille pulse à la fin — sans aucun son.</p>' +
      '<div class="field"><span class="field-lab">Durées courantes</span>' +
        '<div class="durees">' +
          presets.map(function (p) {
            return '<button class="duree num" data-preset="' + p + '">' +
              (p >= 60 ? (p % 60 === 0 ? (p / 60) + ' min' : mmss(p)) : p + ' s') + '</button>';
          }).join('') +
        '</div></div>' +
      '<div class="field"><span class="field-lab">Sur mesure</span>' +
        '<div class="stepper">' +
          '<button class="step-btn" data-d="-15">−</button>' +
          '<div class="step-val num" id="tm-val">' + S.lastTimer + '<small>sec</small></div>' +
          '<button class="step-btn" data-d="15">+</button>' +
        '</div></div>' +
      '<button class="btn btn-primary btn-wide" id="tm-go">Lancer</button>'
    );

    var val = S.lastTimer;
    $$('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () { closeSheet(); startRest(+b.getAttribute('data-preset'), 'Repos'); });
    });
    $$('[data-d]', $('#sheet-in')).forEach(function (b) {
      b.addEventListener('click', function () {
        val = Math.min(600, Math.max(15, val + (+b.getAttribute('data-d'))));
        $('#tm-val').innerHTML = val + '<small>sec</small>';
      });
    });
    $('#tm-go').addEventListener('click', function () { closeSheet(); startRest(val, 'Repos'); });
  }

  /* ─── Réglage du tabata ─── */
  function sheetTabata() {
    var c = S.tabata;
    var fields = [
      { k: 'prep', lab: 'Départ', unit: 'sec', min: 0, max: 60, step: 5 },
      { k: 'work', lab: 'Effort', unit: 'sec', min: 5, max: 300, step: 5 },
      { k: 'rest', lab: 'Repos', unit: 'sec', min: 0, max: 300, step: 5 },
      { k: 'rounds', lab: 'Tours', unit: '', min: 1, max: 40, step: 1 }
    ];
    openSheet(
      '<h2 class="sheet-title">Tabata</h2>' +
      '<p class="sheet-sub">Intervalles effort / repos. Réglage classique : 20 s d’effort, 10 s de repos, 8 tours.</p>' +
      fields.map(function (f) {
        return '<div class="field"><span class="field-lab">' + f.lab + '</span>' +
          '<div class="stepper">' +
            '<button class="step-btn" data-tk="' + f.k + '" data-dir="-1">−</button>' +
            '<div class="step-val num" id="tb-' + f.k + '">' + c[f.k] + (f.unit ? '<small>' + f.unit + '</small>' : '') + '</div>' +
            '<button class="step-btn" data-tk="' + f.k + '" data-dir="1">+</button>' +
          '</div></div>';
      }).join('') +
      '<div class="sheet-sub" id="tb-total" style="text-align:center;margin:2px 0 14px"></div>' +
      '<button class="btn btn-primary btn-wide" id="tb-go">Lancer le tabata</button>'
    );

    function total() {
      var t = c.prep + c.rounds * c.work + (c.rounds - 1) * c.rest;
      $('#tb-total').textContent = 'Durée totale : ' + mmss(t);
    }
    total();

    $$('[data-tk]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-tk');
        var f = fields.filter(function (x) { return x.k === k; })[0];
        c[k] = Math.min(f.max, Math.max(f.min, c[k] + f.step * (+b.getAttribute('data-dir'))));
        $('#tb-' + k).innerHTML = c[k] + (f.unit ? '<small>' + f.unit + '</small>' : '');
        total(); save();
      });
    });
    $('#tb-go').addEventListener('click', function () { closeSheet(); tabStart(); });
  }

  /* ─── Correction d'une charge ─── */
  function sheetEditHist(exId, date) {
    var h = loadHist(exId);
    var entry = null;
    for (var i = 0; i < h.length; i++) if (h[i].d === date) entry = h[i];
    if (!entry) return;
    var ex = findEx(exId);
    openSheet(
      '<h2 class="sheet-title">' + esc(ex.name) + '</h2>' +
      '<p class="sheet-sub">Charge du ' + date.split('-').reverse().join('/') + '</p>' +
      '<div class="field"><span class="field-lab">Charge en kg</span>' +
        '<div class="stepper"><input class="load-in num" id="eh-in" type="text" inputmode="decimal" value="' + esc(fmtNum(entry.v)) + '" style="flex:1;width:auto;height:48px;font-size:22px"></div>' +
      '</div>' +
      '<div class="row-list">' +
        '<button class="row-btn" id="eh-save">' + I.check + '<div class="row-btn-txt"><div class="row-btn-name">Enregistrer</div></div></button>' +
        '<button class="row-btn danger" id="eh-del">' + I.trash + '<div class="row-btn-txt"><div class="row-btn-name">Supprimer cette entrée</div></div></button>' +
      '</div>'
    );
    $('#eh-save').addEventListener('click', function () {
      var v = parseNum($('#eh-in').value);
      if (isNaN(v) || v < 0) { toast('Valeur invalide'); return; }
      entry.v = v; save(); closeSheet(); refreshLoad(exId); toast('Corrigé');
    });
    $('#eh-del').addEventListener('click', function () {
      S.loads[exId] = h.filter(function (e) { return e.d !== date; });
      save(); closeSheet(); refreshLoad(exId); toast('Entrée supprimée');
    });
  }

  /* ─── Méthode ─── */
  function bloc(k, t, cls) {
    var c = cls ? ' ' + cls : '';
    return '<div class="note-block"><div class="note-k' + c + '"><span class="kdot"></span>' + k + '</div>' +
      '<div class="note-t' + c + '">' + t + '</div></div>';
  }

  function sheetGuide() {
    openSheet(
      '<h2 class="sheet-title">Comment mener le programme</h2>' +
      '<p class="sheet-sub">Trois séances par semaine, dans l’ordre A puis B puis C, avec au moins un jour de repos entre chacune. Lundi / mercredi / vendredi fonctionne très bien.</p>' +
      bloc('Une séance = trois postes, et on ne revient pas',
        'Chaque séance est organisée par poste de salle, pas par muscle : tu t’installes, tu fais tout ce qu’il y a à faire là, puis tu passes au suivant. Le rack pour le seul mouvement lourd, un banc que tu gardes pour deux ou trois exercices, puis une zone — câbles ou machines — où tout s’enchaîne. Aucun superset ne mélange deux postes éloignés : c’est exactement ce qui te fait perdre ton banc. Regrouper ainsi coûte deux à trois minutes par séance, et c’est le prix pour ne rien rendre.') +
      bloc('Pourquoi trois séances complètes',
        'Chaque muscle est ainsi travaillé trois fois par semaine. Le seuil utile se situe à deux fois : au-delà, c’est le nombre total de séries dans la semaine qui compte, pas la façon de les répartir. Trois séances complètes sont donc un moyen de répartir le volume, pas une fin en soi — et si tu n’en fais que deux dans une semaine, tu gardes l’essentiel.') +
      bloc('Combien de séries par muscle',
        'Le programme sort 10 à 16 séries par semaine sur les gros muscles (pectoraux, dos, quadriceps, fessiers) et 6 à 10 sur les petits. C’est la zone où les études situent le meilleur rapport entre résultat et fatigue. En faire plus continue de payer, mais de moins en moins vite, et le temps de récupération augmente.') +
      bloc('À quelle intensité — le point le plus important',
        'Pour la prise de muscle, plus la série se termine près de l’échec, plus elle compte. Pour la force, la proximité de l’échec change peu de choses. D’où deux consignes différentes : sur les mouvements lourds des blocs 02, garde 2 à 3 répétitions en réserve ; sur tout le reste, termine à 0 à 2 répétitions de l’échec. Si une série casse en cours de route, la charge était trop lourde : baisse-la de 5 à 10 %.') +
      bloc('Quand monter la charge',
        'Quand tu réussis toutes les séries au nombre de répétitions prévu, proprement, deux séances de suite : ajoute le plus petit incrément disponible (2,5 kg à la barre, 2 kg par haltère). La pastille verte à côté de la charge te le propose automatiquement.') +
      bloc('Le tempo, sans en faire une religion',
        'Les trois chiffres se lisent ainsi — 3-1-1 : trois secondes pour descendre, une seconde d’arrêt en bas, une seconde pour remonter. Entre une demi-seconde et huit secondes par répétition, les résultats sont équivalents : ce qui compte est de contrôler la descente, pas de chronométrer. Seul le très lent (dix secondes et plus) est franchement moins bon.') +
      bloc('Le repos',
        'Deux à trois minutes sur les mouvements lourds, jamais moins d’une minute ailleurs. Les repos courts font perdre des répétitions à la série suivante, et donc du volume utile. Le minuteur s’en occupe.') +
      bloc('Les alternatives ne sont pas un pis-aller',
        'À volume égal, machines et poids libres donnent la même prise de muscle. La barre garde un avantage quand c’est la force à la barre qu’on veut mesurer. Donc si le rack est pris, prends la machine sans état d’âme.') +
      bloc('Ce qui n’est pas négociable',
        'L’échauffement du bloc 01 avant les charges lourdes, et l’arrêt d’une série dès que la technique se casse. Une douleur articulaire vive n’est pas une courbature : passe à l’alternative proposée sous l’exercice.', 'warn') +
      bloc('Si tu manques de temps',
        'Saute le dernier poste. Tu gardes le mouvement lourd et le banc, soit l’essentiel, en 40 minutes.', 'alt') +
      '<button class="btn btn-primary btn-wide" id="g-src">Pourquoi ces exercices précisément</button>' +
      '<div style="height:9px"></div>' +
      '<button class="btn btn-ghost btn-wide" id="g-close">Fermer</button>'
    );
    $('#g-close').addEventListener('click', closeSheet);
    $('#g-src').addEventListener('click', sheetPreuves);
  }

  /* ─── Pourquoi ces exercices ─── */
  function sheetPreuves() {
    openSheet(
      '<h2 class="sheet-title">Pourquoi ces exercices</h2>' +
      '<p class="sheet-sub">Chaque choix ci-dessous vient d’une comparaison directe entre deux exercices ou deux façons de faire, dans une étude publiée. Les références complètes sont dans le fichier SOURCES.md du projet.</p>' +
      bloc('Triceps : bras au-dessus de la tête, pas devant soi',
        'À charge et volume égaux, l’extension bras au-dessus de la tête a produit environ 40 % de croissance en plus que la version devant soi (pushdown), sur les trois faisceaux du triceps. Raison : le chef long y travaille étiré. <i>Maeo et coll., 2023.</i>') +
      bloc('Biceps : curl incliné',
        'Bras qui pendent derrière le corps, le biceps travaille étiré : la croissance est plus marquée sur la partie haute du bras qu’avec un curl au pupitre, qui développe davantage le bas. <i>Comparaison directe incliné / pupitre, 2025.</i>') +
      bloc('Ischios : leg curl assis et non couché',
        'Douze semaines, une jambe assise, l’autre couchée : +14 % contre +9 %, avec un écart plus du double sur le chef long du biceps fémoral. Assis, la hanche fléchie place l’ischio en position étirée. <i>Maeo et coll., 2021.</i>') +
      bloc('Mollets : debout et non assis',
        'Debout genou tendu : +9 à 12 % de volume. Assis genou fléchi : +1 à 2 %. Le mollet ne grossit que travaillé étiré, et la version assise n’apporte rien de plus sur le soléaire. <i>Kinoshita et coll., 2023.</i>') +
      bloc('Ce qui a été retiré pour tenir sous une heure',
        'Presse à cuisses, leg extension et hip thrust sont sortis du programme : ils faisaient doublon avec le squat, les bulgares et le soulevé roumain. Sur les fessiers, une comparaison par IRM a montré une croissance équivalente entre hip thrust et squat — le premier n’apportait donc rien de plus. <i>Plotkin et coll., 2023.</i> Si tu remets un leg extension un jour, travaille la moitié BASSE du mouvement, genou fléchi : c’est la portion la plus rentable, l’inverse de l’habitude. <i>Pedrosa et coll., 2022.</i>') +
      bloc('Squat : descendre franchement',
        'Passer sous les 90° au genou ne change presque rien pour le quadriceps, mais donne significativement plus de fessiers et d’adducteurs. C’est la seule raison de chercher la profondeur — et elle suffit. <i>Kubo et coll., 2019 ; Bloomquist et coll., 2013.</i>') +
      bloc('Développé incliné en plus du couché à plat',
        'Le développé incliné développe le haut des pectoraux, que le développé à plat ne va pas chercher. Les deux sont dans le programme pour cette raison, en séances différentes. <i>Chaves et coll., 2020.</i>') +
      bloc('Un seul mouvement lourd par séance',
        'Le reste passe en supersets de deux exercices qui ne se gênent pas. C’est ce qui fait tenir la séance en 55 minutes au lieu de 75, sans retirer une seule série utile. <i>Méta-analyse Sports Medicine, 2025.</i>') +
      bloc('Les supersets',
        'Enchaîner deux exercices qui ne se gênent pas (un tirage et une poussée) raccourcit nettement la séance sans faire perdre de répétitions ni de résultat. C’est le seul raccourci de temps qui ne coûte rien. <i>Méta-analyse Sports Medicine, 2025.</i>') +
      bloc('Ce que le programme ne cherche pas',
        'Le programme est orienté haut du corps : 2,3 séries de haut pour 1 de bas. Les quadriceps sont à 7 séries par semaine, le poste le plus bas, et c’est assumé. Si tu veux plus de jambes, ajoute une presse à cuisses 3 × 12 en fin de séance B. Aucun exercice direct pour les adducteurs ni les lombaires : le squat et le soulevé roumain les chargent assez dans ce cadre.', 'alt') +
      '<button class="btn btn-ghost btn-wide" id="p-back">Retour à la méthode</button>'
    );
    $('#p-back').addEventListener('click', sheetGuide);
  }

  /* ─── Réglages ─── */
  function sheetSettings() {
    var nLoads = Object.keys(S.loads).length;
    var nDays = Object.keys(S.sets).length;
    openSheet(
      '<h2 class="sheet-title">Réglages</h2>' +
      '<p class="sheet-sub">' + nLoads + ' exercice' + (nLoads > 1 ? 's' : '') + ' suivi' + (nLoads > 1 ? 's' : '') + ' en charge · ' + nDays + ' jour' + (nDays > 1 ? 's' : '') + ' d’entraînement enregistré' + (nDays > 1 ? 's' : '') + '</p>' +
      '<div class="field"><span class="field-lab">Apparence</span>' +
        '<div class="seg" id="seg-theme">' +
          '<button data-th="auto"' + (S.theme === 'auto' ? ' class="on"' : '') + '>Auto</button>' +
          '<button data-th="light"' + (S.theme === 'light' ? ' class="on"' : '') + '>Clair</button>' +
          '<button data-th="dark"' + (S.theme === 'dark' ? ' class="on"' : '') + '>Sombre</button>' +
        '</div></div>' +
      '<div class="field"><span class="field-lab">Mes données</span>' +
        '<div class="row-list">' +
          '<button class="row-btn" id="st-exp">' + I.down + '<div class="row-btn-txt"><div class="row-btn-name">Exporter</div><div class="row-btn-sub">Un fichier avec tes charges, notes et séances</div></div></button>' +
          '<button class="row-btn" id="st-imp">' + I.up + '<div class="row-btn-txt"><div class="row-btn-name">Importer</div><div class="row-btn-sub">Remplace les données de cet appareil</div></div></button>' +
          '<button class="row-btn danger" id="st-res">' + I.trash + '<div class="row-btn-txt"><div class="row-btn-name">Tout effacer</div><div class="row-btn-sub">Sans retour possible</div></div></button>' +
        '</div></div>' +
      '<p class="foot" style="margin:16px 0 0">' + esc(P.meta.name) + ' ' + esc(P.meta.version) + ' · fonctionne hors ligne</p>'
    );

    $$('[data-th]').forEach(function (b) {
      b.addEventListener('click', function () {
        S.theme = b.getAttribute('data-th');
        applyTheme(); save();
        $$('[data-th]').forEach(function (x) { x.classList.toggle('on', x === b); });
        paintThemeBtn();
      });
    });

    $('#st-exp').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify({ app: 'triade', version: P.meta.version, exportedAt: new Date().toISOString(), data: S }, null, 1)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'triade-' + today() + '.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      toast('Fichier exporté');
    });

    $('#st-imp').addEventListener('click', function () {
      var f = document.createElement('input');
      f.type = 'file'; f.accept = 'application/json,.json';
      f.addEventListener('change', function () {
        var file = f.files && f.files[0];
        if (!file) return;
        var r = new FileReader();
        r.onload = function () {
          try {
            var o = JSON.parse(r.result);
            var d = o.data || o;
            if (!d || typeof d !== 'object' || (!d.loads && !d.sets && !d.hist)) throw new Error('format');
            ['theme', 'lastTimer'].forEach(function (k) { if (d[k] != null) S[k] = d[k]; });
            ['loads', 'notes', 'sets', 'rounds', 'hist', 'rests'].forEach(function (k) { if (d[k]) S[k] = d[k]; });
            if (d.tabata) for (var k in d.tabata) S.tabata[k] = d.tabata[k];
            save(); applyTheme(); closeSheet(); route();
            toast('Données importées');
          } catch (e) { toast('Fichier illisible'); }
        };
        r.readAsText(file);
      });
      f.click();
    });

    $('#st-res').addEventListener('click', function () {
      openSheet(
        '<h2 class="sheet-title">Tout effacer ?</h2>' +
        '<p class="sheet-sub">Charges, historiques, notes et séances faites seront supprimés de cet appareil. Cette action est définitive — pense à exporter d’abord.</p>' +
        '<div class="row-list">' +
          '<button class="btn btn-danger btn-wide" id="rs-yes">Oui, tout effacer</button>' +
          '<button class="btn btn-ghost btn-wide" id="rs-no">Annuler</button>' +
        '</div>'
      );
      $('#rs-no').addEventListener('click', closeSheet);
      $('#rs-yes').addEventListener('click', function () {
        S.loads = {}; S.notes = {}; S.sets = {}; S.rounds = {}; S.hist = {}; S.rests = {};
        try { localStorage.removeItem(KEY); } catch (e) {}
        save(); closeSheet(); route(); toast('Données effacées');
      });
    });
  }

  /* ═══════════ ROUTAGE ═══════════ */
  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    if (h && P.sessions[h]) renderSession(h);
    else { curKey = null; renderHome(); }
  }

  window.addEventListener('hashchange', route);

  /* Reprise après mise en veille : on recale les minuteurs. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (restTick) tickRest();
    if (T.on && !T.paused) tabTick();
  });

  /* ═══════════ DÉMARRAGE ═══════════ */
  loadState();
  applyTheme();
  route();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();

'use strict';
/* צמחי ארץ ישראל — גרסת אתר. מאת: איתן נוה */
const VERSION = '__VERSION__';
const $app = document.getElementById('app');

/* ---------- text helpers ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
function norm(s) {
  return String(s || '').toLowerCase().replace(/[֑-ׇ]/g, '').replace(/["'׳״\-־.,()]/g, ' ')
    .replace(/[ךםןףץ]/g, c => FINALS[c]).replace(/\s+/g, ' ').trim();
}
const skel = s => s.replace(/[יו]/g, '');
function dist(a, b, cap = 3) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const SEASONS = [['חורף', [12, 1, 2]], ['אביב', [3, 4, 5]], ['קיץ', [6, 7, 8]], ['סתיו', [9, 10, 11]]];
const GROUPS = { tree: 'עץ', shrub: 'שיח', climber: 'מטפס', annual: 'עשבוני חד־שנתי', perennial: 'עשבוני רב־שנתי' };
const COLORS = { white: 'לבן', yellow: 'צהוב', red: 'אדום', pink: 'ורוד', purple: 'סגול', blue: 'כחול', orange: 'כתום' };
const NATIVE = { native: 'מקומי (צמח בר של הארץ)', introduced: 'מובא' };
const monthsText = m => [...m].sort((a, b) => a - b).map(x => MONTHS[x - 1]).join(', ');
const nowMonth = () => new Date().getMonth() + 1;

/* ---------- dates: Gregorian and Hebrew on every page ---------- */
function gem(n) {
  const L = [[400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'], [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י'], [9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א']];
  let s = '';
  while (n >= 400) { s += 'ת'; n -= 400; }
  if (n === 15 || n === 16) return s + (n === 15 ? 'טו' : 'טז');
  for (const [v, c] of L) if (v < 400 && n >= v) { s += c; n -= v; if (n === 15 || n === 16) { s += n === 15 ? 'טו' : 'טז'; n = 0; } }
  return s;
}
const mark = s => s.length === 1 ? s + '׳' : s.slice(0, -1) + '״' + s.slice(-1);
function hebrewDate(d = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('he-IL-u-ca-hebrew-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(d);
    const get = t => (parts.find(p => p.type === t) || {}).value || '';
    const day = parseInt(get('day'), 10), year = parseInt(get('year'), 10);
    let month = get('month');
    if (!month || !day) throw 0;
    return `${mark(gem(day))} ${month.startsWith('ב') ? month : 'ב' + month} ${mark(gem(year % 1000))}`;
  } catch (e) { return ''; }
}
const gregDate = (d = new Date()) => new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
const bothDates = (d = new Date()) => [gregDate(d), hebrewDate(d)].filter(Boolean).join(' · ');

/* ---------- storage ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('tz.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('tz.' + k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem('tz.' + k); } catch (e) { } },
};
const favs = () => new Set(store.get('favs', []));
function toggleFav(key) { const f = favs(); f.has(key) ? f.delete(key) : f.add(key); store.set('favs', [...f]); }

const idb = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('tzimchei', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('obs', { keyPath: 'id', autoIncrement: true });
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction('obs', mode); const s = t.objectStore('obs'); let out;
      Promise.resolve(fn(s)).then(v => { out = v; });
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error);
    });
  },
  add(o) { return this.tx('readwrite', s => new Promise(r => { s.add(o).onsuccess = e => r(e.target.result); })); },
  put(o) { return this.tx('readwrite', s => { s.put(o); }); },
  all() { return this.tx('readonly', s => new Promise(r => { s.getAll().onsuccess = e => r(e.target.result.sort((a, b) => b.time - a.time)); })); },
  del(id) { return this.tx('readwrite', s => { s.delete(id); }); },
  clear() { return this.tx('readwrite', s => { s.clear(); }); },
};

/* ---------- data ---------- */
const D = { plants: [], byKey: new Map(), bySci: new Map(), regions: [], families: {}, toxic: new Map(), garden: null, grow: {}, guide: null, edible: [], medicinal: [], rambam: null, nursery: null };
const P = p => ({ title: p.he || p.sci, total: Object.values(p.reg || {}).reduce((a, b) => a + b, 0) });
function bloomsIn(p, m) {
  const b = p.bloom || [];
  if (b.length !== 12) return false;
  const peak = Math.max(...b); if (!peak) return false;
  const v = b[m - 1];
  return p.bsrc === 'text' ? v > 0 : v >= Math.max(1, peak * 0.1);
}
const bloomMonths = p => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(m => bloomsIn(p, m));
const isWoody = p => p.grp === 'tree' || p.grp === 'shrub';
const famHe = p => D.families[p.fam] || '';
const thumb = u => /inaturalist/.test(u) ? u.replace(/\/original\./, '/medium.') : u;
const large = u => /inaturalist/.test(u) ? u.replace(/\/(original|medium)\./, '/large.') : u;
const pairs = a => (a || []).map(x => Array.isArray(x) ? { t: x[0], u: x[1] } : (typeof x === 'string' ? { t: x, u: '' } : { t: x.t || x.name || '', u: x.u || x.url || '' }));

async function getJSON(name) {
  const r = await fetch('data/' + name, { cache: 'no-cache' });
  if (!r.ok) throw new Error(name + ' ' + r.status);
  return r.json();
}
async function loadAll() {
  const [pl, tox, gar, grow, guide, ed, med, ram] = await Promise.all(['plants.json', 'toxic.json', 'garden.json', 'grow.json', 'guide.json', 'edible.json', 'medicinal.json', 'rambam.json'].map(getJSON));
  D.regions = pl.regions; D.families = pl.families; D.generated = pl.generated;
  D.plants = pl.plants || [].concat(...await Promise.all(Array.from({ length: pl.parts || 0 }, (_, i) => getJSON('plants-' + i + '.json'))));
  for (const p of D.plants) {
    const x = P(p); p.title = x.title; p.total = x.total;
    D.byKey.set(Number(p.k), p);
  }
  for (const p of D.plants) for (const s of p.syn || []) if (!D.bySci.has(s.toLowerCase())) D.bySci.set(s.toLowerCase(), p);
  for (const p of D.plants) D.bySci.set(p.sci.toLowerCase(), p);
  for (const t of tox) D.toxic.set(Number(t.k), t);
  D.garden = gar; D.grow = grow; D.guide = guide; D.edible = ed; D.medicinal = med; D.rambam = ram;
}
let nurseryP = null;
function loadNursery() { return nurseryP || (nurseryP = getJSON('nursery.json').then(n => { D.nursery = n; n.plants.forEach((p, i) => { p.i = i; p.norm = norm(p.he + ' ' + p.fam + ' ' + p.form); }); return n; })); }

function rank(query, plants) {
  const words = norm(query).split(' ').filter(Boolean);
  if (!words.length) return plants;
  const out = [];
  for (const p of plants) {
    const fields = [p.he, p.sci, p.en, p.fam, famHe(p), ...(p.alt || []), ...(p.syn || [])].filter(Boolean).map(norm);
    let sum = 0, ok = true;
    for (const w of words) {
      let best = 0;
      fields.forEach((f, i) => {
        const main = i < 2; let s = 0;
        if (f === w) s = 100; else if (f.startsWith(w)) s = 80; else if (f.split(' ').some(x => x.startsWith(w))) s = 70;
        else if (w.length >= 2 && f.includes(w)) s = 50; else if (w.length >= 3 && f.split(' ').some(x => skel(x) === skel(w))) s = 45;
        else if (w.length >= 4 && f.split(' ').some(x => dist(x, w, 2) <= (w.length >= 7 ? 2 : 1))) s = 30;
        best = Math.max(best, main && s ? s + 5 : s);
      });
      if (!best) { ok = false; break; }
      sum += best;
    }
    if (ok) out.push([p, sum]);
  }
  return out.sort((a, b) => b[1] - a[1] || b[0].total - a[0].total).map(x => x[0]);
}
const foodOf = (key, gid) => D.edible.find(e => (key && e.k === key) || (!key && gid >= 0 && e.gid === gid));
const medOf = (key, gid) => D.medicinal.find(e => (key && e.k === key) || (!key && gid >= 0 && e.gid === gid));
const gardenItem = (key, gid) => (D.garden.items || []).find(x => (key && x.key === key) || x.id === gid);
const plantHref = (key, gid) => key ? '#/plant/' + key : (gid >= 0 ? '#/garden/item/' + gid : '');

/* ---------- shared UI ---------- */
function topBar(title) {
  return `<div class="top"><button data-act="back" aria-label="חזרה">→</button><h1>${esc(title)}</h1><button data-go="#/" aria-label="בית">⌂</button></div>`;
}
const fact = (k, v, ltr) => v ? `<div class="fact"><b>${esc(k)}</b><span class="${ltr ? 'ltr' : ''}">${esc(v)}</span></div>` : '';
const bullets = a => a && a.length ? '<ul>' + a.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : '';
const warn = t => `<div class="warn">${esc(t)}</div>`;
const note = t => `<div class="note">${esc(t)}</div>`;
const srcLinks = a => pairs(a).filter(s => s.t).map(s => s.u ? `<div><a href="${esc(s.u)}" target="_blank" rel="noopener">📚 ${esc(s.t)}</a></div>` : `<div class="note">📚 ${esc(s.t)}</div>`).join('');
const thumbBox = (url, alt) => url ? `<img class="thumb" loading="lazy" src="${esc(thumb(url))}" alt="${esc(alt)}">` : '<div class="thumb">🌿</div>';
const footer = () => `<div class="note" style="text-align:center;margin-top:24px">${esc(bothDates())}<br>מאת: איתן נוה · גרסה ${esc(VERSION)}</div>`;
const FOOD_RULE = 'גם סימון ירוק אינו אישור לאכול צמח שנמצא בטבע. אין להסתמך על זיהוי אוטומטי לצורך החלטה על אכילה.';
const MED_RULE = 'המידע אינו תחליף לייעוץ רפואי. אין כאן מינונים או המלצות טיפול, ואין להסיק דבר מזיהוי צמח בתמונה.';
const TRAD_RULE = 'מידע היסטורי ותרבותי בלבד. זו אינה המלצה רפואית ואין כאן מינונים. לפני שימוש בצמח לצורך רפואי פנו לרופא או לרוקח.';
const FOOD_WARNING = 'אין לאכול צמח בר או להשתמש בו לצורך רפואי על סמך האפליקציה בלבד.';
const POISON_HELP = 'בחשד להרעלה פנו מיד לעזרה רפואית: מד"א 101, או המרכז הארצי למידע בהרעלות 04-7771900. אל תנסו להעריך את החומרה לבד.';
const RATE_SHORT = { green: '🟢 מוכר למאכל', yellow: '🟡 מגבלות ואזהרות', red: '🔴 רעיל או מסוכן' };
const RATE_LONG = { green: '🟢 מוכר כצמח מאכל, בכפוף לזיהוי ודאי ולהכנה מתאימה.', yellow: '🟡 קיימות מגבלות או אזהרות משמעותיות.', red: '🔴 רעיל או מסוכן למאכל.' };
const LEVEL_LONG = { A: 'A: ראיות קליניות איכותיות יחסית.', B: 'B: ראיות ראשוניות ממחקרים בבני אדם.', C: 'C: מחקר מעבדתי או בבעלי חיים בלבד.', D: 'D: שימוש מסורתי ללא הוכחה מדעית מספקת.' };

let PHOTOS = {};
function photoStrip(list, alt) {
  if (!list || !list.length) return '';
  return '<div class="photos">' + list.map((ph, i) => {
    const id = 'ph' + Math.random().toString(36).slice(2); PHOTOS[id] = ph;
    const cap = [ph.y ? 'צולם ב-' + ph.y : '', ph.c ? 'צילום: ' + ph.c : '', ph.l || ''].filter(Boolean).join(' · ');
    return `<figure data-act="zoom" data-id="${id}"><img loading="lazy" src="${esc(thumb(ph.u))}" alt="${esc(alt)}"><figcaption>${esc(cap)}</figcaption></figure>`;
  }).join('') + '</div>';
}
function zoom(ph) {
  const z = document.getElementById('zoom');
  z.innerHTML = `<div class="img"><img src="${esc(large(ph.u))}" alt=""></div><div class="bar"><span>צילום: ${esc(ph.c || 'לא צוין')} · ${esc(ph.l || '')}</span>${ph.s ? `<a href="${esc(ph.s)}" target="_blank" rel="noopener">מקור</a>` : ''}<button data-act="unzoom">סגור</button></div>`;
  z.hidden = false;
}
function emergency() {
  return `<div class="danger">☎️ חשד להרעלה? מד"א <a href="tel:101">101</a> · מרכז הרעלות <a href="tel:047771900">04-7771900</a><div class="small">אם החיוג לא נפתח, חייגו ידנית למספר.</div></div>`;
}

/* ---------- router ---------- */
const scrolls = {};
let current = '';
function go(h) { if (location.hash === h) render(); else location.hash = h; }
window.addEventListener('hashchange', () => { scrolls[current] = window.scrollY; render(); });
function render() {
  const h = location.hash || '#/';
  if (h === current) scrolls[h] = window.scrollY;
  current = h; PHOTOS = {};
  const parts = h.replace(/^#\//, '').split('/').map(decodeURIComponent);
  const [a, b, c] = parts;
  let html;
  try {
    if (!a) html = home();
    else if (a === 'list') html = listPage(b, c);
    else if (a === 'plant') html = plantPage(Number(b));
    else if (a === 'map') html = mapPage();
    else if (a === 'identify') html = identifyPage();
    else if (a === 'journal') html = journalPage();
    else if (a === 'add') html = addObsPage(Number(b || 0));
    else if (a === 'settings') html = settingsPage();
    else if (a === 'toxic') html = toxicPage();
    else if (a === 'garden') html = b === 'item' ? gardenItemPage(Number(c)) : b === 'month' ? monthPage(Number(c)) : b === 'natural' ? naturalPage() : gardenPage();
    else if (a === 'guide') html = b ? methodPage(b) : guidePage();
    else if (a === 'food') html = foodPage();
    else if (a === 'herbal') html = herbalPage();
    else if (a === 'rambam') html = b === 'g' ? glossPage(Number(c)) : rambamPage(b);
    else if (a === 'nursery') html = nurseryPage(b === 'i' ? Number(c) : null);
    else if (a === 'bot') html = botPage();
    else if (a === 'compare') html = comparePage(b, c);
    else if (a === 'install') html = installPage();
    else html = home();
  } catch (e) {
    console.error(e);
    html = topBar('שגיאה') + `<div class="err">אירעה שגיאה בהצגת המסך. נסו לחזור אחורה.<div class="small">${esc(e.message)}</div></div>`;
  }
  $app.innerHTML = html;
  const after = AFTER.splice(0);
  after.forEach(f => f());
  window.scrollTo(0, scrolls[h] || 0);
}
const AFTER = [];
const later = f => AFTER.push(f);

document.addEventListener('click', e => {
  const t = e.target.closest('[data-go],[data-act]');
  if (!t) return;
  if (t.dataset.go) { e.preventDefault(); go(t.dataset.go); return; }
  const f = ACT[t.dataset.act];
  if (f) { e.preventDefault(); f(t, e); }
});
const ACT = {
  back() { if (history.length > 1) history.back(); else go('#/'); },
  zoom(t) { const ph = PHOTOS[t.dataset.id]; if (ph) zoom(ph); },
  unzoom() { const z = document.getElementById('zoom'); z.hidden = true; z.innerHTML = ''; },
};

/* ---------- home ---------- */
function home() {
  const m = nowMonth();
  const now = D.plants.filter(p => bloomsIn(p, m) && p.ph.length && p.he).sort((a, b) => b.total - a.total).slice(0, 14);
  const cards = [['🤖', 'הבוטנאי שלי', '#/bot'], ['⚖️', 'השוואת צמחים', '#/compare'], ['🌳', 'עצים ושיחים', '#/list/woody'], ['🌸', 'פרחים וצמחי עשב', '#/list/herb'],
    ['🌼', 'מה פורח עכשיו?', '#/list/bloom'], ['🌱', 'הגינה שלי', '#/garden'], ['🪴', 'צמחי נוי ומשתלות', '#/nursery'], ['✂️', 'ייחורים והשרשה', '#/guide'],
    ['🥬', 'צמחי מאכל', '#/food'], ['🌿', 'צמחי מרפא', '#/herbal'], ['📜', 'מרפא לפי הרמב"ם', '#/rambam'], ['☠️', 'צמחים רעילים', '#/toxic'],
    ['🗺️', 'מפת הצמחים', '#/map'], ['🔎', 'חיפוש', '#/list/all'], ['📖', 'יומן הטבע שלי', '#/journal'], ['⭐', 'מועדפים', '#/list/fav'],
    ['📲', 'התקנה באייפון', '#/install'], ['⚙️', 'הגדרות', '#/settings']];
  return `<div class="hero"><h1>🌿 צמחי ארץ ישראל</h1><div class="by">מאת: איתן נוה</div><div class="sub">מגלים את הטבע, צמח אחר צמח</div>
    <div class="meta">${esc(bothDates())}</div><div class="meta">גרסה ${esc(VERSION)} · גרסת אתר</div></div>
    <div class="wrap"><button class="big" data-go="#/identify">📷 זהה צמח עכשיו</button>
    <div class="grid">${cards.map(([e, t, h]) => `<button class="card" data-go="${h}"><span class="e">${e}</span>${esc(t)}</button>`).join('')}</div>
    ${now.length ? `<h2>פורחים בדרך כלל ב${MONTHS[m - 1]}</h2><div class="hscroll">${now.map(p => `<div class="tile" data-go="#/plant/${p.k}"><img loading="lazy" src="${esc(thumb(p.ph[0].u))}" alt=""><div>${esc(p.title)}</div></div>`).join('')}</div>` : ''}
    ${footer()}</div>`;
}

/* ---------- plant lists ---------- */
const LISTS = {};
function listPage(kind, region) {
  const titles = { woody: 'עצים ושיחים', herb: 'פרחים וצמחי עשב', bloom: 'מה פורח עכשיו?', fav: 'מועדפים', all: 'חיפוש' };
  const reg = D.regions.find(r => r.id === region);
  const title = kind === 'region' ? (reg ? reg.he : 'אזור') : titles[kind] || 'צמחים';
  const id = kind + (region || '');
  const st = LISTS[id] || (LISTS[id] = { q: '', month: kind === 'bloom' ? nowMonth() : 0, region: region || '', color: '', group: '', origin: '', limit: 60 });
  const opt = (v, t, cur) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(t)}</option>`;
  later(() => {
    const upd = () => updateList(kind, st);
    const q = document.getElementById('q');
    q.addEventListener('input', () => { st.q = q.value; st.limit = 60; upd(); });
    document.querySelectorAll('select[data-f]').forEach(s => s.addEventListener('change', () => { st[s.dataset.f] = s.value; st.limit = 60; upd(); }));
    upd();
  });
  return topBar(title) + `<div class="wrap">
    <input id="q" type="search" placeholder="שם הצמח, שם מדעי או משפחה" value="${esc(st.q)}">
    <div class="chips">
      <select data-f="month">${opt(0, 'כל החודשים', st.month)}${opt(-1, 'עכשיו', st.month)}${MONTHS.map((m, i) => opt(i + 1, m, st.month)).join('')}${SEASONS.map((s, i) => opt('s' + i, s[0], st.month)).join('')}</select>
      <select data-f="region">${opt('', 'כל האזורים', st.region)}${D.regions.map(r => opt(r.id, r.he, st.region)).join('')}</select>
      <select data-f="color">${opt('', 'כל הצבעים', st.color)}${Object.entries(COLORS).map(([k, v]) => opt(k, v, st.color)).join('')}</select>
      ${kind !== 'woody' && kind !== 'herb' ? `<select data-f="group">${opt('', 'כל הסוגים', st.group)}${Object.entries(GROUPS).map(([k, v]) => opt(k, v, st.group)).join('')}</select>` : ''}
      <select data-f="origin">${opt('', 'מקומי ומובא', st.origin)}${opt('native', 'מקומי', st.origin)}${opt('introduced', 'מובא', st.origin)}</select>
    </div>
    ${kind === 'bloom' ? note('תקופת פריחה אופיינית לפי תצפיות וספרות, לא דיווח מהשטח היום.') : ''}
    <div id="res"></div></div>`;
}
function updateList(kind, st) {
  const f = favs();
  let base = D.plants;
  if (kind === 'woody') base = base.filter(isWoody);
  else if (kind === 'herb') base = base.filter(p => !isWoody(p));
  else if (kind === 'fav') base = base.filter(p => f.has(Number(p.k)));
  let months = null;
  if (String(st.month).startsWith('s')) months = SEASONS[Number(String(st.month).slice(1))][1];
  else if (Number(st.month) === -1) months = [nowMonth()];
  else if (Number(st.month) > 0) months = [Number(st.month)];
  const list = base.filter(p => (!st.group || p.grp === st.group) && (!st.color || (p.col || []).includes(st.color)) && (!st.region || (p.reg || {})[st.region]) &&
    (!st.origin || p.nat === st.origin) && (!months || months.some(m => bloomsIn(p, m))));
  const res = st.q.trim() ? rank(st.q, list) : list.slice().sort((a, b) => (!a.he - !b.he) || ((st.region ? (b.reg[st.region] || 0) - (a.reg[st.region] || 0) : b.total - a.total)));
  const el = document.getElementById('res'); if (!el) return;
  if (kind === 'fav' && !base.length) { el.innerHTML = note('עדיין אין מועדפים. לחצו על ☆ במסך של צמח כדי להוסיף.'); return; }
  el.innerHTML = note(res.length + ' צמחים') + res.slice(0, st.limit).map(plantRow).join('') +
    (res.length > st.limit ? `<button class="btn out w" id="more">הצג עוד ${Math.min(60, res.length - st.limit)}</button>` : '');
  const more = document.getElementById('more');
  if (more) more.onclick = () => { st.limit += 60; updateList(kind, st); };
}
function plantRow(p) {
  const sub = [p.sci, GROUPS[p.grp]].filter(Boolean).join(' · ');
  const tox = D.toxic.has(Number(p.k)) ? ' ⚠️' : '';
  return `<div class="row" data-go="#/plant/${p.k}">${thumbBox(p.ph[0] && p.ph[0].u, p.title)}<div class="t"><div class="n">${esc(p.title)}${tox}</div><div class="s">${esc(sub)}</div></div></div>`;
}

/* ---------- plant page ---------- */
function plantPage(key) {
  const p = D.byKey.get(key);
  if (!p) return topBar('צמח') + '<div class="err">הצמח לא נמצא במאגר.</div>';
  const fav = favs().has(key);
  const bm = bloomMonths(p);
  const regs = Object.entries(p.reg || {}).sort((a, b) => b[1] - a[1]);
  const regName = id => (D.regions.find(r => r.id === id) || {}).he || id;
  let h = topBar(p.title) + '<div class="wrap">';
  h += photoStrip((p.ph || []).map(x => ({ u: x.u, c: x.c, l: x.l, s: x.s })), p.title);
  if (!p.ph.length) h += note('אין לצמח זה תמונה עם רישיון מתאים.');
  h += `<div class="chips"><button class="chip${fav ? ' on' : ''}" data-act="fav" data-k="${key}">${fav ? '★ במועדפים' : '☆ הוסף למועדפים'}</button>
    <button class="chip" data-go="#/add/${key}">📖 הוסף תצפית ביומן</button><button class="chip" data-go="#/compare/${key}">⚖️ השווה</button></div>`;
  h += '<h2>מידע כללי</h2>' + fact('שם עברי', p.he) + fact('שם מדעי', p.sci + (p.auth ? ' ' + p.auth : ''), true) + fact('שם אנגלי', p.en, true) +
    fact('שמות נוספים', (p.alt || []).join(', ')) + fact('משפחה', [famHe(p), p.fam].filter(Boolean).join(' · ')) + fact('סוג', GROUPS[p.grp]) + fact('מעמד בארץ', NATIVE[p.nat]) +
    fact('צבע פרח', (p.col || []).map(c => COLORS[c]).filter(Boolean).join(', '));
  h += warn(FOOD_WARNING);
  const tox = D.toxic.get(key);
  if (tox) h += toxicBox(tox);
  if (bm.length) {
    const peak = Math.max(...p.bloom);
    h += '<h2>עונת פריחה</h2>' + note(monthsText(bm)) + '<div class="bars">' + p.bloom.map((v, i) => `<div class="${bloomsIn(p, i + 1) ? '' : 'off'}" style="height:${Math.max(3, Math.round(100 * v / (peak || 1)))}%"></div>`).join('') +
      '</div><div class="blabels">' + MONTHS.map(m => `<span>${m.slice(0, 3)}</span>`).join('') + '</div>' +
      note(p.bsrc === 'inat' ? 'לפי תצפיות פריחה מתועדות באינטורליסט.' : 'לפי תיאור טקסטואלי.');
  }
  if (regs.length) h += '<h2>היכן גדל בארץ</h2>' + note('לפי תצפיות מתועדות (GBIF). מיקומים מדויקים אינם מוצגים.') + '<div class="chips">' + regs.map(([id, n]) => `<button class="chip" data-go="#/list/region/${id}">${esc(regName(id))} · ${n}</button>`).join('') + '</div>';
  h += useBoxes(key, -1);
  h += growSection(p);
  if (p.txt) h += '<h2>תיאור</h2><div>' + esc(p.txt) + '</div>' + (p.wp ? `<a href="${esc(p.wp)}" target="_blank" rel="noopener">📚 לערך המלא בוויקיפדיה (רישיון CC BY-SA)</a>` : '');
  h += '<h2>מקורות</h2>' + srcLinks([['GBIF, מאגר המידע העולמי על המגוון הביולוגי', 'https://www.gbif.org/species/' + p.k], p.wp ? ['ויקיפדיה העברית', p.wp] : null].filter(Boolean));
  return h + footer() + '</div>';
}
ACT.fav = t => { toggleFav(Number(t.dataset.k)); render(); };

function toxicBox(t) {
  const PETS = { cat: 'חתולים', dog: 'כלבים', horse: 'סוסים' };
  const sev = { high: 'חמורה', medium: 'בינונית', low: 'נמוכה' }[t.sev] || 'לא דורגה במקור';
  let h = `<div class="danger">☠️ צמח המסומן כרעיל · חומרה לפי המקור: ${esc(sev)}</div><div class="box">`;
  h += fact('חלקים רעילים', (t.parts || []).join(', ')) + fact('תסמינים', t.sym) + fact('חומר פעיל', t.prin, true) + fact('מסוכן לבעלי חיים', (t.pets || []).map(x => PETS[x] || x).join(', ')) + fact('סימנים בבעלי חיים', t.pet);
  const flags = [t.child && 'מסוכן במיוחד לילדים', t.fruit && 'פירות או זרעים רעילים', t.skin && 'עלול לגרות את העור', t.allergy && 'עלול לגרום לאלרגיה'].filter(Boolean);
  h += bullets(flags) + (t.q || []).map(q => `<div class="note">"${esc(q)}"</div>`).join('') + '<div class="small">מקור: </div>' + srcLinks(t.src) + '</div>';
  return h + emergency();
}

function useBoxes(key, gid) {
  const e = foodOf(key, gid), m = medOf(key, gid);
  let h = '';
  if (e) {
    h += '<h2>🥬 מאכל</h2><div class="box">' + `<div><b>${esc(RATE_LONG[e.rate])}</b></div>` + bullets(e.why) + fact('חלקים למאכל לפי המקור', (e.parts || []).join(', ')) +
      fact('הכנה', e.cook === 'yes' ? 'דורש בישול' : '') + fact('שימושים', e.uses) + fact('אזהרה', e.warn) + fact('חלקים רעילים', (e.toxparts || []).join(', ')) + fact('צמחים דומים שיש להבדיל מהם', (e.look || []).join(', '));
    if (e.nut) {
      const n = e.nut, nv = (v, u) => v == null ? '' : (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + ' ' + u;
      h += '<h3>ערך תזונתי ל-100 גרם</h3>' + fact('אנרגיה', nv(n.kcal, 'קק"ל')) + fact('חלבון', nv(n.protein, 'גרם')) + fact('שומן', nv(n.fat, 'גרם')) + fact('פחמימות', nv(n.carb, 'גרם')) + fact('סיבים', nv(n.fiber, 'גרם')) + fact('ויטמין C', nv(n.vitc, 'מ"ג')) + note('לפי USDA: ' + (n.d || ''));
    }
    h += (e.quote || []).map(q => `<div class="note">"${esc(q)}"</div>`).join('') + warn(FOOD_RULE) + srcLinks(e.src) + '</div>';
  } else h += note('⚪ מאכל: אין מידע אמין מספיק לקביעת בטיחות.');
  if (m) {
    h += '<h2>🌿 מרפא</h2><div class="box">' + `<div><b>רמת ראיות: ${esc(LEVEL_LONG[m.level] || m.level)}</b></div>` + (m.history ? `<div>${esc(m.history)}</div>` : '');
    if ((m.studied || []).length) h += '<h3>מה נבדק במחקר</h3><ul>' + m.studied.map(s => `<li><b>${esc(s.effect)}:</b> ${esc(s.finding)}</li>`).join('') + '</ul>';
    h += fact('חומר פעיל', m.active) + (m.side && m.side.length ? '<h3>תופעות לוואי</h3>' + bullets(m.side) : '') + (m.inter && m.inter.length ? '<h3>תגובות עם תרופות</h3>' + bullets(m.inter) : '') +
      (m.caut && m.caut.length ? '<h3>אזהרות</h3>' + bullets(m.caut) : '') + (m.trad && m.trad.length ? '<h3>שימוש מסורתי</h3>' + bullets(m.trad) : '') + (m.ema && m.ema.length ? '<h3>הסוכנות האירופית לתרופות</h3>' + bullets(m.ema) : '') +
      warn(MED_RULE) + srcLinks(m.src) + '</div>';
  }
  const R = D.rambam;
  const rf = R && R.foods.find(f => (key && f.key === key) || (!key && gid >= 0 && f.gid === gid));
  const rg = R && R.gloss.find(f => (key && f.key === key) || (!key && gid >= 0 && f.gid === gid));
  if (rf) h += `<div class="box"><b>📜 לפי הרמב"ם</b><div>${esc(rf.t)}</div><button class="link" data-go="#/rambam/foods">למקור ולפרטים</button></div>`;
  else if (rg) h += `<div class="box"><b>📜 במילון התרופות של הרמב"ם</b><div><button class="link" data-go="#/rambam/g/${rg.n}">פתח את הערך</button></div></div>`;
  return h;
}

function growSection(p) {
  const key = Number(p.k);
  const gi = (D.garden.items || []).find(x => x.key === key);
  const gr = D.grow[String(key)] || {};
  const grp = (D.garden.groups || {})[gi ? gi.gen : gr.gen];
  let h = '';
  if (gi) {
    h += '<h2>🌱 זמני שתילה והנחיות גידול</h2>' + monthStrip('זריעה', gi.sow) + monthStrip('שתילה', gi.plant) + growFacts(gi) + bullets(gi.care) +
      `<button class="link" data-go="#/garden/item/${gi.id}">לכרטיס הגינה המלא</button>`;
  } else if (gr.care) {
    h += '<h2>🌱 הנחיות גידול</h2>' + growFacts(gr) + bullets(gr.care) + (gr.sl ? `<a href="https://plants.ces.ncsu.edu/plants/${esc(gr.sl)}/" target="_blank" rel="noopener">📚 NC State Extension</a>` : '');
  }
  if (grp) h += (h ? '' : '<h2>🌱 מתי שותלים</h2>') + `<div class="box">${grp.months && grp.months.length ? '<b>חודשים מומלצים:</b> ' + esc(monthsText(grp.months)) + '<br>' : ''}${esc(grp.note || '')}<div class="note">הנחיה כללית לקבוצת צמחים, לפי משרד החקלאות.</div></div>`;
  if (!h) h = note('אין במאגר הנחיות גידול לצמח זה.');
  return h;
}
const monthStrip = (label, ms) => ms && ms.length ? `<div class="small"><b>${label}:</b> ${esc(monthsText(ms))}</div><div class="strip">${MONTHS.map((m, i) => `<span class="${ms.includes(i + 1) ? 'on' : ''}">${m.slice(0, 3)}</span>`).join('')}</div>` : '';
const growFacts = g => fact('אור', (g.sun || []).join(', ')) + fact('קרקע', (g.soil || []).join(', ')) + fact('ניקוז ומים', (g.drain || []).join(', ')) + fact('חומציות', (g.ph || []).join(', ')) + fact('ריבוי', (g.prop || []).join(', ')) + fact('גודל', g.size);

/* ---------- map ---------- */
function mapPage() {
  const poly = r => r.poly.map(([x, y]) => `${x},${-y}`).join(' ');
  const cen = r => { const n = r.poly.length; return [r.poly.reduce((a, p) => a + p[0], 0) / n, -r.poly.reduce((a, p) => a + p[1], 0) / n]; };
  const counts = Object.fromEntries(D.regions.map(r => [r.id, D.plants.filter(p => (p.reg || {})[r.id]).length]));
  return topBar('מפת הצמחים') + `<div class="wrap map">${note('לחץ על אזור כדי לראות את הצמחים שתועדו בו. הגבולות משורטטים בקירוב.')}
    <svg viewBox="34.15 -33.45 1.9 4.15">${D.regions.map(r => `<polygon points="${poly(r)}" data-go="#/list/region/${r.id}"></polygon>`).join('')}
    ${D.regions.map(r => { const [x, y] = cen(r); return `<text x="${x}" y="${y}">${esc(r.he)}</text>`; }).join('')}</svg>
    ${D.regions.map(r => `<div class="row" data-go="#/list/region/${r.id}"><div class="t"><div class="n">${esc(r.he)}</div><div class="s">${counts[r.id]} צמחים</div></div></div>`).join('')}${footer()}</div>`;
}

/* ---------- identify (Pl@ntNet) ---------- */
let pending = null;
function identifyPage() {
  const key = store.get('plantnet', '');
  later(() => {
    const inp = document.getElementById('shot');
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      pending = { blob: await shrink(f, 1280), result: null };
      document.getElementById('prev').innerHTML = `<img src="${URL.createObjectURL(pending.blob)}" style="width:100%;border-radius:12px">`;
      document.getElementById('acts').hidden = false;
      document.getElementById('out').innerHTML = '';
    });
  });
  return topBar('זיהוי צמח') + `<div class="wrap">
    ${note('צלמו את הצמח מקרוב: עלה, פרח או פרי, באור טוב. עדיף כמה תמונות של חלקים שונים.')}
    <label class="btn w">📷 צלם או בחר תמונה<input id="shot" type="file" accept="image/*" capture="environment" hidden></label>
    <div id="prev"></div>
    <div id="acts" hidden>
      ${key ? '<button class="btn w" data-act="identify">🔎 זהה עם Pl@ntNet</button>' : warn('כדי לזהות צריך מפתח Pl@ntNet חינמי. אפשר להוסיף אותו בהגדרות.') + '<button class="btn out w" data-go="#/settings">להגדרות</button>'}
      <button class="btn out w" data-act="saveUnknown">📖 שמור ביומן בלי זיהוי</button>
    </div>
    <div id="out"></div>
    ${warn('הזיהוי האוטומטי אינו ודאי. אין להחליט על אכילה או שימוש רפואי לפי זיהוי בתמונה.')}${footer()}</div>`;
}
function shrink(file, max) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => res(b || file), 'image/jpeg', 0.85);
    };
    img.onerror = () => res(file);
    img.src = URL.createObjectURL(file);
  });
}
ACT.identify = async () => {
  const out = document.getElementById('out');
  if (!pending) return;
  out.innerHTML = note('שולח לזיהוי…');
  try {
    const fd = new FormData(); fd.append('images', pending.blob, 'plant.jpg'); fd.append('organs', 'auto');
    const r = await fetch('https://my-api.plantnet.org/v2/identify/all?include-related-images=false&nb-results=5&lang=he&api-key=' + encodeURIComponent(store.get('plantnet', '')), { method: 'POST', body: fd });
    if (r.status === 404) { out.innerHTML = warn('לא נמצאה התאמה. נסו תמונה אחרת, קרובה וחדה יותר.'); return; }
    if (r.status === 401 || r.status === 403) { out.innerHTML = warn('מפתח Pl@ntNet אינו תקין או שהאתר לא הוגדר בו. ראו הוראות בהגדרות.'); return; }
    if (r.status === 429) { out.innerHTML = warn('הגעתם למכסת הזיהויים היומית. נסו מחר.'); return; }
    if (!r.ok) { out.innerHTML = warn('שירות הזיהוי החזיר שגיאה (' + r.status + ').'); return; }
    const j = await r.json();
    let list = (j.results || []).map(x => ({ sci: x.species.scientificNameWithoutAuthor, score: x.score, fam: ((x.species.family || {}).scientificNameWithoutAuthor) || '', common: (x.species.commonNames || [])[0] || '', gbif: x.gbif && x.gbif.id ? Number(x.gbif.id) : null }));
    if (list.length && list[0].score >= 0.7 && (list.length < 2 || list[1].score < 0.15)) list = list.slice(0, 1); else list = list.slice(0, 3);
    pending.result = list;
    const label = s => s >= 0.7 ? 'התאמה גבוהה יחסית' : s >= 0.3 ? 'התאמה בינונית' : 'התאמה נמוכה';
    out.innerHTML = '<h2>אפשרויות זיהוי</h2>' + (list.length && list[0].score < 0.5 ? warn('הזיהוי לא ברור. מומלץ לצלם חלק נוסף של הצמח.') : '') + list.map((c, i) => {
      const p = D.bySci.get(c.sci.toLowerCase()) || (c.gbif && D.byKey.get(c.gbif));
      return `<div class="box"><div class="n"><b>${esc(p ? p.title : (c.common || c.sci))}</b></div><div class="ltr">${esc(c.sci)}</div><div>${label(c.score)} (${Math.round(c.score * 100)}%)</div>
        ${p ? `<button class="btn out" data-go="#/plant/${p.k}">פתח כרטיס צמח</button>` : note('הצמח אינו במאגר הארץ של האפליקציה.')}
        <button class="btn" data-act="saveId" data-i="${i}">📖 שמור ביומן עם זיהוי זה</button></div>`;
    }).join('') + note('זיהוי באמצעות Pl@ntNet. אינו ודאי.');
  } catch (e) {
    out.innerHTML = warn('אין חיבור לשירות הזיהוי. בדקו את האינטרנט. אם הבעיה נמשכת, ייתכן שצריך להוסיף את כתובת האתר להגדרות המפתח ב-Pl@ntNet.');
  }
};
async function saveObs(extra) {
  const pos = await locate();
  await idb.add(Object.assign({ time: Date.now(), photo: pending ? pending.blob : null, lat: pos && pos.lat, lon: pos && pos.lon, note: '', plantKey: 0, sci: '', name: '' }, extra));
  go('#/journal');
}
ACT.saveUnknown = () => saveObs({});
ACT.saveId = t => {
  const c = pending.result[Number(t.dataset.i)];
  const p = D.bySci.get(c.sci.toLowerCase()) || (c.gbif && D.byKey.get(c.gbif));
  saveObs({ plantKey: p ? Number(p.k) : 0, sci: c.sci, name: p ? p.title : (c.common || c.sci), note: 'זוהה ב-Pl@ntNet (' + Math.round(c.score * 100) + '%)' });
};
function locate() {
  return new Promise(res => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lon: p.coords.longitude }), () => res(null), { timeout: 8000, maximumAge: 60000 });
  });
}

/* ---------- journal ---------- */
function journalPage() {
  later(async () => {
    const el = document.getElementById('obs');
    let list = [];
    try { list = await idb.all(); } catch (e) { el.innerHTML = warn('הדפדפן לא מאפשר שמירה מקומית. ייתכן שזה מצב גלישה פרטית.'); return; }
    if (!list.length) { el.innerHTML = note('היומן ריק. צלמו צמח או הוסיפו תצפית.'); return; }
    el.innerHTML = list.map(o => {
      const img = o.photo ? `<img class="thumb" src="${URL.createObjectURL(o.photo)}" alt="">` : '<div class="thumb">📖</div>';
      return `<div class="box"><div class="row" ${o.plantKey ? `data-go="#/plant/${o.plantKey}"` : ''}>${img}<div class="t"><div class="n">${esc(o.name || 'צמח שלא זוהה')}</div>
        <div class="s">${esc(bothDates(new Date(o.time)))}</div>${o.lat ? `<div class="s">מיקום: ${o.lat.toFixed(4)}, ${o.lon.toFixed(4)}</div>` : ''}${o.note ? `<div class="small">${esc(o.note)}</div>` : ''}</div></div>
        <button class="link" data-act="delObs" data-id="${o.id}">🗑️ מחק תצפית</button></div>`;
    }).join('');
  });
  return topBar('יומן הטבע שלי') + `<div class="wrap"><button class="btn w" data-go="#/identify">📷 צלם וזהה</button><button class="btn out w" data-go="#/add/0">✍️ הוסף תצפית</button>
    <button class="btn out w" data-act="exportObs">⬇️ ייצוא היומן לקובץ</button>
    ${note('היומן נשמר רק בטלפון הזה, בדפדפן. מחיקת נתוני האתר מוחקת גם אותו.')}<div id="obs">${note('טוען…')}</div>${footer()}</div>`;
}
ACT.delObs = async t => { await idb.del(Number(t.dataset.id)); render(); };
ACT.exportObs = async () => {
  const list = await idb.all();
  const rows = [['תאריך', 'צמח', 'שם מדעי', 'קו רוחב', 'קו אורך', 'הערה']].concat(list.map(o => [bothDates(new Date(o.time)), o.name, o.sci, o.lat || '', o.lon || '', o.note]));
  const csv = '﻿' + rows.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'yoman-hateva.csv'; document.body.appendChild(a); a.click(); a.remove();
};
function addObsPage(key) {
  const p = key ? D.byKey.get(key) : null;
  pending = null;
  later(() => {
    const inp = document.getElementById('shot');
    inp.addEventListener('change', async () => { const f = inp.files && inp.files[0]; if (!f) return; pending = { blob: await shrink(f, 1280) }; document.getElementById('prev').innerHTML = `<img src="${URL.createObjectURL(pending.blob)}" style="width:100%;border-radius:12px">`; });
  });
  return topBar('תצפית חדשה') + `<div class="wrap">${p ? `<div class="box"><b>${esc(p.title)}</b> <span class="ltr">${esc(p.sci)}</span></div>` : ''}
    <label class="btn out w">📷 הוסף תמונה (רשות)<input id="shot" type="file" accept="image/*" capture="environment" hidden></label><div id="prev"></div>
    <textarea id="obsnote" rows="4" placeholder="הערה: איפה, מה ראיתי, מצב הצמח"></textarea>
    ${note('המיקום נשמר אם תאשרו גישה למיקום. הוא נשאר רק בטלפון שלכם.')}
    <button class="btn w" data-act="saveObs" data-k="${key || 0}">💾 שמור ביומן</button>${footer()}</div>`;
}
ACT.saveObs = t => {
  const key = Number(t.dataset.k); const p = key ? D.byKey.get(key) : null;
  saveObs({ plantKey: key, sci: p ? p.sci : '', name: p ? p.title : '', note: document.getElementById('obsnote').value.trim() });
};

/* ---------- toxic ---------- */
let toxFilter = '';
function toxicPage() {
  const F = [['', 'הכול'], ['high', 'חומרה גבוהה'], ['child', 'ילדים'], ['pets', 'חיות מחמד'], ['fruit', 'פירות וזרעים'], ['skin', 'גירוי בעור'], ['allergy', 'אלרגיה']];
  const match = t => !toxFilter || (toxFilter === 'high' ? t.sev === 'high' : toxFilter === 'pets' ? (t.pets || []).length : !!t[toxFilter]);
  const rankOf = s => ({ high: 0, '': 1, medium: 2 }[s] ?? 3);
  const list = [...D.toxic.values()].filter(match).map(t => [t, D.byKey.get(Number(t.k))]).filter(x => x[1]).sort((a, b) => rankOf(a[0].sev) - rankOf(b[0].sev) || b[1].total - a[1].total);
  const sev = s => ({ high: 'חומרה: חמורה', medium: 'חומרה: בינונית', low: 'חומרה: נמוכה' }[s] || 'חומרה: לא דורגה במקור');
  return topBar('צמחים רעילים') + `<div class="wrap">${emergency()}${warn('הרשימה חלקית. היעדר צמח מהרשימה אינו אומר שהוא בטוח.')}
    <div class="chips">${F.map(([k, v]) => `<button class="chip${toxFilter === k ? ' on' : ''}" data-act="toxF" data-k="${k}">${v}</button>`).join('')}</div>${note(list.length + ' צמחים')}
    ${list.map(([t, p]) => `<div class="row" data-go="#/plant/${p.k}">${thumbBox(p.ph[0] && p.ph[0].u, p.title)}<div class="t"><div class="n">${esc(p.title)}</div><div class="s">${esc(sev(t.sev))}</div><div class="s">${esc((t.parts || []).join(', '))}</div></div></div>`).join('')}${footer()}</div>`;
}
ACT.toxF = t => { toxFilter = t.dataset.k; render(); };

/* ---------- garden ---------- */
const GARDEN_CATS = { veg: 'ירקות', herb: 'תבלינים', fruit: 'עצי פרי', tree: 'עצים', orn: 'נוי', flower: 'פרחים' };
const TASKS = { vegetables: '🥕 גן הירק', orchard: '🍋 הבוסתן', ornamental: '🌺 גן הנוי', soil_water: '💧 קרקע והשקיה', natural_pests: '🐞 הדברה טבעית' };
let gcat = 'veg';
function gardenPage() {
  const m = nowMonth();
  later(() => {
    const q = document.getElementById('gq');
    const upd = () => {
      const n = norm(q.value);
      const items = D.garden.items.filter(x => n ? norm(x.he + ' ' + x.sci).includes(n) : x.cat === gcat);
      document.getElementById('gres').innerHTML = items.map(x => `<div class="row" data-go="#/garden/item/${x.id}">${thumbBox(x.photos && x.photos[0] && x.photos[0].u, x.he)}<div class="t"><div class="n">${esc(x.he)}</div><div class="s">${esc([x.sow && x.sow.length ? 'זריעה: ' + monthsText(x.sow) : '', x.plant && x.plant.length ? 'שתילה: ' + monthsText(x.plant) : ''].filter(Boolean).join(' · ') || x.sci)}</div></div></div>`).join('') || note('לא נמצאו צמחים.');
    };
    q.addEventListener('input', upd); upd();
  });
  return topBar('הגינה שלי') + `<div class="wrap"><button class="big" style="font-size:19px;padding:16px" data-go="#/garden/month/${m}">📅 מה עושים בגינה ב${MONTHS[m - 1]}?</button>
    <button class="btn out w" data-go="#/nursery">🪴 כל צמחי הנוי והמשתלות</button><button class="btn out w" data-go="#/guide">✂️ ייחורים והשרשה</button><button class="btn out w" data-go="#/garden/natural">🌿 טיפול טבעי בגינה</button>
    <input id="gq" type="search" placeholder="חיפוש צמח לגינה">
    <div class="chips">${Object.entries(GARDEN_CATS).map(([k, v]) => `<button class="chip${gcat === k ? ' on' : ''}" data-act="gcat" data-k="${k}">${v}</button>`).join('')}</div>
    <div id="gres"></div>${footer()}</div>`;
}
ACT.gcat = t => { gcat = t.dataset.k; render(); };
function gardenItemPage(id) {
  const x = D.garden.items.find(i => i.id === id);
  if (!x) return topBar('צמח') + '<div class="err">לא נמצא.</div>';
  const grp = (D.garden.groups || {})[x.gen];
  let h = topBar(x.he) + '<div class="wrap">' + photoStrip(x.photos || [], x.he) + fact('שם מדעי', x.sci, true) + fact('קטגוריה', GARDEN_CATS[x.cat]);
  h += '<h2>📅 מתי זורעים ושותלים</h2>' + (monthStrip('זריעה', x.sow) + monthStrip('שתילה', x.plant) || note('אין במקור חודשי זריעה או שתילה מפורשים.'));
  if (grp) h += `<div class="box">${esc(grp.note)}</div>`;
  h += '<h2>תנאי גידול</h2>' + growFacts(x) + (x.care && x.care.length ? '<h2>טיפול</h2>' + bullets(x.care) : '');
  h += useBoxes(x.key || 0, x.key ? -1 : x.id);
  if (x.key && D.byKey.get(x.key)) h += `<button class="btn out w" data-go="#/plant/${x.key}">🌿 לכרטיס הצמח המלא</button>`;
  h += '<h2>מקורות</h2>' + srcLinks(x.src) + srcLinks([['משרד החקלאות, לוח עבודות בגינה', D.garden.moag]]);
  return h + footer() + '</div>';
}
function monthPage(m) {
  const mp = D.garden.months[m - 1] || {};
  const items = D.garden.items.filter(x => (x.sow || []).includes(m) || (x.plant || []).includes(m));
  let h = topBar('הגינה ב' + MONTHS[m - 1]) + '<div class="wrap"><div class="chips">' + MONTHS.map((n, i) => `<button class="chip${i + 1 === m ? ' on' : ''}" data-go="#/garden/month/${i + 1}">${n.slice(0, 3)}</button>`).join('') + '</div>';
  if ((mp.sow || []).length) h += '<h2>🌰 זורעים</h2>' + bullets(mp.sow);
  if ((mp.plant || []).length) h += '<h2>🌱 שותלים</h2>' + bullets(mp.plant);
  for (const [k, v] of Object.entries(TASKS)) if ((mp.tasks || {})[k] && mp.tasks[k].length) h += '<h2>' + v + '</h2>' + bullets(mp.tasks[k]);
  if (items.length) h += '<h2>צמחים מהמאגר שמתאימים לחודש</h2>' + items.map(x => `<div class="row" data-go="#/garden/item/${x.id}">${thumbBox(x.photos && x.photos[0] && x.photos[0].u, x.he)}<div class="t"><div class="n">${esc(x.he)}</div><div class="s">${esc(GARDEN_CATS[x.cat] || '')}</div></div></div>`).join('');
  h += note('לפי חוברת משרד החקלאות. המועדים כלליים ומשתנים לפי אזור ושנה.') + srcLinks([['משרד החקלאות, לוח עבודות בגינה', D.garden.moag]]);
  return h + footer() + '</div>';
}
function naturalPage() {
  return topBar('טיפול טבעי בגינה') + '<div class="wrap">' + note('עקרונות לגינון בלי חומרי הדברה כימיים, לפי משרד החקלאות.') + bullets(D.garden.natural) + srcLinks([['משרד החקלאות', D.garden.moag]]) + footer() + '</div>';
}

/* ---------- cuttings guide ---------- */
function guidePage() {
  const g = D.guide;
  return topBar('ייחורים והשרשה') + `<div class="wrap"><div>${esc(g.intro)}</div><h2>עקרונות בסיסיים</h2>${bullets(g.basics)}<h2>שיטות</h2>
    ${g.methods.map(m => `<div class="row" data-go="#/guide/${m.id}">${thumbBox(m.photos && m.photos[0] && m.photos[0].u, m.title)}<div class="t"><div class="n">${esc(m.title)}</div><div class="s">${esc(m.when)}</div></div></div>`).join('')}
    <h2>טעויות נפוצות</h2>${bullets(g.mistakes)}${g.hormone_photo ? '<h2>הורמון השרשה</h2>' + photoStrip(g.hormone_photo, 'הורמון השרשה') : ''}${footer()}</div>`;
}
function methodPage(id) {
  const m = D.guide.methods.find(x => x.id === id);
  if (!m) return topBar('שיטה') + '<div class="err">לא נמצא.</div>';
  return topBar(m.title) + `<div class="wrap">${photoStrip(m.photos || [], m.title)}${(m.photos || []).map(p => p.d).filter(Boolean).length ? note('התמונות להמחשה כללית.') : ''}
    ${fact('מתי', m.when)}${fact('מתאים ל', m.good_for)}<h2>שלב אחר שלב</h2><ol>${(m.steps || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    ${m.after ? '<h2>אחרי השתילה</h2><div>' + esc(m.after) + '</div>' : ''}<h2>מקורות</h2>${srcLinks(m.sources)}${footer()}</div>`;
}

/* ---------- food & herbal ---------- */
let foodRate = '', herbLevel = '';
function foodPage() {
  later(() => {
    const q = document.getElementById('fq');
    const upd = () => {
      const n = norm(q.value);
      const list = D.edible.filter(e => (!foodRate || e.rate === foodRate) && (!n || norm(e.he + ' ' + e.sci).includes(n))).sort((a, b) => ({ green: 0, yellow: 1, red: 2 }[a.rate] - { green: 0, yellow: 1, red: 2 }[b.rate]) || a.he.localeCompare(b.he, 'he'));
      document.getElementById('fres').innerHTML = note(list.length + ' צמחים') + list.map(e => useRow(e.k, e.gid, e.he, e.sci, RATE_SHORT[e.rate])).join('');
    };
    q.addEventListener('input', upd); upd();
  });
  return topBar('צמחי מאכל') + `<div class="wrap">${warn(FOOD_RULE)}${note('כל צמח מסווג רק לפי מקור מתועד. צמח בלי מקור אינו מופיע כאן.')}
    <input id="fq" type="search" placeholder="חיפוש"><div class="chips">${[['', 'הכול'], ['green', RATE_SHORT.green], ['yellow', RATE_SHORT.yellow], ['red', RATE_SHORT.red]].map(([k, v]) => `<button class="chip${foodRate === k ? ' on' : ''}" data-act="frate" data-k="${k}">${v}</button>`).join('')}</div>
    <div id="fres"></div>${footer()}</div>`;
}
ACT.frate = t => { foodRate = t.dataset.k; render(); };
function useRow(key, gid, he, sci, sub) {
  const p = key ? D.byKey.get(key) : null; const gi = !p && gid >= 0 ? D.garden.items.find(x => x.id === gid) : null;
  const url = (p && p.ph[0] && p.ph[0].u) || (gi && gi.photos && gi.photos[0] && gi.photos[0].u);
  const href = p ? '#/plant/' + key : gi ? '#/garden/item/' + gid : '';
  return `<div class="row" ${href ? `data-go="${href}"` : ''}>${thumbBox(url, he)}<div class="t"><div class="n">${esc(he)}</div><div class="s ltr">${esc(sci)}</div><div class="s">${esc(sub)}</div></div></div>`;
}
function herbalPage() {
  later(() => {
    const q = document.getElementById('hq');
    const upd = () => {
      const n = norm(q.value);
      const list = D.medicinal.filter(e => (!herbLevel || e.level === herbLevel) && (!n || norm(e.he + ' ' + e.sci).includes(n))).sort((a, b) => a.level.localeCompare(b.level) || a.he.localeCompare(b.he, 'he'));
      document.getElementById('hres').innerHTML = note(list.length + ' צמחים') + list.map(e => useRow(e.k, e.gid, e.he, e.sci, 'רמת ראיות: ' + e.level)).join('');
    };
    q.addEventListener('input', upd); upd();
  });
  return topBar('צמחי מרפא וסגולותיהם') + `<div class="wrap">${warn(MED_RULE)}<div><b>טענות מסורתיות אינן עובדות מדעיות מוכחות.</b></div>${Object.values(LEVEL_LONG).map(t => `<div class="small">${t}</div>`).join('')}
    <input id="hq" type="search" placeholder="חיפוש"><div class="chips">${['', 'A', 'B', 'C', 'D'].map(k => `<button class="chip${herbLevel === k ? ' on' : ''}" data-act="hlev" data-k="${k}">${k || 'הכול'}</button>`).join('')}</div>
    <div id="hres"></div>${footer()}</div>`;
}
ACT.hlev = t => { herbLevel = t.dataset.k; render(); };

/* ---------- Maimonides ---------- */
const VERDICT = { good: '🟢 טוב', use: '🔵 שימוש שהוזכר', time: '🕒 תלוי בזמן האכילה', season: '🍂 תלוי בעונה', limit: '🟡 להמעיט', avoid: '🔴 להימנע' };
const CERT = { sure: 'זיהוי ברור לפי מאירהוף', probable: 'זיהוי משוער', doubtful: 'זיהוי מוטל בספק', none: 'אין זיהוי בוטני' };
let rVerdict = '';
function rambamPage(tab) {
  const R = D.rambam; tab = tab || 'rules';
  const tabs = [['rules', 'עקרונות'], ['foods', 'צמחים ומאכלים'], ['gloss', 'מילון התרופות'], ['about', 'על השיטה']];
  let h = topBar('צמחי מרפא לפי הרמב"ם') + '<div class="wrap">' + warn(TRAD_RULE) + '<div class="chips">' + tabs.map(([k, v]) => `<button class="chip${tab === k ? ' on' : ''}" data-go="#/rambam/${k}">${v}</button>`).join('') + '</div>';
  if (tab === 'rules') h += note('כללי שמירת הבריאות מתוך משנה תורה, הלכות דעות פרק ד. הכללים נועדו לבריא.') + R.rules.map(r => `<div class="box"><h3>${esc(r.n)}</h3><div>${esc(r.t)}</div><a href="${esc(r.u)}" target="_blank" rel="noopener">📚 הלכות דעות ד:${r.h}</a></div>`).join('');
  else if (tab === 'foods') {
    later(() => {
      const q = document.getElementById('rq');
      const upd = () => {
        const n = norm(q.value);
        document.getElementById('rres').innerHTML = R.foods.filter(f => (!rVerdict || f.v === rVerdict) && (!n || norm(f.he + ' ' + f.sci).includes(n))).map(f => `<div class="box"><h3>${esc(f.he)}</h3>${f.sci ? `<div class="ltr small">${esc(f.sci)}</div>` : ''}<b>${esc(VERDICT[f.v] || '')}</b><div>${esc(f.t)}</div>
          ${f.q ? `<div class="note">"${esc(f.q)}"</div>` : ''}${f.note ? note(f.note) : ''}${f.key && D.toxic.has(f.key) ? warn('צמח זה מסומן במאגר כרעיל. ראו את כרטיס הצמח.') : ''}${srcLinks(f.refs)}${plantHref(f.key, f.gid) ? `<button class="btn out" data-go="${plantHref(f.key, f.gid)}">🌿 פתח את כרטיס הצמח</button>` : ''}</div>`).join('') || note('לא נמצא.');
      };
      q.addEventListener('input', upd); upd();
    });
    h += note('מה כתב הרמב"ם על צמחים ומאכלים. הידע הוא מהמאה ה-12, וחלקו נדחה במדע של ימינו.') + '<input id="rq" type="search" placeholder="חיפוש צמח"><div class="chips">' +
      [['', 'הכול'], ...Object.entries(VERDICT)].map(([k, v]) => `<button class="chip${rVerdict === k ? ' on' : ''}" data-act="rverd" data-k="${k}">${v}</button>`).join('') + '</div><div id="rres"></div>';
  } else if (tab === 'gloss') {
    later(() => {
      const q = document.getElementById('gq2');
      const upd = () => {
        const n = norm(q.value);
        document.getElementById('gres2').innerHTML = R.gloss.filter(g => !n || norm(g.he + ' ' + g.ar + ' ' + g.sci + ' ' + g.syn.join(' ')).includes(n)).map(g => `<div class="row" data-go="#/rambam/g/${g.n}"><div class="t"><div class="n">${esc(g.he)}</div><div class="s">${esc([g.ar, g.sci].filter(Boolean).join(' · '))}</div>${g.mai ? '<div class="small" style="color:var(--forest)">יש בערך דברי הרמב"ם</div>' : ''}</div></div>`).join('');
      };
      q.addEventListener('input', upd); upd();
    });
    h += note('מילון שמות התרופות של הרמב"ם, לפי המהדורה של מקס מאירהוף. המילון עוסק בעיקר בשמות, ולכן רק בחלק מהערכים יש דברים על שימוש.') + '<input id="gq2" type="search" placeholder="חיפוש בשם עברי, ערבי או מדעי"><div id="gres2"></div>';
  } else {
    h += '<h2>על הרמב"ם והשיטה</h2>' + R.intro.map(t => `<p>${esc(t)}</p>`).join('') + '<h2>החיבורים הרפואיים</h2>' + bullets(R.works) + '<h2>מה חסר כאן</h2>' + bullets(R.limits) + '<h2>מקורות</h2>' + srcLinks(R.sources);
  }
  return h + footer() + '</div>';
}
ACT.rverd = t => { rVerdict = t.dataset.k; render(); };
function glossPage(n) {
  const g = D.rambam.gloss.find(x => x.n === n);
  if (!g) return topBar('ערך') + '<div class="err">לא נמצא.</div>';
  let h = topBar(g.he) + '<div class="wrap">' + warn(TRAD_RULE) + fact('ערך במילון', String(g.n)) + fact('השם הערבי', g.ar, true) + fact('שם מדעי לפי מאירהוף', g.sci, true) + fact('ודאות הזיהוי', CERT[g.c]) + fact('שמות נוספים אצל הרמב"ם', g.syn.join(', '), true);
  if (g.mai) h += '<h2>דברי הרמב"ם</h2><div>' + esc(g.mai) + '</div>';
  if (g.mey) h += '<h2>הערת החוקר מאירהוף</h2><div>' + esc(g.mey) + '</div>';
  if (!g.mai && !g.mey) h += note('בערך זה מופיעים רק שמות, בלי מידע על שימוש.');
  if (g.key && D.toxic.has(g.key)) h += warn('צמח זה מסומן במאגר כרעיל. ראו את כרטיס הצמח.');
  if (plantHref(g.key, g.gid)) h += `<button class="btn out w" data-go="${plantHref(g.key, g.gid)}">🌿 פתח את כרטיס הצמח</button>`;
  h += note('תרגום לעברית מתוך מהדורת מאירהוף.') + srcLinks(D.rambam.sources.filter(s => /Meyerhof/.test(s.t)));
  return h + footer() + '</div>';
}

/* ---------- nursery ---------- */
const NCATS = { shrub: 'שיחים', tree: 'עצים', perennial: 'רב-שנתיים', annual: 'עונתיים', climber: 'מטפסים', bulb: 'פקעות ובצלים', succulent: 'סוקולנטים', conifer: 'מחטניים', palm: 'דקלים', grass: 'דגניים ובמבוק', fern: 'שרכים', water: 'צמחי מים', epiphyte: 'אפיפיטים', other: 'אחר' };
const NST = { q: '', cat: '', species: false, care: false, photo: false, sun: '', dry: false, tox: false, limit: 60 };
function nurseryPage(idx) {
  if (!D.nursery) {
    loadNursery().then(render).catch(() => { $app.innerHTML = topBar('צמחי נוי ומשתלות') + '<div class="err">לא הצלחתי לטעון את רשימת צמחי הנוי. בדקו את החיבור לאינטרנט.</div>'; });
    return topBar('צמחי נוי ומשתלות') + '<div class="wrap">' + note('טוען את רשימת צמחי הנוי…') + '</div>';
  }
  return idx == null ? nurseryList() : nurseryItem(idx);
}
const ncare = p => p.c >= 0 ? D.nursery.care[p.c] : null;
const nphotos = p => p.ph >= 0 ? D.nursery.photos[p.ph] || [] : [];
function nurseryList() {
  const chip = (k, on, t, extra = '') => `<button class="chip${on ? ' on' : ''}" data-act="nf" data-k="${k}" ${extra}>${t}</button>`;
  later(() => {
    const q = document.getElementById('nq');
    q.addEventListener('input', () => { NST.q = q.value; NST.limit = 60; nurseryUpdate(); });
    nurseryUpdate();
  });
  return topBar('צמחי נוי ומשתלות') + `<div class="wrap">${note('הרשימה הרשמית של משרד החקלאות לצמחי הנוי בישראל. לא כל צמח נמצא בכל משתלה, וחלק מהצמחים נדירים.')}
    <input id="nq" type="search" placeholder="חיפוש לפי שם, משפחה או סוג" value="${esc(NST.q)}">
    <div class="chips">${chip('cat:', !NST.cat, 'הכול')}${Object.entries(NCATS).map(([k, v]) => chip('cat:' + k, NST.cat === k, v)).join('')}</div>
    <div class="chips">${chip('species', NST.species, 'בלי זנים')}${chip('photo', NST.photo, 'עם תמונה')}${chip('care', NST.care, 'עם הנחיות מפורטות')}
      ${chip('sun:שמש מלאה', NST.sun === 'שמש מלאה', 'שמש')}${chip('sun:חצי צל', NST.sun === 'חצי צל', 'חצי צל')}${chip('sun:צל עמוק', NST.sun === 'צל עמוק', 'צל')}${chip('dry', NST.dry, 'עמיד ליובש')}${chip('tox', NST.tox, '⚠️ רעילים')}</div>
    <div id="nres"></div>${footer()}</div>`;
}
ACT.nf = t => {
  const k = t.dataset.k;
  if (k.startsWith('cat:')) { const v = k.slice(4); NST.cat = NST.cat === v ? '' : v; }
  else if (k.startsWith('sun:')) { const v = k.slice(4); NST.sun = NST.sun === v ? '' : v; }
  else NST[k] = !NST[k];
  NST.limit = 60; scrolls[current] = window.scrollY; render();
};
function nurseryUpdate() {
  const q = norm(NST.q);
  const list = D.nursery.plants.filter(p => {
    const c = ncare(p);
    return (!q || p.norm.includes(q)) && (!NST.cat || p.cat === NST.cat) && (!NST.species || !p.cv) && (!NST.care || c) && (!NST.photo || p.ph >= 0) &&
      (!NST.sun || (c && c.sun.includes(NST.sun))) && (!NST.dry || (c && c.res.includes('יובש'))) && (!NST.tox || (c && c.poi) || (p.key && D.toxic.has(p.key)));
  });
  const el = document.getElementById('nres'); if (!el) return;
  el.innerHTML = note(list.length + ' צמחים') + list.slice(0, NST.limit).map(p => {
    const ph = nphotos(p)[0];
    return `<div class="row" data-go="#/nursery/i/${p.i}">${thumbBox(ph && ph.u, p.he)}<div class="t"><div class="n">${esc(p.he)}</div><div class="s">${esc(p.form + ' · משפחת ' + p.fam)}</div>${p.c >= 0 ? '<div class="small" style="color:var(--forest)">יש הנחיות מפורטות</div>' : ''}</div></div>`;
  }).join('') + (list.length > NST.limit ? '<button class="btn out w" id="nmore">הצג עוד</button>' : '');
  const m = document.getElementById('nmore'); if (m) m.onclick = () => { NST.limit += 60; nurseryUpdate(); };
}
function nurseryItem(i) {
  const p = D.nursery.plants[i];
  if (!p) return topBar('צמח') + '<div class="err">הצמח לא נמצא.</div>';
  const c = ncare(p), ph = nphotos(p);
  let h = topBar(p.he) + '<div class="wrap">';
  if (ph.length) h += photoStrip(ph, p.he) + note('תמונה מאומתת: הזיהוי אושר על ידי קהילת המומחים והמתעדים באינטורליסט. לחצו על תמונה להגדלה ולפרטי הרישיון.') + (p.cv ? note('התמונות מציגות את המין, ולא את הזן הזה, ולכן המראה עשוי להיות שונה.') : '');
  else h += note('אין לצמח זה תמונה מאומתת עם רישיון מתאים.');
  if ((c && c.poi) || (p.key && D.toxic.has(p.key))) h += `<div class="danger">צמח זה מסומן כרעיל${c && c.poi ? '. חומרה: ' + esc(c.poi) : ''}${c && c.poip.length ? '. חלקים: ' + esc(c.poip.join(', ')) : ''}. הקפידו במיוחד אם יש בסביבה ילדים או חיות.</div>`;
  h += '<h2>פרטי הצמח</h2>' + fact('שם', p.he) + fact('משפחה', p.fam) + fact('סוג', p.form) + fact('קטגוריה', NCATS[p.cat]) + (p.hy ? fact('מקור', 'מכלוא') : '') + (p.cv ? fact('הערה', 'זן תרבותי') : '');
  if (c) {
    h += '<h2>תנאי גידול</h2>' + fact('אור', c.sun.join(', ')) + fact('קרקע', c.soil.join(', ')) + fact('חומציות קרקע', c.ph.join(', ')) + fact('מים וניקוז', c.drain.join(', ')) + fact('עמידות', c.res.join(', ')) + (c.frost !== 99 ? fact('עמידות לקור', 'עד בערך ' + c.frost + ' מעלות') : '');
    h += '<h2>מראה וגודל</h2>' + (c.h ? fact('גובה', c.h + ' מטר') : '') + (c.w ? fact('רוחב', c.w + ' מטר') : '') + fact('עלווה', c.leaf) + fact('קצב צימוח', c.rate) + fact('צבע פרח', c.fl.join(', ')) + fact('עונת פריחה', c.bl.join(', '));
    h += '<h2>טיפול</h2>' + fact('דרכי ריבוי', c.prop.join(', ')) + fact('דרישות תחזוקה', c.maint) + fact('מתאים ל', c.th.join(', ')) + note((p.cv ? 'הנתונים הם של המין, וזנים עשויים להיות שונים. ' : '') + 'המקור מאמריקה, ולכן עונות הפריחה עשויות להיות שונות בארץ.');
  } else h += note('למין הזה לא נמצאו הנחיות גידול מפורטות במקור. למטה הנחיה כללית לפי סוג הצמח.');
  const gd = D.nursery.guide[p.cat];
  if (gd && gd.length) h += '<h2>הנחיה כללית ל' + esc(NCATS[p.cat]) + '</h2>' + bullets(gd) + note('הנחיה כללית לכל הסוג, ולא למין הזה דווקא.');
  if (plantHref(p.key, p.gid)) h += `<button class="btn out w" data-go="${plantHref(p.key, p.gid)}">🌿 פתח את כרטיס הצמח</button>`;
  h += '<h2>מקורות</h2>' + srcLinks([['רשימת צמחי הנוי בישראל, משרד החקלאות', 'https://www.gov.il/BlobFolder/reports/list-of-ornamental-plants-ini-srael/he/Professional_information_books_list-of-ornamental-plants-ini-srael.pdf'], c ? ['מאגר הצמחים של אוניברסיטת צפון קרוליינה', c.u] : null].filter(Boolean));
  return h + footer() + '</div>';
}

/* ---------- My Botanist: answers only from the app's records ---------- */
const Bot = (() => {
  const GENERIC = new Set(['עץ', 'עצים', 'שיח', 'פרח', 'פרחים', 'צמח', 'צמחים', 'גינה', 'מאכל', 'מרפא'].map(norm));
  const REGION_WORDS = { upper_galilee: ['הגליל העליון', 'גליל עליון'], lower_galilee: ['הגליל התחתון', 'גליל תחתון'], golan: ['רמת הגולן', 'גולן'], hula: ['עמק החולה', 'חולה'], jezreel: ['עמק יזרעאל', 'יזרעאל'], carmel: ['הכרמל', 'כרמל'], coastal: ['מישור החוף'], samaria: ['הרי השומרון', 'שומרון'], jordan_valley: ['בקעת הירדן', 'בקעה'], binyamin: ['הרי בנימין', 'בנימין'], jerusalem: ['הרי ירושלים', 'ירושלים'], shfela: ['שפלת יהודה', 'שפלה'], hebron: ['הרי חברון', 'חברון'], judean_desert: ['מדבר יהודה'], negev: ['הנגב', 'נגב'], arava: ['הערבה', 'ערבה'], eilat: ['הרי אילת', 'אילת'] };
  const COLOR_WORDS = { white: ['לבן', 'לבנים', 'לבנה'], yellow: ['צהוב', 'צהובים', 'צהובה'], red: ['אדום', 'אדומים', 'אדומה'], pink: ['ורוד', 'ורודים', 'ורודה'], purple: ['סגול', 'סגולים', 'סגולה'], blue: ['כחול', 'כחולים', 'כחולה', 'תכלת'], orange: ['כתום', 'כתומים', 'כתומה'] };
  let names = null;
  const id = r => r.key + ':' + r.gid;
  const gOnly = () => D.garden.items.filter(x => !x.key);
  function buildNames() {
    const m = new Map();
    for (const x of D.garden.items) m.set(norm(x.he.split(' (')[0]), { key: x.key || 0, gid: x.id });
    for (const p of D.plants) {
      const r = { key: Number(p.k), gid: -1 };
      if (p.he) m.set(norm(p.he), r);
      for (const a of p.alt || []) if (!m.has(norm(a))) m.set(norm(a), r);
      m.set(norm(p.sci), r);
    }
    for (const k of [...m.keys()]) if (k.length < 3 || GENERIC.has(k)) m.delete(k);
    return m;
  }
  const N = () => names || (names = buildNames());
  const esr = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function has(n, w) { const x = norm(w); return n.includes(x) && new RegExp('(^| )[בלהו]{0,2}' + esr(x) + '( |$)').test(n); }
  const any = (n, ...w) => w.some(x => has(n, x));
  const title = r => { const p = D.byKey.get(r.key); if (p) return p.title; const g = D.garden.items.find(x => x.id === r.gid); return g ? g.he : ''; };
  const sci = r => { const p = D.byKey.get(r.key); if (p) return p.sci; const g = D.garden.items.find(x => x.id === r.gid); return g ? g.sci : ''; };
  const food = r => foodOf(r.key, r.key ? -1 : r.gid) || (r.gid >= 0 ? D.edible.find(e => e.gid === r.gid) : null);
  const med = r => medOf(r.key, r.key ? -1 : r.gid) || (r.gid >= 0 ? D.medicinal.find(e => e.gid === r.gid) : null);
  const item = r => D.garden.items.find(x => (r.key && x.key === r.key) || x.id === r.gid);
  const rFood = r => D.rambam.foods.find(f => (r.key && f.key === r.key) || (!r.key && r.gid >= 0 && f.gid === r.gid));
  const rGloss = r => D.rambam.gloss.find(f => (r.key && f.key === r.key) || (!r.key && r.gid >= 0 && f.gid === r.gid));
  function search(q, limit = 12) {
    const n = norm(q); if (!n) return [];
    const a = rank(q, D.plants).slice(0, limit).map(p => ({ key: Number(p.k), gid: -1 }));
    const b = gOnly().filter(x => norm(x.he + ' ' + x.sci).includes(n)).map(x => ({ key: 0, gid: x.id }));
    return b.concat(a).slice(0, limit);
  }
  function profile(r) {
    const p = D.byKey.get(r.key), g = item(r), t = D.toxic.get(r.key), f = food(r), m = med(r), care = p ? D.grow[String(p.k)] : null, rf = rFood(r);
    const sev = t ? ({ high: 'חמורה', medium: 'בינונית', low: 'נמוכה' }[t.sev] || 'לא דורגה במקור') : '';
    const out = [['שם מדעי', sci(r)], ['משפחה', p ? [famHe(p), p.fam].filter(Boolean).join(' · ') : ''], ['סוג', p ? GROUPS[p.grp] || '' : ''],
      ['מעמד בארץ', p ? ({ native: 'מקומי', introduced: 'מובא' }[p.nat] || '') : ''], ['חודשי פריחה', p && bloomMonths(p).length ? monthsText(bloomMonths(p)) : ''],
      ['צבע פרח', p ? (p.col || []).map(c => COLORS[c]).filter(Boolean).join(', ') : ''],
      ['אזורים עיקריים', p ? Object.entries(p.reg || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => (D.regions.find(x => x.id === k) || {}).he).filter(Boolean).join(', ') : ''],
      ['רעילות', t ? 'מסומן כרעיל, חומרה: ' + sev : ''], ['מאכל', f ? RATE_SHORT[f.rate] : ''], ['מרפא', m ? LEVEL_LONG[m.level] : ''], ['לפי הרמב"ם', rf ? VERDICT[rf.v] : ''],
      ['זריעה', g && g.sow && g.sow.length ? monthsText(g.sow) : ''], ['שתילה', g && g.plant && g.plant.length ? monthsText(g.plant) : ''],
      ['אור', ((g && g.sun && g.sun.length ? g.sun : care && care.sun) || []).join(', ')]];
    return out.filter(x => x[1]);
  }
  const link = (r, sub) => ({ title: title(r), sub: sub == null ? sci(r) : sub, ref: r });
  function named(n) {
    let best = null;
    for (const [name, ref] of N()) if (n.includes(name) && (!best || name.length > best[0].length) && has(n, name)) best = [name, ref];
    return best ? best[1] : null;
  }
  function resolve(text) { const n = text.trim(); return N().get(n) || named(n) || search(n, 1)[0] || null; }
  function compare(n) {
    if (!any(n, 'הבדל', 'ההבדל', 'השוואה', 'להשוות', 'השווה')) return null;
    let after = '';
    const i = n.indexOf(' בינ '); if (i >= 0) after = n.slice(i + 5); else { const j = n.indexOf('בינ '); if (j >= 0) after = n.slice(j + 4); }
    if (!after) return { text: 'כדי להשוות, כתבו למשל: מה ההבדל בין מרווה משולשת למרווה רפואית?' };
    const t = after.split(' ').filter(Boolean);
    for (let k = 1; k < t.length; k++) {
      const w = t[k];
      if (!w.startsWith('ל') || w.length < 3) continue;
      const left = t.slice(0, k).join(' ');
      const right = w === 'לבינ' ? t.slice(k + 1).join(' ') : [w.slice(1), ...t.slice(k + 1)].join(' ');
      const a = resolve(left), b = right ? resolve(right) : null;
      if (!a || !b || id(a) === id(b)) continue;
      const pa = new Map(profile(a)), pb = new Map(profile(b));
      const keys = [...new Set([...pa.keys(), ...pb.keys()])];
      return { text: title(a) + ' | ' + title(b) + '\n' + keys.map(k2 => `${k2}: ${pa.get(k2) || 'אין מידע'} | ${pb.get(k2) || 'אין מידע'}`).join('\n'), links: [link(a), link(b)], sources: ['רשומות המאגר בכרטיסי הצמחים'], compare: [a, b] };
    }
    return { text: 'לא מצאתי את שני הצמחים במאגר. בדקו את האיות או נסו שם מדעי.', answered: false };
  }
  function single(r, question) {
    let own = null;
    for (const [k, v] of N()) if (id(v) === id(r) && question.includes(k) && (!own || k.length > own.length)) own = k;
    const n = own ? question.replace(own, ' ') : question;
    const name = title(r), f = food(r), m = med(r), t = D.toxic.get(r.key), g = item(r);
    if (any(n, 'רעיל', 'מסוכן', 'מסוכנת')) {
      const sev = t ? ({ high: 'חמורה', medium: 'בינונית', low: 'נמוכה' }[t.sev] || 'לא דורגה במקור') : '';
      return { text: t ? `${name} מסומן כרעיל. חומרה לפי המקור: ${sev}.` + ((t.parts || []).length ? '\nחלקים רעילים: ' + t.parts.join(', ') : '') + '\n' + POISON_HELP : `אין במאגר מידע מאומת על רעילות של ${name}. זה אינו אומר שהוא בטוח.`, links: [link(r)], sources: t ? pairs(t.src).map(s => s.t) : [] };
    }
    if (any(n, 'רמב"ם', 'הרמב"ם')) {
      const f2 = rFood(r), g2 = rGloss(r);
      return { text: f2 ? `${name} לפי הרמב"ם: ${f2.t}\n${TRAD_RULE}` : g2 ? `${name} מופיע במילון התרופות של הרמב"ם (ערך ${g2.n}, ${g2.ar}). ` + (g2.mai || 'הערך עוסק בשמות בלבד.') + '\n' + TRAD_RULE : `אין במאגר מידע מאומת על ${name} אצל הרמב"ם.`, links: [link(r)], sources: f2 ? f2.refs.map(x => x.t) : g2 ? ['מילון התרופות, מהדורת מאירהוף'] : [] };
    }
    if (any(n, 'לאכול', 'מאכל', 'אכיל', 'נאכל')) return { text: f ? `${name}: ${RATE_LONG[f.rate]}\n` + ((f.parts || []).length ? 'חלקים למאכל לפי המקור: ' + f.parts.join(', ') + '\n' : '') + FOOD_RULE : `⚪ אין מידע אמין מספיק על אכילת ${name}. אל תאכלו אותו.`, links: [link(r)], sources: f ? pairs(f.src).map(s => s.t) : [] };
    if (any(n, 'מרפא', 'רפואה', 'רפואי', 'רפואית', 'סגולות')) return { text: m ? `${name}. ${LEVEL_LONG[m.level]}\nהפירוט בכרטיס הצמח.\n${MED_RULE}` : `אין במאגר מידע מאומת על שימוש רפואי ב${name}.`, links: [link(r)], sources: m ? pairs(m.src).map(s => s.t) : [] };
    if (any(n, 'לשתול', 'לזרוע', 'שותלים', 'זורעים', 'לגדל', 'גידול', 'שתילה', 'זריעה')) {
      const lines = [];
      if (g && g.sow && g.sow.length) lines.push('זריעה: ' + monthsText(g.sow));
      if (g && g.plant && g.plant.length) lines.push('שתילה: ' + monthsText(g.plant));
      lines.push(...((g && g.care) || []).slice(0, 3));
      return { text: lines.length ? name + '\n' + lines.join('\n') : `אין במאגר הנחיות שתילה מפורטות ל${name}. יש הנחיה כללית בכרטיס הצמח, אם קיימת.`, links: [link(r)], sources: g ? pairs(g.src).map(s => s.t) : [] };
    }
    return { text: name + '\n' + profile(r).map(([k, v]) => `${k}: ${v}`).join('\n'), links: [link(r)], sources: ['רשומות המאגר בכרטיס הצמח'] };
  }
  function months(n, cur) {
    const found = MONTHS.map((m, i) => (has(n, m) || (i === 2 && has(n, 'מרס'))) ? i + 1 : 0).filter(Boolean);
    if (found.length) return found;
    for (const [s, m] of SEASONS) if (has(n, s)) return m;
    if (any(n, 'עכשיו', 'החודש', 'כעת')) return [cur];
    return null;
  }
  function gardenPlan(n, cur) {
    if (!any(n, 'לשתול', 'לזרוע', 'שותלים', 'זורעים')) return null;
    const m = months(n, cur) || [cur];
    const hit = D.garden.items.filter(x => m.some(k => (x.sow || []).includes(k) || (x.plant || []).includes(k)));
    return { text: `לפי חוברת משרד החקלאות, ב${monthsText(m)} מתאים לזרוע או לשתול ${hit.length} צמחים במאגר הגינה:`, links: hit.map(x => ({ title: x.he, sub: x.sci, ref: { key: x.key || 0, gid: x.id } })), sources: ['משרד החקלאות, שה"מ'] };
  }
  function listing(n, cur) {
    const region = Object.keys(REGION_WORDS).find(k => REGION_WORDS[k].some(w => has(n, w)));
    const bloomW = any(n, 'פורח', 'פורחים', 'פורחת', 'פריחה');
    const ms = months(n, cur);
    const color = Object.keys(COLOR_WORDS).find(k => COLOR_WORDS[k].some(w => has(n, w)));
    const tree = any(n, 'עץ', 'עצים'), shrub = any(n, 'שיח', 'שיחים'), flower = any(n, 'פרח', 'פרחים');
    const wild = has(n, 'צמחי בר') || has(n, 'בר');
    const tox = any(n, 'רעיל', 'רעילים', 'רעילה', 'רעילות'), eat = any(n, 'מאכל', 'אכילים', 'לאכול'), heal = any(n, 'מרפא', 'רפואה', 'רפואי', 'רפואיים', 'עממית'), inGarden = any(n, 'גינה', 'גינות');
    if (!region && !ms && !color && !tree && !shrub && !flower && !tox && !eat && !heal && !(wild && !bloomW)) return null;
    const fk = new Map(D.edible.filter(e => e.k).map(e => [e.k, e])), mk = new Set(D.medicinal.filter(e => e.k).map(e => e.k));
    let list = D.plants.filter(p => {
      const k = Number(p.k);
      return (!region || (p.reg || {})[region]) && (!ms || ms.some(m => bloomsIn(p, m))) && (!color || (p.col || []).includes(color)) && (!tree || p.grp === 'tree') && (!shrub || p.grp === 'shrub') &&
        (!(flower && !tree && !shrub) || !isWoody(p)) && (!wild || p.nat === 'native') && (!tox || D.toxic.has(k)) && (!eat || (fk.get(k) && fk.get(k).rate !== 'red')) && (!heal || mk.has(k)) &&
        (!(inGarden && tox) || (D.grow[String(k)] && D.grow[String(k)].care) || D.garden.items.some(x => x.key === k));
    });
    const rk = s => ({ high: 0, '': 1, medium: 2 }[s] ?? 3);
    list.sort((a, b) => rk((D.toxic.get(Number(a.k)) || { sev: 'x' }).sev) - rk((D.toxic.get(Number(b.k)) || { sev: 'x' }).sev) || (!a.he - !b.he) || b.total - a.total);
    const parts = [tree ? 'עצים' : shrub ? 'שיחים' : flower ? 'פרחים' : 'צמחים', tox && 'רעילים', eat && 'למאכל', heal && 'מוכרים ברפואה העממית או במחקר', wild && 'מקומיים', color && 'בצבע ' + COLORS[color], ms && 'הפורחים ב' + monthsText(ms), region && 'ב' + (D.regions.find(x => x.id === region) || {}).he].filter(Boolean).join(' ');
    const notes = [tox && 'הרשימה חלקית. היעדר צמח אינו אומר שהוא בטוח.', eat && FOOD_RULE, heal && MED_RULE, ms && 'תקופת פריחה אופיינית, לא דיווחים מהשטח.', region && 'אזור לפי תצפיות מתועדות.', color && 'הצבע חולץ אוטומטית מטקסט.'].filter(Boolean);
    const src = [region && 'GBIF', ms && 'iNaturalist, ויקיפדיה', tox && 'NC State, ASPCA, ויקיפדיה', eat && 'NC State, USDA, ויקיפדיה', heal && 'NCCIH, EMA, ויקיפדיה'].filter(Boolean);
    if (!list.length) return { text: `לא מצאתי במאגר ${parts}. זה אינו אומר שאין כאלה בטבע.`, sources: src };
    return { text: [`מצאתי ${list.length} ${parts}.`, ...notes].join('\n'), links: list.map(p => link({ key: Number(p.k), gid: -1 }, p.sci)), sources: src };
  }
  function answer(question, month, last) {
    const n = norm(question.replace(/[?!:;]/g, ' '));
    if (!n) return { text: 'כתבו שאלה על צמח, אזור או עונה.' };
    if (any(n, 'מינון', 'מינונים', 'כמה לקחת', 'כמה כוסות', 'כמה כפיות', 'איך לרפא', 'לטפל במחלה')) return { text: 'איני נותן מינונים או המלצות טיפול. פנו לרופא או לרוקח. אפשר לקרוא בכרטיסי צמחי המרפא מה נבדק במחקר.' };
    if (any(n, 'הרעלה', 'הורעל', 'הורעלתי', 'בלע', 'בלעתי', 'בלעה')) return { text: POISON_HELP };
    if (has(n, 'צילמתי')) return last ? { text: 'התצפית האחרונה ביומן: ' + last.text, links: last.ref ? [link(last.ref)] : [], sources: ['יומן הטבע שלך'] } : { text: 'עדיין אין תצפיות ביומן. צלמו צמח במסך הזיהוי ושמרו אותו.' };
    const c = compare(n); if (c) return c;
    if (any(n, 'ייחור', 'ייחורים', 'יחור', 'יחורים', 'להשריש', 'השרשה')) return { text: 'יש מדריך מלא עם שלבים ותמונות במסך "ייחורים והשרשה".', sources: ['הדרכה חקלאית של אוניברסיטאות'], go: '#/guide' };
    const isList = any(n, 'אילו', 'אלו', 'רשימה', 'רשימת', 'כמה', 'מה פורח');
    if (isList && any(n, 'רמב"ם', 'הרמב"ם')) {
      const hit = D.rambam.foods.filter(f => f.key || f.gid >= 0);
      return { text: `הרמב"ם מתייחס ל-${D.rambam.foods.length} צמחים ומאכלים במקורות שבאפליקציה, ובמילון התרופות שלו יש ${D.rambam.gloss.length} ערכים של צמחים.\n${TRAD_RULE}`, links: hit.map(f => ({ title: f.he, sub: f.sci, ref: { key: f.key, gid: f.gid } })), sources: ['הלכות דעות פרק ד', 'מילון התרופות, מהדורת מאירהוף'] };
    }
    if (!isList) { const r = named(n); if (r) return single(r, n); }
    const gp = gardenPlan(n, month); if (gp) return gp;
    const ls = listing(n, month); if (ls) return ls;
    const r = named(n); if (r) return single(r, n);
    return { text: 'אין לי מידע מאומת על כך במאגר.', answered: false };
  }
  function contextFor(question) {
    const n = norm(question.replace(/[?!:;]/g, ' '));
    const refs = [], seen = new Set();
    const push = r => { if (r && !seen.has(id(r)) && refs.length < 8) { seen.add(id(r)); refs.push(r); } };
    push(named(n));
    for (const w of n.split(' ').filter(x => x.length >= 3)) search(w, 3).forEach(push);
    return refs.map(r => {
      const care = ((item(r) || {}).care || []).length ? item(r).care : ((D.grow[String(r.key)] || {}).care || []);
      return title(r) + '\n' + profile(r).map(([k, v]) => `${k}: ${v}`).join('\n') + (care.length ? '\nגידול: ' + care.slice(0, 4).join(' ') : '');
    }).join('\n\n');
  }
  return { answer, contextFor, search, title, sci, profile };
})();

const RULES = 'אתה הבוטנאי של אפליקציית צמחי ארץ ישראל. ענה בעברית פשוטה וקצרה, רק על סמך הרשומות שמופיעות בהודעה. אם אין בהן תשובה, כתוב בדיוק: אין לי מידע מאומת על כך במאגר. אל תשתמש בידע אחר ואל תמציא. אל תיתן מינונים או המלצות טיפול. לעולם אל תאשר שצמח בטוח לאכילה או לשימוש רפואי. בסוף ציין את שמות הרשומות שעליהן התבססת.';
const Gemini = {
  base: 'https://generativelanguage.googleapis.com/v1beta/',
  async models(key) {
    const r = await fetch(this.base + 'models?pageSize=200', { headers: { 'x-goog-api-key': key } });
    if ([400, 401, 403].includes(r.status)) throw new Error('מפתח Gemini אינו תקין. בדקו אותו בהגדרות.');
    if (!r.ok) throw new Error('שירות Gemini החזיר שגיאה (' + r.status + ').');
    const j = await r.json();
    return (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent') && /flash/.test(m.name) && !/tts|image|live|audio|transcribe|embedding|preview|exp/.test(m.name)).map(m => m.name.replace('models/', '')).sort().reverse();
  },
  async ask(key, q, ctx) {
    let list;
    try { list = await this.models(key); } catch (e) { if (e instanceof TypeError) throw new Error('אין חיבור ל-Gemini. השאלות על המאגר ממשיכות לעבוד בלי אינטרנט.'); throw e; }
    const body = JSON.stringify({ system_instruction: { parts: [{ text: RULES }] }, contents: [{ parts: [{ text: 'רשומות:\n' + (ctx || '(אין רשומות מתאימות)') + '\n\nשאלה: ' + q }] }] });
    let last = 0;
    for (const m of (list.length ? list : ['gemini-3.5-flash']).slice(0, 4)) {
      const r = await fetch(this.base + 'models/' + m + ':generateContent', { method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' }, body });
      last = r.status;
      if (r.ok) { const j = await r.json(); const parts = (((j.candidates || [])[0] || {}).content || {}).parts || []; return parts.map(p => p.text || '').join('') || 'אין לי מידע מאומת על כך במאגר.'; }
    }
    throw new Error(last === 429 ? 'הגעתם למכסת השימוש של Gemini. נסו מאוחר יותר.' : 'שירות Gemini לא זמין כרגע (' + last + ').');
  },
};

const CHAT = [];
const SUGG = ['איזה צמח צילמתי?', 'אילו עצים גדלים בהרי השומרון?', 'אילו פרחים פורחים ב' + MONTHS[nowMonth() - 1] + '?', 'מה ההבדל בין מרווה משולשת למרווה רפואית?', 'אילו צמחים רעילים נפוצים בגינות?', 'אילו צמחי בר מוכרים ברפואה העממית?'];
let botBusy = false;
function botPage() {
  later(() => {
    const inp = document.getElementById('bq');
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); botSend(inp.value); } });
  });
  return topBar('הבוטנאי שלי') + `<div class="wrap">${note('התשובות מגיעות ממאגר האפליקציה ופועלות גם בלי אינטרנט. כשאין מידע מאומת, זה נאמר במפורש.')}
    <div class="chips">${SUGG.map((s, i) => `<button class="chip" data-act="sugg" data-i="${i}">${esc(s)}</button>`).join('')}</div>
    <div id="chat">${CHAT.map(chatHtml).join('')}</div>
    <div class="chatbar"><input id="bq" type="text" placeholder="שאלו על צמח, אזור או עונה"><button class="btn" data-act="bsend">שלח</button></div></div>`;
}
const BLINKS = {};
function chatHtml(m) {
  if (m.q) return `<div class="msg q"><div class="pre">${esc(m.q)}</div></div>`;
  const a = m.a, lid = 'l' + Math.random().toString(36).slice(2); BLINKS[lid] = a;
  const links = (a.links || []).slice(0, a.more ? 1e9 : 8).map(l => `<div class="row" data-go="${plantHref(l.ref.key, l.ref.gid)}"><div class="t"><div class="n" style="color:var(--forest)">${esc(l.title)}</div><div class="s ltr">${esc(l.sub)}</div></div></div>`).join('');
  return `<div class="msg a">${a.ai ? '<div class="small" style="color:var(--warnfg)">🤖 נוסח בידי בינה מלאכותית, על סמך רשומות המאגר בלבד. ייתכנו טעויות.</div>' : ''}<div class="pre">${esc(a.text)}</div>${links}
    ${(a.links || []).length > 8 && !a.more ? `<button class="link" data-act="bmore" data-id="${lid}">הצג עוד ${a.links.length - 8}</button>` : ''}
    ${a.compare ? `<button class="btn out w" data-go="#/compare/${a.compare[0].key}:${a.compare[0].gid}/${a.compare[1].key}:${a.compare[1].gid}">⚖️ פתח השוואה מלאה</button>` : ''}
    ${a.go ? `<button class="btn out w" data-go="${a.go}">פתח את המדריך</button>` : ''}
    ${(a.sources || []).length ? `<div class="small">מקורות: ${esc([...new Set(a.sources)].join(' · '))}</div>` : ''}</div>`;
}
ACT.sugg = t => botSend(SUGG[Number(t.dataset.i)]);
ACT.bsend = () => botSend(document.getElementById('bq').value);
ACT.bmore = t => { BLINKS[t.dataset.id].more = true; document.getElementById('chat').innerHTML = CHAT.map(chatHtml).join(''); };
async function botSend(q) {
  q = (q || '').trim(); if (!q || botBusy) return;
  botBusy = true;
  CHAT.push({ q });
  const chat = document.getElementById('chat');
  chat.innerHTML = CHAT.map(chatHtml).join('') + note('מחפש במאגר…');
  const inp = document.getElementById('bq'); if (inp) inp.value = '';
  let last = null;
  try {
    const obs = (await idb.all())[0];
    if (obs) last = { text: `${obs.name || obs.sci || 'עדיין לא זוהתה'} (${bothDates(new Date(obs.time))})`, ref: obs.plantKey ? { key: obs.plantKey, gid: -1 } : null };
  } catch (e) { }
  let a = Bot.answer(q, nowMonth(), last);
  const key = store.get('gemini', '');
  if (a.answered === false) {
    if (key) {
      try { a = { text: await Gemini.ask(key, q, Bot.contextFor(q)), sources: ['רשומות המאגר בלבד'], ai: true }; }
      catch (e) { a = Object.assign({}, a, { text: a.text + '\n' + e.message }); }
    } else a = Object.assign({}, a, { text: a.text + '\nאפשר להוסיף בהגדרות מפתח Gemini לשאלות חופשיות.' });
  }
  CHAT.push({ a });
  botBusy = false;
  const c2 = document.getElementById('chat');
  if (c2) { c2.innerHTML = CHAT.map(chatHtml).join(''); const msgs = c2.querySelectorAll('.msg.a'); msgs[msgs.length - 1].scrollIntoView({ block: 'start' }); }
}

/* ---------- compare ---------- */
const parseRef = s => { if (!s) return null; const [k, g] = String(s).split(':'); return { key: Number(k) || 0, gid: g == null ? -1 : Number(g) }; };
function comparePage(a, b) {
  const A = parseRef(a), B = parseRef(b);
  later(() => {
    for (const side of ['a', 'b']) {
      const inp = document.getElementById('c' + side), out = document.getElementById('h' + side);
      inp.addEventListener('input', () => {
        const hits = Bot.search(inp.value, 6);
        out.innerHTML = hits.map(r => `<div class="row" data-go="#/compare/${side === 'a' ? `${r.key}:${r.gid}/${b || ''}` : `${a || ''}/${r.key}:${r.gid}`}"><div class="t"><div class="n">${esc(Bot.title(r))}</div><div class="s ltr">${esc(Bot.sci(r))}</div></div></div>`).join('');
      });
    }
  });
  let h = topBar('השוואת צמחים') + '<div class="wrap">';
  h += `<input id="ca" type="search" placeholder="${esc(A ? Bot.title(A) : 'צמח ראשון')}"><div id="ha"></div><input id="cb" type="search" placeholder="${esc(B ? Bot.title(B) : 'צמח שני')}"><div id="hb"></div>`;
  if (A && B) {
    const pa = new Map(Bot.profile(A)), pb = new Map(Bot.profile(B));
    const keys = [...new Set([...pa.keys(), ...pb.keys()])];
    h += `<table class="cmp"><tr><th></th><th><a href="${plantHref(A.key, A.gid)}">${esc(Bot.title(A))}</a></th><th><a href="${plantHref(B.key, B.gid)}">${esc(Bot.title(B))}</a></th></tr>` +
      keys.map(k => `<tr><td style="color:var(--earth)">${esc(k)}</td><td>${esc(pa.get(k) || 'אין מידע')}</td><td>${esc(pb.get(k) || 'אין מידע')}</td></tr>`).join('') + '</table>' + note('מבוסס על הרשומות בכרטיסי הצמחים, ושם מופיעים המקורות.');
  } else h += note('הקלידו שם ובחרו צמח בכל אחד מהשדות.');
  return h + footer() + '</div>';
}

/* ---------- settings & install ---------- */
function settingsPage() {
  return topBar('הגדרות') + `<div class="wrap">
    <h2>מפתח זיהוי של Pl@ntNet</h2>${note('הזיהוי במצלמה משתמש בשירות Pl@ntNet. המפתח חינמי. אחרי קבלת המפתח, יש להוסיף באתר שלהם את הכתובת ralgranot-dotcom.github.io לרשימת האתרים המורשים (Authorized domains).')}
    <a href="https://my.plantnet.org/" target="_blank" rel="noopener">קבלת מפתח מ-Pl@ntNet</a>
    <input id="pk" type="password" placeholder="מפתח Pl@ntNet" value="${esc(store.get('plantnet', ''))}"><button class="btn w" data-act="savePk">שמור ובדוק</button><div id="pkm"></div>
    <h2>מפתח Gemini (רשות)</h2>${note('הבוטנאי עונה מהמאגר גם בלעדיו. המפתח משמש רק לשאלות חופשיות שאין להן תשובה מוכנה, ונשלחות אז השאלה והרשומות הקשורות בלבד.')}
    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">קבלת מפתח חינמי מ-Google</a>
    <input id="gk" type="password" placeholder="מפתח Gemini" value="${esc(store.get('gemini', ''))}"><button class="btn w" data-act="saveGk">שמור ובדוק</button><div id="gkm"></div>
    <h2>תמונות לשימוש ללא אינטרנט</h2>${note('תמונות שכבר נפתחו נשמרות בטלפון. אפשר גם להוריד מראש תמונה אחת לכל אחד מ-300 הצמחים הנפוצים (בערך 15 מגה).')}
    <button class="btn out w" data-act="prefetch">⬇️ הורד תמונות מראש</button><div id="pf"></div>
    <h2>נתונים אישיים</h2>${note('המועדפים, היומן והמפתחות נשמרים רק בטלפון הזה.')}<button class="btn out w" data-act="clearAll">🗑️ מחק את כל הנתונים האישיים</button><div id="clr"></div>
    <h2>מקורות ורישיונות</h2>${srcLinks([['GBIF: תצפיות, טקסונומיה ותמונות (CC0, CC BY)', 'https://www.gbif.org'], ['iNaturalist: תמונות ותצפיות פריחה', 'https://www.inaturalist.org'], ['ויקיפדיה העברית: טקסטים (CC BY-SA)', 'https://he.wikipedia.org'], ['Kew, POWO/WCVP: צורת חיים ושמות נרדפים', 'https://powo.science.kew.org'], ['NC State Extension: הנחיות גידול ורעילות', 'https://plants.ces.ncsu.edu'], ['ASPCA: רעילות לבעלי חיים', 'https://www.aspca.org/pet-care/animal-poison-control'], ['NCCIH: צמחי מרפא', 'https://www.nccih.nih.gov'], ['USDA FoodData: ערכים תזונתיים', 'https://fdc.nal.usda.gov'], ['משרד החקלאות: לוח עבודות בגינה ורשימת צמחי הנוי', 'https://www.gov.il/he/departments/ministry_of_agriculture_and_rural_development'], ['ספריא: משנה תורה, הלכות דעות', 'https://www.sefaria.org'], ['Wellcome Collection: מהדורת מאירהוף', 'https://wellcomecollection.org/works/qvuyx55v']])}
    ${note('רוב המידע נאסף ועובד אוטומטית. ייתכנו טעויות. מאגר הנתונים עודכן ב-' + (D.generated || '') + '.')}
    <h2>אודות</h2><div>צמחי ארץ ישראל · מאת: איתן נוה · גרסה ${esc(VERSION)} (גרסת אתר)</div>
    <button class="btn out w" data-go="#/install">📲 איך מתקינים באייפון</button>${footer()}</div>`;
}
ACT.savePk = async () => {
  const k = document.getElementById('pk').value.trim(); const m = document.getElementById('pkm');
  store.set('plantnet', k);
  if (!k) { m.innerHTML = note('המפתח הוסר.'); return; }
  m.innerHTML = note('בודק…');
  try {
    const r = await fetch('https://my-api.plantnet.org/v2/quota/daily?api-key=' + encodeURIComponent(k));
    m.innerHTML = r.ok ? note('המפתח תקין ✓') : warn('המפתח נשמר, אבל השירות דחה אותו (' + r.status + '). בדקו שהעתקתם נכון ושהאתר מורשה במפתח.');
  } catch (e) { m.innerHTML = warn('המפתח נשמר. לא הצלחתי לבדוק אותו: אין חיבור, או שהאתר עדיין לא הוגדר כמורשה במפתח.'); }
};
ACT.saveGk = async () => {
  const k = document.getElementById('gk').value.trim(); const m = document.getElementById('gkm');
  store.set('gemini', k);
  if (!k) { m.innerHTML = note('המפתח הוסר.'); return; }
  m.innerHTML = note('בודק…');
  try { await Gemini.models(k); m.innerHTML = note('המפתח תקין ✓'); } catch (e) { m.innerHTML = warn(e instanceof TypeError ? 'אין חיבור לאינטרנט. המפתח נשמר.' : e.message); }
};
ACT.clearAll = async () => {
  const b = document.getElementById('clr');
  if (!b.dataset.ok) { b.dataset.ok = '1'; b.innerHTML = warn('לחצו שוב על הכפתור כדי לאשר מחיקה של היומן, המועדפים והמפתחות.'); return; }
  ['favs', 'plantnet', 'gemini'].forEach(k => store.del(k));
  try { await idb.clear(); } catch (e) { }
  b.dataset.ok = ''; b.innerHTML = note('הנתונים האישיים נמחקו.');
};
ACT.prefetch = async () => {
  const el = document.getElementById('pf');
  const urls = D.plants.filter(p => p.ph.length).sort((a, b) => b.total - a.total).slice(0, 300).map(p => thumb(p.ph[0].u));
  let done = 0, fail = 0;
  el.innerHTML = note('מוריד…');
  const cache = 'caches' in window ? await caches.open('tz-img') : null;
  if (!cache) { el.innerHTML = warn('הדפדפן אינו תומך בשמירת תמונות.'); return; }
  const work = async () => { while (urls.length) { const u = urls.shift(); try { if (!(await cache.match(u))) await cache.add(new Request(u, { mode: 'no-cors' })); done++; } catch (e) { fail++; } el.innerHTML = note(`הורדו ${done} תמונות${fail ? `, ${fail} נכשלו` : ''}…`); } };
  await Promise.all([work(), work(), work(), work()]);
  el.innerHTML = note(`הסתיים: ${done} תמונות נשמרו${fail ? `, ${fail} נכשלו` : ''}.`);
};
function installPage() {
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  return topBar('התקנה באייפון') + `<div class="wrap">${standalone ? '<div class="box">✓ האפליקציה כבר מותקנת ופתוחה מהמסך הראשי.</div>' : ''}
    <h2>באייפון</h2><ol><li>פתחו את האתר בדפדפן Safari.</li><li>לחצו על כפתור השיתוף: ריבוע עם חץ למעלה, בתחתית המסך.</li><li>גללו מטה ולחצו "הוספה למסך הבית".</li><li>לחצו "הוסף" בפינה העליונה.</li><li>פתחו את "צמחי ארץ ישראל" מהסמל החדש במסך הבית.</li></ol>
    <h2>באנדרואיד</h2><ol><li>פתחו את האתר ב-Chrome.</li><li>לחצו על שלוש הנקודות למעלה.</li><li>לחצו "הוספה למסך הבית" או "התקנת אפליקציה".</li></ol>
    ${note('אחרי הפתיחה הראשונה עם אינטרנט, מאגר הצמחים נשמר בטלפון ורוב המסכים עובדים גם בלי אינטרנט. זיהוי בתמונה, הבוטנאי עם Gemini ותמונות שלא נפתחו עדיין דורשים אינטרנט.')}
    ${note('אייפון עלול למחוק נתונים של אתר שלא נפתח זמן רב. כדי לשמור את היומן, ייצאו אותו מדי פעם לקובץ.')}${footer()}</div>`;
}

/* ---------- start ---------- */
(async function start() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  try { await loadAll(); } catch (e) {
    console.error(e);
    $app.innerHTML = '<div class="err">לא הצלחתי לטעון את מאגר הצמחים. בדקו את החיבור לאינטרנט ונסו שוב.<br><button class="btn" onclick="location.reload()">נסה שוב</button></div>';
    return;
  }
  render();
  window.__ready = true;
})();

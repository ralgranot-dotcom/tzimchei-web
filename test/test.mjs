// Walks every screen of the web app in a phone-sized browser and fails on any error.
// Usage: node test.mjs BASE_URL [webkit|chromium] [shotsDir]
import { webkit, chromium, devices } from 'playwright';
import fs from 'fs';

const base = process.argv[2] || 'http://localhost:8000/';
const engine = process.argv[3] || 'chromium';
const shots = process.argv[4] || '';
const browser = await (engine === 'webkit' ? webkit : chromium).launch(engine === 'chromium' && fs.existsSync('/usr/bin/google-chrome') ? { executablePath: '/usr/bin/google-chrome' } : {});
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|example\.org/.test(m.text())) errors.push('console: ' + m.text()); });
let failed = 0, n = 0;

async function shot(name) { if (shots) await page.screenshot({ path: `${shots}/${String(++n).padStart(2, '0')}-${name}.png` }); }
async function expect(step, ...texts) {
  try {
    for (const t of texts) await page.getByText(t, { exact: false }).first().waitFor({ state: 'attached', timeout: 20000 });
    if (await page.locator('.err').count()) throw new Error('error box: ' + await page.locator('.err').first().innerText());
    console.log('OK  ', step);
  } catch (e) { failed++; console.log('FAIL', step, '-', e.message.split('\n')[0]); }
  await shot(step);
}
const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(400); };
const click = async sel => { await page.locator(sel).first().click(); await page.waitForTimeout(500); };

await page.goto(base);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
await expect('home', 'זהה צמח עכשיו', 'מאת: איתן נוה', 'תשפ', 'גרסה', 'הבוטנאי שלי');
await go('#/list/woody'); await expect('woody', 'צמחים');
await page.fill('#q', 'חרוב'); await page.waitForTimeout(600); await expect('search', 'חרוב');
await click('#res .row'); await expect('plant', 'מידע כללי', 'שם מדעי', 'מקורות');
await click('[data-act=fav]'); await expect('fav-added', 'במועדפים');
await go('#/list/fav'); await expect('fav-list', 'צמחים');
await go('#/list/bloom'); await expect('bloom', 'תקופת פריחה אופיינית');
await go('#/map'); await expect('map', 'לחץ על אזור');
await click('.map .row'); await expect('region', 'צמחים');
await go('#/identify'); await expect('identify', 'צלם או בחר תמונה', 'הזיהוי האוטומטי אינו ודאי');
await go('#/journal'); await expect('journal', 'יומן', 'הוסף תצפית');
await go('#/add/0'); await page.fill('#obsnote', 'בדיקה'); await click('[data-act=saveObs]');
await expect('journal-saved', 'צמח שלא זוהה', 'בדיקה');
await go('#/toxic'); await expect('toxic', 'מרכז הרעלות', 'הרשימה חלקית');
await click('.wrap > .row'); await expect('toxic-plant', 'צמח המסומן כרעיל', 'חומרה לפי המקור');
await go('#/garden'); await expect('garden', 'מה עושים בגינה');
await click('#gres .row'); await expect('garden-item', 'מתי זורעים');
await go('#/garden/month/11'); await expect('garden-month', 'משרד החקלאות');
await go('#/garden/natural'); await expect('natural', 'טיפול טבעי');
await go('#/guide'); await expect('guide', 'עקרונות בסיסיים');
await click('.wrap > .row'); await expect('guide-method', 'שלב אחר שלב');
await go('#/food'); await expect('food', 'גם סימון ירוק');
await go('#/herbal'); await expect('herbal', 'רמת ראיות');
await go('#/rambam'); await expect('rambam', 'אוכלים רק כשרעבים');
await go('#/rambam/foods'); await expect('rambam-foods', 'הלכות דעות');
await go('#/rambam/gloss'); await expect('rambam-gloss', 'מילון שמות התרופות');
await click('#gres2 .row'); await expect('rambam-entry', 'ודאות הזיהוי');
await go('#/rambam/about'); await expect('rambam-about', 'רבי משה בן מימון');
await go('#/nursery'); await expect('nursery', 'הרשימה הרשמית', 'צמחים');
await click('#nres .row'); await expect('nursery-item', 'פרטי הצמח');
await go('#/bot'); await expect('bot', 'פועלות גם בלי אינטרנט');
await click('[data-act=sugg][data-i="1"]'); await expect('bot-list', 'מצאתי');
await click('[data-act=sugg][data-i="3"]'); await expect('bot-compare', 'פתח השוואה מלאה');
await click('[data-act=sugg][data-i="0"]'); await expect('bot-photo', 'התצפית האחרונה');
await page.fill('#bq', 'מה מזג האוויר מחר'); await click('[data-act=bsend]'); await expect('bot-unknown', 'אין לי מידע מאומת');
await go('#/compare'); await page.fill('#ca', 'חרוב'); await page.waitForTimeout(500); await click('#ha .row');
await page.fill('#cb', 'מרווה'); await page.waitForTimeout(500); await click('#hb .row'); await expect('compare', 'שם מדעי', 'אין מידע');
await go('#/settings'); await expect('settings', 'מפתח זיהוי של Pl@ntNet', 'מקורות ורישיונות');
await go('#/install'); await expect('install', 'הוספה למסך הבית');
await go('#/'); await expect('home-again', 'זהה צמח עכשיו');

if (errors.length) { failed++; console.log('ERRORS:\n' + errors.join('\n')); }
await browser.close();
console.log(failed ? `FAILED ${failed}` : 'ALL SCREENS PASSED');
process.exit(failed ? 1 : 0);

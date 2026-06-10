// tests/matrix/harvest.mjs
// One-time discovery: samples real slugs/IDs from prod and writes the committed
// input matrix. Re-run only when the data pool needs refreshing; baselines must
// be recaptured (RECAPTURE=1) afterwards.
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { lookupReference } from 'scripture-guide';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROD = 'https://bookofmormon.online/en';
// The deployed prod schema predates some queries the current frontend uses
// (no `object` query, no `archive`/`principal` on HistoricalDocument). Those
// pools are harvested from the dev backend instead — same shared bom_prd DB,
// so the slugs/IDs are identical content.
const DEV = process.env.HARVEST_DEV_URL || 'http://localhost:5005/en';

async function gql(query, endpoint = PROD) {
  const { data } = await axios.post(endpoint, { query }, {
    headers: { 'Content-Type': 'application/json' }, timeout: 45000,
  });
  if (!data?.data) throw new Error(`Harvest probe failed: ${query.slice(0, 60)} → ${JSON.stringify(data).slice(0, 200)}`);
  return data.data;
}

// Deterministic sample: first, last, and evenly spaced middles.
function spread(arr, n) {
  if (arr.length <= n) return arr;
  if (n === 1) return [arr[0]]; // avoid 0/0 → NaN index below
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(arr[Math.floor((i * (arr.length - 1)) / (n - 1))]);
  return [...new Set(out)];
}

const warnings = [];
async function probe(label, query, extract, endpoint = PROD) {
  try {
    const pool = extract(await gql(query, endpoint)).filter((v) => v !== null && v !== undefined);
    if (!pool.length) throw new Error('empty pool');
    console.log(`✓ ${label}: ${pool.length} items`);
    return pool;
  } catch (error) {
    warnings.push(`${label}: ${error.message}`);
    console.warn(`✗ ${label}: ${error.message}`);
    return null;
  }
}

const REQUIRED = ['people', 'places', 'objects', 'divisions', 'maps', 'commentaries', 'images', 'texts'];

async function main() {
  // 1 Nephi 1 (20 verses) — anchor chapter for passagenotes-based extraction.
  const NEPHI1_CH = lookupReference('1 Nephi 1').verse_ids;
  // Known markdown slugs from the frontend (About.js / Tos.js); the unfiltered
  // {markdown{slug}} list form crashes the resolver (WHERE slug undefined).
  const MD_SLUGS = ['bom', 'official', 'contribute', 'disclaimer', 'what', 'who', 'why', 'contact', 'tos', 'privacy'];

  const pools = {
    people:       await probe('people',       '{person{slug}}',                (d) => d.person.map((x) => x.slug)),
    places:       await probe('places',       '{place{slug}}',                 (d) => d.place.map((x) => x.slug)),
    // `object` does not exist in the deployed prod schema (newer feature) — harvest from dev.
    objects:      await probe('objects',      '{object{slug}}',                (d) => d.object.map((x) => x.slug), DEV),
    divisions:    await probe('divisions',    '{division{slug pages{slug}}}',  (d) => d.division.map((x) => x.slug)),
    pages:        await probe('pages',        '{division{slug pages{slug}}}',  (d) => d.division.flatMap((x) => x.pages.map((p) => p.slug))),
    maps:         await probe('maps',         '{maps{slug}}',                  (d) => d.maps.map((x) => x.slug)),
    commentaries: await probe('commentaries', '{commentary{id}}',              (d) => d.commentary.map((x) => x.id)),
    // Unfiltered {image{id}} returns empty data on prod — extract ids from 1 Nephi 1 passagenotes.
    images:       await probe('images',       `{passagenotes(verse_ids:[${NEPHI1_CH.join(',')}]){images{id}}}`, (d) => [...new Set(d.passagenotes.images.map((x) => x.id))]),
    publications: await probe('publications', '{publications{source_slug}}',   (d) => d.publications.map((x) => x.source_slug)),
    chiasms:      await probe('chiasms',      '{chiasmus{chiasmus_id}}',       (d) => d.chiasmus.map((x) => x.chiasmus_id)),
    // Deployed prod HistoricalDocument lacks archive/principal fields — harvest from dev.
    histories:    await probe('histories',    '{history{slug archive principal}}', (d) => d.history.map((x) => x.slug), DEV),
    archives:     await probe('archives',     '{history{slug archive principal}}', (d) => [...new Set(d.history.map((x) => x.archive))], DEV),
    principals:   await probe('principals',   '{history{slug archive principal}}', (d) => [...new Set(d.history.flatMap((x) => x.principal || []))], DEV),
    faxes:        await probe('faxes',        '{fax{slug}}',                   (d) => d.fax.map((x) => x.slug)),
    markdowns:    await probe('markdowns',    `{markdown(slug:[${MD_SLUGS.map((s) => `"${s}"`).join(',')}]){slug}}`, (d) => d.markdown.map((x) => x.slug)),
  };
  // Unfiltered {text{slug}} crashes the resolver (requires slug arg) — extract
  // text slugs from the first harvested page instead.
  pools.texts = pools.pages
    ? await probe('texts', `{page(slug:["${pools.pages[0]}"]){sections{rows{narration{text{slug}}}}}}`,
        (d) => d.page.flatMap((pg) => (pg.sections || []).flatMap((s) => (s.rows || []).map((r) => r?.narration?.text?.slug))))
    : null;
  // Unfiltered {section{slug}} returns the literal string "null" for every row
  // on prod — pull real section slugs from the first harvested page instead.
  pools.sections = pools.pages
    ? await probe('sections', `{page(slug:["${pools.pages[0]}"]){sections{slug}}}`,
        (d) => d.page.flatMap((pg) => (pg.sections || []).map((s) => s.slug)).filter((s) => s && s !== 'null'))
    : null;

  const missing = REQUIRED.filter((k) => !pools[k]);
  if (missing.length) {
    throw new Error(`Required pools failed to harvest: ${missing.join(', ')} — aborting without writing inputs.json`);
  }

  // shortLink needs a known hash: create one deterministic shortlink and record it.
  const shortlinkData = await gql('mutation shortlink{shortlink(string:"/regression-suite-anchor"){hash}}');
  const shortlinkHash = shortlinkData.shortlink.hash;
  console.log(`✓ shortlink anchor hash: ${shortlinkHash}`);

  // 2 Nephi 12 quotes Isaiah 2 verse-for-verse → aligned verse_pairs.
  const bomIds = lookupReference('2 Nephi 12:1-5').verse_ids;
  const bibleIds = lookupReference('Isaiah 2:1-5').verse_ids;
  const pairs = bomIds.map((id, i) => [id, bibleIds[i]]);

  const p = (pool, n) => spread(pools[pool] || [], n);
  const NEPHI1 = lookupReference('1 Nephi 1:1-5').verse_ids; // stable verse_id anchor

  const matrix = {
    // ---- content suite (anonymous reads, en+ko) ----
    person:     { tier: 'exact', cases: { single: [p('people', 1)[0]], batch: p('people', 4), missing: ['zz-no-such-person'] } },
    personList: { tier: 'exact', cases: { batch: p('people', 4) } },
    places:     { tier: 'exact', cases: { single: [p('places', 1)[0]], batch: p('places', 4), missing: ['zz-no-such-place'] } },
    placeList:  { tier: 'exact', cases: { batch: p('places', 4) } },
    // prodStale: missing from the deployed prod schema — see spec "Prod schema drift"
    object:     { tier: 'exact', prodStale: true, cases: { single: [p('objects', 1)[0]], batch: p('objects', 4), missing: ['zz-no-such-object'] } },
    objectList: { tier: 'exact', prodStale: true, cases: { batch: p('objects', 4) } },
    page:       { tier: 'exact', cases: { single: [p('pages', 1)[0]], batch: p('pages', 2) } },
    contents:   { tier: 'exact', cases: { single: [p('divisions', 1)[0]], batch: p('divisions', 2) } },
    divisionShell: { tier: 'exact', cases: { single: [p('divisions', 1)[0]] } },
    markdown:   pools.markdowns ? { tier: 'exact', cases: { single: [p('markdowns', 1)[0]] } } : undefined,
    about:      { tier: 'exact', cases: { all: true } },
    labels:     { tier: 'exact', cases: { all: true } },
    passagenotes:   { tier: 'exact', prodStale: true, cases: { single: [NEPHI1[0]], batch: NEPHI1 } },
    passagenotes_0: { tier: 'exact', prodStale: true, cases: { batch: NEPHI1 } },
    passagenotes_7: { tier: 'exact', prodStale: true, cases: { batch: NEPHI1 } },

    // ---- scripture suite ----
    scripture: { tier: 'exact', cases: { verse: ['1 Nephi 3:7'], range: ['Mosiah 2:17-19'], chapter: ['3 Nephi 11'] } },
    verses:    { tier: 'exact', cases: { single: [NEPHI1[0]], batch: NEPHI1 } },
    read:      { tier: 'exact', cases: { chapter: ['1 Nephi 1'], range: ['Alma 17-18'] } },
    lookup:    { tier: 'exact', cases: { single: ['1 Nephi 1:1'], batch: ['Alma 32:21', 'Ether 12:6'] } },
    versehighlights: { tier: 'exact', cases: { single: [pairs[0]], batch: pairs } },
    chiasmus:  { tier: 'exact', cases: { all: true } },
    chiasm:    { tier: 'exact', cases: { single: [p('chiasms', 1)[0]], batch: p('chiasms', 3) } },

    // ---- media suite ----
    image:      { tier: 'exact', cases: { single: [p('images', 1)[0]], batch: p('images', 3), missing: [99999999] } },
    imageInFeed:    { tier: 'exact', cases: { single: [p('images', 1)[0]] } },
    imageLocations: { tier: 'exact', cases: { batch: p('images', 3) } },
    commentary: { tier: 'exact', cases: { single: [p('commentaries', 1)[0]], batch: p('commentaries', 3), missing: [99999999] } },
    commentaryInFeed:    { tier: 'exact', cases: { single: [p('commentaries', 1)[0]] } },
    commentaryLocations: { tier: 'exact', cases: { batch: p('commentaries', 3) } },
    textInFeed:    { tier: 'exact', cases: { single: [p('texts', 1)[0]] } },
    sectionInFeed: pools.sections ? { tier: 'exact', cases: { single: [p('sections', 1)[0]] } } : undefined,
    fax:      pools.faxes ? { tier: 'exact', cases: { all: true, single: [p('faxes', 1)[0]] } } : undefined,
    faxIndex: pools.faxes ? { tier: 'exact', cases: { single: [p('faxes', 1)[0]] } } : undefined,
    maplist:  { tier: 'exact', cases: { all: true } },
    map:      { tier: 'exact', cases: { single: [p('maps', 1)[0]], batch: p('maps', 2) } },
    mapstories: { tier: 'exact', cases: { single: [p('maps', 1)[0]] } },
    timeline: { tier: 'exact', cases: { all: true } },
    publications: { tier: 'exact', cases: { all: true } },

    // ---- search suite ----
    search:    { tier: 'shape', cases: { word: ['faith'], phrase: ['sword of laban'], noresults: ['zzqxnoresults'] } },
    shortLink: { tier: 'exact', cases: { single: [shortlinkHash], missing: ['zzzzzz'] } },
    setShortLink: { tier: 'exact', langs: ['en'], cases: { fixed: ['/regression-suite-anchor'] } },
    history:   { tier: 'exact', prodStale: true, cases: {
      single: [p('histories', 1)[0]],
      archive: [{ archive: p('archives', 1)[0] }],
      principal: [{ principal: p('principals', 1)[0] }],
      missing: ['zz-no-such-history'],
    } },

    // ---- user suite (auth; mutations en-only; reads en+ko) ----
    log:            { tier: 'scrubbed', auth: true, langs: ['en'], cases: { bookmark: [{ token: '{{TOKEN}}', key: 'bookmark', val: p('texts', 1)[0] }] } },
    editProfile:    { tier: 'scrubbed', auth: true, langs: ['en'], cases: { same: [{ token: '{{TOKEN}}', name: '{{NAME}}', email: '{{EMAIL}}', zip: '{{ZIP}}' }] } },
    changePassword: { tier: 'scrubbed', auth: true, langs: ['en'], cases: { same: [{ token: '{{TOKEN}}', password: '{{PASS}}' }] } },
    uploadProfileImage: { tier: 'shape', auth: true, langs: ['en'], cases: { tiny: [{ token: '{{TOKEN}}', imageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' }] } },
    tokenSignIn:  { tier: 'scrubbed', auth: true, cases: { single: ['{{TOKEN}}'] } },
    signin:       { tier: 'scrubbed', auth: true, langs: ['en'], cases: { valid: [{ username: '{{USER}}', password: '{{PASS}}', token: '{{TOKEN}}' }], badpassword: [{ username: '{{USER}}', password: 'wrong-password', token: '{{TOKEN}}' }] } },
    studylog:        { tier: 'shape', auth: true, cases: { single: ['{{TOKEN}}'] } },
    userdailyscores: { tier: 'shape', auth: true, cases: { single: ['{{TOKEN}}'] } },
    userprogress:    { tier: 'scrubbed', auth: true, cases: { single: ['{{TOKEN}}'] } },
    divisionProgress:        { tier: 'scrubbed', auth: true, cases: { single: [p('divisions', 1)[0]] } },
    divisionProgressDetails: { tier: 'scrubbed', auth: true, cases: { single: [p('divisions', 1)[0]] } },
    pageprogress:     { tier: 'scrubbed', auth: true, cases: { single: [{ token: '{{TOKEN}}', slug: [p('pages', 1)[0]] }] } },
    pageinfoprogress: { tier: 'scrubbed', auth: true, cases: { single: [{ token: '{{TOKEN}}', slug: [p('pages', 1)[0]] }] } },
    readingplan:        { tier: 'exact', auth: true, cases: { unknown: [{ slug: 'zz-no-such-plan', token: '{{TOKEN}}' }] } },
    readingplansegment: { tier: 'exact', auth: true, cases: { unknown: [{ guid: 'zz-no-such-guid', token: '{{TOKEN}}' }] } },
    queue:       { tier: 'scrubbed', auth: true, cases: { noitems: [{ token: '{{TOKEN}}', items: null }], byslug: [{ token: '{{TOKEN}}', items: [{ slug: p('texts', 1)[0] }] }] } },
    queuestatus: { tier: 'scrubbed', auth: true, cases: { noitems: [{ token: '{{TOKEN}}', items: null }] } },
    sourceUsage: pools.publications ? { tier: 'exact', auth: true, langs: ['en'], cases: { single: [{ token: '{{TOKEN}}', source: p('publications', 1)[0] }] } } : undefined,
    signout: { tier: 'scrubbed', auth: true, langs: ['en'], cases: { current: [{ token: '{{TOKEN}}' }] } },
    signup:  { tier: 'scrubbed', auth: true, langs: ['en'], cases: { duplicate: [{ token: '{{TOKEN}}', username: '{{USER}}', password: '{{PASS}}', name: '{{NAME}}', email: '{{EMAIL}}', zip: '{{ZIP}}' }] } },

    // ---- community suite ----
    leaderboard: { tier: 'shape', auth: true, cases: { single: [{ token: '{{TOKEN}}' }] } },
  };

  // Drop entries whose optional pools failed.
  for (const [k, v] of Object.entries(matrix)) if (v === undefined) delete matrix[k];

  const outPath = path.join(__dirname, 'inputs.json');
  fs.writeFileSync(outPath, JSON.stringify({ _warnings: warnings, ...matrix }, null, 2) + '\n');
  console.log(`\nWrote ${outPath} with ${Object.keys(matrix).length} query types.`);
  if (warnings.length) console.warn(`Warnings (omitted/degraded): \n  - ${warnings.join('\n  - ')}`);
}

main().catch((error) => { console.error(error.message); process.exit(1); });

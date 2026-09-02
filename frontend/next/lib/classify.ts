import { isbot } from 'isbot'

// The full set of served modes the middleware can emit. classify() only ever
// RECOMMENDS 'ssr' | 'cra' (see Decision.renderMode); 'asset'/'analytics' are
// middleware-level serve modes.
export type RenderMode = 'ssr' | 'cra' | 'asset' | 'analytics'
export type ClientClass = 'browser' | 'known-crawler' | 'unknown'
export type CrawlerFamily =
  | 'google' | 'bing' | 'meta' | 'openai' | 'screpy' | 'seo-tool'
  | 'other-crawler' | 'browser' | 'unknown'

export interface ClassifyInput {
  method: string
  ua: string
  secChUaMobile?: string | null
}

export interface Decision {
  /** Routing mode for a PAGE path (asset/SEO overrides live in middleware). */
  renderMode: 'ssr' | 'cra'
  clientClass: ClientClass
  crawlerFamily: CrawlerFamily
  isMobile: boolean
  isNav: boolean
  isbotHit: boolean
  browserUa: boolean
  signal: 'isbot' | 'browser-ua' | 'applewebkit' | 'no-browser-ua' | 'non-nav'
}
// NOTE: the `suspect`/`leak` tripwires are NOT here. They depend on the ACTUAL
// served mode (asset/SEO overrides mean the middleware can serve differently
// than classify() recommends), so they are computed at log time in the
// middleware's logRenderDecision (Task 3). Computing them here would make
// `suspect` structurally always-false (the conditions that would set it force
// renderMode='cra').

// A real browser engine token. `applewebkit` is included so iOS/Android in-app
// WebViews (Facebook, Instagram, Naver, KakaoTalk) — which end in
// `Mobile/15E148 <App>` with NO Safari/CriOS token — still count as browsers.
// Safe because crawlers are screened by isbot() FIRST (Googlebot-smartphone
// contains AppleWebKit but is isbot-flagged before this test is reached).
export const BROWSER_UA_RE =
  /mozilla\/5\.0.*(?:chrome|chromium|crios|firefox|fxios|safari|edg|opr|applewebkit)\//i

// The classic engine tokens (no applewebkit): used only to label the `signal`
// so in-app WebViews (matched via applewebkit alone) are distinguishable in logs.
const CLASSIC_BROWSER_RE = /(?:chrome|chromium|crios|firefox|fxios|safari|edg|opr)\//i
const MOBILE_UA_RE = /iphone|ipad|ipod|android|mobile/i

// Crawler family — the regexes MIRROR ops/telemetry/vector.yaml's crawler_family
// cascade (guarded by test/unit/vector-taxonomy-drift.test.ts). Order = priority.
const FAMILY_RES: ReadonlyArray<readonly [CrawlerFamily, RegExp]> = [
  ['google', /googlebot|google-inspectiontool|adsbot-google/i],
  ['bing', /bingbot|adidxbot/i],
  ['meta', /facebookexternalhit|meta-externalagent|facebot/i],
  ['openai', /gptbot|chatgpt-user|oai-searchbot/i],
  ['screpy', /screpy/i],
  ['seo-tool', /ahrefs|semrush|mj12bot|dotbot/i],
]

function crawlerFamilyFor(ua: string): CrawlerFamily {
  for (const [family, re] of FAMILY_RES) if (re.test(ua)) return family
  return 'other-crawler'
}

export function classify(input: ClassifyInput): Decision {
  const { method, ua } = input
  const isNav = method === 'GET' || method === 'HEAD'
  const isbotHit = isbot(ua)
  const browserUa = BROWSER_UA_RE.test(ua)

  let clientClass: ClientClass
  if (isbotHit) clientClass = 'known-crawler'
  else if (browserUa) clientClass = 'browser'
  else clientClass = 'unknown'

  const renderMode: 'ssr' | 'cra' = clientClass === 'browser' && isNav ? 'cra' : 'ssr'

  const crawlerFamily: CrawlerFamily =
    clientClass === 'known-crawler' ? crawlerFamilyFor(ua)
    : clientClass === 'browser' ? 'browser'
    : 'unknown'

  const isMobile = input.secChUaMobile === '?1' || MOBILE_UA_RE.test(ua)

  let signal: Decision['signal']
  if (!isNav) signal = 'non-nav'
  else if (isbotHit) signal = 'isbot'
  else if (browserUa) signal = CLASSIC_BROWSER_RE.test(ua) ? 'browser-ua' : 'applewebkit'
  else signal = 'no-browser-ua'

  return { renderMode, clientClass, crawlerFamily, isMobile, isNav, isbotHit, browserUa, signal }
}

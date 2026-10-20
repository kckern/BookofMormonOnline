/**
 * Pure landing decisions for Page (kept out of the component so they test).
 */

/**
 * Whether a fresh page identity should reset the window to the top before its
 * data arrives. Deep links that land on a row/section/fax position the
 * viewport themselves once the page renders. A /commentary/:id or /image/:id
 * link does too — but only seconds later, after the note → host page lookup;
 * until then the old scroll offset (often thousands of px down Home) sat over a
 * one-screen Loader and the reader saw a blank navy curtain (audit
 * commentary-D5). So note links reset like a plain page.
 */
export function resetsToTopOnLanding(initOpen = {}) {
  return !(initOpen.textId || initOpen.goToSection || initOpen.faxVersion);
}

/**
 * The URL a row open should write while a note deeplink is resolving to its
 * host row. Null = leave the URL alone: the reader asked for /commentary/:id,
 * and writing the host row slug first bounced the address bar
 * (/commentary/N → /jesus/74 → /commentary/N) before the note opened.
 */
export function rowSlugDuringNoteLanding({ resolvingNoteLink, slug }) {
  return resolvingNoteLink ? null : slug;
}

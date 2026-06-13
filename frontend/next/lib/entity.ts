// Text transforms shared by people/place rendering, mirroring the PHP SSR box.

const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
}

// Name disambiguators are stored as trailing digits (Nephi1, Lehi1) and rendered
// as Unicode superscripts (Nephi¹). Only digits immediately following a letter.
export function superscript(s: string): string {
  return (s ?? '').replace(/([A-Za-z])(\d+)/g, (_m, l, d: string) =>
    l + d.replace(/\d/g, (x) => SUP[x]),
  )
}

// Entity markup → anchor HTML the PHP box emits in body content.
//   {Display|person-slug} → <a class="peoplelink" …/people/slug>Display</a>
//   [Display|place-slug]  → <a class="placelink"  …/places/slug>Display</a>
export function wikiToHtml(text: string): string {
  return (text ?? '')
    .replace(/\{([^|}]+)\|([^}]+)\}/g, '<a class="peoplelink" title="$2" href="/people/$2">$1</a>')
    .replace(/\[([^|\]]+)\|([^\]]+)\]/g, '<a class="placelink" title="$2" href="/places/$2">$1</a>')
}

// Entity markup → plain display text (for meta descriptions); collapse the
// double spaces the source data sometimes carries around a marker.
export function wikiToText(text: string): string {
  return (text ?? '')
    .replace(/[{[]([^|\]}]+)\|[^\]}]+[}\]]/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
}

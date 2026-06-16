// Search keyword <-> /search/:value URL slug.
//
// A search phrase is carried in the URL with "." as the word separator instead
// of "%20" (e.g. /search/what.ye.shall rather than /search/what%20ye%20shall).
// getSearchSlug encodes a free-text keyword into that slug; getSearchValue
// decodes a slug back into a search keyword by treating "." as whitespace.
// The two are inverses (encode then decode yields the normalized phrase).

/**
 * Encode a free-text search keyword into a URL slug.
 * Whitespace (and stray ,;. punctuation) collapses to a single "." separator;
 * the result is lowercased and stripped of leading/trailing separators.
 */
export function getSearchSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s,;.]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

/**
 * Decode a /search/:value URL slug back into a search keyword.
 * "." is treated as whitespace. Legacy space-encoded ("%20") URLs decode
 * unchanged, so old links keep working.
 */
export function getSearchValue(value) {
  const decoded = value?.replace(/[.]/g, " ");
  return decoded || "";
}

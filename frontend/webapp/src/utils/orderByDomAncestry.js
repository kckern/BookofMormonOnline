export function orderByDomAncestry(slugs) {
  const elements = slugs
    .map(slug => ({ slug, el: document.querySelector(`[textid='${slug}']`) }))
    .filter(x => x.el);

  return elements
    .sort((a, b) => {
      if (a.el === b.el) return 0;
      const pos = a.el.compareDocumentPosition(b.el);
      // a is ancestor of b → a first
      if (pos & Node.DOCUMENT_POSITION_CONTAINED_BY) return -1;
      // b is ancestor of a → b first
      if (pos & Node.DOCUMENT_POSITION_CONTAINS) return 1;
      // a precedes b in document order → a first
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      return 1;
    })
    .map(x => x.slug);
}

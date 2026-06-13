import type { Metadata } from 'next'
import { getContents, type ContentsPage, type ContentsSection } from '@/lib/contents'
import { buildMetadata } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  // The PHP box emits an empty description for /contents (verified: the head's
  // <meta name="description"> is blank). buildMetadata passes '' through.
  return buildMetadata({ title: 'Table of Contents', description: '', path: '/contents' })
}

// The TOC tree is built as a raw HTML string to reproduce the PHP template's
// (intentionally malformed) tag nesting byte-for-byte:
//   • page links emit `<a href=` (ONE space); section links emit `<a  href=`
//     (TWO spaces).
//   • a section carrying capsules opens `<ul>` inside its own `<a>` and lets the
//     section's `</a></li>` close BEFORE that capsule `<ul>` does — exactly the
//     unbalanced markup the legacy renderer produced.
// The `<div class="toc">` wrapper is a real React element here (the host for the
// section markup); see the parity note in docs/bugs about the PHP box emitting
// /contents as an unclosed document, which the layout cannot byte-match.
function renderSection(s: ContentsSection): string {
  if (!s.capsules.length) return `<li><a  href="/${s.slug}">${s.title}</a></li>`
  const inner = s.capsules
    .map(
      (p) =>
        `<li><a href="/${p.slug}">${p.title}</a></li>` +
        `<ul>${p.sections.map(renderSection).join('')}</ul></a></li>`,
    )
    .join('')
  return `<li><a  href="/${s.slug}">${s.title}<ul>${inner}</ul>`
}
function renderTitlepage(p: ContentsPage): string {
  return (
    `<ul><li><a href="/${p.slug}">${p.title}</a></li>` +
    `<ul>${p.sections.map(renderSection).join('')}</ul></ul>`
  )
}

export default async function ContentsPage() {
  const divisions = await getContents()
  // The <section> tree is the inner HTML of the toc div. The div itself is a
  // real element (class="toc") so the only structural wrapper is the one the PHP
  // box emits — no extra container.
  const sections = divisions
    .map(
      (d) =>
        `<section><h2><a href="${d.slug}">${d.title}</a></h2>` +
        `<div>${d.description}</div>` +
        `<div class="outer"><div class="inner">${renderTitlepage(d.titlepage)}</div></div></section>`,
    )
    .join('')

  return (
    <>
      <h1>Table of Contents</h1>
      <p>
        <a href="/">❮ Community</a>
      </p>
      <div className="toc" dangerouslySetInnerHTML={{ __html: sections }} />
    </>
  )
}

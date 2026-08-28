// Renders one <script type="application/ld+json"> per object. JSON.stringify does
// NOT escape '<', so content text containing '</script>' could break out of the
// tag — escape every '<' to < (JSON parsers decode it back).
function safeJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function JsonLd({ data }: { data: object | object[] }) {
  const items = Array.isArray(data) ? data : [data]
  return (
    <>
      {items.map((d, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJson(d) }}
        />
      ))}
    </>
  )
}

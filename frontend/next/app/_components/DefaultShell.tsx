import { DEFAULT_TITLE, DEFAULT_BODY, DEFAULT_NAV } from '@/lib/seo'

// The generic crawlable shell the PHP box serves for the homepage and any route
// without a specific handler (e.g. /search, /user, /objects).
export function DefaultShell() {
  return (
    <>
      <h1>{DEFAULT_TITLE}</h1>
      <p>{DEFAULT_BODY}</p>
      <ul>
        {DEFAULT_NAV.map((item) => (
          <li key={item.href}>
            <a href={item.href}>{item.label}</a>
          </li>
        ))}
      </ul>
    </>
  )
}

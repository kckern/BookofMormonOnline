// Byte-exact robots.txt matching the PHP box (lowercase "User-agent", empty
// "Disallow:" = allow all). A route handler gives full control over the text;
// Next's MetadataRoute.Robots would force "User-Agent" casing and a blank line.
const BODY = 'User-agent: *\nDisallow:\nSitemap: https://bookofmormon.online/sitemap.xml\n'

export function GET() {
  return new Response(BODY, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

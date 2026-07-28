import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { lookupReference } from "../frontend/webapp/node_modules/scripture-guide/dist/scriptures.mjs";

const root = resolve(new URL(".", import.meta.url).pathname, "public");
const PORT = Number(process.env.PORT || 4173);
const MEDIA = process.env.FAX_MEDIA || "http://127.0.0.1:8317";
const GQL = process.env.FAX_GQL || "http://127.0.0.1:8317";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

async function proxy(targetBase, req, res, rewritePath = null) {
  const url = new URL(req.url, targetBase);
  if (rewritePath != null) url.pathname = rewritePath;
  const upstream = await fetch(url, {
    method: req.method,
    headers: {
      "content-type": req.headers["content-type"] || "application/json",
    },
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req),
  });
  res.writeHead(upstream.status, Object.fromEntries(upstream.headers.entries()));
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function serveFile(path, res) {
  return readFile(path).then((buf) => {
    res.writeHead(200, { "content-type": mime[extname(path)] || "application/octet-stream" });
    res.end(buf);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/api" || url.pathname === "/graphql") return proxy(GQL, req, res, "/");
  if (url.pathname.startsWith("/fax/render/")) {
    const m = /^\/fax\/render\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)\.jpg$/.exec(url.pathname);
    if (!m) return proxy(MEDIA, req, res);
    const [, version, mode, width, selector] = m;
    const ref = selector.replace(/%2F/gi, "/");
    const ids = /^\d+(?:-\d+)*$/.test(ref) ? ref.split("-") : (lookupReference(ref.replace(/\//g, ".").replace(/\s+/g, "."))?.verse_ids || []);
    const finalSel = ids.length ? `ids/${ids.join("-")}` : selector;
    url.pathname = `/fax/render/${version}/${mode}/${width}/${finalSel}.jpg`;
    return proxy(MEDIA, req, res, url.pathname);
  }
  if (url.pathname.startsWith("/fax/")) return proxy(MEDIA, req, res);
  if (url.pathname === "/" || url.pathname === "/index.html") return serveFile(join(root, "index.html"), res);
  if (url.pathname === "/app.js" || url.pathname === "/style.css") return serveFile(join(root, url.pathname.slice(1)), res);
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("not found");
}).listen(PORT, () => {
  console.log(`fax-lab listening on http://localhost:${PORT}`);
});

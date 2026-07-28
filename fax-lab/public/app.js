const app = document.querySelector("#app");

const qs = new URLSearchParams(location.search);
const state = {
  version: qs.get("v") || "1852",
  selector: qs.get("q") || "1.nephi.9.4",
  verseIds: [],
  notes: "",
  data: null,
  error: "",
  loading: false,
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "255,0,0";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

async function parseVerseIds(raw) {
  const s = String(raw || "").trim();
  if (!s) return [];
  if (/^\d+(?:-\d+)*$/.test(s)) return s.split("-").map(Number).filter(Number.isFinite);
  const ref = s.replace(/\//g, ".").replace(/\s+/g, ".");
  const resp = await fetch("/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: `query ($ref:String) { scripture(ref:$ref) { verse_ids } }`,
      variables: { ref },
    }),
  });
  const json = await resp.json();
  return json?.data?.scripture?.verse_ids || [];
}

async function load() {
  state.loading = true;
  state.error = "";
  render();
  try {
    state.verseIds = await parseVerseIds(state.selector);
    const selectorPath = state.verseIds.length ? `ids/${state.verseIds.join("-")}` : state.selector;
    const boxRes = await fetch(`/fax/boxes/${encodeURIComponent(state.version)}/${encodeURIComponent(selectorPath)}`);
    const boxData = await boxRes.json();
    const ids = [...new Set((boxData.boxes || []).map((b) => b.verseId))];
    const readQuery = {
      query: `query ($ids:[Int!]) { verses(verse_ids:$ids) { verse_id ref text person_slug voice } faxVerseLocations(verseIds:$ids) { verse_id page { title slug } section { title slug } } }`,
      variables: { ids },
    };
    const gqlRes = await fetch("/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(readQuery),
    });
    const gqlData = await gqlRes.json();
    const verses = gqlData?.data?.verses || [];
    const locs = gqlData?.data?.faxVerseLocations || [];
    const locMap = new Map(locs.map((x) => [x.verse_id, x]));
    state.data = { boxData, verses, locMap };
  } catch (e) {
    state.error = e?.message || String(e);
    state.data = null;
  } finally {
    state.loading = false;
    render();
  }
}

function imageUrl() {
  const selectorPath = state.verseIds.length ? `ids/${state.verseIds.join("-")}` : state.selector;
  return `/fax/render/${encodeURIComponent(state.version)}/crop/w800/${encodeURIComponent(selectorPath)}.jpg`;
}

function render() {
  const d = state.data;
  const verses = d?.verses || [];
  const boxData = d?.boxData || { pageScale: 700, boxes: [] };
  const grouped = new Map();
  for (const b of boxData.boxes || []) {
    const arr = grouped.get(b.imagePage) || [];
    arr.push(b);
    grouped.set(b.imagePage, arr);
  }

  app.innerHTML = `
    <form class="toolbar" id="controls">
      <label>Edition
        <input name="version" value="${esc(state.version)}" />
      </label>
      <label>Verse ref or selector
        <input name="selector" value="${esc(state.selector)}" style="min-width: 360px" />
      </label>
      <button type="submit">Load</button>
      <button type="button" id="copy">Copy JSON</button>
      <span class="muted">${state.loading ? "loading…" : ""}${state.error ? esc(state.error) : ""}</span>
    </form>

    <div class="grid">
      <section>
        <div class="panel" style="margin-bottom:16px">
          <div style="font-weight:600;margin-bottom:8px">Verse image</div>
          <div class="imageWrap">
            <img src="${imageUrl()}" alt="verse image" />
          </div>
        </div>

        <div class="panel">
          <div style="font-weight:600;margin-bottom:8px">Cutout geometry by page</div>
          ${[...grouped.entries()].sort((a, b) => a[0] - b[0]).map(([page, boxes]) => `
            <div class="pageBlock">
              <div class="muted">Image page ${page}</div>
              <div class="imageWrap">
                <img src="/fax/render/${encodeURIComponent(state.version)}/page/w800/${page}.jpg" alt="page ${page}" />
                <svg class="overlay" viewBox="0 0 ${boxData.pageScale || 700} 100%" preserveAspectRatio="none">
                  ${boxes.map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="rgba(255,0,0,0.18)" stroke="rgba(255,0,0,0.9)" stroke-width="2" />`).join("")}
                </svg>
              </div>
            </div>
          `).join("")}
        </div>
      </section>

      <aside>
        <div class="panel" style="margin-bottom:16px">
          <div style="font-weight:600;margin-bottom:8px">Text + metadata</div>
          ${verses.map((v) => {
            const loc = d?.locMap?.get(v.verse_id);
            return `
              <div class="verse">
                <div><strong>${esc(v.ref || v.verse_id)}</strong></div>
                <div>${esc(v.text || "")}</div>
                <div class="muted">${esc([v.person_slug, v.voice].filter(Boolean).join(" · ") || "no speaker metadata")}</div>
                <div class="muted">${esc(loc ? `${loc.page?.title || ""}${loc.page && loc.section ? " > " : ""}${loc.section?.title || ""}` : "no study location")}</div>
              </div>
            `;
          }).join("") || "<div class='muted'>No verses returned.</div>"}
        </div>

        <div class="panel" style="margin-bottom:16px">
          <div style="font-weight:600;margin-bottom:8px">Raw geometry</div>
          <div class="mono">${esc(JSON.stringify(boxData, null, 2))}</div>
        </div>

        <div class="panel">
          <div style="font-weight:600;margin-bottom:8px">Manual assessment</div>
          <textarea id="notes" rows="12" style="width:100%">${esc(state.notes)}</textarea>
        </div>
      </aside>
    </div>
  `;

  document.querySelector("#controls").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    state.version = String(fd.get("version") || "").trim();
    state.selector = String(fd.get("selector") || "").trim();
    const q = new URLSearchParams({ v: state.version, q: state.selector });
    history.replaceState({}, "", `${location.pathname}?${q}`);
    load();
  };
  document.querySelector("#copy").onclick = async () => {
    state.notes = document.querySelector("#notes").value;
    await navigator.clipboard.writeText(JSON.stringify({
      version: state.version,
      selector: state.selector,
      notes: state.notes,
      data: state.data,
    }, null, 2));
  };
  document.querySelector("#notes").oninput = (e) => { state.notes = e.target.value; };
}

load();

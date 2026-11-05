// Shared by the agenda page (when the site is built) and the visitor's browser
// (to read the sheet live, filter and draw the map), so both show the same list.

export const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTct42zJNIr0IyJi4Ug8Q5WyHy1gCLrDFUpGg4LsU-Nn4zlNundPmaa40S4Rtfm4YoJj5ox4CZKSDE1/pub?gid=506081650&single=true&output=csv';

export const CONFIG = {
  colors: {
    "keynote":         "#b4442e",
    "invited lecture": "#2f6f9f",
    "workshop":        "#3f8f6d",
    "conference":      "#8a6bab",
    "_default":        "#6b7383"
  },
  initialView: [48.0, 10.0],
  initialZoom: 4,
  maxFitZoom:  6
};

// Small screen glyph marking an online lecture. Inline SVG keeps it crisp at
// any zoom and avoids loading an icon font for one symbol.
const ONLINE_ICON =
  '<svg class="lm-online" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" ' +
  'focusable="false"><title>online</title>' +
  '<rect x="1.1" y="2.1" width="13.8" height="9.3" rx="1.4" fill="none" ' +
  'stroke="currentColor" stroke-width="1.5"/>' +
  '<path d="M5.4 14.1h5.2" stroke="currentColor" stroke-width="1.5" ' +
  'stroke-linecap="round"/><path d="M8 11.4v2.7" stroke="currentColor" ' +
  'stroke-width="1.5"/></svg>';
export const onlineMark = (r) => r.online ? " " + ONLINE_ICON : "";
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const colorFor = (k) => CONFIG.colors[String(k || "").toLowerCase()] || CONFIG.colors._default;
export const yearOf = (r) => {
  if (r.year != null && r.year !== "") return parseInt(r.year, 10);
  const m = /^(\d{4})/.exec(r.date || "");
  return m ? parseInt(m[1], 10) : null;
};
export const placeOf = (r) => [r.city, r.country].filter(Boolean).join(", ");
export const prettyDate = (r) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(r.date || "");
  if (!m) return r.date || (yearOf(r) != null ? String(yearOf(r)) : "");
  return new Date(+m[1], +m[2] - 1, +m[3])
    .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export const placed = (r) => Number.isFinite(r.lat) && Number.isFinite(r.lon);
export const coordKey = (r) => placed(r) ? r.lat.toFixed(4) + "," + r.lon.toFixed(4) : null;

// `all` is the full list: each row remembers its position in it, for the map.
export function listHtml(recs, all) {
  if (!recs.length) return '<div class="lm-item">Nothing matches these filters.</div>';

  const byYear = new Map();
  for (const r of recs) {
    const y = yearOf(r) ?? "—";
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(r);
  }
  const years = [...byYear.keys()].sort((a, b) => (b === "—" ? -1 : a === "—" ? 1 : b - a));

  return years.map((y) => {
    const items = byYear.get(y).slice()
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    const rows = items.map((r) => {
      const idx = all.indexOf(r);
      const t = r.url ? `<a href="${esc(r.url)}">${esc(r.title)}</a>` : esc(r.title);
      const where = placeOf(r);      // blank when unknown; the icon marks "online"
      const meta = [prettyDate(r), where, r.occasion, r.kind]
                     .filter(Boolean).map(esc).join(" &middot; ");
      const people = r.people ? `<br><span class="lm-m">with ${esc(r.people)}</span>` : "";
      return `<div class="lm-item" data-i="${idx}">
                <span class="lm-dot" style="background:${colorFor(r.kind)}"></span>
                <span class="lm-t">${t}</span>${onlineMark(r)}<br>
                <span class="lm-m">${meta}</span>${people}
              </div>`;
    }).join("");
    return `<div class="lm-year">${esc(String(y))}
              <span>${items.length} ${items.length === 1 ? "entry" : "entries"}</span>
            </div>${rows}`;
  }).join("");
}

export function countText(recs) {
  const locs = new Set(recs.filter(placed).map(coordKey)).size;
  const onlineCount = recs.filter((r) => r.online).length;
  return `${recs.length} lecture${recs.length === 1 ? "" : "s"} · ${locs} location${locs === 1 ? "" : "s"}` +
    (onlineCount ? ` · ${onlineCount} online` : "");
}

// Newest first, with coordinates as numbers (blank ones become NaN: no pin).
export const prepare = (list) => list
  .map((r) => ({ ...r, lat: parseFloat(r.lat), lon: parseFloat(r.lon) }))
  .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

// Minimal RFC-4180 CSV reader: handles quoted fields, escaped "" quotes,
// and commas or newlines inside quotes. Sheets exports all three.
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else { field += c; }
    } else if (c === '"') { inQuotes = true;
    } else if (c === ",")  { row.push(field); field = "";
    } else if (c === "\n") { row.push(field); rows.push(row); row = []; field = "";
    } else if (c !== "\r") { field += c; }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ""));
}

// Column headers are matched loosely, so the Google Form's own question
// wording ("Which city?", "Type of lecture") still lines up.
const COLUMN_ALIASES = {
  title:   ["title", "lecture", "talk", "name", "event", "subject"],
  city:    ["city", "town", "place", "location"],
  country: ["country", "nation"],
  date:    ["date", "when", "day"],
  kind:    ["kind", "type", "category", "format"],
  occasion:["occasion", "event", "series", "host", "conference", "organiser", "organizer"],
  online:  ["online", "remote", "virtual", "distance"],
  people:  ["collaborator", "collaborators", "with", "co-author", "coauthors", "authors"],
  url:     ["url", "link", "website"],
  lat:     ["lat", "latitude"],
  lon:     ["lon", "lng", "long", "longitude"]
};

function mapHeaders(header) {
  const lower = header.map((h) => String(h || "").trim().toLowerCase());
  const idx = {};
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const at = lower.findIndex((h) => h === alias || h.includes(alias));
      if (at !== -1) { idx[key] = at; break; }
    }
  }
  return idx;
}

export function recordsFromCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const idx = mapHeaders(rows[0]);
  const out = [];

  for (const r of rows.slice(1)) {
    const get = (k) => (idx[k] === undefined ? "" : String(r[idx[k]] ?? "").trim());
    // A row with no coordinates is KEPT: it still belongs in the list, it
    // just cannot have a pin. Online lectures are the main case.
    const lat = parseFloat(get("lat").replace(",", "."));
    const lon = parseFloat(get("lon").replace(",", "."));

    // Collapse stray line breaks pasted into a cell, so one Enter in the
    // sheet cannot break the list layout.
    const rec = { lat, lon,
                  title: get("title").replace(/\s+/g, " ").trim() || "(untitled)" };
    for (const k of ["city", "country", "date", "kind", "occasion", "people", "url"]) {
      if (get(k)) rec[k] = get(k);
    }
    // Anything affirmative counts; a blank cell means in person.
    rec.online = /^(y|yes|true|1|x|online|ja|oui|si|wel)$/i.test(get("online"));
    // Normalise a date the Form may have written as DD/MM/YYYY.
    const dm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(rec.date || "");
    if (dm) rec.date = `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
    out.push(rec);
  }
  return out;
}

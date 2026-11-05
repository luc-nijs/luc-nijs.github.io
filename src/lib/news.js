// Shared by the home page (when the site is built), the picture copies and the
// visitor's browser (to read the sheet live), so all show the same news.
import { esc, parseCSV } from './publications.js';

// The "Publish to web" CSV link of the Personal_news sheet.
export const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSBH40hQMbHEGkS0y1iTFYX3MebZnQJt2w4Q71drHJzpJnkrDWcBclmvUu5Mtgg-AuC0-epXHF_Ffq3/pub?output=csv';

// The sheet's file id, from a Drive share link; empty for any other address.
export function driveId(link) {
  if (!/^https?:\/\/(drive|docs)\.google\.com\//i.test(link || '')) return '';
  const m = /\/d\/([-\w]+)/.exec(link) || /[?&]id=([-\w]+)/.exec(link);
  return m ? m[1] : '';
}

export const driveImageUrl = (id) => `https://drive.google.com/thumbnail?id=${id}&sz=w480`;

const webAddress = (s) => (/^https?:\/\//i.test(s) ? s : /^[a-z][a-z0-9+.-]*:/i.test(s) ? '' : 'https://' + s);

// The last day an item shows, from the formats a sheet may write. Returns
// YYYY-MM-DD, or '' when blank or unreadable: such an item simply stays up.
function untilDate(s) {
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const current = (recs) => recs.filter((r) => !r.until || r.until >= today());

// Throws when the sheet has no Text column (for instance an error page instead
// of the sheet), so that is not mistaken for a sheet with all its news removed.
export function recordsFromCSV(text) {
  const rows = parseCSV(text);
  const header = (rows[0] || []).map((h) => String(h).trim().toLowerCase());
  const col = (name) => header.indexOf(name);
  if (col('text') === -1) throw new Error('no Text column');
  return rows.slice(1).map((r) => {
    const get = (name) => String(r[col(name)] ?? '').trim();
    // Only an explicit no hides a row, whatever its Until says.
    if (/^(n|no|false|0|hide)$/i.test(get('publish'))) return null;
    return {
      // One Enter in a cell should not break the layout.
      text: get('text').replace(/\s+/g, ' '),
      link: get('link') && webAddress(get('link')),
      picture: get('picture') && webAddress(get('picture')),
      until: untilDate(get('until')),
    };
  }).filter((r) => r && r.text);
}

// A Drive picture loads from the site's own copy, made at the nightly build. A
// picture added since then has no copy yet, so it falls back to Drive, which
// refuses the image if the request names the page it came from.
function pictureHtml(link) {
  if (!link) return '';
  const id = driveId(link);
  if (!id) return `<img class="news-picture" src="${esc(link)}" alt="">`;
  return `<img class="news-picture" src="/news-pictures/${id}.jpg" alt="" referrerpolicy="no-referrer" ` +
    `onerror="this.onerror=null;this.src='${driveImageUrl(id)}'">`;
}

// **word** in a cell shows in bold.
const textHtml = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

// The sheet's last row shows first, so a row added at the bottom tops the news.
export function newsHtml(recs) {
  return [...recs].reverse().map((r) => {
    const see = r.link ? `<br>see <a href="${esc(r.link)}" target="_blank" rel="noopener">here</a>` : '';
    return `<div class="news-item"><p>${textHtml(r.text)}${see}</p>${pictureHtml(r.picture)}</div>`;
  }).join('');
}

// Lists every page for search engines. New pages in src/pages are added automatically.
// Left out: the error page.
const excluded = new Set(['404']);

export function GET({ site }) {
  const slugs = Object.keys(import.meta.glob('./*.astro'))
    .map((path) => path.slice(2, -'.astro'.length))
    .filter((slug) => !excluded.has(slug))
    .sort();
  const urls = slugs.map((slug) => new URL(slug === 'index' ? '/' : `/${slug}/`, site).href);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}

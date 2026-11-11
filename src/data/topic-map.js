// Links each citation on the Topic Map page to its row(s) in the publications sheet.
// A row matches when its title contains `title` (case and punctuation ignored)
// and, if given, its year equals `year`. One citation can show several rows.
// To add a citation: add a key here, then use data-k="<key>" on the page.

export const TOPIC_REFS = {
  // core
  natext:        [{ title: 'musical instrument as a natural extension of the musician', year: '2009' },
                  { title: 'musical instrument as a natural extension of the musician', year: '2013' }],
  mediality:     [{ title: 'mediality of acoustic musical instruments' }],
  merging:       [{ title: 'merging of musician and musical instrument' }],
  indicators:    [{ title: 'embodiment indicators of music skill acquisition' }],
  // perspective 1: embodiment
  leman2010:     [{ title: 'user-oriented studies in embodied music cognition' }],
  leman2018:     [{ title: 'what is embodied music cognition' }],
  maes2018:      [{ title: 'conceptual framework for music-based interaction' }],
  grinspun2020:  [{ title: 'selective attention and inhibitory control' }],
  // perspective 2: dynamical systems
  bremmer2020:   [{ title: 'role of the body in instrumental and vocal music pedagogy' }],
  bremmer2022:   [{ title: 'embodied music pedagogy. a vision' }],
  dynsys2023:    [{ title: 'embodying dynamical systems in music performance' }],
  affnav2026:    [{ title: 'towards an embodied instrumental music pedagogy' }],
  // perspective 3: creativity
  afflandscape:  [{ title: 'creativity through movement: navigating the musical affordance' }],
  // domain A
  moving2019:    [{ title: 'moving together while playing music' }],
  kinemusical:   [{ title: 'kinemuzikale benadering' }],
  bremmer2024:   [{ title: 'embodiment in music education', year: '2024' }],
  wellbeing2025: [{ title: 'synergy between the development of well-being and musicianship' }],
  schiavio2022:  [{ title: 'remote instrumental music course' }],
  stijnen2023:   [{ title: "instrument teachers' practice and attitudes on musical creativity" }],
  verneert2024:  [{ title: 'pedagogical-artistic strategies of community music' }],
  stijnen2026:   [{ title: 'flow in instrumental improvisation' }],
  // domain B
  early2019:     [{ title: 'embodiment and early childhood music education' }],
  fortuna2019:   [{ title: 'representational strategies based on verbal versus bodily' }],
  fortuna2020:   [{ title: 'verbal explanations of their visual representation' }],
  fortuna2022:   [{ title: 'discrete versus continuous movements' }],
  fortuna2024:   [{ title: 'quality of body movement on musical sense-making' }],
  // domain C
  nicolaou2021:  [{ title: 'flourishing in resonance' }],
  verneert2021:  [{ title: 'space for collaborative creativity' }],
  nicolaou2023:  [{ title: 'moving in musicking' }],
  reynaert2025:  [{ title: 'participatory songwriting in a belgian asylum' }],
  // technology
  mpm2012a:      [{ title: 'stimulating self-monitoring through the generation of creative visual output' }],
  mpm2012b:      [{ title: 'relating the concepts of flow experience and presence' }],
  mpm2014:       [{ title: 'longitudinal study with the music paint machine' }],
  dalcroze:      [{ title: 'dalcroze meets technology' }],
  ar2024:        [{ title: 'laying the foundation for augmented reality' }],
  iomt2024:      [{ title: 'internet of musical things for children' }],
  visual2026:    [{ title: 'application of visual information in music education' }],
  // timeline
  ma2008:        [{ title: 'het muziekinstrument als natuurlijke extensie', year: '2008' }],
  phd2012:       [{ title: 'an embodied constructivist approach to technology-enhanced', year: '2012' }],
};

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

// Returns { key: [record, ...] } for every key; a key with no match gets [].
export function matchRefs(records) {
  const out = {};
  for (const [key, rules] of Object.entries(TOPIC_REFS)) {
    out[key] = [];
    for (const rule of rules) {
      const t = norm(rule.title);
      const hit = records.find((r) => norm(r.title).includes(t) && (!rule.year || String(r.year) === rule.year));
      if (hit && !out[key].includes(hit)) out[key].push(hit);
    }
  }
  return out;
}

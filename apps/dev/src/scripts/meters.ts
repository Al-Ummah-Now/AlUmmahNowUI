/**
 * Cost meters in the system design diagrams (src/lib/arch). Each meter holds its stage's final cost
 * per example (data-usd) and the part of the diagram's cycle in which the flow reaches it (data-win).
 * The shown amount is read from the SVG's own animation clock, so it moves with the pulses, and a
 * recording that steps the clock records the same numbers. Lane totals and the comparison bars sum
 * the meters. With reduced motion the final totals are shown and nothing moves.
 */
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
const nfCache = new Map<number, Intl.NumberFormat>();
function fmt(usd: number, scale: number): string {
  if (scale > 0 && scale < 0.0001) return usd > 0 ? `< ${fmt(0.0001, 0.0001)}` : fmt(0, 0.0001);
  const digits = scale === 0 ? 2 : scale < 0.01 ? 4 : scale < 1 ? 3 : 2;
  let nf = nfCache.get(digits);
  if (!nf) {
    nf = new Intl.NumberFormat(lang === 'ar' ? 'ar-u-nu-arab' : 'en-US', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', minimumFractionDigits: digits, maximumFractionDigits: digits });
    nfCache.set(digits, nf);
  }
  return nf.format(usd);
}

let scenario = 'one';
const parsed = new WeakMap<Element, Record<string, number | null>>();
const usdOf = (el: Element) => {
  let v = parsed.get(el);
  if (!v) {
    v = JSON.parse((el as HTMLElement).dataset.usd ?? '{}') as Record<string, number | null>;
    parsed.set(el, v);
  }
  return v;
};

function paint(svg: SVGSVGElement, final: boolean): Record<string, number> {
  const T = Number(svg.dataset.cycle) || 8;
  const f = final ? 1 : (svg.getCurrentTime() % T) / T;
  const unknown = svg.closest<HTMLElement>('[data-unknown-label]')?.dataset.unknownLabel ?? 'unknown';
  const sums: Record<string, number> = {};
  for (const m of svg.querySelectorAll<SVGTextElement>('[data-meter]')) {
    const usd = usdOf(m)[scenario];
    if (usd === null || usd === undefined) {
      m.textContent = unknown;
      m.setAttribute('data-unknown', '');
      continue;
    }
    m.removeAttribute('data-unknown');
    const [a, b] = (m.dataset.win ?? '0,1').split(',').map(Number) as [number, number];
    const p = final ? 1 : Math.min(1, Math.max(0, (f - a) / Math.max(1e-6, b - a)));
    const v = usd * p;
    m.textContent = fmt(v, usd);
    const lane = m.dataset.lane ?? '';
    sums[lane] = (sums[lane] ?? 0) + v;
  }
  for (const t of svg.querySelectorAll<SVGTextElement>('[data-total]')) {
    const lane = t.dataset.total ?? '';
    t.textContent = fmt(sums[lane] ?? 0, usdOf(t)[scenario] ?? 0);
  }
  return sums;
}

function paintFigure(fig: HTMLElement, final: boolean) {
  const svg = [...fig.querySelectorAll<SVGSVGElement>('svg.an[data-cycle]')].find((s) => s.getBoundingClientRect().width > 0);
  if (!svg || !svg.querySelector('[data-meter]')) return;
  const sums = paint(svg, final);
  const rows = fig.querySelectorAll<HTMLElement>('[data-compare]');
  if (!rows.length) return;
  const finals = [...rows].map((r) => usdOf(r)[scenario] ?? 0);
  const max = Math.max(1e-9, ...finals);
  rows.forEach((row, i) => {
    const lane = row.dataset.compare ?? '';
    const v = sums[lane] ?? 0;
    const bar = row.querySelector('progress');
    if (bar) bar.value = Math.round(Math.min(1, v / max) * 1000);
    const out = row.querySelector('output');
    if (out) out.textContent = fmt(v, finals[i] ?? 0);
  });
}

const figures = () => [...document.querySelectorAll<HTMLElement>('.an-figure')];

function frame() {
  for (const fig of figures()) paintFigure(fig, false);
  if (!reduce.matches) requestAnimationFrame(frame);
}

function start() {
  for (const fig of figures()) paintFigure(fig, true);
  if (!reduce.matches) requestAnimationFrame(frame);
}

document.addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  if (input.name !== 'an-scenario') return;
  scenario = input.value;
  for (const s of document.querySelectorAll<SVGSVGElement>('svg.an[data-cycle]')) if (!reduce.matches) s.setCurrentTime(0);
  for (const fig of figures()) paintFigure(fig, reduce.matches);
});
reduce.addEventListener('change', start);
start();

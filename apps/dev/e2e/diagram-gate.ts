/**
 * The diagram quality gate, run inside a real browser on rendered diagrams (svg.an). It measures
 * what the reader sees and returns one line per defect:
 *  - a node without an icon, or an icon outside its node / larger than 48px;
 *  - two text boxes that intersect;
 *  - an edge that passes through a node it does not connect;
 *  - a node, label or icon outside the SVG's viewBox;
 *  - a node label that spills out of its node box;
 *  - a wire that wanders far beyond the direct path between its ends (a detour);
 *  - groups that half-overlap, or a node inside a group it doesn't belong to;
 *  - a wire that runs through any text, unless it is that wire's own label drawn on an opaque pill
 *    (labels carry data-for=<edge id>, plus data-covers when their background hides the wire).
 *  - a label rendered under 11 px (diagrams are drawn at natural size and scroll, never shrink);
 *  - text sitting across a group's border;
 *  - Arabic text whose Latin runs (names, paths) aren't isolated, so the bidi algorithm may reorder them;
 * and, for the page around them (pass the glossary from src/lib/glossary.ts):
 *  - plan wording ("in development", «قيد التطوير» …): the site shows only what runs today;
 *  - an abbreviation whose meaning isn't spelled out where the page first uses it.
 * Only visible diagrams are checked (the wide/narrow twin that CSS hides is skipped).
 */
export function gateInBrowser(opts: { glossary?: { abbr: string; en: string; ar: string; re: string; same?: string }[]; near?: number } = {}): string[] {
  const glossary = opts.glossary ?? [];
  const near = opts.near ?? 220;
  const out: string[] = [];
  const ar = document.documentElement.lang === 'ar';
  // page text in reading order: <main> only, no navigation, headings, scripts or a drawing's title/desc
  {
    const SKIP = 'nav,[data-no-expand],h1,h2,h3,h4,h5,h6,script,style,title,desc,button,label,legend,code';
    // each piece of text, and the figure it is drawn in (if any)
    const parts: { s: string; frame: Element | null }[] = [];
    const main = document.querySelector('main');
    if (main) {
      const walk = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const el = n.parentElement;
        if (!el || el.closest(SKIP) || !el.getClientRects().length) continue;
        parts.push({ s: (n.textContent ?? '').replace(/\s+/g, ' '), frame: el.closest('.an-frame') });
      }
    }
    const starts: number[] = [];
    let text = '';
    for (const p of parts) {
      starts.push(text.length);
      text += p.s + ' ';
    }
    const frameAt = (i: number) => {
      let k = 0;
      while (k + 1 < starts.length && starts[k + 1]! <= i) k++;
      return parts[k]?.frame ?? null;
    };
    const plan = ar ? /قيد التطوير|قيد الطرح|قيد الإطلاق|مخطط له|قريبًا|ندرس|نخطط/ : /\b(in development|rolling out|planned|coming soon|we are (exploring|considering|studying|planning))\b/i;
    const pm = plan.exec(text);
    if (pm) out.push(`page: plan wording "${pm[0]}"`);
    // prose (not figures): no sentence opens with a lowercase code name (api-videos, videos, al-ummah-now-media …);
    // a host name (videos.alummahnow.net) heading a card is a name, not a sentence
    if (!ar) {
      const prose = parts.filter((p) => !p.frame).map((p) => p.s).join(' ');
      const lc = /(?:^|[.!?]\s+)((?:[a-z][a-z0-9]*[-_][a-z0-9_-]+)|videos|processor|media|scheduler|auth|realtime)\b(?!\.[a-z])/.exec(prose);
      if (lc) out.push(`page: a sentence starts with the code name "${lc[1]}"`);
    }
    // banned wording: one term per thing (a slot is «خانة متاحة», a bot check is «فحص الروبوتات»)
    const banned = ar ? /خانة شاغرة|البوتات/ : null;
    const bm = banned?.exec(text);
    if (bm) out.push(`page: banned wording "${bm[0]}"`);
    for (const t of glossary) {
      // the pattern is src/lib/glossary.ts termPattern, passed in
      // singular and plural are one term (API / APIs): its first use is the earlier of either
      const pair = glossary.filter((x) => x.abbr === t.same || x.same === t.abbr);
      const found = [t, ...pair].map((x) => ({ x, m: new RegExp(x.re).exec(text) })).filter((f) => f.m).sort((p1, p2) => p1.m!.index - p2.m!.index)[0];
      if (!found) continue;
      const m = found.m!;
      const used = found.x;
      const meanings = [t, ...pair].map((x) => (ar ? x.ar : x.en).toLowerCase());
      const meaning = meanings[0]!;
      // (text nodes join with a space: a Latin run isolated in its own <bdi> leaves two between words)
      const around = text.slice(Math.max(0, m.index - near), m.index + used.abbr.length + near).replace(/\s+/g, ' ').toLowerCase();
      // explained in the copy's own words: in parentheses right after it, or it is the parenthesis after its explanation
      const explained = /^\s*\(/.test(text.slice(m.index + used.abbr.length)) || /\(\s*$/.test(text.slice(0, m.index));
      // first used in a figure: that figure's "In this figure" line names it
      const terms = frameAt(m.index)?.previousElementSibling;
      const inFigure = !!terms?.matches('.an-terms') && meanings.some((mn) => (terms.textContent ?? '').toLowerCase().includes(mn));
      if (!meanings.some((mn) => around.includes(mn)) && !explained && !inFigure && meaning) out.push(`page: "${used.abbr}" is used before it is spelled out ("${text.slice(Math.max(0, m.index - 40), m.index + 40)}")`);
    }
  }
  const svgs = [...document.querySelectorAll<SVGSVGElement>('svg.an')].filter((s) => s.getBoundingClientRect().width > 0 && getComputedStyle(s).display !== 'none');
  type B = { x: number; y: number; w: number; h: number };
  const bb = (el: SVGGraphicsElement): B => {
    const b = el.getBBox();
    // map through any transform to the svg's user space
    const m = el.getCTM();
    const root = el.ownerSVGElement?.getCTM();
    if (!m || !root) return { x: b.x, y: b.y, w: b.width, h: b.height };
    const rel = root.inverse().multiply(m);
    const pts = [
      new DOMPoint(b.x, b.y).matrixTransform(rel),
      new DOMPoint(b.x + b.width, b.y).matrixTransform(rel),
      new DOMPoint(b.x, b.y + b.height).matrixTransform(rel),
      new DOMPoint(b.x + b.width, b.y + b.height).matrixTransform(rel),
    ];
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };
  // a point of the svg's user space within `pad` px of an element's own box, measured in the element's frame: a
  // tilted sketch tag is tested as the tilted box it draws, not the upright box around it
  const within = (el: SVGGraphicsElement, pt: DOMPoint, pad: number): boolean => {
    const b = el.getBBox();
    const m = el.getCTM();
    const root = el.ownerSVGElement?.getCTM();
    const q = m && root ? new DOMPoint(pt.x, pt.y).matrixTransform(root.inverse().multiply(m).inverse()) : pt;
    return q.x > b.x - pad && q.x < b.x + b.width + pad && q.y > b.y - pad && q.y < b.y + b.height + pad;
  };
  const inside = (a: B, b: B, tol = 0.5) => a.x >= b.x - tol && a.y >= b.y - tol && a.x + a.w <= b.x + b.w + tol && a.y + a.h <= b.y + b.h + tol;
  const hit = (a: B, b: B, tol = 0.5) => a.x < b.x + b.w - tol && b.x < a.x + a.w - tol && a.y < b.y + b.h - tol && b.y < a.y + a.h - tol;
  for (const svg of svgs) {
    const name = `${svg.dataset.diagram}/${svg.dataset.variant}`;
    const vb = svg.viewBox.baseVal;
    const view: B = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
    const scale = svg.getBoundingClientRect().width / vb.width;
    const nodes = [...svg.querySelectorAll<SVGGElement>('[data-node]')];
    if (!nodes.length) out.push(`${name}: no nodes`);
    const nodeBox = new Map<string, B>();
    /** the parts a node is drawn as (an isometric block: its name pill over its shape); the box is their union */
    const nodeParts = new Map<string, B[]>();
    for (const g of nodes) {
      const id = g.dataset.node!;
      const partEls = [...g.querySelectorAll<SVGGraphicsElement>('[data-box]')];
      const parts = partEls.length ? partEls.map((el) => bb(el)) : [bb(g.querySelector<SVGGraphicsElement>('.an-node-box') ?? g)];
      const x0 = Math.min(...parts.map((b) => b.x));
      const y0 = Math.min(...parts.map((b) => b.y));
      const box = { x: x0, y: y0, w: Math.max(...parts.map((b) => b.x + b.w)) - x0, h: Math.max(...parts.map((b) => b.y + b.h)) - y0 };
      nodeBox.set(id, box);
      nodeParts.set(id, parts);
      if (!inside(box, view)) out.push(`${name}: node ${id} outside the viewBox`);
      const icons = [...g.querySelectorAll<SVGGraphicsElement>('[data-icon]')];
      if (!icons.length) out.push(`${name}: node ${id} has no icon`);
      for (const ic of icons) {
        const b = bb(ic);
        if (!inside(b, box)) out.push(`${name}: icon ${ic.dataset.icon} outside node ${id}`);
        if (b.w > 48.5 || b.h > 48.5) out.push(`${name}: icon ${ic.dataset.icon} in ${id} is ${Math.round(b.w)}px (max 48)`);
        if (b.w * scale > 48.5) out.push(`${name}: icon ${ic.dataset.icon} in ${id} renders at ${Math.round(b.w * scale)}px`);
        // the mark must actually draw something
        const sym = ic instanceof SVGUseElement ? svg.querySelector(ic.href.baseVal) : ic;
        if (!sym || !sym.innerHTML.trim()) out.push(`${name}: icon ${ic.dataset.icon} in ${id} is empty`);
      }
      for (const t of g.querySelectorAll<SVGTextElement>('text')) {
        if (!inside(bb(t), box, 1)) out.push(`${name}: label "${t.textContent}" spills out of node ${id}`);
      }
    }
    for (const ic of svg.querySelectorAll<SVGGraphicsElement>('[data-icon]')) {
      if (!ic.closest('[data-node],[data-tag]')) out.push(`${name}: icon ${ic.dataset.icon} outside any node`);
    }
    const texts = [...svg.querySelectorAll<SVGTextElement>('text')].filter((t) => !t.closest('.an-motion') && t.textContent?.trim());
    const tb = texts.map((t) => ({ t, b: bb(t) }));
    for (const { t } of tb) {
      // authored size at 1:1 (expanded view): every label at least 11 px
      const px = parseFloat(getComputedStyle(t).fontSize);
      if (px < 10.9) out.push(`${name}: text "${t.textContent}" has font-size ${px.toFixed(1)} px (min 11)`);
      // Arabic with Latin runs: each run isolated (LRI … PDI)
      const raw = t.textContent ?? '';
      if (/[\u0600-\u06ff]/.test(raw) && /[A-Za-z]/.test(raw.replace(/\u2066[^\u2069]*\u2069/g, ''))) out.push(`${name}: Arabic text "${raw}" has a Latin run that isn't isolated`);
      // a run's own neutral ends («/» before it, «-», «/», «*», «…» after it) left outside its isolate get moved
      if (/[\u0600-\u06ff]/.test(raw) && /\/\u2066|\u2069[-/*…]/.test(raw)) out.push(`${name}: Arabic text "${raw}" leaves part of a Latin run («/», «-», «*», «…») outside its isolate`);
      // «·» is not an Arabic separator (it shows as a box in the Arabic face): «،»
      if (/[\u0600-\u06ff]/.test(raw) && raw.includes('·')) out.push(`${name}: Arabic text "${raw}" uses «·»; use «،»`);
    }
    for (const { t, b } of tb) if (!inside(b, view)) out.push(`${name}: text "${t.textContent}" outside the viewBox`);
    for (let i = 0; i < tb.length; i++)
      for (let j = i + 1; j < tb.length; j++)
        if (hit(tb[i]!.b, tb[j]!.b)) out.push(`${name}: text "${tb[i]!.t.textContent}" overlaps "${tb[j]!.t.textContent}"`);
    // text never sits on another node
    for (const { t, b } of tb) {
      const own = t.closest<SVGGElement>('[data-node]')?.dataset.node ?? t.closest<SVGGElement>('[data-node-label]')?.dataset.nodeLabel;
      for (const [id, parts] of nodeParts) if (id !== own && parts.some((box) => hit(b, box, 1))) out.push(`${name}: text "${t.textContent}" sits on node ${id}`);
    }
    for (const p of svg.querySelectorAll<SVGPathElement>('[data-edge]')) {
      const ends = new Set([p.dataset.from, p.dataset.to]);
      const len = p.getTotalLength();
      for (let d = 0; d <= len; d += 3) {
        const pt = p.getPointAtLength(d);
        for (const [id, parts] of nodeParts) {
          if (ends.has(id)) continue;
          if (parts.some((box) => pt.x > box.x + 1 && pt.x < box.x + box.w - 1 && pt.y > box.y + 1 && pt.y < box.y + box.h - 1)) {
            out.push(`${name}: edge ${p.dataset.from}→${p.dataset.to} passes through ${id}`);
            d = len + 1;
            break;
          }
        }
      }
      // a wire never runs through words: any text that isn't its own label (data-for) or inside a node it connects
      const own = p.id || p.dataset.edge || '';
      for (const { t, b } of tb) {
        // only a label drawn on an opaque pill over its own wire may sit on it (data-covers)
        const label = t.closest<SVGElement>('[data-for]');
        if (label?.getAttribute('data-for') === own && label.hasAttribute('data-covers')) continue;
        const inNode = t.closest<SVGGElement>('[data-node]')?.dataset.node;
        if (inNode && ends.has(inNode)) continue;
        const box = { x: b.x + 1.5, y: b.y + 1.5, w: b.w - 3, h: b.h - 3 };
        for (let d = 0; d <= len; d += 2) {
          const pt = p.getPointAtLength(d);
          if (pt.x > box.x && pt.x < box.x + box.w && pt.y > box.y && pt.y < box.y + box.h && within(t, pt, -1.5)) {
            out.push(`${name}: edge ${p.dataset.from}→${p.dataset.to} runs through the text "${t.textContent}"`);
            break;
          }
        }
      }
      // no detours: a wire may bend around things, but not wander far beyond the direct path
      const direct = Number(p.dataset.direct ?? NaN);
      if (direct >= 0 && len > direct * 1.45 + 140) out.push(`${name}: edge ${p.dataset.from}→${p.dataset.to} takes a detour (${Math.round(len)} vs ${Math.round(direct)} direct)`);
      const b = bb(p);
      if (!inside(b, view, 1)) out.push(`${name}: edge ${p.dataset.from}→${p.dataset.to} leaves the viewBox`);
    }
    // text keeps 6 px from every group border, its own group's tag and title included
    const CLEAR = 6;
    const grow = (b: B, d: number): B => ({ x: b.x - d, y: b.y - d, w: b.w + 2 * d, h: b.h + 2 * d });
    for (const g of svg.querySelectorAll<SVGGElement>('[data-group]')) {
      // rectangles only: an isometric platform's polygon has no meaningful bounding box
      const gr = g.querySelector<SVGGraphicsElement>(':scope > rect');
      if (!gr) continue;
      const box = bb(gr);
      for (const { t, b } of tb) {
        // a step badge marks a point on its wire: it only has to stay off the border
        const d = t.closest('.an-badge') ? 2 : CLEAR;
        const near = grow(b, d - 0.5);
        if (hit(near, box, 0) && !inside(near, box, 0)) out.push(`${name}: text "${t.textContent}" is within ${d} px of the border of group ${g.dataset.group}`);
      }
    }
    const edges = [...svg.querySelectorAll<SVGPathElement>('[data-edge]')];
    const samplesOf = new Map<SVGPathElement, DOMPoint[]>();
    const pts = (p: SVGPathElement, step = 3) => {
      if (!samplesOf.has(p)) {
        const len = p.getTotalLength();
        const list: DOMPoint[] = [];
        for (let d = 0; d <= len; d += step) list.push(p.getPointAtLength(d));
        list.push(p.getPointAtLength(len));
        samplesOf.set(p, list);
      }
      return samplesOf.get(p)!;
    };
    const distToBox = (pt: DOMPoint, q: B) => Math.hypot(Math.max(q.x - pt.x, 0, pt.x - (q.x + q.w)), Math.max(q.y - pt.y, 0, pt.y - (q.y + q.h)));
    // a wire's label sits by its own wire: no more than 24 px from it
    for (const lab of svg.querySelectorAll<SVGGElement>('[data-for]:not(.an-badge)')) {
      const id = lab.getAttribute('data-for') ?? '';
      const own = edges.find((p) => p.id === id || p.dataset.edge === id || `${svg.dataset.diagram}-${svg.dataset.variant}-${p.dataset.edge}` === id);
      if (!own) continue;
      const lb = bb(lab);
      const gap = Math.min(...pts(own).map((pt) => distToBox(pt, lb)));
      if (gap > 24) out.push(`${name}: label "${lab.textContent}" is ${Math.round(gap)} px from its wire (max 24)`);
    }
    // no wire label in any group's title row (edge to edge, down to the title's bottom, or up from a bottom tag)
    for (const g of svg.querySelectorAll<SVGGElement>('[data-group]')) {
      const gr = g.querySelector<SVGGraphicsElement>(':scope > rect');
      const title = g.querySelector<SVGGraphicsElement>('.an-group-label, [data-tag] rect');
      if (!gr || !title) continue;
      const box = bb(gr);
      const tb2 = bb(title);
      // a tag along the bottom edge (a layout's tagBottom): its row runs from the tag's top down to the border
      const low = tb2.y > box.y + box.h / 2;
      const row = low ? { x: box.x, y: tb2.y - 4, w: box.w, h: box.y + box.h - tb2.y + 4 } : { x: box.x, y: box.y, w: box.w, h: tb2.y + tb2.h - box.y + 4 };
      for (const lab of svg.querySelectorAll<SVGGElement>('[data-for]:not(.an-badge)')) if (hit(bb(lab), row, 0)) out.push(`${name}: label "${lab.textContent}" sits in the title row of group ${g.dataset.group}`);
    }
    // group boxes keep 6 px apart: never on (or hugging) another group's border, nested or side by side
    {
      const rects = [...svg.querySelectorAll<SVGGElement>('[data-group]')].map((g) => ({ id: g.dataset.group!, el: g.querySelector<SVGGraphicsElement>(':scope > rect') })).filter((x) => x.el).map((x) => ({ id: x.id, b: bb(x.el!) }));
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i]!.b;
          const c = rects[j]!.b;
          const nested = inside(a, c, 0.5) || inside(c, a, 0.5);
          if (nested) {
            const [inn, out2] = inside(a, c, 0.5) ? [a, c] : [c, a];
            const gapIn = Math.min(inn.x - out2.x, inn.y - out2.y, out2.x + out2.w - (inn.x + inn.w), out2.y + out2.h - (inn.y + inn.h));
            if (gapIn < 6) out.push(`${name}: group ${rects[i]!.id} lies within ${Math.max(0, Math.round(gapIn))} px of group ${rects[j]!.id}'s border`);
          } else if (hit(grow(a, 6), c, 0)) out.push(`${name}: groups ${rects[i]!.id} and ${rects[j]!.id} are less than 6 px apart`);
        }
    }
    // no wire crosses another within 16 px of either one's end (an arrowhead must read clearly)
    for (const a of edges) {
      const len = a.getTotalLength();
      const tips = [...Array(9).keys()].flatMap((k) => [a.getPointAtLength(k * 2), a.getPointAtLength(Math.max(0, len - k * 2))]);
      for (const b of edges) {
        // wires that share a tile meet at it by design; a shared group (a boundary) gives them no common port
        const tile = (id?: string) => !!id && nodeBox.has(id);
        const shared = [a.dataset.from, a.dataset.to].filter((id) => id === b.dataset.from || id === b.dataset.to);
        if (b === a || shared.some(tile)) continue;
        if (tips.some((t) => pts(b).some((q) => Math.hypot(q.x - t.x, q.y - t.y) < 2.5))) {
          out.push(`${name}: wire ${b.dataset.from}→${b.dataset.to} crosses ${a.dataset.from}→${a.dataset.to} near its end`);
        }
      }
    }
    // isometric hero: a pipe's glow stays clear of every pill, and pills keep 6 px from platform edges
    if (svg.classList.contains('an-iso')) {
      const pillEls = [...svg.querySelectorAll<SVGGraphicsElement>('rect.an-iso-pill, rect.an-tag, rect.an-pipe-label')];
      const pills = pillEls.map((el) => bb(el));
      const pillName = (k: number) => (pillEls[k]!.parentElement?.textContent ?? '').trim().slice(0, 40);
      for (const tube of svg.querySelectorAll<SVGPathElement>('.an-pipe-tube')) {
        const half = parseFloat(getComputedStyle(tube).strokeWidth) / 2 + 3;
        pills.forEach((pb, k) => {
          if (pts(tube, 4).some((pt) => distToBox(pt, pb) < half)) out.push(`${name}: a pipe's glow touches the pill "${pillName(k)}"`);
        });
      }
      for (const poly of svg.querySelectorAll<SVGPolygonElement>('[data-group] polygon')) {
        const P = [...poly.points];
        for (let k = 0; k < P.length; k++) {
          const p0 = P[k]!;
          const p1 = P[(k + 1) % P.length]!;
          const n = Math.ceil(Math.hypot(p1.x - p0.x, p1.y - p0.y) / 2);
          pills.forEach((pb, k) => {
            for (let s = 0; s <= n; s++) {
              const pt = new DOMPoint(p0.x + ((p1.x - p0.x) * s) / n, p0.y + ((p1.y - p0.y) * s) / n);
              if (distToBox(pt, pb) < 6) {
                out.push(`${name}: the pill "${pillName(k)}" lies within 6 px of the edge of platform ${poly.closest<SVGGElement>('[data-group]')?.dataset.group}`);
                break;
              }
            }
          });
        }
      }
    }
    // a hand-drawn sketch: no wire runs along the cloud outline (6 px clear)
    const cloud = svg.querySelector<SVGPathElement>('.an-sk-cloud');
    if (cloud) {
      const cl = pts(cloud as unknown as SVGPathElement, 4);
      for (const p of edges) {
        const run = pts(p).filter((pt) => cl.some((q) => Math.hypot(q.x - pt.x, q.y - pt.y) < 6)).length;
        if (run > 3) out.push(`${name}: wire ${p.dataset.from}→${p.dataset.to} runs along the cloud outline (${run * 3} px)`);
      }
    }
    // line style follows the legend: dashed means control, and every control wire is dashed
    for (const p of edges) {
      if (svg.classList.contains('an-sketch') || svg.classList.contains('an-iso')) continue;
      const dashed = (getComputedStyle(p).strokeDasharray || 'none') !== 'none';
      const control = p.classList.contains('an-f-control');
      if (dashed !== control) out.push(`${name}: wire ${p.dataset.from}→${p.dataset.to} is ${dashed ? 'dashed' : 'solid'} but ${control ? 'is' : "isn't"} control`);
    }
    // Arabic ranges read as words or isolated: never a bare «٣٦٠p–١٠٨٠p» or «٣٠–٩٠» the bidi algorithm can reverse
    for (const { t } of tb) {
      const raw = t.textContent ?? '';
      if (/[\u0600-\u06ff]/.test(raw) && /[٠-٩]+[A-Za-z]*\s*[–-]\s*[٠-٩]+/.test(raw.replace(/[\u2066\u2069]/g, ''))) out.push(`${name}: Arabic text "${raw}" has a bare range that may read reversed`);
    }
    // a wire starts and ends at a tile's edge, never inside it
    for (const p of svg.querySelectorAll<SVGPathElement>('[data-edge]')) {
      const len = p.getTotalLength();
      for (const [which, pt] of [['starts', p.getPointAtLength(0)], ['ends', p.getPointAtLength(len)]] as const)
        for (const [id, nbx] of nodeBox)
          if (pt.x > nbx.x + 2 && pt.x < nbx.x + nbx.w - 2 && pt.y > nbx.y + 2 && pt.y < nbx.y + nbx.h - 2) out.push(`${name}: edge ${p.dataset.from}→${p.dataset.to} ${which} inside tile ${id}`);
    }
    // a step badge (its whole circle) stays off every group border: it may sit on its own wire only
    for (const badge of svg.querySelectorAll<SVGGElement>('.an-badge')) {
      const bc = bb(badge);
      // and 6 px clear of every tile's border
      for (const [id, nbx] of nodeBox) if (hit(grow(bc, CLEAR - 0.5), nbx, 0)) out.push(`${name}: step badge "${badge.textContent}" is within ${CLEAR} px of tile ${id}`);
      for (const g of svg.querySelectorAll<SVGGElement>('[data-group]')) {
        const gr = g.querySelector<SVGGraphicsElement>(':scope > rect');
        if (!gr) continue;
        const box = bb(gr);
        const near = grow(bc, 1.5);
        if (hit(near, box, 0) && !inside(near, box, 0)) out.push(`${name}: step badge "${badge.textContent}" sits on the border of group ${g.dataset.group}`);
      }
    }
    // a wire's label (not a step badge, which marks its wire) keeps 6 px from every line and every tile
    for (const { t, b } of tb) {
      if (!t.closest('[data-for]') || t.closest('.an-badge')) continue;
      const near = grow(b, CLEAR - 0.5);
      for (const [id, nbx] of nodeBox) if (hit(near, nbx, 0)) out.push(`${name}: label "${t.textContent}" is within ${CLEAR} px of tile ${id}`);
      // (a label drawn on its own wire's opaque pill hides that wire: only the other wires count)
      const own = t.closest<SVGGElement>('[data-for][data-covers]')?.dataset.for;
      for (const p of svg.querySelectorAll<SVGPathElement>('[data-edge]')) {
        if (own && p.dataset.edge === own) continue;
        const len = p.getTotalLength();
        for (let d = 0; d <= len; d += 2) {
          const pt = p.getPointAtLength(d);
          if (pt.x > near.x && pt.x < near.x + near.w && pt.y > near.y && pt.y < near.y + near.h && within(t, pt, CLEAR - 0.5)) {
            out.push(`${name}: label "${t.textContent}" is within ${CLEAR} px of the wire ${p.dataset.from}→${p.dataset.to}`);
            break;
          }
        }
      }
    }
    // contrast (WCAG 2.2): every text against what is drawn behind it (a badge's circle, a label's pill, a
    // tile, else the canvas) at 4.5:1 (3:1 from 18.66 px bold / 24 px), and every wire against the canvas at 3:1
    {
      const rgba = (s: string): [number, number, number, number] | null => {
        const m = /rgba?\(([^)]+)\)/.exec(s);
        if (!m) return null;
        const p = m[1]!.split(/[ ,/]+/).filter(Boolean).map(Number);
        return [p[0]!, p[1]!, p[2]!, p.length > 3 ? p[3]! : 1];
      };
      const over = (top: [number, number, number, number], under: [number, number, number]): [number, number, number] => [0, 1, 2].map((i) => top[i]! * top[3] + under[i]! * (1 - top[3])) as [number, number, number];
      const lum = (c: [number, number, number]) => {
        const ch = c.map((v) => {
          const x = v / 255;
          return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
      };
      const ratio = (a: [number, number, number], b: [number, number, number]) => {
        const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
        return (x! + 0.05) / (y! + 0.05);
      };
      const paint = (el: Element, prop: 'fill' | 'stroke') => {
        const cs = getComputedStyle(el);
        const c = rgba(prop === 'fill' ? cs.fill : cs.stroke);
        if (!c) return null;
        let op = parseFloat(prop === 'fill' ? cs.fillOpacity : cs.strokeOpacity) * parseFloat(cs.opacity);
        for (let a: Element | null = el.parentElement; a && a !== svg; a = a.parentElement) op *= parseFloat(getComputedStyle(a).opacity);
        c[3] *= op;
        return c;
      };
      const canvasEl = svg.querySelector('.an-canvas');
      const canvas: [number, number, number] = (canvasEl && (() => {
        const c = paint(canvasEl, 'fill');
        return c ? over(c, [255, 255, 255]) : null;
      })()) || [255, 255, 255];
      for (const { t, b } of tb) {
        const fg = paint(t, 'fill');
        if (!fg) continue;
        // the nearest filled shape drawn before the text that holds its centre: its own sibling first, then up the tree
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        let bg: [number, number, number] = canvas;
        search: for (let el: Element | null = t; el && el !== svg; el = el.parentElement) {
          for (let s = el.previousElementSibling; s; s = s.previousElementSibling) {
            if (!/^(rect|circle|ellipse|path|polygon)$/.test(s.tagName) || s.classList.contains('an-canvas') || s.classList.contains('an-iso-floor')) continue;
            const f = paint(s, 'fill');
            if (!f || f[3] === 0) continue;
            const sb = bb(s as SVGGraphicsElement);
            if (cx >= sb.x && cx <= sb.x + sb.w && cy >= sb.y && cy <= sb.y + sb.h) {
              bg = over(f, canvas);
              break search;
            }
          }
        }
        const cs = getComputedStyle(t);
        const px = parseFloat(cs.fontSize);
        const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
        const need = large ? 3 : 4.5;
        const r2 = ratio(over(fg, bg), bg);
        if (r2 < need - 0.005) out.push(`${name}: text "${(t.textContent ?? '').slice(0, 40)}" has contrast ${r2.toFixed(2)}:1 on its background (min ${need}:1)`);
      }
      for (const p of edges) {
        const st = paint(p, 'stroke');
        if (!st) continue;
        const r2 = ratio(over(st, canvas), canvas);
        if (r2 < 2.995) out.push(`${name}: wire ${p.dataset.from}→${p.dataset.to} has contrast ${r2.toFixed(2)}:1 on the canvas (min 3:1)`);
      }
    }
    // a step badge never touches a label (its pill or its words) or another badge: 3 px clear
    {
      const badges = [...svg.querySelectorAll<SVGGElement>('.an-badge')];
      const labels = [...svg.querySelectorAll<SVGGElement>('[data-for]:not(.an-badge)')];
      for (const badge of badges) {
        const bc = grow(bb(badge.querySelector('circle') ?? badge), 3);
        for (const lab of labels) if (hit(bc, bb(lab), 0)) out.push(`${name}: step badge "${badge.textContent}" touches the label "${(lab.textContent ?? '').slice(0, 40)}"`);
        for (const other of badges) if (other !== badge && hit(bc, bb(other.querySelector('circle') ?? other), 0)) out.push(`${name}: step badge "${badge.textContent}" touches badge "${other.textContent}"`);
      }
    }
    // sequence figures (desktop): a message's words stay over its own arrow, never across another
    // participant's lifeline beyond the arrow's ends (a self-call stays short of the next lifeline).
    // On a phone the words take a full-width row above the arrow by design, so only wide layouts are measured.
    if (svg.dataset.variant === 'wide') {
      const lifelines = [...svg.querySelectorAll<SVGPathElement>('.an-lifeline')].map((l) => l.getPointAtLength(0).x);
      for (const lab of svg.querySelectorAll<SVGGElement>('.an-seq-text[data-for]')) {
        const own = edges.find((p) => p.id === lab.dataset.for);
        if (!own) continue;
        const a = own.getPointAtLength(0).x;
        const z = own.getPointAtLength(own.getTotalLength()).x;
        const lo = Math.min(a, z) - 2;
        const hi = Math.max(a, z) + 2;
        const words = [...lab.querySelectorAll<SVGTextElement>('text')].map((t) => bb(t));
        const x0 = Math.min(...words.map((w) => w.x));
        const x1 = Math.max(...words.map((w) => w.x + w.w));
        for (const lx of lifelines) if ((lx < lo || lx > hi) && lx > x0 && lx < x1) out.push(`${name}: the words of "${(lab.textContent ?? '').slice(0, 40)}" run past their arrow across a lifeline`);
      }
    }
    // a wire that leaves a group is labelled after it leaves: never inside the group it starts in when it ends
    // outside it (in the gap between groups, not above the source's border). An account boundary is exempt:
    // a wire entering the account is labelled inside it.
    {
      const groupEls = [...svg.querySelectorAll<SVGGElement>('[data-group]:not(.an-group-boundary)')].map((g) => ({ g, r: g.querySelector<SVGGraphicsElement>(':scope > rect') })).filter((x) => x.r);
      for (const lab of svg.querySelectorAll<SVGGElement>('[data-for]:not(.an-badge)')) {
        const own = edges.find((p) => p.id === lab.dataset.for || p.dataset.edge === lab.dataset.for);
        if (!own) continue;
        const lb = bb(lab);
        const from = own.getPointAtLength(0);
        const to = own.getPointAtLength(own.getTotalLength());
        for (const { g, r: rr } of groupEls) {
          const box = bb(rr!);
          if (!inside(lb, box, 0)) continue;
          const holds = (pt: DOMPoint) => pt.x >= box.x - 2 && pt.x <= box.x + box.w + 2 && pt.y >= box.y - 2 && pt.y <= box.y + box.h + 2;
          if (holds(from) && !holds(to)) out.push(`${name}: label "${(lab.textContent ?? '').slice(0, 40)}" sits inside group ${g.dataset.group}, where its wire starts, not in the gap after it`);
        }
      }
    }
    // a wire ends straight: its last 12 px run in one direction (no hook or curl before the arrowhead)
    for (const p of edges) {
      const len = p.getTotalLength();
      if (len < 30) continue;
      const q0 = p.getPointAtLength(len - 12);
      const q1 = p.getPointAtLength(len - 6);
      const q2 = p.getPointAtLength(len);
      const ang = (u: DOMPoint, v: DOMPoint) => Math.atan2(v.y - u.y, v.x - u.x);
      let d = Math.abs(ang(q0, q1) - ang(q1, q2));
      if (d > Math.PI) d = 2 * Math.PI - d;
      if (!svg.classList.contains('an-sketch') && d > 0.35) out.push(`${name}: wire ${p.dataset.from}→${p.dataset.to} ends in a hook (its last 12 px turn)`);
    }
    // a sketch's handwritten title keeps 6 px from the cloud outline
    {
      const cloudEl = svg.querySelector<SVGPathElement>('.an-sk-cloud');
      const title = svg.querySelector<SVGTextElement>('.an-sk-title');
      if (cloudEl && title) {
        const tbx = bb(title);
        const gap = Math.min(...pts(cloudEl as unknown as SVGPathElement, 2).map((pt) => distToBox(pt, tbx)));
        if (gap < 6) out.push(`${name}: the title "${title.textContent}" is ${Math.round(gap)} px from the cloud outline (min 6)`);
      }
    }
    // responsive figure: no horizontal or vertical scrollbars, and the drawing fits inside its frame
    {
      const frame = svg.closest<HTMLElement>('.an-frame');
      const surface = svg.closest<HTMLElement>('.an-diagram-surface');
      if (frame) {
        if (frame.scrollWidth > frame.clientWidth + 1) out.push(`${name}: figure overflows horizontally (${frame.scrollWidth} > ${frame.clientWidth})`);
        if (svg.getBoundingClientRect().width > frame.getBoundingClientRect().width + 1) out.push(`${name}: svg wider than its frame`);
      }
      if (surface) {
        if (surface.scrollWidth > surface.clientWidth + 1 || surface.scrollHeight > surface.clientHeight + 1) {
          out.push(`${name}: diagram surface has scroll overflow (${surface.scrollWidth}x${surface.scrollHeight} > ${surface.clientWidth}x${surface.clientHeight})`);
        }
      }
    }
    // a phone sequence figure: a message's words never sit over a lifeline (desktop wraps them within their arrow)
    if (svg.classList.contains('an-seq') && svg.dataset.variant === 'narrow') {
      const lines = [...svg.querySelectorAll<SVGPathElement>('.an-lifeline')];
      for (const lab of svg.querySelectorAll<SVGGElement>('.an-seq-text[data-for]')) {
        for (const t of lab.querySelectorAll<SVGTextElement>('text')) {
          const w = bb(t);
          if (lines.some((l) => pts(l, 2).some((pt) => pt.x > w.x - 2 && pt.x < w.x + w.w + 2 && pt.y > w.y && pt.y < w.y + w.h))) {
            out.push(`${name}: the words "${(t.textContent ?? '').slice(0, 40)}" sit over a lifeline`);
            break;
          }
        }
      }
    }
    // a short wire runs straight to its end: no loop, ring or kink drawn on it (its length stays near its ends' distance)
    for (const p of edges) {
      // a self-call (a sequence step to itself) loops by design
      if (svg.classList.contains('an-sketch') || svg.classList.contains('an-iso') || p.dataset.from === p.dataset.to) continue;
      const a = p.getPointAtLength(0);
      const len = p.getTotalLength();
      const z = p.getPointAtLength(len);
      const manhattan = Math.abs(z.x - a.x) + Math.abs(z.y - a.y);
      if (manhattan < 160 && len > manhattan + 24) out.push(`${name}: the short wire ${p.dataset.from}→${p.dataset.to} loops (${Math.round(len)} px drawn for ${Math.round(manhattan)} px between its ends)`);
    }
    // a wire whose two ends lie inside an account boundary stays inside it
    for (const g of svg.querySelectorAll<SVGGElement>('.an-group-boundary[data-group]')) {
      const gr = g.querySelector<SVGGraphicsElement>(':scope > rect');
      if (!gr) continue;
      const box = bb(gr);
      const inB = (pt: DOMPoint, tol: number) => pt.x >= box.x - tol && pt.x <= box.x + box.w + tol && pt.y >= box.y - tol && pt.y <= box.y + box.h + tol;
      for (const p of edges) {
        const len = p.getTotalLength();
        if (!inB(p.getPointAtLength(0), 1) || !inB(p.getPointAtLength(len), 1)) continue;
        if (pts(p).some((pt) => !inB(pt, 1))) out.push(`${name}: wire ${p.dataset.from}→${p.dataset.to} leaves the ${g.dataset.group} boundary although both its ends are inside`);
      }
    }
    // no S-step or U-turn at either end: two corners within 44 px of a wire's start or its arrowhead read as a jog
    // (a misaligned port), not a route
    for (const p of edges) {
      if (svg.classList.contains('an-sketch') || svg.classList.contains('an-iso') || p.dataset.from === p.dataset.to) continue;
      const len = p.getTotalLength();
      const corners: number[] = [];
      let prev: number | null = null;
      for (let d = 0; d + 3 <= len; d += 3) {
        const u = p.getPointAtLength(d);
        const v = p.getPointAtLength(d + 3);
        const a = Math.atan2(v.y - u.y, v.x - u.x);
        if (prev != null) {
          let dd = Math.abs(a - prev);
          if (dd > Math.PI) dd = 2 * Math.PI - dd;
          // one corner per turn (a rounded corner spans a few samples)
          if (dd > 0.3 && (!corners.length || d - corners[corners.length - 1]! > 9)) corners.push(d);
        }
        prev = a;
      }
      // anywhere along it: two turns within 14 px are a zig-zag glitch, not a route
      const zig = corners.findIndex((c, k) => k > 0 && c - corners[k - 1]! < 14);
      if (zig > 0) out.push(`${name}: wire ${p.dataset.from}→${p.dataset.to} zig-zags at ${Math.round(corners[zig]!)} px along it`);
      if (corners.filter((c) => c > len - 44).length >= 2) out.push(`${name}: wire ${p.dataset.from}→${p.dataset.to} jogs just before its arrowhead (two turns in its last 44 px)`);
      else if (corners.filter((c) => c < 44).length >= 2) out.push(`${name}: wire ${p.dataset.from}→${p.dataset.to} jogs just after its start (two turns in its first 44 px)`);
    }
    // a wire never rides a group's border: no run of 40 px or more within 9 px of it (crossing it is fine)
    for (const g of svg.querySelectorAll<SVGGElement>('[data-group]')) {
      const rr = g.querySelector<SVGGraphicsElement>(':scope > rect');
      if (!rr) continue;
      const box = bb(rr);
      const lines = [
        { h: true, at: box.y, lo: box.x, hi: box.x + box.w },
        { h: true, at: box.y + box.h, lo: box.x, hi: box.x + box.w },
        { h: false, at: box.x, lo: box.y, hi: box.y + box.h },
        { h: false, at: box.x + box.w, lo: box.y, hi: box.y + box.h },
      ];
      for (const p of edges) {
        if (svg.classList.contains('an-sketch') || svg.classList.contains('an-iso')) continue;
        const list = pts(p, 3);
        for (const ln of lines) {
          let run = 0;
          let worst = 0;
          for (const pt of list) {
            const along = ln.h ? pt.x : pt.y;
            const off = Math.abs((ln.h ? pt.y : pt.x) - ln.at);
            run = along > ln.lo && along < ln.hi && off <= 9 ? run + 3 : 0;
            worst = Math.max(worst, run);
          }
          if (worst >= 40) {
            out.push(`${name}: wire ${p.dataset.from}→${p.dataset.to} rides the border of ${g.dataset.group} for ${worst} px`);
            break;
          }
        }
      }
    }
    // a step badge keeps 6 px from every wire but its own
    for (const badge of svg.querySelectorAll<SVGGElement>('.an-badge')) {
      const c = bb(badge.querySelector('circle') ?? badge.querySelector('rect') ?? badge);
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      // a lettered sub-step is a pill: its distance is from its straight core (a circle's core is its centre)
      const rad = c.h / 2;
      const core = Math.max(0, c.w / 2 - rad);
      for (const p of edges) {
        if (p.id === badge.dataset.for || p.dataset.edge === badge.dataset.for) continue;
        const d = Math.min(...pts(p, 2).map((pt) => Math.hypot(pt.x - Math.max(cx - core, Math.min(cx + core, pt.x)), pt.y - cy))) - rad;
        if (d < 6) {
          out.push(`${name}: step badge "${badge.textContent}" is ${Math.max(0, Math.round(d))} px from the wire ${p.dataset.from}→${p.dataset.to} (min 6)`);
          break;
        }
      }
    }
    // hand-drawn curves: one curve's end and another's start stay 8 px apart, so two never read as one line
    if (svg.classList.contains('an-sketch')) {
      const ends = edges.map((p) => ({ p, a: p.getPointAtLength(0), z: p.getPointAtLength(p.getTotalLength()) }));
      for (const x of ends)
        for (const y of ends) {
          if (x === y) continue;
          const d = Math.hypot(x.z.x - y.a.x, x.z.y - y.a.y);
          if (d < 8) out.push(`${name}: the curve ${x.p.dataset.from}→${x.p.dataset.to} ends ${Math.round(d)} px from where ${y.p.dataset.from}→${y.p.dataset.to} starts (min 8)`);
        }
    }
    // groups nest or stand apart, never half-overlap; a node inside a group's box belongs to it
    const groups = [...svg.querySelectorAll<SVGGElement>('[data-group]')]
      .map((g) => ({ id: g.dataset.group!, members: new Set((g.dataset.members ?? '').split(' ').filter(Boolean)), b: bb(g.querySelector<SVGGraphicsElement>('rect, polygon') ?? g) }))
      .filter((g) => g.members.size);
    for (let i = 0; i < groups.length; i++)
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i]!.b;
        const b = groups[j]!.b;
        if (hit(a, b, 1) && !inside(a, b, 1) && !inside(b, a, 1)) out.push(`${name}: groups ${groups[i]!.id} and ${groups[j]!.id} overlap`);
      }
    for (const g of groups)
      for (const [id, box] of nodeBox) if (!g.members.has(id) && hit(box, g.b, 2)) out.push(`${name}: node ${id} sits inside group ${g.id} it doesn't belong to`);
    // nothing clipped by the page: the svg fits its container
    const parent = svg.parentElement!;
    if (svg.getBoundingClientRect().right > parent.getBoundingClientRect().right + 1 && getComputedStyle(parent).overflowX !== 'auto') out.push(`${name}: svg wider than its container`);
  }
  // an Arabic page names the site in Arabic everywhere: header, footer, title, alt and label text (owner, Apple #74)
  if (ar) {
    const LATIN = /Al Ummah Now/;
    const where: string[] = [];
    if (LATIN.test(document.title)) where.push('the page title');
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const el = n.parentElement;
      if (!el || !el.getClientRects().length || el.closest('script,style')) continue;
      if (LATIN.test(n.textContent ?? '')) where.push(`text in <${el.tagName.toLowerCase()}${el.className ? ` class="${String(el.className).slice(0, 30)}"` : ''}>`);
    }
    for (const el of document.querySelectorAll('[alt], [aria-label], [title]'))
      for (const at of ['alt', 'aria-label', 'title']) if (LATIN.test(el.getAttribute(at) ?? '')) where.push(`${at} on <${el.tagName.toLowerCase()}>`);
    if (where.length) out.push(`page: the Arabic page names the site "Al Ummah Now" in Latin (${[...new Set(where)].slice(0, 4).join('; ')})`);
  }
  return [...new Set(out)];
}

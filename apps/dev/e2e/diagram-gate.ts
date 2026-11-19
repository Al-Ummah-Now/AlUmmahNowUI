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
 * Only visible diagrams are checked (the wide/narrow twin that CSS hides is skipped).
 */
export function gateInBrowser(): string[] {
  const out: string[] = [];
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
    for (const g of nodes) {
      const id = g.dataset.node!;
      const boxEl = g.querySelector<SVGGraphicsElement>('[data-box]') ?? g.querySelector<SVGGraphicsElement>('.an-node-box') ?? g;
      const box = bb(boxEl);
      nodeBox.set(id, box);
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
    for (const { t, b } of tb) if (!inside(b, view)) out.push(`${name}: text "${t.textContent}" outside the viewBox`);
    for (let i = 0; i < tb.length; i++)
      for (let j = i + 1; j < tb.length; j++)
        if (hit(tb[i]!.b, tb[j]!.b)) out.push(`${name}: text "${tb[i]!.t.textContent}" overlaps "${tb[j]!.t.textContent}"`);
    // text never sits on another node
    for (const { t, b } of tb) {
      const own = t.closest<SVGGElement>('[data-node]')?.dataset.node ?? t.closest<SVGGElement>('[data-node-label]')?.dataset.nodeLabel;
      for (const [id, box] of nodeBox) if (id !== own && hit(b, box, 1)) out.push(`${name}: text "${t.textContent}" sits on node ${id}`);
    }
    for (const p of svg.querySelectorAll<SVGPathElement>('[data-edge]')) {
      const ends = new Set([p.dataset.from, p.dataset.to]);
      const len = p.getTotalLength();
      for (let d = 0; d <= len; d += 3) {
        const pt = p.getPointAtLength(d);
        for (const [id, box] of nodeBox) {
          if (ends.has(id)) continue;
          if (pt.x > box.x + 1 && pt.x < box.x + box.w - 1 && pt.y > box.y + 1 && pt.y < box.y + box.h - 1) {
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
          if (pt.x > box.x && pt.x < box.x + box.w && pt.y > box.y && pt.y < box.y + box.h) {
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
  return [...new Set(out)];
}

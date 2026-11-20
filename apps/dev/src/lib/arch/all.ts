/**
 * Every system design diagram, by id, for both languages. Pages render from here; the vitest
 * check (tests/arch.test.ts) and the browser gate (e2e/diagram-gate.spec.ts) iterate it.
 */
import { renderArch } from './arch.ts';
import { overview } from './specs/overview.ts';
import { pipeline } from './specs/pipeline.ts';
import { costs } from './specs/costs.ts';
import { renderIso } from './iso.ts';
import { renderSketch, renderSketchSpec } from './sketch.ts';
import { PAGE_BUILDERS } from './pages/index.ts';
import { renderSeq, seqFlows } from './seq.ts';
import { finishBidi } from './text.ts';
import { strings } from '../../i18n/index.ts';

export type DiagramId = string;

export interface Rendered {
  wide: string;
  narrow: string;
  flows: string[];
  /** the flow kinds each layout actually draws (one legend per layout) */
  flowsWide?: string[];
  flowsNarrow?: string[];
  steps: boolean;
}

/** Every diagram, in either language, with Arabic text set right to left and its Latin runs isolated. */
export function diagram(id: DiagramId, locale: 'en' | 'ar'): Rendered {
  const r = build(id, locale);
  const drawn = (svg: string) => r.flows.filter((f) => svg.includes(`class="an-edge an-f-${f}`));
  return { ...r, wide: finishBidi(r.wide), narrow: finishBidi(r.narrow), flowsWide: drawn(r.wide), flowsNarrow: drawn(r.narrow) };
}

function build(id: DiagramId, locale: 'en' | 'ar'): Rendered {
  // through strings(): {N…} numbers and {tk…} names are filled for the language
  const c = strings(locale).diagrams;
  const rtl = locale === 'ar';
  const ro = (variant: string) => ({ rtl, variant, locale, scenario: 'one', unknown: c.costs.unknown });
  const page = PAGE_BUILDERS[id];
  if (page) {
    const b = page(c, locale);
    if (b.kind === 'seq') return { wide: renderSeq(b.spec, b.wide, { rtl, variant: 'wide', locale }), narrow: renderSeq(b.spec, { ...b.narrow, narrow: true }, { rtl, variant: 'narrow', locale }), flows: seqFlows(b.spec), steps: true };
    if (b.kind === 'sketch') return { wide: renderSketchSpec(b.spec, b.wide, { rtl, variant: 'wide' }), narrow: renderSketchSpec(b.spec, b.narrow, { rtl, variant: 'narrow' }), flows: [], steps: false };
    return { wide: renderArch(b.spec, b.wide, ro('wide')), narrow: renderArch(b.spec, b.narrow, ro('narrow')), flows: flowsIn(b.spec.edges, b.narrow.edges), steps: b.spec.motion === 'steps' && b.spec.badges !== false };
  }
  switch (id) {
    case 'overview': {
      const o = overview(c.overview, c.costs, locale);
      return { wide: renderArch(o.spec, o.wide, ro('wide')), narrow: renderArch(o.spec, o.narrow, ro('narrow')), flows: flowsIn(o.spec.edges, o.narrow.edges), steps: false };
    }
    case 'pipeline': {
      const o = pipeline(c.pipeline, c.costs, locale);
      return { wide: renderArch(o.spec, o.wide, ro('wide')), narrow: renderArch(o.spec, o.narrow, ro('narrow')), flows: flowsIn(o.spec.edges, o.narrow.edges), steps: true };
    }
    case 'costs': {
      const o = costs(c.costs, locale);
      return { wide: renderArch(o.spec, o.wide, ro('wide')), narrow: renderArch(o.spec, o.narrow, ro('narrow')), flows: flowsIn(o.spec.edges, o.narrow.edges).filter((f) => f !== 'control'), steps: true };
    }
    case 'hero':
      return { wide: renderIso(c.hero, { rtl, variant: 'wide' }), narrow: renderIso(c.hero, { rtl, variant: 'narrow' }), flows: ['request', 'media', 'delivery'], steps: false };
    default:
      throw new Error(`unknown diagram ${id}`);
    case 'sketch-play':
      return { wide: renderSketch(c.sketch, { rtl, variant: 'wide' }), narrow: renderSketch(c.sketch, { rtl, variant: 'narrow' }), flows: [], steps: false };
  }
}

const flowsIn = (...lists: ({ flow: string }[] | undefined)[]) => [...new Set(lists.flatMap((l) => (l ?? []).map((e) => e.flow)))];

export const DIAGRAMS: DiagramId[] = ['hero', 'overview', 'pipeline', 'sketch-play', 'costs', ...Object.keys(PAGE_BUILDERS)];

/**
 * Every system design diagram, by id, for both languages. Pages render from here; the vitest
 * check (tests/arch.test.ts) and the browser gate (e2e/diagram-gate.spec.ts) iterate it.
 */
import { renderArch } from './arch.ts';
import { overview } from './specs/overview.ts';
import { pipeline } from './specs/pipeline.ts';
import { costs } from './specs/costs.ts';
import { renderIso } from './iso.ts';
import { renderSketch } from './sketch.ts';
import { diagramsEn } from '../../i18n/diagrams.en.ts';
import { diagramsAr } from '../../i18n/diagrams.ar.ts';

export type DiagramId = 'overview' | 'pipeline' | 'hero' | 'sketch-play' | 'costs';

export interface Rendered {
  wide: string;
  narrow: string;
  flows: string[];
  steps: boolean;
}

export function diagram(id: DiagramId, locale: 'en' | 'ar'): Rendered {
  const c = locale === 'ar' ? diagramsAr : diagramsEn;
  const rtl = locale === 'ar';
  const ro = (variant: string) => ({ rtl, variant, locale, scenario: 'one', unknown: c.costs.unknown });
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
    case 'sketch-play':
      return { wide: renderSketch(c.sketch, { rtl, variant: 'wide' }), narrow: renderSketch(c.sketch, { rtl, variant: 'narrow' }), flows: [], steps: false };
  }
}

const flowsIn = (...lists: ({ flow: string }[] | undefined)[]) => [...new Set(lists.flatMap((l) => (l ?? []).map((e) => e.flow)))];

export const DIAGRAMS: DiagramId[] = ['hero', 'overview', 'pipeline', 'sketch-play', 'costs'];

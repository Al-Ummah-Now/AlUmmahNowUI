/** What a page module gives the registry (src/lib/arch/all.ts): one builder per diagram id. */
import type { ArchLayout, ArchSpec } from '../arch.ts';
import type { SketchLayout, SketchSpec } from '../sketch.ts';
import type { SeqLayout, SeqSpec } from '../seq.ts';
import type { diagramsEn } from '../../../i18n/diagrams.en.ts';

export type DiagramsCopy = typeof diagramsEn;
export type Built = { kind: 'arch'; spec: ArchSpec; wide: ArchLayout; narrow: ArchLayout } | { kind: 'sketch'; spec: SketchSpec; wide: SketchLayout; narrow: SketchLayout }
  | { kind: 'seq'; spec: SeqSpec; wide: SeqLayout; narrow: SeqLayout };
export type Builder = (c: DiagramsCopy, locale: 'en' | 'ar') => Built;

import { describe, expect, it } from 'vitest';
import { DIAGRAMS, diagram } from '../src/lib/arch/all';

/**
 * A phone figure says everything the desktop one says: every wire (from → to) and every wire's words, and
 * the Arabic figure draws the same wires as the English one. (Audit round 8: phones dropped edges and labels.)
 * A phone may end a wire on a group where the desktop ends it on one of the group's tiles, so phone vs desktop
 * compares the words and the number of wires; Arabic vs English compares the wires end to end.
 */
const wires = (svg: string) => {
  const labels = new Map<string, string>();
  for (const m of svg.matchAll(/<g class="an-(?:elabel|sk-tag)[^"]*" data-for="([^"]+)"[^>]*>.*?<text[^>]*>(.*?)<\/text>/g)) labels.set(m[1]!, (labels.get(m[1]!) ?? '') + m[2]!);
  const out: string[] = [];
  for (const m of svg.matchAll(/<path id="([^"]+)" data-edge="[^"]*"(?: data-direct="[^"]*")? data-from="([^"]+)" data-to="([^"]+)"/g)) out.push(`${m[2]} → ${m[3]}${labels.has(m[1]!) ? ` "${labels.get(m[1]!)}"` : ''}`);
  return out.sort();
};

describe('phone figures keep every wire and label', () => {
  for (const id of DIAGRAMS) {
    if (id === 'hero') continue;
    it(id, () => {
      const en = diagram(id, 'en');
      const ar = diagram(id, 'ar');
      const said = (svg: string) => wires(svg).map((w) => w.replace(/^.*? → \S+ ?/, '') || '(no words)').sort();
      expect(said(en.narrow), `${id} en: phone vs desktop`).toEqual(said(en.wide));
      expect(said(ar.narrow), `${id} ar: phone vs desktop`).toEqual(said(ar.wide));
      const shape = (svg: string) => wires(svg).map((w) => w.replace(/ ".*"$/, ' (labelled)'));
      expect(shape(ar.narrow), `${id}: ar vs en`).toEqual(shape(en.narrow));
    });
  }
});

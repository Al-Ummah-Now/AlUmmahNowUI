import { describe, expect, it } from 'vitest';
import { glassSectionsHtml } from '../../../packages/render/src/glass-sections';

describe('glassSectionsHtml: one frosted-glass box per section', () => {
  it('splits at each <h2>, the text before the first heading in a box of its own', () => {
    const html = '<p>Intro</p><h2 id="a">One</h2><p>1</p><h3>Sub</h3><p>1b</p><h2>Two</h2><ul><li>2</li></ul>';
    expect(glassSectionsHtml(html)).toBe(
      '<div class="pb-glass-stack">' +
        '<section class="pb-glass pb-glass-box prose"><p>Intro</p></section>' +
        '<section class="pb-glass pb-glass-box prose"><h2 id="a">One</h2><p>1</p><h3>Sub</h3><p>1b</p></section>' +
        '<section class="pb-glass pb-glass-box prose"><h2>Two</h2><ul><li>2</li></ul></section>' +
        '</div>',
    );
  });
  it('a page with no headings is one box; nothing at all is nothing', () => {
    expect(glassSectionsHtml('<p>Only</p>', 'p2')).toBe('<div class="pb-glass-stack"><section class="pb-glass pb-glass-box p2"><p>Only</p></section></div>');
    expect(glassSectionsHtml('  ')).toBe('');
  });
  it('splits at the highest-ranking heading used: a page\'s ## sections render as <h3>', () => {
    const html = '<p>Intro</p><h3>One</h3><p>1</p><h4>Sub</h4><h3>Two</h3><p>2</p>';
    expect(glassSectionsHtml(html).match(/<section/g)).toHaveLength(3);
    expect(glassSectionsHtml(html)).toContain('<section class="pb-glass pb-glass-box prose"><h3>One</h3><p>1</p><h4>Sub</h4></section>');
  });
  it('tags that only start like a heading do not split', () => {
    expect(glassSectionsHtml('<h2x>no</h2x><p>a</p>').match(/<section/g)).toHaveLength(1);
  });
});

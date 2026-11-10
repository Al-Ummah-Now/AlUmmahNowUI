import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { ar } from '../src/i18n/ar';
import { cardPostSeo, clampSlide, inlineUid, keyStep, neighbours, slideCountLabel, slideFromLink, stripIndex, stripOffset, swipeStep } from '../src/lib/cards';

describe('card viewer rules', () => {
  it('reads ?slide=N and #N (1-based), falling back to the first card', () => {
    expect(slideFromLink('?slide=3', '', 8)).toBe(2);
    expect(slideFromLink('', '#5', 8)).toBe(4);
    expect(slideFromLink('?slide=2', '#6', 8)).toBe(5); // the fragment is the newer intent
    expect(slideFromLink('?slide=9', '', 8)).toBe(0);
    expect(slideFromLink('?slide=0', '', 8)).toBe(0);
    expect(slideFromLink('?slide=2x', '', 8)).toBe(0);
    expect(slideFromLink('', '#top', 8)).toBe(0);
  });

  it('steps in the reading direction: Arabic goes forward with ←', () => {
    expect(keyStep('ArrowRight', 'ltr')).toBe(1);
    expect(keyStep('ArrowLeft', 'ltr')).toBe(-1);
    expect(keyStep('ArrowLeft', 'rtl')).toBe(1);
    expect(keyStep('ArrowRight', 'rtl')).toBe(-1);
    expect(keyStep('Home', 'rtl')).toBe('first');
    expect(keyStep('End', 'ltr')).toBe('last');
    expect(keyStep('Enter', 'ltr')).toBeNull();
  });

  it('turns only clear horizontal swipes, toward the line start = next', () => {
    expect(swipeStep(-80, 5, 'ltr')).toBe(1);
    expect(swipeStep(80, 5, 'ltr')).toBe(-1);
    expect(swipeStep(80, 5, 'rtl')).toBe(1);
    expect(swipeStep(-80, 5, 'rtl')).toBe(-1);
    expect(swipeStep(-20, 0, 'ltr')).toBe(0); // too short
    expect(swipeStep(-60, 90, 'ltr')).toBe(0); // a scroll
  });

  it('labels counts with Arabic plural forms', () => {
    expect(slideCountLabel(en.cards, 1)).toBe(en.cards.oneSlide);
    expect(slideCountLabel(en.cards, 8)).toBe('8 cards');
    expect(slideCountLabel(ar.cards, 2)).toBe(ar.cards.twoSlides);
    expect(slideCountLabel(ar.cards, 5)).toBe(ar.cards.slideCount.replace('{count}', '5'));
    expect(slideCountLabel(ar.cards, 11)).toBe(ar.cards.manySlides.replace('{count}', '11'));
  });

  it('clamps without wrapping and preloads the next two and the previous card', () => {
    expect(clampSlide(-1, 5)).toBe(0);
    expect(clampSlide(9, 5)).toBe(4);
    expect(neighbours(0, 5)).toEqual([1, 2]);
    expect(neighbours(2, 5)).toEqual([1, 3, 4]);
    expect(neighbours(4, 5)).toEqual([3]);
  });

  it('shares the cover, else the first card (image and text)', () => {
    const slide = { image: { url: 'https://cms/a.png' }, heading: 'Day one', body: 'We set out.' };
    expect(cardPostSeo({ kind: 'cards', cover: null, slides: [slide] })).toEqual({ image: 'https://cms/a.png', text: 'Day one — We set out.' });
    expect(cardPostSeo({ kind: 'cards', cover: { url: 'https://cms/c.png' }, slides: [slide] }).image).toBe('https://cms/c.png');
    expect(cardPostSeo({ kind: 'article', cover: null, slides: [] })).toEqual({ image: null, text: '' });
  });

  it('maps an inline strip scroll position to its card and back, mirrored in RTL', () => {
    expect(stripIndex(0, 320, 5)).toBe(0);
    expect(stripIndex(640, 320, 5)).toBe(2);
    expect(stripIndex(-640, 320, 5)).toBe(2); // RTL scrollLeft runs negative
    expect(stripIndex(-470, 320, 5)).toBe(1); // mid-swipe: the nearer card
    expect(stripIndex(99999, 320, 5)).toBe(4);
    expect(stripIndex(100, 0, 5)).toBe(0);
    expect(stripOffset(2, 320, 'ltr')).toBe(640);
    expect(stripOffset(2, 320, 'rtl')).toBe(-640);
    expect(stripIndex(stripOffset(3, 300, 'rtl'), 300, 5)).toBe(3);
  });

  it('gives each inline viewer its own id prefix', () => {
    expect(inlineUid()).not.toBe(inlineUid());
    expect(inlineUid()).toMatch(/^cards-[0-9a-z]+$/);
  });
});

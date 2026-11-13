import { describe, expect, it } from 'vitest';
import { contactUrl, helpUrl } from '../src/lib/contact';
import { en } from '../src/i18n/en';
import { ar } from '../src/i18n/ar';

describe('Contact us', () => {
  it('points at the videos site contact page in the same language', () => {
    expect(contactUrl('https://videos.alummahnow.net/', 'en')).toBe('https://videos.alummahnow.net/en/contact');
    expect(contactUrl('https://videos.qa.alummahnow.net', 'ar')).toBe('https://videos.qa.alummahnow.net/ar/contact');
  });
  it('links Help to the videos site Help in the same language', () => {
    expect(helpUrl('https://videos.alummahnow.net/', 'en')).toBe('https://videos.alummahnow.net/en/help');
    expect(helpUrl('https://videos.qa.alummahnow.net', 'ar')).toBe('https://videos.qa.alummahnow.net/ar/help');
    expect(en.footer.help).toBe('Help');
    expect(ar.footer.help).toBe('المساعدة');
  });
  it('has a footer label in both languages', () => {
    expect(en.footer.contact).toBe('Contact us');
    expect(ar.footer.contact).toBe('اتصل بنا');
  });
});

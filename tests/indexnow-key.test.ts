import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * IndexNow key file (wiki AUN-SEO, phase 3): the CMS pings IndexNow with this key and
 * keyLocation https://www.alummahnow.net/<key>.txt, so the file must hold exactly its own name.
 */
describe('IndexNow key file', () => {
  it('exists once in public/ and contains its own key', () => {
    const dir = join(__dirname, '..', 'public');
    const files = readdirSync(dir).filter((f) => /^[0-9a-f]{32}\.txt$/.test(f));
    expect(files).toEqual(['9e1b0c3eec45ae20f6d905e0d4c5b004.txt']);
    expect(readFileSync(join(dir, files[0]!), 'utf8').trim()).toBe(files[0]!.replace('.txt', ''));
  });
});

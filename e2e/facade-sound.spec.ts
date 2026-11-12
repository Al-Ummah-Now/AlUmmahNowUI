/**
 * Owner, 2026-11-12: "videos start muted, why?". A click on a timeline video's facade inserts the
 * embed with autoplay=1&gesture=1 and allow="autoplay", so the embed may play WITH SOUND: the
 * click's user activation reaches the frame (Chrome). The embed is the videos site's; here it is a
 * stand-in on its own (cross-origin) host that plays a tone unmuted and reports to the page.
 *
 * WebKit does not carry a parent click into a cross-origin frame (measured 2026-11-12): there the
 * stand-in is refused and the real embed falls back to muted + "Tap to unmute" (AlUmmahNow
 * embed-sound.spec.ts covers that side). This spec records it so a change in either shows up.
 */
import { expect, test } from '@playwright/test';

// 0.5 s of a 440 Hz tone (WAV)
function tone(): Buffer {
  const sr = 8000, n = sr / 2;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(6000 * Math.sin((2 * Math.PI * 440 * i) / sr)), 44 + i * 2);
  return b;
}

test('a click on a timeline video gives the embed sound (Chromium); WebKit falls back', async ({ page, browserName }) => {
  const seen: string[] = [];
  await page.route('**/embed/v/**', (r) => {
    seen.push(r.request().url());
    return r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><audio id=a loop></audio><script>
        const a = document.getElementById('a'); a.src = location.origin + '/__tone.wav';
        a.play().then(() => parent.postMessage({ aunTest: 'played-unmuted' }, '*'), (e) => parent.postMessage({ aunTest: 'refused:' + e.name }, '*'));
      </script>`,
    });
  });
  await page.route('**/__tone.wav', (r) => r.fulfill({ contentType: 'audio/wav', body: tone() }));
  await page.addInitScript(() => {
    (window as unknown as { __aunTest: string | null }).__aunTest = null;
    addEventListener('message', (e) => {
      if (e.data && typeof e.data.aunTest === 'string') (window as unknown as { __aunTest: string }).__aunTest = e.data.aunTest;
    });
  });

  await page.goto('/en/');
  const entry = page.locator('li.tl-item', { hasText: 'Lesson of the week' });
  await entry.getByRole('button', { name: 'Play: Lesson of the week' }).click();
  const iframe = entry.locator('iframe.facade-iframe');
  await expect(iframe).toHaveAttribute('src', /autoplay=1&gesture=1$/);
  await expect(iframe).toHaveAttribute('allow', /\bautoplay\b/);
  expect(seen.some((u) => /gesture=1/.test(u))).toBe(true);

  const result = await page.waitForFunction(() => (window as unknown as { __aunTest: string | null }).__aunTest, null, { timeout: 15000 }).then((h) => h.jsonValue());
  if (browserName === 'chromium') expect(result, 'the click should let the embed play with sound').toBe('played-unmuted');
  else expect(result, 'WebKit: the parent click does not reach a cross-origin frame (the embed then shows "Tap to unmute")').toBe('refused:NotAllowedError');
});

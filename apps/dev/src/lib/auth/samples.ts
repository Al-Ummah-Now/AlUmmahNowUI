/** The code on the Sign-in API pages: the same in both languages. */
export const SAMPLES = {
  start: `import { createClient } from '@al-ummah-now/openauth/client';

const client = createClient({
  clientID: env.AUTH_CLIENT_ID,
  issuer: 'https://auth.alummahnow.net',
});

// GET /login
const { challenge, url } = await client.authorize(REDIRECT_URI, 'code', { pkce: true });
setCookie('sign_in', JSON.stringify(challenge)); // HttpOnly, Secure, SameSite=Lax
return redirect(url);

// GET /callback
const kept = JSON.parse(takeCookie('sign_in'));
if (params.get('state') !== kept.state) return new Response(null, { status: 400 });
const exchanged = await client.exchange(params.get('code'), REDIRECT_URI, kept.verifier);
if (exchanged.err) return redirect('/login');
saveSession(exchanged.tokens); // access, refresh, expiresIn`,
  verify: `import { createSubjects } from '@al-ummah-now/openauth/subject';
import { array, object, string } from 'valibot';

const subjects = createSubjects({
  user: object({ id: string(), email: string(), roles: array(string()) }),
});

const verified = await client.verify(subjects, accessToken);
if (verified.err || verified.aud !== env.AUTH_CLIENT_ID) {
  return new Response(null, { status: 401 });
}
const { id, roles } = verified.subject.properties;`,
  refresh: `const next = await client.refresh(refreshToken);
if (next.err) return redirect('/login');
saveSession(next.tokens); // before using either`,
  signOut: `clearSession();
const url = new URL('https://auth.alummahnow.net/logout');
url.searchParams.set('return', HOME_URL);
return redirect(url);`,
} as const;
export type Sample = keyof typeof SAMPLES;

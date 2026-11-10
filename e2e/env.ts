/** Expected sign-in parameters for the site under test (defaults: local dev → QA auth). */
export const WWW_URL = (process.env.WWW_URL || `http://localhost:${process.env.WWW_PORT || '4321'}`).replace(/\/+$/, '');
export const AUTH_URL = (process.env.E2E_AUTH_URL || 'https://auth.qa.alummahnow.net').replace(/\/+$/, '');
export const CLIENT_ID = process.env.E2E_CLIENT_ID || 'ecda6f18-89cb-415c-b746-7e77184d75a2';
export const REDIRECT_URI = `${WWW_URL}/auth/callback`;
export const LOCALES = ['en', 'ar'] as const;

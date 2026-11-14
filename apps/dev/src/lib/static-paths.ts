import { LOCALES } from './pages.ts';
/** Every page is built once per language. */
export const localePaths = () => LOCALES.map((lang) => ({ params: { lang } }));

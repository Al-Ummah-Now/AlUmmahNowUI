/**
 * Minimal Cloudflare REST client (no dependencies). Token: CLOUDFLARE_API_TOKEN.
 * Never logs the token or response bodies.
 */
export const DEFAULT_ACCOUNT_ID = '0e4b6e7f9faf280c3c9bf95995edc64f';

export interface WorkerBinding {
  type: string;
  name: string;
}

export async function getWorkerBindings(script: string, env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): Promise<WorkerBinding[] | null> {
  const token = env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is not set');
  const account = env.CLOUDFLARE_ACCOUNT_ID || DEFAULT_ACCOUNT_ID;
  const res = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${script}/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; result?: { bindings?: WorkerBinding[] }; errors?: { message: string }[] };
  if (!res.ok || json.success === false) throw new Error(`GET ${script} settings -> ${res.status} ${json.errors?.map((e) => e.message).join('; ') ?? ''}`);
  return json.result?.bindings ?? [];
}

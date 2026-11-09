import { AsyncLocalStorage } from 'node:async_hooks';
const storage = new AsyncLocalStorage();
export async function headers() { return storage.getStore().headers; }
export async function cookies() {
  const context = storage.getStore();
  return {
    get(name) { return context.cookies.has(name) ? { name, value: context.cookies.get(name) } : undefined; },
    set(name, value, options) {
      context.cookies.set(name, value);
      context.output.push(`${name}=${value}; Path=${options.path}; Max-Age=${options.maxAge}; HttpOnly; Secure; SameSite=Strict`);
    },
  };
}
export function withRequest(request, callback) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('host', new URL(request.url).host);
  const jar = new Map((request.headers.get('cookie') ?? '').split(';').filter(Boolean).map(part => {
    const index = part.indexOf('='); return [part.slice(0, index).trim(), part.slice(index + 1)];
  }));
  return storage.run({ headers: requestHeaders, cookies: jar, output: [] }, async () => {
    const response = await callback();
    for (const value of storage.getStore().output) response.headers.append('Set-Cookie', value);
    return response;
  });
}

// Only used by isolated action tests; production uses the framework request APIs.
export function requestContext() {
  const values = new Map();
  return {
    async headers() { return new Headers({ origin: 'https://portal.test', host: 'portal.test' }); },
    async cookies() { return {
      get(name) { return values.has(name) ? { name, value: values.get(name) } : undefined; },
      set(name, value) { values.set(name, value); },
    }; },
  };
}

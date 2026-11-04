import { env } from 'cloudflare:workers';

export const labUnavailableMessage = 'The isolated Attack Lab database is unavailable.';

// Never fall back to the secure login database, including for seed writes.
export function isolatedLabDb() {
  const labDb = env.LAB_DB;
  return labDb && labDb !== env.DB ? labDb : null;
}

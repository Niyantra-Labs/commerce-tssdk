// Cloudflare Workers entry: POST the config, receive the results.
/* global Response -- Workers runtime global */
import { runChecks } from './checks.mjs';

export default {
  async fetch(request) {
    const config = await request.json();
    const results = await runChecks(config, { name: 'workerd' });
    return Response.json({ runtime: 'workerd', results });
  },
};

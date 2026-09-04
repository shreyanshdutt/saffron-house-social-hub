// Read-only HTTP API, plus track/untrack. Enough for the next commit to move
// the client over and no more — nothing here calls Google or Meta.
//
// No framework. Justification: this is four GETs, a POST and a DELETE over a
// local socket. `node:http` plus a switch is about forty lines; Express is a
// tree of ~60 transitive packages on a service that exists to hold API
// credentials. The dependency is the risk, not the routing.
//
// KNOWN GAP, stated rather than hidden: there is NO AUTHENTICATION. Bind to
// localhost only until that is fixed. See server/README.md § Known gaps.

import http from 'node:http';
import * as repo from './repo.js';

const ROLES = new Set(['admin', 'executive', 'srexec', 'manager']);

const send = (res, status, body) => {
  const json = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(json),
    'cache-control': 'no-store',
  });
  res.end(json);
};

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 64 * 1024) throw new Error('body too large');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createServer(db) {
  return http.createServer(async (req, res) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); }
    catch { return send(res, 400, { error: 'bad url' }); }
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (req.method === 'GET' && path === '/health') {
        return send(res, 200, repo.health(db));
      }
      if (req.method === 'GET' && path === '/establishments') {
        return send(res, 200, { establishments: repo.listEstablishments(db) });
      }
      if (req.method === 'GET' && path.startsWith('/establishments/')) {
        const id = decodeURIComponent(path.slice('/establishments/'.length));
        const row = repo.getEstablishment(db, id);
        return row ? send(res, 200, row) : send(res, 404, { error: 'no such establishment', placeId: id });
      }
      if (req.method === 'GET' && path === '/tracked') {
        return send(res, 200, { tracked: repo.listTracked(db) });
      }
      if (req.method === 'GET' && path.startsWith('/observations/')) {
        const subject = decodeURIComponent(path.slice('/observations/'.length));
        return send(res, 200, repo.observations(db, subject));
      }
      if (req.method === 'POST' && path === '/tracked') {
        const body = await readJson(req);
        const { placeId, trackedBy } = body;
        if (!placeId) return send(res, 400, { error: 'placeId is required' });
        if (!ROLES.has(trackedBy)) {
          return send(res, 400, { error: 'trackedBy must be a role id', allowed: [...ROLES] });
        }
        if (!repo.getEstablishment(db, placeId)) {
          return send(res, 404, { error: 'no such establishment', placeId });
        }
        repo.track(db, placeId, trackedBy);
        return send(res, 200, { tracked: repo.listTracked(db) });
      }
      if (req.method === 'DELETE' && path.startsWith('/tracked/')) {
        const id = decodeURIComponent(path.slice('/tracked/'.length));
        const removed = repo.untrack(db, id);
        return send(res, removed ? 200 : 404, removed
          ? { tracked: repo.listTracked(db) }
          : { error: 'not tracked', placeId: id });
      }
      return send(res, 404, { error: 'no such route', method: req.method, path });
    } catch (err) {
      return send(res, 500, { error: err.message });
    }
  });
}

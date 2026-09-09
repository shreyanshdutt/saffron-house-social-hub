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
import { MIN_WINDOW_DAYS } from './derive.js';
import { POST_STATES } from './posts.js';

const ROLES = new Set(['admin', 'executive', 'srexec', 'manager']);

// The client is served by `python3 -m http.server` on another port, so it is a
// different origin and needs CORS. Deliberately permissive on origin and
// deliberately WITHOUT credentials: there is no auth yet (see README § Known
// gaps), so there is no cookie or token for a cross-origin request to carry,
// and `*` cannot be paired with credentials anyway. When auth arrives this
// must become an allow-list, and the README says so.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '600',
};

const send = (res, status, body) => {
  const json = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    ...CORS,
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
      if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS);
        return res.end();
      }
      if (req.method === 'GET' && path === '/health') {
        return send(res, 200, repo.health(db));
      }
      if (req.method === 'GET' && path === '/establishments') {
        // Filters are query parameters, applied in SQL. Absent means unset,
        // not zero — an unset radius does not mean "within 0 km".
        return send(res, 200, {
          filters: {
            maxDistanceKm: url.searchParams.get('maxDistanceKm'),
            minRating: url.searchParams.get('minRating'),
          },
          establishments: repo.listEstablishments(db, {
            maxDistanceKm: url.searchParams.get('maxDistanceKm'),
            minRating: url.searchParams.get('minRating'),
          }),
        });
      }
      // Handle entry. PUT records a hand-entered handle as UNVERIFIED; DELETE
      // records that we looked and there is none.
      if ((req.method === 'PUT' || req.method === 'DELETE') && /^\/establishments\/.+\/social\/instagram$/.test(path)) {
        const placeId = decodeURIComponent(path.slice('/establishments/'.length, path.length - '/social/instagram'.length));
        if (!repo.getEstablishment(db, placeId)) {
          return send(res, 404, { error: 'no such establishment', placeId });
        }
        try {
          if (req.method === 'DELETE') {
            repo.clearInstagramHandle(db, placeId);
          } else {
            const body = await readJson(req);
            repo.setInstagramHandle(db, placeId, body.handle);
          }
        } catch (err) {
          return send(res, 400, { error: err.message });
        }
        return send(res, 200, repo.getEstablishment(db, placeId));
      }
      if (req.method === 'GET' && path.startsWith('/establishments/')) {
        const id = decodeURIComponent(path.slice('/establishments/'.length));
        const row = repo.getEstablishment(db, id);
        return row ? send(res, 200, row) : send(res, 404, { error: 'no such establishment', placeId: id });
      }
      if (req.method === 'GET' && path === '/competitors') {
        // `minWindowDays` travels with the data so the client never hardcodes
        // the threshold its copy explains. One source for the rule.
        return send(res, 200, {
          minWindowDays: MIN_WINDOW_DAYS,
          lastSyncedAt: repo.lastSyncedAt(db),
          competitors: repo.listCompetitors(db),
          self: repo.selfMetrics(db),
        });
      }
      if (req.method === 'GET' && path === '/connections') {
        // No write route. Connecting a channel is an OAuth flow that does not
        // exist yet, and an endpoint that accepted a status change would be
        // the same fabrication in a new place.
        return send(res, 200, { connections: repo.listConnections(db) });
      }
      // --- posts -------------------------------------------------------
      // Three routes plus a delete. What is deliberately NOT here is a PATCH:
      // nothing in parts 2 or 3 edits an existing post — the Composer creates
      // new ones — and an endpoint with no caller is the dead-export class the
      // drift register already has three entries about (12, 13, 18).
      if (req.method === 'GET' && path === '/posts') {
        const state = url.searchParams.get('state');
        if (state && !POST_STATES.includes(state)) {
          return send(res, 400, { error: 'unknown state', allowed: POST_STATES });
        }
        return send(res, 200, { posts: repo.listPosts(db, { state }) });
      }
      if (req.method === 'GET' && /^\/posts\/[^/]+$/.test(path)) {
        const id = decodeURIComponent(path.slice('/posts/'.length));
        const post = repo.getPost(db, id);
        return post ? send(res, 200, post) : send(res, 404, { error: 'no such post', id });
      }
      if (req.method === 'POST' && path === '/posts') {
        const body = await readJson(req);
        try {
          return send(res, 201, repo.createPost(db, body));
        } catch (err) {
          return send(res, 400, { error: err.message });
        }
      }
      // The attempt. It RECORDS rather than refuses — a post with nothing
      // connected comes back with every target failed and a reason on each,
      // which is the owner's decision of 2026-09-09 and the whole point of the
      // route. 200, not 4xx: the attempt succeeded in being made, and the
      // outcomes are in the body.
      if (req.method === 'POST' && /^\/posts\/[^/]+\/publish$/.test(path)) {
        const id = decodeURIComponent(path.slice('/posts/'.length, path.length - '/publish'.length));
        const result = await repo.publishPost(db, id);
        return result ? send(res, 200, result) : send(res, 404, { error: 'no such post', id });
      }
      if (req.method === 'DELETE' && /^\/posts\/[^/]+$/.test(path)) {
        const id = decodeURIComponent(path.slice('/posts/'.length));
        const out = repo.deletePost(db, id);
        return send(res, out.deleted ? 200 : 409, out.deleted ? { deleted: id } : { error: out.reason, id });
      }
      // The menu with real mention counts and the evidence for each. Read-only:
      // nothing on this screen writes, and the count is derived per request
      // from the stored corpus rather than being a column that could drift.
      if (req.method === 'GET' && path === '/menu') {
        return send(res, 200, repo.menuWithMentions(db));
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
      // Write path for observations. The demo sync still runs client-side (its
      // Instagram half operates on post seeds that have not moved), but the
      // readings it produces persist HERE, because the history lives here.
      if (req.method === 'POST' && path === '/observations') {
        const body = await readJson(req);
        const rows = Array.isArray(body.observations) ? body.observations : [];
        if (!rows.length) return send(res, 400, { error: 'observations[] is required' });
        const written = repo.recordObservations(db, rows);
        return send(res, 200, { written });
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

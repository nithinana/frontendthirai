/* thirai-sw.js — background download service worker
   Deploy this file at the ROOT of your site (same level as index / tested.html)
   so it can be served from /thirai-sw.js
*/

const DB_NAME = 'ThiraiDownloads';
const DB_VER  = 1;
const S_META  = 'meta';
const S_BLOB  = 'blobs';

let _db;

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(S_META)) d.createObjectStore(S_META, { keyPath: 'id' });
      if (!d.objectStoreNames.contains(S_BLOB))  d.createObjectStore(S_BLOB,  { keyPath: 'id' });
    };
    r.onsuccess = e => { _db = e.target.result; res(_db); };
    r.onerror   = e => rej(e.target.error);
  });
}

function dbPut(s, o) {
  return new Promise((res, rej) => {
    const t = _db.transaction(s, 'readwrite');
    t.objectStore(s).put(o).onsuccess = () => res();
    t.onerror = e => rej(e.target.error);
  });
}

// Active AbortControllers keyed by download id
const active = {};

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(self.clients.claim()));

self.addEventListener('message', e => {
  if (!e.data) return;

  if (e.data.type === 'START_DOWNLOAD') {
    const { id, meta, proxyUrl } = e.data;
    e.waitUntil(runDownload(id, meta, proxyUrl));
  }

  if (e.data.type === 'CANCEL_DOWNLOAD') {
    const ctrl = active[e.data.id];
    if (ctrl) { ctrl.abort(); delete active[e.data.id]; }
  }
});

async function notify(type, payload) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  clients.forEach(c => c.postMessage({ type, ...payload }));
}

async function runDownload(id, meta, proxyUrl) {
  await openDB();

  const ctrl = new AbortController();
  active[id] = ctrl;

  try {
    const resp = await fetch(proxyUrl, { signal: ctrl.signal });
    if (!resp.ok) throw new Error('Fetch ' + resp.status);

    const total    = parseInt(resp.headers.get('Content-Length') || '0', 10);
    const reader   = resp.body.getReader();
    const chunks   = [];
    let   received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (ctrl.signal.aborted) break;

      chunks.push(value);
      received += value.length;
      const pct = total ? (received / total) * 100 : 0;
      await notify('DL_PROGRESS', { id, pct, received, total });
    }

    if (ctrl.signal.aborted) { delete active[id]; return; }

    const blob = new Blob(chunks, { type: 'video/mp4' });
    await dbPut(S_BLOB, { id, blob });
    await dbPut(S_META, { ...meta, status: 'done', size: blob.size });
    delete active[id];

    await notify('DL_DONE', { id, title: meta.title, size: blob.size });

  } catch (err) {
    if (err.name === 'AbortError') { delete active[id]; return; }
    try { await dbPut(S_META, { ...meta, status: 'error' }); } catch (_) {}
    delete active[id];
    await notify('DL_ERROR', { id });
  }
}

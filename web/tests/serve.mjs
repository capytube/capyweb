// Tiny static server for the smoke test: serves a release build the way the site does.
// No dependencies, so the pre-push hook needs nothing beyond Node.
//
//   node web/tests/serve.mjs <dir> <port>        e.g. node web/tests/serve.mjs web/dist 8792
//
// - Binds 127.0.0.1 only, with no option to change it: nothing on nic's machines listens
//   beyond loopback (global rule).
// - An unknown path WITHOUT an extension gets index.html with status 200, like CloudFront's SPA
//   fallback, so deep links such as /stream/magnus load the app.
// - An unknown path WITH an extension gets 404. CloudFront would answer index.html there too,
//   which is exactly how a missing .wasm turns into a blank page; the smoke test should see
//   the missing file instead.
// - Refuses to start when something already answers on the port, rather than letting the
//   smoke test run against another server (the dev server's 8791, for example).
// Prints "listening http://127.0.0.1:<port>/" once ready. Stops on SIGTERM or SIGINT.
import { connect } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const HOST = '127.0.0.1';
const [dirArg, portArg] = process.argv.slice(2);
const port = Number(portArg);
if (!dirArg || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('usage: node web/tests/serve.mjs <dir> <port>');
  process.exit(2);
}
const root = resolve(dirArg);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm', // streaming compilation refuses any other type
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4',
};

// Is something already listening? A connect that succeeds means yes.
const busy = await new Promise((done) => {
  const s = connect({ host: HOST, port });
  s.once('connect', () => { s.destroy(); done(true); });
  s.once('error', () => done(false));
});
if (busy) {
  console.error(`serve: port ${port} on ${HOST} is already in use; stop that server or pick another port`);
  process.exit(1);
}

async function fileAt(path) {
  try {
    const s = await stat(path);
    if (s.isFile()) return path;
    if (s.isDirectory()) return fileAt(join(path, 'index.html'));
  } catch { /* missing */ }
  return null;
}

const server = createHttpServer(async (req, res) => {
  const send = (status, type, body) => {
    res.writeHead(status, { 'content-type': type, 'content-length': body.length, 'cache-control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : body);
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'text/plain', Buffer.from('method not allowed\n'));
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
  } catch {
    return send(400, 'text/plain', Buffer.from('bad request\n'));
  }
  const target = resolve(root, '.' + path);
  if (target !== root && !target.startsWith(root + sep)) return send(403, 'text/plain', Buffer.from('forbidden\n'));
  let file = await fileAt(target);
  if (!file && extname(path) === '') file = join(root, 'index.html'); // SPA fallback
  if (!file) return send(404, 'text/plain', Buffer.from('not found\n'));
  try {
    send(200, TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', await readFile(file));
  } catch (e) {
    send(500, 'text/plain', Buffer.from(`${e.message}\n`));
  }
});

server.once('error', (e) => {
  console.error(`serve: ${e.code === 'EADDRINUSE' ? `port ${port} on ${HOST} is already in use` : e.message}`);
  process.exit(1);
});
server.listen(port, HOST, () => console.log(`listening http://${HOST}:${port}/`));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { server.close(() => process.exit(0)); server.closeAllConnections(); });

// Workaround temporal: workerd (el runtime que usa `wrangler pages dev`)
// crashea en algunas instalaciones de Windows con access violation 0xc0000005.
// Este script emula lo mínimo de Cloudflare Pages: sirve /public como estático
// y enruta /api/* a /functions/api/**. NO se usa en producción.
//
// Soporta lo que el panel admin necesita:
//   * Variables de entorno desde .env  → segundo parámetro `env` de onRequest*
//   * Rutas dinámicas estilo Cloudflare: archivo.js, carpeta/index.js y [param].js
//   * Métodos: onRequest, onRequestGet/Post/Patch/Put/Delete
//   * Cuerpo de la petición reenviado a la función
//   * Imports relativos entre funciones (se cargan por file:// URL)
//
// Ejecutar:  node dev-server.js
// Detener:   Ctrl+C

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const { pathToFileURL } = require("url");

const PORT = 8788;
const PUBLIC_DIR = path.join(__dirname, "public");
const FUNCTIONS_DIR = path.join(__dirname, "functions");

// ─── .env → ENV map ───────────────────────────────────────────────────────────
function parseEnv(file) {
  const out = {};
  try {
    const txt = fs.readFileSync(file, "utf-8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m || line.trim().startsWith("#")) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[m[1]] = v;
    }
  } catch (e) { /* no .env — fine */ }
  return out;
}
const ENV = parseEnv(path.join(__dirname, ".env"));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jsx": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

// Find a `[param].js` file or `[param]` directory in `dir`. Returns { name, target }.
function findDynamic(dir, kind /* 'file' | 'dir' */) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return null; }
  for (const ent of entries) {
    const m = ent.name.match(/^\[(.+)\]$/) || ent.name.match(/^\[(.+)\]\.js$/);
    if (!m) continue;
    if (kind === "file" && ent.isFile() && ent.name.endsWith(".js")) {
      return { name: m[1], target: path.join(dir, ent.name) };
    }
    if (kind === "dir" && ent.isDirectory()) {
      return { name: m[1], target: path.join(dir, ent.name) };
    }
  }
  return null;
}

// Map URL path segments under /functions to a concrete file + params object.
function resolveRoute(segments) {
  let dir = FUNCTIONS_DIR;
  const params = {};
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;

    if (isLast) {
      const asFile = path.join(dir, seg + ".js");
      if (fs.existsSync(asFile)) return { file: asFile, params };

      const asIndex = path.join(dir, seg, "index.js");
      if (fs.existsSync(asIndex)) return { file: asIndex, params };

      const dynFile = findDynamic(dir, "file");
      if (dynFile) { params[dynFile.name] = decodeURIComponent(seg); return { file: dynFile.target, params }; }

      const dynDir = findDynamic(dir, "dir");
      if (dynDir) {
        const idx = path.join(dynDir.target, "index.js");
        if (fs.existsSync(idx)) { params[dynDir.name] = decodeURIComponent(seg); return { file: idx, params }; }
      }
      return null;
    }

    // not last → descend into a directory
    const asDir = path.join(dir, seg);
    if (fs.existsSync(asDir) && fs.statSync(asDir).isDirectory()) { dir = asDir; continue; }

    const dynDir = findDynamic(dir, "dir");
    if (dynDir) { params[dynDir.name] = decodeURIComponent(seg); dir = dynDir.target; continue; }

    return null;
  }
  return null;
}

async function handleFunction(req, res, pathname) {
  const segments = pathname.slice(1).split("/").filter(Boolean);
  const route = resolveRoute(segments);
  if (!route) return false;

  try {
    // file:// URL (so relative imports resolve) + mtime cache-bust for edits.
    const href = pathToFileURL(route.file).href + "?t=" + fs.statSync(route.file).mtimeMs;
    const mod = await import(href);

    const method = req.method.toUpperCase();
    const named = "onRequest" + method[0] + method.slice(1).toLowerCase();
    const handler = mod[named] || mod.onRequest;
    if (!handler) { res.writeHead(405).end("Method not allowed"); return true; }

    // Collect the request body for non-GET methods.
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const bodyBuf = Buffer.concat(chunks);

    const request = new Request(`http://localhost:${PORT}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: method === "GET" || method === "HEAD" || bodyBuf.length === 0 ? undefined : bodyBuf,
    });

    const result = await handler({
      request, env: ENV, params: route.params,
      waitUntil() {}, next() {}, data: {},
    });
    res.writeHead(result.status, Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
    return true;
  } catch (err) {
    console.error("Function error:", err);
    res.writeHead(500, { "content-type": "application/json" })
       .end(JSON.stringify({ error: "Function error: " + err.message }));
    return true;
  }
}

function serveStatic(req, res, pathname) {
  let filePath = path.join(PUBLIC_DIR, decodeURIComponent(pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  if (!fs.existsSync(filePath)) {
    const fallback = path.join(PUBLIC_DIR, "index.html");
    if (fs.existsSync(fallback)) filePath = fallback;
    else { res.writeHead(404).end("Not found"); return; }
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url);
  console.log(`${req.method} ${pathname}`);

  if (pathname.startsWith("/api/")) {
    const handled = await handleFunction(req, res, pathname);
    if (handled) return;
    res.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ error: "Not found" }));
    return;
  }
  serveStatic(req, res, pathname);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  Dev server (workaround) listo en http://127.0.0.1:${PORT}\n`);
});

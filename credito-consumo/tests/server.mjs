// Servidor estático mínimo para las pruebas E2E (sin dependencias).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.bpmn': 'application/xml', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.png': 'image/png', '.json': 'application/json' };

export function servir(puerto = 0) {
  const srv = http.createServer(async (req, res) => {
    const ruta = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    const archivo = join(RAIZ, ruta || 'index.html');
    if (!archivo.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
    try {
      const datos = await readFile(archivo);
      res.writeHead(200, { 'content-type': TIPOS[extname(archivo)] || 'application/octet-stream' });
      res.end(datos);
    } catch { res.writeHead(404); res.end('no encontrado'); }
  });
  return new Promise((ok) => srv.listen(puerto, () => ok({ srv, url: `http://localhost:${srv.address().port}/` })));
}

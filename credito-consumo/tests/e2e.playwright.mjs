// Prueba de punta a punta con Playwright: ejecuta los 8 casos por la interfaz, verifica
// que cada uno termine en el fin esperado, cubre los fines restantes, la parametrización
// y la exportación de auditoría, y guarda capturas en docs/screenshots.
//
// Uso: node tests/e2e.playwright.mjs
//   PLAYWRIGHT_MODULE=/ruta/a/playwright/index.mjs  si playwright no está en node_modules
//   BPMN_JS_DIR=/ruta/a/bpmn-js/dist/                 para servir bpmn-js sin acceso a unpkg
import { servir } from './server.mjs';
import { CASOS } from '../assets/js/casos.js';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { chromium } = pw.default ?? pw;
const SHOTS = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
await mkdir(SHOTS, { recursive: true });

const { srv, url } = await servir();
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const resultados = [];
const errores = [];

async function nuevaPagina(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...opts });
  const page = await ctx.newPage();
  if (process.env.BPMN_JS_DIR) {
    await page.route('https://unpkg.com/bpmn-js@17.11.1/dist/**', (r) => r.fulfill({ path: process.env.BPMN_JS_DIR + r.request().url().split('/dist/')[1] }));
  }
  page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(`console: ${m.text()}`); });
  page.on('dialog', (d) => d.accept());
  await page.goto(url);
  await page.waitForSelector('#ini-title');
  return page;
}

const estado = (page, id) => page.evaluate((i) => {
  const c = window.__demo.store.state.cases.find((x) => x.id === i);
  return { node: c.node, status: c.status, running: c.running, sub: c.subestado, fin: c.fin?.id, nivel: c.data.decision?.nivel, error: c.error };
}, id);

async function esperarQuieto(page, id) {
  await page.waitForFunction((i) => {
    const c = window.__demo.store.state.cases.find((x) => x.id === i);
    return c && !c.running;
  }, id, { timeout: 30000 });
  await page.waitForTimeout(120); // deja que la vista se re-renderice
  return estado(page, id);
}

const ROL_DE = { B_T10: 'cumplimiento', B_T12a: 'analista', B_T12b: 'analista', B_T13: 'aprobador', B_T16: 'mesa' };

async function actuar(page, s, caso, opciones = {}) {
  const rol = s.sub === 'confirmar-campos' ? 'analista' : ROL_DE[s.node] || (caso.canal === 'digital' ? 'cliente' : 'asesor');
  await page.selectOption('#rol', rol);
  const nodo = s.sub === 'confirmar-campos' ? 'B_T6' : s.node;
  const form = page.locator(`form[data-form="${nodo}"]`);
  await form.waitFor();
  switch (nodo) {
    case 'B_T1': case 'B_T5': case 'B_T5b':
      if (await form.locator('[data-action="adjuntar-todo"]').count()) await form.locator('[data-action="adjuntar-todo"]').click();
      await form.locator('button[type="submit"]').first().click();
      break;
    case 'B_T6':
      await form.locator('[name="motivo"]').fill('Cotejado con el documento original');
      await form.locator('button[type="submit"]').click();
      break;
    case 'B_T10':
      await form.locator('input[name="descartada"][value="no"]').check();
      await form.locator('[name="motivo"]').fill('Coincidencia confirmada con la lista de control');
      await form.locator('button[type="submit"]').click();
      break;
    case 'B_T12a': case 'B_T12b':
      await form.locator('input[name="recomendacion"][value="aprobar"]').check();
      await form.locator('[name="observacion"]').fill('Expediente coherente con la política');
      await form.locator('button[type="submit"]').click();
      break;
    case 'B_T13':
      if (await form.locator('[name="excepcion"]').count()) await form.locator('[name="excepcion"]').fill('Monto sobre atribuciones; comité diario aprueba la excepción');
      await form.locator(`input[name="aprobada"][value="${opciones.noAprobar ? 'no' : 'si'}"]`).check();
      await form.locator('[name="motivo"]').fill(opciones.noAprobar ? 'Sustento de ingreso insuficiente' : 'Dentro de política');
      await form.locator('button[type="submit"]').click();
      break;
    case 'B_T15':
      if (caso.n === 8) {
        await form.locator('[name="motivo"]').fill('El cliente ya no necesita el crédito');
        await form.locator('button[value="no"]').click();
      } else await form.locator('button[value="si"]').click();
      break;
    case 'B_T16':
      await form.locator('[data-action="marcar-todo"]').click();
      await form.locator('button[type="submit"]').click();
      break;
    default:
      throw new Error(`Nodo sin acción: ${nodo}`);
  }
}

async function iniciarCaso(page, n) {
  await page.goto(`${url}#/inicio`);
  await page.click(`[data-action="caso-pre"][data-n="${n}"]`);
  await page.waitForSelector('#case-title');
  return page.evaluate(() => location.hash.split('/').pop());
}

async function correrHasta(page, id, caso, { pararEn = null, opciones = {}, captura = null } = {}) {
  for (let i = 0; i < 30; i++) {
    const s = await esperarQuieto(page, id);
    if (s.error) throw new Error(s.error);
    if (s.status === 'cerrado' || s.node === pararEn) return s;
    if (captura && s.node === captura.nodo) { await page.waitForTimeout(600); await page.screenshot({ path: SHOTS + captura.archivo, fullPage: false }); captura = null; }
    try { await actuar(page, s, caso, opciones); } catch (e) {
      const panel = await page.evaluate(() => [...document.querySelectorAll("#task-panel button")].map((b) => b.outerHTML).join("\n"));
      throw new Error(`${e.message}\nEstado: ${JSON.stringify(s)}\nPanel: ${panel}`);
    }
  }
  throw new Error('Demasiados pasos');
}

const page = await nuevaPagina();
await page.screenshot({ path: `${SHOTS}01-inicio.png`, fullPage: true });

for (const caso of CASOS) {
  const id = await iniciarCaso(page, caso.n);
  const captura = caso.n === 4 ? { nodo: 'B_T13', archivo: '03-expediente-N4-comite.png' } : caso.n === 3 ? { nodo: 'B_T6', archivo: '04-expediente-campo-bajo-umbral.png' } : null;
  const s = await correrHasta(page, id, caso, { captura });
  const ok = s.fin === caso.esperado.fin && (!caso.esperado.nivel || s.nivel === caso.esperado.nivel);
  resultados.push({ prueba: `Caso ${caso.n}: ${caso.titulo}`, esperado: `${caso.esperado.nivel ?? '—'} → ${caso.esperado.fin}`, obtenido: `${s.nivel ?? '—'} → ${s.fin}`, ok });
  if (caso.n === 1) { await page.waitForTimeout(500); await page.screenshot({ path: `${SHOTS}02-expediente-N1-desembolsado.png` }); }
  if (caso.n === 5) {
    await page.screenshot({ path: `${SHOTS}05-expediente-N0-revision-humana.png` });
    const f = page.locator('form[data-form="art20"]');
    await f.locator('[name="motivo"]').fill('Mi ingreso real es mayor al verificado');
    await f.locator('button[type="submit"]').click();
    const r = await esperarQuieto(page, id);
    resultados.push({ prueba: 'Caso 5: "Solicitar revisión humana" (art. 20) reabre en 3.3', esperado: 'B_T12b', obtenido: r.node, ok: r.node === 'B_T12b' });
  }
  if (caso.n === 7) {
    const pasos = await page.evaluate((i) => window.__demo.store.state.cases.find((x) => x.id === i).flows, id);
    const loop = pasos.includes('F_B_G2_B_T5b') && pasos.includes('F_B_T5b_B_T6');
    resultados.push({ prueba: 'Caso 7: 2.1 → 2.3 → 2.1 (flujos F_B_G2_B_T5b y F_B_T5b_B_T6)', esperado: 'bucle recorrido', obtenido: loop ? 'bucle recorrido' : 'sin bucle', ok: loop });
  }
}

// Fines no cubiertos por los 8 casos: No precalifica (nueva solicitud) y No aprobada.
{
  await page.goto(`${url}#/inicio`);
  await page.click('[data-action="nueva"][data-canal="agencia"]');
  await page.waitForSelector('form[data-form="B_T1"]');
  const id = await page.evaluate(() => location.hash.split('/').pop());
  const f = page.locator('form[data-form="B_T1"]');
  await f.locator('[name="nombre"]').fill('Prueba Nueva Solicitud');
  await f.locator('[name="cedula"]').fill('FICT-0000000099');
  await f.locator('[name="ingresoDeclarado"]').fill('300');
  await f.locator('[name="monto"]').fill('9000');
  await f.locator('[name="plazo"]').fill('24');
  await f.locator('[data-action="adjuntar-todo"]').click();
  await page.screenshot({ path: `${SHOTS}06-nueva-solicitud-1.1.png`, fullPage: true });
  if (!(await f.locator('[name="aut_buro"]').inputValue())) await f.locator('[data-action="adjuntar-todo"]').click();
  await f.locator('button[type="submit"]').click();
  await page.waitForFunction((i) => window.__demo.store.state.cases.find((x) => x.id === i).node !== 'B_T1', id, { timeout: 8000 })
    .catch(async () => { throw new Error(`1.1 no avanzó: ${await page.evaluate(() => document.querySelector('[data-error]')?.textContent)} · aut=${await f.locator('[name="aut_buro"]').inputValue()}`); });
  const s = await esperarQuieto(page, id);
  resultados.push({ prueba: 'Nueva solicitud con cuota > 40 % del ingreso declarado', esperado: 'B_E0', obtenido: s.fin, ok: s.fin === 'B_E0' });

  const id2 = await iniciarCaso(page, 2);
  const s2 = await correrHasta(page, id2, CASOS[1], { opciones: { noAprobar: true } });
  resultados.push({ prueba: 'Caso 2 con resolución "No aprobar"', esperado: 'B_E2', obtenido: s2.fin, ok: s2.fin === 'B_E2' });
}

// Bandejas con casos en cola: un caso en Analista y otro en Cumplimiento.
{
  const a = await iniciarCaso(page, 2);
  await correrHasta(page, a, CASOS[1], { pararEn: 'B_T12a' });
  const b = await iniciarCaso(page, 6);
  await correrHasta(page, b, CASOS[5], { pararEn: 'B_T10' });
  await page.screenshot({ path: `${SHOTS}07-expediente-alerta-PLA.png` });
  await page.goto(`${url}#/bandeja`);
  await page.selectOption('#rol', 'todos');
  await page.click('[data-action="reloj-todos"]');
  await page.click('[data-action="reloj-todos"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}08-bandejas-todos-los-modulos.png`, fullPage: true });
  await page.selectOption('#rol', 'analista');
  await page.waitForTimeout(200);
  const titulo = await page.textContent('h1');
  resultados.push({ prueba: 'Bandeja del analista titulada como módulo', esperado: 'Módulo de Analista de Crédito', obtenido: titulo.trim(), ok: titulo.includes('Módulo de Analista de Crédito') });
  await page.screenshot({ path: `${SHOTS}09-modulo-analista-de-credito.png`, fullPage: true });
}

// DMN con la regla aplicada resaltada.
{
  const id = await page.evaluate(() => window.__demo.store.state.cases.find((c) => c.data.decision?.nivel === 'N3')?.id);
  await page.goto(`${url}#/dmn?caso=${id}`);
  await page.waitForSelector('tr.hit');
  await page.screenshot({ path: `${SHOTS}10-dmn-regla-aplicada.png`, fullPage: true });
  const hit = await page.locator('table.dmn tr.hit th').allTextContents();
  resultados.push({ prueba: 'Tabla DMN resalta la regla aplicada al caso N3', esperado: 'D-N3', obtenido: hit.join(' | '), ok: hit.some((t) => t.includes('D-N3')) });
}

// Parametrización: borrador → impacto → publicación v1.1 con auditoría.
{
  await page.goto(`${url}#/parametros`);
  await page.click('[data-action="borrador-crear"]');
  await page.waitForSelector('form[data-form="borrador"]');
  await page.fill('[data-param="topeN1"]', '25000');
  await page.waitForTimeout(150);
  const err = await page.locator('#draft-status .note.bad').count();
  resultados.push({ prueba: 'Validación bloquea tope N1 > atribuciones', esperado: 'error', obtenido: err ? 'error' : 'sin error', ok: err > 0 });
  await page.fill('[data-param="topeN1"]', '15000');
  await page.uncheck('[data-cond="D-N3.disc"]');
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${SHOTS}11-parametrizacion-borrador.png`, fullPage: true });
  await page.fill('[name="justificacion"]', 'Prueba E2E: ampliar el tope N1 tras validación campeón-retador');
  await page.click('form[data-form="borrador"] button[type="submit"]');
  await page.waitForTimeout(200);
  const v = await page.evaluate(() => ({ version: window.__demo.store.politica().version, ev: window.__demo.store.state.auditLog.filter((e) => e.tipo === 'politica' && e.accion.startsWith('Publicación')).length }));
  resultados.push({ prueba: 'Publicación de política versionada y auditada', esperado: 'v1.1 · 1 evento', obtenido: `v${v.version} · ${v.ev} evento(s)`, ok: v.version === '1.1' && v.ev === 1 });
  await page.screenshot({ path: `${SHOTS}12-parametrizacion-historial.png`, fullPage: true });
}

// Auditoría: exportación JSON y CSV + integridad de la cadena.
{
  await page.goto(`${url}#/auditoria`);
  await page.waitForSelector('table.audit');
  const [dj] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export-json"]')]);
  const json = JSON.parse(await (await import('node:fs/promises')).readFile(await dj.path(), 'utf8'));
  const [dc] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export-csv"]')]);
  const csv = await (await import('node:fs/promises')).readFile(await dc.path(), 'utf8');
  await page.click('[data-action="verificar"]');
  const verif = await page.textContent('[data-verif]');
  const okExp = json.eventos.length > 50 && csv.split('\r\n').length === json.eventos.length + 1;
  resultados.push({ prueba: 'Exportación de auditoría JSON y CSV', esperado: 'mismo número de eventos', obtenido: `JSON ${json.eventos.length} · CSV ${csv.split('\r\n').length - 1}`, ok: okExp });
  resultados.push({ prueba: 'Cadena de hash de auditoría íntegra', esperado: 'íntegra', obtenido: verif.trim(), ok: verif.includes('íntegra') });
  await page.screenshot({ path: `${SHOTS}13-auditoria.png` });
}

await page.goto(`${url}#/tablero`);
await page.waitForSelector('#tab-title');
await page.screenshot({ path: `${SHOTS}14-tablero.png`, fullPage: true });

// Móvil 360 px y modo oscuro.
{
  const m = await nuevaPagina({ viewport: { width: 360, height: 780 }, colorScheme: 'dark' });
  await m.screenshot({ path: `${SHOTS}15-movil-360-inicio-oscuro.png`, fullPage: false });
  const anchoIni = await m.evaluate(() => document.documentElement.scrollWidth);
  await m.click('[data-action="caso-pre"][data-n="4"]');
  await m.waitForSelector('#case-title');
  const id = await m.evaluate(() => location.hash.split('/').pop());
  await correrHasta(m, id, CASOS[3], { pararEn: 'B_T12b' });
  await m.waitForTimeout(500);
  await m.screenshot({ path: `${SHOTS}16-movil-360-expediente-oscuro.png`, fullPage: false });
  const anchos = [anchoIni];
  for (const r of ['caso/' + id, 'bandeja', 'dmn', 'parametros', 'auditoria', 'tablero']) {
    await m.goto(`${url}#/${r}`); await m.waitForTimeout(250);
    anchos.push(await m.evaluate(() => document.documentElement.scrollWidth));
  }
  resultados.push({ prueba: 'Sin desplazamiento horizontal a 360 px (6 vistas + inicio)', esperado: '≤ 360', obtenido: anchos.join(', '), ok: anchos.every((w) => w <= 360) });
  await m.context().close();
}

// Teclado: el botón de un caso precargado se alcanza y activa con Tab + Enter.
{
  const k = await nuevaPagina();
  let alcanzado = false;
  for (let i = 0; i < 40 && !alcanzado; i++) {
    await k.keyboard.press('Tab');
    alcanzado = await k.evaluate(() => document.activeElement?.dataset?.action === 'caso-pre');
  }
  if (alcanzado) await k.keyboard.press('Enter');
  const abierto = alcanzado && (await k.waitForSelector('#case-title', { timeout: 5000 }).then(() => true).catch(() => false));
  resultados.push({ prueba: 'Navegación con teclado (Tab + Enter abre un caso)', esperado: 'abre expediente', obtenido: abierto ? 'abre expediente' : 'no', ok: abierto });
  await k.context().close();
}

await browser.close();
srv.close();

const fallos = resultados.filter((r) => !r.ok);
console.table(resultados);
if (errores.length) console.log('Errores de consola/página:\n' + errores.join('\n'));
console.log(`${resultados.length - fallos.length}/${resultados.length} verificaciones OK · ${errores.length} error(es) de consola`);
process.exit(fallos.length || errores.length ? 1 : 0);

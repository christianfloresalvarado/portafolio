// Punto de entrada de la interfaz: shell, enrutador por hash, Inicio, bandejas por módulo,
// Auditoría y Tablero. Las vistas de expediente y DMN viven en módulos aparte.
import { ROLES, CARRILES, TAREAS, ESTIMACIONES, RUTAS_1500, NIVELES, EVENTOS, TABLA12, PERFILES } from './data.js';
import { CASOS, escenarioNuevo } from './casos.js';
import { createStore } from './state.js';
import { createAudit, aCSV, aJSON } from './audit.js';
import { createMocks } from './integrations.mock.js';
import { createEngine, rolDeTarea, moduloDeRol, esperandoHumano, estadoSLA, relojTotal, aDias } from './flow.js';
import * as dmn from './dmn.js';
import { ctx, esc, usd, pct, num, horas, fechaHora, chipNivel, badgeSLA, estadoCaso, tareaActualTexto, perfilTxt, anunciar, descargar, jsonCorto } from './ui.common.js';
import { vistaCaso, firmaCaso, montarBpmn, enviarFormulario, accionCaso, onInputCaso } from './ui.expediente.js';
import { vistaDmn, firmaDmn, correrSimulador, vistaParametros, firmaParametros, actualizarBorrador, crearBorrador, descartarBorrador, publicarBorrador } from './ui.dmn.js';

/* ================================================================ arranque */
const store = createStore();
const audit = createAudit(store.state.auditLog);
const engine = createEngine({
  cases: store.state.cases, audit, mocks: createMocks({ latencia: [300, 1200] }),
  getPolitica: () => store.politica(), emit: (c) => store.emit({ caso: c.id }),
});
Object.assign(ctx, { store, engine, audit });
window.__demo = { store, engine, audit }; // acceso para pruebas E2E y consola

const main = document.getElementById('main');
const LANE_MOD = { L_CAP: ['cliente', 'asesor'], L_SIS: [], L_CUM: ['cumplimiento'], L_FAB: ['analista'], L_APR: ['aprobador'], L_MES: ['mesa'] };

/* ================================================================ enrutador */
function ruta() {
  const [path, qs] = (location.hash.replace(/^#\/?/, '') || 'inicio').split('?');
  const [nombre, ...resto] = path.split('/');
  return { nombre: nombre || 'inicio', arg: resto.join('/'), q: new URLSearchParams(qs || '') };
}

const VISTAS = {
  inicio: { html: vistaInicio, firma: () => `ini:${store.state.cases.map((c) => `${c.id}.${c.rev}`).join(',')}` },
  bandeja: { html: vistaBandeja, firma: () => `ban:${store.state.prefs.rol}:${store.state.cases.map((c) => `${c.id}.${c.rev}`).join(',')}` },
  caso: { html: (r) => vistaCaso(r.arg), firma: (r) => firmaCaso(r.arg), despues: (r) => montarBpmn(r.arg) },
  dmn: { html: (r) => vistaDmn(r.q), firma: (r) => firmaDmn(r.q), despues: () => correrSimulador() },
  parametros: { html: () => vistaParametros(), firma: () => firmaParametros() },
  auditoria: { html: (r) => vistaAuditoria(r.q), firma: (r) => `aud:${store.state.auditLog.length}:${r.q}` },
  tablero: { html: vistaTablero, firma: () => `tab:${store.state.cases.map((c) => `${c.id}.${c.rev}`).join(',')}` },
};

let actual = { clave: null, firma: null, nodo: null };
let pendiente = false;

function render(forzar = false) {
  pendiente = false;
  const r = ruta();
  const vista = VISTAS[r.nombre] || VISTAS.inicio;
  const clave = `${r.nombre}/${r.arg}?${r.q}`;
  const firma = vista.firma(r);
  if (!forzar && clave === actual.clave && firma === actual.firma) return;
  const cambioRuta = clave !== actual.clave;
  const valores = cambioRuta ? null : guardarFormularios();
  main.innerHTML = vista.html(r);
  if (valores) restaurarFormularios(valores);
  vista.despues?.(r);
  marcarNav(r.nombre);
  // Foco: al cambiar de vista, al título; en el expediente, al título de la tarea cuando avanza.
  let foco = null;
  if (cambioRuta) foco = main.querySelector('h1');
  else if (r.nombre === 'caso') {
    const c = store.state.cases.find((x) => x.id === r.arg);
    const nodo = c && `${c.node}:${c.status}:${c.subestado}:${c.running}`;
    if (c && !c.running && nodo !== actual.nodo) foco = main.querySelector('#task-title');
    actual.nodo = nodo;
  }
  if (foco && !main.contains(document.activeElement)) foco.focus({ preventScroll: !cambioRuta });
  else if (foco && cambioRuta) foco.focus();
  if (cambioRuta) window.scrollTo(0, 0);
  actual = { ...actual, clave, firma };
}

function programar() {
  if (pendiente) return;
  pendiente = true;
  requestAnimationFrame(() => render());
}

function guardarFormularios() {
  const out = [];
  main.querySelectorAll('form[data-preserve] [name]:not(button)').forEach((el) => {
    if (el.type === 'radio' || el.type === 'checkbox') out.push([el.form.dataset.form, el.name, el.value, el.checked, true]);
    else out.push([el.form.dataset.form, el.name, el.value, null, false]);
  });
  return out;
}
function restaurarFormularios(vals) {
  for (const [f, name, value, checked, isCheck] of vals) {
    const sel = `form[data-form="${f}"] [name="${CSS.escape(name)}"]`;
    const els = [...main.querySelectorAll(sel)].filter((x) => x.tagName !== 'BUTTON');
    if (isCheck) els.filter((e) => e.value === value).forEach((e) => { e.checked = checked; });
    else if (els[0] && els[0].type !== 'hidden') els[0].value = value;
    else if (els[0] && value) { els[0].value = value; const lbl = main.querySelector(`form[data-form="${f}"] [data-file="${CSS.escape(name)}"]`); if (lbl) lbl.textContent = `📎 ${value}`; }
  }
}

function marcarNav(nombre) {
  document.querySelectorAll('.nav a').forEach((a) => {
    if (a.dataset.ruta === nombre) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

/* ================================================================ Inicio */
function vistaInicio() {
  const casos = store.state.cases;
  return `
  <section class="wrap" aria-labelledby="ini-title">
    <div class="hero">
      <p class="eyebrow">IFI Horizonte (entidad ficticia) · Macroproceso CP.03</p>
      <h1 id="ini-title" tabindex="-1">P-03.1 Concesión de Crédito de Consumo · TO-BE</h1>
      <p class="lead">Demo navegable del proceso rediseñado: una sola plataforma para el canal digital y la agencia, verificación del ingreso en la fuente y un DMN que asigna cinco niveles de revisión (N0–N4).</p>
      <div class="diag card">
        <h2 class="h4">Diagnóstico AS-IS</h2>
        <ul>
          <li>El crédito tarda <strong>9,8 días hábiles</strong> frente a una meta de 3; el <strong>96 %</strong> del tiempo es espera (3,3 h de trabajo).</li>
          <li>La fábrica de crédito opera al <strong>96,4 %</strong> y el 17 % de sus horas se va en revisar otra vez los <strong>360 expedientes devueltos</strong> al mes (30 %).</li>
          <li>El 70 % de las devoluciones nace en la captura en agencia: documentos de ingreso y datos mal digitados.</li>
        </ul>
        <p class="small muted">Fuente: Excel, hoja "AS IS" (tablas 1 a 5).</p>
      </div>
    </div>

    <section aria-labelledby="casos-title">
      <h2 id="casos-title">Casos precargados (uno por ruta)</h2>
      <p class="muted">Cada botón crea un expediente con datos ficticios y lo abre en la tarea 1.1. Las tareas humanas se atienden en el módulo correspondiente; las automáticas las ejecuta la plataforma.</p>
      <div class="cards">
        ${CASOS.map((k) => `<article class="card case-card">
          <p class="eyebrow">Caso ${k.n} · ${k.canal === 'digital' ? 'Canal digital' : 'Agencia'}</p>
          <h3 class="h4">${esc(k.titulo)}</h3>
          <p class="small">${esc(perfilTxt(k.perfil))} · ${usd(k.monto)} · ${k.plazo} meses</p>
          <p class="small">Ruta esperada: ${k.esperado.nivel ? chipNivel(k.esperado.nivel) + ' → ' : ''}${esc(EVENTOS[k.esperado.fin].nombre)}</p>
          <button class="btn primary" type="button" data-action="caso-pre" data-n="${k.n}">Iniciar caso ${k.n}</button>
        </article>`).join('')}
        <article class="card case-card new">
          <p class="eyebrow">Caso propio</p>
          <h3 class="h4">Nueva solicitud</h3>
          <p class="small">Formulario de la tarea 1.1 con un escenario de simulación editable.</p>
          <div class="btn-row"><button class="btn" type="button" data-action="nueva" data-canal="digital">Canal digital</button><button class="btn" type="button" data-action="nueva" data-canal="agencia">Agencia</button></div>
        </article>
      </div>
    </section>

    <section aria-labelledby="mod-title">
      <h2 id="mod-title">Carriles del BPMN y módulos del demo</h2>
      <p class="muted small">El demo aún no controla accesos por cargo: cada carril es un módulo con su bandeja. Cambia de módulo con "Ver como".</p>
      <div class="table-wrap"><table>
        <thead><tr><th scope="col">Carril (BPMN)</th><th scope="col">Módulo</th><th scope="col">Tareas</th></tr></thead>
        <tbody>${Object.entries(CARRILES).map(([id, n]) => `<tr><th scope="row">${esc(n)}</th><td>${LANE_MOD[id].length ? LANE_MOD[id].map((r) => `<a href="#/bandeja" data-action="ir-modulo" data-rol="${r}">${esc(ROLES[r].modulo)}</a>`).join('<br>') : 'Plataforma (automático)'}</td><td class="small">${TAREAS.filter((t) => t.carril === id).map((t) => `${t.cod} ${esc(t.nombre)}`).join('<br>')}</td></tr>`).join('')}
        <tr><th scope="row">Gobierno de reglas (MP.02 Riesgos)</th><td><a href="#/parametros">Módulo de Parametrización de Riesgos</a></td><td class="small">Umbrales, condiciones de las reglas, requisitos por perfil y tiempos; versionado y publicación.</td></tr></tbody>
      </table></div>
    </section>

    <section aria-labelledby="ses-title">
      <h2 id="ses-title">Expedientes de la sesión (${casos.length})</h2>
      ${casos.length ? tablaCasos(casos) : '<p class="muted">Aún no hay expedientes. Inicia un caso precargado o una nueva solicitud.</p>'}
    </section>
  </section>`;
}

function tablaCasos(casos) {
  return `<div class="table-wrap"><table>
    <thead><tr><th scope="col">Folio</th><th scope="col">Caso</th><th scope="col">Nivel</th><th scope="col">Tarea / fin</th><th scope="col">Estado</th><th scope="col">Reloj</th></tr></thead>
    <tbody>${[...casos].reverse().map((c) => `<tr><th scope="row"><a href="#/caso/${c.id}">${c.id}</a></th><td>${esc(c.titulo)}</td><td>${chipNivel(c.data.decision?.nivel)}</td><td class="small">${esc(tareaActualTexto(c))}</td><td>${estadoCaso(c)}</td><td>${horas(relojTotal(c))}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

/* ================================================================ Bandejas */
function vistaBandeja() {
  const rol = store.state.prefs.rol;
  const roles = rol === 'todos' ? Object.keys(ROLES).filter((r) => r !== 'todos') : [rol];
  const enEjecucion = store.state.cases.filter((c) => c.running);
  return `
  <section class="wrap" aria-labelledby="ban-title">
    <p class="eyebrow">Bandeja de trabajo · sin control de acceso por cargo</p>
    <h1 id="ban-title" tabindex="-1">${esc(ROLES[rol].modulo)}</h1>
    <div class="btn-row">
      <button class="btn" type="button" data-action="reloj-todos" data-h="1">Simular +1 h hábil de espera en las colas</button>
      <a class="btn ghost" href="#/inicio">Iniciar un caso</a>
    </div>
    ${roles.map((r) => bandejaDe(r, rol === 'todos')).join('')}
    ${enEjecucion.length ? `<h2 class="h3">Plataforma (automático) · ejecutando</h2><ul>${enEjecucion.map((c) => `<li><a href="#/caso/${c.id}">${c.id}</a> · ${esc(tareaActualTexto(c))}</li>`).join('')}</ul>` : ''}
  </section>`;
}

function bandejaDe(rol, agrupado) {
  const pol = store.politica();
  const cola = store.state.cases.filter((c) => esperandoHumano(c) && rolDeTarea(c) === rol)
    .sort((a, b) => (estadoSLA(b, pol).ratio ?? 0) - (estadoSLA(a, pol).ratio ?? 0));
  const titulo = agrupado ? `<h2 class="h3">${esc(ROLES[rol].modulo)} <span class="chip sm">${cola.length}</span></h2>` : `<p class="muted">${cola.length} caso(s) en cola · ordenados por SLA (más urgente primero)</p>`;
  if (!cola.length) return `${titulo}<p class="muted small">Sin tareas pendientes.</p>`;
  return `${titulo}<div class="table-wrap"><table class="queue">
    <thead><tr><th scope="col">Folio</th><th scope="col">Solicitante (ficticio)</th><th scope="col">Tarea</th><th scope="col">Nivel</th><th scope="col">Monto</th><th scope="col">SLA de la etapa</th><th scope="col">Acción principal</th></tr></thead>
    <tbody>${cola.map((c) => `<tr><th scope="row">${c.id}</th><td>${esc(c.solicitante.nombre)}<br><span class="small muted">${c.canal === 'digital' ? 'Digital' : 'Agencia'} · ${esc(perfilTxt(c.perfil))}</span></td>
      <td class="small">${esc(tareaActualTexto(c))}</td><td>${chipNivel(c.data.decision?.nivel)}</td><td>${usd(c.monto)}</td><td>${badgeSLA(c)}</td>
      <td><a class="btn primary sm" href="#/caso/${c.id}" data-action="atender" data-rol="${rol}">${accionPrincipal(c)}</a></td></tr>`).join('')}</tbody>
  </table></div>`;
}

function accionPrincipal(c) {
  if (c.subestado === 'confirmar-campos') return 'Confirmar campos';
  return { B_T1: 'Registrar solicitud', B_T5: 'Cargar documentos', B_T5b: 'Corregir documentos', B_T10: 'Analizar alerta', B_T12a: 'Revisar ingresos', B_T12b: 'Evaluar expediente', B_T13: 'Resolver', B_T15: 'Firmar documentos', B_T16: 'Validar checklist' }[c.node] || 'Abrir';
}

/* ================================================================ Auditoría */
function vistaAuditoria(q) {
  const caso = q.get('caso') || '';
  const tipo = q.get('tipo') || '';
  const log = store.state.auditLog.filter((e) => (!caso || e.casoId === caso) && (!tipo || e.tipo === tipo));
  const tipos = [...new Set(store.state.auditLog.map((e) => e.tipo))];
  return `
  <section class="wrap" aria-labelledby="aud-title">
    <p class="eyebrow">Trazabilidad · registro append-only con hash encadenado</p>
    <h1 id="aud-title" tabindex="-1">Registro de auditoría</h1>
    <div class="card row-form">
      <label>Caso<select data-nav="aud" name="caso"><option value="">Todos</option>${store.state.cases.map((c) => `<option ${c.id === caso ? 'selected' : ''}>${c.id}</option>`).join('')}</select></label>
      <label>Tipo<select data-nav="aud" name="tipo"><option value="">Todos</option>${tipos.map((t) => `<option ${t === tipo ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <div class="btn-row">
        <button class="btn" type="button" data-action="export-json">Exportar JSON</button>
        <button class="btn" type="button" data-action="export-csv">Exportar CSV</button>
        <button class="btn ghost" type="button" data-action="verificar">Verificar integridad</button>
      </div>
      <p class="small" data-verif aria-live="polite"></p>
    </div>
    <p class="muted small">${log.length} evento(s). Cada evento registra fecha y hora, reloj del caso, módulo/rol, tarea, dato antes y después, versión de la regla y evidencia.</p>
    <div class="table-wrap"><table class="audit">
      <thead><tr><th scope="col">#</th><th scope="col">Fecha y hora</th><th scope="col">Reloj</th><th scope="col">Caso</th><th scope="col">Módulo / rol</th><th scope="col">Tarea</th><th scope="col">Acción</th><th scope="col">Antes → después</th><th scope="col">Versión de la regla</th><th scope="col">Evidencia</th><th scope="col">Hash</th></tr></thead>
      <tbody>${log.slice(-400).reverse().map((e) => `<tr class="t-${esc(e.tipo)}"><td>${e.seq}</td><td class="nowrap small">${fechaHora(e.ts)}</td><td class="small">${e.relojH == null ? '—' : `${num(e.relojH, 2)} h`}</td><td>${e.casoId ? `<a href="#/caso/${e.casoId}">${e.casoId}</a>` : '—'}</td><td class="small">${esc(e.rol)}</td><td class="small">${esc(e.tareaId || '')}<br>${esc(e.tarea || '')}</td><td>${esc(e.accion)}</td>
        <td class="small">${e.antes != null || e.despues != null ? `<details><summary>${esc(jsonCorto(e.despues))}</summary><p><strong>Antes:</strong> <code>${esc(JSON.stringify(e.antes))}</code></p><p><strong>Después:</strong> <code>${esc(JSON.stringify(e.despues))}</code></p></details>` : '—'}</td>
        <td class="small">${esc(e.reglaVersion || '—')}</td><td class="small">${esc(e.evidencia || '—')}</td><td class="small mono">${e.hash}</td></tr>`).join('')}</tbody>
    </table></div>
    ${log.length > 400 ? '<p class="small muted">Se muestran los 400 eventos más recientes; la exportación incluye todos.</p>' : ''}
  </section>`;
}

function filtrados() {
  const q = ruta().q;
  const caso = q.get('caso'); const tipo = q.get('tipo');
  return store.state.auditLog.filter((e) => (!caso || e.casoId === caso) && (!tipo || e.tipo === tipo));
}

/* ================================================================ Tablero */
function vistaTablero() {
  const s = store.state;
  const sesion = s.cases.filter((c) => c.sesionId === s.sesionId);
  const fines = Object.fromEntries(Object.keys(EVENTOS).filter((k) => EVENTOS[k].tipo === 'endEvent').map((k) => [k, sesion.filter((c) => c.fin?.id === k).length]));
  const niveles = Object.fromEntries(Object.keys(NIVELES).map((n) => [n, sesion.filter((c) => c.data.decision?.nivel === n).length]));
  const desemb = sesion.filter((c) => c.fin?.id === 'B_EF');
  const prom = desemb.length ? desemb.reduce((a, c) => a + relojTotal(c), 0) / desemb.length : null;
  const pol = store.politica();
  const vencidos = sesion.filter((c) => estadoSLA(c, pol).estado === 'rojo').length;
  const maxN = Math.max(...RUTAS_1500.niveles.map((n) => n.valor));
  return `
  <section class="wrap" aria-labelledby="tab-title">
    <p class="eyebrow">Resultados del análisis</p>
    <h1 id="tab-title" tabindex="-1">Tablero</h1>

    <h2>Estimación del diseño TO-BE <span class="tag tag-warn">No son mediciones (S-11)</span></h2>
    <div class="tiles">${ESTIMACIONES.map((e) => {
      const f = (x) => (e.unidad === '%' ? pct(x) : num(x, e.asis % 1 ? 2 : 0));
      const delta = (e.tobe - e.asis) / e.asis;
      return `<article class="tile"><h3 class="h4">${esc(e.indicador)}</h3><p class="tile-val"><span class="muted">${f(e.asis)}</span> <span aria-hidden="true">→</span><span class="sr-only">pasa a</span> <strong>${f(e.tobe)}</strong></p><p class="small">${[e.unidad === '%' ? '' : esc(e.unidad), `${delta > 0 ? '+' : ''}${pct(delta, 0)}`, `<span class="muted">${esc(e.fuente)}</span>`].filter(Boolean).join(' · ')}</p></article>`;
    }).join('')}</div>

    <div class="grid2">
      <section class="card" aria-labelledby="r1">
        <h3 id="r1" class="h4">Rutas de cada 1.500 solicitudes al mes · canal</h3>
        ${barras(RUTAS_1500.canales, 1500)}
      </section>
      <section class="card" aria-labelledby="r2">
        <h3 id="r2" class="h4">Rutas de cada 1.500 solicitudes al mes · nivel de decisión</h3>
        ${barras(RUTAS_1500.niveles, maxN)}
        <p class="small muted">No llegan a decisión: ${RUTAS_1500.noLleganADecision}. ${esc(RUTAS_1500.fuente)}.</p>
      </section>
    </div>

    <h2>Contador en vivo · sesión del demo <span class="tag">No es una estimación</span></h2>
    <p class="muted small">Cuenta solo los expedientes creados en esta sesión del navegador (${sesion.length} de ${s.cases.length} guardados).</p>
    <div class="tiles">
      <article class="tile"><h3 class="h4">Expedientes creados</h3><p class="tile-val"><strong>${sesion.length}</strong></p><p class="small">${sesion.filter((c) => c.status === 'abierto').length} abiertos · ${sesion.filter((c) => c.canal === 'digital').length} digitales · ${sesion.filter((c) => c.canal === 'agencia').length} en agencia</p></article>
      <article class="tile"><h3 class="h4">Desembolsados</h3><p class="tile-val"><strong>${desemb.length}</strong></p><p class="small">Reloj promedio: ${prom == null ? '—' : `${horas(prom)} (${num(aDias(prom), 2)} días)`}</p></article>
      <article class="tile"><h3 class="h4">SLA vencidos (abiertos)</h3><p class="tile-val"><strong>${vencidos}</strong></p><p class="small">Semáforo: ámbar desde ${pct(pol.valores.slaAmbar, 0)} del tiempo de diseño</p></article>
      <article class="tile"><h3 class="h4">Decisiones automáticas (N0 + N1)</h3><p class="tile-val"><strong>${niveles.N0 + niveles.N1}</strong></p><p class="small">de ${Object.values(niveles).reduce((a, b) => a + b, 0)} decisiones DMN</p></article>
    </div>
    <div class="grid2">
      <div class="card"><h3 class="h4">Por fin del proceso</h3><div class="table-wrap"><table><tbody>${Object.entries(fines).map(([k, n]) => `<tr><th scope="row">${esc(EVENTOS[k].nombre)}</th><td class="num">${n}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="card"><h3 class="h4">Por nivel DMN</h3><div class="table-wrap"><table><tbody>${Object.entries(niveles).map(([k, n]) => `<tr><th scope="row">${chipNivel(k)} ${esc(NIVELES[k])}</th><td class="num">${n}</td></tr>`).join('')}</tbody></table></div></div>
    </div>
    <p class="small muted">Referencia de diseño por nivel y canal (tabla 12, horas): ${Object.entries(TABLA12).map(([n, v]) => `${n} agencia ${num(v.agencia, 2)} · digital ${num(v.digital, 2)}`).join(' | ')}.</p>
  </section>`;
}

function barras(items, max) {
  return `<ul class="bars">${items.map((i) => `<li><span class="bar-label">${esc(i.etiqueta)}</span><span class="bar-track" aria-hidden="true"><span class="bar" style="width:${(i.valor / max) * 100}%"></span></span><span class="bar-val">${num(i.valor, 0)}</span></li>`).join('')}</ul>`;
}

/* ================================================================ eventos */
function casoDeRuta() {
  const r = ruta();
  return r.nombre === 'caso' ? r.arg : null;
}

main.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const a = btn.dataset.action;
  switch (a) {
    case 'caso-pre': {
      const k = CASOS.find((x) => x.n === Number(btn.dataset.n));
      const c = engine.crearCaso(k, { sesionId: store.state.sesionId });
      location.hash = `#/caso/${c.id}`;
      anunciar(`Expediente ${c.id} creado en la tarea 1.1.`);
      return;
    }
    case 'nueva': {
      const canal = btn.dataset.canal;
      const c = engine.crearCaso({ canal, solicitante: { nombre: '', cedula: 'FICT-' }, perfil: 'DEP_IESS', monto: 5000, plazo: 36, ingresoDeclarado: 800, escenario: escenarioNuevo(), titulo: `Nueva solicitud (${canal})` }, { sesionId: store.state.sesionId });
      location.hash = `#/caso/${c.id}`;
      return;
    }
    case 'ir-modulo': case 'atender':
      store.setPref('rol', btn.dataset.rol);
      document.getElementById('rol').value = btn.dataset.rol;
      if (a === 'ir-modulo' && btn.tagName !== 'A' && !casoDeRuta()) location.hash = '#/bandeja';
      return;
    case 'reloj-todos': {
      const n = engine.avanzarReloj(Number(btn.dataset.h));
      anunciar(`Reloj simulado +1 h en ${n} caso(s) en espera.`);
      return;
    }
    case 'export-json':
      descargar(`auditoria_P-03.1_${Date.now()}.json`, aJSON(filtrados(), { politicaVigente: store.versionActual() }), 'application/json');
      return;
    case 'export-csv':
      descargar(`auditoria_P-03.1_${Date.now()}.csv`, aCSV(filtrados()), 'text/csv;charset=utf-8');
      return;
    case 'verificar': {
      const roto = audit.verificar();
      main.querySelector('[data-verif]').textContent = roto == null ? `Cadena íntegra: ${store.state.auditLog.length} eventos verificados.` : `Cadena alterada desde el evento #${roto}.`;
      return;
    }
    case 'borrador-crear': crearBorrador(); return;
    case 'borrador-descartar': descartarBorrador(); return;
    case 'reiniciar':
      if (confirm('¿Reiniciar el demo? Se borran casos, auditoría y versiones de política.')) { store.reiniciar(); location.hash = '#/inicio'; render(true); }
      return;
    default:
      if (casoDeRuta()) accionCaso(a, btn, casoDeRuta());
  }
});

main.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  if (form.dataset.form === 'sim') return;
  if (form.dataset.form === 'borrador') { publicarBorrador(form); return; }
  const btns = form.querySelectorAll('button[type="submit"]');
  btns.forEach((b) => { b.disabled = true; });
  enviarFormulario(form, e.submitter, casoDeRuta()).finally(() => btns.forEach((b) => { if (document.body.contains(b)) b.disabled = false; }));
});

function onCambio(e) {
  const t = e.target;
  if (t.closest('form[data-form="sim"]')) return correrSimulador();
  const draft = t.closest('form[data-form="borrador"]');
  if (draft && (t.dataset.param || t.dataset.cond || t.dataset.req || t.dataset.t)) return actualizarBorrador(draft);
  if (t.dataset.pref && e.type === 'change') return store.setPref(t.dataset.pref, t.checked);
  if (t.dataset.nav === 'dmn-caso' && e.type === 'change') { location.hash = `#/dmn${t.value ? `?caso=${t.value}` : ''}`; return; }
  if (t.dataset.nav === 'aud' && e.type === 'change') {
    const q = new URLSearchParams();
    main.querySelectorAll('[data-nav="aud"]').forEach((s) => { if (s.value) q.set(s.name, s.value); });
    location.hash = `#/auditoria${q.toString() ? `?${q}` : ''}`;
    return;
  }
  if (casoDeRuta()) onInputCaso(e, casoDeRuta());
}
main.addEventListener('input', onCambio);
main.addEventListener('change', onCambio);

/* ================================================================ shell */
const selRol = document.getElementById('rol');
selRol.innerHTML = Object.entries(ROLES).map(([k, r]) => `<option value="${k}">${esc(r.corto)}</option>`).join('');
selRol.value = store.state.prefs.rol;
selRol.addEventListener('change', () => { store.setPref('rol', selRol.value); if (ruta().nombre !== 'caso') location.hash = '#/bandeja'; });

function aplicarTema() {
  const t = store.state.prefs.tema;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
  const btn = document.getElementById('tema');
  btn.textContent = { auto: 'Tema: automático', light: 'Tema: claro', dark: 'Tema: oscuro' }[t];
}
document.getElementById('tema').addEventListener('click', () => {
  const orden = ['auto', 'light', 'dark'];
  store.setPref('tema', orden[(orden.indexOf(store.state.prefs.tema) + 1) % 3]);
  aplicarTema();
});
aplicarTema();

store.subscribe(programar);
window.addEventListener('hashchange', () => render());
render(true);
engine.reanudar();

// Vistas "Tablas DMN" (consulta + simulador) y "Módulo de Parametrización de Riesgos"
// (borrador → validación → impacto → publicación versionada con bitácora).
import { PERFILES, DOCUMENTOS, PARAMETROS_DEF, MODULO_RIESGOS, NIVELES } from './data.js';
import * as dmn from './dmn.js';
import { ctx, esc, usd, pct, num, fechaHora, chipNivel, anunciar } from './ui.common.js';

const DOCS_INGRESO = ['CERT', 'REM', 'XML', 'NV'];
const ORIGEN = {
  analisis: '<span class="tag tag-ok">Valor del análisis</span>',
  prompt: '<span class="tag tag-warn">Parámetro configurable · no definido en el análisis</span>',
  demo: '<span class="tag tag-warn">Parámetro configurable · no definido en el análisis (requerido por el demo)</span>',
};
const fmtValor = (def, x) => (def.tipo === 'pct' ? pct(x) : def.tipo === 'usd' ? usd(x) : num(x, 0));
const combin = (r) => (r.combinador === 'ANY' ? 'ALGUNA de' : 'TODAS');

/* ================================================================ DMN */
export function firmaDmn(q) {
  const s = ctx.store.state;
  return `dmn:${ctx.store.politica().version}:${q.get('caso') || ''}:${s.cases.filter((c) => c.data.decision || c.data.precalificacion).length}:${!!s.borrador}`;
}

export function vistaDmn(q) {
  const pol = ctx.store.politica();
  const casos = ctx.store.state.cases.filter((c) => c.data.precalificacion);
  const sel = casos.find((c) => c.id === q.get('caso')) || null;
  const hitP = sel?.data.precalificacion?.reglaId;
  const hitD = sel?.data.decision?.reglaId;
  const v = pol.valores;
  return `
  <section class="wrap" aria-labelledby="dmn-title">
    <p class="eyebrow">Plataforma · DMN</p>
    <h1 id="dmn-title" tabindex="-1">Tablas de decisión (DMN)</h1>
    <p>${esc(dmn.etiquetaVersion(pol))} · publicada ${fechaHora(pol.publicadaEn)} · <a href="#/parametros">Parametrizar en el ${esc(MODULO_RIESGOS)}</a></p>
    <div class="card row-form">
      <label>Resaltar la regla aplicada a un caso
        <select data-nav="dmn-caso"><option value="">— Ninguno —</option>${casos.map((c) => `<option value="${c.id}" ${c === sel ? 'selected' : ''}>${c.id} · ${esc(c.titulo)}${c.data.decision ? ` · ${c.data.decision.nivel}` : ''}</option>`).join('')}</select>
      </label>
      ${sel ? `<p class="small">Caso ${esc(sel.id)}: 1.3 → ${esc(hitP)}${hitD ? ` · 3.1 → ${esc(hitD)} (${chipNivel(sel.data.decision.nivel)})` : ''} · versión aplicada: ${esc(sel.data.decision?.version || sel.data.precalificacion.version)}</p>` : ''}
    </div>

    <h2>1.3 Precalificación <span class="muted small">· hit policy FIRST</span></h2>
    <div class="table-wrap"><table class="dmn">
      <thead><tr><th scope="col">Regla</th><th scope="col">Condición</th><th scope="col">Salida</th><th scope="col">Fuente</th></tr></thead>
      <tbody>${dmn.REGLAS_PRECALIFICACION.map((r) => `<tr class="${r.id === hitP ? 'hit' : ''}"><th scope="row">${r.id}${r.id === hitP ? ' <span class="chip sm">aplicada</span>' : ''}</th><td>${conds(r, pol)}</td><td>${esc(r.salida)}</td><td class="small">${esc(r.fuente)}</td></tr>`).join('')}</tbody>
    </table></div>

    <h2>1.4 Requisitos documentales <span class="muted small">· hit policy COLLECT</span></h2>
    <div class="table-wrap"><table class="dmn">
      <thead><tr><th scope="col">Perfil (% de solicitantes)</th>${DOCS_INGRESO.map((d) => `<th scope="col">${esc(DOCUMENTOS[d])}</th>`).join('')}<th scope="col">¿En fuente?</th></tr></thead>
      <tbody>${Object.entries(PERFILES).map(([k, p]) => `<tr class="${sel?.perfil === k ? 'hit' : ''}"><th scope="row">${esc(p.etiqueta)} (${pct(p.pct)})</th>${DOCS_INGRESO.map((d) => `<td class="c">${(pol.requisitos[k] || []).includes(d) ? '✓<span class="sr-only"> requerido</span>' : '<span class="muted">—</span>'}</td>`).join('')}<td>${p.enFuente ? 'Sí' : 'No'}</td></tr>`).join('')}
      <tr class="${sel && sel.monto >= v.patrimonioDesde ? 'hit' : ''}"><th scope="row">Cualquier perfil con monto ≥ ${usd(v.patrimonioDesde)}</th><td colspan="5">+ ${esc(DOCUMENTOS.PAT)}</td></tr></tbody>
    </table></div>

    <h2>3.1 Decisión N0–N4 <span class="muted small">· hit policy FIRST · orden ${dmn.ORDEN_FIRST.join(', ')}</span></h2>
    <div class="table-wrap"><table class="dmn">
      <thead><tr><th scope="col">#</th><th scope="col">Regla</th><th scope="col">Se cumple si…</th><th scope="col">Nivel</th><th scope="col">Revisión humana</th><th scope="col">Fuente</th></tr></thead>
      <tbody>${dmn.REGLAS_DECISION.map((r, k) => `<tr class="${r.id === hitD ? 'hit' : ''} ${r.porDefecto ? 'def' : ''}"><td>${k + 1}</td><th scope="row">${r.id}${r.id === hitD ? ' <span class="chip sm">aplicada</span>' : ''}<br><span class="small">${esc(r.nombre)}</span></th><td><span class="small muted">${combin(r)}:</span>${conds(r, pol, sel?.data.decision)}</td><td>${chipNivel(r.salida)}</td><td class="small">${esc(r.revision)}</td><td class="small">${esc(r.fuente)}</td></tr>`).join('')}</tbody>
    </table></div>
    ${sel?.data.decision ? `<p class="note"><strong>Explicación para ${esc(sel.id)}:</strong> ${esc(sel.data.decision.explicacion)}</p>` : ''}

    ${simulador(pol, sel)}
  </section>`;
}

function conds(r, pol, res) {
  const tr = res?.traza.find((t) => t.reglaId === r.id);
  return `<ul class="conds">${r.condiciones.map((c) => {
    const activa = dmn.condicionActiva(pol, c);
    const t = tr?.condiciones.find((x) => x.id === c.id);
    const marca = t ? (t.activa ? (t.cumple ? '<span class="yes">✓</span> ' : '<span class="no">✗</span> ') : '○ ') : '';
    return `<li class="${activa ? '' : 'off'}">${marca}${esc(c.texto(pol.valores))}${activa ? '' : ' <span class="tag">inactiva</span>'}${c.bloqueada ? ' <span class="tag" title="' + esc(c.bloqueada) + '">fija</span>' : ''}</li>`;
  }).join('')}</ul>`;
}

const SIM_CAMPOS = [
  ['score', 'Score de buró', 'number', 820], ['mesesDesdeUltimaMora', 'Meses desde última mora (vacío = nunca)', 'number', ''],
  ['monto', 'Monto (USD)', 'number', 6000], ['cuota', 'Cuota mensual (USD)', 'number', 208], ['ingresoEvaluado', 'Ingreso evaluado (USD)', 'number', 743],
];
const SIM_FLAGS = [
  ['moraVigente', 'Mora vigente'], ['ingresoEnFuente', 'Ingreso verificado en fuente', true], ['identidadOk', 'Identidad sin alerta', true],
  ['alertaListas', 'Alerta en listas'], ['coincidenciaConfirmada', 'Coincidencia confirmada'], ['patrimonioRequerido', 'Patrimonio requerido'],
  ['discrepanciasSoftware', 'Discrepancias del software'], ['fueraDePolitica', 'Fuera de política'], ['excepcionPolitica', 'Excepción a la política'],
];

function simulador(pol, sel) {
  const base = sel?.data.decision?.input;
  const val = (k, d) => (base ? (base[k] ?? '') : d);
  return `
  <section class="card" aria-labelledby="sim-title">
    <h2 id="sim-title" class="h3">Simulador de la tabla 3.1</h2>
    <p class="small muted">Prueba entradas y ve qué regla se aplica y por qué. ${sel?.data.decision ? `Precargado con el caso ${esc(sel.id)}.` : ''}</p>
    <form data-form="sim" class="sim" novalidate>
      <div class="grid3">${SIM_CAMPOS.map(([k, l, t, d]) => `<label>${l}<input name="${k}" type="${t}" value="${esc(val(k, d))}"></label>`).join('')}
        <label>Evaluar con<select name="pol"><option value="pub">Política publicada v${esc(pol.version)}</option>${ctx.store.state.borrador ? '<option value="draft">Borrador en edición</option>' : ''}</select></label>
      </div>
      <div class="flags">${SIM_FLAGS.map(([k, l, d]) => `<label class="check"><input type="checkbox" name="${k}" ${(base ? base[k] : d) ? 'checked' : ''}> ${l}</label>`).join('')}</div>
    </form>
    <div data-sim-out aria-live="polite"></div>
  </section>`;
}

export function correrSimulador() {
  const form = document.querySelector('form[data-form="sim"]');
  const out = document.querySelector('[data-sim-out]');
  if (!form || !out) return;
  const f = Object.fromEntries(new FormData(form).entries());
  const n = (k) => Number(f[k]);
  const input = {
    score: n('score'), mesesDesdeUltimaMora: f.mesesDesdeUltimaMora === '' ? null : n('mesesDesdeUltimaMora'), monto: n('monto'), cuota: n('cuota'), ingresoEvaluado: n('ingresoEvaluado'),
    ...Object.fromEntries(SIM_FLAGS.map(([k]) => [k, !!f[k]])),
  };
  if (!(input.ingresoEvaluado > 0)) { out.innerHTML = '<p class="form-error">El ingreso evaluado debe ser mayor que 0.</p>'; return; }
  const pol = f.pol === 'draft' && ctx.store.state.borrador ? ctx.store.state.borrador : ctx.store.politica();
  const r = dmn.evaluarDecision(input, pol);
  out.innerHTML = `<p class="sim-result">${chipNivel(r.nivel)} <strong>${esc(NIVELES[r.nivel])}</strong> · regla ${esc(r.reglaId)} · cuota/ingreso ${pct(r.ratio)} · buró ${esc(r.categoriaBuro)}</p><p>${esc(r.explicacion)}</p><p class="small muted">${esc(r.version)}${f.pol === 'draft' ? ' (borrador)' : ''}</p>
    <div class="table-wrap"><table class="trace"><tbody>${r.traza.map((t) => `<tr class="${t.reglaId === r.reglaId ? 'hit' : ''}"><th scope="row">${t.reglaId}</th><td><ul class="conds">${t.condiciones.map((c) => `<li class="${c.activa ? (c.cumple ? 'yes' : 'no') : 'off'}">${c.activa ? (c.cumple ? '✓' : '✗') : '○'} ${esc(c.texto)}</li>`).join('')}</ul></td><td>${t.cumple ? 'Sí' : 'No'}</td></tr>`).join('')}</tbody></table></div>`;
}

/* ================================================================ Parametrización */
export function firmaParametros() {
  const s = ctx.store.state;
  return `par:${s.politicas.length}:${!!s.borrador}:${s.prefs.persistir}:${s.cases.length}`;
}

export function vistaParametros() {
  const s = ctx.store.state;
  const pol = ctx.store.politica();
  const b = s.borrador;
  return `
  <section class="wrap" aria-labelledby="par-title">
    <p class="eyebrow">Gobierno de reglas · dueño MP.02 Riesgos (RACI: Directorio A/R para modificar scorecard, reglas DMN y política)</p>
    <h1 id="par-title" tabindex="-1">${esc(MODULO_RIESGOS)}</h1>
    <p>Los cambios se hacen en un <strong>borrador</strong>, se validan, se simula su impacto y se <strong>publican</strong> como nueva versión con justificación. Las decisiones ya tomadas conservan la versión con la que se evaluaron. El orden FIRST (N0, N4, N1, N2, N3) y la estructura de las reglas los fija el análisis.</p>

    <section class="card" aria-labelledby="ver-title">
      <h2 id="ver-title" class="h3">Versión vigente: ${esc(dmn.etiquetaVersion(pol))}</h2>
      <div class="table-wrap"><table>
        <thead><tr><th scope="col">Versión</th><th scope="col">Publicada</th><th scope="col">Autor</th><th scope="col">Justificación</th><th scope="col">Cambios</th></tr></thead>
        <tbody>${s.politicas.map((p, k) => {
          const cambios = k ? dmn.diffPolitica(s.politicas[k - 1], p) : [];
          return `<tr><th scope="row">v${esc(p.version)}${k === s.politicas.length - 1 ? ' <span class="chip sm">vigente</span>' : ''}</th><td>${fechaHora(p.publicadaEn)}</td><td>${esc(p.autor)}</td><td>${esc(p.justificacion)}</td>
            <td>${k ? `<details><summary>${cambios.length} cambio(s)</summary>${tablaCambios(cambios)}</details>` : 'Línea base'}</td></tr>`;
        }).reverse().join('')}</tbody>
      </table></div>
      ${b ? '' : `<button class="btn primary" type="button" data-action="borrador-crear">Crear borrador a partir de v${esc(pol.version)}</button>`}
    </section>

    ${b ? editor(b) : ''}

    <section class="card" aria-labelledby="pref-title">
      <h2 id="pref-title" class="h3">Preferencias del demo</h2>
      <label class="check"><input type="checkbox" data-pref="persistir" ${s.prefs.persistir ? 'checked' : ''}> Guardar casos, auditoría y políticas en este navegador (localStorage)</label>
      <p class="small muted">Si el navegador bloquea el almacenamiento, el demo sigue funcionando en memoria.</p>
      <button class="btn danger" type="button" data-action="reiniciar">Reiniciar demo (borra casos, auditoría y versiones)</button>
    </section>
  </section>`;
}

function tablaCambios(cambios) {
  if (!cambios.length) return '<p class="small muted">Sin cambios.</p>';
  return `<div class="table-wrap"><table class="small"><thead><tr><th scope="col">Elemento</th><th scope="col">Antes</th><th scope="col">Después</th></tr></thead><tbody>${cambios.map((c) => `<tr><td>${esc(c.campo)}</td><td>${esc(typeof c.antes === 'object' ? JSON.stringify(c.antes) : c.antes)}</td><td>${esc(typeof c.despues === 'object' ? JSON.stringify(c.despues) : c.despues)}</td></tr>`).join('')}</tbody></table></div>`;
}

const ETQ_TIEMPOS = {
  captura: 'Captura y precalificación', validacion: 'Validación documental', instrumentacion: 'Instrumentación',
  instrumentacionN1: 'Instrumentación con aprobación directa (N1)', desembolso: 'Desembolso',
  revision: 'Revisión del analista', aprobacion: 'Aprobación', reproceso: 'Reproceso por devolución',
};

function editor(b) {
  const grupos = [...new Set(PARAMETROS_DEF.map((p) => p.grupo))];
  const cond = (r) => r.condiciones.map((c) => `<label class="check ${c.bloqueada ? 'locked' : ''}"><input type="checkbox" data-cond="${c.id}" ${dmn.condicionActiva(b, c) ? 'checked' : ''} ${c.bloqueada ? 'disabled' : ''}> ${esc(c.texto(b.valores))}${c.bloqueada ? ` <span class="small muted">(fija: ${esc(c.bloqueada)})</span>` : ''}</label>`).join('');
  return `
  <form class="card draft" data-form="borrador" novalidate aria-labelledby="draft-title">
    <h2 id="draft-title" class="h3">Borrador v${esc(dmn.siguienteVersion(ctx.store.politica().version))} <span class="chip sm warn">en edición</span></h2>

    <fieldset><legend>1 · Umbrales y valores de la política</legend>
      ${grupos.map((g) => `<h3 class="h4">${esc(g)}</h3><div class="params">${PARAMETROS_DEF.filter((p) => p.grupo === g).map((p) => `
        <label class="param"><span>${esc(p.etiqueta)}</span>
          <span class="inp"><input type="number" step="${p.tipo === 'pct' ? '0.1' : '1'}" min="0" data-param="${p.id}" value="${p.tipo === 'pct' ? Math.round(b.valores[p.id] * 1000) / 10 : b.valores[p.id]}">${p.tipo === 'pct' ? '<span>%</span>' : p.tipo === 'usd' ? '<span>USD</span>' : ''}</span>
          <span>${ORIGEN[p.origen]}${p.fuente ? ` <span class="small muted">${esc(p.fuente)}</span>` : ''}</span>
        </label>`).join('')}</div>`).join('')}
    </fieldset>

    <fieldset><legend>2 · Condiciones de las reglas (activar / desactivar)</legend>
      <p class="small muted">Una condición inactiva no se evalúa. Una regla sin condiciones activas nunca se aplica.</p>
      <h3 class="h4">1.3 Precalificación</h3>
      ${dmn.REGLAS_PRECALIFICACION.map((r) => `<div class="rule"><p><strong>${r.id}</strong> → ${esc(r.salida)} <span class="small muted">(${combin(r)})</span></p>${cond(r)}</div>`).join('')}
      <h3 class="h4">3.1 Decisión N0–N4</h3>
      ${dmn.REGLAS_DECISION.map((r) => `<div class="rule"><p><strong>${r.id}</strong> → ${chipNivel(r.salida)} ${esc(r.nombre)} <span class="small muted">(${combin(r)})</span></p>${cond(r)}</div>`).join('')}
    </fieldset>

    <fieldset><legend>3 · DMN de requisitos: documentos de ingreso por perfil</legend>
      <div class="table-wrap"><table class="dmn"><thead><tr><th scope="col">Perfil</th>${DOCS_INGRESO.map((d) => `<th scope="col">${esc(DOCUMENTOS[d])}</th>`).join('')}</tr></thead>
      <tbody>${Object.entries(PERFILES).map(([k, p]) => `<tr><th scope="row">${esc(p.etiqueta)}</th>${DOCS_INGRESO.map((d) => `<td class="c"><input type="checkbox" aria-label="${esc(p.etiqueta)}: ${esc(DOCUMENTOS[d])}" data-req="${k}|${d}" ${(b.requisitos[k] || []).includes(d) ? 'checked' : ''}></td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="small muted">Bienes y patrimonio se exigen por monto (umbral en la sección 1).</p>
    </fieldset>

    <fieldset><legend>4 · Tiempos de diseño y SLA (Excel, tablas 9, 10 y 11)</legend>
      <div class="table-wrap"><table><thead><tr><th scope="col">Etapa</th><th scope="col">Variante</th><th scope="col">Ejecución (min)</th><th scope="col">Espera (h)</th><th scope="col">Fuente</th></tr></thead><tbody>
      ${Object.entries(b.tiempos).flatMap(([k, t]) => Object.entries(t).filter(([v]) => v !== 'fuente').map(([v, par]) => `<tr><th scope="row">${esc(ETQ_TIEMPOS[k])}</th><td>${esc(v)}</td>
        <td><input type="number" min="0" step="1" aria-label="${esc(ETQ_TIEMPOS[k])} ${esc(v)} ejecución" data-t="${k}|${v}|0" value="${par[0]}"></td>
        <td><input type="number" min="0" step="0.5" aria-label="${esc(ETQ_TIEMPOS[k])} ${esc(v)} espera" data-t="${k}|${v}|1" value="${par[1]}"></td><td class="small">${esc(t.fuente)}</td></tr>`)).join('')}
      </tbody></table></div>
    </fieldset>

    <div id="draft-status" aria-live="polite">${estadoBorrador()}</div>

    <fieldset><legend>5 · Publicar</legend>
      <div class="grid2">
        <label>Autor<input name="autor" value="Riesgos MP.02 (demo)"></label>
        <label>Justificación del cambio (obligatoria)<textarea name="justificacion" rows="2"></textarea></label>
      </div>
      <p class="form-error" role="alert" data-error hidden></p>
      <div class="btn-row">
        <button class="btn primary" type="submit">Publicar nueva versión</button>
        <button class="btn" type="button" data-action="borrador-descartar">Descartar borrador</button>
      </div>
    </fieldset>
  </form>`;
}

export function estadoBorrador() {
  const b = ctx.store.state.borrador;
  if (!b) return '';
  const pol = ctx.store.politica();
  const { errores, advertencias } = dmn.validarPolitica(b);
  const cambios = dmn.diffPolitica(pol, b);
  const impacto = ctx.store.state.cases.filter((c) => c.data.decision?.input).map((c) => {
    const nuevo = dmn.evaluarDecision(c.data.decision.input, b);
    return { c, antes: c.data.decision.nivel, despues: nuevo.nivel, regla: nuevo.reglaId };
  });
  const cambian = impacto.filter((i) => i.antes !== i.despues);
  return `
    <div class="status-grid">
      <div class="${errores.length ? 'note bad' : 'note ok'}"><strong>Validación:</strong> ${errores.length ? `${errores.length} error(es) bloquean la publicación` : 'sin errores'}
        ${errores.length ? `<ul>${errores.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
        ${advertencias.length ? `<p><strong>Advertencias:</strong></p><ul>${advertencias.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}</div>
      <div class="note"><strong>Cambios frente a v${esc(pol.version)}:</strong> ${cambios.length}${tablaCambios(cambios)}</div>
      <div class="note"><strong>Impacto en los casos de la sesión (3.1):</strong> ${impacto.length ? `${cambian.length} de ${impacto.length} cambiarían de nivel` : 'aún no hay casos con decisión'}
        ${cambian.length ? `<ul>${cambian.map((i) => `<li>${esc(i.c.id)}: ${chipNivel(i.antes)} → ${chipNivel(i.despues)} (${esc(i.regla)})</li>`).join('')}</ul>` : ''}</div>
    </div>`;
}

// Lee el formulario del borrador y actualiza el estado sin re-renderizar la vista.
export function actualizarBorrador(form) {
  const b = ctx.store.state.borrador;
  if (!b) return;
  form.querySelectorAll('[data-param]').forEach((i) => {
    const def = PARAMETROS_DEF.find((p) => p.id === i.dataset.param);
    const x = i.value === '' ? NaN : Number(i.value);
    b.valores[def.id] = def.tipo === 'pct' ? Math.round(x * 10) / 1000 : x;
  });
  form.querySelectorAll('[data-cond]').forEach((i) => { if (!i.disabled) b.condiciones[i.dataset.cond] = i.checked; });
  const req = {};
  for (const k of Object.keys(PERFILES)) req[k] = [];
  form.querySelectorAll('[data-req]').forEach((i) => { const [p, d] = i.dataset.req.split('|'); if (i.checked) req[p].push(d); });
  b.requisitos = req;
  form.querySelectorAll('[data-t]').forEach((i) => { const [k, v, ix] = i.dataset.t.split('|'); b.tiempos[k][v][Number(ix)] = i.value === '' ? NaN : Number(i.value); });
  document.getElementById('draft-status').innerHTML = estadoBorrador();
  ctx.store.emit({ borrador: true });
}

export function crearBorrador() {
  const pol = ctx.store.politica();
  ctx.store.state.borrador = { ...JSON.parse(JSON.stringify(pol)), estado: 'borrador', version: dmn.siguienteVersion(pol.version) };
  ctx.audit.registrar({ rol: MODULO_RIESGOS, accion: `Borrador creado a partir de v${pol.version}`, reglaVersion: dmn.etiquetaVersion(pol), tipo: 'politica' });
  ctx.store.emit({ borrador: true });
}

export function descartarBorrador() {
  ctx.store.state.borrador = null;
  ctx.audit.registrar({ rol: MODULO_RIESGOS, accion: 'Borrador descartado', tipo: 'politica' });
  ctx.store.emit({ borrador: true });
}

export function publicarBorrador(form) {
  const b = ctx.store.state.borrador;
  const errBox = form.querySelector('[data-error]');
  const f = Object.fromEntries(new FormData(form).entries());
  const { errores } = dmn.validarPolitica(b);
  const fallo = (m) => { errBox.hidden = false; errBox.textContent = m; anunciar(m); };
  if (errores.length) return fallo('Corrige los errores de validación antes de publicar.');
  if (!f.justificacion?.trim()) return fallo('La justificación es obligatoria (control documental).');
  const prev = ctx.store.politica();
  const cambios = dmn.diffPolitica(prev, b);
  if (!cambios.length) return fallo('El borrador no tiene cambios frente a la versión vigente.');
  const nueva = { ...JSON.parse(JSON.stringify(b)), estado: 'publicada', publicadaEn: new Date().toISOString(), autor: f.autor?.trim() || 'Riesgos (demo)', justificacion: f.justificacion.trim() };
  ctx.store.state.politicas.push(nueva);
  ctx.store.state.borrador = null;
  ctx.audit.registrar({ rol: MODULO_RIESGOS, accion: `Publicación de ${dmn.etiquetaVersion(nueva)}`, antes: { version: prev.version }, despues: { version: nueva.version, cambios }, reglaVersion: dmn.etiquetaVersion(nueva), evidencia: nueva.justificacion, tipo: 'politica' });
  ctx.store.emit({ politica: nueva.version });
  anunciar(`Publicada la versión ${nueva.version}.`);
}

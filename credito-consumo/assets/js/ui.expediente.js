// Vista "Expediente": stepper 1.1–6.2, panel de la tarea actual, evidencias del caso y
// el BPMN real (bpmn-js) con la tarea actual y el camino recorrido resaltados.
import { TAREAS, PERFILES, CARRILES, PROCESO, DOCUMENTOS, NIVELES, TABLA12, ROLES } from './data.js';
import { rolDeTarea, moduloDeRol, relojTotal, aDias, disenoEtapa, ETAPAS, nombreNodo, esperandoHumano } from './flow.js';
import * as dmn from './dmn.js';
import { PREGUNTAS, responder } from './assistant.js';
import { ctx, esc, usd, pct, num, horas, fechaHora, chipNivel, badgeSLA, estadoCaso, tareaActualTexto, perfilTxt, anunciar, jsonCorto } from './ui.common.js';

const carrilCorto = {
  L_CAP: 'Captura', L_SIS: 'Plataforma', L_CUM: 'Cumplimiento', L_FAB: 'Fábrica', L_APR: 'Aprobación', L_MES: 'Mesa',
};

const buscar = (id) => ctx.store.state.cases.find((c) => c.id === id);

export function firmaCaso(id) {
  const c = buscar(id);
  return c ? `${c.id}:${c.rev}:${ctx.store.politica().version}:${ctx.store.state.prefs.rol}` : `x:${id}`;
}

/* ================================================================ vista */
export function vistaCaso(id) {
  const c = buscar(id);
  if (!c) return `<section class="wrap"><h1>Expediente no encontrado</h1><p>No existe el caso ${esc(id)} en esta sesión.</p><p><a class="btn" href="#/inicio">Volver al inicio</a></p></section>`;
  const pol = ctx.store.politica();
  const cuota = dmn.cuotaMensual(c.monto, c.plazo, pol.valores.tasaAnual);
  return `
  <div class="case-layout">
    <section class="case-main" aria-labelledby="case-title">
      <p class="crumbs"><a href="#/inicio">Inicio</a> › <a href="#/bandeja">Bandeja</a> › Expediente</p>
      <header class="case-head card">
        <div class="case-head-top">
          <h1 id="case-title" tabindex="-1">Expediente ${esc(c.id)} ${chipNivel(c.data.decision?.nivel)}</h1>
          ${estadoCaso(c)}
        </div>
        <p class="muted">${c.casoN ? `Caso precargado ${c.casoN} · ${esc(c.titulo)}` : 'Nueva solicitud'}${c.nota ? ` · ${esc(c.nota)}` : ''}</p>
        <dl class="kv">
          <div><dt>Solicitante (ficticio)</dt><dd>${esc(c.solicitante.nombre)} · ${esc(c.solicitante.cedula)}</dd></div>
          <div><dt>Canal</dt><dd>${c.canal === 'digital' ? 'Canal digital' : 'Agencia'}</dd></div>
          <div><dt>Perfil de ingreso</dt><dd>${esc(perfilTxt(c.perfil))}</dd></div>
          <div><dt>Monto · plazo</dt><dd>${usd(c.monto)} · ${c.plazo} meses</dd></div>
          <div><dt>Cuota estimada</dt><dd>${usd(Math.round(cuota * 100) / 100)} (${pct(pol.valores.tasaAnual)} anual)</dd></div>
          ${c.esperado ? `<div><dt>Ruta esperada</dt><dd>${c.esperado.nivel ? chipNivel(c.esperado.nivel) + ' → ' : ''}${esc(nombreNodo(c.esperado.fin))}</dd></div>` : ''}
        </dl>
      </header>
      ${vistaReloj(c)}
      ${vistaStepper(c)}
      <section class="card task" id="task-panel" aria-labelledby="task-title">${vistaTarea(c)}</section>
      ${vistaEvidencias(c)}
    </section>
    <aside class="case-bpmn" aria-label="Diagrama BPMN del proceso">
      <div class="bpmn-head">
        <h2>BPMN TO-BE real</h2>
        <div class="btn-row">
          <button type="button" class="btn sm" data-action="bpmn-fit">Ajustar</button>
          <button type="button" class="btn sm" data-action="bpmn-actual">Ir a la tarea actual</button>
          <button type="button" class="btn sm" data-action="bpmn-zoom" data-z="1.25" aria-label="Acercar">＋</button>
          <button type="button" class="btn sm" data-action="bpmn-zoom" data-z="0.8" aria-label="Alejar">－</button>
        </div>
      </div>
      <div id="bpmn-slot" class="bpmn-slot"><p class="muted pad">Cargando diagrama…</p></div>
      <p class="legend"><span class="lg lg-done"></span> Recorrido <span class="lg lg-cur"></span> Actual <span class="lg lg-flow"></span> Flujo tomado · Fuente: <a href="${PROCESO.bpmnUrl}" download>BPMN_TO-BE_P-03.1_Concesion_Credito.bpmn</a></p>
    </aside>
  </div>`;
}

function vistaReloj(c) {
  const pol = ctx.store.politica();
  const d = c.reloj.etapa ? disenoEtapa(c, c.reloj.etapa, pol) : null;
  const nivel = c.data.decision?.nivel;
  const ref = nivel && TABLA12[nivel] && !c.revisionArt20 ? TABLA12[nivel][c.canal] : null;
  return `
  <section class="card clock" aria-labelledby="clock-title">
    <div class="clock-main">
      <div>
        <h2 id="clock-title" class="h3">Reloj del proceso</h2>
        <p class="big">${horas(relojTotal(c))}</p><p class="muted small">${num(aDias(relojTotal(c)), 2)} días hábiles de 8 h</p>
        ${ref ? `<p class="muted small">Diseño TO-BE para ${nivel} en ${c.canal}: ${horas(ref)} (tabla 12, sin reproceso ponderado)</p>` : ''}
      </div>
      <div>
        <p class="small muted">Etapa actual</p>
        <p><strong>${c.reloj.etapa ? esc(ETAPAS[c.reloj.etapa]) : '—'}</strong></p>
        <p>${badgeSLA(c)}</p>
        ${d ? `<p class="small muted">Diseño: ${d.execMin} min + ${num(d.waitH, 1)} h de espera · ${esc(d.fuente)}</p>` : ''}
      </div>
      <div class="clock-actions">
        ${esperandoHumano(c) ? '<button type="button" class="btn sm" data-action="reloj-caso" data-h="1">Simular +1 h de espera</button>' : ''}
      </div>
    </div>
    <details><summary>Tiempo por etapa (${c.reloj.segmentos.length})</summary>
      <div class="table-wrap"><table>
        <caption class="sr-only">Tiempo registrado por etapa</caption>
        <thead><tr><th scope="col">Etapa</th><th scope="col">Ejecución</th><th scope="col">Espera</th><th scope="col">Total</th><th scope="col">Fuente</th></tr></thead>
        <tbody>${c.reloj.segmentos.map((s) => `<tr><td>${esc(s.nombre)}</td><td>${s.execMin == null ? '—' : `${s.execMin} min`}</td><td>${horas(s.esperaH)}</td><td>${horas(s.totalH)}</td><td class="small">${esc(s.fuente)}</td></tr>`).join('') || '<tr><td colspan="5">Aún no se cierra ninguna etapa.</td></tr>'}</tbody>
      </table></div>
      <p class="small muted">El demo comprime el tiempo: al completar una etapa se registra su ejecución de diseño y la espera mayor entre la de diseño y la simulada.</p>
    </details>
  </section>`;
}

function vistaStepper(c) {
  const actuales = c.status === 'abierto' ? (c.activos?.length ? c.activos : [c.node]) : [];
  const items = TAREAS.map((t) => {
    const veces = c.visited.filter((n) => n === t.id).length;
    const cur = actuales.includes(t.id);
    const estado = cur ? 'cur' : veces ? 'done' : c.status === 'cerrado' ? 'skip' : 'pend';
    const rotulo = { cur: 'actual', done: 'completada', skip: 'no aplica en esta ruta', pend: 'pendiente' }[estado];
    return `<li class="step step-${estado}" ${cur ? 'aria-current="step"' : ''}>
      <span class="step-dot" aria-hidden="true">${estado === 'done' ? '✓' : estado === 'cur' ? '●' : estado === 'skip' ? '–' : ''}</span>
      <span class="step-cod">${t.cod}</span>
      <span class="step-name">${esc(t.nombre)}${veces > 1 ? ` <span class="chip sm">×${veces}</span>` : ''}</span>
      <span class="step-lane">${carrilCorto[t.carril]}</span>
      <span class="sr-only">(${rotulo})</span>
    </li>`;
  }).join('');
  return `<section class="card" aria-labelledby="stepper-title"><h2 id="stepper-title" class="h3">Tareas 1.1 a 6.2</h2><ol class="stepper">${items}</ol></section>`;
}

/* ================================================================ tarea */
function encabezadoTarea(c) {
  const rol = rolDeTarea(c);
  const actual = ctx.store.state.prefs.rol;
  const aviso = rol && actual !== 'todos' && actual !== rol
    ? `<p class="note">Estás en <strong>${esc(ROLES[actual].modulo)}</strong>; esta tarea pertenece a <strong>${esc(moduloDeRol(rol))}</strong>. El demo no controla accesos por cargo. <button type="button" class="btn sm" data-action="ir-modulo" data-rol="${rol}">Cambiar a ese módulo</button></p>` : '';
  return `<p class="eyebrow">${esc(moduloDeRol(rol))}</p><h2 id="task-title" class="h2" tabindex="-1">${esc(tareaActualTexto(c))}</h2>${aviso}`;
}

function vistaTarea(c) {
  if (c.status === 'cerrado') return vistaFin(c);
  if (c.running) {
    const ev = ctx.store.state.auditLog.filter((e) => e.casoId === c.id).slice(-5);
    return `<p class="eyebrow">Plataforma (automático)</p><h2 id="task-title" class="h2" tabindex="-1"><span class="spin" aria-hidden="true"></span> Ejecutando: ${esc(tareaActualTexto(c))}</h2>
      <p class="muted">Integraciones simuladas con latencia artificial (300–1200 ms).</p>
      <ul class="feed">${ev.map((e) => `<li><strong>${esc(e.tarea || '')}</strong> · ${esc(e.accion)}${e.evidencia ? `<br><span class="small muted">${esc(e.evidencia)}</span>` : ''}</li>`).join('')}</ul>`;
  }
  if (c.error) return `<h2 id="task-title" class="h2">Error</h2><p>${esc(c.error)}</p><button class="btn" type="button" data-action="reintentar">Reintentar</button>`;
  const f = FORMULARIOS[c.subestado === 'confirmar-campos' ? 'B_T6' : c.node];
  return encabezadoTarea(c) + (f ? f(c) : '<p>Sin formulario.</p>');
}

const err = '<p class="form-error" role="alert" data-error hidden></p>';
const adjunto = (name, label, valor) => `
  <div class="attach">
    <span>${esc(label)}</span>
    <input type="hidden" name="${name}" value="${esc(valor || '')}">
    <span class="file" data-file="${name}">${valor ? `📎 ${esc(valor)}` : '<span class="muted">Sin archivo</span>'}</span>
    <button type="button" class="btn sm" data-action="adjuntar" data-name="${name}" data-archivo="${esc(label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40))}.pdf (simulado)">Adjuntar (simulado)</button>
  </div>`;

function asistente(c) {
  if (c.canal !== 'digital') return '';
  return `
  <aside class="assistant" aria-labelledby="asis-title">
    <h3 id="asis-title" class="h4">Asistente (simulado) · solo orienta</h3>
    <p class="small muted">No ve tu evaluación ni decide. No es una IA real en este demo.</p>
    <div class="btn-row wrap-row">${PREGUNTAS.map((p) => `<button type="button" class="btn sm ghost" data-action="asistente" data-q="${p.id}">${esc(p.texto)}</button>`).join('')}</div>
    <div class="asis-ask"><label for="asis-q" class="sr-only">Escribe tu pregunta</label><input id="asis-q" type="text" placeholder="Escribe tu pregunta…" autocomplete="off"><button type="button" class="btn sm" data-action="asistente-libre">Preguntar</button></div>
    <div class="asis-out" aria-live="polite" data-asis-out></div>
  </aside>`;
}

const FORMULARIOS = {
  B_T1(c) {
    const e = c.escenario;
    const pol = ctx.store.politica();
    const reg = c.data.registro;
    return `
    <form data-form="B_T1" data-preserve novalidate>
      <fieldset><legend>Solicitante (datos ficticios)</legend>
        <p class="note small">No ingreses datos personales reales. La cédula debe empezar con <code>FICT-</code>.</p>
        <div class="grid2">
          <label>Nombre ficticio<input name="nombre" required value="${esc(c.solicitante.nombre)}" autocomplete="off"></label>
          <label>Cédula ficticia<input name="cedula" required pattern="FICT-.*" value="${esc(c.solicitante.cedula)}" autocomplete="off"></label>
          <label>Perfil de ingreso<select name="perfil">${Object.entries(PERFILES).map(([k, p]) => `<option value="${k}" ${k === c.perfil ? 'selected' : ''}>${esc(p.etiqueta)}</option>`).join('')}</select></label>
          <label>Ingreso mensual declarado (USD)<input name="ingresoDeclarado" type="number" min="1" step="1" required value="${c.ingresoDeclarado ?? ''}"></label>
          <label>Monto solicitado (USD)<input name="monto" type="number" min="1" step="100" required value="${c.monto ?? ''}"></label>
          <label>Plazo (meses)<input name="plazo" type="number" min="1" max="120" step="1" required value="${c.plazo ?? ''}"></label>
        </div>
        <p class="small muted" data-cuota-preview></p>
      </fieldset>
      <fieldset><legend>Autorizaciones firmadas (impresas, firmadas y escaneadas)</legend>
        ${adjunto('aut_buro', 'Autorización de consulta al buró', reg?.autorizaciones?.buro)}
        ${adjunto('aut_datos', 'Autorización de tratamiento de datos personales', reg?.autorizaciones?.datos)}
        <button type="button" class="btn sm ghost" data-action="adjuntar-todo">Adjuntar ambas (simulado)</button>
      </fieldset>
      <details class="scenario"><summary>Escenario de simulación (no forma parte del formulario real)</summary>
        <p class="small muted">Define lo que responderán las integraciones simuladas para este caso.</p>
        <div class="grid3">
          <label>Score de buró<input name="esc_score" type="number" min="0" max="999" value="${e.buro.score}"></label>
          <label>Meses desde la última mora (vacío = nunca)<input name="esc_meses" type="number" min="0" value="${e.buro.mesesDesdeUltimaMora ?? ''}"></label>
          <label class="check"><input type="checkbox" name="esc_mora" ${e.buro.moraVigente ? 'checked' : ''}> Mora vigente</label>
          <label>Ingreso que devolverá la fuente o el documento (USD)<input name="esc_ingreso" type="number" min="0" value="${e.ingresoFuente ?? ''}" placeholder="= ingreso declarado"></label>
          <label>Facturación promedio XML (solo independiente que factura)<input name="esc_fact" type="number" min="0" value="${e.facturacionPromedio ?? ''}" placeholder="= declarado / margen"></label>
          <label>Listas de control<select name="esc_listas"><option value="ninguna" ${e.listas === 'ninguna' ? 'selected' : ''}>Sin coincidencia</option><option value="posible" ${e.listas === 'posible' ? 'selected' : ''}>Posible coincidencia (alerta)</option></select></label>
          <label class="check"><input type="checkbox" name="esc_id" ${e.identidad.ok ? 'checked' : ''}> Biometría conforme</label>
          <label class="check"><input type="checkbox" name="esc_firma" ${e.autorizaciones.firmaDetectada ? 'checked' : ''}> Firma detectada en autorizaciones</label>
          <label class="check"><input type="checkbox" name="esc_ilegible" ${e.extraccion.ilegiblePrimerIntento ? 'checked' : ''}> Primer documento ilegible</label>
          <label class="check"><input type="checkbox" name="esc_bajo" ${e.extraccion.campoBajoUmbral ? 'checked' : ''}> Un campo bajo el umbral de confianza</label>
          <label class="check"><input type="checkbox" name="esc_xml" ${e.xmlValido ? 'checked' : ''}> XML válido en el SRI</label>
          <label class="check"><input type="checkbox" name="esc_fuera" ${e.fueraDePolitica ? 'checked' : ''}> Fuera de política</label>
          <label class="check"><input type="checkbox" name="esc_exc" ${e.excepcionPolitica ? 'checked' : ''}> Excepción a la política</label>
        </div>
      </details>
      ${err}
      <div class="btn-row"><button class="btn primary" type="submit">Registrar solicitud y enviar autorizaciones</button></div>
      <p class="small muted">Política vigente: ${esc(dmn.etiquetaVersion(pol))}.</p>
    </form>${asistente(c)}`;
  },

  B_T5(c) {
    const docs = c.data.requisitos.documentos;
    return `
    <form data-form="B_T5" data-preserve novalidate>
      <p>El DMN de requisitos (1.4) pide ${docs.length ? `${docs.length} documento(s)` : 'ningún documento de ingreso'} para el perfil <strong>${esc(perfilTxt(c.perfil))}</strong>.</p>
      ${docs.map((d) => `${adjunto(`doc_${d.id}`, d.nombre, '')}<p class="small muted indent">${esc(d.motivo)}</p>`).join('') || `<p class="note">${esc(PERFILES[c.perfil].verificacion)}.</p>`}
      ${docs.length ? '<button type="button" class="btn sm ghost" data-action="adjuntar-todo">Adjuntar todos (simulado)</button>' : ''}
      ${err}
      <div class="btn-row"><button class="btn primary" type="submit">${docs.length ? 'Enviar documentos' : 'Confirmar y continuar'}</button></div>
    </form>${asistente(c)}`;
  },

  B_T5b(c) {
    const docs = c.data.pendientesCorreccion.map((id) => ({ id, nombre: DOCUMENTOS[id] }));
    return `
    <form data-form="B_T5b" data-preserve novalidate>
      <div class="note warn"><strong>Documentos no conformes (2.1/2.2):</strong><ul>${c.data.observaciones.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></div>
      ${docs.map((d) => adjunto(`doc_${d.id}`, `${d.nombre} (nueva versión)`, '')).join('')}
      <button type="button" class="btn sm ghost" data-action="adjuntar-todo">Adjuntar todos (simulado)</button>
      ${err}
      <div class="btn-row"><button class="btn primary" type="submit">Enviar corrección</button></div>
      <p class="small muted">Al enviar, el expediente vuelve a 2.1 (flujo F_B_T5b_B_T6).</p>
    </form>${asistente(c)}`;
  },

  B_T6(c) {
    const ext = c.data.extraccion;
    return `
    <form data-form="B_T6" data-preserve novalidate>
      <p>El software marcó ${ext.camposBajoUmbral.length} campo(s) bajo el umbral de confianza de ${pct(ext.umbral, 0)}. Coteja con el documento y confirma o corrige el valor (revisión manual, tabla 13: 5 min).</p>
      <div class="table-wrap"><table><thead><tr><th scope="col">Documento</th><th scope="col">Campo</th><th scope="col">Confianza</th><th scope="col">Valor confirmado</th></tr></thead><tbody>
      ${ext.camposBajoUmbral.map((f, k) => {
        const campo = ext.docs.find((d) => d.docId === f.docId).campos.find((x) => x.campo === f.campo);
        return `<tr><td>${esc(DOCUMENTOS[f.docId])}</td><td>${esc(f.campo)}</td><td>${meter(f.confianza, ext.umbral)}</td>
          <td><label class="sr-only" for="cf${k}">Valor de ${esc(f.campo)}</label><input id="cf${k}" name="cf_${f.docId}|${f.campo}" value="${esc(campo.valor)}" required></td></tr>`;
      }).join('')}
      </tbody></table></div>
      <label>Observación<input name="motivo" value="" placeholder="Cotejado con el documento original"></label>
      ${err}
      <div class="btn-row"><button class="btn primary" type="submit">Confirmar campos y continuar a 2.2</button></div>
    </form>`;
  },

  B_T10(c) {
    const l = c.data.listas;
    return `
    <form data-form="B_T10" data-preserve novalidate>
      <div class="note warn"><p><strong>Alerta en listas de control</strong></p>
        <p>Coincidencia ${pct(l.coincidencia.similitud, 0)} con «${esc(l.coincidencia.nombreEnLista)}» en ${esc(l.coincidencia.lista)}.</p>
        <p class="small">Evidencia: ${esc(l.evidencia)} · Listas consultadas: ${esc(l.listasConsultadas.join(', '))}</p></div>
      <fieldset><legend>Resolución de Cumplimiento</legend>
        <label class="check"><input type="radio" name="descartada" value="si"> Descartar alerta (falso positivo / homónimo)</label>
        <label class="check"><input type="radio" name="descartada" value="no"> Confirmar coincidencia (fin: Rechazo por PLA)</label>
      </fieldset>
      <label>Motivo (obligatorio)<textarea name="motivo" rows="2" required></textarea></label>
      ${err}
      <div class="btn-row"><button class="btn primary" type="submit">Registrar resolución</button></div>
    </form>`;
  },

  B_T12a: (c) => formRevision(c, true),
  B_T12b: (c) => formRevision(c, false),

  B_T13(c) {
    const d = c.data.decision;
    const comite = d.nivel === 'N4' && !c.revisionArt20;
    const instancia = comite ? 'Comité diario' : c.monto <= ctx.store.politica().valores.atribucionesMax ? 'Nivel de aprobación por atribuciones' : 'Comité diario';
    return `
    <form data-form="B_T13" data-preserve novalidate>
      <dl class="kv">
        <div><dt>Nivel DMN</dt><dd>${chipNivel(d.nivel)} ${esc(d.nombre)} · ${esc(d.reglaId)}</dd></div>
        <div><dt>Instancia</dt><dd>${esc(instancia)}${comite ? ' · excepción registrada' : ''}</dd></div>
        <div><dt>Dictamen del analista</dt><dd>Recomienda <strong>${esc(c.data.revision.recomendacion)}</strong>: ${esc(c.data.revision.observacion)}</dd></div>
        <div><dt>Monto</dt><dd>${usd(c.monto)} (atribuciones hasta ${usd(ctx.store.politica().valores.atribucionesMax)})</dd></div>
      </dl>
      ${c.revisionArt20 ? `<p class="note">Revisión humana solicitada por el cliente (art. 20 LOPDP): ${esc(c.revisionArt20.motivo)}</p>` : ''}
      ${comite ? `<label>Registro de excepción y acta del comité (obligatorio)<textarea name="excepcion" rows="2" required placeholder="Excepción, condiciones y miembros del comité"></textarea></label><p class="small muted">Acta: ACTA-SIM-${esc(c.id)} · Data store: Registro de excepciones</p>` : ''}
      <fieldset><legend>Resolución</legend>
        <label class="check"><input type="radio" name="aprobada" value="si"> Aprobar</label>
        <label class="check"><input type="radio" name="aprobada" value="no"> No aprobar (fin: No aprobada)</label>
      </fieldset>
      <label>Motivo (obligatorio)<textarea name="motivo" rows="2" required></textarea></label>
      ${err}
      <div class="btn-row"><button class="btn primary" type="submit">Registrar resolución</button></div>
    </form>`;
  },

  B_T15(c) {
    const d = c.data.documentos;
    return `
    <form data-form="B_T15" data-preserve novalidate>
      <p>Documentos generados en 5.1: <strong>${esc(d.contrato)}</strong>, <strong>${esc(d.pagare)}</strong> y <strong>${esc(d.tablaAmortizacion)}</strong> (simulados).</p>
      ${tablaAmort(d)}
      <p>${c.canal === 'digital' ? 'Canal digital: el cliente imprime, firma y escanea los documentos.' : 'Agencia: el cliente firma en la misma visita.'}</p>
      <div class="btn-row"><button class="btn primary" type="submit" name="continua" value="si">${c.canal === 'digital' ? 'Cargar documentos firmados (simulado)' : 'Registrar firma en agencia'}</button></div>
      <fieldset class="desiste"><legend>¿El cliente desiste?</legend>
        <label>Motivo del desistimiento<textarea name="motivo" rows="2"></textarea></label>
        <button class="btn danger" type="submit" name="continua" value="no">Registrar desistimiento</button>
      </fieldset>
      ${err}
    </form>`;
  },

  B_T16(c) {
    const items = ctx.engine.checklist(c);
    return `
    <form data-form="B_T16" data-preserve novalidate>
      <fieldset><legend>Checklist previo al desembolso (derivado del expediente)</legend>
        ${items.map((i) => `<label class="check"><input type="checkbox" name="chk_${i.id}"> ${esc(i.texto)}</label>`).join('')}
      </fieldset>
      <button type="button" class="btn sm ghost" data-action="marcar-todo">Marcar todo</button>
      ${err}
      <div class="btn-row"><button class="btn primary" type="submit">Instruir desembolso</button></div>
    </form>`;
  },
};

function formRevision(c, parcial) {
  const d = c.data;
  const v = d.verificacion;
  const docs = d.extraccion.docs.filter((x) => !parcial || x.docId !== 'PAT');
  return `
  <form data-form="${parcial ? 'B_T12a' : 'B_T12b'}" data-preserve novalidate>
    <p class="note">${parcial ? 'Revisión parcial (N2): solo los documentos de ingreso. El resto ya lo verificó la plataforma (15 min).' : 'Evaluación completa (30 min). Sin redigitación: el analista trabaja sobre el dato extraído.'}</p>
    ${c.revisionArt20 ? `<p class="note warn">Revisión humana solicitada por el cliente (art. 20 LOPDP) sobre una decisión N0: ${esc(c.revisionArt20.motivo)}</p>` : ''}
    <dl class="kv">
      <div><dt>Decisión DMN</dt><dd>${chipNivel(d.decision.nivel)} ${esc(d.decision.explicacion)}</dd></div>
      <div><dt>Ingreso evaluado</dt><dd>${usd(d.decision.input.ingresoEvaluado)} · ${v.enFuente ? 'verificado en fuente' : 'no verificable en fuente'} (${esc(v.metodo)})</dd></div>
      <div><dt>Cuota / ingreso</dt><dd>${pct(d.decision.ratio)}</dd></div>
      ${parcial ? '' : `<div><dt>Buró</dt><dd>Score ${d.buro.score} (${esc(d.decision.categoriaBuro)})${d.buro.mesesDesdeUltimaMora != null ? ` · última mora hace ${d.buro.mesesDesdeUltimaMora} meses` : ' · sin mora registrada'}</dd></div>
      <div><dt>Identidad y listas</dt><dd>${d.identidad.ok ? 'Biometría conforme' : 'Alerta de identidad'} · ${d.listas.alerta ? `Alerta ${d.pla?.descartada ? 'descartada por Cumplimiento' : ''}` : 'sin alerta'}</dd></div>
      <div><dt>Patrimonio</dt><dd>${d.requisitos.patrimonioRequerido ? 'Requerido' : 'No requerido'}</dd></div>`}
    </dl>
    ${docs.map((doc) => tablaDoc(doc, d.extraccion.umbral)).join('')}
    <fieldset><legend>Dictamen</legend>
      <label class="check"><input type="radio" name="recomendacion" value="aprobar"> Recomienda aprobar</label>
      <label class="check"><input type="radio" name="recomendacion" value="no aprobar"> Recomienda no aprobar</label>
    </fieldset>
    <label>Observación del analista (obligatoria)<textarea name="observacion" rows="2" required></textarea></label>
    ${err}
    <div class="btn-row"><button class="btn primary" type="submit">Enviar a 4.1 Aprobación</button></div>
  </form>`;
}

function vistaFin(c) {
  const cls = c.fin.id === 'B_EF' ? 'ok' : c.fin.id === 'B_E3' ? 'neutral' : 'bad';
  let extra = '';
  if (c.fin.id === 'B_E2a') {
    extra = `
    <form data-form="art20" class="card inner" novalidate>
      <h3 class="h4">Derecho a revisión humana (art. 20 LOPDP)</h3>
      <p class="small">La decisión N0 fue automática. El cliente puede pedir que una persona la revise; la atiende la tarea 3.3 (documentación del BPMN, S-41).</p>
      <label>Motivo de la solicitud<textarea name="motivo" rows="2" required></textarea></label>
      ${err}
      <button class="btn" type="submit">Solicitar revisión humana</button>
    </form>`;
  }
  if (c.fin.id === 'B_EF') {
    const m = c.mensajes[0];
    extra = `<div class="note"><p><strong>Mensaje saliente</strong> ${esc(m.id)} · «${esc(m.nombre)}» → ${esc(m.destino)}</p><p class="small">Ref. ${esc(m.ref)} · ${fechaHora(m.en)} · ${esc(jsonCorto(m.payload))}</p><p class="small muted">P-03.2 es un proceso separado por conflicto de intereses; el demo no lo construye.</p></div>`;
  }
  const motivo = { B_E0: c.data.precalificacion?.explicacion, B_E2a: c.data.decision?.explicacion, B_EP: c.data.pla?.motivo, B_E2: c.data.aprobacion?.motivo, B_E3: c.data.firma?.motivo }[c.fin.id];
  return `<p class="eyebrow">Proceso finalizado</p><h2 id="task-title" class="h2" tabindex="-1">Fin: ${esc(c.fin.nombre)}</h2>
    <div class="end end-${cls}"><p>${esc(c.fin.nombre)} · ${fechaHora(c.fin.en)} · reloj ${horas(relojTotal(c))} (${num(aDias(relojTotal(c)), 2)} días hábiles)</p>${motivo ? `<p><strong>Motivo:</strong> ${esc(motivo)}</p>` : ''}</div>
    ${c.esperado ? `<p class="small">Ruta esperada del caso precargado: ${esc(nombreNodo(c.esperado.fin))} · ${c.fin.id === c.esperado.fin ? '<strong class="ok-text">coincide</strong>' : '<strong class="bad-text">no coincide</strong>'}</p>` : ''}
    ${c.finesPrevios.length ? `<p class="small muted">Fines previos: ${c.finesPrevios.map((f) => esc(f.nombre)).join(', ')} (revisión humana art. 20).</p>` : ''}
    ${extra}`;
}

/* ================================================================ evidencias */
function meter(v, umbral) {
  const bajo = v < umbral;
  return `<span class="meter ${bajo ? 'low' : ''}"><span style="width:${Math.round(v * 100)}%"></span></span> ${pct(v, 0)}${bajo ? ' <span class="chip sm warn">bajo umbral</span>' : ''}`;
}

function tablaDoc(doc, umbral) {
  return `<div class="doc">
    <p><strong>${esc(doc.nombre)}</strong> · <span class="small muted">${esc(doc.archivo)}</span> · ${doc.legible ? 'legible' : '<span class="bad-text">ilegible</span>'} · firma ${doc.firma ? 'detectada' : 'no detectada'} · fecha ${doc.fechaVigente ? 'vigente' : 'vencida'}</p>
    <div class="table-wrap"><table><thead><tr><th scope="col">Campo extraído</th><th scope="col">Valor</th><th scope="col">Confianza</th><th scope="col">Revisor</th></tr></thead>
    <tbody>${doc.campos.map((f) => `<tr><td>${esc(f.campo)}</td><td>${esc(typeof f.valor === 'number' ? num(f.valor, 0) : f.valor)}</td><td>${meter(f.confianza, umbral)}</td><td class="small">${esc(f.revisor || 'Software')}</td></tr>`).join('')}</tbody></table></div>
  </div>`;
}

function tablaAmort(d) {
  const filas = d.filas;
  const mostrar = filas.length > 7 ? [...filas.slice(0, 6), null, filas.at(-1)] : filas;
  return `<details><summary>Tabla de amortización (cuota ${usd(d.cuota)}, ${filas.length} meses, ${pct(d.tasaAnual)} anual)</summary>
    <div class="table-wrap"><table><thead><tr><th scope="col">N.º</th><th scope="col">Cuota</th><th scope="col">Interés</th><th scope="col">Capital</th><th scope="col">Saldo</th></tr></thead>
    <tbody>${mostrar.map((f) => (f ? `<tr><td>${f.n}</td><td>${num(f.cuota)}</td><td>${num(f.interes)}</td><td>${num(f.capital)}</td><td>${num(f.saldo)}</td></tr>` : '<tr><td colspan="5" class="muted">…</td></tr>')).join('')}</tbody></table></div></details>`;
}

function traza(res) {
  return `<div class="table-wrap"><table class="trace"><thead><tr><th scope="col">Regla</th><th scope="col">Condiciones</th><th scope="col">¿Se cumple?</th></tr></thead><tbody>
    ${res.traza.map((t) => `<tr class="${t.reglaId === res.reglaId ? 'hit' : ''}"><th scope="row">${esc(t.reglaId)} → ${esc(t.salida)}</th>
      <td><ul class="conds">${t.condiciones.map((c) => `<li class="${c.activa ? (c.cumple ? 'yes' : 'no') : 'off'}"><span aria-hidden="true">${c.activa ? (c.cumple ? '✓' : '✗') : '○'}</span> ${esc(c.texto)}${c.activa ? '' : ' (inactiva)'}</li>`).join('')}</ul></td>
      <td>${t.cumple ? '<strong>Sí</strong>' : 'No'}${t.reglaId === res.reglaId ? ' · <strong>aplicada</strong>' : ''}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function seccion(titulo, cuerpo, abierta = false) {
  return cuerpo ? `<details class="card ev" ${abierta ? 'open' : ''}><summary><h3 class="h4">${titulo}</h3></summary>${cuerpo}</details>` : '';
}

function vistaEvidencias(c) {
  const d = c.data;
  const umbral = ctx.store.politica().valores.confianzaMin;
  const ev = ctx.store.state.auditLog.filter((e) => e.casoId === c.id);
  return `<section aria-labelledby="ev-title"><h2 id="ev-title" class="h3 section-title">Expediente digital (dato con procedencia)</h2>
  ${seccion('1.2–1.3 · Autorizaciones y precalificación', d.precalificacion && `
    <p>Autorizaciones: ${d.autorizaciones.valida ? 'válidas' : 'no válidas'} (firma ${d.autorizaciones.firmaDetectada ? 'detectada' : 'no detectada'}, fecha ${d.autorizaciones.fechaVigente ? 'vigente' : 'vencida'}, ${d.autorizaciones.legible ? 'legible' : 'ilegible'}). <span class="small muted">${esc(d.autorizaciones.nota)}</span></p>
    ${d.buro ? `<p>Buró: score ${d.buro.score} · mora vigente: ${d.buro.moraVigente ? 'sí' : 'no'}</p>` : ''}
    <p><strong>${esc(d.precalificacion.salida)}</strong> (${esc(d.precalificacion.reglaId)}): ${esc(d.precalificacion.explicacion)}</p>
    <p class="small muted">${esc(d.precalificacion.version)} · hit policy FIRST</p>${traza(d.precalificacion)}`)}
  ${seccion('1.4 · Documentos requeridos (DMN de requisitos)', d.requisitos && `
    <ul>${d.requisitos.documentos.map((x) => `<li><strong>${esc(x.nombre)}</strong> · ${esc(x.reglaId)} · <span class="small">${esc(x.motivo)}</span></li>`).join('') || `<li>Sin documentos: ${esc(PERFILES[c.perfil].verificacion)}</li>`}</ul>
    <p class="small muted">${esc(d.requisitos.version)} · hit policy COLLECT</p>`)}
  ${seccion(`2.1 · Extracción y validación documental${c.intentos21 > 1 ? ` (${c.intentos21} intentos)` : ''}`, d.extraccion && `
    <p class="small muted">Umbral de confianza: ${pct(umbral, 0)}. Bajo el umbral, el campo va a revisión humana (S-30).</p>
    ${d.extraccion.docs.map((doc) => tablaDoc(doc, umbral)).join('') || '<p>Sin documentos que extraer.</p>'}
    ${d.historialExtraccion?.length > 1 ? `<p class="small">Historial: ${d.historialExtraccion.map((h) => `intento ${h.intento}: ${h.docs.map((x) => `${x.docId} ${x.legible ? 'legible' : 'ilegible'}`).join(', ')}`).join(' · ')}</p>` : ''}`)}
  ${seccion('2.2 · Verificación del ingreso en la fuente', d.verificacion && `
    <dl class="kv"><div><dt>Método</dt><dd>${esc(d.verificacion.metodo)}</dd></div><div><dt>¿En fuente?</dt><dd>${d.verificacion.enFuente ? 'Sí' : 'No'}</dd></div><div><dt>Ingreso</dt><dd>${usd(d.verificacion.ingreso)}${d.verificacion.facturacionPromedio ? ` (facturación ${usd(d.verificacion.facturacionPromedio)} × margen ${pct(d.verificacion.margen, 0)})` : ''}</dd></div><div><dt>Conforme</dt><dd>${d.verificacion.conforme ? 'Sí' : 'No'}</dd></div></dl>`)}
  ${seccion('2.4 ‖ 2.5 · Identidad y listas · 2.6 PLA', d.listas && `
    <p>Identidad: ${d.identidad.ok ? 'conforme' : 'con alerta'} (similitud biométrica ${pct(d.identidad.similitud, 0)}).</p>
    <p>Listas: ${d.listas.alerta ? `alerta (${pct(d.listas.coincidencia.similitud, 0)} con ${esc(d.listas.coincidencia.nombreEnLista)})` : 'sin coincidencias'} · evidencia ${esc(d.listas.evidencia)}</p>
    ${d.pla ? `<p>Cumplimiento: ${d.pla.descartada ? 'alerta descartada' : 'coincidencia confirmada'} · ${esc(d.pla.motivo)}</p>` : ''}`)}
  ${seccion('3.1 · Decisión DMN N0–N4', d.decision && `
    <p>${chipNivel(d.decision.nivel)} <strong>${esc(d.decision.nombre)}</strong> · regla ${esc(d.decision.reglaId)}</p>
    <p>${esc(d.decision.explicacion)}</p>
    <p class="small">Revisión: ${esc(d.decision.revision)}</p>
    <p class="small muted">${esc(d.decision.version)} · hit policy FIRST (${d.decision.orden.join(', ')}) · <a href="#/dmn?caso=${esc(c.id)}">ver en la tabla DMN</a></p>${traza(d.decision)}`, c.status === 'cerrado' && !!d.decision)}
  ${seccion('3.2/3.3 · Revisión · 4.1 Aprobación', (d.revision || d.aprobacion) && `
    ${d.revision ? `<p>Analista (${esc(d.revision.alcance)}): recomienda <strong>${esc(d.revision.recomendacion)}</strong> · ${esc(d.revision.observacion)}</p>` : ''}
    ${d.aprobacion ? `<p>${esc(d.aprobacion.instancia)}: <strong>${d.aprobacion.aprobada ? 'aprobada' : 'no aprobada'}</strong> · ${esc(d.aprobacion.motivo)}${d.aprobacion.excepcion ? `<br>Excepción registrada: ${esc(d.aprobacion.excepcion)} · ${esc(d.aprobacion.acta)}` : ''}</p>` : ''}`)}
  ${seccion('5.1–5.2 · Instrumentación', d.documentos && `<p>${esc(d.documentos.contrato)} · ${esc(d.documentos.pagare)} · ${esc(d.documentos.tablaAmortizacion)}</p>${tablaAmort(d.documentos)}${d.firma ? `<p>Firma: ${d.firma.continua ? esc(d.firma.modo) : `desiste · ${esc(d.firma.motivo)}`}</p>` : ''}`)}
  ${seccion('6.1–6.2 · Desembolso y evento hacia P-03.2', d.desembolso && `<p>Operación ${esc(d.desembolso.operacionId)} · cuenta ${esc(d.desembolso.cuenta)} · ${usd(d.desembolso.monto)}</p>${c.mensajes.map((m) => `<p>Mensaje ${esc(m.id)} → ${esc(m.destino)} · ${esc(m.ref)}</p>`).join('')}`)}
  ${seccion(`Auditoría del caso (${ev.length} eventos)`, `<ol class="feed">${ev.slice(-12).map((e) => `<li><span class="small muted">#${e.seq} · ${fechaHora(e.ts)} · ${esc(e.rol)}</span><br><strong>${esc(e.tarea || '')}</strong> · ${esc(e.accion)}</li>`).join('')}</ol><p><a href="#/auditoria?caso=${esc(c.id)}">Ver el registro completo del caso</a></p>`)}
  </section>`;
}

/* ================================================================ BPMN */
const bp = { el: null, viewer: null, ready: null, marcas: [], casoMostrado: null };

function cargarBpmn() {
  if (bp.ready) return bp.ready;
  bp.el = document.createElement('div');
  bp.el.className = 'bpmn-canvas';
  bp.ready = (async () => {
    if (!window.BpmnJS) throw new Error('No se pudo cargar bpmn-js desde unpkg (sin conexión o bloqueado).');
    bp.viewer = new window.BpmnJS({ container: bp.el });
    const r = await fetch(PROCESO.bpmnUrl);
    if (!r.ok) throw new Error(`No se pudo leer el BPMN (${r.status}).`);
    await bp.viewer.importXML(await r.text());
    return bp;
  })();
  return bp.ready;
}

function marcar(c) {
  const canvas = bp.viewer.get('canvas');
  const reg = bp.viewer.get('elementRegistry');
  for (const [id, cls] of bp.marcas) { try { canvas.removeMarker(id, cls); } catch { /* elemento ausente */ } }
  bp.marcas = [];
  const add = (id, cls) => { if (reg.get(id)) { canvas.addMarker(id, cls); bp.marcas.push([id, cls]); } };
  const actuales = c.status === 'abierto' ? (c.activos?.length ? c.activos : [c.node]) : [c.fin.id];
  new Set(c.visited).forEach((id) => { if (!actuales.includes(id)) add(id, 'hl-done'); });
  c.flows.forEach((id) => add(id, 'hl-flow'));
  if (c.mensajes.length) add(PROCESO.mensajeSaliente.id, 'hl-flow');
  actuales.forEach((id) => add(id, c.status === 'abierto' ? 'hl-current' : 'hl-end'));
}

function irActual(c) {
  const canvas = bp.viewer.get('canvas');
  const el = bp.viewer.get('elementRegistry').get(c.status === 'abierto' ? (c.activos?.[0] || c.node) : c.fin.id);
  if (!el) return;
  const vb = canvas.viewbox();
  canvas.viewbox({ x: el.x + el.width / 2 - vb.width / 2, y: el.y + el.height / 2 - vb.height / 2, width: vb.width, height: vb.height });
}

export async function montarBpmn(id) {
  const slot = document.getElementById('bpmn-slot');
  const c = buscar(id);
  if (!slot || !c) return;
  try {
    await cargarBpmn();
    if (!document.body.contains(slot)) return;
    if (bp.el.parentNode !== slot) { slot.innerHTML = ''; slot.appendChild(bp.el); }
    const canvas = bp.viewer.get('canvas');
    canvas.resized();
    marcar(c);
    if (bp.casoMostrado !== c.id) {
      canvas.zoom('fit-viewport');
      const z = canvas.zoom();
      canvas.zoom(Math.max(z * 2.2, 0.55));
      bp.casoMostrado = c.id;
    }
    irActual(c);
  } catch (e) {
    slot.innerHTML = `<p class="note warn pad">${esc(e.message)} El flujo funciona igual; puedes descargar el <a href="${PROCESO.bpmnUrl}" download>archivo BPMN</a>.</p>`;
  }
}

/* ================================================================ acciones */
function leerForm(form) {
  const fd = new FormData(form);
  return Object.fromEntries(fd.entries());
}

function payloadDe(c, nodo, form, submitter) {
  const f = leerForm(form);
  const n = (x) => (x === '' || x == null ? NaN : Number(x));
  switch (nodo) {
    case 'B_T1': {
      if (!/^FICT-/.test(f.cedula || '')) throw new Error('La cédula debe ser ficticia y empezar con FICT-.');
      const e = JSON.parse(JSON.stringify(c.escenario));
      e.buro.score = n(f.esc_score);
      e.buro.mesesDesdeUltimaMora = f.esc_meses === '' ? null : n(f.esc_meses);
      e.buro.moraVigente = !!f.esc_mora;
      e.ingresoFuente = f.esc_ingreso === '' ? null : n(f.esc_ingreso);
      e.facturacionPromedio = f.esc_fact === '' ? null : n(f.esc_fact);
      e.listas = f.esc_listas;
      e.identidad.ok = !!f.esc_id;
      e.autorizaciones.firmaDetectada = !!f.esc_firma;
      e.extraccion.ilegiblePrimerIntento = !!f.esc_ilegible;
      const docPrincipal = { DEP_IESS: ['CERT', 'Ingreso mensual'], REM_OTRA: ['REM', 'Monto promedio mensual'], NEG_POP: ['NV', 'Total de ventas del mes'], IND_FACT: ['XML', 'Facturas leídas'], REM_BANCO: ['PAT', 'Valor declarado'] }[f.perfil];
      e.extraccion.campoBajoUmbral = f.esc_bajo ? { doc: docPrincipal[0], campo: docPrincipal[1], confianza: 0.78 } : null;
      e.xmlValido = !!f.esc_xml;
      e.fueraDePolitica = !!f.esc_fuera;
      e.excepcionPolitica = !!f.esc_exc;
      return {
        datos: { solicitante: { nombre: f.nombre.trim(), cedula: f.cedula.trim() }, perfil: f.perfil, monto: n(f.monto), plazo: n(f.plazo), ingresoDeclarado: n(f.ingresoDeclarado) },
        autorizaciones: { buro: f.aut_buro, datos: f.aut_datos },
        escenario: e,
      };
    }
    case 'B_T5': case 'B_T5b':
      return { adjuntos: Object.entries(f).filter(([k, v]) => k.startsWith('doc_') && v).map(([k]) => k.slice(4)) };
    case 'B_T6':
      return { confirmaciones: Object.entries(f).filter(([k]) => k.startsWith('cf_')).map(([k, v]) => { const [docId, campo] = k.slice(3).split('|'); return { docId, campo, valor: v, motivo: f.motivo }; }) };
    case 'B_T10':
      return { descartada: f.descartada === 'si' ? true : f.descartada === 'no' ? false : undefined, motivo: f.motivo };
    case 'B_T12a': case 'B_T12b':
      return { recomendacion: f.recomendacion, observacion: f.observacion };
    case 'B_T13':
      return { aprobada: f.aprobada === 'si' ? true : f.aprobada === 'no' ? false : undefined, motivo: f.motivo, excepcion: f.excepcion };
    case 'B_T15':
      return { continua: submitter?.value === 'si', motivo: f.motivo };
    case 'B_T16':
      return { checklist: Object.fromEntries(Object.keys(f).filter((k) => k.startsWith('chk_')).map((k) => [k.slice(4), true])) };
    default:
      return {};
  }
}

function mostrarError(form, msg) {
  const p = form.querySelector('[data-error]');
  if (p) { p.hidden = false; p.textContent = msg; p.focus?.(); }
  anunciar(msg);
}

export async function enviarFormulario(form, submitter, casoId) {
  const c = buscar(casoId);
  if (!c) return;
  try {
    if (form.dataset.form === 'art20') {
      await ctx.engine.solicitarRevisionHumana(c.id, leerForm(form).motivo);
      anunciar('Revisión humana solicitada: el caso pasa a 3.3 Evaluación completa.');
      return;
    }
    const nodo = c.subestado === 'confirmar-campos' ? 'B_T6' : c.node;
    const payload = payloadDe(c, nodo, form, submitter);
    const antes = tareaActualTexto(c);
    const p = ctx.engine.completar(c.id, payload);
    anunciar(`Tarea registrada: ${antes}. La plataforma continúa el flujo.`);
    await p;
    anunciar(c.status === 'cerrado' ? `Proceso finalizado: ${c.fin.nombre}` : `Siguiente tarea: ${tareaActualTexto(c)} · ${moduloDeRol(rolDeTarea(c))}`);
  } catch (e) {
    mostrarError(form, e.message);
  }
}

export function accionCaso(accion, btn, casoId) {
  const c = buscar(casoId);
  const main = document.getElementById('main');
  switch (accion) {
    case 'adjuntar': {
      const form = btn.closest('form');
      form.querySelector(`input[name="${btn.dataset.name}"]`).value = `${btn.dataset.archivo.replace('.pdf', `_${casoId}.pdf`)}`;
      form.querySelector(`[data-file="${btn.dataset.name}"]`).textContent = `📎 ${form.querySelector(`input[name="${btn.dataset.name}"]`).value}`;
      return true;
    }
    case 'adjuntar-todo':
      btn.closest('form').querySelectorAll('[data-action="adjuntar"]').forEach((b) => accionCaso('adjuntar', b, casoId));
      return true;
    case 'marcar-todo':
      btn.closest('form').querySelectorAll('input[type="checkbox"]').forEach((i) => { i.checked = true; });
      return true;
    case 'asistente': case 'asistente-libre': {
      const q = accion === 'asistente' ? btn.dataset.q : main.querySelector('#asis-q').value;
      const pol = ctx.store.politica();
      const form = main.querySelector('form[data-form]');
      const perfil = form?.querySelector('[name="perfil"]')?.value || c.perfil;
      const monto = Number(form?.querySelector('[name="monto"]')?.value || c.monto);
      const out = main.querySelector('[data-asis-out]');
      const texto = PREGUNTAS.find((p) => p.id === q)?.texto || q;
      out.innerHTML = `<p class="small"><strong>Tú:</strong> ${esc(texto)}</p><p><strong>Asistente:</strong> ${esc(responder(q, { perfil, monto, requisitos: pol.requisitos, patrimonioDesde: pol.valores.patrimonioDesde }))}</p>`;
      ctx.audit.registrar({ casoId, rol: 'Asistente del canal digital (simulado)', tareaId: c.node, tarea: nombreNodo(c.node), accion: 'Orientación del asistente (sin acceso a la decisión)', despues: { pregunta: texto }, tipo: 'asistente' });
      return true;
    }
    case 'reloj-caso':
      ctx.engine.avanzarReloj(Number(btn.dataset.h), casoId);
      return true;
    case 'reintentar':
      c.error = undefined;
      ctx.engine.ejecutar(c);
      return true;
    case 'bpmn-fit':
      bp.viewer?.get('canvas').zoom('fit-viewport');
      return true;
    case 'bpmn-actual':
      if (bp.viewer && c) irActual(c);
      return true;
    case 'bpmn-zoom': {
      const canvas = bp.viewer?.get('canvas');
      if (canvas) canvas.zoom(canvas.zoom() * Number(btn.dataset.z));
      return true;
    }
    default:
      return false;
  }
}

// Vista previa de la cuota en 1.1 (no es decisión: es información del producto).
export function onInputCaso(e, casoId) {
  const form = e.target.closest('form[data-form="B_T1"]');
  if (!form) return;
  const pol = ctx.store.politica();
  const f = leerForm(form);
  const out = form.querySelector('[data-cuota-preview]');
  const m = Number(f.monto); const pz = Number(f.plazo);
  out.textContent = m > 0 && pz > 0 ? `Cuota estimada: ${usd(Math.round(dmn.cuotaMensual(m, pz, pol.valores.tasaAnual) * 100) / 100)} al mes (tasa simulada ${pct(pol.valores.tasaAnual)}).` : '';
}

export { NIVELES, CARRILES };

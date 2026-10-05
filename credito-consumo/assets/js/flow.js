// Motor del proceso P-03.1 TO-BE. Recorre los IDs reales del BPMN (data.js → FLUJOS),
// ejecuta las tareas automáticas con las integraciones simuladas, espera las tareas
// humanas, lleva el reloj de horas hábiles y deja cada paso en auditoría.
// Sin DOM: se prueba en Node (tests/flow.test.mjs).
import { FLUJOS, TAREAS, EVENTOS, COMPUERTAS, ROLES, MODULO_PLATAFORMA, PROCESO, PERFILES, HORAS_DIA_HABIL } from './data.js';
import * as dmn from './dmn.js';

export const TAREA = Object.fromEntries(TAREAS.map((t) => [t.id, t]));
export const TAREAS_HUMANAS = new Set(['B_T1', 'B_T5', 'B_T5b', 'B_T10', 'B_T12a', 'B_T12b', 'B_T13', 'B_T15', 'B_T16']);

export const ETAPAS = {
  CAP: 'Captura y precalificación', VAL: 'Validación documental', REP: 'Reproceso por devolución',
  PLA: 'Análisis de alerta PLA', DEC: 'Decisión DMN', REV: 'Revisión del analista',
  APR: 'Aprobación', INS: 'Instrumentación', DES: 'Desembolso',
};
const ETAPA_DE = {
  B_T1: 'CAP', B_T2: 'CAP', B_T3: 'CAP', B_T4: 'CAP', B_T5: 'CAP',
  B_T6: 'VAL', B_T7: 'VAL', B_T8: 'VAL', B_T9: 'VAL', B_T5b: 'REP', B_T10: 'PLA',
  B_T11: 'DEC', B_T12a: 'REV', B_T12b: 'REV', B_T13: 'APR', B_T14: 'INS', B_T15: 'INS', B_T16: 'DES', B_T17: 'DES',
};

export function nombreNodo(id) {
  if (TAREA[id]) return `${TAREA[id].cod} ${TAREA[id].nombre}`;
  if (EVENTOS[id]) return EVENTOS[id].nombre;
  return COMPUERTAS[id] || id;
}

// Rol (módulo) responsable de la tarea actual. null = Plataforma (automático).
export function rolDeTarea(c, nodo = c.node) {
  if (nodo === 'B_T6' && c.subestado === 'confirmar-campos') return 'analista';
  switch (nodo) {
    case 'B_T1': case 'B_T5': case 'B_T5b': case 'B_T15': return c.canal === 'digital' ? 'cliente' : 'asesor';
    case 'B_T10': return 'cumplimiento';
    case 'B_T12a': case 'B_T12b': return 'analista';
    case 'B_T13': return 'aprobador';
    case 'B_T16': return 'mesa';
    default: return null;
  }
}
export const moduloDeRol = (rol) => (rol ? ROLES[rol].modulo : MODULO_PLATAFORMA);

export function esperandoHumano(c) {
  return c.status === 'abierto' && !c.running && (TAREAS_HUMANAS.has(c.node) || c.subestado === 'confirmar-campos');
}

/* ------------------------------------------------------------ reloj y SLA */
function nivelTiempos(c) {
  if (c.revisionArt20) return 'N3';
  return c.data.decision?.nivel;
}

// Tiempo de diseño de la etapa: { execMin, waitH, fuente } o null si el análisis no lo define.
export function disenoEtapa(c, etapa, pol) {
  const t = pol.tiempos;
  const par = (x, k) => (x && x[k] ? { execMin: x[k][0], waitH: x[k][1], fuente: x.fuente } : null);
  const n = nivelTiempos(c);
  switch (etapa) {
    case 'CAP': return par(t.captura, c.canal);
    case 'VAL': return par(t.validacion, c.canal);
    case 'REP': return par(t.reproceso, 'todos');
    case 'DEC': return { execMin: 0, waitH: 0, fuente: 'Automático (DMN)' };
    case 'REV': return par(t.revision, n);
    case 'APR': return par(t.aprobacion, n);
    case 'INS': return par(n === 'N1' ? t.instrumentacionN1 : t.instrumentacion, c.canal);
    case 'DES': return par(t.desembolso, c.canal);
    default: return null; // PLA: el análisis no define tiempo de diseño
  }
}

export function relojTotal(c) {
  return c.reloj.horas + (c.status === 'abierto' ? c.reloj.aging : 0);
}

export function estadoSLA(c, pol) {
  if (c.status !== 'abierto' || !c.reloj.etapa) return { estado: 'cerrado', texto: 'Cerrado' };
  const d = disenoEtapa(c, c.reloj.etapa, pol);
  if (!d) return { estado: 'sin-sla', texto: 'Sin SLA en el análisis', limite: null, transcurrido: c.reloj.aging };
  const limite = d.execMin / 60 + d.waitH;
  const ratio = limite > 0 ? c.reloj.aging / limite : (c.reloj.aging > 0 ? Infinity : 0);
  const estado = ratio > 1 ? 'rojo' : ratio >= pol.valores.slaAmbar ? 'ambar' : 'verde';
  const texto = { verde: 'En plazo', ambar: 'Por vencer', rojo: 'Vencido' }[estado];
  return { estado, texto, limite, transcurrido: c.reloj.aging, ratio, fuente: d.fuente };
}

export const aDias = (h) => h / HORAS_DIA_HABIL;

/* ------------------------------------------------------------ motor */
export function createEngine({ cases, audit, mocks, getPolitica, emit = () => {} }) {
  const pol = () => getPolitica();
  const v = () => getPolitica().valores;

  const touch = (c) => { c.rev = (c.rev || 0) + 1; c.actualizado = new Date().toISOString(); emit(c); };
  const cuota = (c) => dmn.cuotaMensual(c.monto, c.plazo, v().tasaAnual);

  function log(c, datos) {
    return audit.registrar({ casoId: c.id, relojH: relojTotal(c), ...datos });
  }
  function logTarea(c, tareaId, datos) {
    const rol = datos.rol ?? rolDeTarea(c, tareaId);
    return log(c, { tareaId, tarea: nombreNodo(tareaId), rol: moduloDeRol(rol), ...datos, ...(datos.rol !== undefined ? { rol: moduloDeRol(datos.rol) } : {}) });
  }

  function cerrarEtapa(c) {
    const et = c.reloj.etapa;
    if (!et) return;
    const d = disenoEtapa(c, et, pol());
    const espera = d ? Math.max(d.waitH, c.reloj.aging) : c.reloj.aging;
    const total = (d ? d.execMin / 60 : 0) + espera;
    c.reloj.segmentos.push({ etapa: et, nombre: ETAPAS[et], execMin: d ? d.execMin : null, esperaH: espera, totalH: total, fuente: d ? d.fuente : 'No definido en el análisis' });
    c.reloj.horas += total;
    c.reloj.aging = 0;
    c.reloj.etapa = null;
  }

  function entrar(c, nodo) {
    c.node = nodo;
    c.visited.push(nodo);
    const et = ETAPA_DE[nodo];
    if (et && et !== c.reloj.etapa) { cerrarEtapa(c); c.reloj.etapa = et; }
    if (EVENTOS[nodo]?.tipo === 'endEvent') cerrarEtapa(c);
  }

  function ir(c, flujo) {
    const f = FLUJOS[flujo];
    if (!f) throw new Error(`Flujo inexistente en el BPMN: ${flujo}`);
    if (f[0] !== c.node && !(c.activos || []).includes(f[0])) throw new Error(`El flujo ${flujo} no sale de ${c.node}`);
    c.flows.push(flujo);
    entrar(c, f[1]);
  }

  function compuerta(c, flujo, motivo) {
    const [desde, hasta, etiqueta] = FLUJOS[flujo];
    log(c, { rol: MODULO_PLATAFORMA, tareaId: desde, tarea: COMPUERTAS[desde], accion: `Compuerta → ${etiqueta || nombreNodo(hasta)}`, despues: { flujo, destino: hasta }, evidencia: motivo, tipo: 'compuerta' });
    ir(c, flujo);
  }

  let contador = cases.reduce((m, c) => Math.max(m, Number(c.id.split('-')[1]) || 0), 0);

  function crearCaso(datos, { sesionId = null } = {}) {
    contador += 1;
    const c = {
      id: `SOL-${String(contador).padStart(4, '0')}`,
      casoN: datos.n ?? null, titulo: datos.titulo || 'Solicitud nueva', esperado: datos.esperado || null, nota: datos.nota || null,
      canal: datos.canal, solicitante: { ...datos.solicitante }, perfil: datos.perfil,
      monto: datos.monto, plazo: datos.plazo, ingresoDeclarado: datos.ingresoDeclarado,
      escenario: JSON.parse(JSON.stringify(datos.escenario)),
      status: 'abierto', node: null, subestado: null, running: false, activos: [],
      visited: [], flows: [], fin: null, finesPrevios: [], revisionArt20: null,
      data: {}, intentos21: 0, mensajes: [], versiones: [],
      reloj: { horas: 0, etapa: null, aging: 0, segmentos: [] },
      creado: new Date().toISOString(), sesionId, rev: 0,
    };
    cases.push(c);
    const inicio = c.canal === 'digital' ? 'B_SD' : 'B_SA';
    entrar(c, inicio);
    log(c, { rol: moduloDeRol(c.canal === 'digital' ? 'cliente' : 'asesor'), tareaId: inicio, tarea: EVENTOS[inicio].nombre, accion: 'Inicio del proceso (evento de mensaje)', despues: { canal: c.canal, caso: c.casoN ? `Caso precargado ${c.casoN}` : 'Nueva solicitud' }, tipo: 'inicio' });
    ir(c, c.canal === 'digital' ? 'F_B_SD_B_GM' : 'F_B_SA_B_GM');
    ir(c, 'F_B_GM_B_T1');
    touch(c);
    return c;
  }

  const get = (id) => {
    const c = cases.find((x) => x.id === id);
    if (!c) throw new Error(`Caso ${id} no existe`);
    return c;
  };

  /* ---------------- tareas humanas ---------------- */
  async function completar(id, payload = {}) {
    const c = get(id);
    if (c.status !== 'abierto' || c.running) throw new Error('El caso no espera una acción humana.');
    const n = c.node;
    const req = (cond, msg) => { if (!cond) throw new Error(msg); };

    switch (n) {
      case 'B_T1': {
        const antes = { solicitante: c.solicitante, perfil: c.perfil, monto: c.monto, plazo: c.plazo, ingresoDeclarado: c.ingresoDeclarado };
        const d = { ...antes, ...payload.datos };
        req(d.solicitante?.nombre && d.solicitante?.cedula, 'Nombre y cédula (ficticios) son obligatorios.');
        req(/^FICT-/.test(d.solicitante.cedula), 'La cédula debe ser ficticia y empezar con FICT- (no se aceptan datos reales).');
        req(PERFILES[d.perfil], 'Perfil de ingreso inválido.');
        req(d.monto > 0 && d.plazo >= 1 && d.plazo <= 120 && Number.isInteger(d.plazo), 'Monto > 0 y plazo entero entre 1 y 120 meses.');
        req(d.ingresoDeclarado > 0, 'El ingreso declarado debe ser mayor que 0.');
        req(payload.autorizaciones?.buro && payload.autorizaciones?.datos, 'Carga las dos autorizaciones firmadas y escaneadas.');
        Object.assign(c, { solicitante: d.solicitante, perfil: d.perfil, monto: d.monto, plazo: d.plazo, ingresoDeclarado: d.ingresoDeclarado });
        if (payload.escenario) c.escenario = payload.escenario;
        c.data.registro = { ...d, autorizaciones: payload.autorizaciones, asistente: c.canal === 'digital' ? 'Disponible (solo orienta)' : 'No aplica' };
        logTarea(c, n, { accion: 'Datos registrados y autorizaciones cargadas', antes, despues: c.data.registro, evidencia: `${payload.autorizaciones.buro}; ${payload.autorizaciones.datos}` });
        ir(c, 'F_B_T1_B_T2');
        break;
      }
      case 'B_T5': case 'B_T5b': {
        const docs = n === 'B_T5' ? c.data.requisitos.documentos.map((d) => d.id) : c.data.pendientesCorreccion;
        const adj = payload.adjuntos || [];
        req(docs.every((d) => adj.includes(d)), 'Adjunta todos los documentos requeridos.');
        c.data[n === 'B_T5' ? 'carga' : 'correccion'] = { adjuntos: adj, en: new Date().toISOString() };
        logTarea(c, n, { accion: n === 'B_T5' ? 'Documentos cargados' : 'Documentos corregidos y cargados de nuevo', antes: n === 'B_T5b' ? { observaciones: c.data.observaciones } : null, despues: { adjuntos: adj }, evidencia: adj.map((d) => `${d.toLowerCase()}_${c.id}.pdf (simulado)`).join('; ') || 'Sin documentos requeridos' });
        ir(c, n === 'B_T5' ? 'F_B_T5_B_T6' : 'F_B_T5b_B_T6');
        break;
      }
      case 'B_T6': {
        req(c.subestado === 'confirmar-campos', 'La tarea 2.1 es automática.');
        const conf = payload.confirmaciones || [];
        const ext = c.data.extraccion;
        for (const f of ext.camposBajoUmbral) {
          const r = conf.find((x) => x.docId === f.docId && x.campo === f.campo);
          req(r && r.valor !== '' && r.valor != null, `Confirma el campo "${f.campo}".`);
          const doc = ext.docs.find((d) => d.docId === f.docId);
          const campo = doc.campos.find((x) => x.campo === f.campo);
          const antes = { valor: campo.valor, confianza: campo.confianza };
          campo.valor = typeof campo.valor === 'number' ? Number(r.valor) : r.valor;
          campo.revisor = moduloDeRol('analista');
          campo.revisadoEn = new Date().toISOString();
          logTarea(c, n, { rol: 'analista', accion: `Revisión humana de campo bajo umbral: ${f.campo}`, antes, despues: { valor: campo.valor, revisor: campo.revisor }, evidencia: r.motivo || 'Confirmado contra el documento', reglaVersion: `Umbral de confianza ${Math.round(v().confianzaMin * 100)} %` });
        }
        c.subestado = null;
        ir(c, 'F_B_T6_B_T7');
        break;
      }
      case 'B_T10': {
        req(typeof payload.descartada === 'boolean', 'Indica si la alerta se descarta.');
        req(payload.motivo?.trim(), 'El motivo es obligatorio.');
        c.data.pla = { descartada: payload.descartada, motivo: payload.motivo, en: new Date().toISOString() };
        logTarea(c, n, { accion: payload.descartada ? 'Alerta PLA descartada' : 'Coincidencia en listas confirmada', despues: c.data.pla, evidencia: c.data.listas?.evidencia });
        ir(c, 'F_B_T10_B_G4');
        break;
      }
      case 'B_T12a': case 'B_T12b': {
        req(['aprobar', 'no aprobar'].includes(payload.recomendacion), 'Elige una recomendación.');
        req(payload.observacion?.trim(), 'La observación del analista es obligatoria.');
        c.data.revision = { alcance: n === 'B_T12a' ? 'Solo documentos de ingreso (N2)' : 'Evaluación completa', recomendacion: payload.recomendacion, observacion: payload.observacion, art20: !!c.revisionArt20 };
        logTarea(c, n, { accion: `Dictamen del analista: recomienda ${payload.recomendacion}`, despues: c.data.revision });
        ir(c, n === 'B_T12a' ? 'F_B_T12a_B_GMF' : 'F_B_T12b_B_GMF');
        break;
      }
      case 'B_T13': {
        req(typeof payload.aprobada === 'boolean', 'Indica la resolución.');
        req(payload.motivo?.trim(), 'El motivo de la resolución es obligatorio.');
        const comite = nivelTiempos(c) === 'N4';
        if (comite) req(payload.excepcion?.trim(), 'N4: registra la excepción y el acta del comité diario.');
        const instancia = comite ? 'Comité diario' : c.monto <= v().atribucionesMax ? 'Nivel de aprobación por atribuciones' : 'Comité diario';
        c.data.aprobacion = { aprobada: payload.aprobada, motivo: payload.motivo, instancia, excepcion: payload.excepcion || null, acta: comite ? `ACTA-SIM-${c.id}` : null };
        logTarea(c, n, { accion: `${instancia}: ${payload.aprobada ? 'aprobada' : 'no aprobada'}`, despues: c.data.aprobacion, evidencia: comite ? `Registro de excepciones · ACTA-SIM-${c.id}` : null, reglaVersion: c.data.decision?.version });
        ir(c, 'F_B_T13_B_G7');
        break;
      }
      case 'B_T15': {
        req(typeof payload.continua === 'boolean', 'Indica si el cliente continúa.');
        if (!payload.continua) req(payload.motivo?.trim(), 'Registra el motivo del desistimiento.');
        c.data.firma = { continua: payload.continua, modo: c.canal === 'digital' ? 'Impresos, firmados y escaneados' : 'Firma en agencia', motivo: payload.motivo || null };
        logTarea(c, n, { accion: payload.continua ? `Documentos firmados (${c.data.firma.modo})` : 'Cliente desiste', despues: c.data.firma, evidencia: payload.continua ? `${c.data.documentos.contrato}; ${c.data.documentos.pagare} (firmados, simulado)` : null });
        ir(c, 'F_B_T15_B_G9');
        break;
      }
      case 'B_T16': {
        const items = checklist(c);
        const marcado = payload.checklist || {};
        req(items.every((it) => marcado[it.id]), 'Marca todos los ítems del checklist.');
        c.data.checklist = items.map((it) => ({ ...it, ok: true }));
        logTarea(c, n, { accion: 'Checklist validado; desembolso instruido', despues: { checklist: items.map((i) => i.texto) } });
        ir(c, 'F_B_T16_B_T17');
        break;
      }
      default:
        throw new Error(`La tarea ${n} no es humana.`);
    }
    touch(c);
    await ejecutar(c);
    return c;
  }

  // Ítems del checklist de 6.1: se derivan de los artefactos del expediente.
  function checklist(c) {
    return [
      { id: 'aut', texto: 'Autorizaciones de buró y datos personales válidas (1.2)' },
      { id: 'listas', texto: 'Evidencia de listas de control guardada (2.5)' },
      { id: 'decision', texto: `Decisión registrada: ${c.data.decision?.nivel ?? '—'} · ${c.data.decision?.version ?? ''}` },
      ...(c.data.aprobacion ? [{ id: 'aprob', texto: `Resolución de ${c.data.aprobacion.instancia}` }] : []),
      { id: 'docs', texto: 'Contrato, pagaré y tabla de amortización firmados (5.2)' },
    ];
  }

  /* ---------------- tareas automáticas ---------------- */
  async function ejecutar(c) {
    if (c.running) return;
    c.running = true; touch(c);
    try {
      while (c.status === 'abierto' && !TAREAS_HUMANAS.has(c.node) && c.subestado !== 'confirmar-campos') {
        await paso(c);
        touch(c);
      }
    } catch (e) {
      c.error = String(e.message || e);
      log(c, { rol: MODULO_PLATAFORMA, tareaId: c.node, tarea: nombreNodo(c.node), accion: 'Error de ejecución', despues: { error: c.error }, tipo: 'error' });
    } finally {
      c.running = false; touch(c);
    }
  }

  const meta = (r) => `${r._meta.sistema} · ${r._meta.ref} · ${r._meta.ms} ms`;
  const sinMeta = ({ _meta, ...r }) => r;

  async function paso(c) {
    const P = pol();
    const n = c.node;
    switch (n) {
      case 'B_T2': {
        const r = await mocks.validarAutorizaciones(c);
        c.data.autorizaciones = sinMeta(r);
        logTarea(c, n, { accion: r.valida ? 'Autorizaciones válidas' : 'Autorizaciones no válidas', despues: c.data.autorizaciones, evidencia: meta(r) });
        return ir(c, 'F_B_T2_B_T3');
      }
      case 'B_T3': {
        let buro = null;
        if (c.data.autorizaciones.valida) {
          const r = await mocks.consultarBuro(c);
          buro = sinMeta(r);
          logTarea(c, n, { accion: 'Consulta al buró (con autorización)', despues: buro, evidencia: meta(r) });
        }
        c.data.buro = buro;
        const input = { autorizacionesValidas: c.data.autorizaciones.valida, moraVigente: buro?.moraVigente ?? false, cuota: cuota(c), ingresoDeclarado: c.ingresoDeclarado };
        const res = dmn.evaluarPrecalificacion(input, P);
        c.data.precalificacion = { ...res, input };
        c.versiones.push({ tarea: '1.3', version: res.version });
        logTarea(c, n, { accion: `DMN 1.3 · ${res.salida} (regla ${res.reglaId})`, despues: { salida: res.salida, regla: res.reglaId, explicacion: res.explicacion }, reglaVersion: res.version, evidencia: `Cuota ${input.cuota.toFixed(2)} / ingreso declarado ${input.ingresoDeclarado}` });
        return ir(c, 'F_B_T3_B_G1');
      }
      case 'B_G1':
        return compuerta(c, c.data.precalificacion.precalifica ? 'F_B_G1_B_T4' : 'F_B_G1_B_E0', c.data.precalificacion.explicacion);
      case 'B_T4': {
        const res = dmn.evaluarRequisitos({ perfil: c.perfil, monto: c.monto }, P);
        c.data.requisitos = res;
        c.versiones.push({ tarea: '1.4', version: res.version });
        logTarea(c, n, { accion: `DMN 1.4 · ${res.documentos.length} documento(s) requerido(s)`, despues: { documentos: res.documentos.map((d) => d.nombre), reglas: res.reglas }, reglaVersion: res.version });
        return ir(c, 'F_B_T4_B_T5');
      }
      case 'B_T6': {
        c.intentos21 += 1;
        const r = await mocks.extraerDocumentos(c, c.intentos21, P.valores, c.data.requisitos.documentos);
        const ext = sinMeta(r);
        const todosLegibles = ext.docs.every((d) => d.legible);
        ext.camposBajoUmbral = todosLegibles ? ext.docs.flatMap((d) => d.campos.filter((f) => f.confianza < P.valores.confianzaMin).map((f) => ({ docId: d.docId, campo: f.campo, confianza: f.confianza }))) : [];
        ext.discrepancias = ext.camposBajoUmbral.length > 0;
        c.data.extraccion = ext;
        (c.data.historialExtraccion ||= []).push({ intento: c.intentos21, docs: ext.docs.map((d) => ({ docId: d.docId, legible: d.legible })) });
        logTarea(c, n, { accion: `Extracción (intento ${c.intentos21}): ${ext.docs.length} documento(s)${todosLegibles ? '' : ' · documento ilegible'}${ext.camposBajoUmbral.length ? ` · ${ext.camposBajoUmbral.length} campo(s) bajo umbral → revisión humana` : ''}`, despues: { docs: ext.docs.map((d) => ({ doc: d.nombre, legible: d.legible, firma: d.firma, campos: d.campos.map((f) => `${f.campo}: ${f.valor} (${Math.round(f.confianza * 100)} %)`) })) }, evidencia: meta(r), reglaVersion: `Umbral de confianza ${Math.round(P.valores.confianzaMin * 100)} % · ${dmn.etiquetaVersion(P)}` });
        if (ext.camposBajoUmbral.length) { c.subestado = 'confirmar-campos'; return; }
        return ir(c, 'F_B_T6_B_T7');
      }
      case 'B_T7': {
        const r = await mocks.verificarIngresoFuente(c, c.data.extraccion, P.valores);
        c.data.verificacion = sinMeta(r);
        logTarea(c, n, { accion: `Ingreso ${r.enFuente ? 'verificado en fuente' : 'no verificable en fuente'}: USD ${r.ingreso}`, despues: c.data.verificacion, evidencia: meta(r) });
        return ir(c, 'F_B_T7_B_G2');
      }
      case 'B_G2': {
        const ext = c.data.extraccion;
        const malos = ext.docs.filter((d) => !(d.legible && d.firma && d.fechaVigente));
        const conforme = malos.length === 0 && c.data.verificacion.conforme;
        c.data.pendientesCorreccion = malos.map((d) => d.docId);
        c.data.observaciones = malos.map((d) => `${d.nombre}: ${d.observacion || 'no conforme'}`).concat(c.data.verificacion.conforme ? [] : ['La verificación en fuente no es conforme.']);
        if (!conforme && !c.data.pendientesCorreccion.length) c.data.pendientesCorreccion = c.data.requisitos.documentos.map((d) => d.id);
        return compuerta(c, conforme ? 'F_B_G2_B_P1' : 'F_B_G2_B_T5b', conforme ? 'Documentos legibles, firmados, vigentes y verificación conforme' : c.data.observaciones.join(' '));
      }
      case 'B_P1': {
        log(c, { rol: MODULO_PLATAFORMA, tareaId: 'B_P1', tarea: COMPUERTAS.B_P1, accion: 'División paralela: 2.4 ‖ 2.5', tipo: 'compuerta' });
        c.flows.push('F_B_P1_B_T8', 'F_B_P1_B_T9');
        c.visited.push('B_T8', 'B_T9');
        c.activos = ['B_T8', 'B_T9'];
        c.node = 'B_T8';
        touch(c);
        const [id, li] = await Promise.all([mocks.validarIdentidad(c), mocks.consultarListas(c)]);
        c.data.identidad = sinMeta(id);
        c.data.listas = sinMeta(li);
        logTarea(c, 'B_T8', { accion: id.ok ? `Identidad validada (similitud ${Math.round(id.similitud * 100)} %)` : 'Identidad con alerta', despues: c.data.identidad, evidencia: meta(id) });
        logTarea(c, 'B_T9', { accion: li.alerta ? 'Posible coincidencia en listas: alerta a Cumplimiento' : 'Listas sin coincidencias; evidencia guardada', despues: c.data.listas, evidencia: `${meta(li)} · ${li.evidencia}` });
        c.flows.push('F_B_T8_B_P2', 'F_B_T9_B_P2');
        c.activos = [];
        entrar(c, 'B_P2');
        return;
      }
      case 'B_P2':
        log(c, { rol: MODULO_PLATAFORMA, tareaId: 'B_P2', tarea: COMPUERTAS.B_P2, accion: 'Unión paralela: 2.4 y 2.5 completadas', tipo: 'compuerta' });
        return ir(c, 'F_B_P2_B_G3');
      case 'B_G3':
        return compuerta(c, c.data.listas.alerta ? 'F_B_G3_B_T10' : 'F_B_G3_B_G5', c.data.listas.alerta ? `Coincidencia ${Math.round(c.data.listas.coincidencia.similitud * 100)} % en ${c.data.listas.coincidencia.lista}` : 'Sin alerta');
      case 'B_G4':
        return compuerta(c, c.data.pla.descartada ? 'F_B_G4_B_G5' : 'F_B_G4_B_EP', c.data.pla.motivo);
      case 'B_G5':
        return ir(c, 'F_B_G5_B_T11');
      case 'B_T11': {
        const d = c.data;
        const input = {
          score: d.buro.score, moraVigente: d.buro.moraVigente, mesesDesdeUltimaMora: d.buro.mesesDesdeUltimaMora,
          coincidenciaConfirmada: d.pla ? !d.pla.descartada : false, alertaListas: d.listas.alerta, identidadOk: d.identidad.ok,
          ingresoEvaluado: dmn.ingresoEvaluado(c.perfil, d.verificacion, P.valores), ingresoEnFuente: d.verificacion.enFuente,
          cuota: cuota(c), monto: c.monto, patrimonioRequerido: d.requisitos.patrimonioRequerido,
          discrepanciasSoftware: d.extraccion.discrepancias, fueraDePolitica: !!c.escenario.fueraDePolitica, excepcionPolitica: !!c.escenario.excepcionPolitica,
        };
        const res = dmn.evaluarDecision(input, P);
        c.data.decision = { ...res, input };
        c.versiones.push({ tarea: '3.1', version: res.version });
        logTarea(c, n, { accion: `DMN 3.1 · ${res.nivel} ${res.nombre} (regla ${res.reglaId})`, antes: null, despues: { nivel: res.nivel, regla: res.reglaId, explicacion: res.explicacion }, reglaVersion: res.version, evidencia: `Score ${input.score} (${res.categoriaBuro}); cuota/ingreso evaluado ${(res.ratio * 100).toFixed(1)} %` });
        return ir(c, 'F_B_T11_B_G6');
      }
      case 'B_G6': {
        const nv = c.data.decision.nivel;
        return compuerta(c, nv === 'N0' ? 'F_B_G6_B_E2a' : nv === 'N1' ? 'F_B_G6_B_G8' : 'F_B_G6_B_G6b', c.data.decision.explicacion);
      }
      case 'B_G6b':
        return compuerta(c, c.data.decision.nivel === 'N2' ? 'F_B_G6b_B_T12a' : 'F_B_G6b_B_T12b', `Nivel ${c.data.decision.nivel}`);
      case 'B_GMF':
        return ir(c, 'F_B_GMF_B_T13');
      case 'B_G7':
        return compuerta(c, c.data.aprobacion.aprobada ? 'F_B_G7_B_G8' : 'F_B_G7_B_E2', c.data.aprobacion.motivo);
      case 'B_G8':
        return ir(c, 'F_B_G8_B_T14');
      case 'B_T14': {
        const r = await mocks.generarDocumentos(c);
        const tabla = dmn.tablaAmortizacion(c.monto, c.plazo, P.valores.tasaAnual);
        c.data.documentos = { ...sinMeta(r), cuota: tabla.cuota, tasaAnual: P.valores.tasaAnual, filas: tabla.filas };
        logTarea(c, n, { accion: 'Contrato, pagaré y tabla de amortización generados', despues: { contrato: r.contrato, pagare: r.pagare, cuota: tabla.cuota, plazo: c.plazo }, evidencia: meta(r), reglaVersion: dmn.etiquetaVersion(P) });
        return ir(c, 'F_B_T14_B_T15');
      }
      case 'B_G9':
        return compuerta(c, c.data.firma.continua ? 'F_B_G9_B_T16' : 'F_B_G9_B_E3', c.data.firma.continua ? 'Documentos firmados' : c.data.firma.motivo);
      case 'B_T17': {
        const r = await mocks.acreditarFondos(c);
        c.data.desembolso = sinMeta(r);
        logTarea(c, n, { accion: `Fondos acreditados; operación ${r.operacionId} instanciada`, despues: c.data.desembolso, evidencia: meta(r) });
        return ir(c, 'F_B_T17_B_EF');
      }
      default:
        if (EVENTOS[n]?.tipo === 'endEvent') return finalizar(c, n);
        throw new Error(`Nodo sin manejador: ${n}`);
    }
  }

  async function finalizar(c, finId) {
    if (finId === 'B_EF') {
      const payload = { operacion: c.data.desembolso.operacionId, solicitud: c.id, monto: c.monto, plazo: c.plazo, nivel: c.data.decision.nivel, politica: c.data.decision.version };
      const r = await mocks.publicarEvento(c, payload);
      const msg = { id: PROCESO.mensajeSaliente.id, nombre: 'operación desembolsada', destino: r.destino, payload, ref: r._meta.ref, en: new Date().toISOString() };
      c.mensajes.push(msg);
      log(c, { rol: MODULO_PLATAFORMA, tareaId: PROCESO.mensajeSaliente.id, tarea: PROCESO.mensajeSaliente.nombre, accion: `Mensaje saliente → ${r.destino}`, despues: payload, evidencia: meta(r), tipo: 'mensaje-saliente' });
    }
    c.status = 'cerrado';
    c.fin = { id: finId, nombre: EVENTOS[finId].nombre, en: new Date().toISOString() };
    log(c, { rol: MODULO_PLATAFORMA, tareaId: finId, tarea: EVENTOS[finId].nombre, accion: `Fin: ${EVENTOS[finId].nombre}`, despues: { relojH: relojTotal(c), dias: aDias(relojTotal(c)) }, tipo: 'fin' });
  }

  // Art. 20 LOPDP: el cliente pide revisión humana de una decisión automática (N0).
  // La documentación de la tarea 3.3 dice que la atiende; el BPMN no dibuja el flujo.
  async function solicitarRevisionHumana(id, motivo) {
    const c = get(id);
    if (c.fin?.id !== 'B_E2a') throw new Error('Solo aplica a un rechazo automático N0.');
    if (!motivo?.trim()) throw new Error('Indica el motivo de la solicitud.');
    c.finesPrevios.push(c.fin);
    c.fin = null;
    c.status = 'abierto';
    c.revisionArt20 = { motivo, en: new Date().toISOString() };
    log(c, { rol: moduloDeRol(c.canal === 'digital' ? 'cliente' : 'asesor'), tareaId: 'B_E2a', tarea: EVENTOS.B_E2a.nombre, accion: 'Solicitud de revisión humana (art. 20 LOPDP) → 3.3', antes: { fin: 'B_E2a' }, despues: { tarea: 'B_T12b' }, evidencia: `Documentación de 3.3 (S-41). Motivo: ${motivo}`, tipo: 'revision-humana' });
    entrar(c, 'B_T12b');
    touch(c);
    return c;
  }

  // Simula espera en cola: suma horas hábiles a los casos que esperan una acción humana.
  function avanzarReloj(horas, soloId = null) {
    const afectados = cases.filter((c) => esperandoHumano(c) && (!soloId || c.id === soloId));
    for (const c of afectados) { c.reloj.aging += horas; touch(c); }
    audit.registrar({ rol: 'Simulación del demo', accion: `Reloj simulado +${horas} h hábil(es)`, despues: { casos: afectados.map((c) => c.id) }, tipo: 'reloj' });
    return afectados.length;
  }

  // Reanuda casos que quedaron a mitad de una cadena automática (p. ej., al recargar).
  async function reanudar() {
    for (const c of cases) {
      c.running = false;
      if (c.status === 'abierto' && !esperandoHumano(c)) ejecutar(c);
    }
  }

  return { crearCaso, completar, ejecutar, solicitarRevisionHumana, avanzarReloj, reanudar, checklist, get };
}

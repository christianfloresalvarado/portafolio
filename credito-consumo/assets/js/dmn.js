// Motor de decisión (DMN) del demo. Sin dependencias de DOM: se prueba con node --test.
// Tres tablas: 1.3 Precalificación (FIRST), 1.4 Requisitos documentales (COLLECT) y
// 3.1 Decisión N0–N4 (FIRST en orden N0, N4, N1, N2, N3).
//
// Todo lo parametrizable vive en un objeto "política" versionado:
//   { version, valores, condiciones: { [idCondicion]: bool }, requisitos, tiempos, ... }
// Las reglas (estructura y orden) están fijadas por el análisis; la política ajusta
// umbrales, activa o desactiva condiciones y define la matriz de requisitos.
import { PARAMETROS_DEF, PERFILES, DOCUMENTOS, REQUISITOS_DEF, TIEMPOS_DEF } from './data.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const pct = (x) => `${(x * 100).toFixed(1).replace('.', ',')} %`;
const usd = (x) => `USD ${Math.round(x).toLocaleString('es-EC')}`;
const r2 = (x) => Math.round(x * 100) / 100;

export function valoresPorDefecto() {
  return Object.fromEntries(PARAMETROS_DEF.map((p) => [p.id, p.valor]));
}

export function politicaInicial() {
  return {
    version: '1.0',
    estado: 'publicada',
    publicadaEn: null,
    autor: 'Diseño TO-BE (análisis)',
    justificacion: 'Versión inicial: reglas del análisis TO-BE y valores sugeridos para lo no definido.',
    valores: valoresPorDefecto(),
    condiciones: {},
    requisitos: clone(REQUISITOS_DEF),
    tiempos: clone(TIEMPOS_DEF),
  };
}

export function etiquetaVersion(pol) {
  return `Política de crédito v${pol.version} · simulada`;
}

export function siguienteVersion(v) {
  const [a, b] = v.split('.').map(Number);
  return `${a}.${b + 1}`;
}

/* ------------------------------------------------------------ utilidades */
export function cuotaMensual(monto, plazoMeses, tasaAnual) {
  const i = tasaAnual / 12;
  if (i === 0) return monto / plazoMeses;
  return (monto * i) / (1 - Math.pow(1 + i, -plazoMeses));
}

export function tablaAmortizacion(monto, plazoMeses, tasaAnual) {
  const cuota = cuotaMensual(monto, plazoMeses, tasaAnual);
  const i = tasaAnual / 12;
  let saldo = monto;
  const filas = [];
  for (let n = 1; n <= plazoMeses; n++) {
    const interes = saldo * i;
    const capital = n === plazoMeses ? saldo : cuota - interes;
    saldo = Math.max(0, saldo - capital);
    filas.push({ n, cuota: r2(capital + interes), interes: r2(interes), capital: r2(capital), saldo: r2(saldo) });
  }
  return { cuota: r2(cuota), filas };
}

export function categoriaBuro(score, v) {
  if (score >= v.scoreSuperior) return 'superior';
  if (score >= v.scoreBuenoMin) return 'bueno';
  if (score >= v.scoreMedioMin) return 'medio';
  return 'bajo (no definido en el análisis)';
}

export function ingresoEvaluado(perfil, verificacion, v) {
  if (perfil === 'IND_FACT') return verificacion.facturacionPromedio * v.margenFacturacion;
  return verificacion.ingreso;
}

/* ------------------------------------------------------------ reglas */
// Cada condición: { id, texto(v), test(input, v), bloqueada? }. "bloqueada" = no se
// puede desactivar (requisito legal o regla de cierre de la tabla).
const ratio = (i) => i.cuota / i.ingresoEvaluado;

export const REGLAS_PRECALIFICACION = [
  { id: 'P-01', salida: 'No precalifica', combinador: 'ALL', nombre: 'Sin autorizaciones válidas',
    condiciones: [{ id: 'P-01.aut', texto: () => 'Autorizaciones de buró y datos personales no válidas', test: (i) => !i.autorizacionesValidas, bloqueada: 'Requisito legal: sin autorización no se consulta el buró (LOPDP, S-19)' }],
    explicacion: () => 'Sin las autorizaciones firmadas y válidas no se consulta el buró ni se precalifica (S-19; tabla 14).',
    fuente: 'Tabla 14 · "No se puede precalificar sin la autorización firmada"' },
  { id: 'P-02', salida: 'No precalifica', combinador: 'ALL', nombre: 'Mora vigente',
    condiciones: [{ id: 'P-02.mora', texto: () => 'Mora vigente en buró', test: (i) => i.moraVigente }],
    explicacion: () => 'El buró reporta mora vigente.',
    fuente: 'El análisis no detalla el criterio de buró en 1.3; el demo usa "mora vigente" (criterio N0)' },
  { id: 'P-03', salida: 'No precalifica', combinador: 'ALL', nombre: 'Capacidad de pago',
    condiciones: [{ id: 'P-03.cap', texto: (v) => `Cuota / ingreso declarado > ${pct(v.capacidadMax)}`, test: (i, v) => i.cuota / i.ingresoDeclarado > v.capacidadMax }],
    explicacion: (i, v) => `La cuota estimada (${usd(i.cuota)}) es ${pct(i.cuota / i.ingresoDeclarado)} del ingreso declarado; el máximo es ${pct(v.capacidadMax)}.`,
    fuente: 'S-34 · Cuota máxima = 40 % del ingreso declarado' },
  { id: 'P-04', salida: 'Precalifica', combinador: 'ALL', nombre: 'Precalifica',
    condiciones: [{ id: 'P-04.resto', texto: () => 'Ninguna regla anterior se cumple', test: () => true, bloqueada: 'Regla de cierre de la tabla' }],
    explicacion: (i) => `Autorizaciones válidas, sin mora vigente y cuota de ${pct(i.cuota / i.ingresoDeclarado)} del ingreso declarado.`,
    fuente: 'Tarea 1.3' },
];

export const REGLAS_DECISION = [
  { id: 'D-N0', salida: 'N0', combinador: 'ANY', nombre: 'Rechazo automático',
    condiciones: [
      { id: 'D-N0.mora', texto: (v) => `Mora vigente o reciente (≤ ${v.moraRecienteMeses} meses) en buró`, test: (i, v) => i.moraVigente || (i.mesesDesdeUltimaMora != null && i.mesesDesdeUltimaMora <= v.moraRecienteMeses) },
      { id: 'D-N0.listas', texto: () => 'Coincidencia confirmada en listas', test: (i) => i.coincidenciaConfirmada },
      { id: 'D-N0.cap', texto: (v) => `Cuota > ${pct(v.capacidadMax)} del ingreso evaluado`, test: (i, v) => ratio(i) > v.capacidadMax },
      { id: 'D-N0.pol', texto: () => 'Fuera de política', test: (i) => i.fueraDePolitica },
    ],
    revision: 'Sin revisión humana, salvo que el cliente la solicite (art. 20 LOPDP).', fuente: 'Escala N0–N4 · N0' },
  { id: 'D-N4', salida: 'N4', combinador: 'ANY', nombre: 'Comité o excepción',
    condiciones: [
      { id: 'D-N4.monto', texto: (v) => `Monto > atribuciones (${usd(v.atribucionesMax)})`, test: (i, v) => i.monto > v.atribucionesMax },
      { id: 'D-N4.exc', texto: () => 'Excepción a la política', test: (i) => i.excepcionPolitica },
    ],
    revision: 'Evaluación completa (30 min) y comité diario.', fuente: 'Escala N0–N4 · N4' },
  { id: 'D-N1', salida: 'N1', combinador: 'ALL', nombre: 'Aprobación directa',
    condiciones: [
      { id: 'D-N1.buro', texto: (v) => `Buró superior (score ≥ ${v.scoreSuperior})`, test: (i, v) => i.score >= v.scoreSuperior },
      { id: 'D-N1.mora', texto: (v) => `Sin mora en ${v.mesesSinMoraN1} meses`, test: (i, v) => !i.moraVigente && (i.mesesDesdeUltimaMora == null || i.mesesDesdeUltimaMora > v.mesesSinMoraN1) },
      { id: 'D-N1.ing', texto: () => 'Ingreso verificado en fuente o por cruce', test: (i) => i.ingresoEnFuente },
      { id: 'D-N1.cap', texto: (v) => `Cuota ≤ ${pct(v.capacidadMax)}`, test: (i, v) => ratio(i) <= v.capacidadMax },
      { id: 'D-N1.tope', texto: (v) => `Monto ≤ tope N1 (${usd(v.topeN1)})`, test: (i, v) => i.monto <= v.topeN1 },
      { id: 'D-N1.id', texto: () => 'Identidad sin alerta', test: (i) => i.identidadOk },
      { id: 'D-N1.listas', texto: () => 'Listas sin alerta', test: (i) => !i.alertaListas },
    ],
    revision: 'Ninguna (verificación automática previa).', fuente: 'Escala N0–N4 · N1' },
  { id: 'D-N2', salida: 'N2', combinador: 'ALL', nombre: 'Revisión parcial',
    condiciones: [
      { id: 'D-N2.buro', texto: (v) => `Buró bueno o mejor (score ≥ ${v.scoreBuenoMin})`, test: (i, v) => i.score >= v.scoreBuenoMin },
      { id: 'D-N2.ing', texto: () => 'Ingreso NO verificable en fuente (único vacío)', test: (i) => !i.ingresoEnFuente },
      { id: 'D-N2.cap', texto: (v) => `Cuota < ${pct(v.cuotaCercanaMin)} (no cercana al límite)`, test: (i, v) => ratio(i) < v.cuotaCercanaMin },
      { id: 'D-N2.pat', texto: () => 'Sin patrimonio requerido', test: (i) => !i.patrimonioRequerido },
      { id: 'D-N2.disc', texto: () => 'Sin discrepancias del software', test: (i) => !i.discrepanciasSoftware },
      { id: 'D-N2.alertas', texto: () => 'Identidad y listas sin alerta', test: (i) => i.identidadOk && !i.alertaListas },
    ],
    revision: 'El analista revisa solo los documentos de ingreso (15 min).', fuente: 'Escala N0–N4 · N2 ("el único vacío es un ingreso no verificable")' },
  { id: 'D-N3', salida: 'N3', combinador: 'ANY', nombre: 'Revisión completa',
    condiciones: [
      { id: 'D-N3.buro', texto: (v) => `Buró medio (${v.scoreMedioMin}–${v.scoreBuenoMin - 1})`, test: (i, v) => i.score >= v.scoreMedioMin && i.score < v.scoreBuenoMin },
      { id: 'D-N3.cap', texto: (v) => `Cuota cercana al límite (${pct(v.cuotaCercanaMin)}–${pct(v.capacidadMax)})`, test: (i, v) => ratio(i) >= v.cuotaCercanaMin && ratio(i) <= v.capacidadMax },
      { id: 'D-N3.pat', texto: () => 'Patrimonio requerido', test: (i) => i.patrimonioRequerido },
      { id: 'D-N3.disc', texto: () => 'Discrepancias del software', test: (i) => i.discrepanciasSoftware },
    ],
    revision: 'Evaluación completa del analista (30 min).', fuente: 'Escala N0–N4 · N3' },
  { id: 'D-DEF', salida: 'N3', combinador: 'ALL', nombre: 'Regla por defecto del demo', porDefecto: true,
    condiciones: [{ id: 'D-DEF.resto', texto: () => 'Ninguna regla anterior se cumple', test: () => true, bloqueada: 'Regla de cierre: evita casos sin nivel' }],
    revision: 'Evaluación completa (30 min). Regla del demo, no definida en el análisis.', fuente: 'No definida en el análisis · ver discrepancias' },
];

export const ORDEN_FIRST = ['N0', 'N4', 'N1', 'N2', 'N3'];

export const condicionActiva = (pol, cond) => cond.bloqueada || pol.condiciones?.[cond.id] !== false;

// FIRST: primera regla que se cumple. Las condiciones inactivas no se evalúan; una regla
// sin condiciones activas no puede cumplirse.
function evaluarFirst(reglas, input, pol) {
  const v = pol.valores;
  const traza = reglas.map((r) => {
    const conds = r.condiciones.map((c) => {
      const activa = condicionActiva(pol, c);
      return { id: c.id, texto: c.texto(v), activa, cumple: activa ? !!c.test(input, v) : null };
    });
    const act = conds.filter((c) => c.activa);
    const cumple = act.length > 0 && (r.combinador === 'ANY' ? act.some((c) => c.cumple) : act.every((c) => c.cumple));
    return { reglaId: r.id, salida: r.salida, cumple, condiciones: conds };
  });
  const hit = traza.find((t) => t.cumple);
  return { regla: reglas.find((r) => r.id === hit.reglaId), hit, traza };
}

export function evaluarPrecalificacion(input, pol) {
  const { regla, traza } = evaluarFirst(REGLAS_PRECALIFICACION, input, pol);
  return {
    tabla: '1.3 Precalificación', hitPolicy: 'FIRST', reglaId: regla.id,
    precalifica: regla.salida === 'Precalifica', salida: regla.salida,
    explicacion: regla.explicacion(input, pol.valores), fuente: regla.fuente, traza,
    ratio: input.cuota / input.ingresoDeclarado, version: etiquetaVersion(pol),
  };
}

export function evaluarRequisitos({ perfil, monto }, pol) {
  const v = pol.valores;
  const docsPerfil = pol.requisitos[perfil] || [];
  const documentos = docsPerfil.map((id) => ({ id, nombre: DOCUMENTOS[id], reglaId: `R-${perfil}`, motivo: `Perfil: ${PERFILES[perfil].etiqueta}. ${PERFILES[perfil].verificacion}.` }));
  const patrimonioRequerido = monto >= v.patrimonioDesde;
  if (patrimonioRequerido) documentos.push({ id: 'PAT', nombre: DOCUMENTOS.PAT, reglaId: 'R-PAT', motivo: `Monto ${usd(monto)} ≥ ${usd(v.patrimonioDesde)}.` });
  return {
    tabla: '1.4 Requisitos documentales', hitPolicy: 'COLLECT', documentos, patrimonioRequerido,
    reglas: [`R-${perfil}`, ...(patrimonioRequerido ? ['R-PAT'] : [])],
    explicacion: documentos.length ? documentos.map((d) => d.nombre).join(', ') : 'Sin documentos: el ingreso se toma de la fuente.',
    version: etiquetaVersion(pol),
  };
}

export function evaluarDecision(input, pol) {
  const { regla, hit, traza } = evaluarFirst(REGLAS_DECISION, input, pol);
  const act = hit.condiciones.filter((c) => c.activa);
  let explicacion;
  if (regla.porDefecto) explicacion = 'Ninguna regla N0–N4 se cumple; el demo envía el caso a revisión completa (N3).';
  else if (regla.combinador === 'ANY') explicacion = `${regla.nombre}: ${act.filter((c) => c.cumple).map((c) => c.texto).join('; ')}.`;
  else explicacion = `${regla.nombre}: se cumplen todas las condiciones (${act.map((c) => c.texto).join('; ')}).`;
  return {
    tabla: '3.1 Decisión N0–N4', hitPolicy: 'FIRST', orden: ORDEN_FIRST, reglaId: regla.id, nivel: regla.salida,
    nombre: regla.nombre, explicacion, revision: regla.revision, fuente: regla.fuente, porDefecto: !!regla.porDefecto,
    categoriaBuro: categoriaBuro(input.score, pol.valores), ratio: ratio(input), traza, version: etiquetaVersion(pol),
  };
}

/* ------------------------------------------------------------ control */
// Errores bloquean la publicación; advertencias se muestran pero no bloquean.
export function validarPolitica(pol) {
  const v = pol.valores;
  const errores = [];
  const advertencias = [];
  for (const def of PARAMETROS_DEF) {
    const x = v[def.id];
    if (typeof x !== 'number' || !Number.isFinite(x)) errores.push(`${def.etiqueta}: debe ser numérico.`);
    else if (x < 0) errores.push(`${def.etiqueta}: no puede ser negativo.`);
    else if (def.tipo === 'pct' && x > 1) errores.push(`${def.etiqueta}: debe estar entre 0 % y 100 %.`);
  }
  if (errores.length) return { errores, advertencias };
  if (!(v.scoreSuperior > v.scoreBuenoMin && v.scoreBuenoMin > v.scoreMedioMin)) errores.push('Rangos de score: debe cumplirse superior > bueno > medio.');
  if (!(v.cuotaCercanaMin < v.capacidadMax)) errores.push('"Cuota cercana" debe ser menor que la cuota máxima.');
  if (v.topeN1 > v.atribucionesMax) errores.push('El tope N1 no puede superar las atribuciones.');
  if (!(v.capacidadMax > 0)) errores.push('La cuota máxima debe ser mayor que 0 %.');
  if (!(v.tasaAnual > 0)) errores.push('La tasa anual debe ser mayor que 0 %.');
  for (const [k, t] of Object.entries(pol.tiempos)) {
    for (const [canal, par] of Object.entries(t)) {
      if (canal === 'fuente') continue;
      if (!Array.isArray(par) || par.some((n) => typeof n !== 'number' || !(n >= 0))) errores.push(`Tiempo ${k}/${canal}: valores numéricos ≥ 0.`);
    }
  }
  for (const r of [...REGLAS_PRECALIFICACION, ...REGLAS_DECISION]) {
    if (!r.condiciones.some((c) => condicionActiva(pol, c))) advertencias.push(`La regla ${r.id} (${r.nombre}) no tiene condiciones activas: nunca se cumplirá.`);
  }
  for (const perfil of ['REM_OTRA', 'NEG_POP']) {
    if (!(pol.requisitos[perfil] || []).length) advertencias.push(`${PERFILES[perfil].etiqueta}: su ingreso no es verificable en fuente y no tiene documento requerido.`);
  }
  if (v.capacidadMax !== 0.4) advertencias.push('La cuota máxima difiere del 40 % definido por la política de la entidad (Supuestos B14).');
  return { errores, advertencias };
}

// Diferencias entre dos políticas (para la bitácora de cambios).
export function diffPolitica(a, b) {
  const cambios = [];
  for (const def of PARAMETROS_DEF) {
    if (a.valores[def.id] !== b.valores[def.id]) cambios.push({ campo: def.etiqueta, antes: a.valores[def.id], despues: b.valores[def.id] });
  }
  for (const r of [...REGLAS_PRECALIFICACION, ...REGLAS_DECISION]) {
    for (const c of r.condiciones) {
      const x = condicionActiva(a, c); const y = condicionActiva(b, c);
      if (x !== y) cambios.push({ campo: `${c.id} · ${c.texto(b.valores)}`, antes: x ? 'activa' : 'inactiva', despues: y ? 'activa' : 'inactiva' });
    }
  }
  for (const perfil of Object.keys(PERFILES)) {
    const x = (a.requisitos[perfil] || []).join('+') || '—'; const y = (b.requisitos[perfil] || []).join('+') || '—';
    if (x !== y) cambios.push({ campo: `Requisitos · ${PERFILES[perfil].etiqueta}`, antes: x, despues: y });
  }
  for (const [k, t] of Object.entries(b.tiempos)) {
    for (const [canal, par] of Object.entries(t)) {
      if (canal === 'fuente') continue;
      const prev = a.tiempos[k]?.[canal];
      if (JSON.stringify(prev) !== JSON.stringify(par)) cambios.push({ campo: `Tiempo ${k} · ${canal} (min, h)`, antes: prev, despues: par });
    }
  }
  return cambios;
}

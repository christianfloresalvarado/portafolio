// Registro de auditoría append-only con hash encadenado (FNV-1a de 32 bits).
// El hash detecta alteraciones accidentales en el demo; NO es una garantía criptográfica.

function fnv1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const CAMPOS_HASH = ['seq', 'ts', 'casoId', 'rol', 'tareaId', 'tarea', 'accion', 'antes', 'despues', 'reglaVersion', 'evidencia', 'relojH', 'prevHash'];

function contenidoHash(e) {
  return JSON.stringify(CAMPOS_HASH.map((k) => e[k] ?? null));
}

export function createAudit(eventos = []) {
  const log = eventos;

  function registrar({ casoId = null, rol, tareaId = null, tarea = null, accion, antes = null, despues = null, reglaVersion = null, evidencia = null, relojH = null, tipo = 'evento' }) {
    const prev = log[log.length - 1];
    const e = {
      seq: log.length + 1,
      ts: new Date().toISOString(),
      casoId, rol, tareaId, tarea, accion, tipo,
      antes, despues, reglaVersion, evidencia,
      relojH: relojH == null ? null : Math.round(relojH * 100) / 100,
      prevHash: prev ? prev.hash : '00000000',
    };
    e.hash = fnv1a(contenidoHash(e));
    log.push(e);
    return e;
  }

  // Recalcula la cadena; devuelve el primer seq roto o null si está íntegra.
  function verificar() {
    let prev = '00000000';
    for (const e of log) {
      if (e.prevHash !== prev || fnv1a(contenidoHash(e)) !== e.hash) return e.seq;
      prev = e.hash;
    }
    return null;
  }

  return { log, registrar, verificar };
}

const COLUMNAS = ['seq', 'ts', 'relojH', 'casoId', 'rol', 'tareaId', 'tarea', 'accion', 'tipo', 'antes', 'despues', 'reglaVersion', 'evidencia', 'prevHash', 'hash'];

function celda(v) {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function aCSV(eventos) {
  const filas = [COLUMNAS.join(',')];
  for (const e of eventos) filas.push(COLUMNAS.map((k) => celda(e[k])).join(','));
  return '﻿' + filas.join('\r\n');
}

export function aJSON(eventos, meta = {}) {
  return JSON.stringify({ exportado: new Date().toISOString(), aviso: 'Demo con datos ficticios · no es un sistema real', ...meta, eventos }, null, 2);
}

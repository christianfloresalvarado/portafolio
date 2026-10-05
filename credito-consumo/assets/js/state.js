// Estado del demo en memoria, con persistencia opcional en localStorage.
// Toda lectura/escritura de almacenamiento va en try/catch: el demo funciona sin él.
import { politicaInicial, etiquetaVersion } from './dmn.js';

const CLAVE = 'demo-p031-tobe-v1';
const CLAVE_PREF = 'demo-p031-prefs';

function leer(clave) {
  try { const s = globalThis.localStorage?.getItem(clave); return s ? JSON.parse(s) : null; } catch { return null; }
}
function escribir(clave, valor) {
  try { globalThis.localStorage?.setItem(clave, JSON.stringify(valor)); return true; } catch { return false; }
}
function borrar(clave) {
  try { globalThis.localStorage?.removeItem(clave); } catch { /* sin almacenamiento */ }
}

export function createStore() {
  const prefs = { persistir: true, rol: 'todos', tema: 'auto', ...(leer(CLAVE_PREF) || {}) };
  const guardado = prefs.persistir ? leer(CLAVE) : null;
  const pol0 = politicaInicial();
  pol0.publicadaEn = new Date().toISOString();

  const state = {
    cases: guardado?.cases || [],
    auditLog: guardado?.auditLog || [],
    politicas: guardado?.politicas || [pol0],
    borrador: guardado?.borrador || null,
    sesionId: `S-${Date.now().toString(36)}`,
    prefs,
  };

  const listeners = new Set();
  let pendiente = null;

  function guardar() {
    if (!state.prefs.persistir) return;
    const { cases, auditLog, politicas, borrador } = state;
    escribir(CLAVE, { cases, auditLog, politicas, borrador });
  }

  function emit(detalle) {
    for (const fn of listeners) fn(detalle);
    clearTimeout(pendiente);
    pendiente = setTimeout(guardar, 150);
  }

  return {
    state,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    emit,
    politica: () => state.politicas[state.politicas.length - 1],
    versionActual: () => etiquetaVersion(state.politicas[state.politicas.length - 1]),
    setPref(k, val) {
      state.prefs[k] = val;
      escribir(CLAVE_PREF, state.prefs);
      if (k === 'persistir') (val ? guardar() : borrar(CLAVE));
      emit({ pref: k });
    },
    reiniciar() {
      borrar(CLAVE);
      state.cases.length = 0;
      state.auditLog.length = 0;
      state.politicas.splice(0, state.politicas.length, pol0);
      state.borrador = null;
      emit({ reinicio: true });
    },
  };
}

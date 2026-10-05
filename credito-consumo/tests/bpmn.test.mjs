// Consistencia entre el motor y el BPMN real: todo ID que usa el demo existe en el archivo
// y todo flujo de secuencia del proceso P-03.1 está modelado en el motor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FLUJOS, TAREAS, EVENTOS, COMPUERTAS, CARRILES, PROCESO } from '../assets/js/data.js';

const xml = readFileSync(new URL('../docs/BPMN_TO-BE_P-03.1_Concesion_Credito.bpmn', import.meta.url), 'utf8');
const attr = (tag) => [...xml.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map((m) => m[0]);
const get = (el, a) => (el.match(new RegExp(`\\s${a}="([^"]*)"`)) || [])[1];

test('Todas las tareas existen con el mismo nombre', () => {
  const tareas = Object.fromEntries(['userTask', 'serviceTask', 'businessRuleTask'].flatMap(attr).map((e) => [get(e, 'id'), get(e, 'name')]));
  for (const t of TAREAS) assert.equal(tareas[t.id], `${t.cod} ${t.nombre}`, t.id);
  assert.equal(Object.keys(tareas).length, TAREAS.length);
});

test('Eventos de inicio y fin coinciden', () => {
  const ev = Object.fromEntries([...attr('startEvent'), ...attr('endEvent')].map((e) => [get(e, 'id'), get(e, 'name')]));
  for (const [id, e] of Object.entries(EVENTOS)) assert.equal(ev[id], e.nombre, id);
  assert.equal(Object.keys(ev).length, Object.keys(EVENTOS).length);
});

test('Compuertas modeladas', () => {
  const g = [...attr('exclusiveGateway'), ...attr('parallelGateway')].map((e) => get(e, 'id'));
  assert.deepEqual(new Set(g), new Set(Object.keys(COMPUERTAS)));
});

test('Flujos de secuencia: mismos IDs, origen y destino', () => {
  const sf = attr('sequenceFlow').map((e) => [get(e, 'id'), get(e, 'sourceRef'), get(e, 'targetRef')]);
  assert.equal(sf.length, Object.keys(FLUJOS).length);
  for (const [id, s, t] of sf) assert.deepEqual(FLUJOS[id]?.slice(0, 2), [s, t], id);
});

test('Carriles y mensaje saliente hacia P-03.2', () => {
  const lanes = Object.fromEntries(attr('lane').map((e) => [get(e, 'id'), get(e, 'name')]));
  for (const [id, n] of Object.entries(CARRILES)) assert.equal(lanes[id], n, id);
  const mf = attr('messageFlow')[0];
  assert.equal(get(mf, 'id'), PROCESO.mensajeSaliente.id);
  assert.equal(get(mf, 'sourceRef'), 'B_EF');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASOS } from '../assets/js/casos.js';
import { nuevoMotor, correr, GUION } from './helpers.mjs';
import { relojTotal } from '../assets/js/flow.js';
import { TABLA12 } from '../assets/js/data.js';

for (const caso of CASOS) {
  test(`Caso ${caso.n}: ${caso.titulo} → ${caso.esperado.fin}`, async () => {
    const { engine, audit } = nuevoMotor();
    const c = engine.crearCaso(caso);
    await correr(engine, c);
    assert.equal(c.error, undefined);
    assert.equal(c.fin.id, caso.esperado.fin);
    if (caso.esperado.nivel) assert.equal(c.data.decision.nivel, caso.esperado.nivel);
    assert.equal(audit.verificar(), null, 'cadena de auditoría íntegra');
  });
}

test('Caso 7 pasa por 2.3 y vuelve a 2.1', async () => {
  const { engine } = nuevoMotor();
  const c = engine.crearCaso(CASOS[6]);
  await correr(engine, c);
  assert.ok(c.flows.includes('F_B_G2_B_T5b'));
  assert.ok(c.flows.includes('F_B_T5b_B_T6'));
  assert.equal(c.visited.filter((n) => n === 'B_T6').length, 2);
});

test('Caso 1 (N1 digital) cumple el tiempo de diseño de la tabla 12', async () => {
  const { engine } = nuevoMotor();
  const c = engine.crearCaso(CASOS[0]);
  await correr(engine, c);
  assert.ok(Math.abs(relojTotal(c) - TABLA12.N1.digital) < 0.01, `reloj ${relojTotal(c)}`);
});

test('Casos N2–N4 en agencia cumplen la tabla 12 (sin reproceso)', async () => {
  for (const [k, nivel] of [[1, 'N2'], [2, 'N3'], [3, 'N4']]) {
    const { engine } = nuevoMotor();
    const c = engine.crearCaso(CASOS[k]);
    await correr(engine, c);
    assert.ok(Math.abs(relojTotal(c) - TABLA12[nivel].agencia) < 0.01, `${nivel}: reloj ${relojTotal(c)}`);
  }
});

test('Caso 6 publica el rechazo por PLA sin pasar por el DMN 3.1', async () => {
  const { engine } = nuevoMotor();
  const c = engine.crearCaso(CASOS[5]);
  await correr(engine, c);
  assert.ok(!c.visited.includes('B_T11'));
});

test('Desembolso publica el mensaje "operación desembolsada" hacia P-03.2', async () => {
  const { engine, audit } = nuevoMotor();
  const c = engine.crearCaso(CASOS[0]);
  await correr(engine, c);
  assert.equal(c.mensajes[0].id, 'MF_TOBE_0');
  assert.ok(audit.log.some((e) => e.tipo === 'mensaje-saliente'));
});

test('Fines no cubiertos por los casos: No precalifica y No aprobada', async () => {
  const { engine } = nuevoMotor();
  const a = engine.crearCaso({ ...CASOS[0], ingresoDeclarado: 400 });
  await correr(engine, a);
  assert.equal(a.fin.id, 'B_E0');
  const b = engine.crearCaso(CASOS[1]);
  await correr(engine, b, { ...GUION, B_T13: () => ({ aprobada: false, motivo: 'Sustento de ingreso insuficiente' }) });
  assert.equal(b.fin.id, 'B_E2');
});

test('N0 → revisión humana (art. 20 LOPDP) reabre en 3.3', async () => {
  const { engine } = nuevoMotor();
  const c = engine.crearCaso(CASOS[4]);
  await correr(engine, c);
  await engine.solicitarRevisionHumana(c.id, 'Mi ingreso real es mayor');
  assert.equal(c.node, 'B_T12b');
  await correr(engine, c);
  assert.equal(c.fin.id, 'B_EF');
});

test('Acciones inválidas se rechazan', async () => {
  const { engine } = nuevoMotor();
  const c = engine.crearCaso(CASOS[0]);
  await assert.rejects(engine.completar(c.id, { autorizaciones: { buro: 'x' } }), /autorizaciones/);
});

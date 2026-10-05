import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as dmn from '../assets/js/dmn.js';

const pol = () => dmn.politicaInicial();
// Entrada base de 3.1: cumple N1 con los parámetros por defecto.
const base = (o = {}) => ({
  score: 820, moraVigente: false, mesesDesdeUltimaMora: null, coincidenciaConfirmada: false, alertaListas: false,
  identidadOk: true, ingresoEvaluado: 1000, ingresoEnFuente: true, cuota: 280, monto: 6000,
  patrimonioRequerido: false, discrepanciasSoftware: false, fueraDePolitica: false, excepcionPolitica: false, ...o,
});
const nivel = (o, p = pol()) => dmn.evaluarDecision(base(o), p);

test('N1 · aprobación directa', () => assert.equal(nivel({}).nivel, 'N1'));
test('N0 · cuota > 40 %', () => assert.equal(nivel({ cuota: 460 }).reglaId, 'D-N0'));
test('N0 · cuota exactamente 40 % no es N0', () => assert.notEqual(nivel({ cuota: 400 }).nivel, 'N0'));
test('N0 · mora vigente', () => assert.equal(nivel({ moraVigente: true }).nivel, 'N0'));
test('N0 · mora reciente (≤ 12 meses)', () => assert.equal(nivel({ mesesDesdeUltimaMora: 10 }).nivel, 'N0'));
test('Mora a 18 meses: no N0 ni N1', () => assert.equal(nivel({ mesesDesdeUltimaMora: 18 }).nivel, 'N3'));
test('N0 · coincidencia confirmada en listas', () => assert.equal(nivel({ coincidenciaConfirmada: true }).nivel, 'N0'));
test('N0 · fuera de política', () => assert.equal(nivel({ fueraDePolitica: true }).nivel, 'N0'));
test('FIRST · N0 gana a N4', () => assert.equal(nivel({ cuota: 460, monto: 25000 }).nivel, 'N0'));
test('N4 · monto sobre atribuciones gana a N1', () => assert.equal(nivel({ monto: 25000 }).nivel, 'N4'));
test('N4 · excepción a la política', () => assert.equal(nivel({ excepcionPolitica: true }).nivel, 'N4'));
test('N2 · buró bueno e ingreso no verificable', () => assert.equal(nivel({ score: 750, ingresoEnFuente: false, cuota: 300 }).nivel, 'N2'));
test('N3 · buró medio', () => assert.equal(nivel({ score: 650 }).nivel, 'N3'));
test('N3 · cuota cercana al 40 % (38 %) con ingreso no verificable', () => assert.equal(nivel({ score: 750, ingresoEnFuente: false, cuota: 380 }).nivel, 'N3'));
test('N3 · patrimonio requerido sin fuente', () => assert.equal(nivel({ score: 750, ingresoEnFuente: false, patrimonioRequerido: true }).reglaId, 'D-N3'));
test('Vacío del diseño: buró superior, verificado, monto entre tope N1 y atribuciones → regla por defecto', () => {
  const r = nivel({ monto: 15000 });
  assert.equal(r.reglaId, 'D-DEF');
  assert.equal(r.nivel, 'N3');
});
test('Vacío del diseño: buró bueno con ingreso verificado → regla por defecto', () => assert.equal(nivel({ score: 750 }).reglaId, 'D-DEF'));
test('N1 ignora discrepancias del software (orden FIRST del diseño)', () => assert.equal(nivel({ discrepanciasSoftware: true }).nivel, 'N1'));

test('Parametrización: subir el tope N1 cambia N3/DEF → N1', () => {
  const p = pol(); p.valores.topeN1 = 20000;
  assert.equal(nivel({ monto: 15000 }, p).nivel, 'N1');
});
test('Parametrización: desactivar la condición de buró de N1 deja aprobar con score bueno', () => {
  const p = pol(); p.condiciones['D-N1.buro'] = false;
  assert.equal(nivel({ score: 750 }, p).nivel, 'N1');
});
test('Condición bloqueada no se puede desactivar', () => {
  const p = pol(); p.condiciones['P-01.aut'] = false;
  const r = dmn.evaluarPrecalificacion({ autorizacionesValidas: false, moraVigente: false, cuota: 100, ingresoDeclarado: 1000 }, p);
  assert.equal(r.reglaId, 'P-01');
});
test('Regla sin condiciones activas nunca se cumple', () => {
  const p = pol(); p.condiciones['D-N4.monto'] = false; p.condiciones['D-N4.exc'] = false;
  assert.equal(nivel({ monto: 25000 }, p).nivel, 'N3');
  assert.ok(dmn.validarPolitica(p).advertencias.some((a) => a.includes('D-N4')));
});

test('Precalificación usa el ingreso declarado y el 40 %', () => {
  const ok = dmn.evaluarPrecalificacion({ autorizacionesValidas: true, moraVigente: false, cuota: 400, ingresoDeclarado: 1000 }, pol());
  const no = dmn.evaluarPrecalificacion({ autorizacionesValidas: true, moraVigente: false, cuota: 401, ingresoDeclarado: 1000 }, pol());
  assert.equal(ok.precalifica, true);
  assert.equal(no.reglaId, 'P-03');
});
test('Precalificación: sin autorización no precalifica', () => {
  assert.equal(dmn.evaluarPrecalificacion({ autorizacionesValidas: false, moraVigente: false, cuota: 1, ingresoDeclarado: 1000 }, pol()).reglaId, 'P-01');
});

test('Requisitos por perfil y patrimonio por monto', () => {
  const r = dmn.evaluarRequisitos({ perfil: 'NEG_POP', monto: 12000 }, pol());
  assert.deepEqual(r.documentos.map((d) => d.id), ['NV', 'PAT']);
  assert.equal(dmn.evaluarRequisitos({ perfil: 'REM_BANCO', monto: 5000 }, pol()).documentos.length, 0);
  assert.deepEqual(dmn.evaluarRequisitos({ perfil: 'DEP_IESS', monto: 5000 }, pol()).documentos.map((d) => d.id), ['CERT']);
  assert.deepEqual(dmn.evaluarRequisitos({ perfil: 'IND_FACT', monto: 5000 }, pol()).documentos.map((d) => d.id), ['XML']);
  assert.deepEqual(dmn.evaluarRequisitos({ perfil: 'REM_OTRA', monto: 5000 }, pol()).documentos.map((d) => d.id), ['REM']);
});

test('Validación de política: rangos de score incoherentes bloquean la publicación', () => {
  const p = pol(); p.valores.scoreBuenoMin = 850;
  assert.ok(dmn.validarPolitica(p).errores.length > 0);
});
test('Validación: tope N1 sobre atribuciones es error', () => {
  const p = pol(); p.valores.topeN1 = 30000;
  assert.ok(dmn.validarPolitica(p).errores.some((e) => e.includes('tope N1')));
});
test('Diff de política registra antes y después', () => {
  const a = pol(); const b = pol(); b.valores.topeN1 = 12000; b.condiciones['D-N3.disc'] = false;
  const d = dmn.diffPolitica(a, b);
  assert.equal(d.length, 2);
  assert.equal(d[0].antes, 10000);
});
test('Cuota francesa y tabla de amortización cuadran', () => {
  const t = dmn.tablaAmortizacion(6000, 36, 0.15);
  assert.equal(t.filas.length, 36);
  assert.equal(t.filas.at(-1).saldo, 0);
  assert.ok(Math.abs(t.cuota - 207.99) < 0.01);
});

// Utilidades compartidas por las pruebas en Node.
import { createAudit } from '../assets/js/audit.js';
import { createMocks } from '../assets/js/integrations.mock.js';
import { createEngine } from '../assets/js/flow.js';
import { politicaInicial } from '../assets/js/dmn.js';

export function nuevoMotor(pol = politicaInicial()) {
  const cases = [];
  const audit = createAudit([]);
  const engine = createEngine({ cases, audit, mocks: createMocks({ latencia: [0, 0] }), getPolitica: () => pol });
  return { cases, audit, engine, pol };
}

// Guion de acciones humanas por caso: decide qué responder en cada tarea.
export const GUION = {
  B_T1: (c) => ({ autorizaciones: { buro: 'autorizacion_buro.pdf (simulado)', datos: 'autorizacion_datos.pdf (simulado)' } }),
  B_T5: (c) => ({ adjuntos: c.data.requisitos.documentos.map((d) => d.id) }),
  B_T5b: (c) => ({ adjuntos: c.data.pendientesCorreccion }),
  B_T6: (c) => ({ confirmaciones: c.data.extraccion.camposBajoUmbral.map((f) => ({ ...f, valor: c.data.extraccion.docs.find((d) => d.docId === f.docId).campos.find((x) => x.campo === f.campo).valor, motivo: 'Cotejado con el documento' })) }),
  B_T10: (c) => ({ descartada: false, motivo: 'Coincidencia confirmada con el registro de la lista' }),
  B_T12a: () => ({ recomendacion: 'aprobar', observacion: 'Ingreso sustentado con recurrencia' }),
  B_T12b: () => ({ recomendacion: 'aprobar', observacion: 'Expediente completo y coherente' }),
  B_T13: () => ({ aprobada: true, motivo: 'Dentro de política', excepcion: 'Monto sobre atribuciones; acta del comité diario' }),
  B_T15: (c) => (c.casoN === 8 ? { continua: false, motivo: 'El cliente ya no necesita el crédito' } : { continua: true }),
  B_T16: (c, engine) => ({ checklist: Object.fromEntries(engine.checklist(c).map((i) => [i.id, true])) }),
};

export async function correr(engine, c, guion = GUION, max = 40) {
  await engine.ejecutar(c);
  for (let i = 0; i < max && c.status === 'abierto'; i++) {
    const fn = guion[c.node];
    if (!fn) throw new Error(`Sin guion para ${c.node}`);
    await engine.completar(c.id, fn(c, engine));
  }
  return c;
}

// Casos precargados: uno por ruta. Nombres y cédulas FICTICIOS (prefijo FICT).
// "escenario" fija lo que responderán las integraciones simuladas; no es dato del cliente.
// Ingresos calculados para la cuota objetivo con la tasa simulada por defecto (15 % anual).

const base = {
  autorizaciones: { firmaDetectada: true, fechaVigente: true, legible: true },
  buro: { score: 820, moraVigente: false, mesesDesdeUltimaMora: null },
  identidad: { ok: true, similitud: 0.97 },
  listas: 'ninguna',
  xmlValido: true,
  extraccion: { ilegiblePrimerIntento: false, campoBajoUmbral: null },
  fueraDePolitica: false,
  excepcionPolitica: false,
};
const esc = (over) => ({ ...base, ...over, buro: { ...base.buro, ...(over.buro || {}) }, extraccion: { ...base.extraccion, ...(over.extraccion || {}) } });

export const CASOS = [
  {
    n: 1, titulo: 'Dependiente IESS · buró superior · cuota 28 %', esperado: { nivel: 'N1', fin: 'B_EF' },
    canal: 'digital', solicitante: { nombre: 'Lucía Prueba Andrade', cedula: 'FICT-0000000001' },
    perfil: 'DEP_IESS', monto: 6000, plazo: 36, ingresoDeclarado: 743,
    escenario: esc({ buro: { score: 820 }, ingresoFuente: 743 }),
  },
  {
    n: 2, titulo: 'Remesista por otra vía · buró bueno · cuota 30 %', esperado: { nivel: 'N2', fin: 'B_EF' },
    canal: 'agencia', solicitante: { nombre: 'Jorge Ficticio Salazar', cedula: 'FICT-0000000002' },
    perfil: 'REM_OTRA', monto: 4000, plazo: 24, ingresoDeclarado: 646,
    escenario: esc({ buro: { score: 750 }, ingresoFuente: 646 }),
  },
  {
    n: 3, titulo: 'Negocio popular · buró medio · cuota 38 % · con patrimonio', esperado: { nivel: 'N3', fin: 'B_EF' },
    canal: 'agencia', solicitante: { nombre: 'Rosa Demo Quishpe', cedula: 'FICT-0000000003' },
    perfil: 'NEG_POP', monto: 12000, plazo: 48, ingresoDeclarado: 879,
    escenario: esc({ buro: { score: 650 }, ingresoFuente: 879, extraccion: { campoBajoUmbral: { doc: 'NV', campo: 'Total de ventas del mes', confianza: 0.78 } } }),
  },
  {
    n: 4, titulo: 'Independiente que factura · buró superior · USD 25.000', esperado: { nivel: 'N4', fin: 'B_EF' },
    canal: 'agencia', solicitante: { nombre: 'Andrés Simulado Mora', cedula: 'FICT-0000000004' },
    perfil: 'IND_FACT', monto: 25000, plazo: 60, ingresoDeclarado: 1859,
    escenario: esc({ buro: { score: 830 }, facturacionPromedio: 6197 }),
  },
  {
    n: 5, titulo: 'Cuota 46 % del ingreso verificado → N0', esperado: { nivel: 'N0', fin: 'B_E2a' },
    canal: 'digital', solicitante: { nombre: 'Carla Ejemplo Vera', cedula: 'FICT-0000000005' },
    perfil: 'DEP_IESS', monto: 8000, plazo: 36, ingresoDeclarado: 750,
    nota: 'Declara USD 750 (cuota 37 %: precalifica); el IESS verifica USD 603 (cuota 46 %): N0.',
    escenario: esc({ buro: { score: 760 }, ingresoFuente: 603 }),
  },
  {
    n: 6, titulo: 'Coincidencia en listas → Cumplimiento', esperado: { nivel: null, fin: 'B_EP' },
    canal: 'agencia', solicitante: { nombre: 'Pedro Muestra Cedeño', cedula: 'FICT-0000000006' },
    perfil: 'DEP_IESS', monto: 5000, plazo: 36, ingresoDeclarado: 642,
    escenario: esc({ buro: { score: 790 }, ingresoFuente: 642, listas: 'posible' }),
  },
  {
    n: 7, titulo: 'Documento ilegible → 2.3 corrección → vuelve a 2.1', esperado: { nivel: 'N1', fin: 'B_EF' },
    canal: 'digital', solicitante: { nombre: 'Elena Prueba Torres', cedula: 'FICT-0000000007' },
    perfil: 'DEP_IESS', monto: 5000, plazo: 36, ingresoDeclarado: 693,
    escenario: esc({ buro: { score: 810 }, ingresoFuente: 693, extraccion: { ilegiblePrimerIntento: true } }),
  },
  {
    n: 8, titulo: 'Aprobado que desiste en 5.2', esperado: { nivel: 'N1', fin: 'B_E3' },
    canal: 'agencia', solicitante: { nombre: 'Diego Ficticio Paredes', cedula: 'FICT-0000000008' },
    perfil: 'REM_BANCO', monto: 7000, plazo: 36, ingresoDeclarado: 899,
    escenario: esc({ buro: { score: 805 }, ingresoFuente: 899 }),
  },
];

// Escenario neutro para "Nueva solicitud" (el usuario lo ajusta en el formulario).
export function escenarioNuevo() {
  return esc({ buro: { score: 780 }, ingresoFuente: null, facturacionPromedio: null });
}

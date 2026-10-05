// Integraciones SIMULADAS. Ninguna llamada sale del navegador: cada función espera una
// latencia artificial (300–1200 ms por defecto) y responde según el "escenario" del caso.
// Cada respuesta trae _meta { sistema, ref, ms } para guardarla como evidencia en auditoría.

const DOCS_CAMPOS = {
  CERT: (c, ing) => [
    ['Empleador', 'Comercial Ficticia S.A.'], ['RUC del empleador', 'FICT-RUC-0990000001'],
    ['Ingreso mensual', ing], ['Fecha de emisión', fechaRel(-12)],
  ],
  REM: (c, ing) => [
    ['Remitente', 'Remitente Ficticio'], ['Comprobantes con recurrencia', '6 de 6 meses'],
    ['Monto promedio mensual', ing], ['Período', 'Últimos 6 meses'],
  ],
  XML: (c, fact) => [
    ['Emisor (RUC)', 'FICT-RUC-1790000004'], ['Facturas leídas', 12],
    ['Facturación promedio mensual', fact], ['Firma electrónica del XML', 'Presente'],
  ],
  NV: (c, ing) => [
    ['Total de ventas del mes', ing], ['Período', 'Último mes'], ['Identificación tributaria', 'FICT-RIMPE-0001'],
  ],
  PAT: (c) => [['Tipo de bien', 'Vehículo (simulado)'], ['Valor declarado', Math.round(c.monto * 1.5)]],
};

function fechaRel(dias) {
  const d = new Date(Date.now() + dias * 864e5);
  return d.toISOString().slice(0, 10);
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function rngFor(seed) {
  let a = hashStr(seed);
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createMocks({ latencia = [300, 1200] } = {}) {
  let contador = 0;
  const espera = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

  async function llamar(sistema, prefijo, fn) {
    const [min, max] = latencia;
    const ms = max > 0 ? Math.round(min + Math.random() * (max - min)) : 0;
    await espera(ms);
    contador += 1;
    const ref = `SIM-${prefijo}-${String(contador).padStart(5, '0')}`;
    return { ...fn(), _meta: { sistema: `${sistema} (simulado)`, ref, ms } };
  }

  const ingFuente = (c) => c.escenario.ingresoFuente ?? c.ingresoDeclarado;
  const facturacion = (c, p) => c.escenario.facturacionPromedio ?? Math.round(c.ingresoDeclarado / p.margenFacturacion);

  return {
    validarAutorizaciones: (c) => llamar('Software de extracción · autorizaciones', 'AUT', () => {
      const a = c.escenario.autorizaciones;
      return { ...a, valida: a.firmaDetectada && a.fechaVigente && a.legible,
        nota: 'El software detecta la presencia de firma; no la autentica (S-19).' };
    }),

    consultarBuro: (c) => llamar('Buró de crédito', 'BUR', () => ({ ...c.escenario.buro })),

    extraerDocumentos: (c, intento, p, requeridos) => llamar('Software de extracción documental', 'EXT', () => {
      const rnd = rngFor(`${c.id}-${intento}`);
      const docs = requeridos.map((d, k) => {
        const ilegible = c.escenario.extraccion.ilegiblePrimerIntento && intento === 1 && k === 0;
        const valor = d.id === 'XML' ? facturacion(c, p) : ingFuente(c);
        const campos = DOCS_CAMPOS[d.id](c, valor).map(([campo, v]) => {
          let confianza = d.id === 'XML' ? 1 : 0.9 + rnd() * 0.09;
          const low = c.escenario.extraccion.campoBajoUmbral;
          if (low && low.doc === d.id && low.campo === campo) confianza = low.confianza;
          if (ilegible) confianza = 0.35 + rnd() * 0.15;
          return { campo, valor: v, confianza: Math.round(confianza * 100) / 100 };
        });
        return {
          docId: d.id, nombre: d.nombre, archivo: `${d.id.toLowerCase()}_${c.id}_v${intento}.pdf (simulado)`,
          legible: !ilegible, firma: !ilegible, fechaVigente: true, campos,
          observacion: ilegible ? 'Documento ilegible: no se pueden leer montos ni firma.' : null,
        };
      });
      return { intento, docs, umbral: p.confianzaMin };
    }),

    verificarIngresoFuente: (c, extraccion, p) => {
      const sistemas = {
        DEP_IESS: ['IESS · historia laboral y SRI · RUC del empleador', 'IES'],
        REM_BANCO: ['Core bancario · remesas recibidas', 'COR'],
        REM_OTRA: ['Sin fuente: comprobantes con recurrencia', 'REM'],
        IND_FACT: ['SRI · validez de comprobantes XML', 'SRI'],
        NEG_POP: ['Sin fuente: notas de venta (forma validada)', 'NVT'],
      };
      const [sistema, pref] = sistemas[c.perfil];
      return llamar(sistema, pref, () => {
        const campo = (docId, nombre) => extraccion.docs.find((d) => d.docId === docId)?.campos.find((f) => f.campo === nombre)?.valor;
        switch (c.perfil) {
          case 'DEP_IESS': return { enFuente: true, metodo: 'Historia laboral IESS + RUC del empleador activo', ingreso: ingFuente(c), rucEmpleadorActivo: true, conforme: true };
          case 'REM_BANCO': return { enFuente: true, metodo: 'Remesas acreditadas en el core (promedio 6 meses)', ingreso: ingFuente(c), conforme: true };
          case 'REM_OTRA': return { enFuente: false, metodo: 'Comprobantes de remesas con recurrencia (revisión del analista)', ingreso: campo('REM', 'Monto promedio mensual') ?? ingFuente(c), conforme: true };
          case 'IND_FACT': return { enFuente: !!c.escenario.xmlValido, metodo: 'XML firmado y validez en el SRI', facturacionPromedio: facturacion(c, p), ingreso: Math.round(facturacion(c, p) * p.margenFacturacion), margen: p.margenFacturacion, conforme: !!c.escenario.xmlValido };
          default: return { enFuente: false, metodo: 'Notas de venta y declaraciones (contenido declarativo)', ingreso: campo('NV', 'Total de ventas del mes') ?? ingFuente(c), conforme: true };
        }
      });
    },

    validarIdentidad: (c) => llamar('Registro Civil · biometría', 'RCV', () => ({ ...c.escenario.identidad })),

    consultarListas: (c) => llamar('Listas de control', 'LIS', () => {
      const alerta = c.escenario.listas === 'posible';
      return {
        alerta, listasConsultadas: ['Lista de control A (simulada)', 'Lista de control B (simulada)', 'PEP (simulada)'],
        coincidencia: alerta ? { nombreEnLista: `${c.solicitante.nombre.split(' ')[0]} ${c.solicitante.nombre.split(' ').slice(-1)[0]} (registro ficticio)`, similitud: 0.91, lista: 'Lista de control A (simulada)' } : null,
        evidencia: `evidencia_listas_${c.id}.json (simulada)`,
      };
    }),

    generarDocumentos: (c) => llamar('Generador documental', 'DOC', () => ({
      contrato: `CTR-${c.id}`, pagare: `PAG-${c.id}`, tablaAmortizacion: `TAM-${c.id}`,
    })),

    acreditarFondos: (c) => llamar('Core bancario · desembolso', 'DES', () => ({
      operacionId: `OP-${c.id}`, cuenta: '****' + String(hashStr(c.id) % 10000).padStart(4, '0'), monto: c.monto,
    })),

    publicarEvento: (c, payload) => llamar('Bus de eventos', 'EVT', () => ({
      evento: 'operación desembolsada', destino: 'P-03.2 Cobranza y Recuperación (proceso independiente)', payload,
    })),
  };
}

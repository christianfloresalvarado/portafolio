// Asistente del canal digital (SIMULADO, sin IA real). Solo orienta: responde preguntas
// frecuentes y explica qué documento subir según el perfil y la política vigente.
// Por diseño NO recibe el caso ni el resultado del DMN: su única entrada es el perfil,
// el monto y la matriz de requisitos publicada. Nunca decide.
import { PERFILES, DOCUMENTOS } from './data.js';

export const PREGUNTAS = [
  { id: 'docs', texto: '¿Qué documentos debo subir?' },
  { id: 'aut', texto: '¿Cómo cargo las autorizaciones?' },
  { id: 'firma', texto: '¿Cómo firmo el contrato si solicito en línea?' },
  { id: 'datos', texto: '¿Para qué se usan mis datos?' },
  { id: 'resultado', texto: '¿Me van a aprobar?' },
];

export function responder(pregunta, { perfil, monto, requisitos, patrimonioDesde }) {
  const q = (pregunta || '').toLowerCase();
  const id = PREGUNTAS.find((p) => p.id === pregunta)?.id
    || (/(document|subir|archivo|requis)/.test(q) ? 'docs'
      : /(autoriz|bur)/.test(q) ? 'aut'
        : /(firm|contrat|pagar)/.test(q) ? 'firma'
          : /(dato|privacidad|lopdp)/.test(q) ? 'datos'
            : /(aprob|resultado|decisi|rechaz|nivel|score|puntaje)/.test(q) ? 'resultado' : null);

  switch (id) {
    case 'docs': {
      const docs = (requisitos[perfil] || []).map((d) => DOCUMENTOS[d]);
      if (monto >= patrimonioDesde) docs.push(DOCUMENTOS.PAT);
      const p = PERFILES[perfil];
      return docs.length
        ? `Para el perfil "${p.etiqueta}" se piden: ${docs.join(', ')}. ${p.verificacion}. Sube archivos legibles, firmados y con fecha vigente.`
        : `Para el perfil "${p.etiqueta}" no necesitas subir documentos de ingreso: ${p.verificacion.toLowerCase()}.`;
    }
    case 'aut':
      return 'Imprime las dos autorizaciones (consulta al buró y tratamiento de datos personales), fírmalas, escanéalas y súbelas en el paso 1.1. Sin ellas no se puede consultar el buró.';
    case 'firma':
      return 'En el canal digital, el contrato, el pagaré y la tabla de amortización se imprimen, se firman y se escanean en el paso 5.2. En agencia se firman en la misma visita.';
    case 'datos':
      return 'Tus datos se usan solo para evaluar esta solicitud, con tu autorización. Si la decisión es automática, puedes pedir que una persona la revise (art. 20 LOPDP). En este demo todos los datos son ficticios.';
    case 'resultado':
      return 'No tengo acceso a la evaluación ni al resultado, y no participo en la decisión. El resultado y su motivo se te comunicarán por la plataforma.';
    default:
      return 'Puedo orientarte sobre documentos, autorizaciones, firma y uso de datos. No veo tu evaluación ni decido sobre la solicitud.';
  }
}

// Datos de referencia del análisis (fuente: docs/Analisis_AS_IS_TO_BE.xlsx y
// docs/BPMN_TO-BE_P-03.1_Concesion_Credito.bpmn). Este módulo no tiene lógica:
// cada cifra lleva su tabla de origen para mantener la trazabilidad.

export const PROCESO = {
  codigo: 'P-03.1',
  nombre: 'Concesión de Crédito de Consumo · TO-BE',
  entidad: 'IFI Horizonte (entidad ficticia del caso)',
  bpmnUrl: 'docs/BPMN_TO-BE_P-03.1_Concesion_Credito.bpmn',
  procesoDestino: 'P-03.2 Cobranza y Recuperación (proceso independiente)',
  mensajeSaliente: { id: 'MF_TOBE_0', nombre: 'Evento: operación desembolsada' },
};

export const HORAS_DIA_HABIL = 8; // Tabla 1 · días hábiles de 8 h

// Parámetros de la política. origen: "analisis" = valor definido en el Excel/informe;
// "prompt" = no definido en el análisis, valor sugerido en el encargo;
// "demo" = no definido en el análisis, necesario para ejecutar el demo.
export const PARAMETROS_DEF = [
  { id: 'capacidadMax', grupo: 'Capacidad de pago', etiqueta: 'Cuota máxima / ingreso', valor: 0.4, tipo: 'pct', origen: 'analisis', fuente: 'Hoja Supuestos B14 · S-34' },
  { id: 'cuotaCercanaMin', grupo: 'Capacidad de pago', etiqueta: '"Cuota cercana al 40 %" desde', valor: 0.35, tipo: 'pct', origen: 'prompt' },
  { id: 'scoreSuperior', grupo: 'Buró', etiqueta: 'Score "superior" desde', valor: 800, tipo: 'int', origen: 'prompt' },
  { id: 'scoreBuenoMin', grupo: 'Buró', etiqueta: 'Score "bueno" desde', valor: 700, tipo: 'int', origen: 'prompt' },
  { id: 'scoreMedioMin', grupo: 'Buró', etiqueta: 'Score "medio" desde', valor: 600, tipo: 'int', origen: 'prompt' },
  { id: 'mesesSinMoraN1', grupo: 'Buró', etiqueta: 'N1 exige meses sin mora', valor: 24, tipo: 'int', origen: 'analisis', fuente: 'Escala N0–N4 · N1' },
  { id: 'moraRecienteMeses', grupo: 'Buró', etiqueta: '"Mora reciente" (N0) = mora en los últimos N meses', valor: 12, tipo: 'int', origen: 'demo' },
  { id: 'topeN1', grupo: 'Montos', etiqueta: 'Tope de monto N1 (USD)', valor: 10000, tipo: 'usd', origen: 'prompt' },
  { id: 'atribucionesMax', grupo: 'Montos', etiqueta: 'Atribuciones máximas (USD); por encima, comité N4', valor: 20000, tipo: 'usd', origen: 'prompt' },
  { id: 'patrimonioDesde', grupo: 'Montos', etiqueta: 'DMN de requisitos: bienes y patrimonio desde (USD)', valor: 12000, tipo: 'usd', origen: 'demo' },
  { id: 'confianzaMin', grupo: 'Software de extracción', etiqueta: 'Confianza mínima por campo', valor: 0.85, tipo: 'pct', origen: 'prompt' },
  { id: 'margenFacturacion', grupo: 'Ingreso', etiqueta: 'Factor de margen sobre la facturación (S-20)', valor: 0.3, tipo: 'pct', origen: 'demo' },
  { id: 'tasaAnual', grupo: 'Producto', etiqueta: 'Tasa nominal anual (cuota y amortización)', valor: 0.15, tipo: 'pct', origen: 'demo' },
  { id: 'slaAmbar', grupo: 'SLA', etiqueta: 'Semáforo: ámbar desde este % del tiempo de diseño (rojo > 100 %)', valor: 0.8, tipo: 'pct', origen: 'demo' },
];

export const DOCUMENTOS = {
  CERT: 'Certificado de ingresos',
  REM: 'Comprobantes de remesas (con recurrencia)',
  XML: 'Facturas electrónicas XML firmadas',
  NV: 'Notas de venta y declaraciones',
  PAT: 'Sustento de bienes y patrimonio',
};

// DMN de requisitos inicial (perfil → documentos de ingreso). PAT se rige por monto.
export const REQUISITOS_DEF = {
  DEP_IESS: ['CERT'], REM_BANCO: [], REM_OTRA: ['REM'], IND_FACT: ['XML'], NEG_POP: ['NV'],
};

export const PERFILES = {
  DEP_IESS: {
    etiqueta: 'Dependiente afiliado al IESS', pct: 0.45, enFuente: true,
    verificacion: 'Certificado + historia laboral IESS + RUC del empleador',
  },
  REM_BANCO: {
    etiqueta: 'Remesista que recibe en el banco', pct: 0.065, enFuente: true,
    verificacion: 'Dato del core; no se pide documento',
  },
  REM_OTRA: {
    etiqueta: 'Remesista por otra vía', pct: 0.065, enFuente: false,
    verificacion: 'Comprobantes con recurrencia; revisión del analista',
  },
  IND_FACT: {
    etiqueta: 'Independiente que factura', pct: 0.08, enFuente: true,
    verificacion: 'XML firmado y validez en el SRI',
  },
  NEG_POP: {
    etiqueta: 'Negocio popular u otros', pct: 0.34, enFuente: false,
    verificacion: 'Notas de venta y declaraciones; el software valida la forma, el analista el contenido',
  },
};

// Carriles del BPMN (IDs reales) y roles de la interfaz.
export const CARRILES = {
  L_CAP: 'Captura · cliente en canal digital o asesor (misma plataforma)',
  L_SIS: 'Plataforma · DMN, extracción documental e integraciones',
  L_CUM: 'Cumplimiento (alertas PLA)',
  L_FAB: 'Fábrica de crédito · revisión N2 a N4',
  L_APR: 'Nivel de aprobación',
  L_MES: 'Mesa de instrumentación y desembolso',
};

// Sin control de acceso por cargo: cada rol es un módulo de trabajo con su bandeja.
export const ROLES = {
  todos: { corto: 'Todos los módulos', modulo: 'Supervisión · todas las bandejas' },
  cliente: { corto: 'Cliente digital', modulo: 'Módulo de Autoservicio · Cliente digital', carril: 'L_CAP' },
  asesor: { corto: 'Asesor', modulo: 'Módulo de Asesor de Agencia', carril: 'L_CAP' },
  analista: { corto: 'Analista', modulo: 'Módulo de Analista de Crédito', carril: 'L_FAB' },
  cumplimiento: { corto: 'Cumplimiento', modulo: 'Módulo de Oficial de Cumplimiento (PLA)', carril: 'L_CUM' },
  aprobador: { corto: 'Aprobador', modulo: 'Módulo de Aprobación de Crédito (atribuciones y comité)', carril: 'L_APR' },
  mesa: { corto: 'Mesa', modulo: 'Módulo de Mesa de Instrumentación y Desembolso', carril: 'L_MES' },
};
export const MODULO_PLATAFORMA = 'Plataforma (automático)';
export const MODULO_RIESGOS = 'Módulo de Parametrización de Riesgos (MP.02)';

// Tareas del BPMN TO-BE en el orden del stepper. IDs y nombres tal como en el archivo.
export const TAREAS = [
  { id: 'B_T1', cod: '1.1', nombre: 'Registrar datos y cargar autorizaciones firmadas (buró y datos personales)', carril: 'L_CAP', tipo: 'userTask' },
  { id: 'B_T2', cod: '1.2', nombre: 'Validar autorizaciones (firma, fecha, legibilidad)', carril: 'L_SIS', tipo: 'serviceTask' },
  { id: 'B_T3', cod: '1.3', nombre: 'Precalificar (DMN: buró y capacidad de pago 40 %)', carril: 'L_SIS', tipo: 'businessRuleTask' },
  { id: 'B_T4', cod: '1.4', nombre: 'Definir documentos requeridos (DMN de requisitos)', carril: 'L_SIS', tipo: 'businessRuleTask' },
  { id: 'B_T5', cod: '1.5', nombre: 'Cargar documentos de ingreso, bienes y patrimonio', carril: 'L_CAP', tipo: 'userTask' },
  { id: 'B_T6', cod: '2.1', nombre: 'Extraer y validar documentos (legibilidad, firmas, fechas, montos)', carril: 'L_SIS', tipo: 'serviceTask' },
  { id: 'B_T7', cod: '2.2', nombre: 'Verificar ingreso en la fuente (XML SRI, remesas en core, RUC e IESS)', carril: 'L_SIS', tipo: 'serviceTask' },
  { id: 'B_T5b', cod: '2.3', nombre: 'Corregir o completar documentos', carril: 'L_CAP', tipo: 'userTask' },
  { id: 'B_T8', cod: '2.4', nombre: 'Validar identidad (biometría Registro Civil)', carril: 'L_SIS', tipo: 'serviceTask' },
  { id: 'B_T9', cod: '2.5', nombre: 'Verificar listas y guardar evidencia', carril: 'L_SIS', tipo: 'serviceTask' },
  { id: 'B_T10', cod: '2.6', nombre: 'Analizar alerta PLA', carril: 'L_CUM', tipo: 'userTask' },
  { id: 'B_T11', cod: '3.1', nombre: 'Decidir con DMN (score, política, capacidad 40 %)', carril: 'L_SIS', tipo: 'businessRuleTask' },
  { id: 'B_T12a', cod: '3.2', nombre: 'Revisar solo documentos de ingreso (N2)', carril: 'L_FAB', tipo: 'userTask' },
  { id: 'B_T12b', cod: '3.3', nombre: 'Evaluación completa (N3–N4)', carril: 'L_FAB', tipo: 'userTask' },
  { id: 'B_T13', cod: '4.1', nombre: 'Aprobar según atribuciones; N4 en comité diario (excepción registrada)', carril: 'L_APR', tipo: 'userTask' },
  { id: 'B_T14', cod: '5.1', nombre: 'Generar contrato, pagaré y tabla de amortización', carril: 'L_SIS', tipo: 'serviceTask' },
  { id: 'B_T15', cod: '5.2', nombre: 'Firmar documentos (agencia o impresos y escaneados)', carril: 'L_CAP', tipo: 'userTask' },
  { id: 'B_T16', cod: '6.1', nombre: 'Validar checklist e instruir desembolso', carril: 'L_MES', tipo: 'userTask' },
  { id: 'B_T17', cod: '6.2', nombre: 'Acreditar fondos e instanciar la operación', carril: 'L_SIS', tipo: 'serviceTask' },
];

export const EVENTOS = {
  B_SD: { nombre: 'Solicitud en canal digital', tipo: 'startEvent' },
  B_SA: { nombre: 'Solicitud en agencia', tipo: 'startEvent' },
  B_E0: { nombre: 'No precalifica (motivo explicado)', tipo: 'endEvent' },
  B_E2a: { nombre: 'N0 · Rechazo automático (motivo explicado)', tipo: 'endEvent' },
  B_EP: { nombre: 'Rechazo por PLA', tipo: 'endEvent' },
  B_E2: { nombre: 'No aprobada', tipo: 'endEvent' },
  B_E3: { nombre: 'Desiste (motivo registrado)', tipo: 'endEvent' },
  B_EF: { nombre: 'Crédito desembolsado (fin de P-03.1)', tipo: 'endEvent' },
};

export const COMPUERTAS = {
  B_GM: '(unión de canales)',
  B_G1: '¿Precalifica?',
  B_G2: '¿Documentos conformes?',
  B_P1: '(división paralela 2.4 ‖ 2.5)',
  B_P2: '(unión paralela)',
  B_G3: '¿Alerta en listas?',
  B_G4: '¿Descartada?',
  B_G5: '(unión)',
  B_G6: 'Nivel de decisión (DMN)',
  B_G6b: '¿Nivel de revisión?',
  B_GMF: '(unión de revisión)',
  B_G7: '¿Aprobada?',
  B_G8: '(unión hacia instrumentación)',
  B_G9: '¿Cliente continúa?',
};

// Flujos de secuencia del BPMN: id → [origen, destino, etiqueta].
export const FLUJOS = {
  F_B_SD_B_GM: ['B_SD', 'B_GM'], F_B_SA_B_GM: ['B_SA', 'B_GM'], F_B_GM_B_T1: ['B_GM', 'B_T1'],
  F_B_T1_B_T2: ['B_T1', 'B_T2'], F_B_T2_B_T3: ['B_T2', 'B_T3'], F_B_T3_B_G1: ['B_T3', 'B_G1'],
  F_B_G1_B_T4: ['B_G1', 'B_T4', 'Sí'], F_B_G1_B_E0: ['B_G1', 'B_E0', 'No'],
  F_B_T4_B_T5: ['B_T4', 'B_T5'], F_B_T5_B_T6: ['B_T5', 'B_T6'], F_B_T6_B_T7: ['B_T6', 'B_T7'],
  F_B_T7_B_G2: ['B_T7', 'B_G2'], F_B_G2_B_T5b: ['B_G2', 'B_T5b', 'No'], F_B_T5b_B_T6: ['B_T5b', 'B_T6'],
  F_B_G2_B_P1: ['B_G2', 'B_P1', 'Sí'], F_B_P1_B_T8: ['B_P1', 'B_T8'], F_B_P1_B_T9: ['B_P1', 'B_T9'],
  F_B_T8_B_P2: ['B_T8', 'B_P2'], F_B_T9_B_P2: ['B_T9', 'B_P2'], F_B_P2_B_G3: ['B_P2', 'B_G3'],
  F_B_G3_B_T10: ['B_G3', 'B_T10', 'Sí'], F_B_G3_B_G5: ['B_G3', 'B_G5', 'No'],
  F_B_T10_B_G4: ['B_T10', 'B_G4'], F_B_G4_B_EP: ['B_G4', 'B_EP', 'No'], F_B_G4_B_G5: ['B_G4', 'B_G5', 'Sí'],
  F_B_G5_B_T11: ['B_G5', 'B_T11'], F_B_T11_B_G6: ['B_T11', 'B_G6'],
  F_B_G6_B_E2a: ['B_G6', 'B_E2a', 'N0'], F_B_G6_B_G8: ['B_G6', 'B_G8', 'N1 · Aprobación directa'],
  F_B_G6_B_G6b: ['B_G6', 'B_G6b', 'N2–N4'], F_B_G6b_B_T12a: ['B_G6b', 'B_T12a', 'N2'],
  F_B_G6b_B_T12b: ['B_G6b', 'B_T12b', 'N3–N4'], F_B_T12a_B_GMF: ['B_T12a', 'B_GMF'],
  F_B_T12b_B_GMF: ['B_T12b', 'B_GMF'], F_B_GMF_B_T13: ['B_GMF', 'B_T13'], F_B_T13_B_G7: ['B_T13', 'B_G7'],
  F_B_G7_B_E2: ['B_G7', 'B_E2', 'No'], F_B_G7_B_G8: ['B_G7', 'B_G8', 'Sí'], F_B_G8_B_T14: ['B_G8', 'B_T14'],
  F_B_T14_B_T15: ['B_T14', 'B_T15'], F_B_T15_B_G9: ['B_T15', 'B_G9'],
  F_B_G9_B_E3: ['B_G9', 'B_E3', 'No'], F_B_G9_B_T16: ['B_G9', 'B_T16', 'Sí'],
  F_B_T16_B_T17: ['B_T16', 'B_T17'], F_B_T17_B_EF: ['B_T17', 'B_EF'],
};

// Tiempos de diseño (Excel, hoja "TO BE"). exec en minutos, espera en horas.
export const TIEMPOS_DEF = {
  // Tabla 9 · por canal
  captura: { agencia: [25, 4], digital: [0, 0], fuente: 'Tabla 9 · Captura y precalificación' },
  validacion: { agencia: [5, 0.5], digital: [0, 0.5], fuente: 'Tabla 9 · Validación documental' },
  instrumentacion: { agencia: [20, 2], digital: [20, 4], fuente: 'Tabla 9 · Instrumentación' },
  instrumentacionN1: { agencia: [20, 0.5], digital: [20, 2], fuente: 'Tabla 9 · Instrumentación con aprobación directa' },
  desembolso: { agencia: [5, 1], digital: [5, 1], fuente: 'Tabla 9 · Desembolso' },
  // Tabla 10 · por nivel
  revision: { N2: [15, 2], N3: [30, 2], N4: [30, 2], fuente: 'Tabla 10 · Analista y espera antes del analista' },
  aprobacion: { N2: [10, 2], N3: [10, 4], N4: [25, 8], fuente: 'Tabla 10 · Aprobación y espera de aprobación' },
  // Tabla 11 · reproceso por devolución
  reproceso: { todos: [30, 2], fuente: 'Tabla 11 · Reproceso por devolución (2.ª revisión + espera)' },
};

// Tabla 12 · total de diseño por nivel y canal (h), sin el reproceso ponderado.
export const TABLA12 = {
  N1: { agencia: 6.92, digital: 3.92 },
  N2: { agencia: 12.83, digital: 10.33 },
  N3: { agencia: 15.08, digital: 12.58 },
  N4: { agencia: 19.33, digital: 17.83 },
};

// Tablero: resultados del análisis rotulados como estimación del diseño TO-BE.
export const ESTIMACIONES = [
  { id: 'ciclo', indicador: 'Tiempo de ciclo promedio', asis: 9.81, tobe: 1.46, unidad: 'días hábiles', fuente: 'Tabla 16 (AS IS: tabla 1; TO BE: tabla 12)' },
  { id: 'lento', indicador: 'Caso más lento', asis: 11.96, tobe: 2.44, unidad: 'días hábiles', fuente: 'Tabla 16' },
  { id: 'devol', indicador: 'Devoluciones', asis: 360, tobe: 95, unidad: 'por mes', fuente: 'Tabla 14 (95,4)' },
  { id: 'util', indicador: 'Utilización de la fábrica', asis: 0.964, tobe: 0.331, unidad: '%', fuente: 'Tablas 16 y 18' },
  { id: 'horas', indicador: 'Horas de trabajo', asis: 3940, tobe: 1436, unidad: 'h/mes', fuente: 'Tablas 15 y 16' },
  { id: 'capac', indicador: 'Capacidad de la fábrica al 85 %', asis: 1322, tobe: 3854, unidad: 'solicitudes/mes', fuente: 'Tabla 18' },
];

export const RUTAS_1500 = {
  fuente: 'Tabla 8 · Ruta de las solicitudes en el TO BE (al mes)',
  canales: [{ id: 'digital', etiqueta: 'Canal digital', valor: 375 }, { id: 'agencia', etiqueta: 'Agencia', valor: 1125 }],
  niveles: [
    { id: 'N0', etiqueta: 'N0 · Rechazo automático', valor: 120 },
    { id: 'N1', etiqueta: 'N1 · Aprobación directa', valor: 280 },
    { id: 'N2', etiqueta: 'N2 · Revisión parcial', valor: 320 },
    { id: 'N3', etiqueta: 'N3 · Revisión completa', valor: 360 },
    { id: 'N4', etiqueta: 'N4 · Comité', valor: 120 },
  ],
  noLleganADecision: 300,
};

export const NIVELES = {
  N0: 'N0 · Rechazo automático',
  N1: 'N1 · Aprobación directa',
  N2: 'N2 · Revisión parcial',
  N3: 'N3 · Revisión completa',
  N4: 'N4 · Comité o excepción',
};

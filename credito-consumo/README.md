# Demo P-03.1 · Concesión de Crédito de Consumo (TO-BE)

> **Aviso:** demo académico con **datos ficticios** e **integraciones simuladas**. **No es un sistema real**: no procesa créditos, no consulta servicios externos y no debe usarse con datos personales reales. La IFI Horizonte es una entidad ficticia del caso; el demo no usa logos ni marcas de bancos reales.

Demo navegable en HTML estático del proceso rediseñado **P-03.1 Concesión de Crédito de Consumo** (macroproceso CP.03). El flujo del demo sigue los IDs del BPMN TO-BE real y los tiempos, volúmenes y KPI del análisis en Excel.

## Contexto: diagnóstico AS-IS

1. El crédito tarda **9,8 días hábiles** frente a una meta de 3 días, y el **96 %** de ese tiempo es espera: solo hay 3,3 h de trabajo efectivo por solicitud.
2. La fábrica de crédito es la restricción: opera al **96,4 %** de su capacidad y dedica el 17 % de sus horas a revisar otra vez **360 expedientes devueltos** al mes (30 %).
3. El 70 % de las devoluciones nace en la captura en agencia: documentos de ingreso incompletos o ilegibles y datos mal digitados.

*Fuente: `docs/Analisis_AS_IS_TO_BE.xlsx`, hoja "AS IS", tablas 1 a 5.*

## Qué demuestra

- **Captura única:** cliente digital y asesor usan la misma plataforma (1.1). En el canal digital hay un asistente simulado que **solo orienta**: no ve el caso ni el resultado.
- **Tres DMN ejecutables y explicables:**
  - 1.3 Precalificación (FIRST).
  - 1.4 Requisitos por perfil (COLLECT).
  - 3.1 Decisión N0–N4 (FIRST, en orden N0, N4, N1, N2, N3).

  Cada decisión muestra la regla aplicada, la traza condición por condición y la versión de la política.
- **Verificación del ingreso en la fuente** según los 5 perfiles: IESS, core, SRI o, cuando no hay fuente, documentos.
- **Extracción documental** con porcentaje de confianza por campo. Un campo bajo el umbral va a revisión humana, y un documento ilegible lleva el caso a 2.3 y de vuelta a 2.1.
- **Paralelo 2.4 ‖ 2.5**, alerta PLA a Cumplimiento y rechazo por PLA.
- **Niveles de revisión:** N2 revisa solo los ingresos, N3 hace evaluación completa y N4 va a comité diario con la excepción registrada.
- **Instrumentación automática** (contrato, pagaré y tabla de amortización), firma o desistimiento, checklist y desembolso.
- **Mensaje saliente** "operación desembolsada" (`MF_TOBE_0`) hacia **P-03.2 Cobranza y Recuperación**. Ese proceso está separado por conflicto de intereses y el demo no lo construye.
- **Reloj del proceso** en horas hábiles (días de 8 h), con SLA por etapa en verde, ámbar o rojo. Con los tiempos de diseño del Excel, los casos N1 a N4 reproducen exactamente la **tabla 12**.
- **Módulos de trabajo** por carril (Módulo de Analista de Crédito, de Cumplimiento, de Aprobación, de Mesa…), cada uno con su bandeja, su cola priorizada por SLA y su acción principal.
- **Módulo de Parametrización de Riesgos (MP.02):**
  - Editar en un borrador los umbrales, activar o desactivar condiciones de cada regla, ajustar la matriz de requisitos por perfil y los tiempos de diseño.
  - Validación que bloquea la publicación si hay incoherencias.
  - Simulación del impacto sobre los casos de la sesión.
  - Publicación como nueva versión, con justificación y diferencias antes/después.
- **Auditoría append-only** con hash encadenado: fecha y hora, reloj, módulo o rol, tarea, dato antes y después, versión de la regla y evidencia. Se exporta a JSON y CSV.
- **Tablero:**
  - Estimaciones del diseño TO-BE, rotuladas como tales.
  - Contador en vivo de la sesión, separado de las estimaciones.

## Mapa del flujo (IDs del BPMN)

| Tarea | ID | Responsable (carril → módulo del demo) | Tipo |
|---|---|---|---|
| 1.1 Registrar datos y cargar autorizaciones firmadas | `B_T1` | Captura → Cliente digital / Asesor de agencia | Usuario |
| 1.2 Validar autorizaciones (firma, fecha, legibilidad) | `B_T2` | Plataforma | Servicio |
| 1.3 Precalificar (DMN: buró y capacidad de pago 40 %) | `B_T3` | Plataforma | Regla de negocio |
| 1.4 Definir documentos requeridos (DMN de requisitos) | `B_T4` | Plataforma | Regla de negocio |
| 1.5 Cargar documentos de ingreso, bienes y patrimonio | `B_T5` | Captura | Usuario |
| 2.1 Extraer y validar documentos | `B_T6` | Plataforma (campos bajo umbral → Analista) | Servicio |
| 2.2 Verificar ingreso en la fuente | `B_T7` | Plataforma | Servicio |
| 2.3 Corregir o completar documentos | `B_T5b` | Captura | Usuario |
| 2.4 Validar identidad (biometría Registro Civil) | `B_T8` | Plataforma | Servicio |
| 2.5 Verificar listas y guardar evidencia | `B_T9` | Plataforma | Servicio |
| 2.6 Analizar alerta PLA | `B_T10` | Cumplimiento → Módulo de Oficial de Cumplimiento | Usuario |
| 3.1 Decidir con DMN (score, política, capacidad 40 %) | `B_T11` | Plataforma | Regla de negocio |
| 3.2 Revisar solo documentos de ingreso (N2) | `B_T12a` | Fábrica → Módulo de Analista de Crédito | Usuario |
| 3.3 Evaluación completa (N3–N4) | `B_T12b` | Fábrica → Módulo de Analista de Crédito | Usuario |
| 4.1 Aprobar según atribuciones; N4 en comité diario | `B_T13` | Nivel de aprobación → Módulo de Aprobación | Usuario |
| 5.1 Generar contrato, pagaré y tabla de amortización | `B_T14` | Plataforma | Servicio |
| 5.2 Firmar documentos | `B_T15` | Captura | Usuario |
| 6.1 Validar checklist e instruir desembolso | `B_T16` | Mesa → Módulo de Mesa de Instrumentación y Desembolso | Usuario |
| 6.2 Acreditar fondos e instanciar la operación | `B_T17` | Plataforma | Servicio |

**Fines:**

- `B_E0` No precalifica.
- `B_E2a` N0 · Rechazo automático.
- `B_EP` Rechazo por PLA.
- `B_E2` No aprobada.
- `B_E3` Desiste.
- `B_EF` Crédito desembolsado.

`tests/bpmn.test.mjs` verifica que cada tarea, evento, compuerta, flujo y carril del motor coincida con el archivo BPMN.

## Casos precargados

| # | Caso | Canal | Ruta esperada |
|---|---|---|---|
| 1 | Dependiente IESS, buró superior, cuota 28 %, USD 6.000 | Digital | N1 → Crédito desembolsado |
| 2 | Remesista por otra vía, buró bueno, cuota 30 %, USD 4.000 | Agencia | N2 → Crédito desembolsado |
| 3 | Negocio popular, buró medio, cuota 38 %, USD 12.000 con patrimonio y un campo bajo el umbral | Agencia | N3 → Crédito desembolsado |
| 4 | Independiente que factura, buró superior, USD 25.000 | Agencia | N4 (comité) → Crédito desembolsado |
| 5 | Declara un ingreso con cuota de 37 % (precalifica); el IESS verifica un ingreso con cuota de 46 % | Digital | N0 → Rechazo automático (con "Solicitar revisión humana") |
| 6 | Coincidencia en listas | Agencia | 2.6 Cumplimiento → Rechazo por PLA |
| 7 | Certificado ilegible en el primer intento | Digital | 2.1 → 2.3 → 2.1 → N1 → Crédito desembolsado |
| 8 | Remesista que recibe en el banco, aprobado, desiste en 5.2 | Agencia | N1 → Desiste |

"Nueva solicitud" abre el formulario de 1.1 con un **escenario de simulación** editable: score, mora, ingreso en fuente, listas, legibilidad, etc. La cédula debe empezar con `FICT-` para impedir datos reales.

## Estructura

```
credito-consumo/
├── index.html
├── assets/
│   ├── css/app.css
│   └── js/
│       ├── data.js               # cifras del análisis, IDs del BPMN y parámetros (sin lógica)
│       ├── dmn.js                # DMN 1.3, 1.4 y 3.1 + política versionada (sin DOM)
│       ├── flow.js               # motor del proceso, reloj y SLA (sin DOM)
│       ├── integrations.mock.js  # integraciones simuladas con latencia de 300 a 1200 ms
│       ├── audit.js              # auditoría con hash encadenado; exporta JSON y CSV
│       ├── state.js              # estado en memoria + localStorage opcional (try/catch)
│       ├── casos.js              # 8 casos precargados (ficticios)
│       ├── assistant.js          # asistente del canal digital (solo orienta)
│       ├── ui.js                 # shell, enrutador, Inicio, bandejas, Auditoría y Tablero
│       ├── ui.common.js          # utilidades de interfaz
│       ├── ui.expediente.js      # expediente, stepper y BPMN (bpmn-js)
│       └── ui.dmn.js             # tablas DMN, simulador y parametrización
├── docs/
│   ├── BPMN_TO-BE_P-03.1_Concesion_Credito.bpmn
│   ├── BPMN_AS-IS_P-03.1_Concesion_Credito.bpmn
│   ├── Analisis_AS_IS_TO_BE.xlsx
│   └── screenshots/              # capturas generadas por la prueba E2E
├── tests/
│   ├── dmn.test.mjs              # pruebas unitarias del DMN
│   ├── flow.test.mjs             # 8 casos de punta a punta en Node + tiempos de la tabla 12
│   ├── bpmn.test.mjs             # consistencia del motor con el archivo BPMN
│   ├── e2e.playwright.mjs        # 8 casos por la interfaz + capturas
│   ├── helpers.mjs
│   └── server.mjs
├── package.json
├── LICENSE
└── README.md
```

No hay paso de build. Es JavaScript puro con módulos ES. La única librería externa es **bpmn-js 17.11.1** (viewer), que se carga desde unpkg.

## Cómo correrlo localmente

Los módulos ES y la lectura del BPMN necesitan un servidor HTTP; abrir el archivo con `file://` no basta.

```bash
cd credito-consumo
python3 -m http.server 8080      # o: npx serve .
# abrir http://localhost:8080
```

Pruebas:

```bash
npm test                          # node --test: DMN, motor y consistencia con el BPMN (50 pruebas)
npm i -D playwright && npx playwright install chromium
npm run e2e                       # 8 casos por la interfaz + capturas en docs/screenshots
```

Variables opcionales de la prueba E2E:

- `PLAYWRIGHT_MODULE`: ruta a `playwright/index.mjs` si no está en `node_modules`.
- `BPMN_JS_DIR`: carpeta `dist/` de bpmn-js, para servirla sin acceso a unpkg.
- `CHROMIUM_PATH`: ruta del ejecutable de Chromium.

## Cómo publicarlo en GitHub Pages

1. En el repositorio: **Settings → Pages → Build and deployment → Deploy from a branch**.
2. Elegir la rama `main` y la carpeta `/ (root)`.
3. El demo queda en `https://<usuario>.github.io/<repositorio>/credito-consumo/`; en este repositorio, `https://christianfloresalvarado.github.io/portafolio/credito-consumo/`.

El `index.html` de la raíz (el portafolio) no se modifica.

## Parámetros no definidos en el análisis

Se editan en **Parametrización** y aparecen rotulados como *"Parámetro configurable · no definido en el análisis"*:

| Parámetro | Valor inicial | Origen del valor |
|---|---|---|
| Tope de monto N1 | USD 10.000 | Sugerido en el encargo |
| Score superior / bueno / medio | ≥ 800 / 700–799 / 600–699 | Sugerido en el encargo |
| "Cuota cercana al 40 %" | 35–40 % | Sugerido en el encargo |
| Atribuciones (sobre ese monto, N4) | USD 20.000 | Sugerido en el encargo |
| Confianza mínima del software de extracción | 85 % | Sugerido en el encargo |
| "Mora reciente" (N0) | ≤ 12 meses | Necesario para el demo |
| Monto desde el que se exige bienes y patrimonio | USD 12.000 | Necesario para el demo |
| Tasa nominal anual (cuota y amortización) | 15 % | Necesario para el demo |
| Factor de margen sobre la facturación (S-20) | 30 % | Necesario para el demo |
| Semáforo SLA: ámbar desde | 80 % del tiempo de diseño | Necesario para el demo |

Valores del análisis, también editables pero rotulados *"Valor del análisis"*: capacidad de pago de 40 % (Supuestos B14), 24 meses sin mora para N1, y los tiempos de las tablas 9, 10 y 11.

## Discrepancias encontradas con `/docs`

| # | Tema | Lo que dice el encargo / informe | Lo que dicen los archivos | Tratamiento en el demo |
|---|---|---|---|---|
| 1 | Fuente de los KPI del tablero | "Excel, tablas 14 y 18" | Ciclo, caso más lento, utilización y horas están en la **tabla 16** (con las tablas 12 y 15). La tabla 14 solo tiene devoluciones y la 18, capacidad. | Cada tile cita su tabla real. |
| 2 | Cifras redondeadas | Capacidad "~3.850"; devoluciones "95" | 3.853,6 y 95,4 | Se muestran 3.854 y 95 (fuente: tabla 14, 95,4). |
| 3 | Caso más lento AS-IS | Informe Word, resumen: **9,81** días | Excel, tabla 16: **11,96** días | Se usa el Excel (manda el archivo). Conviene corregir el informe. |
| 4 | Devolución desde la fábrica | El informe (4.1) dice que N2/N3 "si encuentra un problema, la devuelve a captura" | El BPMN no tiene flujo de 3.2/3.3 hacia captura; el Excel sí cuenta un reproceso (tablas 11–13: 2.ª revisión de 30 min + 2 h) | Se sigue el BPMN: el bucle de corrección solo existe en 2.3 → 2.1. Al bucle 2.3 se le asigna el tiempo de reproceso de la tabla 11. |
| 5 | Revisión humana art. 20 LOPDP | El encargo pide un botón en N0 | El BPMN termina en `B_E2a`; solo la documentación de 3.3 dice que atiende revisiones solicitadas (S-41) | El caso se reabre en 3.3 con evento de auditoría propio (flujo fuera del diagrama). Tiempos: los de N3. |
| 6 | Caso 5 (cuota 46 % → N0) | Cuota 46 % llega a N0 | 1.3 rechaza con cuota > 40 % del **ingreso declarado** (S-34) y terminaría en "No precalifica" | El caso declara un ingreso con cuota de 37 % y la fuente (IESS) verifica uno con cuota de 46 %: precalifica y luego el DMN 3.1 lo manda a N0. |
| 7 | Vacíos de la tabla N0–N4 | — | Sin regla para: buró superior + ingreso verificado + monto entre el tope N1 y las atribuciones; buró **bueno** + ingreso verificado; score bajo el rango medio; mora entre 13 y 24 meses | Regla `D-DEF` del demo → N3 (rotulada como no definida). Recomendación: cerrar estos huecos en MP.02. |
| 8 | N1 y discrepancias | N3 incluye "discrepancias del software" | Con FIRST, N1 se evalúa antes y no excluye discrepancias | Se respeta el diseño. Las pruebas lo documentan; conviene revisar la regla. |
| 9 | Criterio de buró en 1.3 | "buró y capacidad 40 %" | No se detalla qué condición de buró rechaza en la precalificación | Se usa "mora vigente" (criterio N0). |
| 10 | Tiempo de 2.6 PLA | — | El Excel no define tiempo de diseño para Cumplimiento | Se muestra "Sin SLA en el análisis"; el reloj solo suma la espera simulada. |
| 11 | Revisión de campos bajo umbral | "se marca para revisión humana" | No es tarea del BPMN; el Excel la cuenta en la tabla 13 (5 min, 15 % de documentos) | Retención dentro de 2.1, atendida en el Módulo de Analista. No suma al reloj, porque la tabla 12 no la incluye. |
| 12 | Documentos de 5.1 | Informe: "contrato, pagaré y documentos de garantía" | BPMN: "contrato, pagaré y tabla de amortización" | Se sigue el BPMN. |
| 13 | Gobierno del DMN | Informe 5.2: MP.02 Riesgos es "dueño de las reglas DMN" | RACI (4.5): "Modificar scorecard, reglas DMN y política" → Directorio **A/R**; Riesgos solo **C** | El módulo se rotula MP.02, pero la RACI debería alinearse (¿Riesgos R y Directorio A?). |
| 14 | Nombres de archivo | `/docs/BPMN_TO-BE_P-03.1_Concesion_Credito.bpmn`, `/docs/Analisis_AS_IS_TO_BE.xlsx` | Se recibieron como `P-03.1_Concesión…TO-BE.bpmn` e `Informe_ChristianFlores.xlsx` | Se copiaron con los nombres del encargo. También se incluye el BPMN AS-IS. |
| 15 | Canal de los casos 2–8 | No se indica | — | Se eligió agencia o digital para cubrir ambos canales (ver la tabla de casos). |

## Limitaciones

- **Datos ficticios e integraciones simuladas:** buró, Registro Civil, SRI, IESS, listas, core y bus de eventos responden según el escenario del caso, con latencia artificial.
- **Sin control de acceso por cargo:** los módulos llevan título y la auditoría registra el responsable de cada tarea, pero cualquiera puede actuar en cualquier módulo. Tampoco hay segregación de funciones (por ejemplo, analista ≠ aprobador).
- **Publicación de la política sin doble aprobación:** no hay *maker-checker*. Las reglas tienen estructura y orden fijos: se ajustan umbrales y condiciones, no se crean reglas nuevas.
- **Tiempos de diseño, no medidos (S-11):** el demo **comprime el tiempo**. Al completar una etapa registra su tiempo de diseño, o la espera simulada si es mayor ("Simular +1 h").
- **Integridad:** el hash de auditoría (FNV-1a) detecta alteraciones accidentales; no es criptográfico.
- **Persistencia y dependencias:** el estado vive en memoria y, si se permite, en el `localStorage` de un solo navegador. El diagrama necesita acceso a unpkg; sin él, el flujo funciona igual y se ofrece descargar el `.bpmn`.
- **Fuera de alcance:** P-03.2 Cobranza y Recuperación se representa solo como mensaje saliente.

**Este demo no es un sistema real ni una recomendación de crédito.**

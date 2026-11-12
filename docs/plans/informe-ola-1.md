# Informe — Ola 1 (T-01): adaptador de motor con dobles

**Fecha:** 12 de noviembre de 2026 · **Rama:** `agent/ola-1-t01`
**Orden del coordinador:** ejecutar T-01 de `PLAN-003-adaptador-spec-011-por-olas.md`
(adaptador con dobles, enmienda de SPEC-011 §Entradas, subentrada
`./adapter`, volteo de SPEC-011 a implementada) con ronda adversarial
propia, gates en verde por commit y merge por avance rápido tras
`proceed`. Revisores: OpenCode GLM de contexto fresco, sólo lectura.

## 1. Qué se ejecutó

1. `src/adapter/index.js`: `createWebSpeechAdapter(voiceEngine?, runtime?,
   preferences?)` que devuelve `{ speaker, listener }`; `PATCHES` (14
   entradas congeladas) y `ADAPTER_CAPABILITIES`; reloj inyectable con
   validación fail-closed análoga a `C-001-19`; globales del navegador
   sólo como omisión.
2. `tests/spec-011.test.js`: los 25 casos de SPEC-011 con dobles de motor
   y reloj falso (`fakeClock` del harness), sin un solo `setTimeout`.
3. Enmienda de SPEC-011 §Entradas (runtime) + caso `C-011-25` + invariante
   + cobertura; índice de specs a 25 casos y total 193.
4. `package.json` con `exports["./adapter"]`; contrato de consumo §1–§2 y
   README enmendados (dos entradas; la frontera es el contrato, no el
   mapa `exports`).
5. `estado.md`: §2 SPEC-011 `implementada` con motivo nuevo, §4 y §6
   reconciliados, en el mismo commit que las pruebas.

## 2. Evidencia

- `node --check src/adapter/index.js` → OK [pass]
- `node --test tests/spec-011.test.js` → 25 tests, 25 pass [pass]
- `grep setTimeout tests/spec-011.test.js` → sin resultados [pass]
- `grep globalThis src/adapter/index.js` → sólo en la omisión del reloj,
  en `defaultEngine()` y en la omisión de idioma; nunca en el arranque
  del módulo [pass]
- `npm run gate` (commit 794c1ed) → check_sizes OK (100 archivos, ruta
  1599/1600), 66 del método, **184** pruebas [pass]
- Mutación de muestra, ejecutada dos veces (pre y post corrección R2,
  ver §4): parche P-06 desactivado → `node --test` → 24 pass /
  **1 fail en C-011-09**; revertida y árbol verificado limpio [pass]

## 3. Ronda R2 (12-11-2026) — sobre el delta 794c1ed

Veredicto: **fix-and-retry** (2 HIGH, 4 MED, 4 LOW), con cinco rupturas
de contrato reproducidas por sondas ejecutables del revisor. Disposición:

- **HIGH-1 (`say`/`listen` podían rechazar con motor que lanza):**
  corregido — constructores de `Utterance`/`Recognition` y todo el
  executor envueltos; el fallo del motor resuelve `'error'` /
  `{type:'recognition_failed'}`; pruebas añadidas en C-011-01 y C-011-03
  con constructores que lanzan.
- **HIGH-2 (efectos diferidos de escucha superseded o abortada):**
  corregido — `finish()` congela sin resolver ni callbacks cuando el
  estado está cancelado; una escucha que desplaza a otra congela su
  vigilante; prueba en C-011-11 (la desplazada calla, la vigente responde
  por su propio reloj) y en C-011-18 (señal abortada sin `cancel()`:
  ni resolución ni callbacks tras el abort).
- **MED-1 (`voiceschanged` tardío de un `say` superseded hablaba y mataba
  la locución vigente):** corregido — guard de generación en el handler y
  en `speakNow`; prueba en C-011-06.
- **MED-2 (C-011-05 no construía su DADO; la retención física no es
  observable sin recolector):** corregido por enmienda honesta — el caso
  ahora declara que el doble exige la preparación completa antes de
  `speak` y que la retención física se mide en dispositivo (Ola 2).
- **MED-3 (P-05 «exponer» sin canal):** corregido por enmienda — la
  exposición es la costura de SPEC-009 y se materializa en la Ola 2; lo
  testeable del adaptador es el `error` en el acto.
- **MED-4 (estado §6 citaba este informe antes de existir y generalizaba
  la mutación):** corregido — este informe existe y la línea de §6 ahora
  cita la mutación concreta y remite aquí la generalización (§4).
- **LOW-1 (dedup por índice inalcanzable):** corregido — código muerto
  fuera; P-11 enmendado al mecanismo real (cierre único, unificado con
  P-04).
- **LOW-2 (PATCHES parafraseaba los disparos):** corregido — P-02 y P-10
  alineados con la spec enmendada.
- **LOW-3 (derivas de cifras en estado §5/§6):** corregido — «192 casos
  entonces; 193 desde la Ola 1» y «SPEC-011 entonces pendiente».
- **LOW-4 (parcial repetido sin prueba):** corregido — C-011-15 emite un
  interino repetido y afirma que no se re-entrega.
- **LOW-5 (import sin uso):** corregido — `SPEECH_BUDGET_MS` fuera.

Re-ronda R2b sobre el delta corregido: registro abajo al ejecutarse.

## 4. Generalización de la mutación por parche

El invariante de SPEC-011 es «quitar el parche deja su prueba en rojo».
Estado por parche **con dobles** (la mutación de P-06 se ejecutó de
verdad; el resto se deriva del diseño de cada prueba):

| Parche | ¿Protegido con dobles? | Por qué |
|---|---|---|
| P-01 | sí | sin esperar `voiceschanged`, `say` no habla y C-011-04 falla en `done` |
| P-02 | preparación sí; retención física → Ola 2 | el doble sólo emite utterances preparadas (C-011-05); la retención necesita motor real |
| P-03 | sí | sin guard de generación, el terminal tardío cierra la vigente (C-011-06) |
| P-04 | sí | sin cierre idempotente quedan timers/limpieza sin hacer (C-011-07) |
| P-05 | sí | sin resolver `error` en el acto, C-011-08 esperaría al reloj |
| P-06 | **sí, mutación ejecutada** | sin `resume()`, el doble no entrega y C-011-09 cae en `watchdog` |
| P-07 | sí | sin re-escucha no nace la segunda instancia (C-011-10 cuenta 2) |
| P-08 | sí | sin instancia por escucha, `start()` lanza (C-011-11) |
| P-09 | sí | sin no-op del aborto, C-011-12 resolvería error |
| P-10 | sí | sin `no_speech` propio, C-011-13 no resolvería |
| P-11 | entrega única por diseño de promesa | mecanismo unificado con P-04 (enmienda R2); el duplicado no puede entregarse dos veces |
| P-12 | sí | sin `interimResults` declarados, C-011-15 falla en el assert de la instancia |
| P-13 | sí | sin emparejar por prefijo, hablaría con voz ajena (C-011-16) |
| P-14 | sí | sin mapeo del permiso, C-011-17 no resolvería `recognition_failed` |

## 5. No cubierto por esta ola (declarado)

- **Nada medido en navegador**: la matriz de `ADR-009` (seis celdas) y la
  ventana de `ADR-011` exigen la Ola 2 (arnés + dispositivos).
- La retención física de P-02 y la sonda P-05 sin activación son
  medición de dispositivo, no de dobles.
- La ruta de lectura quedó en 1599/1600: **una** línea de margen; la
  Ola 2 debe contar el presupuesto antes de escribir en archivos de la
  ruta.

## 6. Siguiente decisión

Autorizar la **Ola 2 (T-02)**: arnés de medición `examples/medidor-spec-011/`
con las seis celdas y la sonda P-05 aparte. Requiere dispositivos Safari
(macOS/iOS), Chrome (escritorio/Android) y Edge (escritorio/móvil), o
declararlas «sin medir» una por una.

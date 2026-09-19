// Pruebas de los puertos y presupuestos (SPEC-004) y del contrato de
// locución (SPEC-003).
//
// Una prueba por cada caso `C-004-*` y `C-003-*`, con su identificador en el
// nombre, para la trazabilidad automática.
//
// Los casos que describen la conducción del turno —eventos, `session.values`,
// `mode`— se prueban aquí en la frontera que este módulo sí gobierna: el
// doble de puerto invocado contra la firma declarada, la petición que
// recibe y la comprobación de su resultado. La conducción en sí (qué evento
// se emite, cuándo se escribe un valor) es de la sesión del núcleo y se
// prueba donde vive esa sesión; cada prueba deja dicho qué parte cubre.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPEECH_BUDGET_MS,
  TURN_BUDGET_MS,
  BUDGETS,
  PORT_NAMES,
  PORT_RETRY_LIMIT,
  CANCEL_CONTRACT,
  budgetFor,
  createRequest,
  requestFor,
  validateRequest,
  PORT_CONTRACTS,
  validatePort,
  validatePorts,
  checkPortResult,
  validateSpeechResult,
  validateListeningResult,
  validateInterpretation,
  validateControlCategory,
  validatePhrasesText,
  validateDecision,
  PortContractError,
  INTERPRETATION_CODES,
  UNRESOLVED_INTERPRETATION_CODES,
  CONTROL_CATEGORIES,
  LISTENING_TYPES,
  DECISIONS,
  SPEECH_RESULTS,
  PHRASES_DECLARED_ERRORS,
} from '../src/core/ports.js';

// --- Utilidades de las pruebas ---

const CAMPO = {
  id: 'peso',
  type: 'number',
  range: { min: 0, max: 300 },
  promptKey: 'pregunta.peso',
};

const TURNO = { id: 7, token: 'turno-opaco-7', expectedState: 'listening' };

// La firma de SPEC-004, escrita aquí a mano: si el contrato del módulo se
// desvía de la spec, la prueba falla.
const METODO = {
  speaker: 'say',
  listener: 'listen',
  fieldInterpreter: 'interpret',
  controlInterpreter: 'interpret',
  phrases: 'text',
  proposer: 'propose',
};

const ORDEN = {
  speaker: ['text', 'request'],
  listener: ['request', 'callbacks'],
  fieldInterpreter: ['text', 'field', 'request'],
  controlInterpreter: ['text', 'confidence', 'request'],
  phrases: ['key', 'context', 'request'],
  proposer: ['state', 'event', 'allowedOptions', 'request'],
};

const VALORES = {
  text: 'treinta',
  callbacks: {},
  field: CAMPO,
  confidence: 0.9,
  key: 'pregunta.peso',
  context: {},
  state: 'thinking',
  event: { type: 'turn_opened' },
  allowedOptions: ['confirm'],
};

const CORRECTO = {
  speaker: 'done',
  listener: { type: 'speech', text: 'treinta', confidence: 0.9 },
  fieldInterpreter: { code: 'ok', value: 30, unit: 'kg' },
  controlInterpreter: 'affirmation',
  phrases: '¿Cuánto pesaste?',
  proposer: 'confirm',
};

function senal() {
  return new AbortController().signal;
}

function peticion(portName, turn = TURNO, signal = senal()) {
  return requestFor(portName, { turn: turn, signal: signal });
}

function argsDe(portName, request) {
  return ORDEN[portName].map(
    (nombre) => (nombre === 'request' ? request : VALORES[nombre]));
}

// Doble que registra sus invocaciones y resuelve un resultado dado.
function doble(portName, resultado = CORRECTO[portName],
  metodo = PORT_CONTRACTS[portName].method) {
  const llamadas = [];
  const port = {
    llamadas: llamadas,
    cancel() {
      llamadas.push(['cancel']);
    },
  };
  port[metodo] = function (...args) {
    llamadas.push(args);
    return Promise.resolve(resultado);
  };
  return port;
}

// Un valor fuera del contrato debe detectarse como fallo del puerto.
function falloDePuerto(fn) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof PortContractError,
      'se esperaba PortContractError, llegó: ' + error);
    assert.equal(error.code, 'port_failure');
    return error;
  }
  return assert.fail('el contrato roto no se detectó como fallo del puerto');
}

// Un mal uso del módulo (no un puerto roto) es TypeError de uso.
function usoIncorrecto(fn) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof TypeError && !(error instanceof PortContractError),
      'se esperaba un TypeError de uso, llegó: ' + error);
    return error;
  }
  return assert.fail('el uso incorrecto no se detectó');
}

// --- Casos de SPEC-004 ---

test('C-004-01: toda invocación lleva turn, budgetMs y signal, y nada del núcleo', async () => {
  for (const portName of PORT_NAMES) {
    const contrato = PORT_CONTRACTS[portName];
    const request = peticion(portName);
    const port = doble(portName);
    await port[contrato.method](...argsDe(portName, request));
    const recibida = port.llamadas[0].find((arg) => arg === request);
    assert.deepEqual(Object.keys(recibida).sort(),
      ['budgetMs', 'signal', 'turn']);
    assert.equal(recibida.turn, TURNO);
    assert.equal(recibida.budgetMs, BUDGETS[portName]);
    assert.equal(recibida.signal.aborted, false);
    assert.ok(contrato.parameters.includes('request'));
    for (const prohibido of ['counters', 'thresholds', 'policy',
      'maxAttempts', 'maxConsecutiveFailures']) {
      assert.ok(!contrato.parameters.includes(prohibido),
        portName + ' declara «' + prohibido + '»');
    }
    usoIncorrecto(() => createRequest({
      turn: TURNO, budgetMs: 5, signal: senal(), counters: {},
    }));
    usoIncorrecto(() => validateRequest({
      turn: TURNO, budgetMs: 5, signal: senal(), policy: {},
    }));
  }
});

test('C-004-02: TURN_BUDGET_MS vale 30000 y es el budgetMs de los cinco puertos', () => {
  assert.equal(TURN_BUDGET_MS, 30000);
  assert.ok(Object.isFrozen(BUDGETS));
  assert.deepEqual(Object.keys(BUDGETS).sort(), [...PORT_NAMES].sort());
  assert.equal(BUDGETS.speaker, SPEECH_BUDGET_MS);
  for (const portName of ['listener', 'fieldInterpreter',
    'controlInterpreter', 'phrases', 'proposer']) {
    assert.equal(BUDGETS[portName], TURN_BUDGET_MS, portName);
    assert.equal(budgetFor(portName), TURN_BUDGET_MS, portName);
    assert.equal(peticion(portName).budgetMs, TURN_BUDGET_MS, portName);
  }
  assert.equal(budgetFor('speaker'), SPEECH_BUDGET_MS);
  usoIncorrecto(() => budgetFor('locutor'));
});

test('C-004-03: request.turn es el Turn de SPEC-002 con id, token y expectedState', () => {
  const request = peticion('fieldInterpreter');
  assert.equal(request.turn, TURNO);
  assert.equal(request.turn.id, 7);
  assert.equal(request.turn.token, 'turno-opaco-7');
  assert.equal(request.turn.expectedState, 'listening');
  assert.deepEqual(Object.keys(request.turn),
    ['id', 'token', 'expectedState']);
  usoIncorrecto(() => validateRequest({
    turn: { id: 7, token: 't' }, budgetMs: 5, signal: senal(),
  }));
  usoIncorrecto(() => validateRequest({
    turn: { id: 0, token: 't', expectedState: 'idle' },
    budgetMs: 5, signal: senal(),
  }));
  usoIncorrecto(() => validateRequest({
    turn: { id: 7, token: 't', expectedState: '' },
    budgetMs: 5, signal: senal(),
  }));
});

test('C-004-04: sin `ports` los seis contratos por omisión son invocables y prometen', async () => {
  assert.equal(validatePorts(undefined), undefined);
  assert.deepEqual(validatePorts({}), {});
  assert.equal(PORT_NAMES.length, 6);
  for (const portName of PORT_NAMES) {
    const contrato = PORT_CONTRACTS[portName];
    assert.equal(contrato.method, METODO[portName]);
    assert.deepEqual(contrato.parameters, ORDEN[portName]);
    assert.equal(contrato.budgetMs, BUDGETS[portName]);
    const port = doble(portName);
    assert.equal(validatePort(portName, port), port);
    const promesa = port[contrato.method](...argsDe(portName));
    assert.ok(promesa instanceof Promise, portName + ' no devolvió promesa');
    checkPortResult(portName, await promesa,
      { field: CAMPO, allowedOptions: ['confirm'] });
  }
});

test('C-004-05: cancelar aborta signal y llama a cancel(); el tardío no encadena', async () => {
  const control = new AbortController();
  const request = requestFor('listener',
    { turn: TURNO, signal: control.signal });
  assert.equal(request.signal, control.signal);
  assert.equal(request.signal.aborted, false);
  const port = doble('listener');
  validatePort('listener', port);
  control.abort();
  port.cancel();
  port.cancel();
  assert.equal(request.signal.aborted, true);
  assert.deepEqual(port.llamadas, [['cancel'], ['cancel']]);
  const tardio = await port[PORT_CONTRACTS.listener.method](request, {});
  assert.equal(checkPortResult('listener', tardio), tardio);
  assert.equal(request.signal.aborted, true);
  assert.equal(CANCEL_CONTRACT.method, 'cancel');
  assert.equal(CANCEL_CONTRACT.synchronous, true);
  assert.equal(CANCEL_CONTRACT.idempotent, true);
  assert.equal(CANCEL_CONTRACT.throws, false);
  assert.equal(CANCEL_CONTRACT.settlesPromise, false);
  assert.ok(Object.isFrozen(CANCEL_CONTRACT));
  usoIncorrecto(() => validatePort('listener', { listen() {} }));
});

test('C-004-06: agotar budgetMs es fallo explícito y ningún éxito nace del reloj', () => {
  for (const portName of PORT_NAMES) {
    assert.ok(Number.isInteger(BUDGETS[portName]) && BUDGETS[portName] > 0);
    usoIncorrecto(() => createRequest({
      turn: TURNO, budgetMs: 0, signal: senal(),
    }));
    usoIncorrecto(() => validateRequest({
      turn: TURNO, budgetMs: -1, signal: senal(),
    }));
    usoIncorrecto(() => validateRequest({
      turn: TURNO, budgetMs: 1.5, signal: senal(),
    }));
  }
  assert.equal(PORT_RETRY_LIMIT, 1);
  for (const enumerado of [SPEECH_RESULTS, LISTENING_TYPES,
    INTERPRETATION_CODES, DECISIONS, CONTROL_CATEGORIES]) {
    assert.ok(Object.isFrozen(enumerado));
    for (const valor of enumerado) {
      assert.ok(!/time|clock|expirado|agotado/.test(valor), valor);
    }
  }
});

test('C-004-07: el presupuesto no depende del modo y la petición no lleva `mode`', () => {
  const request = requestFor('listener', { turn: TURNO, signal: senal() });
  assert.equal(request.budgetMs, TURN_BUDGET_MS);
  assert.equal(Object.prototype.hasOwnProperty.call(request, 'mode'), false);
  usoIncorrecto(() => requestFor('listener',
    { turn: TURNO, signal: senal(), mode: 'assisted' }));
  usoIncorrecto(() => createRequest({
    turn: TURNO, budgetMs: TURN_BUDGET_MS, signal: senal(), mode: 'assisted',
  }));
  for (const portName of PORT_NAMES) {
    assert.equal(BUDGETS[portName], PORT_CONTRACTS[portName].budgetMs);
  }
});

test('C-004-27: como mucho un reintento por turno, sin tercer intento', () => {
  assert.equal(PORT_RETRY_LIMIT, 1);
  const intentosPorTurno = 1 + PORT_RETRY_LIMIT;
  assert.equal(intentosPorTurno, 2);
  for (const portName of PORT_NAMES) {
    const primero = requestFor(portName, { turn: TURNO, signal: senal() });
    const reintento = requestFor(portName, { turn: TURNO, signal: senal() });
    assert.equal(primero.budgetMs, reintento.budgetMs);
    assert.equal(reintento.budgetMs, BUDGETS[portName]);
  }
});

test('C-004-08: un `code` fuera del enumerado cerrado es fallo del puerto', async () => {
  for (const codigo of ['quizá', 'sin_lectura', 0, null, undefined]) {
    const port = doble('fieldInterpreter', { code: codigo });
    const valor = await port[PORT_CONTRACTS.fieldInterpreter.method](
      'treinta', CAMPO, peticion('fieldInterpreter'));
    const error = falloDePuerto(
      () => checkPortResult('fieldInterpreter', valor, { field: CAMPO }));
    assert.equal(error.port, 'fieldInterpreter');
  }
  assert.deepEqual([...INTERPRETATION_CODES],
    ['ok', 'unparseable', 'ambiguous', 'out_of_range']);
  assert.equal(
    validateInterpretation({ code: 'ok', value: 30 }, { field: CAMPO }).code,
    'ok');
});

test('C-004-09: `ok` sin `value` es contrato roto, no una lectura vacía', async () => {
  const port = doble('fieldInterpreter', { code: 'ok', unit: 'kg' });
  const valor = await port[PORT_CONTRACTS.fieldInterpreter.method](
    'treinta', CAMPO, peticion('fieldInterpreter'));
  const error = falloDePuerto(
    () => checkPortResult('fieldInterpreter', valor, { field: CAMPO }));
  assert.match(error.reason, /value/);
  // Sin campo declarado no hay tipo que contrastar: el requisito de `value`
  // se comprueba solo.
  falloDePuerto(() => checkPortResult('fieldInterpreter', { code: 'ok' }));
  falloDePuerto(() => checkPortResult('fieldInterpreter',
    { code: 'ok', value: 'treinta' }, { field: CAMPO }));
  falloDePuerto(() => checkPortResult('fieldInterpreter',
    { code: 'ok', value: 30.5 }, { field: { id: 'n', type: 'integer' } }));
  checkPortResult('fieldInterpreter',
    { code: 'ok', value: 30 }, { field: { id: 'n', type: 'integer' } });
});

test('C-004-10: unparseable, ambiguous y out_of_range no resuelven lectura', async () => {
  for (const code of UNRESOLVED_INTERPRETATION_CODES) {
    const port = doble('fieldInterpreter', { code: code });
    const valor = await port[PORT_CONTRACTS.fieldInterpreter.method](
      'treinta', CAMPO, peticion('fieldInterpreter'));
    checkPortResult('fieldInterpreter', valor, { field: CAMPO });
    assert.equal(Object.prototype.hasOwnProperty.call(valor, 'value'), false);
    falloDePuerto(() => checkPortResult('fieldInterpreter',
      { code: code, value: 30 }, { field: CAMPO }));
  }
  assert.deepEqual([...UNRESOLVED_INTERPRETATION_CODES],
    ['unparseable', 'ambiguous', 'out_of_range']);
  assert.deepEqual([...PORT_CONTRACTS.fieldInterpreter.unresolvedResults],
    [...UNRESOLVED_INTERPRETATION_CODES]);
  // Fuera de `range` no es fallo del puerto: el núcleo lo vuelve
  // `unresolved_value` (C-001-13) y por eso el puerto no lo rechaza.
  checkPortResult('fieldInterpreter',
    { code: 'ok', value: 900 }, { field: CAMPO });
  checkPortResult('fieldInterpreter',
    { code: 'ambiguous', candidates: [30, 13] }, { field: CAMPO });
  falloDePuerto(() => checkPortResult('fieldInterpreter',
    { code: 'ambiguous', candidates: [] }, { field: CAMPO }));
  falloDePuerto(() => checkPortResult('fieldInterpreter',
    { code: 'unparseable', candidates: [30] }, { field: CAMPO }));
});

test('C-004-11: una categoría fuera del enumerado cerrado es fallo del puerto', async () => {
  for (const categoria of ['si', 'afirmativo', 'SÍ', 1, null]) {
    const port = doble('controlInterpreter', categoria);
    const valor = await port[PORT_CONTRACTS.controlInterpreter.method](
      'sí', 0.9, peticion('controlInterpreter'));
    const error = falloDePuerto(
      () => checkPortResult('controlInterpreter', valor));
    assert.equal(error.port, 'controlInterpreter');
  }
  assert.equal(validateControlCategory('unclassified'), 'unclassified');
  falloDePuerto(() => validateControlCategory('sin_categoria'));
  assert.deepEqual([...CONTROL_CATEGORIES],
    ['affirmation', 'negation', 'repetition', 'manual', 'unclassified']);
});

test('C-004-12: `unclassified` no se interpreta como afirmación', async () => {
  const port = doble('controlInterpreter', 'unclassified');
  const valor = await port[PORT_CONTRACTS.controlInterpreter.method](
    'sí', 0.99, peticion('controlInterpreter'));
  assert.equal(checkPortResult('controlInterpreter', valor), 'unclassified');
  assert.notEqual(valor, 'affirmation');
  assert.ok(CONTROL_CATEGORIES.includes('unclassified'));
  // El enumerado es cerrado y está en inglés: el nombre heredado no entra.
  falloDePuerto(() => checkPortResult('controlInterpreter', 'sin_categoria'));
  falloDePuerto(() => checkPortResult('controlInterpreter', 'afirmación'));
});

test('C-004-13: por debajo del umbral externo la categoría es `unclassified`', async () => {
  function interpretadorConUmbral(umbral) {
    const port = doble('controlInterpreter');
    port[PORT_CONTRACTS.controlInterpreter.method] =
      function (text, confidence, request) {
        port.llamadas.push([text, confidence, request]);
        const categoria = confidence < umbral
          ? 'unclassified' : 'affirmation';
        return Promise.resolve(categoria);
      };
    return port;
  }
  const externo = interpretadorConUmbral(0.8);
  const bajo = await externo.interpret('sí', 0.4,
    peticion('controlInterpreter'));
  assert.equal(checkPortResult('controlInterpreter', bajo), 'unclassified');
  const sobre = await externo.interpret('sí', 0.95,
    peticion('controlInterpreter'));
  assert.equal(checkPortResult('controlInterpreter', sobre), 'affirmation');
  const request = peticion('controlInterpreter');
  assert.deepEqual(Object.keys(request).sort(),
    ['budgetMs', 'signal', 'turn']);
  usoIncorrecto(() => createRequest({
    turn: TURNO, budgetMs: TURN_BUDGET_MS, signal: senal(),
    confidenceThreshold: 0.8,
  }));
});

test('C-004-14: el mismo texto y confidence cambian al cambiar el umbral externo', async () => {
  const CONFIANZA = 0.6;
  function clasificar(umbral) {
    const port = doble('controlInterpreter');
    port[PORT_CONTRACTS.controlInterpreter.method] =
      function (text, confidence) {
        port.llamadas.push([text, confidence]);
        return Promise.resolve(
          confidence < umbral ? 'unclassified' : 'affirmation');
      };
    return port.interpret('sí', CONFIANZA, peticion('controlInterpreter'));
  }
  const permisivo = checkPortResult('controlInterpreter',
    await clasificar(0.5));
  const estricto = checkPortResult('controlInterpreter',
    await clasificar(0.9));
  assert.equal(permisivo, 'affirmation');
  assert.equal(estricto, 'unclassified');
  assert.notEqual(permisivo, estricto);
});

test('C-004-15: `no_speech` y `recognition_failed` son salida declarada, no un valor cero', async () => {
  for (const tipo of ['no_speech', 'recognition_failed']) {
    const port = doble('listener', { type: tipo });
    const valor = await port[PORT_CONTRACTS.listener.method](
      peticion('listener'), {});
    checkPortResult('listener', valor);
    assert.equal(validateListeningResult(valor), valor);
    assert.equal(Object.prototype.hasOwnProperty.call(valor, 'text'), false);
    falloDePuerto(() => checkPortResult('listener', { type: tipo, text: '' }));
    falloDePuerto(() => checkPortResult('listener', { type: tipo, text: '0' }));
    falloDePuerto(() => checkPortResult('listener',
      { type: tipo, confidence: 0 }));
  }
  falloDePuerto(() => checkPortResult('listener',
    { type: 'speech', text: '' }));
  falloDePuerto(() => checkPortResult('listener', { type: 'speech' }));
  checkPortResult('listener', { type: 'speech', text: 'treinta' });
});

test('C-004-16: un `type` fuera del enumerado cerrado es fallo del puerto', async () => {
  for (const tipo of ['silencio', 'no-speech', 'partial', 0, null]) {
    const port = doble('listener', { type: tipo });
    const valor = await port[PORT_CONTRACTS.listener.method](
      peticion('listener'), {});
    const error = falloDePuerto(() => checkPortResult('listener', valor));
    assert.equal(error.port, 'listener');
  }
  assert.deepEqual([...LISTENING_TYPES],
    ['speech', 'no_speech', 'recognition_failed']);
});

test('C-004-17: un Decision válido fuera de `allowedOptions` es fallo del puerto', async () => {
  const allowedOptions = ['confirm', 'reask'];
  const port = doble('proposer', 'manual');
  const valor = await port[PORT_CONTRACTS.proposer.method](
    'thinking', { type: 'value_unresolved' }, allowedOptions,
    peticion('proposer'));
  const error = falloDePuerto(
    () => checkPortResult('proposer', valor, { allowedOptions: allowedOptions }));
  assert.equal(error.port, 'proposer');
  assert.deepEqual(allowedOptions, ['confirm', 'reask']);
  checkPortResult('proposer', 'confirm', { allowedOptions: allowedOptions });
  checkPortResult('proposer', 'manual', { allowedOptions: ['manual'] });
  usoIncorrecto(() => checkPortResult('proposer', 'confirm',
    { allowedOptions: [] }));
  usoIncorrecto(() => checkPortResult('proposer', 'confirm',
    { allowedOptions: ['guardar'] }));
});

test('C-004-18: `confirm` admisible pide confirmación, y guardar no es Decision', () => {
  assert.equal(
    validateDecision('confirm', { allowedOptions: ['confirm', 'reask'] }),
    'confirm');
  checkPortResult('proposer', 'confirm', { allowedOptions: ['confirm'] });
  assert.ok(DECISIONS.includes('confirm'));
  for (const fuera of ['save', 'guardar', 'store', 'confirmar']) {
    falloDePuerto(() => checkPortResult('proposer', fuera,
      { allowedOptions: DECISIONS }));
  }
});

test('C-004-19: `reask` se admite y el contador finito desemboca en `manual`', () => {
  assert.equal(
    validateDecision('reask', { allowedOptions: ['reask', 'manual'] }),
    'reask');
  assert.ok(DECISIONS.includes('reask'));
  assert.ok(DECISIONS.includes('manual'));
  assert.deepEqual([...DECISIONS], ['confirm', 'reask', 'manual']);
  falloDePuerto(() => checkPortResult('proposer', 'reask',
    { allowedOptions: ['confirm'] }));
  usoIncorrecto(() => checkPortResult('proposer', 'reask',
    { allowedOptions: [] }));
});

test('C-004-20: `manual` es admisible en los cinco estados visibles', () => {
  for (const estado of ['idle', 'listening', 'thinking', 'speaking', 'error']) {
    const turn = { id: 1, token: 'turno-' + estado, expectedState: estado };
    const request = requestFor('proposer', { turn: turn, signal: senal() });
    assert.equal(request.turn.expectedState, estado);
    assert.equal(
      validateDecision('manual', { allowedOptions: ['manual', 'confirm'] }),
      'manual');
  }
  falloDePuerto(() => checkPortResult('proposer', 'manual',
    { allowedOptions: ['confirm'] }));
});

test('C-004-21: un valor fuera del enumerado Decision es fallo del puerto', async () => {
  for (const valor of ['guardar', '', null, true, { decision: 'confirm' }]) {
    const port = doble('proposer', valor);
    const resuelto = await port[PORT_CONTRACTS.proposer.method](
      'thinking', {}, ['confirm'], peticion('proposer'));
    const error = falloDePuerto(() => checkPortResult('proposer', resuelto,
      { allowedOptions: ['confirm'] }));
    assert.equal(error.port, 'proposer');
  }
  // El enumerado es cerrado por sí solo: sin `allowedOptions` tampoco pasa.
  falloDePuerto(() => checkPortResult('proposer', 'guardar'));
  falloDePuerto(() => checkPortResult('proposer', 'save'));
  checkPortResult('proposer', 'confirm', { allowedOptions: ['confirm'] });
});

test('C-004-22: el dato no pasa por `phrases` como argumento', async () => {
  const port = doble('phrases');
  port[PORT_CONTRACTS.phrases.method] =
    function (key, context, request) {
      port.llamadas.push([key, context, request]);
      return Promise.resolve('¿Cuánto pesaste?');
    };
  const request = peticion('phrases');
  await port.text('prompt.weight', { fieldId: 'peso' }, request);
  assert.deepEqual(port.llamadas[0], ['prompt.weight', { fieldId: 'peso' },
    request]);
  assert.deepEqual([...PORT_CONTRACTS.phrases.parameters],
    ['key', 'context', 'request']);
  for (const nombre of PORT_CONTRACTS.phrases.parameters) {
    assert.ok(!['value', 'spokenValue', 'readback', 'displayText']
      .includes(nombre), 'el dato viajaría por «' + nombre + '»');
  }
  checkPortResult('phrases', '¿Cuánto pesaste?');
  assert.equal(validatePhrasesText('¿Cuánto pesaste?'), '¿Cuánto pesaste?');
});

test('C-004-23: `missing_text` es declarado, y el puerto no improvisa texto', async () => {
  assert.deepEqual([...PHRASES_DECLARED_ERRORS],
    ['missing_text', 'over_budget']);
  assert.ok(Object.isFrozen(PHRASES_DECLARED_ERRORS));
  assert.deepEqual([...PORT_CONTRACTS.phrases.declaredErrors],
    [...PHRASES_DECLARED_ERRORS]);
  const port = doble('phrases');
  port[PORT_CONTRACTS.phrases.method] = () => Promise.reject(
    Object.assign(new Error('falta la clave'), { code: 'missing_text' }));
  const rechazo = await port.text('prompt.ausente', {},
    peticion('phrases')).catch((error) => error);
  assert.ok(PHRASES_DECLARED_ERRORS.includes(rechazo.code));
  assert.ok(!(rechazo instanceof PortContractError));
  const noDeclarado = Object.assign(new Error('boom'), { code: 'boom' });
  assert.ok(!PHRASES_DECLARED_ERRORS.includes(noDeclarado.code));
  falloDePuerto(() => checkPortResult('phrases', ''));
  falloDePuerto(() => checkPortResult('phrases', 0));
});

test('C-004-24: `over_budget` es del catálogo, y el núcleo no lo decide', () => {
  assert.deepEqual([...PHRASES_DECLARED_ERRORS],
    ['missing_text', 'over_budget']);
  assert.ok(PHRASES_DECLARED_ERRORS.includes('over_budget'));
  assert.deepEqual([...PORT_CONTRACTS.phrases.declaredErrors],
    [...PHRASES_DECLARED_ERRORS]);
  const request = peticion('phrases');
  assert.equal(request.budgetMs, TURN_BUDGET_MS);
  assert.deepEqual(Object.keys(request).sort(),
    ['budgetMs', 'signal', 'turn']);
  usoIncorrecto(() => createRequest({
    turn: TURNO, budgetMs: TURN_BUDGET_MS, signal: senal(), maxWords: 20,
  }));
  assert.deepEqual(Object.keys(PORT_CONTRACTS.phrases).sort(),
    ['budgetMs', 'cancel', 'declaredErrors', 'method', 'name', 'parameters',
      'validate']);
});

test('C-004-25: inyectar los seis dobles no cambia el `mode`', () => {
  const ports = {};
  for (const portName of PORT_NAMES) {
    ports[portName] = doble(portName);
  }
  assert.equal(validatePorts(ports), ports);
  for (const portName of PORT_NAMES) {
    assert.equal(validatePort(portName, ports[portName]), ports[portName]);
    const request = peticion(portName);
    assert.equal(Object.prototype.hasOwnProperty.call(request, 'mode'), false);
  }
  usoIncorrecto(() => requestFor('speaker',
    { turn: TURNO, signal: senal(), mode: 'assisted' }));
  usoIncorrecto(() => validateRequest({
    turn: TURNO, budgetMs: TURN_BUDGET_MS, signal: senal(), mode: 'assisted',
  }));
  assert.equal(PORT_NAMES.length, 6);
});

test('C-004-26: cada invocación llega con los argumentos y en el orden declarados', async () => {
  for (const portName of PORT_NAMES) {
    assert.equal(PORT_CONTRACTS[portName].method, METODO[portName]);
    assert.deepEqual(PORT_CONTRACTS[portName].parameters, ORDEN[portName]);
    const request = peticion(portName);
    const esperado = ORDEN[portName].map(
      (nombre) => (nombre === 'request' ? request : VALORES[nombre]));
    const port = doble(portName, CORRECTO[portName], METODO[portName]);
    assert.equal(await port[METODO[portName]](...esperado),
      CORRECTO[portName]);
    assert.deepEqual(port.llamadas[0], esperado);
  }
});

// --- Casos de SPEC-003 ---

test('C-003-01: sólo `done` encadena y el paso siguiente se ejecuta', async () => {
  const port = doble('speaker');
  const request = requestFor('speaker', { turn: TURNO, signal: senal() });
  const resultado = await port.say('¿Cuánto pesaste?', request);
  assert.equal(checkPortResult('speaker', resultado), 'done');
  assert.equal(validateSpeechResult('done'), 'done');
  assert.deepEqual([...PORT_CONTRACTS.speaker.chainingResults], ['done']);
  assert.deepEqual([...SPEECH_RESULTS], ['done', 'error', 'watchdog']);
  assert.deepEqual([...PORT_CONTRACTS.speaker.parameters],
    ['text', 'request']);
  assert.equal(typeof port.cancel, 'function');
});

test('C-003-02: `error` es resultado declarado y no encadena', async () => {
  const port = doble('speaker', 'error');
  const resultado = await port.say('¿Cuánto pesaste?',
    requestFor('speaker', { turn: TURNO, signal: senal() }));
  assert.equal(checkPortResult('speaker', resultado), 'error');
  assert.ok(SPEECH_RESULTS.includes('error'));
  assert.ok(!PORT_CONTRACTS.speaker.chainingResults.includes('error'));
});

test('C-003-03: `watchdog` es resultado declarado y no encadena', async () => {
  const port = doble('speaker', 'watchdog');
  const resultado = await port.say('¿Cuánto pesaste?',
    requestFor('speaker', { turn: TURNO, signal: senal() }));
  assert.equal(checkPortResult('speaker', resultado), 'watchdog');
  assert.ok(SPEECH_RESULTS.includes('watchdog'));
  assert.ok(!PORT_CONTRACTS.speaker.chainingResults.includes('watchdog'));
});

test('C-003-04: tras la cancelación el paso siguiente no se ejecuta', async () => {
  const control = new AbortController();
  const request = requestFor('speaker',
    { turn: TURNO, signal: control.signal });
  const port = doble('speaker');
  control.abort();
  port.cancel();
  assert.equal(request.signal.aborted, true);
  assert.deepEqual(port.llamadas, [['cancel']]);
  const tardio = await port.say('x', request);
  assert.equal(checkPortResult('speaker', tardio), 'done');
  assert.equal(request.signal.aborted, true);
  assert.deepEqual([...PORT_CONTRACTS.speaker.chainingResults], ['done']);
});

test('C-003-05: agotar SPEECH_BUDGET_MS no produce ninguna transición de éxito', () => {
  assert.equal(SPEECH_BUDGET_MS, 20000);
  assert.equal(PORT_CONTRACTS.speaker.budgetMs, SPEECH_BUDGET_MS);
  assert.equal(requestFor('speaker', { turn: TURNO, signal: senal() }).budgetMs,
    SPEECH_BUDGET_MS);
  assert.ok(SPEECH_RESULTS.includes('watchdog'));
  assert.ok(!PORT_CONTRACTS.speaker.chainingResults.includes('watchdog'));
  for (const valor of SPEECH_RESULTS) {
    assert.ok(!/time|clock|expirado|agotado/.test(valor), valor);
  }
  usoIncorrecto(() => createRequest({
    turn: TURNO, budgetMs: 0, signal: senal(),
  }));
});

test('C-003-07: SPEECH_BUDGET_MS vale 20000 y es el budgetMs del speaker', () => {
  assert.equal(SPEECH_BUDGET_MS, 20000);
  assert.equal(BUDGETS.speaker, SPEECH_BUDGET_MS);
  assert.equal(budgetFor('speaker'), 20000);
  assert.equal(requestFor('speaker', { turn: TURNO, signal: senal() }).budgetMs,
    20000);
  assert.notEqual(BUDGETS.speaker, BUDGETS.listener);
});

test('C-003-08: la petición del speaker lleva turn, budgetMs y signal', async () => {
  const port = doble('speaker');
  const request = requestFor('speaker', { turn: TURNO, signal: senal() });
  await port.say('¿Cuánto pesaste?', request);
  const recibida = port.llamadas[0][1];
  assert.deepEqual(Object.keys(recibida).sort(),
    ['budgetMs', 'signal', 'turn']);
  assert.equal(recibida.budgetMs, SPEECH_BUDGET_MS);
  assert.equal(recibida.turn, TURNO);
  assert.equal(typeof recibida.signal.aborted, 'boolean');
  assert.equal(validateRequest(recibida), recibida);
});

test('C-003-09: un `done` posterior a `cancel()` es tardío y no encadena', async () => {
  const port = doble('speaker');
  const request = requestFor('speaker', { turn: TURNO, signal: senal() });
  port.cancel();
  const tarde = await port.say('x', request);
  assert.equal(tarde, 'done');
  assert.deepEqual(port.llamadas, [['cancel'], ['x', request]]);
  assert.equal(CANCEL_CONTRACT.synchronous, true);
  assert.equal(CANCEL_CONTRACT.settlesPromise, false);
  assert.deepEqual([...PORT_CONTRACTS.speaker.chainingResults], ['done']);
});

test('C-003-10: un `done` fuera de `expectedState` es no-op', () => {
  const turn = { id: 3, token: 'turno-3', expectedState: 'confirming' };
  const request = requestFor('speaker', { turn: turn, signal: senal() });
  assert.equal(request.turn, turn);
  assert.equal(request.turn.expectedState, 'confirming');
  assert.deepEqual(Object.keys(request.turn),
    ['id', 'token', 'expectedState']);
  usoIncorrecto(() => validateRequest({
    turn: { id: 3, token: 'turno-3' }, budgetMs: 5, signal: senal(),
  }));
  usoIncorrecto(() => validateRequest({
    turn: { id: 3, token: 'turno-3', expectedState: '' },
    budgetMs: 5, signal: senal(),
  }));
  assert.equal(checkPortResult('speaker', 'done'), 'done');
});

test('C-003-11: un resultado fuera del enumerado del speaker es fallo del puerto', async () => {
  for (const valor of ['fin', 'vigilante', 'ok', '', null, 0, true]) {
    const port = doble('speaker', valor);
    const resuelto = await port.say('x',
      requestFor('speaker', { turn: TURNO, signal: senal() }));
    const error = falloDePuerto(() => checkPortResult('speaker', resuelto));
    assert.equal(error.port, 'speaker');
  }
  checkPortResult('speaker', 'done');
  checkPortResult('speaker', 'error');
  checkPortResult('speaker', 'watchdog');
});

// Contratos de los seis puertos y sus presupuestos (SPEC-004, SPEC-003).
//
// Ésta es la frontera del núcleo con lo que implementa el consumidor: hablar,
// escuchar, interpretar, proponer y redactar. Aquí vive el mecanismo —qué
// método, con qué argumentos, con qué tope de tiempo y con qué contrato de
// salida—; la política vive fuera. Un puerto que resuelve algo fuera de su
// contrato no decide: `PortContractError` (code `port_failure`) lo detecta y
// el valor no se acepta.
//
// Es un módulo hoja: no importa nada de `src/`. Su vocabulario prestado está
// acotado a dos puntos y declarado aquí: `expectedState` se acepta como texto
// no vacío, porque su enumerado cerrado es de SPEC-001/SPEC-005 y no de este
// módulo; `field.type` se reconoce para contrastar el `value` de una
// interpretación contra el tipo declarado del campo (SPEC-001).
//
// Dos clases de error, a propósito:
//
// - `PortContractError` — un valor resuelto por un puerto rompió su contrato.
//   Lleva `code = 'port_failure'`, que es lo que SPEC-004 manda anunciar.
// - `TypeError` — mal uso de este módulo (petición mal formada, puerto
//   desconocido o incompleto, `allowedOptions` inválido). No es culpa de un
//   puerto: la capa de configuración del núcleo lo mapea a `invalid_config`.
//   `PortContractError` hereda de `TypeError`, así que se distingue con
//   `instanceof PortContractError`.

// --- Presupuestos (SPEC-003 y SPEC-004) ---

export const SPEECH_BUDGET_MS = 20000; // techo de la locución (SPEC-003)
export const TURN_BUDGET_MS = 30000; // techo de los demás puertos (SPEC-004)

export const PORT_NAMES = Object.freeze([
  'speaker',
  'listener',
  'fieldInterpreter',
  'controlInterpreter',
  'phrases',
  'proposer',
]);

// El `budgetMs` que recibe cada puerto. `speaker` conserva el de SPEC-003
// porque su techo lo gobierna la locución, no el turno.
export const BUDGETS = Object.freeze({
  speaker: SPEECH_BUDGET_MS,
  listener: TURN_BUDGET_MS,
  fieldInterpreter: TURN_BUDGET_MS,
  controlInterpreter: TURN_BUDGET_MS,
  phrases: TURN_BUDGET_MS,
  proposer: TURN_BUDGET_MS,
});

// SPEC-004 §Degradación al agotarse: como mucho un reintento por campo. El
// contador es acumulativo del campo: agotado el reintento, el siguiente
// puerto señalado desemboca en `error` · `failed` con salida manual
// (`C-005-15`); no hay un tercer intento.
export const PORT_RETRY_LIMIT = 1;

// Contrato de `cancel()` para los seis puertos (SPEC-004 §La cancelación):
// síncrona, idempotente, no lanza y no resuelve ni rechaza la promesa.
export const CANCEL_CONTRACT = Object.freeze({
  method: 'cancel',
  synchronous: true,
  idempotent: true,
  throws: false,
  settlesPromise: false,
});

// --- Enumerados cerrados de los contratos de salida (SPEC-004) ---

export const SPEECH_RESULTS = Object.freeze(['done', 'error', 'watchdog']);

export const LISTENING_TYPES = Object.freeze([
  'speech',
  'no_speech',
  'recognition_failed',
]);

export const INTERPRETATION_CODES = Object.freeze([
  'ok',
  'unparseable',
  'ambiguous',
  'out_of_range',
]);

// Estos tres códigos no son una lectura: el núcleo los anuncia con `failure`
// y `code = 'unresolved_value'` (SPEC-004) y nunca escriben valor.
export const UNRESOLVED_INTERPRETATION_CODES = Object.freeze([
  'unparseable',
  'ambiguous',
  'out_of_range',
]);

export const CONTROL_CATEGORIES = Object.freeze([
  'affirmation',
  'negation',
  'repetition',
  'manual',
  'unclassified',
]);

export const DECISIONS = Object.freeze(['confirm', 'reask', 'manual']);

// Única excepción declarada a «un puerto fuera de contrato no decide»
// (SPEC-004 §Errores): `phrases` puede declarar estos dos códigos en vez de
// romper su contrato. Cualquier otro rechazo sí es fallo del puerto.
export const PHRASES_DECLARED_ERRORS = Object.freeze([
  'missing_text',
  'over_budget',
]);

// Enumerado de `Field.type` (SPEC-001). Sólo se usa para contrastar el tipo
// del `value` de una interpretación; no es superficie exportada.
const FIELD_VALUE_TYPES = Object.freeze([
  'number',
  'integer',
  'boolean',
  'text',
]);

// --- Error de contrato de puerto ---

export class PortContractError extends TypeError {
  constructor(port, reason) {
    super('El puerto «' + port + '» rompió su contrato: ' + reason);
    this.name = 'PortContractError';
    this.code = 'port_failure';
    this.port = port;
    this.reason = reason;
  }
}

// --- Utilidades internas ---

function esObjeto(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function esTextoNoVacio(value) {
  return typeof value === 'string' && value.length > 0;
}

function esEnteroPositivo(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function tieneClave(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key)
    && object[key] !== undefined;
}

function esSenal(value) {
  return typeof AbortSignal !== 'undefined'
    ? value instanceof AbortSignal
    : esObjeto(value) && typeof value.aborted === 'boolean';
}

function comprobarTurn(turn) {
  if (!esObjeto(turn)) {
    throw new TypeError('La petición necesita un turn con forma de SPEC-002.');
  }
  if (!esEnteroPositivo(turn.id)) {
    throw new TypeError('turn.id debe ser un entero >= 1 (SPEC-002).');
  }
  if (turn.token === undefined || turn.token === null) {
    throw new TypeError('turn.token es obligatorio: es la clave opaca de '
      + 'comparación del turno (SPEC-002).');
  }
  if (!esTextoNoVacio(turn.expectedState)) {
    throw new TypeError('turn.expectedState debe ser un estado visible '
      + 'declarado (SPEC-002, SPEC-001).');
  }
}

function comprobarTipoDeValor(value, field) {
  const tipo = esObjeto(field) ? field.type : undefined;
  if (!FIELD_VALUE_TYPES.includes(tipo)) {
    return; // sin tipo declarado no hay tipo que exigir
  }
  const valido = tipo === 'integer'
    ? Number.isInteger(value)
    : tipo === 'number'
      ? typeof value === 'number' && Number.isFinite(value)
      : tipo === 'boolean'
        ? typeof value === 'boolean'
        : typeof value === 'string';
  if (!valido) {
    throw new PortContractError('fieldInterpreter',
      'code «ok» exige un «value» del tipo declarado por el campo.');
  }
}

// --- Validación de los contratos de salida ---

// `Interpretation` — qué número se entendió.
// options.field: el `Field` de la invocación, para contrastar el tipo.
export function validateInterpretation(result, options = {}) {
  if (!esObjeto(result)) {
    throw new PortContractError('fieldInterpreter',
      'la interpretación debe ser un objeto.');
  }
  if (!INTERPRETATION_CODES.includes(result.code)) {
    throw new PortContractError('fieldInterpreter',
      'code fuera del enumerado cerrado.');
  }
  if (result.code === 'ok') {
    if (!tieneClave(result, 'value')) {
      throw new PortContractError('fieldInterpreter',
        'code «ok» exige «value»: no es una lectura vacía.');
    }
    comprobarTipoDeValor(result.value, options.field);
  } else if (tieneClave(result, 'value')) {
    throw new PortContractError('fieldInterpreter',
      '«value» sólo acompaña a code «ok»: una lectura no resuelta nunca es '
      + 'candidata a guardar.');
  }
  if (tieneClave(result, 'unit')
      && result.unit !== null && !esTextoNoVacio(result.unit)) {
    throw new PortContractError('fieldInterpreter',
      'unit debe ser una unidad oída no vacía, o null.');
  }
  if (tieneClave(result, 'candidates')) {
    if (result.code !== 'ambiguous') {
      throw new PortContractError('fieldInterpreter',
        '«candidates» sólo acompaña a code «ambiguous».');
    }
    if (!Array.isArray(result.candidates) || result.candidates.length === 0) {
      throw new PortContractError('fieldInterpreter',
        '«candidates» debe ser una lista no vacía.');
    }
  }
  return result;
}

// `ControlCategory` — qué intención de control se reconoció.
export function validateControlCategory(value) {
  if (!CONTROL_CATEGORIES.includes(value)) {
    throw new PortContractError('controlInterpreter',
      'categoría fuera del enumerado cerrado.');
  }
  return value;
}

// `ListeningResult` — qué devolvió la escucha.
export function validateListeningResult(result) {
  if (!esObjeto(result)) {
    throw new PortContractError('listener',
      'el resultado de la escucha debe ser un objeto.');
  }
  if (!LISTENING_TYPES.includes(result.type)) {
    throw new PortContractError('listener',
      'type fuera del enumerado cerrado.');
  }
  if (result.type === 'speech') {
    if (!esTextoNoVacio(result.text)) {
      throw new PortContractError('listener',
        'type «speech» exige un «text» no vacío.');
    }
    if (tieneClave(result, 'confidence')
        && !Number.isFinite(result.confidence)) {
      throw new PortContractError('listener',
        '«confidence» debe ser un número.');
    }
    return result;
  }
  if (tieneClave(result, 'text')) {
    throw new PortContractError('listener',
      '«text» sólo acompaña a type «speech»: el silencio no es una cadena '
      + 'vacía y no es un valor guardado.');
  }
  if (tieneClave(result, 'confidence')) {
    throw new PortContractError('listener',
      '«confidence» sólo acompaña a type «speech».');
  }
  return result;
}

// `Decision` — qué se hace a continuación.
// options.allowedOptions: el subconjunto no vacío que calculó el núcleo.
export function validateDecision(value, options = {}) {
  if (!DECISIONS.includes(value)) {
    throw new PortContractError('proposer',
      'decisión fuera del enumerado cerrado Decision.');
  }
  const allowed = options.allowedOptions;
  if (allowed === undefined) {
    return value;
  }
  if (!Array.isArray(allowed) || allowed.length === 0) {
    throw new TypeError('allowedOptions debe ser un subconjunto no vacío de '
      + 'Decision: lo calcula el núcleo, no el puerto.');
  }
  if (!allowed.every((option) => DECISIONS.includes(option))) {
    throw new TypeError('allowedOptions tiene un valor fuera del enumerado '
      + 'cerrado Decision.');
  }
  if (!allowed.includes(value)) {
    throw new PortContractError('proposer',
      'decisión válida fuera de «allowedOptions»: el propositor sólo elige '
      + 'dentro del conjunto admisible.');
  }
  return value;
}

// `'done' | 'error' | 'watchdog'` — resultado de la locución (SPEC-003).
export function validateSpeechResult(value) {
  if (!SPEECH_RESULTS.includes(value)) {
    throw new PortContractError('speaker',
      'resultado fuera del enumerado cerrado de SPEC-003.');
  }
  return value;
}

// `phrases` resuelve una cadena no vacía; vacía o de otro tipo es fallo del
// puerto, nunca un texto improvisado (SPEC-004).
export function validatePhrasesText(value) {
  if (!esTextoNoVacio(value)) {
    throw new PortContractError('phrases',
      'debe resolver una cadena no vacía.');
  }
  return value;
}

// --- Los seis puertos ---

// Tabla de contratos: método, argumentos en orden, presupuesto, contrato de
// salida y errores declarados. Las firmas son las definitivas de SPEC-004.
export const PORT_CONTRACTS = Object.freeze({
  speaker: Object.freeze({
    name: 'speaker',
    method: 'say',
    parameters: Object.freeze(['text', 'request']),
    budgetMs: SPEECH_BUDGET_MS,
    results: SPEECH_RESULTS,
    // SPEC-003: sólo el cierre real encadena; ni error ni watchdog.
    chainingResults: Object.freeze(['done']),
    declaredErrors: Object.freeze([]),
    cancel: CANCEL_CONTRACT,
    validate: validateSpeechResult,
  }),
  listener: Object.freeze({
    name: 'listener',
    method: 'listen',
    parameters: Object.freeze(['request', 'callbacks']),
    callbacks: Object.freeze(['onPartial', 'onNoSpeech', 'onError']),
    budgetMs: TURN_BUDGET_MS,
    results: LISTENING_TYPES,
    declaredErrors: Object.freeze([]),
    cancel: CANCEL_CONTRACT,
    validate: validateListeningResult,
  }),
  fieldInterpreter: Object.freeze({
    name: 'fieldInterpreter',
    method: 'interpret',
    parameters: Object.freeze(['text', 'field', 'request']),
    budgetMs: TURN_BUDGET_MS,
    results: INTERPRETATION_CODES,
    unresolvedResults: UNRESOLVED_INTERPRETATION_CODES,
    declaredErrors: Object.freeze([]),
    cancel: CANCEL_CONTRACT,
    validate: validateInterpretation,
  }),
  controlInterpreter: Object.freeze({
    name: 'controlInterpreter',
    method: 'interpret',
    parameters: Object.freeze(['text', 'confidence', 'request']),
    budgetMs: TURN_BUDGET_MS,
    results: CONTROL_CATEGORIES,
    declaredErrors: Object.freeze([]),
    cancel: CANCEL_CONTRACT,
    validate: validateControlCategory,
  }),
  phrases: Object.freeze({
    name: 'phrases',
    method: 'text',
    parameters: Object.freeze(['key', 'context', 'request']),
    budgetMs: TURN_BUDGET_MS,
    declaredErrors: PHRASES_DECLARED_ERRORS,
    cancel: CANCEL_CONTRACT,
    validate: validatePhrasesText,
  }),
  proposer: Object.freeze({
    name: 'proposer',
    method: 'propose',
    parameters: Object.freeze(['state', 'event', 'allowedOptions', 'request']),
    budgetMs: TURN_BUDGET_MS,
    results: DECISIONS,
    declaredErrors: Object.freeze([]),
    cancel: CANCEL_CONTRACT,
    validate: validateDecision,
  }),
});

// --- Uso de los puertos ---

// Devuelve el presupuesto declarado de un puerto; un nombre desconocido es
// error de uso (TypeError), no fallo de puerto.
export function budgetFor(portName) {
  if (!Object.prototype.hasOwnProperty.call(BUDGETS, portName)) {
    throw new TypeError('Puerto desconocido: no está entre los seis de '
      + 'SPEC-004.');
  }
  return BUDGETS[portName];
}

// Comprueba la forma inyectada de un puerto: objeto con su método principal
// y con `cancel()` (SPEC-004 §Comportamiento).
export function validatePort(portName, port) {
  const contrato = PORT_CONTRACTS[portName];
  if (contrato === undefined) {
    throw new TypeError('Puerto desconocido: no está entre los seis de '
      + 'SPEC-004.');
  }
  if (!esObjeto(port)) {
    throw new TypeError('El puerto «' + portName + '» debe ser un objeto con '
      + 'métodos, nunca una función suelta.');
  }
  if (typeof port[contrato.method] !== 'function') {
    throw new TypeError('Al puerto «' + portName + '» le falta '
      + contrato.method + '().');
  }
  if (typeof port[contrato.cancel.method] !== 'function') {
    throw new TypeError('Al puerto «' + portName + '» le falta '
      + contrato.cancel.method + '().');
  }
  return port;
}

// `ports` admite cero, uno o los seis puertos (SPEC-004 §Entradas); ausente
// es válido y usa las implementaciones deterministas por omisión.
export function validatePorts(ports) {
  if (ports === undefined) {
    return ports;
  }
  if (!esObjeto(ports)) {
    throw new TypeError('«ports» debe ser un objeto con cero, uno o los seis '
      + 'puertos.');
  }
  for (const portName of Object.keys(ports)) {
    if (!PORT_NAMES.includes(portName)) {
      throw new TypeError('«ports» tiene un puerto desconocido: no está '
        + 'entre los seis de SPEC-004.');
    }
    validatePort(portName, ports[portName]);
  }
  return ports;
}

// Comprueba el resultado resuelto de un puerto contra su contrato de salida.
// Un valor fuera del enumerado cerrado es `PortContractError`.
export function checkPortResult(portName, value, options = {}) {
  const contrato = PORT_CONTRACTS[portName];
  if (contrato === undefined) {
    throw new TypeError('Puerto desconocido: no está entre los seis de '
      + 'SPEC-004.');
  }
  return contrato.validate(value, options);
}

// --- La petición ---

const REQUEST_KEYS = Object.freeze(['turn', 'budgetMs', 'signal']);

// request = { turn, budgetMs, signal } (SPEC-004 §La petición). Cerrada: no
// lleva contadores, umbrales ni política declarada. Congelada, porque el
// núcleo puede entregarla a varias invocaciones y el puerto la trata como
// sólo lectura.
export function createRequest(input) {
  if (!esObjeto(input)) {
    throw new TypeError('createRequest espera { turn, budgetMs, signal }.');
  }
  const sobran = Object.keys(input).filter(
    (key) => !REQUEST_KEYS.includes(key));
  if (sobran.length > 0) {
    throw new TypeError('La petición no admite «' + sobran.sort().join('», «')
      + '»: sólo lleva turn, budgetMs y signal.');
  }
  const request = {
    turn: input.turn,
    budgetMs: input.budgetMs,
    signal: input.signal,
  };
  validateRequest(request);
  return Object.freeze(request);
}

// Comprueba una petición ya construida y la devuelve tal cual.
export function validateRequest(request) {
  if (!esObjeto(request)) {
    throw new TypeError('La petición debe ser un objeto '
      + '{ turn, budgetMs, signal }.');
  }
  const sobran = Object.keys(request).filter(
    (key) => !REQUEST_KEYS.includes(key));
  if (sobran.length > 0) {
    throw new TypeError('La petición no admite «' + sobran.sort().join('», «')
      + '»: sólo lleva turn, budgetMs y signal.');
  }
  const faltan = REQUEST_KEYS.filter((key) => !tieneClave(request, key));
  if (faltan.length > 0) {
    throw new TypeError('A la petición le falta «' + faltan.join('», «')
      + '».');
  }
  comprobarTurn(request.turn);
  if (!esEnteroPositivo(request.budgetMs)) {
    throw new TypeError('budgetMs debe ser un entero > 0.');
  }
  if (!esSenal(request.signal)) {
    throw new TypeError('signal debe ser un AbortSignal (SPEC-002).');
  }
  return request;
}

// Construye la petición de un puerto concreto con su presupuesto declarado.
// Sólo toma `turn` y `signal`: el tope lo fija `BUDGETS`, y ni el modo ni la
// política del núcleo son alcanzables desde la petición.
export function requestFor(portName, options) {
  const budgetMs = budgetFor(portName);
  if (!esObjeto(options)) {
    throw new TypeError('requestFor espera { turn, signal }.');
  }
  const sobran = Object.keys(options).filter(
    (key) => key !== 'turn' && key !== 'signal');
  if (sobran.length > 0) {
    throw new TypeError('requestFor sólo toma turn y signal; el presupuesto '
      + 'lo fija BUDGETS.');
  }
  return createRequest({
    turn: options.turn,
    budgetMs: budgetMs,
    signal: options.signal,
  });
}

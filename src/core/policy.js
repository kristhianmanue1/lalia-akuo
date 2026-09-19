// Política declarada y compuerta (SPEC-006; cubre REQ-10 y REQ-11).
//
// La frontera, en una línea: el consumidor declara, el núcleo aplica. Aquí
// vive (1) el punto donde se declara la política, (2) su validación en la
// frontera y (3) la compuerta que se aplica antes de hablar. El núcleo no
// decide el contenido: qué se filtra, qué clases se bloquean, qué claves son
// intocables y qué sustituye a lo bloqueado lo aporta el consumidor.
//
// Es un módulo hoja: no importa nada del núcleo. Aplicarlo es local y
// determinista — no abre red, no escribe almacenamiento y no registra.
//
// Fail-closed: lo que no se declara no se habla. `filter` y `data` son
// puntos de declaración; esta primera versión no evalúa su contenido.

// Vocabulario del núcleo, no política del consumidor: `blockedClasses` sólo
// admite miembros de este enumerado cerrado. Una clase fuera de él es
// `invalid_config` en la creación, nunca una compuerta inerte en silencio.
export const TEXT_CLASSES = Object.freeze(['form', 'conversational']);

// Los siete miembros declarables de `config.policy` (SPEC-001). Un miembro
// fuera de esta lista es `invalid_config`: la política es un objeto cerrado.
export const POLICY_MEMBERS = Object.freeze([
  'degradation',
  'confirmation',
  'blockedClasses',
  'safeTextKey',
  'immutableTextKeys',
  'filter',
  'data',
]);

// Los dos contadores de SPEC-001. Ausentes valen 1: el paso degrada al
// primer intento o fallo no resuelto. Es el único defecto que la política
// admite y lo fija la propia spec; ninguna otra ausencia se rellena.
export const POLICY_DEFAULTS = Object.freeze({
  maxAttempts: 1,
  maxConsecutiveFailures: 1,
});

// Error de frontera de la política. `code` pertenece al enumerado cerrado de
// SPEC-001: `invalid_config` (la declaración está y está mal) o
// `missing_policy` (falta la declaración exigida y no hay sesión).
export class ConfigError extends Error {
  constructor(code, path, detail) {
    super('Política rechazada en «' + path + '»: ' + detail + '.');
    this.name = 'ConfigError';
    this.code = code;
    this.path = path;
  }
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDeclared(value) {
  return value !== undefined && value !== null;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value >= 1;
}

function invalid(path, detail) {
  return new ConfigError('invalid_config', path, detail);
}

function missing(path, detail) {
  return new ConfigError('missing_policy', path, detail);
}

function unknownMembers(value, allowed, path) {
  for (const name of Object.keys(value)) {
    if (!allowed.includes(name)) {
      throw invalid(path + '.' + name, 'clave desconocida «' + name + '»');
    }
  }
}

// `degradation` es la declaración exigida: sin ella el núcleo no sabe cómo
// se ve el fallo y no puede crear la sesión (SPEC-006 §«Qué pasa si no se
// declara nada»).
function validateDegradation(value) {
  if (!isDeclared(value)) {
    throw missing('policy.degradation',
      'falta la declaración exigida: sin saber cómo se ve la degradación ' +
      'no hay sesión');
  }
  if (!isPlainObject(value)) {
    throw invalid('policy.degradation', 'debe ser un objeto');
  }
  unknownMembers(value, ['noticeKey', 'maxConsecutiveFailures'],
    'policy.degradation');
  if (typeof value.noticeKey !== 'string' || value.noticeKey === '') {
    throw invalid('policy.degradation.noticeKey',
      'debe ser una clave de catálogo, texto no vacío');
  }
  const failures = value.maxConsecutiveFailures;
  if (isDeclared(failures) && !isPositiveInteger(failures)) {
    throw invalid('policy.degradation.maxConsecutiveFailures',
      'debe ser un entero positivo finito; ausente vale ' +
      POLICY_DEFAULTS.maxConsecutiveFailures + ' (fail-closed)');
  }
  return {
    noticeKey: value.noticeKey,
    maxConsecutiveFailures: isDeclared(failures)
      ? failures
      : POLICY_DEFAULTS.maxConsecutiveFailures,
  };
}

function validateConfirmation(value) {
  if (!isDeclared(value)) {
    return { maxAttempts: POLICY_DEFAULTS.maxAttempts };
  }
  if (!isPlainObject(value)) {
    throw invalid('policy.confirmation', 'debe ser un objeto');
  }
  unknownMembers(value, ['maxAttempts'], 'policy.confirmation');
  const attempts = value.maxAttempts;
  if (isDeclared(attempts) && !isPositiveInteger(attempts)) {
    throw invalid('policy.confirmation.maxAttempts',
      'debe ser un entero positivo finito; ausente vale ' +
      POLICY_DEFAULTS.maxAttempts + ' (fail-closed)');
  }
  return {
    maxAttempts: isDeclared(attempts)
      ? attempts
      : POLICY_DEFAULTS.maxAttempts,
  };
}

function validateBlockedClasses(value) {
  if (!isDeclared(value)) {
    return null;
  }
  if (!Array.isArray(value)) {
    throw invalid('policy.blockedClasses', 'debe ser una lista de clases');
  }
  value.forEach(function (member, index) {
    if (!TEXT_CLASSES.includes(member)) {
      throw invalid('policy.blockedClasses[' + index + ']',
        'clase «' + String(member) + '» fuera del vocabulario del núcleo ' +
        '(«' + TEXT_CLASSES.join('», «') + '»)');
    }
  });
  return value.slice();
}

function validateSafeTextKey(value) {
  if (!isDeclared(value)) {
    return null;
  }
  if (typeof value !== 'string' || value === '') {
    throw invalid('policy.safeTextKey',
      'debe ser una clave de catálogo, texto no vacío');
  }
  return value;
}

function validateImmutableTextKeys(value) {
  if (!isDeclared(value)) {
    return null;
  }
  if (!Array.isArray(value)) {
    throw invalid('policy.immutableTextKeys',
      'debe ser una lista de claves');
  }
  value.forEach(function (key, index) {
    if (typeof key !== 'string' || key === '') {
      throw invalid('policy.immutableTextKeys[' + index + ']',
        'cada clave debe ser texto no vacío');
    }
  });
  return value.slice();
}

// `filter` y `data` son puntos, no contenido: su forma interna la fija el
// consumidor y el núcleo no la inspecciona, no la copia y no la evalúa.
function validateDeclarationPoint(name, value) {
  if (!isDeclared(value)) {
    return null;
  }
  if (!isPlainObject(value)) {
    throw invalid('policy.' + name, 'debe ser un objeto');
  }
  return value;
}

// Valida `config.policy` en la frontera, una sola vez, y devuelve la
// política normalizada y congelada. La validación es fail-closed: un
// miembro desconocido o mal formado es `invalid_config`; la ausencia de la
// declaración exigida es `missing_policy`, que impide crear la sesión.
export function validatePolicy(policy) {
  if (!isPlainObject(policy)) {
    throw missing('policy', 'falta la declaración de política');
  }
  unknownMembers(policy, POLICY_MEMBERS, 'policy');
  const degradation = validateDegradation(policy.degradation);
  const confirmation = validateConfirmation(policy.confirmation);
  const blockedClasses = validateBlockedClasses(policy.blockedClasses);
  const safeTextKey = validateSafeTextKey(policy.safeTextKey);
  const immutableTextKeys = validateImmutableTextKeys(
    policy.immutableTextKeys);
  const filter = validateDeclarationPoint('filter', policy.filter);
  const data = validateDeclarationPoint('data', policy.data);
  return Object.freeze({
    degradation: Object.freeze(degradation),
    confirmation: Object.freeze(confirmation),
    blockedClasses: blockedClasses === null
      ? null
      : Object.freeze(blockedClasses),
    safeTextKey,
    immutableTextKeys: immutableTextKeys === null
      ? null
      : Object.freeze(immutableTextKeys),
    filter,
    data,
  });
}

// Clase de texto derivada del origen. `form` es el camino de formulario:
// texto del catálogo por clave directa. Todo lo demás —texto libre y, sobre
// todo, el que devuelve un puerto de sustitución para una clave del
// formulario— cuenta como `conversational` y pasa por la compuerta.
export function classifyText(origin) {
  return origin === 'catalog' ? 'form' : 'conversational';
}

function immutableKey(policy, key) {
  return isPlainObject(policy)
    && Array.isArray(policy.immutableTextKeys)
    && policy.immutableTextKeys.includes(key);
}

// Resuelve el texto que un puerto de sustitución devuelve para una clave.
// Una clave de `immutableTextKeys` se resuelve siempre del catálogo por
// clave directa: si el puerto devuelve otro texto, el reemplazo se rechaza
// con `port_failure` y nada del texto sustituido llega a hablarse. El turno
// lo descarta y lo rehace en determinista quien conduce (SPEC-001).
export function guardSubstitution(policy, substitution) {
  const input = isPlainObject(substitution) ? substitution : {};
  const key = input.key;
  const substituted = input.substitutedText;
  if (typeof key !== 'string' || key === ''
      || typeof substituted !== 'string') {
    return Object.freeze({
      accepted: false,
      text: null,
      textClass: null,
      code: 'port_failure',
    });
  }
  if (immutableKey(policy, key) && substituted !== input.catalogText) {
    return Object.freeze({
      accepted: false,
      text: null,
      textClass: null,
      code: 'port_failure',
    });
  }
  return Object.freeze({
    accepted: true,
    text: substituted,
    textClass: classifyText('port'),
    code: null,
  });
}

function silent(code, textClass) {
  return Object.freeze({
    speak: false,
    displayText: null,
    speechText: null,
    textClass: typeof textClass === 'string' ? textClass : null,
    code,
    safe: false,
  });
}

function speaks(text, textClass, safe) {
  return Object.freeze({
    speak: true,
    displayText: text,
    speechText: text,
    textClass,
    code: null,
    safe,
  });
}

function usableCatalog(catalog) {
  return isPlainObject(catalog)
    && typeof catalog.has === 'function'
    && typeof catalog.text === 'function';
}

// El texto seguro sale del catálogo por clave. Si la clave no está, no se
// improvisa texto: `missing_text` y salida declarada del paso.
function safeText(policy, catalog, textClass) {
  if (typeof policy.safeTextKey !== 'string' || policy.safeTextKey === '') {
    return silent('missing_policy', textClass);
  }
  if (!usableCatalog(catalog) || !catalog.has(policy.safeTextKey)) {
    return silent('missing_text', textClass);
  }
  let text;
  try {
    text = catalog.text(policy.safeTextKey);
  } catch (error) {
    return silent('missing_text', textClass);
  }
  if (typeof text !== 'string' || text === '') {
    return silent('missing_text', textClass);
  }
  return speaks(text, textClass, true);
}

function gatePolicy(policy) {
  if (!isPlainObject(policy) || !isPlainObject(policy.degradation)
      || typeof policy.degradation.noticeKey !== 'string'
      || policy.degradation.noticeKey === '') {
    throw missing('policy.degradation',
      'la compuerta exige una política declarada y validada');
  }
}

// La compuerta, antes de hablar. Decide qué se habla y qué se muestra: el
// texto resuelto es el mismo que llevan `displayText` y `speechText`, así
// que un candidato bloqueado no aparece en ninguno de los dos. Cuando la
// compuerta cierra sin texto seguro, devuelve `speak: false` y la salida
// declarada la pone el paso.
//
// El texto seguro se emite sólo tras una compuerta cerrada y no se vuelve a
// someter a la compuerta: no hay recursión.
export function resolveSpeech(policy, catalog, candidate) {
  gatePolicy(policy);
  const input = isPlainObject(candidate) ? candidate : {};
  const textClass = input.textClass;
  if (!TEXT_CLASSES.includes(textClass)) {
    return silent('port_failure', textClass);
  }
  if (typeof input.text !== 'string' || input.text === '') {
    return silent('port_failure', textClass);
  }
  if (Array.isArray(policy.blockedClasses)
      && policy.blockedClasses.includes(textClass)) {
    return safeText(policy, catalog, textClass);
  }
  if (textClass === 'conversational' && !isPlainObject(policy.filter)) {
    return silent('missing_policy', textClass);
  }
  return speaks(input.text, textClass, false);
}

// La compuerta aplicada de verdad: decide y, sólo si hay texto, invoca al
// `speaker` con el texto resuelto. El texto seguro no se vuelve a someter a
// la compuerta; se habla tal cual. `sayResult` es lo que devuelve el puerto
// —su promesa la espera quien conduce el turno (SPEC-003)—.
export function sayThroughPolicy(options) {
  const input = isPlainObject(options) ? options : {};
  const decision = resolveSpeech(input.policy, input.catalog,
    input.candidate);
  if (!decision.speak) {
    return Object.freeze({ ...decision, sayResult: null });
  }
  const speaker = input.speaker;
  if (!isPlainObject(speaker) || typeof speaker.say !== 'function') {
    return Object.freeze({
      ...silent('port_failure', decision.textClass),
      sayResult: null,
    });
  }
  const sayResult = speaker.say(decision.speechText, input.request);
  return Object.freeze({ ...decision, sayResult });
}

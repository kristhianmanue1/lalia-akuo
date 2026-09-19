// Sesión del núcleo (SPEC-001, SPEC-005, SPEC-008).
//
// Conduce un turno —preguntar, escuchar, interpretar, confirmar— sin DOM, sin
// red, sin almacenamiento y sin registrar. Ninguna invocación de puerto escribe
// en `values`: el valor sólo entra con confirmación explícita. Todo texto sale
// por el catálogo y la compuerta; ningún turno se cierra por temporizador.

import {
  PORT_RETRY_LIMIT, SPEECH_BUDGET_MS, TURN_BUDGET_MS, budgetFor,
  validateControlCategory, validateInterpretation, validateListeningResult,
  validatePorts, validateSpeechResult,
} from './ports.js';
import { createTurnDiscipline, createTurnSequence } from './turn.js';
import {
  ConfigError, resolveSpeech, sayThroughPolicy, validatePolicy,
} from './policy.js';
import { createCatalog } from '../i18n/catalog.js';

export const PHASES = Object.freeze([
  'idle', 'asking', 'capturing', 'interpreting', 'confirming', 'closing',
  'degrading', 'failed',
]);

const PHASE_STATE = Object.freeze({
  idle: 'idle', asking: 'speaking', capturing: 'listening',
  interpreting: 'thinking', confirming: 'speaking', closing: 'speaking',
  degrading: 'speaking', failed: 'error',
});

export const CAPABILITIES = Object.freeze({
  opensNetwork: false, persists: false, writesStorage: false, writesLogs: false,
  touchesDom: false, requiresExplicitConfirmation: true,
  closesTurnsBy: 'real_signal',
});

const CONFIG_KEYS = ['fields', 'language', 'policy', 'mode', 'ports', 'onEvent',
  'getPreviousValue'];
const RUNTIME_KEYS = ['schedule', 'cancelSchedule'];
const FIELD_KEYS = ['id', 'type', 'range', 'unit', 'promptKey', 'deltaPolicy'];
const FIELD_TYPES = ['number', 'integer', 'boolean', 'text'];
const DELTA_MODES = ['none', 'reconfirm'];
const MODES = ['deterministic', 'assisted'];
const MANUAL_REASONS = ['no_speech', 'recognition_failed', 'speech_failed',
  'speech_watchdog', 'port_failure', 'port_budget_exhausted'];

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.length > 0;
const bad = (path, detail) => new ConfigError('invalid_config', path, detail);
const defaultSchedule = (fn, ms) => setTimeout(fn, ms);
const defaultCancelSchedule = (handle) => clearTimeout(handle);

// Identidad de sesión sin reloj ni azar; no comparte estado de sesión.
let nextSessionId = 0;
const NOOP = Symbol('noop');

class PortSignal {
  constructor(kind, port, turnId) {
    this.kind = kind; this.port = port; this.turnId = turnId;
  }
}

function validateField(value, index) {
  const at = 'fields[' + index + ']';
  if (!isObject(value)) throw bad(at, 'debe ser un objeto');
  for (const key of Object.keys(value)) {
    if (!FIELD_KEYS.includes(key)) throw bad(at + '.' + key, 'clave desconocida');
  }
  if (!isText(value.id)) throw bad(at + '.id', 'debe ser texto no vacío');
  if (!FIELD_TYPES.includes(value.type)) throw bad(at + '.type', 'tipo fuera del enumerado');
  if (!isText(value.promptKey)) throw bad(at + '.promptKey', 'debe ser una clave, texto no vacío');
  if (value.unit !== undefined && !isText(value.unit)) throw bad(at + '.unit', 'debe ser texto no vacío');
  if (value.range !== undefined) {
    const r = value.range;
    if (value.type !== 'number' && value.type !== 'integer') throw bad(at + '.range', 'sólo aplica a campos numéricos');
    if (!isObject(r) || !Number.isFinite(r.min) || !Number.isFinite(r.max) || r.min > r.max) {
      throw bad(at + '.range', 'exige min y max numéricos con min <= max');
    }
  }
  if (value.deltaPolicy !== undefined) {
    const d = value.deltaPolicy;
    if (!isObject(d)) throw bad(at + '.deltaPolicy', 'debe ser un objeto');
    for (const key of Object.keys(d)) {
      if (key !== 'maxDifference' && key !== 'onExceeded') throw bad(at + '.deltaPolicy.' + key, 'clave desconocida');
    }
    if (!Number.isFinite(d.maxDifference) || d.maxDifference < 0) throw bad(at + '.deltaPolicy.maxDifference', 'debe ser un número no negativo');
    if (!DELTA_MODES.includes(d.onExceeded)) throw bad(at + '.deltaPolicy.onExceeded', 'fuera del enumerado cerrado');
  }
  return Object.freeze({
    id: value.id, type: value.type, promptKey: value.promptKey,
    unit: value.unit === undefined ? null : value.unit,
    range: value.range === undefined ? null : { min: value.range.min, max: value.range.max },
    deltaPolicy: value.deltaPolicy === undefined ? null
      : { maxDifference: value.deltaPolicy.maxDifference, onExceeded: value.deltaPolicy.onExceeded },
  });
}

function validateFields(fields) {
  if (!Array.isArray(fields) || fields.length === 0) throw bad('fields', 'exige una lista no vacía de campos');
  const seen = new Set();
  return Object.freeze(fields.map((field, index) => {
    const clean = validateField(field, index);
    if (seen.has(clean.id)) throw bad('fields[' + index + '].id', 'identificador duplicado');
    seen.add(clean.id);
    return clean;
  }));
}

function buildCatalog(language) {
  if (!isObject(language) || !isObject(language.pack)) throw bad('language', 'exige un paquete en «pack»');
  try {
    const fallback = language.fallback === undefined ? {} : { fallback: createCatalog(language.fallback) };
    return createCatalog(language.pack, fallback);
  } catch (error) {
    throw bad('language', 'el paquete no satisface su contrato');
  }
}

// La clave del aviso de degradación es la salida visible obligatoria; el
// núcleo la exige completa y dentro del presupuesto en la creación, para
// que ningún evento de fallo salga jamás sin texto (SPEC-001).
function validateNotice(catalog, policy) {
  const key = policy.degradation.noticeKey;
  if (!catalog.has(key)) throw bad('policy.degradation.noticeKey', 'la clave no está en el catálogo');
  let text;
  try { text = catalog.text(key, {}); } catch (error) {
    throw bad('policy.degradation.noticeKey', 'la clave no resuelve un texto');
  }
  if (!catalog.measure(text).within) {
    throw bad('policy.degradation.noticeKey', 'el texto excede el presupuesto de lectura');
  }
}

// Puertos deterministas por omisión: declaran la ausencia de su capacidad con
// un resultado de su enumerado, nunca con un éxito simulado.
function defaultPorts(catalog) {
  return {
    speaker: { say: () => Promise.resolve('error'), cancel() {} },
    listener: { listen: () => Promise.resolve({ type: 'recognition_failed' }), cancel() {} },
    fieldInterpreter: { interpret: () => Promise.resolve({ code: 'unparseable' }), cancel() {} },
    controlInterpreter: { interpret: () => Promise.resolve('unclassified'), cancel() {} },
    phrases: {
      text(key, context) {
        if (!catalog.has(key)) return Promise.reject(Object.assign(new Error('clave ausente'), { code: 'missing_text' }));
        const text = catalog.text(key, isObject(context) ? context : {});
        return catalog.measure(text).within ? Promise.resolve(text)
          : Promise.reject(Object.assign(new Error('fuera de presupuesto'), { code: 'over_budget' }));
      },
      cancel() {},
    },
    proposer: { propose: () => Promise.resolve('manual'), cancel() {} },
  };
}

export function createVoiceSession(config, runtime = {}) {
  if (!isObject(config)) throw bad('config', 'createVoiceSession espera un objeto');
  for (const key of Object.keys(config)) {
    if (!CONFIG_KEYS.includes(key)) throw bad(key, 'clave desconocida en la raíz de config');
  }
  if (!isObject(runtime)) throw bad('runtime', 'debe ser un objeto');
  for (const key of Object.keys(runtime)) {
    if (!RUNTIME_KEYS.includes(key)) throw bad('runtime.' + key, 'clave desconocida en runtime');
  }
  if ((runtime.schedule === undefined) !== (runtime.cancelSchedule === undefined)) {
    throw bad('runtime', 'exige schedule y cancelSchedule en pareja');
  }
  if (runtime.schedule !== undefined && typeof runtime.schedule !== 'function') {
    throw bad('runtime.schedule', 'debe ser una función');
  }
  if (runtime.cancelSchedule !== undefined && typeof runtime.cancelSchedule !== 'function') {
    throw bad('runtime.cancelSchedule', 'debe ser una función');
  }
  const fields = validateFields(config.fields);
  const catalog = buildCatalog(config.language);
  let policy;
  try { policy = validatePolicy(config.policy); } catch (error) {
    throw error instanceof ConfigError ? error : bad('policy', 'la declaración no satisface su contrato');
  }
  validateNotice(catalog, policy);
  const mode = config.mode === undefined ? 'deterministic' : config.mode;
  if (!MODES.includes(mode)) throw bad('mode', 'fuera del enumerado cerrado');
  let injected;
  try { injected = validatePorts(config.ports); } catch (error) {
    throw bad('ports', 'algún puerto no satisface su contrato');
  }
  if (config.onEvent !== undefined && typeof config.onEvent !== 'function') throw bad('onEvent', 'debe ser una función');
  if (config.getPreviousValue !== undefined && typeof config.getPreviousValue !== 'function') {
    throw bad('getPreviousValue', 'debe ser una función');
  }
  const onEvent = config.onEvent === undefined ? null : config.onEvent;
  const getPreviousValue = config.getPreviousValue === undefined ? null : config.getPreviousValue;
  const ports = Object.freeze({ ...defaultPorts(catalog), ...(isObject(injected) ? injected : {}) });
  // Copia mutable de puertos en vivo: el redo de un fallo o de un presupuesto
  // sustituye el puerto tocado por su determinista (SPEC-005) y la sesión
  // sigue con el resto tal cual se inyectaron.
  const deterministicPorts = defaultPorts(catalog);
  const livePorts = { ...ports };
  const P = (name) => livePorts[name];
  const schedule = runtime.schedule === undefined ? defaultSchedule : runtime.schedule;
  const cancelSchedule = runtime.cancelSchedule === undefined
    ? defaultCancelSchedule : runtime.cancelSchedule;

  const sessionId = 'lalia-akuo:' + (nextSessionId += 1);
  const values = Object.create(null);
  let state = 'idle';
  let phase = 'idle';
  let disposed = false;
  let micMuted = false;
  let speechMuted = false;
  let manualMode = false;
  let fieldIndex = 0;
  let attempts = 0;
  let failures = 0;
  let retries = 0;
  let pending = null; // confirmación en curso
  let lastPort = null;
  let turnId = null;
  let generation = 0;
  let inFlight = null;

  const discipline = createTurnDiscipline({
    sequence: createTurnSequence({ sessionId }),
    schedule, cancelSchedule,
    onBudgetExhausted({ turn }) {
      if (inFlight !== null && inFlight.turnId === turn.id) {
        const port = lastPort === null ? null : livePorts[lastPort];
        if (port !== null && typeof port.cancel === 'function') {
          try { port.cancel(); } catch (error) {
            // El presupuesto ya liquidó el turno: un cancel() que lanza no
            // reabre nada; la salida declarada sigue su curso.
          }
        }
        settleInFlight({ budget: true });
      }
    },
  });

  function settleInFlight(outcome) {
    const settle = inFlight.settle;
    inFlight = null;
    settle(outcome);
  }

  function emit(event) {
    if (onEvent === null) return;
    try { onEvent(event); } catch (error) { /* un observador que lanza no tumba el turno */ }
  }

  function envelope(type, id, port, extra) {
    return { type, sessionId, mode, port: port === undefined ? null : port,
      turn: id === undefined || id === null ? null : id, ...extra };
  }

  function go(nextState, nextPhase, id) {
    state = nextState;
    phase = nextPhase;
    emit(envelope('state_changed', id, null, { state: nextState, phase: nextPhase }));
  }

  function notice() {
    try {
      const text = catalog.text(policy.degradation.noticeKey);
      return catalog.measure(text).within ? text : null;
    } catch (error) { return null; }
  }

  function manualReason(code) {
    return MANUAL_REASONS.includes(code) ? code : 'recognition_failed';
  }

  function emitFailure(code, context = {}) {
    const text = notice();
    emit(envelope('failure', context.turnId, context.port, {
      code, state, fallback: context.fallback === undefined ? null : context.fallback,
      displayText: text, speechText: speechMuted ? null : text,
    }));
  }

  function emitManual(reason, fieldId, id, port) {
    const text = notice();
    emit(envelope('manual_input_required', id, port, {
      reason, fieldId: fieldId === undefined ? null : fieldId,
      displayText: text, speechText: speechMuted ? null : text,
    }));
  }

  function emitText(key, fieldId, displayText, speechText, id, port) {
    emit(envelope('text_output', id, port, {
      key: key === undefined ? null : key, fieldId: fieldId === undefined ? null : fieldId,
      displayText, speechText: speechMuted ? null : speechText,
    }));
  }

  function openTurn(expected) {
    const turn = discipline.open(expected);
    turnId = turn.id;
    return turn;
  }

  function closeOpenTurn() {
    const turn = discipline.openTurn;
    if (turn !== null) discipline.resolve(turn);
  }

  function accept(turn, terminal = true) {
    const decision = discipline.decide(turn, state, terminal ? { terminal: true } : {});
    if (!decision.accepted) throw NOOP;
  }

  function awaitSettled(promise, turn) {
    return new Promise((resolve) => {
      let done = false;
      const settle = (outcome) => {
        if (done) return;
        done = true;
        if (inFlight !== null && inFlight.turnId === turn.id) inFlight = null;
        resolve(outcome);
      };
      inFlight = { turnId: turn.id, settle };
      Promise.resolve(promise).then(
        (value) => settle({ ok: true, value }), (error) => settle({ error }));
    });
  }

  function invoke(portName, turn, fn) {
    lastPort = portName;
    const request = discipline.request(turn, budgetFor(portName));
    let produced;
    try { produced = fn(request); } catch (error) { return Promise.resolve({ error }); }
    return awaitSettled(produced, turn);
  }

  async function callPort(portName, turn, fn) {
    const outcome = await invoke(portName, turn, fn);
    if (outcome.cancelled) throw NOOP;
    if (outcome.budget) throw new PortSignal('budget', portName, turn.id);
    if (!outcome.ok) throw new PortSignal('failure', portName, turn.id);
    return outcome.value;
  }

  function callbacks(turn) {
    const settleWith = (result) => {
      if (inFlight !== null && inFlight.turnId === turn.id) settleInFlight({ ok: true, value: result });
    };
    return { onPartial() {}, onNoSpeech: () => settleWith({ type: 'no_speech' }),
      onError: () => settleWith({ type: 'recognition_failed' }) };
  }

  function resolveText(key, slots) {
    try {
      const text = catalog.text(key, slots);
      return catalog.measure(text).within ? { ok: true, text } : { ok: false, code: 'over_budget' };
    } catch (error) {
      return { ok: false, code: 'missing_text' };
    }
  }

  function gate(text) {
    return resolveSpeech(policy, catalog, { text, textClass: 'form' });
  }

  function slots(field, value) {
    return { fieldId: field.id, value: String(value), unit: field.unit === null ? '' : field.unit };
  }

  async function speakText(text, turn) {
    lastPort = 'speaker';
    const request = discipline.request(turn, SPEECH_BUDGET_MS);
    let decision;
    try {
      decision = sayThroughPolicy({ policy, catalog, candidate: { text, textClass: 'form' },
        speaker: P('speaker'), request });
    } catch (error) { return { ok: false, code: 'port_failure', signal: true }; }
    if (!decision.speak) return { ok: false, code: decision.code === null ? 'missing_policy' : decision.code };
    const outcome = await awaitSettled(decision.sayResult, turn);
    if (outcome.cancelled) throw NOOP;
    if (outcome.budget) throw new PortSignal('budget', 'speaker', turn.id);
    if (!outcome.ok) return { ok: false, code: 'port_failure', signal: true };
    try { validateSpeechResult(outcome.value); } catch (error) {
      return { ok: false, code: 'port_failure', signal: true };
    }
    if (outcome.value === 'done') { accept(turn, true); return { ok: true }; }
    return { ok: false, code: outcome.value === 'error' ? 'speech_failed' : 'speech_watchdog' };
  }

  async function speakOrFail(field, key, text, id, turn) {
    const spoken = await speakText(text, turn);
    if (spoken.ok) return null;
    if (spoken.signal) throw new PortSignal('failure', 'speaker', turn.id);
    discipline.resolve(turn);
    return await failStep(spoken.code, { field, port: 'speaker', turnId: id, kind: 'failure' });
  }

  function mustDegrade() {
    return attempts >= policy.confirmation.maxAttempts
      || failures >= policy.degradation.maxConsecutiveFailures;
  }

  async function degradeStep(reason, context) {
    pending = null;
    manualMode = true;
    closeOpenTurn();
    const fieldId = context.field ? context.field.id : null;
    if (speechMuted) {
      emitManual(reason, fieldId, context.turnId, context.port);
      go('idle', 'idle', context.turnId);
      return 'degraded';
    }
    const turn = openTurn('speaking');
    go('speaking', 'degrading', turn.id);
    emitManual(reason, fieldId, turn.id, context.port);
    const text = notice();
    try {
      if (text === null) discipline.resolve(turn);
      else await speakText(text, turn);
    } finally {
      go('idle', 'idle', turn.id);
    }
    return 'degraded';
  }

  async function failStep(code, context) {
    emitFailure(code, { turnId: context.turnId, port: context.port });
    if (context.kind === 'unresolved') { attempts += 1; failures += 1; } else failures += 1;
    if (manualMode) { closeOpenTurn(); go('idle', 'idle', context.turnId); return 'rest'; }
    return mustDegrade() ? await degradeStep(manualReason(code), context) : 'asking';
  }

  function enterError(code, field, context = {}) {
    closeOpenTurn();
    go('error', 'failed', turnId);
    emitFailure(code, { turnId, port: context.port ?? null, fallback: context.fallback });
    manualMode = true;
    emitManual(manualReason(code), field ? field.id : null, turnId, context.port ?? null);
    go('idle', 'idle', turnId);
    return 'degraded';
  }

  function checkValue(field, interpretation) {
    if (field.range !== null && typeof interpretation.value === 'number'
        && (interpretation.value < field.range.min || interpretation.value > field.range.max)) return false;
    if (interpretation.unit !== undefined && interpretation.unit !== null
        && field.unit !== null && interpretation.unit !== field.unit) return false;
    return true;
  }

  function needsReconfirm(field, value) {
    if (field.deltaPolicy === null || field.deltaPolicy.onExceeded !== 'reconfirm'
        || getPreviousValue === null || typeof value !== 'number') return false;
    let previous;
    try { previous = getPreviousValue(field.id); } catch (error) { return false; }
    if (typeof previous !== 'number' || !Number.isFinite(previous)) return false;
    return Math.abs(value - previous) > field.deltaPolicy.maxDifference;
  }

  async function handleInterpretation(field, interpretation, id) {
    if (interpretation.code !== 'ok' || !checkValue(field, interpretation)) {
      return await failStep('unresolved_value', { field, port: 'fieldInterpreter', turnId: id, kind: 'unresolved' });
    }
    pending = { value: interpretation.value, unit: field.unit, spokenValue: null,
      reconfirmPending: needsReconfirm(field, interpretation.value) };
    return 'confirm';
  }

  async function stageAsk(field) {
    const resolved = resolveText(field.promptKey, { fieldId: field.id });
    if (!resolved.ok) return await failStep(resolved.code, { field, port: null, turnId: null, kind: 'failure' });
    const gated = gate(resolved.text);
    if (!gated.speak) return await failStep(gated.code ?? 'missing_policy', { field, port: null, turnId: null, kind: 'failure' });
    if (speechMuted) {
      emitText(field.promptKey, field.id, gated.displayText, null, null, null);
      if (micMuted) return await failStep('recognition_failed', { field, port: 'listener', turnId: null, kind: 'failure' });
      go('listening', 'capturing');
      return 'capture';
    }
    const turn = openTurn('speaking');
    go('speaking', 'asking', turn.id);
    emitText(field.promptKey, field.id, gated.displayText, gated.speechText, turn.id, null);
    const failed = await speakOrFail(field, field.promptKey, gated.displayText, turn.id, turn);
    if (failed !== null) return failed;
    if (micMuted) return await failStep('recognition_failed', { field, port: 'listener', turnId: turn.id, kind: 'failure' });
    go('listening', 'capturing', turn.id);
    return 'capture';
  }

  async function stageCaptureValue(field) {
    if (manualMode) return 'rest';
    if (micMuted) return await failStep('recognition_failed', { field, port: 'listener', turnId: null, kind: 'failure' });
    const turn = openTurn('listening');
    const result = await callPort('listener', turn, (request) => P('listener').listen(request, callbacks(turn)));
    try { validateListeningResult(result); } catch (error) { throw new PortSignal('failure', 'listener', turn.id); }
    if (result.type === 'speech') {
      accept(turn, true);
      go('thinking', 'interpreting', turn.id);
      const next = openTurn('thinking');
      const interpretation = await callPort('fieldInterpreter', next, (request) => P('fieldInterpreter').interpret(result.text, field, request));
      try { validateInterpretation(interpretation, { field }); } catch (error) { throw new PortSignal('failure', 'fieldInterpreter', next.id); }
      accept(next, true);
      return await handleInterpretation(field, interpretation, next.id);
    }
    accept(turn, true);
    if (result.type === 'no_speech') return await failStep('no_speech', { field, port: 'listener', turnId: turn.id, kind: 'unresolved' });
    return await failStep('recognition_failed', { field, port: 'listener', turnId: turn.id, kind: 'failure' });
  }

  async function applyControl(field, category, id) {
    const context = { field, port: 'controlInterpreter', turnId: id };
    if (category === 'affirmation') {
      failures = 0;
      if (pending !== null && pending.reconfirmPending) { pending.reconfirmPending = false; return 'confirm'; }
      return 'closing';
    }
    if (category === 'repetition') { failures = 0; return 'confirm'; }
    if (category === 'negation') {
      pending = null;
      attempts += 1; failures += 1;
      return mustDegrade() ? await degradeStep('recognition_failed', context) : 'asking';
    }
    if (category === 'manual') return await degradeStep('no_speech', context);
    return await failStep('unclassified_control', { ...context, kind: 'unresolved' });
  }

  async function stageControl(field) {
    if (manualMode) return 'rest';
    if (micMuted) return await failStep('recognition_failed', { field, port: 'listener', turnId: null, kind: 'failure' });
    const turn = openTurn('listening');
    const result = await callPort('listener', turn, (request) => P('listener').listen(request, callbacks(turn)));
    try { validateListeningResult(result); } catch (error) { throw new PortSignal('failure', 'listener', turn.id); }
    if (result.type === 'speech') {
      const confidence = result.confidence === undefined ? 0 : result.confidence;
      const category = await callPort('controlInterpreter', turn, (request) => P('controlInterpreter').interpret(result.text, confidence, request));
      try { validateControlCategory(category); } catch (error) { throw new PortSignal('failure', 'controlInterpreter', turn.id); }
      accept(turn, true);
      return await applyControl(field, category, turn.id);
    }
    accept(turn, true);
    if (result.type === 'no_speech') return await failStep('no_speech', { field, port: 'listener', turnId: turn.id, kind: 'unresolved' });
    return await failStep('recognition_failed', { field, port: 'listener', turnId: turn.id, kind: 'failure' });
  }

  async function stageConfirm(field) {
    const key = field.promptKey + '.readback';
    const resolved = resolveText(key, slots(field, pending.value));
    if (!resolved.ok) return await failStep(resolved.code, { field, port: null, turnId: null, kind: 'failure' });
    const gated = gate(resolved.text);
    if (!gated.speak) return await failStep(gated.code ?? 'missing_policy', { field, port: null, turnId: null, kind: 'failure' });
    pending.spokenValue = gated.displayText;
    const request = (id, speech) => {
      emit(envelope('confirmation_requested', id, null, {
        fieldId: field.id, value: pending.value, unit: pending.unit,
        spokenValue: gated.displayText, displayText: gated.displayText, speechText: speech,
      }));
    };
    if (speechMuted) {
      request(null, null);
      if (manualMode || micMuted) { go('idle', 'idle'); return 'rest'; }
      go('listening', 'capturing');
      return 'control';
    }
    const turn = openTurn('speaking');
    go('speaking', 'confirming', turn.id);
    request(turn.id, gated.speechText);
    const failed = await speakOrFail(field, key, gated.displayText, turn.id, turn);
    if (failed !== null) return failed;
    if (manualMode || micMuted) { go('idle', 'idle', turn.id); return 'rest'; }
    go('listening', 'capturing', turn.id);
    return 'control';
  }

  async function stageClosing(field) {
    const key = field.promptKey + '.saved';
    const resolved = resolveText(key, slots(field, pending.value));
    if (!resolved.ok) return await failStep(resolved.code, { field, port: null, turnId: null, kind: 'failure' });
    const gated = gate(resolved.text);
    if (!gated.speak) return await failStep(gated.code ?? 'missing_policy', { field, port: null, turnId: null, kind: 'failure' });
    values[field.id] = Object.freeze({ value: pending.value, unit: field.unit });
    emit(envelope('value_confirmed', turnId, null, {
      fieldId: field.id, value: pending.value, unit: field.unit, spokenValue: pending.spokenValue,
    }));
    emitText(key, field.id, gated.displayText, gated.speechText, turnId, null);
    if (speechMuted) { go('idle', 'idle'); pending = null; return 'confirmed'; }
    const turn = openTurn('speaking');
    go('speaking', 'closing', turn.id);
    const failed = await speakOrFail(field, key, gated.displayText, turn.id, turn);
    if (failed !== null) return failed;
    go('idle', 'idle', turn.id);
    pending = null;
    return 'confirmed';
  }

  async function drive(stage, field, gen) {
    let current = stage;
    while (true) {
      if (gen !== generation || disposed) throw NOOP;
      let next;
      if (current === 'asking') next = await stageAsk(field);
      else if (current === 'capture') next = await stageCaptureValue(field);
      else if (current === 'confirm') next = await stageConfirm(field);
      else if (current === 'control') next = await stageControl(field);
      else if (current === 'closing') next = await stageClosing(field);
      else return current;
      if (['asking', 'capture', 'confirm', 'control', 'closing'].includes(next)) { current = next; continue; }
      return next;
    }
  }

  async function guarded(run, field, gen) {
    while (true) {
      try { return await run(); } catch (signal) {
        if (signal === NOOP) return 'rest';
        if (signal instanceof PortSignal) {
          closeOpenTurn();
          const code = signal.kind === 'budget' ? 'port_budget_exhausted' : 'port_failure';
          if (manualMode) return 'rest';
          livePorts[signal.port] = deterministicPorts[signal.port] ?? livePorts[signal.port];
          if (retries < PORT_RETRY_LIMIT) {
            retries += 1;
            emitFailure(code, { turnId: signal.turnId, port: signal.port, fallback: 'deterministic' });
            continue;
          }
          return enterError(code, field, { port: signal.port, fallback: 'deterministic' });
        }
        throw signal;
      }
    }
  }

  async function runFields(gen) {
    while (fieldIndex < fields.length) {
      if (gen !== generation || disposed) return;
      const field = fields[fieldIndex];
      attempts = 0; failures = 0; retries = 0; pending = null;
      if (await guarded(() => drive('asking', field, gen), field, gen) !== 'confirmed') return;
      fieldIndex += 1;
    }
  }

  async function submitFlow(text, gen) {
    const field = fields[fieldIndex];
    if (field === undefined) return 'rest';
    go('thinking', 'interpreting');
    const turn = openTurn('thinking');
    let next;
    if (pending !== null) {
      const category = await callPort('controlInterpreter', turn, (request) => P('controlInterpreter').interpret(text, 1, request));
      try { validateControlCategory(category); } catch (error) { throw new PortSignal('failure', 'controlInterpreter', turn.id); }
      accept(turn, true);
      next = await applyControl(field, category, turn.id);
    } else {
      const interpretation = await callPort('fieldInterpreter', turn, (request) => P('fieldInterpreter').interpret(text, field, request));
      try { validateInterpretation(interpretation, { field }); } catch (error) { throw new PortSignal('failure', 'fieldInterpreter', turn.id); }
      accept(turn, true);
      next = await handleInterpretation(field, interpretation, turn.id);
    }
    if (next === 'rest' || next === 'degraded') return next;
    next = await drive(next, field, gen);
    if (next !== 'confirmed') return next;
    fieldIndex += 1;
    while (fieldIndex < fields.length) {
      if (gen !== generation || disposed) return 'rest';
      const following = fields[fieldIndex];
      attempts = 0; failures = 0; retries = 0; pending = null;
      const result = await guarded(() => drive('asking', following, gen), following, gen);
      if (result !== 'confirmed') return result;
      fieldIndex += 1;
    }
    return 'rest';
  }

  function cancelFlow() {
    generation += 1;
    if (inFlight !== null) settleInFlight({ cancelled: true });
    const turn = discipline.openTurn;
    if (turn !== null) discipline.cancel(turn, lastPort === null ? null : livePorts[lastPort]);
  }

  function snapshot() {
    const copy = {};
    for (const id of Object.keys(values)) copy[id] = values[id];
    return Object.freeze(copy);
  }

  return Object.freeze({
    get state() { return state; },
    get mode() { return mode; },
    get values() { return snapshot(); },

    async start() {
      if (disposed) return;
      cancelFlow();
      const gen = generation;
      try { await runFields(gen); } catch (signal) { if (signal !== NOOP) throw signal; }
    },

    async submitText(text) {
      if (disposed || typeof text !== 'string') return;
      cancelFlow();
      const gen = generation;
      try { await guarded(() => submitFlow(text, gen), fields[fieldIndex], gen); } catch (signal) {
        if (signal !== NOOP) throw signal;
      }
    },

    setMicrophoneMuted(muted) {
      if (disposed) return;
      micMuted = Boolean(muted);
      if (micMuted) {
        cancelFlow();
        if (state !== 'idle' || phase !== 'idle') go('idle', 'idle');
      }
    },

    setSpeechMuted(muted) {
      if (disposed) return;
      speechMuted = Boolean(muted);
    },

    dispose() {
      if (disposed) return;
      cancelFlow();
      disposed = true;
    },
  });
}

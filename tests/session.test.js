// Pruebas de la sesión del núcleo (SPEC-001, SPEC-005, SPEC-008).
//
// Una prueba por caso C-001-*, C-005-* y C-008-*. Se comprueba el efecto
// observable —estado, `values` y eventos— con dobles de los puertos y un reloj
// falso inyectado: ningún `setTimeout` real decide nada.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAPABILITIES, PHASES, createVoiceSession } from '../src/core/session.js';
import { ConfigError } from '../src/core/policy.js';

const SESSION_URL = new URL('../src/core/session.js', import.meta.url);
const SOURCE = readFileSync(SESSION_URL, 'utf8');
const TURN_BUDGET_MS = 30000;
const SPEECH_BUDGET_MS = 20000;

const KEY = 'q.alpha';
const NOTICE = 'aviso.alpha';
const TEXT = {
  [KEY]: 'Pregunta alpha.',
  [`${KEY}.readback`]: 'Confirmas {value} {unit}.',
  [`${KEY}.saved`]: 'Guardado {value} {unit}.',
  [NOTICE]: 'Continúa por texto.',
};
const FIELD = { id: 'alpha', type: 'number', unit: 'u', promptKey: KEY };
const POLICY = { degradation: { noticeKey: NOTICE } };

function fakeClock() {
  let now = 0;
  let next = 1;
  const timers = new Map();
  return {
    schedule(fn, ms) { const handle = next++; timers.set(handle, { at: now + ms, fn }); return handle; },
    cancel(handle) { timers.delete(handle); },
    advance(ms) {
      now += ms;
      const due = [...timers.entries()].filter(([, t]) => t.at <= now)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0]);
      for (const [handle, timer] of due) {
        if (!timers.has(handle)) continue;
        timers.delete(handle);
        timer.fn();
      }
    },
    pending: () => timers.size,
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function flush(times = 60) {
  for (let index = 0; index < times; index += 1) await Promise.resolve();
}

function capture(fn) {
  try { return fn(); } catch (error) { return error; }
}

function makePorts(over = {}) {
  return {
    speaker: { say: () => Promise.resolve('done'), cancel() {} },
    listener: { listen: () => Promise.resolve({ type: 'speech', text: 'alpha', confidence: 1 }), cancel() {} },
    fieldInterpreter: { interpret: () => Promise.resolve({ code: 'ok', value: 12.5 }), cancel() {} },
    controlInterpreter: { interpret: () => Promise.resolve('affirmation'), cancel() {} },
    ...over,
  };
}

function harness(over = {}) {
  const clock = fakeClock();
  const events = [];
  const ports = makePorts(over.ports ?? {});
  const config = {
    fields: over.fields ?? [FIELD],
    language: { pack: { language: 'zz', texts: over.texts ?? TEXT } },
    policy: over.policy ?? POLICY,
    ports,
    onEvent: (event) => events.push(event),
  };
  if (over.mode !== undefined) config.mode = over.mode;
  if (over.getPreviousValue !== undefined) config.getPreviousValue = over.getPreviousValue;
  const session = createVoiceSession(config,
    { schedule: clock.schedule, cancelSchedule: clock.cancel });
  if (over.speechMuted) session.setSpeechMuted(true);
  if (over.micMuted) session.setMicrophoneMuted(true);
  return { session, events, clock, ports };
}

const of = (events, type) => events.filter((event) => event.type === type);
const first = (events, type) => events.find((event) => event.type === type);
const states = (events) => of(events, 'state_changed').map((event) => event.state);
const pairs = (events) => of(events, 'state_changed').map((event) => [event.state, event.phase]);

async function run(over = {}) {
  const h = harness(over);
  await h.session.start();
  return h;
}

async function sessionInState(wanted) {
  const clock = fakeClock();
  const events = [];
  const gate = deferred();
  const base = makePorts();
  let ports = base;
  if (wanted === 'speaking') {
    let calls = 0;
    ports = { ...base, speaker: { say() { calls += 1; return calls === 1 ? gate.promise : Promise.resolve('done'); }, cancel() {} } };
  }
  if (wanted === 'listening') {
    let calls = 0;
    ports = { ...base, listener: { listen() { calls += 1; return calls === 1 ? gate.promise : Promise.resolve({ type: 'speech', text: 'x', confidence: 1 }); }, cancel() {} } };
  }
  if (wanted === 'thinking') {
    let calls = 0;
    ports = { ...base, fieldInterpreter: { interpret() { calls += 1; return calls === 1 ? gate.promise : Promise.resolve({ code: 'ok', value: 12.5 }); }, cancel() {} } };
  }
  if (wanted === 'error') {
    let calls = 0;
    ports = { ...base, listener: { listen() { calls += 1; return calls <= 2 ? new Promise(() => {}) : Promise.resolve({ type: 'speech', text: 'x', confidence: 1 }); }, cancel() {} } };
  }
  const session = createVoiceSession({
    fields: [FIELD], language: { pack: PACK }, policy: POLICY, ports,
    onEvent: (event) => events.push(event),
  }, { schedule: clock.schedule, cancelSchedule: clock.cancel });
  if (wanted !== 'idle') {
    const running = session.start();
    await flush();
    if (wanted === 'error') {
      clock.advance(TURN_BUDGET_MS);
      await flush();
      clock.advance(TURN_BUDGET_MS);
      await flush();
    }
    return { session, events, clock, gate, running };
  }
  return { session, events, clock, gate, running: null };
}

const PACK = { language: 'zz', texts: TEXT };

// --- Casos de SPEC-001 ---

test('C-001-01 una config sin fields lanza ConfigError invalid_config', () => {
  const error = capture(() => createVoiceSession({ language: { pack: PACK }, policy: POLICY }));
  assert.ok(error instanceof ConfigError);
  assert.equal(error.code, 'invalid_config');
  assert.equal(error.path, 'fields');
});

test('C-001-02 una clave desconocida en la raíz no lee ninguna otra', () => {
  const error = capture(() => createVoiceSession({
    get fields() { throw new Error('se leyó una clave antes de rechazar'); },
    bogus: 1,
  }));
  assert.ok(error instanceof ConfigError);
  assert.equal(error.code, 'invalid_config');
  assert.equal(error.path, 'bogus');
});

test('C-001-03 sin policy.degradation: missing_policy, sin puertos ni eventos', () => {
  const calls = [];
  const events = [];
  const error = capture(() => createVoiceSession({
    fields: [FIELD], language: { pack: PACK }, policy: {},
    ports: { speaker: { say() { calls.push('say'); return Promise.resolve('done'); }, cancel() {} } },
    onEvent: (event) => events.push(event),
  }));
  assert.ok(error instanceof ConfigError);
  assert.equal(error.code, 'missing_policy');
  assert.deepEqual(calls, []);
  assert.deepEqual(events, []);
});

test('C-001-04 una config válida nace en idle, determinista y sin valores', () => {
  const { session } = harness();
  assert.equal(session.state, 'idle');
  assert.equal(session.mode, 'deterministic');
  assert.deepEqual(Object.keys(session.values), []);
});

test('C-001-05 dos sesiones con la misma config no comparten estado', async () => {
  const config = { fields: [FIELD], language: { pack: PACK }, policy: POLICY, ports: makePorts() };
  const sessionA = createVoiceSession(config);
  const sessionB = createVoiceSession(config);
  await sessionA.start();
  assert.equal(Object.keys(sessionA.values).length, 1);
  assert.equal(sessionB.state, 'idle');
  assert.deepEqual(Object.keys(sessionB.values), []);
});

test('C-001-06 un turno sin DOM llega al valor confirmado, no a manual', async () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(typeof window, 'undefined');
  const { session, events } = await run();
  assert.equal(of(events, 'value_confirmed').length, 1);
  assert.deepEqual(session.values.alpha, { value: 12.5, unit: 'u' });
  assert.equal(of(events, 'manual_input_required').length, 0);
});

test('C-001-07 dos dominios distintos conducen su turno sin tocar el núcleo', async () => {
  const alfa = await run();
  const beta = await run({
    fields: [{ id: 'zeta', type: 'text', unit: 'metro-beta', promptKey: 'q.zeta' }],
    texts: { 'q.zeta': 'Pregunta zeta.', 'q.zeta.readback': 'Dices {value}.', 'q.zeta.saved': 'Listo {value}.', [NOTICE]: 'Sigue.' },
    ports: { fieldInterpreter: { interpret: () => Promise.resolve({ code: 'ok', value: 'saludo-zeta' }), cancel() {} } },
  });
  assert.equal(alfa.session.values.alpha.value, 12.5);
  assert.equal(beta.session.values.zeta.value, 'saludo-zeta');
});

test('C-001-08 los valores de dominio no aparecen en el núcleo', () => {
  const literals = ['zona-alfa', 'zona-beta', 'q.alfa', 'q.beta', 'unidad-alfa',
    'metro-beta', 'seguro-alfa', 'seguro-beta', 'texto-alfa', 'texto-beta'];
  for (const literal of literals) {
    assert.equal(SOURCE.includes(literal), false, 'el núcleo contiene ' + literal);
  }
});

test('C-001-09 un turno completo no invoca red, almacenamiento ni consola', async () => {
  const names = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon',
    'localStorage', 'sessionStorage', 'indexedDB', 'console'];
  const calls = [];
  const previous = new Map();
  const trap = (name) => function () { calls.push(name); throw new Error('API prohibida: ' + name); };
  try {
    for (const name of names) {
      previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: trap(name) });
    }
    const { session } = await run();
    assert.equal(Object.keys(session.values).length, 1);
    assert.deepEqual(calls, []);
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor === undefined) delete globalThis[name];
      else Object.defineProperty(globalThis, name, descriptor);
    }
  }
});

test('C-001-10 CAPABILITIES declara la polaridad del núcleo', () => {
  assert.equal(CAPABILITIES.opensNetwork, false);
  assert.equal(CAPABILITIES.persists, false);
  assert.equal(CAPABILITIES.writesStorage, false);
  assert.equal(CAPABILITIES.writesLogs, false);
  assert.equal(CAPABILITIES.touchesDom, false);
  assert.equal(CAPABILITIES.requiresExplicitConfirmation, true);
  assert.ok(Object.isFrozen(CAPABILITIES));
});

test('C-001-11 un onEvent que lanza no tumba el turno', async () => {
  const clock = fakeClock();
  let calls = 0;
  const session = createVoiceSession({
    fields: [FIELD], language: { pack: PACK }, policy: POLICY, ports: makePorts(),
    onEvent() { calls += 1; throw new Error('observador'); },
  }, { schedule: clock.schedule, cancelSchedule: clock.cancel });
  await session.start();
  assert.ok(calls > 0);
  assert.equal(Object.keys(session.values).length, 1);
});

test('C-001-12 el texto de voz no añade información al de pantalla', async () => {
  const { events } = await run();
  for (const event of events) {
    if (typeof event.speechText !== 'string') continue;
    assert.equal(event.speechText, event.displayText);
  }
  assert.ok(first(events, 'value_confirmed').spokenValue.includes('12.5'));
});

test('C-001-13 un valor fuera de rango no se guarda ni se confirma', async () => {
  const { session, events } = await run({
    fields: [{ id: 'n', type: 'integer', range: { min: 1, max: 10 }, promptKey: KEY }],
    ports: { fieldInterpreter: { interpret: () => Promise.resolve({ code: 'ok', value: 99 }), cancel() {} } },
  });
  assert.deepEqual(Object.keys(session.values), []);
  assert.equal(of(events, 'confirmation_requested').length, 0);
  assert.equal(first(events, 'failure').code, 'unresolved_value');
});

test('C-001-14 submitText se acepta en los cinco estados visibles', async () => {
  for (const wanted of ['idle', 'listening', 'thinking', 'speaking', 'error']) {
    const { session, events } = await sessionInState(wanted);
    await session.submitText('x');
    assert.ok(
      pairs(events).some(([state, phase]) => state === 'thinking' && phase === 'interpreting'),
      'sin transición a thinking · interpreting desde ' + wanted,
    );
  }
});

test('C-001-15 importar dos veces no ejecuta efectos ni comparte estado', async () => {
  const names = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon',
    'localStorage', 'sessionStorage', 'indexedDB', 'console'];
  const calls = [];
  const previous = new Map();
  const trap = (name) => function () { calls.push(name); throw new Error('API prohibida: ' + name); };
  try {
    for (const name of names) {
      previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: trap(name) });
    }
    const again = await import('../src/core/session.js?segunda-importacion');
    const config = { fields: [FIELD], language: { pack: PACK }, policy: POLICY, ports: makePorts() };
    const firstSession = again.createVoiceSession(config);
    const secondSession = again.createVoiceSession(config);
    await firstSession.start();
    assert.deepEqual(calls, []);
    assert.equal(Object.keys(secondSession.values).length, 0);
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor === undefined) delete globalThis[name];
      else Object.defineProperty(globalThis, name, descriptor);
    }
  }
});

test('C-001-16 deltaPolicy «none» sigue el camino normal de confirmación', async () => {
  const { session, events } = await run({
    fields: [{ ...FIELD, deltaPolicy: { maxDifference: 1, onExceeded: 'none' } }],
    getPreviousValue: () => 5,
  });
  assert.equal(of(events, 'confirmation_requested').length, 1);
  assert.equal(of(events, 'manual_input_required').length, 0);
  assert.equal(session.values.alpha.value, 12.5);
});

test('C-001-17 deltaPolicy «reconfirm» pide una segunda confirmación sin degradar', async () => {
  const { session, events } = await run({
    fields: [{ ...FIELD, deltaPolicy: { maxDifference: 1, onExceeded: 'reconfirm' } }],
    getPreviousValue: () => 5,
  });
  assert.equal(of(events, 'confirmation_requested').length, 2);
  assert.equal(of(events, 'value_confirmed').length, 1);
  assert.equal(of(events, 'manual_input_required').length, 0);
  assert.equal(session.values.alpha.value, 12.5);
});

test('C-001-18 sin getPreviousValue la comparación no se evalúa ni degrada', async () => {
  const { session, events } = await run({
    fields: [{ ...FIELD, deltaPolicy: { maxDifference: 1, onExceeded: 'reconfirm' } }],
  });
  assert.equal(of(events, 'confirmation_requested').length, 1);
  assert.equal(of(events, 'manual_input_required').length, 0);
  assert.equal(session.values.alpha.value, 12.5);
});

// --- Casos de SPEC-005 ---

test('C-005-01 la secuencia de estados de un turno completo es la declarada', async () => {
  const { session, events } = await run();
  assert.deepEqual(states(events),
    ['speaking', 'listening', 'thinking', 'speaking', 'listening', 'speaking', 'idle']);
  assert.equal(session.state, 'idle');
});

test('C-005-02 el desenlace observable es el valor confirmado', async () => {
  const { session, events } = await run();
  const confirmed = of(events, 'value_confirmed');
  assert.equal(confirmed.length, 1);
  assert.equal(confirmed[0].value, 12.5);
  assert.equal(session.values.alpha.value, 12.5);
  assert.equal(of(events, 'manual_input_required').length, 0);
});

test('C-005-03 toda fase es del enumerado y ninguna es nula', async () => {
  const { events } = await run();
  const seen = new Set();
  for (const [state, phase] of pairs(events)) {
    assert.ok(PHASES.includes(phase), 'fase desconocida ' + phase);
    assert.notEqual(phase, null);
    seen.add(phase);
  }
  assert.ok(seen.size > 0);
});

test('C-005-04 cada par (state, phase) pertenece a la tabla de verdad', async () => {
  const truth = {
    idle: ['idle'],
    speaking: ['asking', 'confirming', 'closing', 'degrading'],
    listening: ['capturing'],
    thinking: ['interpreting'],
    error: ['failed'],
  };
  const observed = [];
  const collect = (events) => { for (const pair of pairs(events)) observed.push(pair); };
  collect((await run()).events);
  collect((await run({ micMuted: true })).events);
  collect((await run({ speechMuted: true })).events);
  collect((await run({ ports: { controlInterpreter: { interpret: () => Promise.resolve('unclassified'), cancel() {} } } })).events);
  collect((await sessionInState('error')).events);
  assert.ok(observed.length > 0);
  for (const [state, phase] of observed) {
    assert.ok(truth[state] !== undefined, 'estado desconocido ' + state);
    assert.ok(truth[state].includes(phase), 'par inválido ' + state + '/' + phase);
  }
  assert.equal(observed.some(([, phase]) => phase === 'failed'), true);
  for (const [state, phase] of observed) {
    if (phase === 'failed') assert.equal(state, 'error');
  }
});

test('C-005-05 un resultado de listener sin turno abierto no cambia nada', async () => {
  const gate = deferred();
  const listener = { calls: [], listen(request, callbacks) { this.calls.push({ request, callbacks }); return gate.promise; }, cancel() {} };
  const h = harness({ ports: { listener } });
  const running = h.session.start();
  await flush();
  h.session.setMicrophoneMuted(true);
  assert.equal(h.session.state, 'idle');
  const mark = h.events.length;
  gate.resolve({ type: 'speech', text: 'x', confidence: 1 });
  listener.calls[0].callbacks.onNoSpeech();
  listener.calls[0].callbacks.onError();
  await running;
  await flush();
  assert.equal(h.events.length, mark, 'un resultado sin turno abierto emitió eventos');
  assert.equal(h.session.state, 'idle');
});

test('C-005-06 un speaker con error o watchdog no encadena escucha', async () => {
  for (const result of ['error', 'watchdog']) {
    const { session, events } = await run({
      ports: { speaker: { say: () => Promise.resolve(result), cancel() {} } },
    });
    assert.equal(states(events).includes('listening'), false);
    assert.equal(first(events, 'failure').code,
      result === 'error' ? 'speech_failed' : 'speech_watchdog');
    assert.equal(session.state, 'idle');
  }
});

test('C-005-07 con el micrófono apagado nunca se entra en listening', async () => {
  const { session, events } = await run({ micMuted: true });
  assert.equal(states(events).includes('listening'), false);
  assert.equal(of(events, 'manual_input_required').length, 1);
  assert.equal(session.state, 'idle');
});

test('C-005-08 con la voz silenciada nunca se entra en speaking', async () => {
  const { session, events } = await run({ speechMuted: true });
  assert.equal(states(events).includes('speaking'), false);
  assert.ok(of(events, 'text_output').length >= 1);
  assert.equal(session.values.alpha.value, 12.5);
});

test('C-005-09 desde error la única salida es la salida declarada', async () => {
  const { session, events } = await sessionInState('error');
  const all = pairs(events);
  const errorIndex = all.findIndex(([state, phase]) => state === 'error' && phase === 'failed');
  assert.ok(errorIndex >= 0);
  assert.deepEqual(all.at(-1), ['error', 'failed']);
  assert.equal(of(events, 'manual_input_required').length, 1);
  await session.submitText('x');
  const after = pairs(events).slice(errorIndex + 1);
  assert.deepEqual(after[0], ['thinking', 'interpreting'], 'la única salida no es la declarada');
  assert.notEqual(after[0][0], 'listening');
  assert.notEqual(after[0][0] + '/' + after[0][1], 'speaking/confirming');
});

test('C-005-10 un callback posterior al cierre no produce state_changed', async () => {
  const calls = [];
  const listener = { listen(request, callbacks) { calls.push(callbacks); return Promise.resolve({ type: 'speech', text: 'x', confidence: 1 }); }, cancel() {} };
  const h = harness({ ports: { listener } });
  await h.session.start();
  assert.equal(calls.length, 2, 'el turno no cubrió los dos pasos de escucha');
  const mark = h.events.length;
  calls[0].onNoSpeech();
  calls[0].onError();
  calls[1].onNoSpeech();
  await flush();
  assert.equal(h.events.length, mark, 'un callback posterior al cierre emitió eventos');
  assert.equal(h.session.state, 'idle');
});

test('C-005-11 submitText transiciona a thinking · interpreting en los cinco estados', async () => {
  for (const wanted of ['idle', 'listening', 'thinking', 'speaking', 'error']) {
    const { session, events } = await sessionInState(wanted);
    const before = pairs(events).length;
    await session.submitText('x');
    const after = pairs(events).slice(before);
    assert.ok(after.length > 0, 'submitText no transicionó desde ' + wanted);
    assert.deepEqual(after[0], ['thinking', 'interpreting']);
  }
});

test('C-005-12 el presupuesto agotado se rehace sin entrar en error', async () => {
  const clock = fakeClock();
  const events = [];
  let calls = 0;
  const listener = {
    listen() { calls += 1; return calls === 1 ? new Promise(() => {}) : Promise.resolve({ type: 'speech', text: 'x', confidence: 1 }); },
    cancel() {},
  };
  const session = createVoiceSession({
    fields: [FIELD], language: { pack: PACK }, policy: POLICY,
    ports: makePorts({ listener }), onEvent: (event) => events.push(event),
  }, { schedule: clock.schedule, cancelSchedule: clock.cancel });
  const running = session.start();
  await flush();
  clock.advance(TURN_BUDGET_MS);
  await flush();
  assert.ok(of(events, 'failure').some((event) => event.code === 'port_budget_exhausted'));
  assert.notEqual(session.state, 'error');
  assert.ok(pairs(events).some(([state, phase]) => state === 'speaking' && phase === 'asking'), 'no se rehízo el turno');
  assert.equal(clock.pending(), 0);
  await running;
  assert.equal(session.values.alpha.value, 12.5);
});

test('C-005-13 un speaker que no cierra da watchdog y ninguna fase avanza por tiempo', async () => {
  const clock = fakeClock();
  const events = [];
  const session = createVoiceSession({
    fields: [FIELD], language: { pack: PACK }, policy: POLICY,
    ports: makePorts({ speaker: { say: () => new Promise(() => {}), cancel() {} } }),
    onEvent: (event) => events.push(event),
  }, { schedule: clock.schedule, cancelSchedule: clock.cancel });
  const running = session.start();
  await flush();
  assert.equal(session.state, 'speaking');
  clock.advance(SPEECH_BUDGET_MS);
  await flush();
  assert.equal(first(events, 'failure').code, 'speech_watchdog');
  assert.equal(states(events).includes('listening'), false);
  clock.advance(SPEECH_BUDGET_MS);
  await flush();
  await running;
});

test('C-005-14 PHASES declara los ocho valores y cada uno un solo estado', () => {
  assert.deepEqual([...PHASES], ['idle', 'asking', 'capturing', 'interpreting',
    'confirming', 'closing', 'degrading', 'failed']);
  const truth = { idle: ['idle'], speaking: ['asking', 'confirming', 'closing', 'degrading'], listening: ['capturing'], thinking: ['interpreting'], error: ['failed'] };
  const owner = new Map();
  for (const [state, phases] of Object.entries(truth)) {
    for (const phase of phases) {
      assert.equal(owner.has(phase), false, 'fase repetida ' + phase);
      owner.set(phase, state);
    }
  }
  assert.deepEqual([...PHASES].sort(), [...owner.keys()].sort());
});

test('C-005-15 si el reintento también agota, error · failed y salida manual', async () => {
  const { session, events } = await sessionInState('error');
  assert.deepEqual(pairs(events).at(-1), ['error', 'failed']);
  assert.equal(first(events, 'manual_input_required').reason, 'port_budget_exhausted');
  assert.equal(of(events, 'failure').filter((event) => event.code === 'port_budget_exhausted').length, 2);
  assert.equal(of(events, 'value_confirmed').length, 0);
});

// --- Casos de SPEC-008 ---

test('C-008-01 el readback dice el valor exacto que se va a guardar', async () => {
  const { events } = await run();
  const request = first(events, 'confirmation_requested');
  assert.equal(request.value, 12.5);
  assert.equal(request.unit, 'u');
  assert.equal(request.spokenValue, 'Confirmas 12.5 u.');
});

test('C-008-02 lo confirmado coincide con lo pronunciado y con `values`', async () => {
  const { session, events } = await run();
  const request = first(events, 'confirmation_requested');
  const confirmed = first(events, 'value_confirmed');
  assert.equal(confirmed.value, request.value);
  assert.equal(confirmed.spokenValue, request.spokenValue);
  assert.equal(session.values.alpha.value, request.value);
  assert.equal(session.values.alpha.unit, 'u');
});

test('C-008-03 la parte decimal se dice tal cual, sin redondear', async () => {
  const { session, events } = await run({
    ports: { fieldInterpreter: { interpret: () => Promise.resolve({ code: 'ok', value: 3.14159 }), cancel() {} } },
  });
  assert.equal(first(events, 'confirmation_requested').spokenValue, 'Confirmas 3.14159 u.');
  assert.equal(session.values.alpha.value, 3.14159);
});

test('C-008-04 el dato no pasa por `phrases` para readback ni anuncio', async () => {
  const keys = [];
  const phrases = { text(key) { keys.push(key); return Promise.resolve('texto'); }, cancel() {} };
  const { session } = await run({ ports: { phrases } });
  assert.equal(session.values.alpha.value, 12.5);
  assert.equal(keys.some((key) => key.endsWith('.readback') || key.endsWith('.saved')), false);
  assert.deepEqual(keys, []);
});

test('C-008-05 una clave de readback ausente no confirma ni guarda', async () => {
  const texts = { [KEY]: TEXT[KEY], [NOTICE]: TEXT[NOTICE] };
  const { session, events } = await run({ texts });
  assert.equal(of(events, 'confirmation_requested').length, 0);
  assert.equal(first(events, 'failure').code, 'missing_text');
  assert.deepEqual(Object.keys(session.values), []);
});

test('C-008-06 si la locución del readback falla, el valor no se guarda', async () => {
  for (const result of ['error', 'watchdog']) {
    let calls = 0;
    const speaker = { say() { calls += 1; return Promise.resolve(calls === 1 ? 'done' : result); }, cancel() {} };
    const { session, events } = await run({ ports: { speaker } });
    assert.equal(of(events, 'value_confirmed').length, 0);
    assert.deepEqual(Object.keys(session.values), []);
    assert.equal(first(events, 'failure').code,
      result === 'error' ? 'speech_failed' : 'speech_watchdog');
  }
});

test('C-008-07 un turno sin confirmación explícita no escribe el campo', async () => {
  let calls = 0;
  const listener = {
    listen() { calls += 1; return Promise.resolve(calls === 1 ? { type: 'speech', text: 'x', confidence: 1 } : { type: 'recognition_failed' }); },
    cancel() {},
  };
  const { session } = await run({ ports: { listener } });
  assert.deepEqual(Object.keys(session.values), []);
});

test('C-008-08 permiso de micrófono denegado degrada a manual sin error', async () => {
  const { session, events } = await run({
    ports: { listener: { listen: () => Promise.resolve({ type: 'recognition_failed' }), cancel() {} } },
  });
  const manual = first(events, 'manual_input_required');
  assert.ok(['no_speech', 'recognition_failed', 'speech_failed', 'speech_watchdog', 'port_failure', 'port_budget_exhausted'].includes(manual.reason));
  assert.equal(states(events).includes('error'), false);
  await session.submitText('12.5');
  assert.ok(pairs(events).some(([state]) => state === 'thinking'));
});

test('C-008-09 sin conexión, el listener degrada y no confirma por voz', async () => {
  const { session, events } = await run({
    ports: { listener: { listen: () => Promise.resolve({ type: 'recognition_failed' }), cancel() {} } },
  });
  assert.equal(of(events, 'value_confirmed').length, 0);
  assert.equal(of(events, 'manual_input_required').length, 1);
  assert.equal(session.state, 'idle');
});

test('C-008-10 los fallos consecutivos hasta el límite degradan a manual', async () => {
  const { session, events } = await run({
    policy: { degradation: { noticeKey: NOTICE, maxConsecutiveFailures: 2 }, confirmation: { maxAttempts: 2 } },
    ports: { listener: { listen: () => Promise.resolve({ type: 'no_speech' }), cancel() {} } },
  });
  assert.equal(of(events, 'failure').filter((event) => event.code === 'no_speech').length, 2);
  assert.equal(of(events, 'manual_input_required').length, 1);
  assert.equal(session.state, 'idle');
});

test('C-008-11 un valor por submitText recorre readback y confirmación', async () => {
  let calls = 0;
  const listener = {
    listen() { calls += 1; return Promise.resolve(calls === 1 ? { type: 'recognition_failed' } : { type: 'speech', text: 'sí', confidence: 1 }); },
    cancel() {},
  };
  const { session, events } = await run({ ports: { listener } });
  assert.equal(of(events, 'manual_input_required').length, 1);
  await session.submitText('12.5');
  const request = first(events, 'confirmation_requested');
  assert.equal(request.value, 12.5);
  await session.submitText('sí');
  const confirmed = first(events, 'value_confirmed');
  assert.equal(confirmed.spokenValue, request.spokenValue);
  assert.equal(session.values.alpha.value, 12.5);
});

test('C-008-12 la degradación no es error, no cambia el modo ni escribe valores', async () => {
  const { session, events } = await run({
    ports: { listener: { listen: () => Promise.resolve({ type: 'recognition_failed' }), cancel() {} } },
  });
  assert.notEqual(session.state, 'error');
  assert.equal(session.mode, 'deterministic');
  assert.deepEqual(Object.keys(session.values), []);
  const manual = first(events, 'manual_input_required');
  assert.equal(manual.displayText, TEXT[NOTICE]);
  assert.equal(manual.speechText, TEXT[NOTICE]);
});

test('C-008-13 sin maxConsecutiveFailures el primer fallo degrada', async () => {
  const { events } = await run({
    ports: { listener: { listen: () => Promise.resolve({ type: 'recognition_failed' }), cancel() {} } },
  });
  assert.equal(of(events, 'failure').length, 1);
  assert.equal(of(events, 'manual_input_required').length, 1);
});

test('C-008-14 sin policy.degradation no hay sesión: missing_policy', () => {
  const error = capture(() => createVoiceSession({
    fields: [FIELD], language: { pack: PACK }, policy: {},
  }));
  assert.ok(error instanceof ConfigError);
  assert.equal(error.code, 'missing_policy');
});

test('C-008-15 la degradación ocurre al agotar el primero de los contadores', async () => {
  let listenCalls = 0;
  const listener = {
    listen() { listenCalls += 1; return Promise.resolve(listenCalls === 1 ? { type: 'speech', text: 'x', confidence: 1 } : { type: 'recognition_failed' }); },
    cancel() {},
  };
  const { events } = await run({
    policy: { degradation: { noticeKey: NOTICE, maxConsecutiveFailures: 2 }, confirmation: { maxAttempts: 5 } },
    ports: { listener, controlInterpreter: { interpret: () => Promise.resolve('negation'), cancel() {} } },
  });
  assert.equal(of(events, 'failure').filter((event) => event.code === 'no_speech').length, 0);
  assert.equal(of(events, 'manual_input_required').length, 1);
  assert.equal(listenCalls, 3, 'la repregunta debió escuchar de nuevo antes de fallar');
});

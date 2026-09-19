// Arnés compartido de las pruebas de sesión: reloj falso, dobles de
// puertos, captura de eventos y constructores de escenarios (SPEC-005).

import { createVoiceSession } from '../../src/core/session.js';

export const TURN_BUDGET_MS = 30000;
export const SPEECH_BUDGET_MS = 20000;

export const KEY = 'q.alpha';
export const NOTICE = 'aviso.alpha';
export const TEXT = {
  [KEY]: 'Pregunta alpha.',
  [`${KEY}.readback`]: 'Confirmas {value} {unit}.',
  [`${KEY}.saved`]: 'Guardado {value} {unit}.',
  [NOTICE]: 'Continúa por texto.',
};
export const FIELD = { id: 'alpha', type: 'number', unit: 'u', promptKey: KEY };
export const POLICY = { degradation: { noticeKey: NOTICE } };

export function fakeClock() {
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

export function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

export async function flush(times = 60) {
  for (let index = 0; index < times; index += 1) await Promise.resolve();
}

export function capture(fn) {
  try { return fn(); } catch (error) { return error; }
}

export function makePorts(over = {}) {
  return {
    speaker: { say: () => Promise.resolve('done'), cancel() {} },
    listener: { listen: () => Promise.resolve({ type: 'speech', text: 'alpha', confidence: 1 }), cancel() {} },
    fieldInterpreter: { interpret: () => Promise.resolve({ code: 'ok', value: 12.5 }), cancel() {} },
    controlInterpreter: { interpret: () => Promise.resolve('affirmation'), cancel() {} },
    ...over,
  };
}

export function harness(over = {}) {
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

export const of = (events, type) => events.filter((event) => event.type === type);
export const first = (events, type) => events.find((event) => event.type === type);
export const states = (events) => of(events, 'state_changed').map((event) => event.state);
export const pairs = (events) => of(events, 'state_changed').map((event) => [event.state, event.phase]);

export async function run(over = {}) {
  const h = harness(over);
  await h.session.start();
  return h;
}

export async function sessionInState(wanted) {
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
    // Dos señales de presupuesto en un mismo campo: el listener cuelga y el
    // speaker cuelga desde su tercera locución; con límites altos el redo
    // determinista del primero conduce al segundo y agota el reintento.
    let says = 0;
    ports = {
      ...base,
      speaker: { say() { says += 1; return says <= 2 ? Promise.resolve('done') : new Promise(() => {}); }, cancel() {} },
      listener: { listen() { return new Promise(() => {}); }, cancel() {} },
    };
  }
  const session = createVoiceSession({
    fields: [FIELD],
    language: { pack: PACK },
    policy: wanted === 'error'
      ? { degradation: { noticeKey: NOTICE, maxConsecutiveFailures: 6 }, confirmation: { maxAttempts: 6 } }
      : POLICY,
    ports,
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

export const PACK = { language: 'zz', texts: TEXT };

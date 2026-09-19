// Regresiones de la ronda adversarial sobre el núcleo.
//
// Cada prueba fija un hallazgo de la ronda con su evidencia conductual:
// fidelidad del valor negado, avance del flujo por texto, `runtime`
// cerrado y compuerta con clases bloqueadas extremo a extremo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceSession } from '../src/core/session.js';
import {
  TEXT, FIELD, POLICY, PACK, NOTICE, capture, makePorts, run, of,
} from './helpers/session-harness.js';

// --- Regresiones de la ronda adversarial ---

test('el texto del usuario tras una negación nunca confirma el valor negado', async () => {
  const received = [];
  let controls = 0;
  const { session, events } = await run({
    ports: {
      fieldInterpreter: { interpret(text) { received.push(text); return Promise.resolve({ code: 'ok', value: 99 }); }, cancel() {} },
      controlInterpreter: { interpret() { controls += 1; return Promise.resolve(controls === 1 ? 'negation' : 'affirmation'); }, cancel() {} },
    },
  });
  await session.submitText('mi nuevo valor es 99');
  await session.submitText('sí');
  assert.equal(received.includes('mi nuevo valor es 99'), true, 'el texto no llegó al intérprete de campos');
  assert.equal(session.values.alpha?.value, 99, 'se guardó un valor que la persona negó');
  const confirmed = of(events, 'value_confirmed');
  assert.equal(confirmed.length, 1);
  assert.equal(confirmed[0].value, 99);
});

test('el flujo por texto avanza al campo siguiente tras confirmar', async () => {
  const texts = {
    ...TEXT,
    'q.beta': 'Pregunta beta.',
    'q.beta.readback': 'Confirmas {value} {unit}.',
    'q.beta.saved': 'Guardado {value} {unit}.',
  };
  const fields = [
    FIELD,
    { id: 'beta', type: 'number', unit: 'u', promptKey: 'q.beta' },
  ];
  const { session, events } = await run({
    fields,
    texts,
    speechMuted: true,
    ports: {
      fieldInterpreter: { interpret(text, field) {
        return Promise.resolve({ code: 'ok', value: field.id === 'alpha' ? 12.5 : 7 });
      }, cancel() {} },
    },
  });
  await session.submitText('doce');
  await session.submitText('sí');
  await session.submitText('siete');
  await session.submitText('sí');
  assert.equal(of(events, 'confirmation_requested').length, 2, 'el segundo campo no llegó a confirmarse');
  assert.equal(session.values.alpha?.value, 12.5);
  assert.equal(session.values.beta?.value, 7);
});

test('C-001-19 runtime es un objeto cerrado: pareja, claves y tipo se rechazan al construir', () => {
  const base = { fields: [FIELD], language: { pack: PACK }, policy: POLICY };
  const schedule = () => 1;
  let error = capture(() => createVoiceSession(base, { schedule, bogus: 1 }));
  assert.equal(error.path, 'runtime.bogus');
  error = capture(() => createVoiceSession(base, { schedule }));
  assert.equal(error.path, 'runtime');
  error = capture(() => createVoiceSession(base, { cancelSchedule: () => {} }));
  assert.equal(error.path, 'runtime');
  error = capture(() => createVoiceSession(base, 'no'));
  assert.equal(error.path, 'runtime');
  error = capture(() => createVoiceSession(base, { schedule: 3, cancelSchedule: () => {} }));
  assert.equal(error.path, 'runtime.schedule');
});

test('la compuerta de la sesión habla el texto seguro cuando la clase está bloqueada', async () => {
  const said = [];
  const texts = { ...TEXT, 'q.seguro': 'Texto seguro.' };
  const { session, events } = await run({
    texts,
    policy: { degradation: { noticeKey: NOTICE }, blockedClasses: ['form'], safeTextKey: 'q.seguro' },
    ports: { speaker: { say(text) { said.push(text); return Promise.resolve('done'); }, cancel() {} } },
  });
  assert.equal(said.includes('Pregunta alpha.'), false, 'se habló el texto bloqueado');
  assert.equal(said.includes('Texto seguro.'), true, 'no se habló el texto seguro');
  assert.equal(session.values.alpha?.value, 12.5);
  assert.equal(of(events, 'value_confirmed').length, 1);
});

test('C-001-20 las claves derivadas son contrato: sin <promptKey>.saved no se guarda', async () => {
  const texts = { ...TEXT };
  delete texts['q.alpha.saved'];
  const { session, events } = await run({ texts });
  assert.equal(of(events, 'value_confirmed').length, 0, 'se guardó sin clave de resumen');
  assert.equal(of(events, 'failure').some((event) => event.code === 'missing_text'), true);
  assert.equal(session.values.alpha, undefined);
});

test('C-003-03 un speaker que resuelve watchdog o error falla declarado y no revienta la sesión', async () => {
  // Regresión del BLOCKER de la re-ronda: con límites >= 2, un fallo de
  // locución no señalado dejaba el turno abierto y el reintento lanzaba
  // TurnError interno. Ahora el paso cierra su turno antes de repetir.
  let says = 0;
  const { session, events } = await run({
    policy: { degradation: { noticeKey: NOTICE, maxConsecutiveFailures: 3 }, confirmation: { maxAttempts: 3 } },
    ports: { speaker: { say() { says += 1; return Promise.resolve(says === 1 ? 'watchdog' : 'error'); }, cancel() {} } },
  });
  await session.submitText('de nuevo');
  assert.equal(of(events, 'failure').some((event) => event.code === 'speech_watchdog'), true);
  assert.equal(of(events, 'failure').some((event) => event.code === 'speech_failed'), true);
  assert.equal(of(events, 'value_confirmed').length, 0);
  assert.equal(session.state, 'idle');
  assert.ok(of(events, 'manual_input_required').length >= 1);
});

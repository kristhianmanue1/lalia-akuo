// Pruebas de la disciplina de turno (SPEC-002, REQ-3).
//
// Una prueba por caso `C-002-*` de la spec. Lo que se comprueba no es que el
// módulo «haga lo que dice», sino su efecto observable: el estado de la
// sesión y los eventos que emite. Para eso el arnés entrega cada resultado a
// `decide` y sólo aplica la mutación cuando la respuesta es aceptada; un
// no-op que mutara o emitiera se ve en la instantánea.
//
// Cada prueba de no-op lleva un control positivo —el mismo resultado sobre
// un turno legítimo sí se aplica— para que no pueda pasar por un arnés que
// nunca aplica nada.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTurnDiscipline,
  ACCEPTED,
  NOOP_REASONS,
  PORT_BUDGET_EXHAUSTED,
} from '../src/core/turn.js';

const TURN_BUDGET_MS = 30000;

// Reloj falso: determinista y sin timers reales. El módulo no lee el reloj;
// recibe estas dos funciones, y así la prueba decide cuándo se agota un
// presupuesto.
function createFakeClock() {
  let now = 0;
  let nextHandle = 1;
  const timers = new Map();

  function schedule(fn, ms) {
    const handle = nextHandle;
    nextHandle += 1;
    timers.set(handle, { at: now + ms, fn });
    return handle;
  }

  function cancel(handle) {
    timers.delete(handle);
  }

  function advance(ms) {
    now += ms;
    const due = [...timers.entries()]
      .filter(([, timer]) => timer.at <= now)
      .sort((a, b) => a[1].at - b[1].at || a[0] - b[0]);
    for (const [handle, timer] of due) {
      if (!timers.has(handle)) {
        continue;
      }
      timers.delete(handle);
      timer.fn();
    }
  }

  return { schedule, cancel, advance, pending: () => timers.size };
}

// Sesión mínima de prueba. No es el núcleo: es el consumidor que respeta la
// decisión, con lo observable justo —estado, valores confirmados y eventos—
// para poder afirmar que un no-op no los toca.
function createHarness() {
  const clock = createFakeClock();
  const events = [];
  const values = Object.create(null);
  let state = 'idle';

  const discipline = createTurnDiscipline({
    sessionId: 'sesion-de-prueba',
    schedule: clock.schedule,
    cancelSchedule: clock.cancel,
    onBudgetExhausted: ({ code, turn }) => {
      state = 'error';
      events.push({
        type: 'failure',
        code,
        state,
        fallback: 'deterministic',
        turn: turn.id,
      });
    },
  });

  return {
    discipline,
    clock,
    events,
    values,
    get state() {
      return state;
    },
    get openTurn() {
      return discipline.openTurn;
    },

    open(expectedState) {
      state = expectedState;
      return discipline.open(expectedState);
    },

    // El estado cambia sin tocar el turno, como en `submitText` (SPEC-005).
    submitText() {
      state = 'thinking';
    },

    // `setMicrophoneMuted(true)`: cancela el turno en vuelo y queda en idle.
    mute(port = null) {
      const turn = discipline.openTurn;
      const cancelled = turn === null ? false : discipline.cancel(turn, port);
      state = 'idle';
      return cancelled;
    },

    // Invoca un puerto como lo haría el núcleo: la petición sale de la
    // disciplina y el puerto la recibe tal cual.
    invoke(port) {
      const turn = discipline.openTurn;
      if (turn === null) {
        throw new Error('no hay turno abierto que invocar');
      }
      return port(discipline.request(turn, TURN_BUDGET_MS));
    },

    // Entrega un resultado etiquetado. La mutación observable sólo ocurre si
    // la disciplina acepta: es lo que permite probar el no-op por su efecto.
    deliver(label, mutate, flags) {
      const decision = discipline.decide(label, state, flags);
      if (decision.accepted) {
        mutate({
          state(next) {
            state = next;
          },
          value(fieldId, value) {
            values[fieldId] = value;
          },
          emit(event) {
            events.push(event);
          },
        });
      }
      return decision;
    },

    snapshot() {
      return JSON.parse(JSON.stringify({ state, values, events }));
    },
  };
}

// C-002-01
test('C-002-01 la sesión abre turnos con id estrictamente creciente', () => {
  const h = createHarness();
  const turns = [];
  for (let index = 0; index < 5; index += 1) {
    const turn = h.open('speaking');
    turns.push(turn);
    assert.equal(h.discipline.resolve(turn), true);
  }

  const ids = turns.map((turn) => turn.id);
  assert.deepEqual(ids, [1, 2, 3, 4, 5]);
  assert.equal(new Set(ids).size, ids.length, 'un id se repitió');
  for (let index = 1; index < ids.length; index += 1) {
    assert.ok(ids[index] > ids[index - 1], 'el id no es creciente');
  }
  assert.equal(
    new Set(turns.map((turn) => turn.token)).size,
    turns.length,
    'un token se repitió',
  );
});

// C-002-02
test('C-002-02 un resultado tardío de un turno resuelto es no-op', () => {
  const h = createHarness();
  const turn = h.open('speaking');
  const applied = h.deliver(turn, (effect) => {
    effect.state('listening');
    effect.emit({ type: 'state_changed', state: 'listening', turn: turn.id });
  });
  assert.equal(applied.accepted, true);
  assert.equal(h.discipline.resolve(turn), true);

  const before = h.snapshot();
  const late = h.deliver(turn, (effect) => {
    effect.state('speaking');
    effect.value('weight', 70);
    effect.emit({ type: 'value_confirmed', fieldId: 'weight', value: 70 });
  });

  assert.equal(late.accepted, false);
  assert.equal(late.reason, NOOP_REASONS.turn_resolved);
  assert.deepEqual(h.snapshot(), before, 'el no-op tocó el observable');

  // Control positivo: el mismo resultado sobre un turno abierto sí se aplica.
  const open = h.open('listening');
  const afterOpen = h.snapshot();
  const accepted = h.deliver(open, (effect) => {
    effect.value('weight', 70);
    effect.emit({ type: 'value_confirmed', fieldId: 'weight', value: 70 });
  });
  assert.equal(accepted.accepted, true);
  assert.notDeepEqual(h.snapshot(), afterOpen);
});

// C-002-03
test('C-002-03 un resultado posterior a la cancelación es no-op', () => {
  const h = createHarness();
  const turn = h.open('listening');
  const received = [];
  h.invoke((request) => {
    received.push(request);
    return new Promise(() => {});
  });
  const port = {
    cancelled: 0,
    cancel() {
      this.cancelled += 1;
    },
  };

  assert.equal(h.mute(port), true);
  assert.equal(received[0].signal.aborted, true);
  assert.equal(port.cancelled, 1);

  const before = h.snapshot();
  const late = h.deliver(turn, (effect) => {
    effect.state('thinking');
    effect.value('weight', 70);
    effect.emit({ type: 'value_confirmed', fieldId: 'weight', value: 70 });
  });

  assert.equal(late.accepted, false);
  assert.equal(late.reason, NOOP_REASONS.turn_cancelled);
  assert.deepEqual(h.snapshot(), before, 'el no-op tocó el observable');

  // Cancelar otra vez no cambia nada ni vuelve a llamar al puerto.
  assert.equal(h.discipline.cancel(turn, port), false);
  assert.equal(port.cancelled, 1);
  assert.deepEqual(h.snapshot(), before);
});

// C-002-04
test('C-002-04 un resultado del turno anterior no toca el turno abierto', () => {
  const h = createHarness();
  const previous = h.open('listening');
  assert.equal(h.discipline.resolve(previous), true);
  const current = h.open('listening');
  const before = h.snapshot();

  const stale = h.deliver(previous, (effect) => {
    effect.state('thinking');
    effect.value('weight', 70);
    effect.emit({ type: 'value_confirmed', fieldId: 'weight', value: 70 });
  });

  assert.equal(stale.accepted, false);
  assert.equal(stale.reason, NOOP_REASONS.foreign_turn);
  assert.deepEqual(h.snapshot(), before, 'el turno abierto cambió');
  assert.equal(h.openTurn.id, current.id);

  const accepted = h.deliver(current, (effect) => {
    effect.emit({ type: 'text_output', key: 'k', turn: current.id });
  });
  assert.equal(accepted.accepted, true);
  assert.notDeepEqual(h.snapshot(), before);
});

// C-002-05
test('C-002-05 un resultado con otro token es no-op', () => {
  const h = createHarness();
  const turn = h.open('listening');
  const foreign = Object.freeze({
    id: turn.id,
    token: turn.token + '-ajeno',
    expectedState: turn.expectedState,
  });
  const before = h.snapshot();

  const decision = h.deliver(foreign, (effect) => {
    effect.state('thinking');
    effect.value('weight', 70);
    effect.emit({ type: 'value_confirmed', fieldId: 'weight', value: 70 });
  });

  assert.equal(decision.accepted, false);
  assert.equal(decision.reason, NOOP_REASONS.token_mismatch);
  assert.deepEqual(h.snapshot(), before, 'el no-op tocó el observable');

  const accepted = h.deliver(turn, (effect) => {
    effect.state('thinking');
  });
  assert.equal(accepted.accepted, true);
  assert.notDeepEqual(h.snapshot(), before);
});

// C-002-06
test('C-002-06 un expectedState que dejó de cumplirse es no-op', () => {
  const h = createHarness();
  const turn = h.open('listening');
  h.submitText();
  assert.equal(h.state, 'thinking');
  const before = h.snapshot();

  const decision = h.deliver(turn, (effect) => {
    effect.value('weight', 70);
    effect.emit({ type: 'value_confirmed', fieldId: 'weight', value: 70 });
  });

  assert.equal(decision.accepted, false);
  assert.equal(decision.reason, NOOP_REASONS.expected_state_mismatch);
  assert.deepEqual(h.snapshot(), before, 'el no-op tocó el observable');
  assert.equal(h.openTurn.id, turn.id);

  // Control positivo: con el estado que el turno espera, sí se acepta.
  assert.equal(h.discipline.resolve(turn), true);
  const another = h.open('thinking');
  const afterOpen = h.snapshot();
  const accepted = h.deliver(another, (effect) => {
    effect.value('weight', 70);
  });
  assert.equal(accepted.accepted, true);
  assert.notDeepEqual(h.snapshot(), afterOpen);
});

// C-002-07
test('C-002-07 el segundo onNoSpeech del mismo turno es no-op', () => {
  const h = createHarness();
  const turn = h.open('listening');
  const before = h.snapshot();

  const first = h.deliver(turn, (effect) => {
    effect.state('speaking');
    effect.emit({ type: 'failure', code: 'no_speech', turn: turn.id });
  }, { terminal: true });

  assert.equal(first.accepted, true);
  const afterFirst = h.snapshot();
  assert.notDeepEqual(afterFirst, before);
  assert.equal(afterFirst.events.length, before.events.length + 1);

  const second = h.deliver(turn, (effect) => {
    effect.state('idle');
    effect.value('weight', 0); // el silencio nunca es valor cero
    effect.emit({ type: 'failure', code: 'no_speech', turn: turn.id });
  }, { terminal: true });

  assert.equal(second.accepted, false);
  assert.equal(second.reason, NOOP_REASONS.turn_resolved);
  assert.deepEqual(h.snapshot(), afterFirst, 'el no-op tocó el observable');
});

// C-002-08
test('C-002-08 onPartial se acepta mientras el turno siga abierto', () => {
  const h = createHarness();
  const turn = h.open('listening');
  const partials = ['700', '70', '70 kilos'];
  const decisions = partials.map((text) => h.deliver(turn, (effect) => {
    effect.emit({ type: 'partial', text, turn: turn.id });
  }));

  for (const decision of decisions) {
    assert.equal(decision.accepted, true);
  }
  assert.equal(h.events.length, partials.length);
  assert.equal(h.openTurn.id, turn.id);

  // Cerrar el turno corta la aceptación: lo que llega después es no-op.
  assert.equal(h.discipline.resolve(turn), true);
  const before = h.snapshot();
  const late = h.deliver(turn, (effect) => {
    effect.emit({ type: 'partial', text: '70 kilos', turn: turn.id });
  });
  assert.equal(late.accepted, false);
  assert.deepEqual(h.snapshot(), before);
});

// C-002-09
test('C-002-09 un onError posterior al cierre no abre un turno nuevo', () => {
  const h = createHarness();
  const turn = h.open('listening');
  assert.equal(h.discipline.resolve(turn), true);
  const before = h.snapshot();

  const decision = h.deliver(turn, (effect) => {
    effect.state('error');
    effect.emit({
      type: 'failure', code: 'recognition_failed', turn: turn.id,
    });
  }, { terminal: true });

  assert.equal(decision.accepted, false);
  assert.equal(h.discipline.openTurn, null);
  assert.deepEqual(h.snapshot(), before, 'el no-op tocó el observable');

  // El no-op no consumió identificador: el siguiente turno es el inmediato.
  const next = h.open('listening');
  assert.equal(next.id, turn.id + 1);
});

// C-002-10
test('C-002-10 la petición lleva turn, budgetMs y signal que aborta', () => {
  const h = createHarness();
  const turn = h.open('listening');
  const received = [];
  h.invoke((request) => {
    received.push(request);
    return new Promise(() => {});
  });

  assert.equal(received.length, 1);
  const request = received[0];
  assert.equal(request.turn, turn);
  assert.equal(request.budgetMs, TURN_BUDGET_MS);
  assert.ok(request.signal instanceof AbortSignal);
  assert.equal(request.signal.aborted, false);
  assert.deepEqual(
    Object.keys(request).sort(),
    ['budgetMs', 'signal', 'turn'],
    'la petición lleva algo más que turn, budgetMs y signal',
  );

  assert.equal(h.mute(), true);
  assert.equal(request.signal.aborted, true);
});

// C-002-11
test('C-002-11 el presupuesto agotado es fallo explícito, nunca éxito', () => {
  const h = createHarness();
  const turn = h.open('listening');
  h.invoke(() => new Promise(() => {}));

  h.clock.advance(TURN_BUDGET_MS);

  const failures = h.events.filter((event) => event.type === 'failure');
  assert.equal(failures.length, 1);
  assert.equal(failures[0].code, PORT_BUDGET_EXHAUSTED);
  assert.equal(h.clock.pending(), 0, 'quedó un vigilante armado');

  // Ninguna transición de éxito: ni valor, ni guardado, ni vuelta a escuchar.
  assert.equal(h.events.some((e) => e.type === 'value_confirmed'), false);
  assert.equal(
    h.events.some((e) => e.type === 'state_changed'),
    false,
  );
  assert.equal(h.discipline.openTurn, null);

  // Un resultado que llegue después no se acepta: no hay éxito inferido.
  const before = h.snapshot();
  const late = h.deliver(turn, (effect) => {
    effect.value('weight', 70);
    effect.emit({ type: 'value_confirmed', fieldId: 'weight', value: 70 });
  });
  assert.equal(late.accepted, false);
  assert.deepEqual(h.snapshot(), before, 'el no-op tocó el observable');
});

// C-002-12
test('C-002-12 tardíos, cancelados y ajenos dejan el estado idéntico', () => {
  const h = createHarness();
  const resolvedTurn = h.open('listening');
  assert.equal(h.discipline.resolve(resolvedTurn), true);
  const cancelledTurn = h.open('listening');
  assert.equal(h.mute(), true);
  const openTurn = h.open('listening');
  const foreign = Object.freeze({
    id: 999,
    token: 'ajeno:999',
    expectedState: 'listening',
  });
  const mutate = (effect) => {
    effect.state('error');
    effect.value('weight', 90);
    effect.emit({ type: 'value_confirmed', fieldId: 'weight', value: 90 });
  };

  const before = h.snapshot();
  const injections = [
    h.deliver(resolvedTurn, mutate),
    h.deliver(cancelledTurn, mutate),
    h.deliver(foreign, mutate),
    h.deliver(
      Object.freeze({ ...openTurn, token: openTurn.token + '-x' }),
      mutate,
    ),
  ];

  for (const decision of injections) {
    assert.equal(decision.accepted, false);
  }
  assert.deepEqual(h.snapshot(), before, 'una inyección tocó el observable');

  // Control positivo: el turno abierto sigue aceptando lo legítimo.
  const accepted = h.deliver(openTurn, (effect) => {
    effect.state('thinking');
    effect.emit({ type: 'text_output', turn: openTurn.id });
  });
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.reason, ACCEPTED);
  assert.notDeepEqual(h.snapshot(), before);
});

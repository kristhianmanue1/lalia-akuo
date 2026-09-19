// Disciplina de turno (SPEC-002).
//
// Módulo hoja y puro: no importa nada del paquete y no lee el reloj ni el
// azar. El tiempo entra por un planificador inyectado —`schedule` y
// `cancelSchedule`— y los identificadores por `createTurnSequence`, que es
// determinista. Un módulo que consulta el reloj por dentro no se puede
// probar; éste no lo consulta.
//
// La regla, en una línea: un resultado cuenta sólo si su etiqueta es la del
// turno abierto, el turno no está cerrado y la sesión sigue en el estado que
// la etiqueta esperaba. Cualquier otra combinación es no-op —ni estado, ni
// evento, ni valor—: no se adjudica «lo más parecido».
//
// `decide` decide, no aplica. Es de sólo lectura respecto de lo observable:
// devuelve la decisión y el consumidor la respeta o la ignora. La única
// escritura interna que hace al aceptar es cerrar el turno cuando el
// resultado es terminal, porque «onNoSpeech y onError resuelven el turno» es
// parte de esta disciplina y no puede quedar a la memoria del consumidor.

export const ACCEPTED = 'accepted';

// Razones de no-op. No son códigos de error: el no-op no es un fallo, es un
// resultado que no cuenta. Sirven para el rastro del consumidor.
export const NOOP_REASONS = Object.freeze({
  no_open_turn: 'no_open_turn',
  foreign_turn: 'foreign_turn',
  token_mismatch: 'token_mismatch',
  expected_state_mismatch: 'expected_state_mismatch',
  turn_resolved: 'turn_resolved',
  turn_cancelled: 'turn_cancelled',
});

// Código del fallo explícito por agotamiento del presupuesto (SPEC-004).
export const PORT_BUDGET_EXHAUSTED = 'port_budget_exhausted';

export class TurnError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TurnError';
  }
}

// Contador determinista de turnos de una sesión. `id` es monotónico: no se
// reutiliza, no se reinicia y no salta hacia atrás. `token` es opaco, único
// en la sesión y lo elige el núcleo; el consumidor no lo interpreta.
export function createTurnSequence(options = {}) {
  const sessionId = options.sessionId === undefined
    ? 'session'
    : options.sessionId;
  if (typeof sessionId !== 'string' || sessionId === '') {
    throw new TurnError(
      'createTurnSequence espera un sessionId de texto no vacío.',
    );
  }
  let lastId = 0;
  return Object.freeze({
    next(expectedState) {
      if (typeof expectedState !== 'string' || expectedState === '') {
        throw new TurnError('El turno exige un expectedState no vacío.');
      }
      lastId += 1;
      return Object.freeze({
        id: lastId,
        token: sessionId + ':' + lastId,
        expectedState,
      });
    },
  });
}

// Disciplina de turno de UNA sesión.
//
// Opciones:
//   sequence          secuencia de turnos; por omisión, `createTurnSequence`.
//   schedule          `(fn, ms) => handle`. Obligatoria para `request`: el
//                     vigilante del presupuesto lo arma este módulo, pero el
//                     tiempo lo pone quien lo inyecta.
//   cancelSchedule    `(handle) => void`. Obligatoria junto a `schedule`.
//   onBudgetExhausted `({ code, turn, request }) => void`. Se llama cuando el
//                     presupuesto se agota; el turno ya quedó descartado.
export function createTurnDiscipline(options = {}) {
  const sequence = options.sequence === undefined
    ? createTurnSequence()
    : options.sequence;
  if (!sequence || typeof sequence.next !== 'function') {
    throw new TurnError(
      'La disciplina espera una secuencia de turnos con next().',
    );
  }
  const schedule = typeof options.schedule === 'function'
    ? options.schedule
    : null;
  const cancelSchedule = typeof options.cancelSchedule === 'function'
    ? options.cancelSchedule
    : null;
  const onBudgetExhausted = typeof options.onBudgetExhausted === 'function'
    ? options.onBudgetExhausted
    : null;

  let currentTurn = null; // último turno abierto, cerrado o cancelado
  let status = 'idle'; // idle | open | resolved | cancelled | budget_exhausted
  let controller = null; // AbortController del turno vigente
  let watchdog = null; // manejador del planificador inyectado

  function clearWatchdog() {
    if (watchdog !== null && cancelSchedule !== null) {
      cancelSchedule(watchdog);
    }
    watchdog = null;
  }

  function close(nextStatus) {
    clearWatchdog();
    status = nextStatus;
  }

  function isCurrent(turn) {
    return status === 'open'
      && currentTurn !== null
      && Boolean(turn)
      && turn.id === currentTurn.id
      && turn.token === currentTurn.token;
  }

  function noop(reason) {
    return Object.freeze({ accepted: false, reason });
  }

  // Abre un turno. No admite uno abierto: un turno se cierra por señal real
  // antes de que el siguiente nazca (SPEC-002), nunca se solapa.
  function open(expectedState) {
    if (status === 'open') {
      throw new TurnError(
        'Ya hay un turno abierto: ciérralo antes de abrir el siguiente.',
      );
    }
    clearWatchdog();
    currentTurn = sequence.next(expectedState);
    controller = new AbortController();
    status = 'open';
    return currentTurn;
  }

  // Arma el vigilante y devuelve `request = { turn, budgetMs, signal }`. El
  // núcleo puede entregar el mismo objeto a varias invocaciones (SPEC-004);
  // abrir una petición nueva sustituye el vigilante de la anterior, porque
  // sólo hay una invocación en vuelo por turno.
  function request(turn, budgetMs) {
    if (!isCurrent(turn)) {
      throw new TurnError(
        'La petición sólo se abre para el turno vigente.',
      );
    }
    if (!Number.isInteger(budgetMs) || budgetMs <= 0) {
      throw new TurnError('budgetMs debe ser un entero positivo.');
    }
    if (schedule === null || cancelSchedule === null) {
      throw new TurnError(
        'La disciplina no lee el reloj: para vigilar budgetMs necesita ' +
        '`schedule` y `cancelSchedule` inyectados.',
      );
    }
    clearWatchdog();
    const pending = Object.freeze({
      turn: currentTurn,
      budgetMs,
      signal: controller.signal,
    });
    const watched = currentTurn;
    watchdog = schedule(function () {
      watchdog = null;
      if (status !== 'open' || currentTurn !== watched) {
        return; // el turno ya se cerró: el aviso llega tarde
      }
      expireBudget(watched, pending);
    }, budgetMs);
    return pending;
  }

  // El agotamiento del presupuesto es un fallo explícito: descarta el turno
  // y avisa. Nunca se convierte en resultado aceptado.
  function expireBudget(turn, pending) {
    close('budget_exhausted');
    if (onBudgetExhausted !== null) {
      onBudgetExhausted(Object.freeze({
        code: PORT_BUDGET_EXHAUSTED,
        turn: turn,
        request: pending,
      }));
    }
  }

  // Decide si un resultado entrante cuenta. La comparación es la conjunción
  // de SPEC-002: `id`, `token`, el `expectedState` de la etiqueta contra el
  // estado de la sesión, y que el turno no esté resuelto ni cancelado. El
  // orden de las comprobaciones no cambia el veredicto —la conjunción es
  // simétrica—, sólo elige la razón más precisa.
  function decide(label, state, flags = {}) {
    if (currentTurn === null) {
      return noop(NOOP_REASONS.no_open_turn);
    }
    if (!label || typeof label !== 'object'
        || label.id !== currentTurn.id) {
      return noop(NOOP_REASONS.foreign_turn);
    }
    if (label.token !== currentTurn.token) {
      return noop(NOOP_REASONS.token_mismatch);
    }
    if (status === 'cancelled' || controller.signal.aborted) {
      return noop(NOOP_REASONS.turn_cancelled);
    }
    if (status !== 'open') {
      return noop(NOOP_REASONS.turn_resolved);
    }
    if (state !== label.expectedState) {
      return noop(NOOP_REASONS.expected_state_mismatch);
    }
    if (flags.terminal === true) {
      close('resolved');
    }
    return Object.freeze({ accepted: true, reason: ACCEPTED });
  }

  // Cierra el turno vigente. Devuelve `false` si ya estaba cerrado, si es
  // ajeno o si no hay ninguno: cerrar dos veces no es un efecto.
  function resolve(turn) {
    if (!isCurrent(turn)) {
      return false;
    }
    close('resolved');
    return true;
  }

  // Cancela el turno vigente: pasa `signal` a abortado Y llama a `cancel()`
  // del puerto en vuelo, que es lo que SPEC-004 exige de las dos cosas.
  // Idempotente: la segunda llamada no vuelve a tocar el puerto.
  function cancel(turn, port = null) {
    if (!isCurrent(turn)) {
      return false;
    }
    clearWatchdog();
    status = 'cancelled';
    controller.abort();
    if (port !== null && typeof port.cancel === 'function') {
      port.cancel();
    }
    return true;
  }

  return Object.freeze({
    open,
    request,
    decide,
    resolve,
    cancel,
    get openTurn() {
      return status === 'open' ? currentTurn : null;
    },
  });
}

// Pruebas del adaptador de motor de voz — SPEC-011.
//
// Cada caso se construye con un doble del motor y un reloj falso: ningún
// temporizador real decide nada (receta R4 del contrato de consumo). Los
// identificadores C-011-* citan el caso de la spec que cada prueba cubre;
// la prueba de trazabilidad cruza esta lista con docs/estado.md §2.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeClock } from './helpers/session-harness.js';
import {
  createWebSpeechAdapter, PATCHES, ADAPTER_CAPABILITIES,
} from '../src/adapter/index.js';
import { ConfigError } from '../src/index.js';

const VOZ_ES = { voiceURI: 'es-mx-1', lang: 'es-MX', name: 'Español (México)' };

// Doble del motor: graba lo que el adaptador hace y expone emisores
// manuales para los eventos del navegador.
function makeEngine(overrides = {}) {
  const synthesis = {
    voices: overrides.voices !== undefined ? overrides.voices : [VOZ_ES],
    paused: !!overrides.paused,
    resumed: false,
    cancelled: 0,
    speakCalls: [],
    last: null,
    listeners: {},
    getVoices() { return this.voices.slice(); },
    speak(u) {
      // P-02: el motor sólo dispara los terminales de una utterance que
      // llegó preparada (lang y handlers asignados antes de speak) y que
      // alguien retiene: sin preparación no hay evento, y la locución
      // queda en vuelo hasta el vigilante.
      this.speakCalls.push({
        utterance: u,
        hadEnd: typeof u.onend === 'function',
        hadError: typeof u.onerror === 'function',
        hadLang: typeof u.lang === 'string' && u.lang !== '',
      });
      this.last = u;
    },
    cancel() { this.cancelled += 1; },
    resume() { this.resumed = true; this.paused = false; },
    addEventListener(name, fn) {
      (this.listeners[name] = this.listeners[name] || []).push(fn);
    },
    removeEventListener(name, fn) {
      this.listeners[name] = (this.listeners[name] || []).filter((f) => f !== fn);
    },
    emitVoicesChanged() {
      for (const fn of this.listeners.voiceschanged || []) fn();
    },
    // Entrega condicionada: exige preparación completa (P-02) y, si la
    // cola nació en pausa, que se haya reanudado (P-06).
    emitEnd() {
      const call = this.speakCalls[this.speakCalls.length - 1];
      if (!call || !call.hadEnd || !call.hadLang) return false;
      if (overrides.paused && !this.resumed) return false;
      call.utterance.onend();
      return true;
    },
    emitError() {
      const call = this.speakCalls[this.speakCalls.length - 1];
      if (!call || !call.hadError) return false;
      call.utterance.onerror({ error: 'not-allowed' });
      return true;
    },
  };
  class Utterance {
    constructor(text) { this.text = text; }
  }
  const instances = [];
  class Recognition {
    constructor() {
      this.lang = null; this.continuous = null;
      this.interimResults = null; this.maxAlternatives = null;
      this.started = 0; this.active = false; this.aborted = false;
      instances.push(this);
    }
    start() {
      if (this.active) throw new Error('already-started');   // P-08
      this.active = true; this.started += 1;
    }
    abort() { this.aborted = true; this.active = false; }
    stop() { this.active = false; }
  }
  return {
    synthesis, Utterance, Recognition, instances,
    userAgent: overrides.userAgent || 'test-agent',
    active() {
      for (let i = instances.length - 1; i >= 0; i--) {
        if (!instances[i].aborted) return instances[i];
      }
      return instances[instances.length - 1];
    },
    emitResult(index, transcript, isFinal, confidence) {
      const item = { isFinal, 0: { transcript, confidence } };
      const rec = this.active();
      if (rec && rec.onresult) {
        rec.onresult({ resultIndex: index, results: [item], length: 1 });
      }
    },
    emitRecognitionError(code) {
      const rec = this.active();
      if (rec && rec.onerror) rec.onerror({ error: code });
    },
    emitRecognitionEnd() {
      const rec = this.active();
      if (rec && rec.onend) rec.onend();
    },
  };
}

function armar(engine, clock) {
  return createWebSpeechAdapter(engine, {
    schedule: clock.schedule, cancelSchedule: clock.cancel,
  }, { language: 'es-MX' });
}

function request(budgetMs = 20000) {
  const controller = new AbortController();
  return {
    controller,
    request: {
      turn: { id: 1, token: 't1', expectedState: 'listening' },
      budgetMs,
      signal: controller.signal,
    },
  };
}

function pendiente(promise) {
  return Promise.race([
    promise.then(() => 'resolved', () => 'rejected'),
    Promise.resolve().then(() => 'pending'),   // un microtask de desventaja:
  ]);                                            // si ya resolvió, se ve
}

test('C-011-01 say resuelve done/error/watchdog y sólo el terminal real es done', async () => {
  const clock = fakeClock();
  const engine = makeEngine();
  const { speaker } = armar(engine, clock);
  const { request: req } = request();
  const promesa = speaker.say('hola', req);
  assert.equal(engine.synthesis.speakCalls.length, 1);
  engine.synthesis.emitEnd();                      // el terminal real, y sólo él
  assert.equal(await promesa, 'done');
  const segunda = speaker.say('hola', request().request);
  engine.synthesis.emitError();
  assert.equal(await segunda, 'error');          // declarado, sin rechazo
  const roto = makeEngine();                     // motor que lanza al construir:
  roto.Utterance = class { constructor() { throw new Error('constructor-roto'); } };
  const { speaker: speakerRoto } = armar(roto, fakeClock());
  assert.equal(await speakerRoto.say('hola', request().request), 'error');
  const hostil = makeEngine({ voices: [] });     // y suscripción hostil:
  const clockH = fakeClock();
  hostil.synthesis.addEventListener = () => { throw new Error('hostil'); };
  const { speaker: speakerH } = armar(hostil, clockH);
  assert.equal(await speakerH.say('hola', request(20000).request), 'error');
  assert.equal(clockH.pending(), 0);             // sin vigilante huérfano
});

test('C-011-02 sin terminal y con voz, el presupuesto agotado es watchdog', async () => {
  const clock = fakeClock();
  const engine = makeEngine();                    // nunca emite terminal
  const { speaker } = armar(engine, clock);
  const { request: req } = request(20000);
  const promesa = speaker.say('hola', req);
  clock.advance(20000);
  assert.equal(await promesa, 'watchdog');        // nunca done por tiempo
});

test('C-011-03 el silencio es no_speech y el error de motor recognition_failed', async () => {
  const clock = fakeClock();
  const engine = makeEngine();
  const { listener } = armar(engine, clock);
  const primera = request();
  const silencio = listener.listen(primera.request, {});
  engine.emitRecognitionEnd();                    // end sin resultado…
  clock.advance(30000);                           // …y el presupuesto vence
  assert.deepEqual(await silencio, { type: 'no_speech' });
  const segunda = request();
  const fallo = listener.listen(segunda.request, {});
  engine.emitRecognitionError('network');
  assert.deepEqual(await fallo, { type: 'recognition_failed' });
  const roto = makeEngine();                     // motor que lanza al construir:
  roto.Recognition = class { constructor() { throw new Error('roto'); } };
  const { listener: listenerRoto } = armar(roto, clock);
  assert.deepEqual(await listenerRoto.listen(request().request, {}),
    { type: 'recognition_failed' });             // tampoco rechaza
  const congelado = makeEngine();                // y configuración hostil:
  congelado.Recognition = class {
    constructor() {}
    set lang(valor) { throw new Error('setter-lang'); }
  };
  const clockC = fakeClock();
  let efectosC = 0;
  const { listener: listenerC } = armar(congelado, clockC);
  const escuchaC = listenerC.listen(request(30000).request, {
    onNoSpeech: () => { efectosC += 1; },
    onError: () => { efectosC += 1; },
  });
  assert.deepEqual(await escuchaC, { type: 'recognition_failed' });
  clockC.advance(30000);                         // el presupuesto vence después
  assert.equal(efectosC, 0);                     // sin anuncios tras resolver
  assert.equal(clockC.pending(), 0);             // ni vigilante vivo
});

test('C-011-04 voces que llegan tarde por voiceschanged se esperan (P-01)', async () => {
  const clock = fakeClock();
  const engine = makeEngine({ voices: [] });      // getVoices vacío al inicio
  const { speaker } = armar(engine, clock);
  const { request: req } = request(20000);
  const promesa = speaker.say('hola', req);
  assert.equal(engine.synthesis.speakCalls.length, 0);   // espera la voz
  engine.synthesis.voices = [VOZ_ES];
  engine.synthesis.emitVoicesChanged();           // dentro del presupuesto
  assert.equal(engine.synthesis.speakCalls.length, 1);
  assert.equal(engine.synthesis.last.voice, VOZ_ES);
  engine.synthesis.emitEnd();
  assert.equal(await promesa, 'done');
});

test('C-011-05 el motor sólo cierra utterances preparadas y retenidas (P-02)', async () => {
  const clock = fakeClock();
  const engine = makeEngine();
  const { speaker } = armar(engine, clock);
  const { request: req } = request(20000);
  const promesa = speaker.say('hola', req);
  const call = engine.synthesis.speakCalls[0];
  assert.ok(call.hadEnd && call.hadError && call.hadLang, 'llegó preparada');
  assert.equal(engine.synthesis.emitEnd(), true); // retenida: el terminal llega
  assert.equal(await promesa, 'done');
});

test('C-011-06 el terminal de una locución cancelada no cierra la siguiente (P-03)', async () => {
  const clock = fakeClock();
  const engine = makeEngine();
  const { speaker } = armar(engine, clock);
  const primera = speaker.say('una', request().request);
  speaker.cancel();                               // cancela la primera
  const segunda = speaker.say('dos', request().request);
  const cancelada = engine.synthesis.speakCalls[0].utterance;
  cancelada.onend();                              // terminal tardío de la cancelada
  assert.equal(await pendiente(primera), 'pending');   // no la cerró a ella…
  assert.equal(await pendiente(segunda), 'pending');   // …ni a la vigente
  engine.synthesis.emitEnd();
  assert.equal(await segunda, 'done');            // la vigente cierra sola
  // Y una locución desplazada sin cancel tampoco habla con voces tardías:
  const clockD = fakeClock();
  const engineD = makeEngine({ voices: [] });
  const { speaker: speakerD } = armar(engineD, clockD);
  speakerD.say('primera', request().request);     // espera voces…
  speakerD.say('segunda', request().request);     // …y queda desplazada
  engineD.synthesis.voices = [VOZ_ES];
  engineD.synthesis.emitVoicesChanged();
  assert.equal(engineD.synthesis.speakCalls.length, 1);
  assert.equal(engineD.synthesis.last.text, 'segunda');  // sólo la vigente
});

test('C-011-07 el segundo evento terminal de la misma locución es no-op (P-04)', async () => {
  const clock = fakeClock();
  const engine = makeEngine();
  const { speaker } = armar(engine, clock);
  const { request: req } = request(20000);
  const promesa = speaker.say('hola', req);
  engine.synthesis.emitEnd();
  assert.equal(await promesa, 'done');
  assert.doesNotThrow(() => engine.synthesis.emitEnd());  // duplicado: no-op
  assert.equal(clock.pending(), 0);                // sin timers huérfanos
});

test('C-011-08 locución sin activación resuelve error en el acto, nunca watchdog (P-05)', async () => {
  const clock = fakeClock();
  const engine = makeEngine();
  const { speaker } = armar(engine, clock);
  const { request: req } = request(20000);
  const promesa = speaker.say('hola', req);
  engine.synthesis.emitError();                    // not-allowed, inmediato
  assert.equal(await promesa, 'error');            // en el acto…
  assert.equal(clock.pending(), 0);                // …sin esperar el reloj
});

test('C-011-09 la cola de síntesis nacida en pausa se reanuda (P-06)', async () => {
  const clock = fakeClock();
  const engine = makeEngine({ paused: true });
  const { speaker } = armar(engine, clock);
  const { request: req } = request(20000);
  const promesa = speaker.say('hola', req);
  assert.equal(engine.synthesis.resumed, true);    // reanudó antes de hablar
  assert.ok(engine.synthesis.emitEnd());           // sin pausa ya entrega
  assert.equal(await promesa, 'done');
});

test('C-011-10 la escucha cortada con el turno abierto se re-escucha (P-07)', async () => {
  const clock = fakeClock();
  const engine = makeEngine();
  const { listener } = armar(engine, clock);
  const { request: req } = request(30000);
  const promesa = listener.listen(req, {});
  assert.equal(engine.instances.length, 1);
  engine.emitRecognitionEnd();                     // el motor corta el tramo
  assert.equal(engine.instances.length, 2);        // re-escucha: nueva instancia
  assert.equal(engine.instances[0].aborted, true);
  assert.equal(await pendiente(promesa), 'pending');   // no cerró el turno
  engine.emitResult(0, 'cuarenta y dos', true, 0.9);
  assert.deepEqual(await promesa, {
    type: 'speech', text: 'cuarenta y dos', confidence: 0.9,
  });
});

test('C-011-11 la segunda escucha arranca sin lanzar sobre la activa (P-08)', async () => {
  const clock = fakeClock();
  const engine = makeEngine();
  const { listener } = armar(engine, clock);
  const primera = listener.listen(request(30000).request, {});
  assert.equal(engine.instances.length, 1);
  assert.equal(engine.instances[0].active, true);
  let lanzo = false;
  try {
    const segunda = listener.listen(request(30000).request, {});
    lanzo = true;                                 // instancia nueva por escucha
    clock.advance(30000);                         // vence el presupuesto
    assert.equal(await pendiente(primera), 'pending');  // la desplazada calla
    assert.deepEqual(await segunda, { type: 'no_speech' });  // la vigente, por su reloj
  } finally {
    assert.ok(lanzo, 'la segunda escucha no lanzó');
  }
  assert.equal(engine.instances[1].started, 1);
});

test('C-011-12 el error de aborto tras una cancelación propia no es error (P-09)', async () => {
  const clock = fakeClock();
  const engine = makeEngine();
  const { listener } = armar(engine, clock);
  let errores = 0;
  const promesa = listener.listen(request(30000).request, {
    onError: () => { errores += 1; },
  });
  listener.cancel();                               // cancelación propia
  engine.emitRecognitionError('aborted');          // error de aborto del motor
  assert.equal(errores, 0);                        // no se reporta
  assert.equal(await pendiente(promesa), 'pending');
});

test('C-011-13 el fin de escucha sin habla resuelve no_speech, nunca cero (P-10)', async () => {
  const clock = fakeClock();
  const engine = makeEngine();
  const { listener } = armar(engine, clock);
  let silencios = 0;
  const { request: req } = request(30000);
  const promesa = listener.listen(req, { onNoSpeech: () => { silencios += 1; } });
  engine.emitRecognitionEnd();                     // termina sin resultado
  clock.advance(30000);                            // y el presupuesto vence
  const resultado = await promesa;
  assert.deepEqual(resultado, { type: 'no_speech' });
  assert.equal(resultado.text, undefined);         // nunca un valor cero
  assert.equal(silencios, 1);
});

test('C-011-14 el resultado final reemitido se entrega una sola vez (P-11)', async () => {
  const clock = fakeClock();
  const engine = makeEngine();
  const { listener } = armar(engine, clock);
  const { request: req } = request(30000);
  const promesa = listener.listen(req, {});
  engine.emitResult(0, 'cuarenta y dos', true, 0.9);
  assert.deepEqual(await promesa, {
    type: 'speech', text: 'cuarenta y dos', confidence: 0.9,
  });
  engine.emitResult(0, 'cuarenta y dos', true, 0.9);   // duplicado de Blink
  assert.equal(engine.instances[0].aborted, true);     // y ni error ni entrega doble
});

test('C-011-15 los interinos llegan a onPartial con interimResults declarado (P-12)', async () => {
  const clock = fakeClock();
  const engine = makeEngine();
  const { listener } = armar(engine, clock);
  const parciales = [];
  const { request: req } = request(30000);
  const promesa = listener.listen(req, {
    onPartial: (texto) => { parciales.push(texto); },
  });
  assert.equal(engine.instances[0].interimResults, true);  // declarados
  engine.emitResult(0, 'cua', false, 0.4);
  engine.emitResult(0, 'cuarenta', false, 0.5);
  engine.emitResult(0, 'cuarenta', false, 0.5);   // parcial repetido: no duplica
  engine.emitResult(0, 'cuarenta y dos', true, 0.9);
  assert.deepEqual(await promesa, {
    type: 'speech', text: 'cuarenta y dos', confidence: 0.9,
  });
  assert.deepEqual(parciales, ['cua', 'cuarenta']);        // cada uno, una vez
});

test('C-011-16 sin ninguna voz del idioma declarado, error y nunca silencio (P-13)', async () => {
  const clock = fakeClock();
  const engine = makeEngine({
    voices: [{ voiceURI: 'en-us', lang: 'en-US', name: 'English' }],
  });
  const { speaker } = armar(engine, clock);
  const { request: req } = request(20000);
  const promesa = speaker.say('hola', req);
  assert.equal(engine.synthesis.speakCalls.length, 0);   // no habló sin voz
  assert.equal(await promesa, 'error');                  // declarado, en el acto
  assert.equal(clock.pending(), 0);
});

test('C-011-17 el permiso de micrófono denegado mapea a recognition_failed (P-14)', async () => {
  const clock = fakeClock();
  const engine = makeEngine();
  const { listener } = armar(engine, clock);
  let errores = 0;
  const { request: req } = request(30000);
  const promesa = listener.listen(req, {
    onError: () => { errores += 1; },
  });
  engine.emitRecognitionError('not-allowed');
  assert.deepEqual(await promesa, { type: 'recognition_failed' });
  assert.equal(errores, 1);                       // salida declarada, nunca éxito
});

test('C-011-18 tras cancel() ningún evento posterior del motor produce efecto', async () => {
  const clock = fakeClock();
  const engine = makeEngine();
  const { speaker, listener } = armar(engine, clock);
  const hablando = speaker.say('hola', request(20000).request);
  const { controller, request: req } = request(30000);
  let efectos = 0;
  const escuchando = listener.listen(req, {
    onPartial: () => { efectos += 1; },
    onNoSpeech: () => { efectos += 1; },
    onError: () => { efectos += 1; },
  });
  controller.abort();                             // el núcleo aborta la señal…
  speaker.cancel();                               // …y cancela ambos puertos
  listener.cancel();
  engine.synthesis.emitEnd();                     // eventos tardíos del motor
  engine.emitResult(0, 'eco', true, 0.9);
  engine.emitRecognitionError('network');
  assert.equal(await pendiente(hablando), 'pending');
  assert.equal(await pendiente(escuchando), 'pending');
  assert.equal(efectos, 0);                       // ninguno con efecto
  // Y la señal abortada sin cancel(): el vigilante tampoco resuelve ni anuncia
  const { controller: c2, request: r2 } = request(30000);
  let efectos2 = 0;
  const escucha2 = listener.listen(r2, {
    onPartial: () => { efectos2 += 1; },
    onNoSpeech: () => { efectos2 += 1; },
    onError: () => { efectos2 += 1; },
  });
  c2.abort();
  clock.advance(30000);
  assert.equal(await pendiente(escucha2), 'pending');
  assert.equal(efectos2, 0);                      // nada tras la cancelación
  // Señal YA abortada al entrar: la petición nace muerta (R2b/R2c)
  const muerta = request(30000);
  muerta.controller.abort();
  let efectosM = 0;
  const escuchaM = listener.listen(muerta.request, {
    onPartial: () => { efectosM += 1; },
    onNoSpeech: () => { efectosM += 1; },
    onError: () => { efectosM += 1; },
  });
  clock.advance(30000);
  assert.equal(await pendiente(escuchaM), 'pending');
  assert.equal(efectosM, 0);                      // ni arranca ni anuncia
  // Y una escucha muerta que desplaza a una viva aborta su instancia
  const engineD = makeEngine();
  const { listener: listenerD } = armar(engineD, clock);
  const viva = listenerD.listen(request(30000).request, {});
  const muertaD = request(30000);
  muertaD.controller.abort();
  listenerD.listen(muertaD.request, {});
  assert.equal(engineD.instances.length, 1);      // la muerta no creó ninguna
  assert.equal(engineD.instances[0].aborted, true);  // la viva quedó abortada
  assert.equal(await pendiente(viva), 'pending'); // y sin resolver
  // Callback hostil: resuelve antes de anunciar, el throw no la cuelga
  const hostilCb = request(30000);
  const escuchaHostil = listener.listen(hostilCb.request, {
    onError: () => { throw new Error('callback hostil'); },
  });
  assert.throws(() => engine.emitRecognitionError('network'), /callback hostil/);
  assert.deepEqual(await escuchaHostil, { type: 'recognition_failed' });
});

test('C-011-19 PATCHES declara id, engine, symptom, trigger y test por entrada', () => {
  const casosVistos = new Set();
  const sintomas = new Set();
  for (const parche of PATCHES) {
    for (const campo of ['id', 'engine', 'symptom', 'trigger', 'test']) {
      assert.equal(typeof parche[campo], 'string', parche.id + '.' + campo);
      assert.notEqual(parche[campo], '', parche.id + '.' + campo);
    }
    assert.match(parche.test, /^C-011-(0[4-9]|1[0-7])$/, parche.id + '.test');
    assert.ok(!casosVistos.has(parche.test), 'caso repetido: ' + parche.test);
    casosVistos.add(parche.test);
    const clave = parche.engine + '|' + parche.symptom;
    assert.ok(!sintomas.has(clave), 'síntoma repetido: ' + clave);
    sintomas.add(clave);
  }
  assert.equal(PATCHES.length, 14);
});

test('C-011-20 misma capacidad y distinto user-agent: comportamiento idéntico', async () => {
  const resultados = [];
  for (const userAgent of ['Mozilla/5.0 Chrome/120', 'Mozilla/5.0 Safari/605']) {
    const clock = fakeClock();
    const engine = makeEngine({ userAgent });     // misma capacidad, otro UA
    const { speaker } = armar(engine, clock);
    const promesa = speaker.say('hola', request(20000).request);
    engine.synthesis.emitEnd();
    resultados.push(await promesa);
  }
  assert.deepEqual(resultados, ['done', 'done']); // la selección no ve el UA
});

test('C-011-21 ADAPTER_CAPABILITIES declara la polaridad del adaptador', () => {
  assert.deepEqual({ ...ADAPTER_CAPABILITIES }, {
    opensNetwork: true,       // el reconocimiento nativo puede ir a un tercero
    touchesDom: false,
    persists: false,
    writesStorage: false,
    decidesTurns: false,
    selectsPatchesBy: 'capability',
  });
  assert.ok(Object.isFrozen(ADAPTER_CAPABILITIES));
  assert.ok(Object.isFrozen(PATCHES));
});

test('C-011-22 un resultado tardío o de otro turno es no-op para el adaptador', async () => {
  const clock = fakeClock();
  const engine = makeEngine();
  const { speaker, listener } = armar(engine, clock);
  const hablando = speaker.say('hola', request(20000).request);
  engine.synthesis.emitEnd();
  assert.equal(await hablando, 'done');
  assert.doesNotThrow(() => engine.synthesis.emitEnd());  // tardío: no-op
  const { request: req } = request(30000);
  const escuchando = listener.listen(req, {});
  listener.cancel();                                      // la escucha se cancela
  engine.emitResult(0, 'ajeno', true, 0.9);               // resultado de otro turno
  assert.equal(await pendiente(escuchando), 'pending');
});

test('C-011-23 engine sólo toma webkit, blink o both, nunca un navegador', () => {
  for (const parche of PATCHES) {
    assert.ok(['webkit', 'blink', 'both'].includes(parche.engine), parche.id);
    assert.ok(!/chrome|edge|safari/i.test(parche.engine), parche.id);
  }
});

test('C-011-24 sin voz para el idioma, el presupuesto agotado es error, nunca watchdog (P-01, P-13)', async () => {
  const clock = fakeClock();
  const engine = makeEngine({ voices: [] });
  const { speaker } = armar(engine, clock);
  const { request: req } = request(20000);
  const promesa = speaker.say('hola', req);
  clock.advance(20000);                            // voiceschanged nunca llegó
  assert.equal(await promesa, 'error');            // ni done ni watchdog
});

test('C-011-25 runtime malformado se rechaza en cerrado y no crea puertos', () => {
  const engine = makeEngine();
  const clock = fakeClock();
  const reloj = { schedule: clock.schedule, cancelSchedule: clock.cancel };
  const malformed = [
    'no-soy-objeto',
    { schedule: clock.schedule },                        // media pareja
    { schedule: clock.schedule, cancelSchedule: clock.cancel, extra: 1 },
    { schedule: 'no-funcion', cancelSchedule: clock.cancel },
    { schedule: clock.schedule, cancelSchedule: 42 },
  ];
  for (const runtime of malformed) {
    assert.throws(
      () => createWebSpeechAdapter(engine, runtime),
      (error) => error instanceof ConfigError && error.code === 'invalid_config',
      'debe rechazar: ' + JSON.stringify(runtime),
    );
  }
});

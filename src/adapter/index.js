// Adaptador de motor de voz — SPEC-011.
//
// Implementa los puertos `speaker` y `listener` de SPEC-004 sobre la
// superficie de voz del navegador, inyectada como `voiceEngine`; los
// globales del navegador son sólo la omisión, nunca el arranque del
// módulo. No decide turnos (SPEC-002): entrega resultados y el núcleo
// decide si cuentan. Puede abrir red —el reconocimiento nativo puede
// resolver contra un tercero— y lo declara en ADAPTER_CAPABILITIES.
// Los catorce parches obligatorios viven en PATCHES, congelados, con su
// síntoma, su condición de disparo y el caso que los prueba.

import { ConfigError } from '../core/policy.js';

const RUNTIME_KEYS = ['schedule', 'cancelSchedule'];

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(what, why) {
  return new ConfigError('invalid_config', 'adapter.' + what, why);
}

// Validación fail-closed del reloj inyectable, análoga a C-001-19 del
// núcleo: claves cerradas, pareja completa o ausente, y funciones.
function resolveRuntime(runtime) {
  if (!isObject(runtime)) throw invalid('runtime', 'debe ser un objeto');
  for (const key of Object.keys(runtime)) {
    if (!RUNTIME_KEYS.includes(key)) {
      throw invalid('runtime.' + key, 'clave desconocida en runtime');
    }
  }
  if ((runtime.schedule === undefined) !== (runtime.cancelSchedule === undefined)) {
    throw invalid('runtime', 'exige schedule y cancelSchedule en pareja');
  }
  if (runtime.schedule !== undefined && typeof runtime.schedule !== 'function') {
    throw invalid('runtime.schedule', 'debe ser una función');
  }
  if (runtime.cancelSchedule !== undefined && typeof runtime.cancelSchedule !== 'function') {
    throw invalid('runtime.cancelSchedule', 'debe ser una función');
  }
  return {
    schedule: runtime.schedule === undefined
      ? (fn, ms) => globalThis.setTimeout(fn, ms)
      : runtime.schedule,
    cancelSchedule: runtime.cancelSchedule === undefined
      ? (handle) => globalThis.clearTimeout(handle)
      : runtime.cancelSchedule,
  };
}

// La superficie del motor por omisión: los globales del navegador, leídos
// sólo aquí y sólo si el consumidor no inyectó `voiceEngine`.
function defaultEngine() {
  const g = globalThis;
  return {
    synthesis: g.speechSynthesis,
    Utterance: g.SpeechSynthesisUtterance,
    Recognition: g.SpeechRecognition || g.webkitSpeechRecognition,
  };
}

function prefixOf(language) {
  return String(language).trim().toLowerCase().split('-')[0];
}

// P-13: emparejar por prefijo de idioma; sin ninguna voz que empiece por
// el idioma declarado, el fallo es declarado, nunca silencio con éxito.
function pickVoice(voices, prefix, preferredURI) {
  if (!Array.isArray(voices)) return null;
  if (preferredURI !== undefined) {
    const exact = voices.find((v) => v && v.voiceURI === preferredURI);
    if (exact) return exact;
  }
  return voices.find((v) => v && typeof v.lang === 'string'
    && v.lang.toLowerCase().startsWith(prefix)) || null;
}

export const PATCHES = Object.freeze([
  Object.freeze({
    id: 'P-01', engine: 'both', test: 'C-011-04',
    symptom: 'voces no listas: la primera locución no tiene voz que hablar',
    trigger: 'getVoices() vacío en el primer say, o voiceschanged sin observar',
  }),
  Object.freeze({
    id: 'P-02', engine: 'both', test: 'C-011-05',
    symptom: 'la utterance se pierde antes del cierre y no llega el terminal',
    trigger: 'llega a speak sin idioma o sin manejadores, o no está retenida',
  }),
  Object.freeze({
    id: 'P-03', engine: 'both', test: 'C-011-06',
    symptom: 'el cierre de una locución cancelada cierra la siguiente',
    trigger: 'cancel() con una locución en vuelo y el terminal llega tarde',
  }),
  Object.freeze({
    id: 'P-04', engine: 'both', test: 'C-011-07',
    symptom: 'dos eventos terminales para la misma locución',
    trigger: 'el motor dispara el evento terminal más de una vez',
  }),
  Object.freeze({
    id: 'P-05', engine: 'webkit', test: 'C-011-08',
    symptom: 'primera locución sin activación de usuario: no arranca',
    trigger: 'say() sin activación previa en móvil; el motor responde not-allowed',
  }),
  Object.freeze({
    id: 'P-06', engine: 'webkit', test: 'C-011-09',
    symptom: 'síntesis que arranca en pausa: no suena ni cierra',
    trigger: 'la cola de síntesis está en pausa al empezar la locución',
  }),
  Object.freeze({
    id: 'P-07', engine: 'webkit', test: 'C-011-10',
    symptom: 'la escucha termina tras el primer tramo sin cerrar el turno',
    trigger: 'end con el turno abierto y escucha continua no aplicada',
  }),
  Object.freeze({
    id: 'P-08', engine: 'webkit', test: 'C-011-11',
    symptom: 'arrancar el reconocimiento sobre una instancia ya iniciada lanza',
    trigger: 'start() con una instancia ya activa',
  }),
  Object.freeze({
    id: 'P-09', engine: 'webkit', test: 'C-011-12',
    symptom: 'la cancelación propia se reporta como error de reconocimiento',
    trigger: 'abortar con reconocimiento en vuelo y recibir el error de aborto',
  }),
  Object.freeze({
    id: 'P-10', engine: 'webkit', test: 'C-011-13',
    symptom: 'fin de escucha sin habla ni cierre',
    trigger: 'end sin result sin presupuesto para re-escuchar, o presupuesto agotado sin habla',
  }),
  Object.freeze({
    id: 'P-11', engine: 'blink', test: 'C-011-14',
    symptom: 'la misma frase se interpreta dos veces',
    trigger: 'segundo onresult con el mismo índice y resultado final',
  }),
  Object.freeze({
    id: 'P-12', engine: 'blink', test: 'C-011-15',
    symptom: 'las llamadas onPartial no llegan aunque haya interinos',
    trigger: 'la escucha arranca sin resultados interinos declarados',
  }),
  Object.freeze({
    id: 'P-13', engine: 'both', test: 'C-011-16',
    symptom: 'no hay voz para el idioma declarado y la locución no suena',
    trigger: 'ninguna voz del entorno empieza por el idioma declarado',
  }),
  Object.freeze({
    id: 'P-14', engine: 'both', test: 'C-011-17',
    symptom: 'el turno queda esperando una escucha que no puede haber',
    trigger: 'error de permiso del micrófono',
  }),
]);

export const ADAPTER_CAPABILITIES = Object.freeze({
  opensNetwork: true,        // el reconocimiento nativo puede ir a un tercero
  touchesDom: false,         // el adaptador no toca el documento
  persists: false,           // no guarda entre sesiones
  writesStorage: false,      // no escribe almacenamiento del navegador
  decidesTurns: false,       // el turno lo decide el núcleo
  selectsPatchesBy: 'capability',
});

export function createWebSpeechAdapter(voiceEngine, runtime = {}, preferences = {}) {
  const clock = resolveRuntime(runtime);
  const engine = voiceEngine === undefined ? defaultEngine() : voiceEngine;
  const language = preferences && preferences.language !== undefined
    ? String(preferences.language)
    : (globalThis.navigator && globalThis.navigator.language ? globalThis.navigator.language : 'es');
  const prefix = prefixOf(language);
  const preferredURI = preferences && preferences.voiceURI;

  let speakGeneration = 0;
  let listenGeneration = 0;
  let retained = [];        // P-02: retención explícita hasta el cierre o la cancelación
  let activeRecognition = null;
  let activeSpeak = null;
  let activeListen = null;

  function getVoices() {
    try {
      return engine && engine.synthesis && typeof engine.synthesis.getVoices === 'function'
        ? engine.synthesis.getVoices() : [];
    } catch {
      return [];
    }
  }

  function onVoicesChanged(synthesis, handler) {
    if (typeof synthesis.addEventListener === 'function') {
      synthesis.addEventListener('voiceschanged', handler);
      return () => synthesis.removeEventListener('voiceschanged', handler);
    }
    if ('onvoiceschanged' in synthesis) {
      synthesis.onvoiceschanged = handler;
      return () => { synthesis.onvoiceschanged = null; };
    }
    return () => {};
  }

  // Congelar una locución: desarmar su vigilante, soltar su retención y
  // cerrarla sin resolver — usada por el desplazamiento, la cancelación y
  // el fallo del propio motor.
  const freezeSpeak = (target) => {
    if (!target || target.settled) return;
    if (target.timer !== null) clock.cancelSchedule(target.timer);
    if (target.detach) target.detach();
    retained = retained.filter((u) => u !== target.utterance);
    if (activeSpeak === target) activeSpeak = null;
    target.settled = true;
  };

  const speaker = {
    // SPE-003/SPEC-011: resuelve 'done' | 'error' | 'watchdog' y nunca
    // rechaza — tampoco si el propio motor lanza al construir su superficie.
    say(text, request) {
      return new Promise((resolve) => {
        let state = null;
        try {
          if (!engine || !engine.synthesis || typeof engine.Utterance !== 'function') {
            resolve('error');       // sin superficie de voz: fallo declarado
            return;
          }
          if (!request || !Number.isFinite(request.budgetMs) || request.budgetMs <= 0) {
            resolve('error');       // contrato roto: fail-closed, nunca inventa tope
            return;
          }
          freezeSpeak(activeSpeak);  // P-03: una locución superseded no vive
          state = {
            settled: false,
            generation: ++speakGeneration,
            timer: null,
            voiceReady: false,
            detach: null,
          };
          activeSpeak = state;
        const settle = (result) => {
          if (state.settled) return;                  // P-04: cierre idempotente
          state.settled = true;
          if (state.timer !== null) clock.cancelSchedule(state.timer);
          if (state.detach) state.detach();
          retained = retained.filter((u) => u !== state.utterance);
          if (activeSpeak === state) activeSpeak = null;
          resolve(result);
        };
        // Vigilante: al agotarse, con voz disponible y sin terminal es
        // watchdog; sin voz para el idioma es error (P-01/P-13, C-011-24).
        state.timer = clock.schedule(() => {
          settle(state.voiceReady ? 'watchdog' : 'error');
        }, request.budgetMs);

        const speakNow = () => {
          if (state.settled || state.generation !== speakGeneration) return;
          const voice = pickVoice(getVoices(), prefix, preferredURI);
          if (!voice) {
            settle('error');      // P-13: sin voz para el idioma, en el acto
            return;
          }
          state.voiceReady = true;
          // P-06: reanudar la cola en pausa y limpiar restos antes de hablar.
          if (engine.synthesis.paused) {
            try { engine.synthesis.resume(); } catch { /* best-effort del motor */ }
          }
          try { engine.synthesis.cancel(); } catch { /* best-effort del motor */ }
          // P-02: preparar la utterance por completo y retenerla.
          let utterance;
          try {
            utterance = new engine.Utterance(String(text));
          } catch {
            settle('error');      // motor roto: fallo declarado, nunca rechazo
            return;
          }
          utterance.lang = language;
          if (voice) utterance.voice = voice;
          utterance.onend = () => {
            if (state.generation !== speakGeneration || state.settled) return;
            settle('done');
          };
          utterance.onerror = () => {
            // P-05: el error de activación llega en el acto y cierra como
            // error, nunca watchdog; el aviso lo presenta la vista (SPEC-009).
            if (state.generation !== speakGeneration || state.settled) return;
            settle('error');
          };
          state.utterance = utterance;
          retained.push(utterance);
          try { engine.synthesis.speak(utterance); } catch { settle('error'); }
        };

        const voices = getVoices();
        if (Array.isArray(voices) && voices.length > 0) {
          speakNow();
        } else {
          // P-01: esperar voiceschanged dentro del presupuesto del turno;
          // si el presupuesto se agota sin voz, el vigilante resuelve error.
          state.detach = onVoicesChanged(engine.synthesis, () => {
            if (state.settled || state.generation !== speakGeneration) return;
            speakNow();
          });
        }
        } catch {
          freezeSpeak(state);       // sin efectos diferidos tras el fallo
          resolve('error');        // última línea de defensa: nunca rechaza
        }
      });
    },

    // SPEC-004: síncrona, idempotente, no lanza y no resuelve la promesa.
    cancel() {
      speakGeneration++;                       // P-03: los terminales previos son no-op
      freezeSpeak(activeSpeak);
      retained = [];                           // P-02/P-03: soltar y limpiar la cola
      try { engine && engine.synthesis && engine.synthesis.cancel(); } catch { /* no lanza */ }
    },
  };

  function stopRecognition() {
    const rec = activeRecognition;
    activeRecognition = null;
    if (rec) {
      try { rec.abort(); } catch { /* best-effort del motor */ }
    }
  }

  // Congelar una escucha: desarmar su vigilante, soltar su señal y
  // cerrarla sin resolver ni anunciar — desplazamiento, cancelación,
  // señal abortada y fallo del propio motor.
  const freezeListen = (target) => {
    if (!target || target.settled) return;
    if (target.timer !== null) clock.cancelSchedule(target.timer);
    if (target.detachSignal) target.detachSignal();
    target.settled = true;
    target.cancelled = true;
  };

  const listener = {
    // SPE-004: resuelve ListeningResult; no rechaza por reconocimiento —
    // tampoco si el propio motor lanza al construir su superficie.
    listen(request, callbacks) {
      return new Promise((resolve) => {
        const cb = callbacks || {};
        let state = null;
        try {
        if (!engine || typeof engine.Recognition !== 'function') {
          resolve({ type: 'recognition_failed' });
          return;
        }
        if (!request || !Number.isFinite(request.budgetMs) || request.budgetMs <= 0) {
          resolve({ type: 'recognition_failed' });
          return;
        }
        // P-08: la escucha que desplaza a otra congela sus efectos: su
        // vigilante muerto no puede abortar la instancia vigente.
        freezeListen(activeListen);
        // Y si la entrante nace muerta (señal ya abortada), la instancia
        // de la escucha previa no queda huérfana sin abortar.
        if (request.signal && request.signal.aborted) stopRecognition();
        state = {
          settled: false,
          cancelled: false,
          generation: ++listenGeneration,
          timer: null,
          lastPartial: '',
          signal: request.signal || null,
          detachSignal: null,
        };
        activeListen = state;
        const signalAborted = () => !!(state.signal && state.signal.aborted);
        // Una señal que ya llegó abortada es una petición muerta: se
        // congela igual que el abort en vuelo (C-011-18).
        if (signalAborted()) state.cancelled = true;
        const finish = (result, announce) => {
          if (state.settled) return;
          if (state.cancelled) {
            // Cancelada (por señal o por desplazamiento): ni resultado ni
            // callbacks — lo posterior a la cancelación es no-op (SPEC-004).
            freezeListen(state);
            return;
          }
          state.settled = true;
          if (state.timer !== null) clock.cancelSchedule(state.timer);
          if (state.detachSignal) state.detachSignal();
          stopRecognition();
          if (activeListen === state) activeListen = null;
          resolve(result);                       // primero el desenlace…
          if (announce === 'no_speech' && typeof cb.onNoSpeech === 'function') cb.onNoSpeech();
          if (announce === 'error' && typeof cb.onError === 'function') {
            cb.onError({ code: 'recognition_failed' });   // …y el anuncio no cuelga la promesa
          }
        };
        // P-10: el silencio es un caso propio — el presupuesto agotado sin
        // habla resuelve no_speech, nunca un valor cero (C-011-13).
        state.timer = clock.schedule(() => {
          finish({ type: 'no_speech' }, 'no_speech');
        }, request.budgetMs);

        const startSegment = () => {
          if (state.settled || state.cancelled || signalAborted()) return;
          stopRecognition();                   // P-08: una instancia por tramo
          let recognition;
          try {
            recognition = new engine.Recognition();
          } catch {
            finish({ type: 'recognition_failed' }, 'error');
            return;
          }
          activeRecognition = recognition;
          recognition.lang = language;
          recognition.continuous = false;
          recognition.interimResults = true;   // P-12: interinos declarados
          recognition.maxAlternatives = 1;
          recognition.onresult = (event) => {
            if (state.settled || state.cancelled
              || state.generation !== listenGeneration) return;
            const results = (event && event.results) || [];
            const from = event && Number.isInteger(event.resultIndex)
              ? event.resultIndex : 0;
            for (let i = from; i < results.length; i++) {
              const result = results[i];
              const alternative = result && result[0];
              if (!alternative || typeof alternative.transcript !== 'string') continue;
              const transcript = alternative.transcript.trim();
              if (result.isFinal) {
                // P-11: un final reemitido (Blink) es no-op porque la
                // entrega es única e idempotente (mecanismo de P-04).
                if (transcript === '') {
                  finish({ type: 'no_speech' }, 'no_speech');
                  return;
                }
                finish({
                  type: 'speech',
                  text: transcript,
                  confidence: typeof alternative.confidence === 'number'
                    ? alternative.confidence : 0,
                }, null);
                return;
              }
              if (transcript !== '' && transcript !== state.lastPartial) {
                state.lastPartial = transcript;
                if (typeof cb.onPartial === 'function') cb.onPartial(transcript); // P-12
              }
            }
          };
          recognition.onerror = (event) => {
            if (state.settled || state.cancelled
              || state.generation !== listenGeneration) return;
            const code = event && event.error;
            if (code === 'aborted') return;               // P-09: aborto propio
            finish({ type: 'recognition_failed' }, 'error'); // P-14: permiso y demás
          };
          recognition.onend = () => {
            if (state.settled || state.cancelled
              || state.generation !== listenGeneration) return;
            // P-07: re-escuchar dentro de la misma petición mientras el
            // turno siga abierto; el presupuesto agotado ya resolvió no_speech.
            if (!signalAborted()) startSegment();
          };
          try { recognition.start(); } catch { finish({ type: 'recognition_failed' }, 'error'); }
        };

        if (state.signal && typeof state.signal.addEventListener === 'function') {
          const onAbort = () => {
            state.cancelled = true;
            stopRecognition();
          };
          state.signal.addEventListener('abort', onAbort);
          state.detachSignal = () => state.signal.removeEventListener('abort', onAbort);
        }
        startSegment();
        } catch {
          freezeListen(state);   // sin efectos diferidos tras el fallo
          stopRecognition();     // ni instancia huérfana del motor
          resolve({ type: 'recognition_failed' });  // nunca rechaza
        }
      });
    },

    // SPEC-004: síncrona, idempotente, no lanza y no resuelve la promesa.
    cancel() {
      listenGeneration++;
      freezeListen(activeListen);
      stopRecognition();
    },
  };

  return { speaker, listener };
}

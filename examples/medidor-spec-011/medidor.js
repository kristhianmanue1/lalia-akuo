// Cableo del medidor en el navegador — examples/medidor-spec-011/medidor.js.
//
// Consume el núcleo (medidor-core.js) y el adaptador real
// (../../src/adapter/index.js). Sirve desde la raíz del repositorio
// (python3 -m http.server, ver README). Cada parche se registra con el
// desenlace OBSERVADO; nada se declara medido sin recorrido (la cobertura
// se deriva al exportar). El reloj aquí es el real del entorno: esto mide.

import { createWebSpeechAdapter } from '../../src/adapter/index.js';
import {
  CELLS, SCENARIOS, emptyRegistry, toCompactJson, accepts,
  scenariosForCell, coverageOf,
} from './medidor-core.js';

const registry = emptyRegistry();
const params = new URLSearchParams(location.search);
const PROBE = params.get('probe');
let CELL = params.get('cell') || localStorage.getItem('medidor-cell') || 'safari-macos';
let primeraLocucion = true;

const $ = (id) => document.getElementById(id);

function log(line) {
  $('registro').textContent += line + '\n';
}

function record(patchId, outcome, detail) {
  const cell = registry.cells[CELL];
  if (!cell) return;
  cell.patches[patchId] = {
    outcome,
    ok: accepts(patchId, outcome) ? 'pass' : 'fail',
    detail: detail || '',
    at: new Date().toISOString(),
  };
  log(patchId + ' → ' + outcome + ' [' + (accepts(patchId, outcome) ? 'pass' : 'fail') + ']'
    + (detail ? ' · ' + detail : ''));
}

function describeEngine() {
  const g = globalThis;
  const synthesis = g.speechSynthesis;
  const recognition = g.SpeechRecognition || g.webkitSpeechRecognition;
  const voices = synthesis ? synthesis.getVoices() : [];
  registry.environment.userAgent = navigator.userAgent;
  registry.environment.platform = navigator.platform || null;
  log('celda: ' + CELL + ' · probe: ' + (PROBE || 'ninguno'));
  log('síntesis: ' + (synthesis ? 'sí' : 'no')
    + ' · reconocimiento: ' + (recognition ? 'sí' : 'no')
    + ' · voces: ' + voices.length
    + (voices.length ? ' (' + voices.slice(0, 3).map((v) => v.lang).join(', ') + '…)' : ''));
  log('userAgent (sólo registro de medición; el adaptador no lo lee): '
    + navigator.userAgent);
}

function request(budgetMs) {
  const controller = new AbortController();
  return {
    controller,
    request: {
      turn: { id: 1, token: 'medidor', expectedState: 'listening' },
      budgetMs,
      signal: controller.signal,
    },
  };
}

function adapterFor(language) {
  return createWebSpeechAdapter(undefined, undefined, { language });
}

async function speakOnce(language, text) {
  const { speaker } = adapterFor(language);
  const { request: req } = request(20000);
  const start = performance.now();
  const outcome = await speaker.say(text, req);
  return { outcome, ms: Math.round(performance.now() - start) };
}

async function listenOnce() {
  const { listener } = adapterFor('es-MX');
  const { request: req } = request(30000);
  const partials = [];
  const result = await listener.listen(req, {
    onPartial: (t) => partials.push(t),
  });
  return { result, partials };
}

// Con reloj real: mirar si una promesa quedó sin resolver tras una espera
// honesta (el literal demorado pierde sólo si la promesa resolvió).
function quedoPendiente(promise, ms) {
  return new Promise((done) => {
    Promise.race([
      promise.then(() => done(false), () => done(false)),
      new Promise((r) => setTimeout(r, ms)).then(() => done(true)),
    ]);
  });
}

async function medirLocucion() {
  if (!$('activada').checked) {
    log('activa la voz primero (costura de activación de SPEC-009)');
    return;
  }
  const r = await speakOnce('es-MX', 'Prueba de locución del medidor.');
  record('P-02', r.outcome, r.ms + ' ms');
  record('P-04', r.outcome, 'entrega única');
  if (primeraLocucion) {
    record('P-01', r.outcome, 'primera locución de la carga · ' + r.ms + ' ms');
    primeraLocucion = false;
  } else {
    log('P-01 sólo se mide en la primera locución de la carga fresca');
  }
}

async function medirP06() {
  if (!$('activada').checked) {
    log('activa la voz primero (costura de activación de SPEC-009)');
    return;
  }
  log('P-06 es observacional: la condición (cola en pausa) no se fuerza;');
  log('deja voz en pausa en otras pestañas y mide la primera locución aquí.');
  const r = await speakOnce('es-MX', 'Locución tras posible pausa de la cola.');
  record('P-06', r.outcome, 'observacional · ' + r.ms + ' ms');
}

async function medirIdiomaSinVoz() {
  const r = await speakOnce('fr', 'Essai de langue sans voix installée.');
  record('P-13', r.outcome, 'idioma «fr» · ' + r.ms + ' ms');
}

async function medirEscucha() {
  if (!$('activada').checked) {
    log('activa la voz primero (costura de activación de SPEC-009)');
    return;
  }
  log('escuchando hasta 30 s: habla, calla unos segundos y vuelve a hablar…');
  const { result, partials } = await listenOnce();
  if (result.type === 'recognition_failed') {
    log('reconocimiento fallido: el permiso se mide con el flujo P-14');
    return;
  }
  record('P-07', result.type, 'tramos con re-escucha');
  record('P-11', result.type, 'entrega única');
  record('P-12', partials.length > 0 ? 'speech' : 'speech-no-partials',
    partials.length + ' parciales');
  if (result.type === 'no_speech') record('P-10', 'no_speech', 'presupuesto en silencio');
}

async function medirDobleEscucha() {
  if (!$('activada').checked) {
    log('activa la voz primero (costura de activación de SPEC-009)');
    return;
  }
  log('P-08: primera escucha en vuelo; la segunda debe arrancar sin lanzar.');
  log('habla cuando veas «segunda escucha activa»…');
  const { listener } = adapterFor('es-MX');
  listener.listen(request(30000).request, { onPartial: () => {} });
  const { result } = await listenOnce();
  record('P-08', result.type, 'segunda escucha sin recargar');
}

async function medirPermisoDenegado() {
  log('P-14: deniega el micrófono cuando el navegador lo pregunte…');
  const { result } = await listenOnce();
  record('P-14', result.type, 'permiso denegado');
}

async function medirCancelacion() {
  if (!$('activada').checked) {
    log('activa la voz primero (costura de activación de SPEC-009)');
    return;
  }
  const { speaker } = adapterFor('es-MX');
  const { request: req, controller } = request(20000);
  const cancelada = speaker.say('Locución que se va a cancelar a mitad.', req);
  setTimeout(() => {
    speaker.cancel();
    controller.abort();
  }, 150);
  const pendiente = await quedoPendiente(cancelada, 2000);
  log('la cancelada quedó ' + (pendiente ? 'sin resolver (correcto)' : 'RESUELTA (síntoma)'));
  const r = await speakOnce('es-MX', 'Locución después de la cancelación.');
  record('P-03', pendiente ? r.outcome : 'done-late',
    (pendiente ? 'cancelada congelada' : 'cancelada cerró tarde') + ' · nueva ' + r.outcome);
  // P-09: cancelación de la ESCUCHA (aborto propio, sin error del turno)
  const { listener } = adapterFor('es-MX');
  const { request: reqEscucha, controller: cEscucha } = request(30000);
  let efectos = 0;
  const escucha = listener.listen(reqEscucha, {
    onPartial: () => { efectos += 1; },
    onNoSpeech: () => { efectos += 1; },
    onError: () => { efectos += 1; },
  });
  setTimeout(() => {
    listener.cancel();
    cEscucha.abort();
  }, 800);
  const escuchaPendiente = await quedoPendiente(escucha, 2500);
  record('P-09', escuchaPendiente && efectos === 0 ? 'cancelled-clean' : 'resolved',
    'promesa ' + (escuchaPendiente ? 'sin resolver' : 'resuelta')
    + ' · ' + efectos + ' callbacks tras la cancelación');
}

async function sondaP05() {
  // Sonda aparte (?probe=p05): carga fresca y SIN tocar nada. Se registra
  // transversal (registry.probeP05), no en la celda del select: nada de
  // toques previos ni defaults de escritorio para atribuirla.
  const r = await speakOnce('es-MX', 'Sonda sin activación previa.');
  registry.probeP05 = {
    measured: true,
    outcome: r.outcome,
    ok: r.outcome === 'error' ? 'pass' : 'fail',
    userAgent: navigator.userAgent,
    platform: navigator.platform || null,
    at: new Date().toISOString(),
  };
  document.body.setAttribute('data-p05', r.outcome);
  log('P-05 (sonda) → ' + r.outcome + ' [' + (r.outcome === 'error' ? 'pass' : 'fail') + ']'
    + ' · ' + r.ms + ' ms');
}

async function exportar() {
  registry.registeredAt = new Date().toISOString();
  for (const cell of CELLS) {
    const cov = coverageOf(registry, cell.id);
    registry.cells[cell.id].coverage = cov;
    if (!cov.complete && cov.recorded > 0) {
      log(cell.id + ': recorrido parcial ' + cov.recorded + '/' + cov.applicable
        + ' — la celda sigue «sin medir»');
    }
  }
  const compact = toCompactJson(registry);
  $('exportacion').value = compact;
  $('exportacion').select();
  try {
    await navigator.clipboard.writeText(compact);
    log('JSON compacto copiado al portapapeles');
  } catch {
    log('JSON compacto listo en el cuadro de texto');
  }
}

function init() {
  for (const cell of CELLS) {
    const option = document.createElement('option');
    option.value = cell.id;
    option.textContent = cell.label + ' (' + cell.engine + ')';
    if (cell.id === CELL) option.selected = true;
    $('celda').appendChild(option);
  }
  $('celda').addEventListener('change', () => {
    CELL = $('celda').value;                    // en vivo: lo que sigue se
    localStorage.setItem('medidor-cell', CELL); // registra en la celda nueva
    log('celda activa: ' + CELL + ' (lo ya registrado quedó en su celda)');
  });
  $('locucion').addEventListener('click', medirLocucion);
  $('p06').addEventListener('click', medirP06);
  $('escucha').addEventListener('click', medirEscucha);
  $('doble-escucha').addEventListener('click', medirDobleEscucha);
  $('permiso-denegado').addEventListener('click', medirPermisoDenegado);
  $('cancelacion').addEventListener('click', medirCancelacion);
  $('idioma-sin-voz').addEventListener('click', medirIdiomaSinVoz);
  $('exportar').addEventListener('click', exportar);
  describeEngine();
  if (PROBE === 'p05') {
    document.body.setAttribute('data-probe', 'p05');
    sondaP05();          // automática y sin toque: eso es la condición
  }
}

init();

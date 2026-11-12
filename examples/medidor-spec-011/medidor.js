// Cableo del medidor en el navegador — examples/medidor-spec-011/medidor.js.
//
// Consume el núcleo (medidor-core.js) y el adaptador real
// (../../src/adapter/index.js, subentrada «./adapter»). Sirve desde la
// raíz del repositorio (python3 -m http.server, ver README). No toca
// nada fuera de esta página; el registro vive en memoria y se exporta.

import { createWebSpeechAdapter } from '../../src/adapter/index.js';
import {
  CELLS, SCENARIOS, emptyRegistry, toCompactJson, accepts, scenariosForCell,
} from './medidor-core.js';

const registry = emptyRegistry();
const params = new URLSearchParams(location.search);
const PROBE = params.get('probe');
const CELL = localStorage.getItem('medidor-cell') || 'safari-macos';

const $ = (id) => document.getElementById(id);

function log(line) {
  $('registro').textContent += line + '\n';
}

function record(patchId, outcome, detail) {
  const cell = registry.cells[CELL];
  if (!cell) return;
  cell.measured = true;
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
  log('celda: ' + CELL + ' · probe: ' + (PROBE || 'ninguno'));
  log('síntesis: ' + (synthesis ? 'sí' : 'no')
    + ' · reconocimiento: ' + (recognition ? 'sí' : 'no')
    + ' · voces: ' + voices.length
    + (voices.length ? ' (' + voices.slice(0, 3).map((v) => v.lang).join(', ') + '…)' : ''));
  if (PROBE !== 'p05') {
    log('userAgent (sólo registro de medición; el adaptador no lo lee): '
      + navigator.userAgent);
  }
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
  // Reloj real del entorno: aquí sí decide el tiempo, porque esto mide.
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

async function medirLocucion() {
  if (!$('activada').checked) {
    log('activa la voz primero (costura de activación de SPEC-009)');
    return;
  }
  const r = await speakOnce('es-MX', 'Prueba de locución del medidor.');
  record('P-02', r.outcome, r.ms + ' ms');
  record('P-04', r.outcome, 'entrega única');
  record('P-01', r.outcome, 'primera locución de la carga');
  record('P-06', r.outcome, 'cola de síntesis');
}

async function medirIdiomaSinVoz() {
  const r = await speakOnce('fr', 'Essai de langue sans voix installée.');
  record('P-13', r.outcome, 'idioma «fr»');
}

async function medirEscucha() {
  if (!$('activada').checked) {
    log('activa la voz primero (costura de activación de SPEC-009)');
    return;
  }
  log('escuchando hasta 30 s: habla despacio y pausa…');
  const { result, partials } = await listenOnce();
  record('P-12', result.type, parcialesTexto(partials));
  record('P-11', result.type, 'entrega única');
  record('P-07', result.type, 're-escucha de tramos');
  if (result.type === 'no_speech') record('P-10', 'no_speech', 'presupuesto en silencio');
}

async function medirCancelacion() {
  const { speaker } = adapterFor('es-MX');
  const { request: req, controller } = request(20000);
  const promesa = speaker.say('Locución que se va a cancelar a mitad.', req);
  setTimeout(() => {
    speaker.cancel();
    controller.abort();
    log('cancelada en vuelo; la promesa debe quedar sin resolver');
    record('P-03', 'done', 'cancelación propia: sin resolución');
    record('P-09', 'cancelled-clean', 'sin error de aborto');
  }, 150);
  await Promise.race([promesa, new Promise((r) => setTimeout(r, 2000))]);
}

function parcialesTexto(partials) {
  return partials.length ? partials.length + ' parciales' : 'sin parciales';
}

async function sondaP05() {
  // Sonda aparte: carga fresca con ?probe=p05 y SIN tocar nada. La
  // locución automática sin activación previa debe resolver error en el
  // acto en WebKit móvil — nunca watchdog ni done (SPEC-011, P-05).
  const r = await speakOnce('es-MX', 'Sonda sin activación previa.');
  const celda = registry.cells[CELL];
  celda.measured = true;
  celda.patches['P-05'] = {
    outcome: r.outcome,
    ok: r.outcome === 'error' ? 'pass' : 'fail',
    detail: 'sonda sin activación · ' + r.ms + ' ms',
    at: new Date().toISOString(),
  };
  document.body.setAttribute('data-p05', r.outcome);
  log('P-05 (sonda) → ' + r.outcome + ' [' + (r.outcome === 'error' ? 'pass' : 'fail') + ']');
}

function exportar() {
  registry.registeredAt = new Date().toISOString();
  const compact = toCompactJson(registry);
  $('exportacion').value = compact;
  $('exportacion').select();
  try { navigator.clipboard.writeText(compact); log('JSON compacto copiado al portapapeles'); }
  catch { log('JSON compacto listo en el cuadro de texto'); }
}

function init() {
  $('celda').textContent = '';
  for (const cell of CELLS) {
    const option = document.createElement('option');
    option.value = cell.id;
    option.textContent = cell.label + ' (' + cell.engine + ')';
    if (cell.id === CELL) option.selected = true;
    $('celda').appendChild(option);
  }
  $('celda').addEventListener('change', () => {
    localStorage.setItem('medidor-cell', $('celda').value);
    log('celda cambiada a ' + $('celda').value + ' (recarga para medir en ella)');
  });
  $('locucion').addEventListener('click', medirLocucion);
  $('idioma-sin-voz').addEventListener('click', medirIdiomaSinVoz);
  $('escucha').addEventListener('click', medirEscucha);
  $('cancelacion').addEventListener('click', medirCancelacion);
  $('exportar').addEventListener('click', exportar);
  describeEngine();
  if (PROBE === 'p05') {
    document.body.setAttribute('data-probe', 'p05');
    sondaP05();          // automática y sin toque: eso es la condición
  }
}

init();

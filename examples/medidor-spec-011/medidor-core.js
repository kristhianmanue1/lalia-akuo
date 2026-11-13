// Núcleo del medidor de SPEC-011 — sin DOM, verificable en Node.
//
// Define las celdas de la matriz de ADR-009 (seis: tres navegadores en
// dos plataformas), las condiciones de medición de los catorce parches y
// el registro vivo de resultados. La página (medidor.js / index.html)
// consume esto y cablea el motor real del navegador; el registro se
// exporta como JSON compacto para pegarlo en el informe de medición.
// Nada aquí se declara medido: los desenlaces los pone la página con lo
// observado, y «medida» sólo significa que se recorrió todo lo aplicable.

export const CELLS = Object.freeze([
  Object.freeze({ id: 'safari-macos', engine: 'webkit', label: 'Safari · macOS' }),
  Object.freeze({ id: 'safari-ios', engine: 'webkit', label: 'Safari · iOS' }),
  Object.freeze({ id: 'chrome-desktop', engine: 'blink', label: 'Chrome · escritorio' }),
  Object.freeze({ id: 'chrome-android', engine: 'blink', label: 'Chrome · Android' }),
  Object.freeze({ id: 'edge-desktop', engine: 'blink', label: 'Edge · escritorio' }),
  // Edge en iOS usa WebKit (política de plataforma), no Blink: no aporta
  // un motor nuevo —la cobertura WebKit móvil la da safari-ios— y la
  // celda blink de Edge corresponde a Android (ADR-009: matriz por motor).
  Object.freeze({ id: 'edge-mobile', engine: 'blink', label: 'Edge · Android' }),
]);

// Heurística de etiquetado: ¿el userAgent reporta el navegador/plataforma
// que la celda declara? Evita el error de medir en un navegador y
// registrar en otro (dos veces el 2026-11-13). No es la fuente de verdad
// de la medición: es un aviso.
export function cellMatchesUserAgent(cellId, userAgent) {
  const ua = String(userAgent || '');
  const iphone = ua.includes('iPhone');
  const android = ua.includes('Android');
  const mac = ua.includes('Macintosh') && !iphone && !android;
  const edge = ua.includes('Edg/');
  const chrome = ua.includes('Chrome/') && !edge;
  const safari = ua.includes('Safari/') && !chrome && !edge;
  const desktop = mac;
  const mobile = iphone || android;
  switch (cellId) {
    case 'safari-macos': return safari && desktop;
    case 'safari-ios': return safari && iphone;
    case 'chrome-desktop': return chrome && desktop;
    case 'chrome-android': return chrome && android;
    case 'edge-desktop': return edge && desktop;
    case 'edge-mobile': return edge && android;
    default: return false;
  }
}

// Cada escenario dice qué medir y qué desenlaces acepta el parche. El
// identificador es el del parche (P-01..P-14), no de navegador: un parche
// de Blink cubre Chrome y Edge con una sola condición (SPEC-011). Los
// desenlaces que NO están en accept son el síntoma vivo del parche.
export const SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'P-01', engine: 'both', flow: 'speaker-first',
    name: 'voces no listas',
    how: 'sólo la primera locución de la carga fresca, antes de que getVoices() llene',
    accept: ['done', 'error'],        // watchdog aquí sería el síntoma vivo
  }),
  Object.freeze({
    id: 'P-02', engine: 'both', flow: 'speaker',
    name: 'utterance preparada y retenida',
    how: 'locución normal: el terminal debe llegar (done)',
    accept: ['done'],
  }),
  Object.freeze({
    id: 'P-03', engine: 'both', flow: 'cancel',
    name: 'cierre de una locución cancelada',
    how: 'locución cancelada a mitad, 2 s de espera, y locución nueva: la cancelada debe quedar sin resolver y la nueva llegar a done',
    accept: ['done'],                 // 'done-late' = la cancelada cerró tarde
  }),
  Object.freeze({
    id: 'P-04', engine: 'both', flow: 'speaker', observable: false,
    name: 'cierre duplicado',
    how: 'NO OBSERVABLE desde el puerto: la duplicación no atraviesa la promesa; la entrega única la garantiza el cierre idempotente, probado con dobles',
    accept: ['done'],
  }),
  Object.freeze({
    id: 'P-05', engine: 'webkit', flow: 'probe',
    name: 'primera locución sin activación',
    how: 'SONDA APARTE (?probe=p05): carga fresca sin tocar nada; locución automática. Con señal del motor (not-allowed): error en el acto; sin señal: watchdog con voz presente (SPEC-011 enmendado 13-11-2026)',
    accept: ['error', 'watchdog'],   // done sería el síntoma vivo
  }),
  Object.freeze({
    id: 'P-06', engine: 'webkit', flow: 'speaker',
    name: 'cola de síntesis en pausa',
    how: 'OBSERVACIONAL: primera locución tras dejar voz en pausa en otras pestañas; la condición no se fuerza',
    accept: ['done'],
  }),
  Object.freeze({
    id: 'P-07', engine: 'webkit', flow: 'listener',
    name: 'escucha que no se reinicia',
    how: 'habla, calla unos segundos y vuelve a hablar: la segunda frase debe llegar',
    accept: ['speech'],               // no_speech aquí sería el síntoma vivo
  }),
  Object.freeze({
    id: 'P-08', engine: 'webkit', flow: 'listener-second',
    name: 'arranque sobre instancia activa',
    how: 'dos escuchas seguidas en la misma página sin recargar, con permiso concedido: la segunda debe escuchar',
    accept: ['speech', 'no_speech'],  // recognition_failed con permiso OK, síntoma
  }),
  Object.freeze({
    id: 'P-09', engine: 'webkit', flow: 'listen-cancel',
    name: 'cancelación propia reportada como error',
    how: 'escucha cancelada a mitad: la promesa debe quedar sin resolver ni error',
    accept: ['cancelled-clean'],      // 'resolved' = el aborto contó como desenlace
  }),
  Object.freeze({
    id: 'P-10', engine: 'webkit', flow: 'listener',
    name: 'fin de escucha sin resultado',
    how: 'escucha en silencio hasta agotar el presupuesto',
    accept: ['no_speech'],
  }),
  Object.freeze({
    id: 'P-11', engine: 'blink', flow: 'listener', observable: false,
    name: 'resultado final reemitido',
    how: 'NO OBSERVABLE desde el puerto: la reemisión no puede entregarse dos veces; la entrega única la garantiza el cierre, probado con dobles',
    accept: ['speech'],
  }),
  Object.freeze({
    id: 'P-12', engine: 'blink', flow: 'listener',
    name: 'resultados interinos',
    how: 'escucha hablando despacio: los parciales deben llegar',
    accept: ['speech'],               // 'speech-no-partials' = síntoma vivo
  }),
  Object.freeze({
    id: 'P-13', engine: 'both', flow: 'speaker',
    name: 'voz que no coincide con el idioma',
    how: 'declarar idioma sin voz instalada (p. ej. «fr») y locutar',
    accept: ['error'],                // declarado; nunca done ni watchdog
  }),
  Object.freeze({
    id: 'P-14', engine: 'both', flow: 'listener-denied',
    name: 'permiso de micrófono denegado',
    how: 'escucha con el micrófono denegado: debe resolver recognition_failed',
    accept: ['recognition_failed'],
  }),
]);

export function emptyRegistry() {
  const patches = {};
  for (const scenario of SCENARIOS) patches[scenario.id] = null;
  const cells = {};
  for (const cell of CELLS) {
    cells[cell.id] = { patches: { ...patches } };
  }
  return {
    schema: 'lalia-akuo/medicion-spec-011/v1',
    registeredAt: null,
    environment: { userAgent: null, platform: null },
    probeP05: { measured: false, outcome: null, userAgent: null, at: null },
    cells,
  };
}

// El registro viaja compacto: una línea, sin embellecer, para que la
// evidencia no engorde los documentos que la reciben.
export function toCompactJson(registry) {
  return JSON.stringify(registry);
}

// Valida que un resultado observado sea aceptable para el escenario.
export function accepts(scenarioId, outcome) {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) return false;
  return scenario.accept.includes(outcome);
}

// Escenarios aplicables a una celda por motor: «both» aplica a todos.
// La sonda transversal (flow 'probe') no es de celda: se registra aparte.
export function scenariosForCell(cellId) {
  const cell = CELLS.find((c) => c.id === cellId);
  if (!cell) return [];
  return SCENARIOS.filter((s) => s.flow !== 'probe'
    && (s.engine === 'both' || s.engine === cell.engine));
}

// Los no observables que APLICAN a una celda: en una celda webkit, el
// null de P-11 (blink) es «no aplica por motor», no «no observable», y
// el JSON no debe confundirlos (R3d).
export function notObservableFor(cellId) {
  return scenariosForCell(cellId)
    .filter((s) => s.observable === false)
    .map((s) => s.id);
}

// «Medida» es una consecuencia del recorrido, no un botón: una celda
// cuenta como medida sólo cuando todos sus parches aplicables Y
// observables tienen desenlace. Los no observables (P-04/P-11) no se
// exigen: este arnés no puede verlos desde el puerto, y fingirlo sería
// evidencia fabricada. Cualquier hueco observable deja la celda sin medir.
export function coverageOf(registry, cellId) {
  const cell = registry.cells[cellId];
  if (!cell) return { applicable: 0, recorded: 0, complete: false };
  const applicable = scenariosForCell(cellId)
    .filter((s) => s.observable !== false);
  const recorded = applicable.filter((s) => cell.patches[s.id] !== null);
  return {
    applicable: applicable.length,
    recorded: recorded.length,
    complete: recorded.length === applicable.length,
  };
}

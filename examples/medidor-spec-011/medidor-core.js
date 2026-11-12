// Núcleo del medidor de SPEC-011 — sin DOM, verificable en Node.
//
// Define las celdas de la matriz de ADR-009 (seis: tres navegadores en
// dos plataformas), las condiciones de medición de los catorce parches y
// el registro vivo de resultados. La página (medidor.js / index.html)
// consume esto y cablea el motor real del navegador; el registro se
// exporta como JSON compacto para pegarlo en el informe de medición.

export const CELLS = Object.freeze([
  Object.freeze({ id: 'safari-macos', engine: 'webkit', label: 'Safari · macOS' }),
  Object.freeze({ id: 'safari-ios', engine: 'webkit', label: 'Safari · iOS' }),
  Object.freeze({ id: 'chrome-desktop', engine: 'blink', label: 'Chrome · escritorio' }),
  Object.freeze({ id: 'chrome-android', engine: 'blink', label: 'Chrome · Android' }),
  Object.freeze({ id: 'edge-desktop', engine: 'blink', label: 'Edge · escritorio' }),
  Object.freeze({ id: 'edge-mobile', engine: 'blink', label: 'Edge · móvil' }),
]);

// Cada escenario dice qué medir y qué desenlace acepta el parche. El
// identificador es el del parche (P-01..P-14), no de navegador: un parche
// de Blink cubre Chrome y Edge con una sola condición (SPEC-011).
export const SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'P-01', engine: 'both', flow: 'speaker',
    name: 'voces no listas',
    how: 'primera locución tras carga fresca, antes de que getVoices() llene',
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
    how: 'iniciar locución y cancelarla a mitad; luego locutar de nuevo',
    accept: ['done'],
  }),
  Object.freeze({
    id: 'P-04', engine: 'both', flow: 'speaker',
    name: 'cierre duplicado',
    how: 'locución normal: si el motor reemite el terminal, la entrega es una',
    accept: ['done'],
  }),
  Object.freeze({
    id: 'P-05', engine: 'webkit', flow: 'probe',
    name: 'primera locución sin activación',
    how: 'SONDA APARTE: carga fresca sin tocar nada; locución automática',
    accept: ['error'],                // en el acto; nunca watchdog ni done
  }),
  Object.freeze({
    id: 'P-06', engine: 'webkit', flow: 'speaker',
    name: 'cola de síntesis en pausa',
    how: 'primera locución de la sesión tras varias pestañas con voz',
    accept: ['done'],
  }),
  Object.freeze({
    id: 'P-07', engine: 'webkit', flow: 'listener',
    name: 'escucha que no se reinicia',
    how: 'escucha continua: callar unos segundos y volver a hablar',
    accept: ['speech', 'no_speech'],
  }),
  Object.freeze({
    id: 'P-08', engine: 'webkit', flow: 'listener',
    name: 'arranque sobre instancia activa',
    how: 'dos escuchas seguidas en la misma página sin recargar',
    accept: ['speech', 'no_speech', 'recognition_failed'],
  }),
  Object.freeze({
    id: 'P-09', engine: 'webkit', flow: 'cancel',
    name: 'cancelación propia reportada como error',
    how: 'cancelar la escucha a mitad; no debe contar como error del turno',
    accept: ['cancelled-clean'],
  }),
  Object.freeze({
    id: 'P-10', engine: 'webkit', flow: 'listener',
    name: 'fin de escucha sin resultado',
    how: 'escucha en silencio hasta agotar el presupuesto',
    accept: ['no_speech'],
  }),
  Object.freeze({
    id: 'P-11', engine: 'blink', flow: 'listener',
    name: 'resultado final reemitido',
    how: 'escucha normal: si Blink reemite el final, la entrega es una',
    accept: ['speech'],
  }),
  Object.freeze({
    id: 'P-12', engine: 'blink', flow: 'listener',
    name: 'resultados interinos',
    how: 'escucha hablando despacio: los parciales deben llegar',
    accept: ['speech'],
  }),
  Object.freeze({
    id: 'P-13', engine: 'both', flow: 'speaker',
    name: 'voz que no coincide con el idioma',
    how: 'declarar idioma sin voz instalada (p. ej. «fr») y locutar',
    accept: ['error'],                // declarado; nunca done ni watchdog
  }),
  Object.freeze({
    id: 'P-14', engine: 'both', flow: 'listener',
    name: 'permiso de micrófono denegado',
    how: 'denegar el micrófono cuando el navegador lo pregunte',
    accept: ['recognition_failed'],
  }),
]);

export function emptyRegistry() {
  const patches = {};
  for (const scenario of SCENARIOS) patches[scenario.id] = null;
  const cells = {};
  for (const cell of CELLS) {
    cells[cell.id] = { measured: false, patches: { ...patches } };
  }
  return { schema: 'lalia-akuo/medicion-spec-011/v1', registeredAt: null, cells };
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
export function scenariosForCell(cellId) {
  const cell = CELLS.find((c) => c.id === cellId);
  if (!cell) return [];
  return SCENARIOS.filter((s) => s.engine === 'both' || s.engine === cell.engine);
}

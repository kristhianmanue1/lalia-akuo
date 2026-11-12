// Humo del núcleo del medidor de SPEC-011 — sin DOM, sin motor.
//
// Verifica el aparato de medición: las seis celdas de la matriz de
// ADR-009, los catorce escenarios (uno por parche, cruzados con los
// PATCHES del adaptador), el registro vacío con su entorno y sonda, la
// cobertura derivada y la exportación compacta. No cita casos C-*: el
// medidor es instrumental, no prueba de spec.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CELLS, SCENARIOS, emptyRegistry, toCompactJson, accepts,
  scenariosForCell, coverageOf,
} from '../examples/medidor-spec-011/medidor-core.js';
import { PATCHES } from '../src/adapter/index.js';

test('la matriz declara las seis celdas de ADR-009 por motor', () => {
  assert.equal(CELLS.length, 6);
  const ids = CELLS.map((c) => c.id);
  assert.deepEqual(ids.sort(), [
    'chrome-android', 'chrome-desktop', 'edge-desktop',
    'edge-mobile', 'safari-ios', 'safari-macos',
  ]);
  for (const cell of CELLS) {
    assert.ok(['webkit', 'blink'].includes(cell.engine), cell.id);
    assert.ok(!/chrome|edge|safari/i.test(cell.engine), cell.id + ' por motor');
  }
});

test('hay un escenario por parche obligatorio, con motor válido y desenlaces', () => {
  assert.equal(SCENARIOS.length, 14);
  const ids = SCENARIOS.map((s) => s.id);
  for (let n = 1; n <= 14; n++) {
    const id = 'P-' + String(n).padStart(2, '0');
    assert.ok(ids.includes(id), 'falta ' + id);
  }
  for (const scenario of SCENARIOS) {
    assert.ok(['both', 'blink', 'webkit'].includes(scenario.engine), scenario.id);
    assert.ok(scenario.accept.length > 0, scenario.id + ' sin desenlaces');
    assert.equal(typeof scenario.how, 'string', scenario.id);
  }
});

test('los escenarios no derivan de los PATCHES del adaptador: id y motor coinciden', () => {
  assert.equal(SCENARIOS.length, PATCHES.length);
  for (const parche of PATCHES) {
    const escenario = SCENARIOS.find((s) => s.id === parche.id);
    assert.ok(escenario, 'escenario sin parche: ' + parche.id);
    assert.equal(escenario.engine, parche.engine, parche.id + ' divergió de motor');
  }
});

test('la sonda P-05 es un flujo propio, separado de la activación', () => {
  const p05 = SCENARIOS.find((s) => s.id === 'P-05');
  assert.equal(p05.flow, 'probe');
  assert.deepEqual(p05.accept, ['error']);
});

test('los accept discriminan el síntoma que cada parche caza', () => {
  assert.equal(accepts('P-07', 'no_speech'), false);   // perder la 2.ª frase
  assert.equal(accepts('P-07', 'speech'), true);
  assert.equal(accepts('P-12', 'speech-no-partials'), false);
  assert.equal(accepts('P-12', 'speech'), true);
  assert.equal(accepts('P-08', 'recognition_failed'), false); // con permiso OK
  assert.equal(accepts('P-03', 'done-late'), false);   // la cancelada cerró tarde
  assert.equal(accepts('P-09', 'resolved'), false);    // el aborto contó
  assert.equal(accepts('P-09', 'cancelled-clean'), true);
  assert.equal(accepts('P-13', 'error'), true);
  assert.equal(accepts('P-13', 'done'), false);        // silencio con éxito: nunca
  assert.equal(accepts('P-99', 'done'), false);        // escenario inexistente
});

test('el registro vacío nace sin medir, con entorno y sonda transversal', () => {
  const registry = emptyRegistry();
  assert.deepEqual(registry.environment, { userAgent: null, platform: null });
  assert.equal(registry.probeP05.measured, false);
  assert.equal(registry.probeP05.outcome, null);
  for (const cell of CELLS) {
    for (const scenario of SCENARIOS) {
      assert.equal(registry.cells[cell.id].patches[scenario.id], null);
    }
  }
  const json = toCompactJson(registry);
  assert.ok(!json.includes('\n'), 'compacto: una sola línea');
  const parsed = JSON.parse(json);
  assert.equal(parsed.schema, 'lalia-akuo/medicion-spec-011/v1');
  assert.equal(parsed.registeredAt, null);
});

test('scenariosForCell filtra por motor: webkit no mide parches de blink', () => {
  const safari = scenariosForCell('safari-ios');
  assert.ok(!safari.some((s) => s.engine === 'blink'));
  assert.ok(safari.some((s) => s.engine === 'webkit'));
  assert.ok(safari.some((s) => s.engine === 'both'));
  assert.ok(!safari.some((s) => s.flow === 'probe'), 'la sonda no es de celda');
  const chrome = scenariosForCell('chrome-android');
  assert.ok(!chrome.some((s) => s.engine === 'webkit'));
  assert.deepEqual(scenariosForCell('celda-inexistente'), []);
});

test('la cobertura no exige lo no observable: P-04/P-11 no bloquean celda', () => {
  const registry = emptyRegistry();
  const cell = registry.cells['chrome-desktop'];
  for (const scenario of scenariosForCell('chrome-desktop')) {
    if (scenario.observable === false) continue;      // P-04/P-11: fuera
    cell.patches[scenario.id] = { outcome: 'x', ok: 'y', detail: '', at: '' };
  }
  const cov = coverageOf(registry, 'chrome-desktop');
  assert.equal(cov.complete, true);                   // sin exigir no-observables
  assert.ok(cov.applicable < scenariosForCell('chrome-desktop').length);
});

test('la cobertura se deriva del recorrido: un hueco deja la celda sin medir', () => {
  const registry = emptyRegistry();
  const vacia = coverageOf(registry, 'safari-ios');
  assert.equal(vacia.complete, false);
  assert.equal(vacia.recorded, 0);
  assert.equal(vacia.applicable, scenariosForCell('safari-ios').length);
  const cell = registry.cells['safari-ios'];
  for (const scenario of scenariosForCell('safari-ios')) {
    cell.patches[scenario.id] = { outcome: 'x', ok: 'y', detail: '', at: '' };
  }
  assert.equal(coverageOf(registry, 'safari-ios').complete, true);
  cell.patches['P-13'] = null;                    // un solo hueco basta
  const conHueco = coverageOf(registry, 'safari-ios');
  assert.equal(conHueco.complete, false);
  assert.equal(conHueco.recorded, conHueco.applicable - 1);
});

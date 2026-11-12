// Humo del núcleo del medidor de SPEC-011 — sin DOM, sin motor.
//
// Verifica el aparato de medición: las seis celdas de la matriz de
// ADR-009, los catorce escenarios (uno por parche), el registro vacío y
// su exportación compacta. No cita casos C-*: el medidor es
// instrumental, no prueba de spec.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CELLS, SCENARIOS, emptyRegistry, toCompactJson, accepts, scenariosForCell,
} from '../examples/medidor-spec-011/medidor-core.js';

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

test('la sonda P-05 es un flujo propio, separado de la activación', () => {
  const p05 = SCENARIOS.find((s) => s.id === 'P-05');
  assert.equal(p05.flow, 'probe');
  assert.deepEqual(p05.accept, ['error']);
});

test('el registro vacío nace sin medir y exporta en una línea compacta', () => {
  const registry = emptyRegistry();
  for (const cell of CELLS) {
    assert.equal(registry.cells[cell.id].measured, false);
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

test('accepts sólo admite los desenlaces declarados del escenario', () => {
  assert.equal(accepts('P-13', 'error'), true);
  assert.equal(accepts('P-13', 'done'), false);      // silencio con éxito: nunca
  assert.equal(accepts('P-13', 'watchdog'), false);
  assert.equal(accepts('P-02', 'done'), true);
  assert.equal(accepts('P-99', 'done'), false);      // escenario inexistente
});

test('scenariosForCell filtra por motor: webkit no mide parches de blink', () => {
  const safari = scenariosForCell('safari-ios');
  assert.ok(!safari.some((s) => s.engine === 'blink'));
  assert.ok(safari.some((s) => s.engine === 'webkit'));
  assert.ok(safari.some((s) => s.engine === 'both'));
  const chrome = scenariosForCell('chrome-android');
  assert.ok(!chrome.some((s) => s.engine === 'webkit'));
  assert.deepEqual(scenariosForCell('celda-inexistente'), []);
});

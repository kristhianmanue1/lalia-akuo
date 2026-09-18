// Pruebas de la superficie pública.
//
// La barrera que protege al consumidor: lo que el README promete tiene que
// existir, y la versión que declara la biblioteca tiene que ser la del
// manifiesto. Un desajuste aquí se descubre antes de publicar, no después.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as api from '../src/index.js';

const manifiesto = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

test('la versión declarada es la del manifiesto', () => {
  assert.equal(api.VERSION, manifiesto.version);
  assert.equal(api.NAME, manifiesto.name);
});

test('la licencia declarada es la del proyecto', () => {
  assert.equal(manifiesto.license, 'Apache-2.0');
});

test('la biblioteca no declara dependencias de ejecución', () => {
  assert.equal(manifiesto.dependencies, undefined);
});

test('lo que el README promete está exportado', () => {
  const exportados = Object.keys(api).sort();
  for (const nombre of ['NAME', 'VERSION', 'PACK_ES', 'createCatalog']) {
    assert.ok(exportados.includes(nombre), 'falta ' + nombre);
  }
  assert.equal(typeof api.createCatalog, 'function');
  assert.equal(typeof api.interpolate, 'function');
  assert.equal(typeof api.verifyPack, 'function');
  assert.equal(api.PACK_ES.language, 'es');
});

test('los errores públicos son clases con nombre estable', () => {
  assert.equal(new api.MissingTextError('k', 'es').name, 'MissingTextError');
  assert.equal(new api.MissingPlaceholderError('n', 't').name,
    'MissingPlaceholderError');
  assert.equal(new api.InvalidPackError().name, 'InvalidPackError');
  assert.ok(new api.InvalidPackError() instanceof TypeError);
});

// Pruebas del mecanismo de paquetes de idioma (REQ-12).
//
// Cubre lo que F0 promete: resolver textos con marcadores, fallar en cerrado
// cuando falta un texto o un valor, permitir un paquete de respaldo, y
// detectar en las dos direcciones lo que un idioma nuevo pierde o añade.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCatalog, interpolate, verifyPack,
  InvalidPackError, MissingPlaceholderError, MissingTextError,
} from '../src/index.js';
import { PACK_ES } from '../src/index.js';

const PACK_PRUEBA = {
  language: 'xx',
  texts: {
    'catalog.missing_text': 'No text «{key}» in «{language}».',
    'catalog.missing_placeholder': 'No value «{name}» for «{template}».',
    'catalog.invalid_pack': 'A language pack needs «language» and «texts».',
  },
};

test('resuelve un texto con sus marcadores', () => {
  const catalogo = createCatalog(PACK_ES);
  assert.equal(
    catalogo.text('catalog.missing_text', { key: 'saludo', language: 'es' }),
    'Falta el texto «saludo» en el paquete «es».',
  );
});

test('un marcador sin valor es un error, nunca un texto a medias', () => {
  assert.throws(() => interpolate('Hola {nombre}.', {}), MissingPlaceholderError);
  assert.throws(() => interpolate('Hola {nombre}.', { otra: 'x' }),
    MissingPlaceholderError);
  assert.equal(interpolate('Hola {nombre}.', { nombre: 'Ana' }), 'Hola Ana.');
});

test('un texto ausente es un error, nunca la clave cruda en pantalla', () => {
  const catalogo = createCatalog(PACK_ES);
  assert.throws(() => catalogo.text('catalog.no_existe'), MissingTextError);
  assert.equal(catalogo.has('catalog.no_existe'), false);
});

test('el paquete de respaldo cubre lo que al paquete le falta', () => {
  const respaldo = createCatalog(PACK_ES);
  const parcial = createCatalog({ language: 'xx', texts: {} }, { fallback: respaldo });
  assert.equal(
    parcial.text('catalog.invalid_pack'),
    'El paquete de idioma necesita «language» y «texts».',
  );
  assert.throws(() => parcial.text('catalog.no_existe'), MissingTextError);
});

test('un paquete mal formado se rechaza en cerrado', () => {
  assert.throws(() => createCatalog({ language: 'xx' }), InvalidPackError);
  assert.throws(() => createCatalog(null), InvalidPackError);
  assert.throws(() => createCatalog({ texts: {} }), InvalidPackError);
  assert.throws(() => verifyPack(null, PACK_ES), InvalidPackError);
});

test('verifyPack dice qué le falta y qué le sobra a un idioma nuevo', () => {
  const referencia = { language: 'es', texts: { a: 'A', b: 'B', c: 'C' } };
  const nuevo = { language: 'xx', texts: { b: 'B', c: 'C', z: 'Z' } };
  assert.deepEqual(verifyPack(nuevo, referencia), { missing: ['a'], extra: ['z'] });
});

test('el mecanismo soporta otro dominio sin tocarlo', () => {
  const catalogo = createCatalog(PACK_PRUEBA);
  assert.equal(catalogo.language, 'xx');
  assert.equal(
    catalogo.text('catalog.missing_text', { key: 'k', language: 'xx' }),
    'No text «k» in «xx».',
  );
  assert.deepEqual(catalogo.keys(), [
    'catalog.invalid_pack',
    'catalog.missing_placeholder',
    'catalog.missing_text',
  ]);
});

test('el idioma español trae los textos que la biblioteca resuelve', () => {
  const catalogo = createCatalog(PACK_ES);
  assert.equal(catalogo.language, 'es');
  for (const clave of catalogo.keys()) {
    assert.ok(catalogo.text(clave, {
      key: 'k', language: 'es', name: 'n', template: 't',
    }).length > 0, clave + ' sin texto resoluble');
  }
});

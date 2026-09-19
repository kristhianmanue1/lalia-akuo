// Pruebas del mecanismo de paquetes de idioma (REQ-12).
//
// Cubre lo que F0 promete: resolver textos con marcadores, fallar en cerrado
// cuando falta un texto o un valor, permitir un paquete de respaldo, y
// detectar en las dos direcciones lo que un idioma nuevo pierde o añade.
//
// Después, una prueba por cada caso C-007-* de SPEC-007 —trece— con el
// identificador del caso en el nombre, para que la traza spec → prueba sea
// directa.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createCatalog, interpolate, verifyPack,
  InvalidPackError, MissingPlaceholderError, MissingTextError,
} from '../src/index.js';
import { PACK_ES } from '../src/index.js';
import { DEFAULT_READ_BUDGET } from '../src/i18n/catalog.js';

// Las catorce claves cerradas de la biblioteca (SPEC-007), ordenadas.
const LIBRARY_KEYS = [
  'announce.state.error',
  'announce.state.idle',
  'announce.state.listening',
  'announce.state.speaking',
  'announce.state.thinking',
  'catalog.invalid_pack',
  'catalog.missing_placeholder',
  'catalog.missing_text',
  'controls.microphoneMute',
  'controls.speechMute',
  'controls.start',
  'controls.stateIndicator',
  'controls.textInput',
  'notice.offDeviceAudio',
];

// Segundo paquete de prueba: los mismos roles con otros textos, distintos de
// los del paquete es, para comprobar que el mecanismo no depende de ninguno.
const PACK_XX = {
  language: 'xx',
  texts: Object.fromEntries(LIBRARY_KEYS.map((key) => [key, 'xx ' + key])),
};

const PACK_MX = {
  language: 'es-MX',
  texts: Object.fromEntries(LIBRARY_KEYS.map((key) => [key, 'mx ' + key])),
};

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

// Casos de SPEC-007: una prueba por caso, con su identificador estable.

test('C-007-01 resuelve una clave del paquete de prueba y publica su etiqueta', () => {
  const catalogo = createCatalog(PACK_XX);
  assert.equal(catalogo.language, 'xx');
  assert.equal(catalogo.text('controls.start'), 'xx controls.start');
  assert.equal(catalogo.resolve('controls.start').source, 'pack');
  assert.equal(catalogo.resolve('controls.start').language, 'xx');
});

test('C-007-02 una clave de la biblioteca sale del paquete es', () => {
  const catalogo = createCatalog(PACK_ES);
  assert.equal(catalogo.language, 'es');
  const texto = catalogo.text('controls.start');
  assert.equal(texto, PACK_ES.texts['controls.start']);
  assert.notEqual(texto, 'controls.start');
});

test('C-007-03 una clave ausente sin respaldo falla y declara missing_text', () => {
  const catalogo = createCatalog(PACK_ES);
  let fallo = null;
  try {
    catalogo.text('catalog.no_existe');
  } catch (error) {
    fallo = error;
  }
  assert.ok(fallo instanceof MissingTextError, 'no se lanzó MissingTextError');
  assert.equal(fallo.key, 'catalog.no_existe');
  assert.equal(fallo.language, 'es');
  assert.equal(fallo.code, 'missing_text');
  assert.notEqual(fallo.message, 'catalog.no_existe');
  assert.equal(catalogo.has('catalog.no_existe'), false);
});

test('C-007-04 una marca sin valor falla y no publica texto a medias', () => {
  assert.throws(
    () => interpolate('Hola {nombre}.', {}),
    MissingPlaceholderError,
  );
  const catalogo = createCatalog({
    language: 'xx',
    texts: { 'prueba.texto': 'Hola {nombre}.' },
  });
  let fallo = null;
  try {
    catalogo.text('prueba.texto');
  } catch (error) {
    fallo = error;
  }
  assert.ok(fallo instanceof MissingPlaceholderError);
  assert.equal(fallo.missing, 'nombre');
  assert.equal(fallo.code, 'missing_text');
});

test('C-007-05 un paquete sin language o sin texts es invalid_config', () => {
  const invalidos = [
    { texts: { a: 'A' } },
    { language: 'xx' },
    { language: 'xx', texts: [] },
    { language: 'xx', texts: { a: '' } },
    { language: 'xx', texts: { a: 7 } },
    { language: 'xx', texts: { a: 'A' }, budget: { maxWords: 0 } },
  ];
  for (const pack of invalidos) {
    let fallo = null;
    try {
      createCatalog(pack);
    } catch (error) {
      fallo = error;
    }
    assert.ok(fallo instanceof InvalidPackError, JSON.stringify(pack));
    assert.equal(fallo.code, 'invalid_config');
  }
});

test('C-007-06 verifyPack informa en las dos direcciones y no lanza', () => {
  const nuevo = {
    language: 'xx',
    texts: { 'controls.start': 'xx controls.start', 'extra.uno': 'y' },
  };
  const ida = verifyPack(nuevo, PACK_ES);
  assert.deepEqual(ida.extra, ['extra.uno']);
  assert.deepEqual(
    ida.missing,
    LIBRARY_KEYS.filter((key) => key !== 'controls.start'),
  );
  const vuelta = verifyPack(PACK_ES, nuevo);
  assert.deepEqual(vuelta.missing, ['extra.uno']);
  assert.deepEqual(
    vuelta.extra,
    LIBRARY_KEYS.filter((key) => key !== 'controls.start'),
  );
});

test('C-007-07 sustituir el paquete cambia todos los textos sin tocar el módulo', () => {
  const es = createCatalog(PACK_ES);
  const otro = createCatalog(PACK_XX);
  const slots = { key: 'k', language: 'es', name: 'n', template: 't' };
  for (const key of LIBRARY_KEYS) {
    assert.ok(es.has(key), 'el paquete es no trae ' + key);
    assert.ok(otro.has(key), 'el paquete xx no trae ' + key);
    assert.notEqual(
      otro.text(key, slots),
      es.text(key, slots),
      key + ' no cambió',
    );
  }
  assert.equal(es.text('controls.start'), PACK_ES.texts['controls.start']);
  assert.equal(otro.text('controls.start'), PACK_XX.texts['controls.start']);
});

test('C-007-08 un texto fuera de presupuesto no se habla y da over_budget', () => {
  assert.equal(DEFAULT_READ_BUDGET.maxCharacters, 400);
  assert.equal(DEFAULT_READ_BUDGET.maxWords, 60);

  const catalogo = createCatalog({
    language: 'xx',
    texts: {
      'prueba.corta': 'Una frase corta.',
      'prueba.larga': 'x'.repeat(500),
    },
    budget: { maxCharacters: 20, maxWords: 3 },
  });
  assert.deepEqual(catalogo.budget, { maxCharacters: 20, maxWords: 3 });

  const dentro = catalogo.measure(catalogo.text('prueba.corta'));
  assert.equal(dentro.within, true);
  assert.equal(dentro.code, null);

  const fuera = catalogo.measure(catalogo.text('prueba.larga'));
  assert.equal(fuera.within, false);
  assert.equal(fuera.code, 'over_budget');

  // La compuerta que decide no hablar es de SPEC-006; aquí se comprueba que
  // el mecanismo le entrega el código declarado y que el texto no se habla.
  const hablado = [];
  const compuerta = (texto) => {
    const medida = catalogo.measure(texto);
    if (!medida.within) {
      return { spoken: false, code: medida.code };
    }
    hablado.push(texto);
    return { spoken: true, code: null };
  };
  assert.deepEqual(
    compuerta(catalogo.text('prueba.larga')),
    { spoken: false, code: 'over_budget' },
  );
  assert.deepEqual(hablado, []);

  // El tope de palabras corta aunque los caracteres quepan.
  const porPalabras = createCatalog({
    language: 'xx',
    texts: { 'prueba.tres': 'una dos tres' },
    budget: { maxWords: 2 },
  });
  const medida = porPalabras.measure(porPalabras.text('prueba.tres'));
  assert.equal(medida.words, 3);
  assert.equal(medida.code, 'over_budget');

  // Sin `budget` rige el de omisión, que es finito.
  const sinBudget = createCatalog({
    language: 'xx',
    texts: { 'prueba.larga': 'x'.repeat(500) },
  });
  assert.deepEqual(sinBudget.budget, {
    maxCharacters: 400,
    maxWords: 60,
  });
  assert.equal(
    sinBudget.measure(sinBudget.text('prueba.larga')).code,
    'over_budget',
  );
});

test('C-007-09 la clave ausente sale del respaldo y declara su procedencia', () => {
  const respaldo = createCatalog(PACK_ES);
  const parcial = createCatalog(
    { language: 'xx', texts: { 'propia.clave': 'xx propia' } },
    { fallback: respaldo },
  );
  const resuelto = parcial.resolve('controls.start');
  assert.equal(resuelto.text, PACK_ES.texts['controls.start']);
  assert.equal(resuelto.source, 'fallback');
  assert.equal(resuelto.language, 'es');
  assert.equal(parcial.text('controls.start'), resuelto.text);

  const propia = parcial.resolve('propia.clave');
  assert.equal(propia.text, 'xx propia');
  assert.equal(propia.source, 'pack');
  assert.equal(propia.language, 'xx');

  const sola = createCatalog({
    language: 'xx',
    texts: { 'propia.clave': 'xx propia' },
  });
  assert.throws(() => sola.text('controls.start'), MissingTextError);
});

test('C-007-10 normaliza la etiqueta a minúsculas y compara de forma exacta', () => {
  assert.equal(
    createCatalog({ language: 'ES', texts: { a: 'A' } }).language,
    'es',
  );
  assert.equal(
    createCatalog({ language: 'es-MX', texts: { a: 'A' } }).language,
    'es-mx',
  );
  for (const etiqueta of ['es MX', 'es_', '', '12', 'e', 42, null]) {
    assert.throws(
      () => createCatalog({ language: etiqueta, texts: { a: 'A' } }),
      InvalidPackError,
      'la etiqueta ' + String(etiqueta) + ' debería ser inválida',
    );
  }

  const castellano = createCatalog(PACK_ES);
  const mexicano = createCatalog(PACK_MX);
  assert.equal(castellano.language, 'es');
  assert.equal(mexicano.language, 'es-mx');
  assert.notEqual(castellano.language, mexicano.language);
  assert.equal(mexicano.resolve('controls.start').source, 'pack');
  assert.equal(mexicano.text('controls.start'), 'mx controls.start');
  assert.equal(castellano.text('controls.start'), PACK_ES.texts['controls.start']);

  // La variante regional sólo cambia lo que el respaldo declara, nunca por
  // sustitución de etiqueta.
  const regional = createCatalog(
    { language: 'es-MX', texts: { 'propia.clave': 'mx propia' } },
    { fallback: castellano },
  );
  assert.equal(regional.text('controls.start'), PACK_ES.texts['controls.start']);
  assert.equal(regional.resolve('controls.start').source, 'fallback');
});

test('C-007-11 el readback se compone del catálogo con el valor como ranura', () => {
  const usos = [];
  const phrases = {
    resolve: (key) => {
      usos.push(key);
      throw new Error('el catálogo no debe usar el puerto phrases');
    },
  };
  const catalogo = createCatalog(
    { language: 'xx', texts: { 'readback.value': 'Confirmas {value} {unit}?' } },
    { phrases: phrases },
  );
  const texto = catalogo.text('readback.value', { value: '12.5', unit: 'kg' });
  assert.equal(texto, 'Confirmas 12.5 kg?');
  assert.deepEqual(usos, []);
  assert.equal('phrases' in catalogo, false);
});

test('C-007-12 la parte decimal entra tal cual, sin redondear ni convertir', () => {
  const catalogo = createCatalog({
    language: 'xx',
    texts: { 'readback.value': 'Valor {value} {unit}.' },
  });
  const muestras = [
    ['12.50', 'kg'],
    ['0.125', 'g'],
    ['-3.75', 'kg'],
    ['1,50', 'm'],
  ];
  for (const [value, unit] of muestras) {
    const texto = catalogo.text('readback.value', { value, unit });
    assert.equal(texto, 'Valor ' + value + ' ' + unit + '.');
    assert.ok(texto.includes(value), value + ' no aparece tal cual');
  }
});

test('C-007-13 el núcleo no contiene los textos de ningún paquete', () => {
  // `src/i18n/es.js` es un paquete de idioma, no el núcleo: sus textos viven
  // ahí por diseño. El núcleo es el mecanismo.
  const nucleo = ['../src/i18n/catalog.js', '../src/index.js'];
  const fuentes = nucleo.map(
    (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8'),
  );
  for (const pack of [PACK_ES, PACK_XX, PACK_MX]) {
    for (const [key, texto] of Object.entries(pack.texts)) {
      for (const fuente of fuentes) {
        assert.ok(
          !fuente.includes(texto),
          'el núcleo contiene el texto de ' + key,
        );
      }
    }
  }
  assert.ok(
    !fuentes[0].includes("from './es.js'"),
    'catalog.js importa el paquete es',
  );
});

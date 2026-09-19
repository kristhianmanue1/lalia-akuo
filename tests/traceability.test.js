// Trazabilidad entre las spec, sus pruebas y el estado declarado.
//
// Cada caso de E1 tiene un identificador estable (`C-001-06`) cuyo destino es
// convertirse en una prueba. Esta comprobación impide dos cosas: que un caso
// quede sin probar sin que nadie lo note, y que una prueba se apoye en un caso
// que no existe.
//
// La tercera pieza es la que hace fiable retomar el proyecto en otra sesión:
// `docs/estado.md` declara, spec por spec, qué está implementado y qué no, y
// aquí se comprueba que esa declaración **coincide con la realidad**. Un caso
// probado de una spec declarada pendiente, o un caso sin prueba de una spec
// declarada implementada, es un fallo. Así el documento de avance no puede
// mentir ni quedarse atrás sin que la puerta lo diga.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const RAIZ = new URL('../', import.meta.url);
const ID = /C-\d{3}-\d{2}/g;

function leer(ruta) {
  return readFileSync(new URL(ruta, RAIZ), 'utf8');
}

function archivosDe(dir, sufijo) {
  return readdirSync(new URL(dir, RAIZ))
    .filter(function (nombre) { return nombre.endsWith(sufijo); })
    .sort();
}

function casosDeLasSpec() {
  const casos = new Map();
  for (const nombre of archivosDe('docs/specs/', '.md')) {
    if (!nombre.startsWith('SPEC-')) {
      continue;
    }
    const texto = leer('docs/specs/' + nombre);
    for (const linea of texto.split('\n')) {
      if (!linea.startsWith('- **C-')) {
        continue;
      }
      const ids = linea.match(ID);
      if (ids) {
        casos.set(ids[0], nombre);
      }
    }
  }
  return casos;
}

function casosProbados() {
  const probados = new Map();
  for (const nombre of archivosDe('tests/', '.test.js')) {
    const texto = leer('tests/' + nombre);
    for (const linea of texto.split('\n')) {
      if (!linea.includes('test(')) {
        continue;
      }
      const ids = linea.match(ID);
      for (const id of ids || []) {
        if (!probados.has(id)) {
          probados.set(id, []);
        }
        probados.get(id).push(nombre);
      }
    }
  }
  return probados;
}

// El estado declarado se lee de `docs/estado.md`: una tabla con una fila por
// spec y su estado, `implementada` o `pendiente`.
function estadoDeclarado() {
  const filas = new Map();
  for (const linea of leer('docs/estado.md').split('\n')) {
    const celdas = linea.split('|').map(function (c) { return c.trim(); });
    if (celdas.length < 4) {
      continue;
    }
    const spec = celdas[1].replace(/`/g, '');
    const estado = celdas[2];
    if (spec.startsWith('SPEC-') && (estado === 'implementada' || estado === 'pendiente')) {
      filas.set(spec, estado);
    }
  }
  return filas;
}

test('cada caso de las spec implementadas tiene al menos una prueba', () => {
  const casos = casosDeLasSpec();
  const probados = casosProbados();
  const estado = estadoDeclarado();
  const sinPrueba = [];
  for (const [id, spec] of casos) {
    if (estado.get(spec) === 'pendiente') {
      continue;
    }
    if (!probados.has(id)) {
      sinPrueba.push(id + ' (' + spec + ')');
    }
  }
  assert.deepEqual(sinPrueba, [],
    'casos de spec sin prueba: ' + sinPrueba.join(', '));
});

test('ninguna prueba se apoya en un caso que no existe', () => {
  const casos = casosDeLasSpec();
  const probados = casosProbados();
  const huerfanos = [];
  for (const [id, archivos] of probados) {
    if (!casos.has(id)) {
      huerfanos.push(id + ' (' + archivos.join(', ') + ')');
    }
  }
  assert.deepEqual(huerfanos, [],
    'identificadores de caso sin spec: ' + huerfanos.join(', '));
});

test('el estado declarado coincide con lo que hay probado', () => {
  const casos = casosDeLasSpec();
  const probados = casosProbados();
  const estado = estadoDeclarado();
  const problemas = [];
  const specs = new Set(casos.values());
  for (const spec of specs) {
    if (!estado.has(spec)) {
      problemas.push(spec + ': sin estado declarado en docs/estado.md');
      continue;
    }
    const pendiente = estado.get(spec) === 'pendiente';
    const conPrueba = [];
    const sinPrueba = [];
    for (const [id, deSpec] of casos) {
      if (deSpec !== spec) {
        continue;
      }
      (probados.has(id) ? conPrueba : sinPrueba).push(id);
    }
    if (pendiente && conPrueba.length > 0) {
      problemas.push(spec + ': declarada pendiente y con casos probados: '
        + conPrueba.join(', '));
    }
    if (!pendiente && sinPrueba.length > 0) {
      problemas.push(spec + ': declarada implementada y con casos sin prueba: '
        + sinPrueba.join(', '));
    }
  }
  assert.deepEqual(problemas, [], 'desacuerdos: ' + problemas.join('; '));
});

test('el índice declara el mismo número de casos que las spec', () => {
  const casos = casosDeLasSpec();
  const reales = new Map();
  for (const [id, spec] of casos) {
    reales.set(spec, (reales.get(spec) || 0) + 1);
  }
  const indice = leer('docs/specs/00-INDICE.md');
  const desacuerdos = [];
  for (const [spec, cuantos] of reales) {
    const fila = indice.split('\n').find(function (linea) {
      return linea.startsWith('| `' + spec + '`');
    });
    assert.ok(fila, 'el índice no tiene fila para ' + spec);
    const celdas = fila.split('|').map(function (c) { return c.trim(); });
    const declarado = Number(celdas[celdas.length - 2]);
    if (declarado !== cuantos) {
      desacuerdos.push(spec + ': spec ' + cuantos + ', índice ' + declarado);
    }
  }
  const total = indice.match(/Total: \*\*(\d+) casos\*\*/);
  assert.ok(total, 'el índice no declara el total de casos');
  if (Number(total[1]) !== casos.size) {
    desacuerdos.push('total: spec ' + casos.size + ', índice ' + total[1]);
  }
  assert.deepEqual(desacuerdos, [], 'desacuerdos: ' + desacuerdos.join('; '));
});

// Pruebas de la política declarada y la compuerta (SPEC-006).
//
// Una prueba por caso C-006-*: el nombre de cada test lleva su identificador
// para que la trazabilidad sea mecánica. Los dominios son inventados y
// triviales; ningún valor de política de esta prueba vive en el módulo.
//
// El módulo bajo prueba es un módulo hoja: aquí se le pasa un catálogo
// mínimo con la superficie que fija SPEC-007 (`has` y `text`), porque lo
// que se prueba es la compuerta, no el catálogo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TEXT_CLASSES,
  POLICY_MEMBERS,
  POLICY_DEFAULTS,
  ConfigError,
  classifyText,
  validatePolicy,
  guardSubstitution,
  resolveSpeech,
  sayThroughPolicy,
} from '../src/core/policy.js';

const POLICY_URL = new URL('../src/core/policy.js', import.meta.url);
const POLICY_SOURCE = readFileSync(POLICY_URL, 'utf8');

// Catálogo mínimo: la superficie de SPEC-007 que la compuerta necesita.
function makeCatalog(texts) {
  return {
    language: 'zz',
    has(key) {
      return Object.prototype.hasOwnProperty.call(texts, key);
    },
    text(key) {
      if (!Object.prototype.hasOwnProperty.call(texts, key)) {
        throw new Error('clave ausente en el catálogo: ' + key);
      }
      return texts[key];
    },
  };
}

const CATALOG_ALFA = makeCatalog({
  'alfa.aviso.degradacion': 'Aviso de degradación del dominio alfa.',
  'alfa.texto.seguro': 'Texto seguro del dominio alfa.',
});

const CATALOG_BETA = makeCatalog({
  'beta.aviso.degradacion': 'Aviso de degradación del dominio beta.',
  'beta.texto.seguro': 'Texto seguro del dominio beta.',
});

// Dominio alfa: bloquea el texto conversacional y declara su texto seguro.
function policyAlfa(extra = {}) {
  return {
    degradation: { noticeKey: 'alfa.aviso.degradacion' },
    blockedClasses: ['conversational'],
    safeTextKey: 'alfa.texto.seguro',
    immutableTextKeys: ['alfa.clave.fija'],
    filter: { drops: ['alfa.filtro'] },
    data: { sink: 'alfa.destino' },
    ...extra,
  };
}

function capture(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return null;
}

function configError(fn) {
  const error = capture(fn);
  assert.ok(error instanceof ConfigError, 'se esperaba ConfigError');
  return error;
}

test('C-006-01 sin `policy`: missing_policy, ninguna sesión y ningún puerto',
  () => {
    const calls = [];
    const config = {
      fields: [{ id: 'alfa.campo', type: 'number',
        promptKey: 'alfa.pregunta' }],
      language: { pack: { language: 'zz',
        texts: { 'alfa.pregunta': '¿Cuánto?' } } },
      ports: { speaker: { say: () => calls.push('speaker') } },
      onEvent: () => calls.push('event'),
    };
    let session = null;
    const error = configError(() => {
      session = validatePolicy(config.policy);
    });
    assert.equal(error.code, 'missing_policy');
    assert.equal(error.path, 'policy');
    assert.equal(session, null);
    assert.deepEqual(calls, []);
  });

test('C-006-02 `policy` sin `degradation`: missing_policy, no hay sesión',
  () => {
    const calls = [];
    const policy = {
      blockedClasses: ['conversational'],
      safeTextKey: 'alfa.texto.seguro',
      data: { sink: 'alfa.destino' },
    };
    let session = null;
    const error = configError(() => {
      session = validatePolicy(policy);
    });
    assert.equal(error.code, 'missing_policy');
    assert.equal(error.path, 'policy.degradation');
    assert.equal(session, null);
    assert.deepEqual(calls, []);
    assert.equal(
      configError(() => validatePolicy(policyAlfa({ degradation: null })))
        .code,
      'missing_policy',
    );
  });

test('C-006-03 sin filter, sin blockedClasses y sin safeTextKey: el '
  + 'formulario sigue y no se habla texto conversacional', () => {
  const policy = validatePolicy({
    degradation: { noticeKey: 'alfa.aviso.degradacion' },
  });
  assert.equal(policy.filter, null);
  assert.equal(policy.blockedClasses, null);
  assert.equal(policy.safeTextKey, null);
  assert.deepEqual(policy.confirmation, { maxAttempts: 1 });
  assert.equal(policy.degradation.maxConsecutiveFailures, 1);
  const form = resolveSpeech(policy, CATALOG_ALFA, {
    text: '¿Cuánto?',
    textClass: classifyText('catalog'),
  });
  assert.equal(form.speak, true);
  assert.equal(form.displayText, '¿Cuánto?');
  assert.equal(form.code, null);
  const conversational = resolveSpeech(policy, CATALOG_ALFA, {
    text: 'texto conversacional del puerto alfa',
    textClass: classifyText('port'),
  });
  assert.equal(conversational.speak, false);
  assert.equal(conversational.code, 'missing_policy');
  assert.equal(conversational.displayText, null);
  assert.equal(conversational.speechText, null);
});

test('C-006-04 `conversational` bloqueada: no llega el texto del puerto y '
  + 'sí llega el de `safeTextKey`', () => {
  const policy = validatePolicy(policyAlfa());
  const phrases = { text: () => 'texto conversacional del puerto alfa' };
  const said = [];
  const speaker = {
    say(text) {
      said.push(text);
      return Promise.resolve('done');
    },
  };
  const decision = sayThroughPolicy({
    policy,
    catalog: CATALOG_ALFA,
    candidate: {
      text: phrases.text(),
      textClass: classifyText('port'),
    },
    speaker,
    request: { turn: 1 },
  });
  assert.equal(decision.speak, true);
  assert.equal(decision.safe, true);
  assert.deepEqual(said, ['Texto seguro del dominio alfa.']);
  assert.equal(said.includes(phrases.text()), false);
  assert.equal(decision.displayText, 'Texto seguro del dominio alfa.');
  assert.equal(decision.speechText, 'Texto seguro del dominio alfa.');
});

test('C-006-05 clase bloqueada sin `safeTextKey`: no se habla y es '
  + 'missing_policy', () => {
  const policy = validatePolicy({
    degradation: { noticeKey: 'alfa.aviso.degradacion' },
    blockedClasses: ['form'],
  });
  assert.equal(policy.safeTextKey, null);
  const said = [];
  const candidate = {
    text: 'dato de formulario del dominio alfa',
    textClass: classifyText('catalog'),
  };
  const decision = sayThroughPolicy({
    policy,
    catalog: CATALOG_ALFA,
    candidate,
    speaker: { say: (text) => said.push(text) },
  });
  assert.equal(decision.speak, false);
  assert.equal(decision.code, 'missing_policy');
  assert.equal(decision.displayText, null);
  assert.equal(decision.speechText, null);
  assert.deepEqual(said, []);
  assert.equal(JSON.stringify(decision).includes(candidate.text), false);
});

test('C-006-06 clase no bloqueada: el candidato se habla sin alteración',
  () => {
    const policy = validatePolicy(policyAlfa());
    const text = '¿Cuánto pesa el objeto alfa?';
    const decision = resolveSpeech(policy, CATALOG_ALFA, {
      text,
      textClass: classifyText('catalog'),
    });
    assert.equal(decision.speak, true);
    assert.equal(decision.safe, false);
    assert.equal(decision.code, null);
    assert.equal(decision.displayText, text);
    assert.equal(decision.speechText, text);
  });

test('C-006-07 candidato bloqueado: ni `displayText` ni `speechText` lo '
  + 'llevan; los dos llevan el texto seguro', () => {
  const policy = validatePolicy(policyAlfa({ blockedClasses: ['form'] }));
  const candidate = 'dato de formulario del dominio alfa';
  const decision = resolveSpeech(policy, CATALOG_ALFA, {
    text: candidate,
    textClass: 'form',
  });
  assert.equal(decision.speak, true);
  assert.equal(decision.safe, true);
  assert.equal(decision.displayText, 'Texto seguro del dominio alfa.');
  assert.equal(decision.speechText, 'Texto seguro del dominio alfa.');
  assert.equal(decision.displayText.includes(candidate), false);
  assert.equal(decision.speechText.includes(candidate), false);
});

test('C-006-08 clave intocable: el reemplazo del puerto se rechaza con '
  + 'port_failure y el turno se rehace en determinista', () => {
  const policy = validatePolicy(policyAlfa());
  const substituted = 'otro texto del puerto alfa';
  const catalogText = 'texto del catálogo alfa';
  const replacement = guardSubstitution(policy, {
    key: 'alfa.clave.fija',
    catalogText,
    substitutedText: substituted,
  });
  assert.equal(replacement.accepted, false);
  assert.equal(replacement.code, 'port_failure');
  assert.equal(replacement.text, null);
  assert.equal(JSON.stringify(replacement).includes(substituted), false);
  const identical = guardSubstitution(policy, {
    key: 'alfa.clave.fija',
    catalogText,
    substitutedText: catalogText,
  });
  assert.equal(identical.accepted, true);
  const free = guardSubstitution(policy, {
    key: 'alfa.clave.libre',
    catalogText,
    substitutedText: substituted,
  });
  assert.equal(free.accepted, true);
  assert.equal(free.textClass, 'conversational');
  const said = [];
  const determinist = sayThroughPolicy({
    policy,
    catalog: CATALOG_ALFA,
    candidate: { text: catalogText, textClass: classifyText('catalog') },
    speaker: { say: (text) => said.push(text) },
  });
  assert.equal(determinist.speak, true);
  assert.deepEqual(said, [catalogText]);
  assert.equal(said.includes(substituted), false);
});

test('C-006-09 dos dominios distintos conducen su turno sin tocar el núcleo',
  () => {
    const before = readFileSync(POLICY_URL, 'utf8');
    const alfa = validatePolicy(policyAlfa());
    const beta = validatePolicy({
      degradation: { noticeKey: 'beta.aviso.degradacion' },
      blockedClasses: ['form'],
      safeTextKey: 'beta.texto.seguro',
      immutableTextKeys: ['beta.clave.fija'],
      filter: { drops: ['beta.filtro'] },
    });
    const saidAlfa = [];
    const saidBeta = [];
    const turnAlfa = sayThroughPolicy({
      policy: alfa,
      catalog: CATALOG_ALFA,
      candidate: {
        text: 'texto conversacional del puerto alfa',
        textClass: classifyText('port'),
      },
      speaker: { say: (text) => saidAlfa.push(text) },
    });
    const turnBeta = sayThroughPolicy({
      policy: beta,
      catalog: CATALOG_BETA,
      candidate: {
        text: '¿Cuánto pesa el objeto beta?',
        textClass: classifyText('catalog'),
      },
      speaker: { say: (text) => saidBeta.push(text) },
    });
    assert.equal(turnAlfa.speak, true);
    assert.equal(turnBeta.speak, true);
    assert.deepEqual(saidAlfa, ['Texto seguro del dominio alfa.']);
    assert.deepEqual(saidBeta, ['Texto seguro del dominio beta.']);
    assert.equal(readFileSync(POLICY_URL, 'utf8'), before);
  });

test('C-006-10 los valores de política del consumidor no aparecen en el '
  + 'núcleo', () => {
  // Las clases de `blockedClasses` quedan fuera de este barrido a propósito:
  // son vocabulario del núcleo (SPEC-006), no política del consumidor, y por
  // eso sí viven en el módulo.
  const consumerValues = [
    'alfa.aviso.degradacion',
    'alfa.texto.seguro',
    'alfa.clave.fija',
    'alfa.filtro',
    'alfa.destino',
    'beta.aviso.degradacion',
    'beta.texto.seguro',
    'beta.clave.fija',
    'beta.filtro',
  ];
  for (const value of consumerValues) {
    assert.equal(POLICY_SOURCE.includes(value), false,
      'el núcleo contiene un valor de política: ' + value);
  }
  assert.equal(POLICY_SOURCE.includes('conversational'), true);
});

test('C-006-11 miembro desconocido en `policy`: invalid_config, sin sesión',
  () => {
    const policy = policyAlfa({ blockedClass: ['form'] });
    let session = null;
    const error = configError(() => {
      session = validatePolicy(policy);
    });
    assert.equal(error.code, 'invalid_config');
    assert.equal(error.path, 'policy.blockedClass');
    assert.equal(session, null);
    assert.equal(
      configError(() => validatePolicy(policyAlfa({ safeTextKey: 7 }))).code,
      'invalid_config',
    );
  });

test('C-006-12 aplicar la política no invoca red, almacenamiento ni consola',
  () => {
    const globalApis = [
      'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon',
      'localStorage', 'sessionStorage', 'indexedDB', 'console',
    ];
    const calls = [];
    const previous = new Map();
    const trap = (name) => function () {
      calls.push(name);
      throw new Error('API prohibida alcanzada: ' + name);
    };
    try {
      for (const name of globalApis) {
        previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, name, {
          configurable: true,
          writable: true,
          value: trap(name),
        });
      }
      assert.throws(() => globalThis.fetch('lalia://alfa'));
      assert.deepEqual(calls, ['fetch']);
      calls.length = 0;
      const policy = validatePolicy({
        degradation: { noticeKey: 'alfa.aviso.degradacion' },
        blockedClasses: ['conversational'],
        safeTextKey: 'alfa.texto.seguro',
        filter: {
          drops: () => {
            throw new Error('el filtro no se evalúa en la primera versión');
          },
        },
      });
      const said = [];
      const decision = sayThroughPolicy({
        policy,
        catalog: CATALOG_ALFA,
        candidate: {
          text: 'texto conversacional del puerto alfa',
          textClass: classifyText('port'),
        },
        speaker: {
          say(text) {
            said.push(text);
            return Promise.resolve('done');
          },
        },
        request: { turn: 1 },
      });
      assert.equal(decision.speak, true);
      assert.deepEqual(said, ['Texto seguro del dominio alfa.']);
      assert.deepEqual(calls, []);
    } finally {
      for (const name of globalApis) {
        const descriptor = previous.get(name);
        if (descriptor) {
          Object.defineProperty(globalThis, name, descriptor);
        } else {
          delete globalThis[name];
        }
      }
    }
  });

test('C-006-13 `policy.data` declarado: el núcleo no envía ni persiste nada',
  () => {
    let evaluated = 0;
    const data = {
      sink: () => {
        evaluated += 1;
        return 'alfa.destino';
      },
      retention: 'alfa.retencion',
    };
    const policy = validatePolicy({
      degradation: { noticeKey: 'alfa.aviso.degradacion' },
      blockedClasses: ['conversational'],
      safeTextKey: 'alfa.texto.seguro',
      data,
    });
    const said = [];
    const decision = sayThroughPolicy({
      policy,
      catalog: CATALOG_ALFA,
      candidate: {
        text: 'texto conversacional del puerto alfa',
        textClass: classifyText('port'),
      },
      speaker: { say: (text) => said.push(text) },
    });
    assert.equal(decision.speak, true);
    assert.deepEqual(said, ['Texto seguro del dominio alfa.']);
    assert.equal(evaluated, 0);
    assert.equal(policy.data, data);
    const egress = new RegExp([
      'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon',
      'localStorage', 'sessionStorage', 'indexedDB', 'console',
    ].join('|'));
    assert.equal(egress.test(POLICY_SOURCE), false);
  });

test('C-006-14 texto de un puerto para una clave de formulario: cuenta como '
  + 'conversational y pasa por el filtro y la compuerta', () => {
  const policy = validatePolicy(policyAlfa());
  assert.equal(classifyText('catalog'), 'form');
  assert.equal(classifyText('port'), 'conversational');
  assert.equal(classifyText('otro-origen'), 'conversational');
  const ported = guardSubstitution(policy, {
    key: 'alfa.pregunta',
    catalogText: '¿Cuánto?',
    substitutedText: 'Cuéntame lo que quieras del objeto alfa.',
  });
  assert.equal(ported.accepted, true);
  assert.equal(ported.textClass, 'conversational');
  const said = [];
  const decision = sayThroughPolicy({
    policy,
    catalog: CATALOG_ALFA,
    candidate: { text: ported.text, textClass: ported.textClass },
    speaker: { say: (text) => said.push(text) },
  });
  assert.equal(decision.safe, true);
  assert.deepEqual(said, ['Texto seguro del dominio alfa.']);
  const form = resolveSpeech(policy, CATALOG_ALFA, {
    text: '¿Cuánto?',
    textClass: classifyText('catalog'),
  });
  assert.equal(form.speak, true);
});

test('C-006-15 `safeTextKey` cuya clave no está en el catálogo: '
  + 'missing_text, sin texto improvisado', () => {
  const policy = validatePolicy({
    degradation: { noticeKey: 'alfa.aviso.degradacion' },
    blockedClasses: ['form'],
    safeTextKey: 'alfa.clave.inexistente',
  });
  const candidate = {
    text: 'dato de formulario del dominio alfa',
    textClass: classifyText('catalog'),
  };
  const decision = resolveSpeech(policy, CATALOG_ALFA, candidate);
  assert.equal(decision.speak, false);
  assert.equal(decision.code, 'missing_text');
  assert.equal(decision.displayText, null);
  assert.equal(decision.speechText, null);
  assert.equal(JSON.stringify(decision).includes('alfa.clave.inexistente'),
    false);
  assert.equal(resolveSpeech(policy, null, candidate).code, 'missing_text');
});

test('C-006-16 `blockedClasses` con «conversacional»: invalid_config y sin '
  + 'sesión', () => {
  const policy = policyAlfa({ blockedClasses: ['conversacional'] });
  let session = null;
  const error = configError(() => {
    session = validatePolicy(policy);
  });
  assert.equal(error.code, 'invalid_config');
  assert.equal(error.path, 'policy.blockedClasses[0]');
  assert.equal(session, null);
  assert.deepEqual(TEXT_CLASSES, ['form', 'conversational']);
  assert.deepEqual(POLICY_MEMBERS, [
    'degradation', 'confirmation', 'blockedClasses', 'safeTextKey',
    'immutableTextKeys', 'filter', 'data',
  ]);
  assert.deepEqual(POLICY_DEFAULTS,
    { maxAttempts: 1, maxConsecutiveFailures: 1 });
});

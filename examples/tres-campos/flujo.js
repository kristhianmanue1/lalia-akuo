// Cableo del ejemplo «tres campos» — un consumidor de lalia-akuo.
//
// Sin DOM y sin motor de voz: es la pieza que la página y la prueba de humo
// comparten. Muestra el patrón de integración del contrato de consumo:
//  - tres campos declarativos (SPEC-001);
//  - paquete es-mx con respaldo explícito al PACK_ES de la biblioteca
//    (SPEC-007 §3: la variante regional es un paquete distinto);
//  - interpreters deterministas inyectados como puertos (SPEC-004): el
//    dominio (qué significa «sí» o «34») vive aquí, no en la biblioteca;
//  - voz silenciada por omisión: sin un motor medido (SPEC-011 pendiente),
//    el speaker por omisión falla por contrato y, sin silenciar, el flujo
//    no avanzaría de campo. Quien tenga motor lo activa con `voz: true`.

import { createVoiceSession, PACK_ES } from '../../src/index.js';

export const CAMPOS = [
  { id: 'edad', type: 'integer', promptKey: 'ejemplo.edad' },
  { id: 'peso', type: 'number', unit: 'kg', promptKey: 'ejemplo.peso' },
  { id: 'minutos', type: 'integer', promptKey: 'ejemplo.minutos' },
];

export const TEXTO_MX = {
  language: 'es-mx',
  texts: {
    'ejemplo.edad': '¿Qué edad tienes?',
    'ejemplo.edad.readback': 'Tienes {value} años. ¿Es correcto?',
    'ejemplo.edad.saved': 'Guardé {value} años.',
    'ejemplo.peso': '¿Cuánto pesas?',
    'ejemplo.peso.readback': 'Pesas {value} {unit}. ¿Es correcto?',
    'ejemplo.peso.saved': 'Guardé {value} {unit}.',
    'ejemplo.minutos': '¿Cuántos minutos caminaste hoy?',
    'ejemplo.minutos.readback': 'Caminaste {value} minutos. ¿Es correcto?',
    'ejemplo.minutos.saved': 'Guardé {value} minutos.',
    'ejemplo.aviso': 'Sigue por texto: escribe tu respuesta.',
  },
};

// Intérpretes de ejemplo: números y sí/no. Un consumidor real pone aquí su
// gramática y su léxico; para el núcleo son puertos como cualquier otro.
export const INTERPRETE_CAMPO = {
  interpret(text) {
    const limpio = String(text).trim().replace(',', '.');
    const valor = Number(limpio);
    return Promise.resolve(Number.isFinite(valor) && limpio !== ''
      ? { code: 'ok', value: valor }
      : { code: 'unparseable' });
  },
  cancel() {},
};

export const INTERPRETE_CONTROL = {
  interpret(text) {
    const limpio = String(text).trim().toLowerCase();
    return Promise.resolve(/^s/.test(limpio) ? 'affirmation'
      : /^n/.test(limpio) ? 'negation' : 'unclassified');
  },
  cancel() {},
};

// `puertosVoz` llega del adaptador del consumidor (véase voz-navegador.js).
// Sin él, speaker y listener son los deterministas por omisión y la sesión
// degrada a texto por su camino declarado. `observar` recibe cada evento
// además del registro interno: es el gancho de la vista.
export function crearFlujo({ voz = false, puertosVoz = null, observar = null } = {}) {
  const events = [];
  const session = createVoiceSession({
    fields: CAMPOS,
    language: { pack: TEXTO_MX, fallback: PACK_ES },
    policy: { degradation: { noticeKey: 'ejemplo.aviso' } },
    ports: {
      fieldInterpreter: INTERPRETE_CAMPO,
      controlInterpreter: INTERPRETE_CONTROL,
      ...(puertosVoz === null ? {} : puertosVoz),
    },
    onEvent: (event) => {
      events.push(event);
      if (observar !== null) observar(event);
    },
  });
  if (!voz) session.setSpeechMuted(true);
  return { session, events };
}

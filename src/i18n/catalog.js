// Mecanismo de paquetes de idioma (REQ-12).
//
// La biblioteca no trae textos de dominio: trae la forma de resolverlos y la
// obligación de fallar en cerrado cuando falta uno. Un texto ausente es un
// error, nunca una cadena vacía ni la clave cruda en pantalla.
//
// Dos consumidores con dominios distintos usan este mismo módulo sin tocarlo:
// cada uno trae su paquete y, si quiere, declara de qué paquete respaldarse.

import { PACK_ES } from './es.js';

const PATRON_MARCADOR = /\{(\w+)\}/g;

function mensaje(clave, valores) {
  const plantilla = PACK_ES.texts[clave];
  return plantilla.replace(PATRON_MARCADOR, function (coincidencia, nombre) {
    return Object.prototype.hasOwnProperty.call(valores, nombre)
      ? String(valores[nombre])
      : coincidencia;
  });
}

export class MissingTextError extends Error {
  constructor(key, language) {
    super(mensaje('catalog.missing_text', { key: key, language: language }));
    this.name = 'MissingTextError';
    this.key = key;
    this.language = language;
  }
}

export class MissingPlaceholderError extends Error {
  constructor(name, template) {
    super(mensaje('catalog.missing_placeholder', {
      name: name, template: template,
    }));
    this.name = 'MissingPlaceholderError';
    this.missing = name;
    this.template = template;
  }
}

export class InvalidPackError extends TypeError {
  constructor() {
    super(PACK_ES.texts['catalog.invalid_pack']);
    this.name = 'InvalidPackError';
  }
}

// Sustituye cada `{nombre}` por su valor. Un marcador sin valor es un error:
// publicar un texto a medias es peor que no publicarlo.
export function interpolate(template, values = {}) {
  if (typeof template !== 'string') {
    throw new TypeError('interpolate espera una plantilla de texto.');
  }
  return template.replace(PATRON_MARCADOR, function (coincidencia, nombre) {
    if (!Object.prototype.hasOwnProperty.call(values, nombre)) {
      throw new MissingPlaceholderError(nombre, template);
    }
    return String(values[nombre]);
  });
}

// Compara un paquete contra otro tomado como referencia. Sirve para que
// añadir un idioma no pierda textos en silencio: las claves que falten y las
// que sobren salen aquí, y decidir qué hacer con ellas es del consumidor.
export function verifyPack(pack, reference) {
  if (!pack || !pack.texts || !reference || !reference.texts) {
    throw new InvalidPackError();
  }
  const base = Object.keys(reference.texts);
  const otras = Object.keys(pack.texts);
  return {
    missing: base.filter(function (clave) {
      return !Object.prototype.hasOwnProperty.call(pack.texts, clave);
    }).sort(),
    extra: otras.filter(function (clave) {
      return !Object.prototype.hasOwnProperty.call(reference.texts, clave);
    }).sort(),
  };
}

export function createCatalog(pack, opciones = {}) {
  const fallback = opciones.fallback || null;
  if (!pack || typeof pack.language !== 'string' || !pack.texts) {
    throw new InvalidPackError();
  }
  return {
    language: pack.language,
    has: function (key) {
      return Object.prototype.hasOwnProperty.call(pack.texts, key);
    },
    text: function (key, values = {}) {
      if (Object.prototype.hasOwnProperty.call(pack.texts, key)) {
        return interpolate(pack.texts[key], values);
      }
      if (fallback && fallback.has(key)) {
        return fallback.text(key, values);
      }
      throw new MissingTextError(key, pack.language);
    },
    keys: function () {
      return Object.keys(pack.texts).sort();
    },
  };
}

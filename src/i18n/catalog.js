// Mecanismo de paquetes de idioma (REQ-12).
//
// La biblioteca no trae textos de dominio: trae la forma de resolverlos, el
// presupuesto dentro del que se puede hablar y la obligación de fallar en
// cerrado cuando falta un texto. Un texto ausente es un error, nunca una
// cadena vacía ni la clave cruda en pantalla.
//
// El módulo no conoce ningún idioma: no importa ningún paquete y no lleva sus
// textos. Las plantillas de los mensajes de fallo salen del paquete que el
// llamador declare en `options.messages` y, en su defecto, del paquete activo;
// sin plantilla disponible el error lleva un diagnóstico neutro —código y
// campos—, nunca el texto de otro idioma.

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

// Etiqueta BCP-47 (SPEC-007): subtag primario de 2 a 8 letras más subtags
// alfanuméricos de 1 a 8, o uso privado `x-…`. La comparación es exacta sobre
// la etiqueta en minúsculas: `ES` y `es` son la misma etiqueta, y el núcleo no
// sustituye `es-MX` por `es` ni al revés.
const LANGUAGE_TAG_PATTERN =
  /^(?:[a-z]{2,8}(?:-[a-z0-9]{1,8})*|x(?:-[a-z0-9]{1,8})+)$/;

// Presupuesto de lectura por omisión (SPEC-007): finito y provisional. Tiene
// que dominar al texto legítimo más largo que el núcleo compone y no ser más
// estricto que el tope de locución, del orden de 60 palabras.
export const DEFAULT_READ_BUDGET = Object.freeze({
  maxCharacters: 400,
  maxWords: 60,
});

const READ_BUDGET_CAPS = ['maxCharacters', 'maxWords'];

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeLanguage(language) {
  if (typeof language !== 'string') {
    return null;
  }
  const label = language.toLowerCase();
  return LANGUAGE_TAG_PATTERN.test(label) ? label : null;
}

// Un paquete válido es una etiqueta BCP-47 normalizable y un objeto `texts`
// con valores de texto no vacío: un valor de otro tipo publicaría texto
// inválido y uno vacío publicaría nada. El objeto sin claves se admite: todas
// sus claves se resolverían por el respaldo declarado y, sin él, fallarían en
// cerrado.
function validatePack(pack) {
  if (!isPlainObject(pack)) {
    return null;
  }
  const language = normalizeLanguage(pack.language);
  if (language === null || !isPlainObject(pack.texts)) {
    return null;
  }
  for (const key of Object.keys(pack.texts)) {
    const value = pack.texts[key];
    if (typeof value !== 'string' || value.length === 0) {
      return null;
    }
  }
  return { language: language, texts: pack.texts };
}

// `budget` es opcional; si falta rige el de omisión, que es finito. Un
// `budget` presente y mal formado es paquete inválido, nunca una omisión
// silenciosa del tope.
function resolveBudget(budget) {
  if (budget === undefined) {
    return {
      maxCharacters: DEFAULT_READ_BUDGET.maxCharacters,
      maxWords: DEFAULT_READ_BUDGET.maxWords,
    };
  }
  if (!isPlainObject(budget)) {
    return null;
  }
  const resolved = {};
  for (const cap of READ_BUDGET_CAPS) {
    const value = budget[cap];
    if (value === undefined) {
      resolved[cap] = DEFAULT_READ_BUDGET[cap];
      continue;
    }
    if (!Number.isInteger(value) || value < 1) {
      return null;
    }
    resolved[cap] = value;
  }
  for (const name of Object.keys(budget)) {
    if (!READ_BUDGET_CAPS.includes(name)) {
      return null;
    }
  }
  return resolved;
}

// Sustituye cada marca por su valor y deja la marca intacta si no lo tiene:
// se usa para componer mensajes de fallo, nunca para publicar texto.
function compose(template, values) {
  return template.replace(PLACEHOLDER_PATTERN, function (match, name) {
    return Object.prototype.hasOwnProperty.call(values, name)
      ? String(values[name])
      : match;
  });
}

// Diagnóstico neutro: el código del fallo y sus campos. No pertenece a ningún
// idioma, así que no acopla el módulo a un paquete cuando no hay plantilla.
function neutralDiagnostic(code, fields) {
  const names = Object.keys(fields).sort();
  if (names.length === 0) {
    return code;
  }
  const pairs = names.map(function (name) {
    return name + '=' + JSON.stringify(fields[name]);
  });
  return code + ' (' + pairs.join(', ') + ')';
}

// El texto humano de un fallo sale de las plantillas `catalog.*` de la fuente
// declarada. Sin plantilla disponible queda el diagnóstico neutro: nunca el
// texto de otro idioma ni una cadena vacía.
function errorMessage(source, key, code, fields) {
  if (source && isPlainObject(source.texts)
      && typeof source.texts[key] === 'string') {
    return compose(source.texts[key], fields);
  }
  return neutralDiagnostic(code, fields);
}

// Cuenta caracteres y palabras separadas por espacios, como fija SPEC-007 en
// su primera versión. `code` nombra el fallo declarado —`over_budget`— de un
// texto que no cabe: la compuerta que decide no hablarlo pertenece a
// SPEC-006, no a este módulo.
function measureText(text, budget) {
  const characters = Array.from(text).length;
  const words = text.split(/\s+/).filter(function (word) {
    return word.length > 0;
  }).length;
  const within = characters <= budget.maxCharacters
    && words <= budget.maxWords;
  return {
    characters: characters,
    words: words,
    within: within,
    code: within ? null : 'over_budget',
  };
}

export class MissingTextError extends Error {
  constructor(key, language, messages) {
    super(errorMessage(messages, 'catalog.missing_text', 'missing_text',
      { key: key, language: language }));
    this.name = 'MissingTextError';
    this.code = 'missing_text';
    this.key = key;
    this.language = language;
  }
}

export class MissingPlaceholderError extends Error {
  constructor(name, template, messages) {
    super(errorMessage(messages, 'catalog.missing_placeholder', 'missing_text',
      { name: name, template: template }));
    this.name = 'MissingPlaceholderError';
    this.code = 'missing_text';
    this.missing = name;
    this.template = template;
  }
}

export class InvalidPackError extends TypeError {
  constructor(messages) {
    super(errorMessage(messages, 'catalog.invalid_pack', 'invalid_config', {}));
    this.name = 'InvalidPackError';
    this.code = 'invalid_config';
  }
}

// Sustituye cada `{nombre}` por su valor. Un marcador sin valor es un error:
// publicar un texto a medias es peor que no publicarlo. `messages` es el
// paquete del que salen las plantillas de los mensajes de fallo; sin él, el
// error lleva un diagnóstico neutro.
export function interpolate(template, values = {}, messages = null) {
  if (typeof template !== 'string') {
    throw new TypeError('interpolate espera una plantilla de texto.');
  }
  return template.replace(PLACEHOLDER_PATTERN, function (match, name) {
    if (!Object.prototype.hasOwnProperty.call(values, name)) {
      throw new MissingPlaceholderError(name, template, messages);
    }
    return String(values[name]);
  });
}

// Compara un paquete contra otro tomado como referencia. Sirve para que
// añadir un idioma no pierda textos en silencio: las claves que falten y las
// que sobren salen aquí, y decidir qué hacer con ellas es del consumidor.
export function verifyPack(pack, reference) {
  const current = validatePack(pack);
  const base = validatePack(reference);
  if (current === null || base === null) {
    throw new InvalidPackError(current === null ? base : current);
  }
  const keys = Object.keys(base.texts);
  const others = Object.keys(current.texts);
  return {
    missing: keys.filter(function (key) {
      return !Object.prototype.hasOwnProperty.call(current.texts, key);
    }).sort(),
    extra: others.filter(function (key) {
      return !Object.prototype.hasOwnProperty.call(base.texts, key);
    }).sort(),
  };
}

export function createCatalog(pack, options = {}) {
  const declaredMessages = options.messages === undefined
    ? null
    : validatePack(options.messages);
  if (options.messages !== undefined && declaredMessages === null) {
    throw new InvalidPackError(null);
  }
  const current = validatePack(pack);
  if (current === null) {
    throw new InvalidPackError(declaredMessages);
  }
  const messages = declaredMessages === null ? current : declaredMessages;
  const budget = resolveBudget(pack.budget);
  if (budget === null) {
    throw new InvalidPackError(messages);
  }
  const fallback = options.fallback === undefined ? null : options.fallback;
  if (fallback !== null
      && (typeof fallback.has !== 'function'
        || typeof fallback.text !== 'function')) {
    throw new InvalidPackError(messages);
  }
  const resolvedBudget = Object.freeze({
    maxCharacters: budget.maxCharacters,
    maxWords: budget.maxWords,
  });

  function hasOwn(key) {
    return Object.prototype.hasOwnProperty.call(current.texts, key);
  }

  function resolve(key, values = {}) {
    if (hasOwn(key)) {
      return {
        text: interpolate(current.texts[key], values, messages),
        language: current.language,
        source: 'pack',
      };
    }
    if (fallback !== null && fallback.has(key)) {
      const fromFallback = typeof fallback.resolve === 'function'
        ? fallback.resolve(key, values)
        : { text: fallback.text(key, values), language: fallback.language };
      return {
        text: fromFallback.text,
        language: fromFallback.language,
        source: 'fallback',
      };
    }
    throw new MissingTextError(key, current.language, messages);
  }

  return {
    language: current.language,
    budget: resolvedBudget,
    // `has` responde por lo que el catálogo puede resolver, respaldo
    // declarado incluido; `keys` sigue siendo las claves del paquete.
    has: function (key) {
      return hasOwn(key) || (fallback !== null && fallback.has(key));
    },
    resolve: resolve,
    text: function (key, values = {}) {
      return resolve(key, values).text;
    },
    measure: function (text) {
      if (typeof text !== 'string') {
        throw new TypeError('measure espera el texto compuesto.');
      }
      return measureText(text, resolvedBudget);
    },
    keys: function () {
      return Object.keys(current.texts).sort();
    },
  };
}

// Punto de entrada público de la biblioteca.
//
// Lo que no esté exportado aquí no es superficie pública. La del núcleo de
// voz son la fábrica de sesión, su declaración de capacidades, las fases, los
// presupuestos y los dos errores de frontera.

export const NAME = 'lalia-akuo';
export const VERSION = '0.1.0';

export {
  createCatalog,
  interpolate,
  verifyPack,
  InvalidPackError,
  MissingPlaceholderError,
  MissingTextError,
  DEFAULT_READ_BUDGET,
} from './i18n/catalog.js';

export { PACK_ES } from './i18n/es.js';

export { CAPABILITIES, PHASES, createVoiceSession } from './core/session.js';
export { SPEECH_BUDGET_MS, TURN_BUDGET_MS } from './core/ports.js';
export { ConfigError } from './core/policy.js';
export { PortContractError } from './core/ports.js';

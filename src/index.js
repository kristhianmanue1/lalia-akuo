// Punto de entrada público de la biblioteca.
//
// El núcleo de voz todavía no existe: lo que hay publicado hoy es el
// andamiaje del proyecto y su primer mecanismo real, el de paquetes de
// idioma. Todo lo que no esté exportado aquí no es superficie pública.

export const NAME = 'lalia-akuo';
export const VERSION = '0.1.0';

export {
  createCatalog,
  interpolate,
  verifyPack,
  InvalidPackError,
  MissingPlaceholderError,
  MissingTextError,
} from './i18n/catalog.js';

export { PACK_ES } from './i18n/es.js';

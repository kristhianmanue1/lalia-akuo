// Paquete de idioma español.
//
// Contiene los mensajes propios de la biblioteca, no los del consumidor: los
// textos de dominio los aporta cada proyecto en su propio paquete. Es el
// primer paquete, y el mecanismo que lo resuelve existe desde la primera
// versión para que el inglés entre después sin tocar el núcleo (REQ-12).
//
// Los mensajes de error se construyen desde aquí para que la biblioteca
// pueda usarse antes de que nadie configure nada.

export const PACK_ES = {
  language: 'es',
  texts: {
    'catalog.missing_text':
      'Falta el texto «{key}» en el paquete «{language}».',
    'catalog.missing_placeholder':
      'Falta el valor «{name}» para el texto «{template}».',
    'catalog.invalid_pack':
      'El paquete de idioma necesita «language» y «texts».',
  },
};

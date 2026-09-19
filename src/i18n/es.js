// Paquete de idioma español.
//
// Contiene los mensajes propios de la biblioteca, no los del consumidor: los
// textos de dominio los aporta cada proyecto en su propio paquete. Es el
// primer paquete, y el mecanismo que lo resuelve existe desde la primera
// versión para que el inglés entre después sin tocar el núcleo (REQ-12).
//
// Trae las catorce claves cerradas de la biblioteca que fija SPEC-007: las
// tres de `catalog.*`, con las que el catálogo compone sus mensajes de fallo
// cuando este paquete es el activo, y las once de la interfaz mínima que
// consume SPEC-009.

export const PACK_ES = {
  language: 'es',
  texts: {
    'catalog.missing_text':
      'Falta el texto «{key}» en el paquete «{language}».',
    'catalog.missing_placeholder':
      'Falta el valor «{name}» para el texto «{template}».',
    'catalog.invalid_pack':
      'El paquete de idioma necesita «language» y «texts».',
    'controls.start': 'Iniciar',
    'controls.microphoneMute': 'Silenciar el micrófono',
    'controls.speechMute': 'Silenciar la voz',
    'controls.textInput': 'Escribir el valor',
    'controls.stateIndicator': 'Estado de la conversación',
    'announce.state.idle': 'En espera',
    'announce.state.listening': 'Escuchando',
    'announce.state.thinking': 'Pensando',
    'announce.state.speaking': 'Hablando',
    'announce.state.error': 'Ha ocurrido un error',
    'notice.offDeviceAudio':
      'El audio puede procesarse fuera de este dispositivo.',
  },
};

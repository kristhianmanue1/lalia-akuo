# ADR-005: Sin servidor MCP en la primera versión

**Estado:** aceptado. Implementación: no iniciada (etapa posterior al núcleo).
**Fecha:** 18-sep-2026.
**Fuente:** instrucción humana del 18-sep-2026 (`alubia:PROP-005 §8`,
PREGUNTA-4).

## Contexto

Exponer la sesión como herramientas para que un host de agente la conduzca es
un objetivo plausible, y la recomendación técnica previa era publicarlo como
paquete separado con la versión de especificación fijada. En contra: la
especificación de MCP cambió dos veces en un año, con `initialize` y sesiones
eliminados; sostener ese ciclo de vida sin consumidores reales consume
esfuerzo de compatibilidad.

MCP no es, además, un protocolo de navegador: `stdio` es inalcanzable desde
una página, el transporte HTTP exige que el servidor valide `Origin`, la
especificación no menciona CORS, y una aplicación de una sola página no puede
custodiar un token de refresco de forma confidencial.

## Decisión

**No** se publica servidor MCP en la primera versión. Cuando llegue, será
**paquete aparte** con la **versión de especificación fijada**, y su
superficie de herramientas habrá estado declarada desde antes.

## Alternativas descartadas

- **Publicarlo en la primera versión como paquete separado.** Descartada por
  instrucción humana: obliga a soportar un ciclo de vida de especificación
  inestable antes de tener consumidores que lo justifiquen.
- **Cliente MCP dentro del navegador.** Inviable por transporte y por
  custodia de credenciales; el patrón correcto es que el navegador hable con
  el backend del consumidor y el backend hable MCP.
- **Ampliar la primera versión para incluir el paquete MCP y su relay.**
  Mezcla la etapa de publicación con la de estabilización del núcleo.

## Consecuencias

- Ninguna dependencia del SDK de MCP en los paquetes de la primera versión.
- La superficie de herramientas del agente se declara aparte y sin autoridad
  sobre estado ni persistencia; es lo que el paquete posterior expondrá.
- El paquete futuro hereda prohibiciones ya fijadas: `Origin` validado con
  rechazo, token por sesión y `stdio` nunca expuesto al navegador.
- Fijar la versión de especificación será parte del contrato de ese paquete,
  no de este documento.

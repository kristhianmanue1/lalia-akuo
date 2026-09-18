# ADR-008: Solo las costuras para el modelo de IA

**Estado:** aceptado. Implementación: no iniciada (F1 en diseño).
**Fecha:** 18-sep-2026.
**Fuente:** instrucción humana del 18-sep-2026, subrayada dos veces: «se
podrá integrar modelo de IA, no en su inicio, y eso se debe tomar en cuenta
para no rehacer mucho código» (`alubia:PROP-005 §8`, PREGUNTA-7; `§7`).

## Contexto

Un modelo puede mejorar la redacción de preguntas, la interpretación de
lenguaje libre y la elección de la respuesta siguiente. Implementarlo ahora
obligaría a elegir proveedor, custodiar credenciales y aprobar una política de
datos antes de tener consumidores ni casos de uso concretos.

No preverlo tampoco es gratis: hoy la interpretación es síncrona, el guion
tiene los textos dentro y la decisión de qué hacer está mezclada con su
redacción. Habilitar un modelo sobre ese diseño obligaría a introducir
esperas en el camino crítico, a cambiar la forma de los puertos y a sacar del
núcleo contadores y umbrales.

## Decisión

En la primera versión se implementan **solo las costuras**: los puntos donde
un modelo entraría después. El modo por omisión es **determinista**; el modo
**asistido** se activa únicamente por configuración explícita del consumidor,
nunca por detección de disponibilidad.

Las costuras que se abren son exactamente las que son baratas de hacer hoy y
caras de omitir: puertos asíncronos, cancelables y con presupuesto; textos
como datos con claves marcadas; la interpretación detrás de un puerto; la
redacción sustituible y la decisión no; el modo declarado con caída al
determinista; y la superficie de herramientas del agente como catálogo.

## Alternativas descartadas

- **Implementar el puerto asistido en la primera versión.** Obliga a elegir
  proveedor, custodia de credenciales y política de datos sin un caso de uso
  que las justifique.
- **Dejarlo fuera del diseño por completo.** Es la alternativa cuyo coste se
  conoce: reescritura de la disciplina de turno, de los puertos y del guion.
- **Abrir más costuras «por si acaso».** La generalidad especulativa no
  entra: se abre costura solo donde el coste de hoy es trivial y la omisión
  obliga a reescribir el núcleo.
- **Poner la decisión dentro de la pieza sustituible.** Un puerto que decide
  podría repreguntar sin fin o no agotar la salida a texto; los invariantes
  de la confirmación quedarían dentro de lo sustituible.

## Consecuencias

- Todo puerto devuelve promesa, acepta cancelación y declara presupuesto;
  sin ello, el control de silencio no puede detener una respuesta en vuelo.
- El núcleo posee los contadores y los umbrales, y calcula el conjunto de
  decisiones admisibles. El puerto propone o redacta y solo puede devolver un
  elemento de ese conjunto; cualquier otra cosa es fallo del puerto.
- Alcance aclarado en F1 al cerrar la pregunta G: el núcleo conserva los
  contadores y la garantía de intento finito con salida a texto, y el valor
  numérico de los umbrales lo declara el consumidor, porque una cifra heredada
  de otro dominio es política de ese dominio (REQ-10 y `AGENTS.md`). La
  decisión de este ADR no cambia; el cierre está en
  `docs/product/definicion-tecnica.md` §9.3.
- Los textos que llevan el dato —readback, resumen, anuncio de guardado— no
  pasan por el puerto de redacción: los compone el núcleo con el valor ya
  validado.
- La caída al determinista ocurre **antes** del primer evento audible del
  turno; nunca queda una locución a medias del modelo.
- La latencia del puerto asistido entra en el camino crítico de cada turno,
  así que el presupuesto por turno y su degradación son parte del contrato.
- El modo `asistido` no se documenta como estable para terceros antes de que
  se mida la latencia que añade.
- Lo que las costuras **no** evitan: que el diálogo crezca. Añadir preguntas
  y explicaciones exige extender la tabla de decisiones del núcleo; se
  declara por etapa, no se presenta como sustitución de puerto.

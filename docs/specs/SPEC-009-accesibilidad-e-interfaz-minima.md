# SPEC-009 — Accesibilidad e interfaz mínima

**Fase:** F1 — entregable de E1 (primera oleada).
**Cubre:** `REQ-9`, `REQ-16`.
**Procedencia:** `../product/definicion-tecnica-nucleo.md` §4.2, §4.7 y §4.9;
`../product/definicion-tecnica-frontera.md` §3.1 y §3.2;
`../product/definicion-tecnica.md` §9.3 (preguntas D y F) y §10;
`../product/plan.md` §5.1 (`REQ-9`) y §5.3 (`REQ-16`);
`../adr/ADR-006-language-packs-spanish-first.md`; instrucción directa del
humano en la tarea que encarga esta spec: el aviso de que el audio puede
procesarse fuera del dispositivo es visible **antes** de conceder el
micrófono.
**Depende de:** [`SPEC-001`](SPEC-001-contrato-del-nucleo.md) —sesión,
estados visibles, eventos y las dos operaciones de silencio—. Esta spec no
re-nombra nada de allí.
**Formato:** `../ai-agent-guide/02-specs-adr-contratos.md` §2.2.

```text
SPEC-009 [cubre: REQ-9, REQ-16]
```

## Comportamiento

La interfaz mínima de conversación es una **capa propia**: vive sobre la
sesión de `SPEC-001`, consume sus callbacks y no conoce el estado interno de
la sesión salvo lo que el núcleo publica
(`../product/definicion-tecnica-frontera.md` §3.2). No decide transiciones:
pide `start()`, `submitText()`, `setMicrophoneMuted()` y `setSpeechMuted()`,
y dibuja lo que el núcleo emite. El núcleo sigue funcionando sin ella
(`SPEC-001`, C-001-06).

**Los elementos.** Cuatro controles operables y el indicador:

| rol | elemento | operación | nombre accesible |
|---|---|---|---|
| `start` | botón | `session.start()` | del catálogo |
| `microphoneMute` | interruptor | `session.setMicrophoneMuted(bool)` | del catálogo |
| `speechMute` | interruptor | `session.setSpeechMuted(bool)` | del catálogo |
| `textInput` | campo y envío | `session.submitText(text)` | del catálogo |
| `stateIndicator` | indicador | ninguna | del catálogo |

`REQ-9` pide «iniciar, silenciar, escribir y un estado de escucha visible»:
cuatro elementos, de los que el silencio se materializa en **dos** controles
—el del micrófono y el de la voz del agente no son el mismo, tienen rótulo
propio y estado propio— y el estado visible no es operable. De ahí los cinco
elementos de la tabla.

**Todo texto sale del catálogo por clave** (`ADR-006`; §9.3, pregunta D).
La interfaz no contiene literales en ningún idioma: rótulos, anuncios,
aviso y nombres de estado se resuelven por rol contra el catálogo que el
consumidor aporta. La forma literal de cada clave la fija
[`SPEC-007`](SPEC-007-catalogo-de-idioma.md); esta spec fija **qué roles
existen** y que su ausencia es `missing_text`, nunca texto vacío,
improvisado o la clave cruda.

**Un anuncio por cambio de estado.** Cada evento `state_changed` de
`SPEC-001` produce **exactamente un** anuncio accesible, en una región de
anuncios declarada, con el texto del estado resuelto del catálogo. No hay
anuncio sin evento, ni dos anuncios para un evento, ni anuncio por audio:
el canal es la región, que un lector de pantalla lee sin oír la síntesis.

**Sin oír, la información está en pantalla.** El texto que el consumidor ya
recibe en `displayText` —pregunta, petición de confirmación con el valor a
confirmar, necesidad de entrada manual con su motivo, fallo y aviso de
guardado— se presenta como texto antes de exigir la acción, y es alcanzable
con el teclado. `speechText` nunca lleva información ausente de
`displayText` (`SPEC-001`, C-001-12).

**Movimiento reducido.** Si la preferencia `prefers-reduced-motion` vale
`reduce`, no hay animación no esencial, y el estado se sigue distinguiendo
por texto. Si la preferencia no es evaluable, rige el movimiento reducido:
es la omisión segura para la accesibilidad, no un supuesto sobre el motor.

**Contraste suficiente.** La presentación por omisión de la interfaz
satisface el umbral AA de WCAG 2.1 (4.5:1 en texto normal, 3:1 en texto
grande y en límites de componente). El consumidor puede declarar su tema y
la interfaz lo comprueba al montar; un tema por debajo del umbral se rechaza
**entero** —no se aplica a medias—, se declara el rechazo y rige la
presentación por omisión. El estado nunca se comunica sólo por color.

**Aviso de audio fuera del dispositivo.** El núcleo no garantiza que el
audio no salga del dispositivo, porque el reconocimiento nativo puede
resolver contra un tercero (`../product/definicion-tecnica-nucleo.md` §4.9).
Antes de que la interfaz provoque **cualquier** petición de micrófono, el
aviso se ha presentado como texto visible, resuelto del catálogo, y la
persona ha activado `start`. Sin la clave del aviso no hay petición de
micrófono: el flujo sigue disponible por texto. El aviso sigue alcanzable
después, para poder releerlo.

**Camino completo sin oír y sin micrófono.** `REQ-16` se cumple en su
criterio literal: un turno completo —pregunta, entrada, confirmación con el
valor, guardado— se recorre sólo con teclado y con lector de pantalla, sin
oír la síntesis y sin que se invoque el micrófono. `REQ-9` se cumple con los
cinco elementos presentes, el estado perceptible sin oír y la entrada por
texto disponible en todo estado, nunca como castigo (`SPEC-001`, C-001-14).

## Entradas

- La `session` de `createVoiceSession(config)` (`SPEC-001`) y su `onEvent`.
- El catálogo del paquete de idioma, del que se resuelven los roles
  `controls.start`, `controls.microphoneMute`, `controls.speechMute`,
  `controls.textInput`, `controls.stateIndicator`, `announce.state.<estado>`,
  `notice.offDeviceAudio` y las claves de fallo que `SPEC-001` ya exige.
- El punto de montaje: un elemento del documento que la interfaz recibe, no
  que busca.
- La preferencia de movimiento del entorno y el tema declarado por el
  consumidor, si lo aporta.
- La activación de la persona: teclado, puntero o lector de pantalla sobre
  los controles.

## Salidas

- Los cinco elementos montados dentro del punto de montaje, cada uno con
  nombre accesible resuelto del catálogo.
- Un anuncio por cada `state_changed`, en la región de anuncios, y el estado
  vigente visible en el indicador.
- Las llamadas a la sesión: `start()`, `submitText(text)`,
  `setMicrophoneMuted(bool)` y `setSpeechMuted(bool)`.
- El aviso de audio fuera del dispositivo, visible antes de la primera
  petición de micrófono.
- El rechazo declarado de un tema por debajo del umbral, cuando ocurre.
- Nada fuera del punto de montaje; la interfaz no abre red ni escribe
  almacenamiento por su cuenta (`SPEC-001`, `CAPABILITIES`).

## Errores

El código `missing_text` es el que `SPEC-001` ya fija para una clave del
catálogo ausente; `unknown_state`, `invalid_contrast` y
`missing_announcement_surface` son de la **interfaz** y viven en su propio
enumerado cerrado, que no sustituye al catálogo de eventos del núcleo.
Ningún fallo de la interfaz produce silencio ni texto improvisado: siempre
hay una salida declarada.

| condición | `code` | estado que queda |
|---|---|---|
| falta la clave del rótulo de un control | `missing_text` | el control **no** se monta sin nombre accesible; no se improvisa texto; los demás elementos siguen y el texto sigue disponible |
| falta la clave del anuncio de un estado | `missing_text` | no se anuncia texto improvisado; el fallo se declara y el estado sigue visible en el indicador |
| falta la clave del aviso de audio fuera del dispositivo | `missing_text` | **no se pide micrófono nunca**; `start` no provoca escucha; la entrada por texto sigue completa |
| el núcleo emite un estado fuera de los cinco visibles | `unknown_state` | no se inventa etiqueta: el indicador pasa al estado `error` declarado, se anuncia como fallo y no se sigue mostrando el estado anterior como vigente |
| el tema declarado no alcanza el umbral de contraste | `invalid_contrast` | el tema se rechaza entero, se declara el rechazo y rige la presentación por omisión, que sí lo alcanza |
| la región de anuncios no está montada | `missing_announcement_surface` | se declara; la interfaz **no** declara cumplido `REQ-16`; el resto sigue operativo |
| llega un segundo anuncio para el mismo `state_changed` | — (descartado) | el duplicado no se emite: el contrato es un anuncio por cambio |
| la preferencia de movimiento no es evaluable | — (omisión segura) | se aplica movimiento reducido |

Fail-closed: sin aviso no hay micrófono; sin clave no hay texto; sin umbral
no hay tema; sin región no hay declaración de accesibilidad.

## Casos

Identificador estable; los casos nuevos se añaden con el siguiente número
libre, nunca se insertan ni se renumeran los existentes.

- **C-009-01** DADO una sesión determinista y un catálogo con los roles
  declarados CUANDO se monta la interfaz ENTONCES existen `start`,
  `microphoneMute`, `speechMute`, `textInput` y `stateIndicator`, los cuatro
  primeros operables y cada uno con nombre accesible resuelto del catálogo
  (`REQ-9`).
- **C-009-02** DADO dos catálogos con textos distintos en los mismos roles
  CUANDO se monta la interfaz con cada uno ENTONCES todos los rótulos,
  anuncios y el aviso cambian con el catálogo y ninguna cadena literal del
  paquete de la interfaz aparece en el documento (`REQ-9`, `ADR-006`).
- **C-009-03** DADO un catálogo al que le falta la clave del rótulo de un
  control CUANDO se monta la interfaz ENTONCES ese control no se monta sin
  nombre accesible, no aparece ningún texto improvisado ni la clave cruda,
  el fallo se reporta con `missing_text` y los demás elementos siguen
  operativos (`REQ-9`).
- **C-009-04** DADO la interfaz montada con la región de anuncios
  instrumentada CUANDO el núcleo emite N eventos `state_changed` ENTONCES se
  producen exactamente N anuncios, uno por evento y en el mismo orden
  (`REQ-16`).
- **C-009-05** DADO la interfaz montada CUANDO el núcleo emite eventos que no
  son `state_changed` ENTONCES no se emite ningún anuncio de estado, y toda
  petición de confirmación, necesidad de entrada manual, fallo y aviso de
  guardado aparece como texto en pantalla antes de exigir la acción
  (`REQ-16`).
- **C-009-06** DADO la interfaz montada CUANDO se activa
  `microphoneMute` ENTONCES el estado y el rótulo de `speechMute` no
  cambian; y CUANDO se activa `speechMute` ENTONCES los de `microphoneMute`
  no cambian (`REQ-9`).
- **C-009-07** DADO el micrófono silenciado CUANDO el núcleo cambia de estado
  ENTONCES el indicador no muestra animación de escucha y el estado visible
  nunca es `listening` con el micrófono apagado (`REQ-9`,
  `../product/definicion-tecnica-nucleo.md` §4.7).
- **C-009-08** DADO la interfaz montada y ningún uso de puntero CUANDO se
  conduce un turno completo con teclado —enfocar `start`, activarlo,
  escribir en `textInput`, enviar y confirmar— ENTONCES se llega a
  `value_confirmed` (`REQ-16`).
- **C-009-09** DADO la interfaz montada y el permiso de micrófono
  instrumentado CUANDO se recorre un turno completo por texto ENTONCES
  ninguna petición de micrófono se realiza y el turno llega a su desenlace
  (`REQ-16`).
- **C-009-10** DADO la síntesis silenciada o no disponible CUANDO se recorre
  un turno completo ENTONCES cada información necesaria —pregunta,
  confirmación con el valor, resultado del guardado— está disponible como
  texto y el turno concluye (`REQ-16`).
- **C-009-11** DADO la interfaz montada con el audio instrumentado CUANDO se
  produce un cambio de estado ENTONCES el anuncio se entrega sólo por la
  región de anuncios y no depende de que haya locución (`REQ-16`).
- **C-009-12** DADO la preferencia de movimiento en `reduce` CUANDO se
  producen cambios de estado ENTONCES no hay animación no esencial y el
  estado se sigue distinguiendo por texto (`REQ-16`).
- **C-009-13** DADO un tema declarado CUANDO se calcula el contraste de sus
  pares según WCAG 2.1 ENTONCES un tema por debajo del umbral AA se rechaza
  entero, se declara con `invalid_contrast` y rige la presentación por
  omisión; un tema que lo alcanza se aplica (`REQ-16`).
- **C-009-14** DADO cada uno de los cinco estados visibles CUANDO se
  inspecciona el indicador ENTONCES cada estado tiene texto propio y se
  distingue por un canal distinto del color (`REQ-9`).
- **C-009-15** DADO la interfaz recién montada CUANDO se activa `start`
  ENTONCES el aviso de audio fuera del dispositivo ya estaba visible y la
  petición de micrófono —instrumentada— ocurre después del aviso (`REQ-9`).
- **C-009-16** DADO la interfaz montada y las APIs de red y de
  almacenamiento instrumentadas para fallar CUANDO se recorre un turno
  ENTONCES la interfaz no invoca ninguna de ellas (`REQ-9`).
- **C-009-17** DADO un catálogo sin la clave del aviso de audio fuera del
  dispositivo CUANDO se activa `start` ENTONCES no se realiza ninguna
  petición de micrófono, el fallo se reporta con `missing_text` y el flujo
  por texto sigue completo (`REQ-9`).
- **C-009-18** DADO que la preferencia de movimiento no es evaluable CUANDO
  se producen cambios de estado ENTONCES rige el movimiento reducido
  (`REQ-16`).

## Invariantes

- Los cinco elementos existen, con nombre accesible resuelto del catálogo y
  sin literales de ningún idioma dentro de la interfaz.
- El silencio del micrófono y el de la voz son controles distintos, con
  estado distinto y efecto verificable por prueba.
- Cada `state_changed` produce exactamente un anuncio; ningún anuncio nace
  sin evento.
- El estado se percibe sin oír: siempre hay texto, y el color nunca es el
  único canal.
- Toda la información que `speechText` lleva está también en `displayText`,
  y el texto es alcanzable con el teclado.
- No se pide micrófono sin que el aviso se haya presentado; sin su clave no
  se pide.
- La interfaz no decide transiciones, no toca red, no persiste y no es
  requisito para que el núcleo funcione.
- Un fallo de la interfaz siempre deja salida declarada: nunca silencio,
  nunca texto improvisado.

**Cobertura de requisitos.** `REQ-9`: C-009-01, C-009-02, C-009-03,
C-009-06, C-009-07, C-009-14, C-009-15, C-009-16, C-009-17. `REQ-16`:
C-009-04, C-009-05, C-009-08, C-009-09, C-009-10, C-009-11, C-009-12,
C-009-13, C-009-18.

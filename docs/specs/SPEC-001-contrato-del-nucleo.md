# SPEC-001 — Contrato del núcleo

**Fase:** F1 — entregable de E1 (primera oleada).
**Cubre:** `REQ-1`, `REQ-6`, `REQ-10`, `REQ-11`.
**Procedencia:** `../product/definicion-tecnica-nucleo.md` §4.1 a §4.9;
`../product/definicion-tecnica.md` §9.3 y §10;
`../adr/ADR-001-mechanism-policy-boundary.md`;
`../adr/ADR-006-language-packs-spanish-first.md`;
`../adr/ADR-007-no-persistence.md`;
`../adr/ADR-008-ai-model-seams-only.md`; `alubia:PROP-005 §6.1` y `§7`.
**Formato:** `../ai-agent-guide/02-specs-adr-contratos.md` §2.2.
**Vocabulario.** Los identificadores y las claves van en inglés
(`AGENTS.md`, «Convenciones de edición»). Donde la procedencia los escribe
en español, esta spec declara la equivalencia en la tabla correspondiente y
el nombre inglés es el que citan las demás spec de E1.

```text
SPEC-001 [cubre: REQ-1, REQ-6, REQ-10, REQ-11]
```

## Comportamiento

`createVoiceSession(config)` construye una **sesión de voz aislada** y la
devuelve. La sesión conduce un turno completo —preguntar, escuchar,
interpretar, confirmar— sin tocar el DOM, sin abrir red, sin escribir
almacenamiento y sin registrar por su cuenta. Lo observable es esto:

1. **Creación.** Si `config` no satisface este contrato, se lanza un
   `ConfigError` y **no se devuelve sesión**: no queda un objeto a medio
   construir. Si lo satisface, la sesión nace en `state = 'idle'`, en
   `mode = 'deterministic'`, con `values` vacío y sin haber tocado el DOM.
2. **Conducción.** `start()` arranca el flujo. Cada paso se anuncia por el
   destino de eventos y el estado visible cambia con él. El núcleo **no
   escribe texto**: lo pide al catálogo por clave.
3. **Observación.** El consumidor observa por `onEvent` y por las
   propiedades `state`, `mode` y `values`. Sin `onEvent`, la sesión lo
   declara: no hay auditoría, y eso no es un fallo.
4. **Degradación.** Cuando el flujo no puede seguir por voz, pide entrada
   manual y dice por qué. La entrada por texto está disponible en todo
   estado y nunca como castigo (`REQ-9` se prueba en E4).
5. **Aislamiento.** Dos sesiones en el mismo documento no comparten estado
   mutable. Importar el módulo no ejecuta efectos.

**Declaración de capacidades (`REQ-11`).** El módulo exporta
`CAPABILITIES`, un objeto congelado y legible sin leer el código, que
declara qué hace y qué no el núcleo. Es contrato, no comentario: si el
núcleo cambiara de polaridad, `CAPABILITIES` cambia con él y una prueba
falla.

```text
CAPABILITIES = {
  opensNetwork:   false,   // el núcleo no abre red
  persists:       false,   // no guarda entre sesiones
  writesStorage:  false,   // no escribe almacenamiento del navegador
  writesLogs:     false,   // no registra por su cuenta
  touchesDom:     false,   // cero DOM
  requiresExplicitConfirmation: true,
  closesTurnsBy:  'real_signal',
}
```

**Frontera con los adaptadores.** El núcleo no abre red; el adaptador de voz
sí puede, porque el reconocimiento nativo del navegador puede resolver
contra un tercero. `CAPABILITIES` declara el núcleo, nunca la sesión
completa (`definicion-tecnica-nucleo.md` §4.9): prometer lo contrario sería
simular una garantía que el núcleo no gobierna.

## Entradas

`config` es un objeto **cerrado**: una clave desconocida se rechaza, no se
ignora. Tiene **seis familias** más la clave inyectada suelta
`getPreviousValue`: las familias son las de §4.1.1 y esta spec fija su
forma.

| clave | tipo | obligatoria | significado |
|---|---|---|---|
| `fields` | `Field[]`, no vacío | sí | campos declarativos |
| `language` | `{ pack, fallback? }` | sí | paquete de idioma y catálogo |
| `policy` | `Policy` | sí | política declarada |
| `mode` | `'deterministic' \| 'assisted'` | no (`'deterministic'`) | modo de la sesión |
| `ports` | `Ports` | no | puertos; hay omitidos deterministas |
| `onEvent` | `(event) => void` | no | destino de eventos de sesión |
| `getPreviousValue` | `(fieldId) => unknown` | no | valor previo inyectado |

`language` **es la familia 2 de §4.1.1** —`language: { pack, fallback? }`—;
esta spec no la añade, sólo fija su forma. §6.1 exige que las claves del
catálogo lleguen por paquete, §4.4 exige que el núcleo componga el texto que
lleva el dato a partir del catálogo —no del puerto de redacción— y
`ADR-006` prohíbe que el núcleo asuma español. Sin `language` no hay clave
que resolver y ningún texto puede salir. La forma `{ pack, fallback? }` es
la que ya existe en `../../src/i18n/catalog.js`.

`Field` (equivalencia: `campos[]` de §4.1.1):

| clave | tipo | obligatoria | significado |
|---|---|---|---|
| `id` | `string` | sí | identificador del campo; lo elige el consumidor |
| `type` | `'number' \| 'integer' \| 'boolean' \| 'text'` | sí | tipo esperado |
| `range` | `{ min, max }` | no | sólo numéricos; `min <= max` |
| `unit` | `string` | no | unidad que declara el consumidor, no el núcleo |
| `promptKey` | `string` | sí | clave del catálogo con la pregunta |
| `deltaPolicy` | `{ maxDifference, onExceeded }` | no | comparación con el valor previo |

`promptKey` es una **clave**, no un texto: `ADR-006` exige que todo texto
visible salga del catálogo por clave. Por eso la procedencia dice
`textoPregunta` y aquí dice `promptKey`. Igual con `unit` y `range`: el
núcleo los transporta y los valida, nunca decide su valor (`REQ-10`).

`deltaPolicy` y `getPreviousValue` son **opcionales y obran juntos**: con
los dos declarados, el núcleo calcula la diferencia absoluta entre el valor
resuelto y el valor previo que devuelve `getPreviousValue(field.id)`, y si
supera `maxDifference` aplica `onExceeded`, cuyo efecto observable es
cerrado:

- `none`: ninguna acción adicional; el valor sigue el camino normal de
  confirmación.
- `reconfirm`: el valor no se acepta en esa pasada; el núcleo repite el
  readback y pide la confirmación una segunda vez antes de escribir, con el
  par (`speaking`, `confirming`) de
  [`SPEC-005`](SPEC-005-maquina-de-estados-y-fases.md).

`maxDifference` es un número no negativo que declara el consumidor; el
núcleo sólo compara, nunca decide el valor (`REQ-10`). Un `deltaPolicy` mal
formado, o un `onExceeded` fuera de los dos valores, es `invalid_config`.

`Policy` (equivalencia: §4.5):

| clave | tipo | obligatoria | significado |
|---|---|---|---|
| `degradation` | `{ noticeKey, maxConsecutiveFailures? }` | sí | cómo se muestra la degradación y cuándo degrada |
| `confirmation` | `{ maxAttempts? }` | no | intentos no resueltos del mismo paso antes de degradar |
| `blockedClasses` | `('form' \| 'conversational')[]` | no | clases de seguridad que cierran la compuerta; el enumerado cerrado lo fija [`SPEC-006`](SPEC-006-politica-declarada-y-compuerta.md) y un miembro fuera de él es `invalid_config` |
| `safeTextKey` | `string` | no | clave del texto seguro |
| `immutableTextKeys` | `string[]` | no | claves que no admiten redacción sustituida |
| `filter` | `object` | no | punto donde se declara qué se filtra |
| `data` | `object` | no | punto donde se declara qué sale, a quién y con qué retención |

`degradation.maxConsecutiveFailures` es un entero positivo finito: los fallos
consecutivos del mismo paso que la sesión admite antes de degradar a la
entrada manual. Ausente, vale **1**: ante el primer fallo del paso la sesión
degrada. El núcleo sólo garantiza que el contador sea finito y que su
desenlace sea una salida declarada; el número es política del consumidor. Un
valor que no sea un entero positivo finito es `invalid_config`.

`confirmation.maxAttempts` es un entero positivo finito: los intentos **no
resueltos** del mismo paso —incluida la repregunta— que la sesión admite
antes de degradar a la entrada manual (`REQ-4`). Ausente, vale **1**: el
primer intento no resuelto degrada. Igual que el anterior, el núcleo
garantiza el contador finito y la salida declarada, y el número lo pone el
consumidor.

`degradation.maxConsecutiveFailures` y `confirmation.maxAttempts` cuentan el
mismo paso y **degradan en cuanto se agota el primero de los dos**. Consume
unidad sólo el intento **no resuelto**: una de cada contador. Un intento que
se resuelve no consume ninguna, y por eso un turno que se confirma en el
primer intento termina en `value_confirmed` (`C-001-06`) aunque los dos
contadores valgan 1, y no en la entrada manual. La segunda confirmación de
`reconfirm` es un intento del mismo paso y sigue la misma regla: si se
resuelve no consume unidad; si no se resuelve, consume una de cada contador.
El paso pasa a la entrada manual al agotar cualquiera de los dos límites, sin
esperar al otro, y ese agotamiento es el único desenlace que degrada. Un
contador no reinicia al otro.

`filter` y `data` son **puntos de declaración, no contenido** (§4.5): su
forma interna la fija el consumidor y su evaluación llega con el canal de
agente. Esta spec sólo garantiza que el punto existe y que su ausencia se
trata fail-closed.

`Ports` (equivalencia: §4.3). Cada puerto es un objeto con métodos, no una
función suelta, porque el núcleo necesita cancelar lo que está en vuelo. El
contrato de cada método se fija en
[`SPEC-004`](SPEC-004-puertos-y-presupuestos.md); aquí se fija su nombre y
su presencia:

| clave | puerto | método principal |
|---|---|---|
| `speaker` | lector | `say(text, request)` |
| `listener` | escucha | `listen(request, callbacks)` |
| `fieldInterpreter` | interpretador de campo | `interpret(text, field, request)` |
| `controlInterpreter` | interpretador de control | `interpret(text, confidence, request)` |
| `phrases` | frases | `text(key, context, request)` |
| `proposer` | propositor | `propose(state, event, allowedOptions, request)` |

Toda petición de puerto es `request = { turn, budgetMs, signal }`
(equivalencia: `Peticion`); su disciplina se fija en
[`SPEC-002`](SPEC-002-disciplina-de-turno.md). Los puertos omitidos tienen
implementación determinista por omisión (§4.1.1, punto 2). Si falta
`getPreviousValue`, un `deltaPolicy` declarado no tiene comparación que
evaluar: la diferencia **no** se evalúa, `onExceeded` **no** se aplica y el
valor sigue el camino normal de confirmación; la omisión no degrada el paso,
no lo deja sin salida y no se resuelve en silencio, porque su efecto
—ninguna comparación— es observable. El núcleo no inventa un valor previo
(`C-001-18`).

El esquema serializable de estas entradas vive en
[`../../schema/configuracion.json`](../../schema/configuracion.json). La
familia `ports` y las claves `onEvent` y `getPreviousValue` son inyección en
tiempo de ejecución y no son expresables en JSON: el esquema las admite como
claves declaradas y el núcleo las valida como objeto o función en la
frontera.

## Salidas

`createVoiceSession(config)` devuelve `session`:

| miembro | tipo | significado |
|---|---|---|
| `session.state` | `'idle' \| 'listening' \| 'thinking' \| 'speaking' \| 'error'` | estado visible |
| `session.mode` | `'deterministic' \| 'assisted'` | modo vigente |
| `session.values` | `{ [fieldId]: { value, unit } }` | valores confirmados, de sólo lectura |
| `session.start()` | `Promise<void>` | arranca el flujo; resuelve al llegar a reposo |
| `session.submitText(text)` | `Promise<void>` | entrada por texto del campo activo |
| `session.setMicrophoneMuted(muted)` | `void` | silencio de micrófono |
| `session.setSpeechMuted(muted)` | `void` | silencio de voz del agente |
| `session.dispose()` | `void` | cancela lo que esté en vuelo y desengancha |

`session.values` contiene **sólo** valores confirmados explícitamente y es
lo único que el consumidor puede llegar a guardar, porque la biblioteca no
persiste (§4.1). `dispose()` es decisión de esta spec: sin él, un turno en
vuelo no tiene forma de terminar cuando el consumidor desmonta la vista.

**Eventos.** El núcleo emite exactamente seis tipos, entregados por
`onEvent` en orden total. Todo evento lleva el sobre `type`, `sessionId`,
`mode`, `port` y `turn`, donde `port` dice qué puerto respondió y `turn` es
el identificador monotónico del turno o `null` fuera de turno. El contrato
legible por máquina vive en
[`../../schema/eventos.json`](../../schema/eventos.json).

| `type` | campos propios | qué anuncia |
|---|---|---|
| `state_changed` | `state`, `phase` | cambio de estado visible y de fase |
| `text_output` | `key`, `fieldId`, `displayText`, `speechText` | texto a pantalla y texto a voz, separados |
| `confirmation_requested` | `fieldId`, `value`, `unit`, `spokenValue`, `displayText`, `speechText` | petición de confirmación con el valor a confirmar |
| `manual_input_required` | `reason`, `fieldId`, `displayText`, `speechText` | necesidad de entrada manual y su motivo |
| `failure` | `code`, `state`, `fallback`, `displayText`, `speechText` | fallo, con la caída al determinista cuando ocurre |
| `value_confirmed` | `fieldId`, `value`, `unit`, `spokenValue` | señal de guardado; es lo que el consumidor puede persistir |

`displayText` es siempre una cadena no vacía. `speechText` es una cadena no
vacía **o `null`**: `null` declara que ese evento no tiene texto para voz
—el de pantalla sigue llevando el dato, como cuando la voz del agente está
silenciada ([`SPEC-005`](SPEC-005-maquina-de-estados-y-fases.md))— y no es
una cadena vacía ni una omisión por error.

`spokenValue` es el readback literal: el valor tal como se pronunció. Que
coincida con lo que se va a guardar es la garantía de §4.8 y su contrato
completo es el del catálogo ([`SPEC-007`](SPEC-007-catalogo-de-idioma.md)),
no éste. `phase` es la fase interna de
[`SPEC-005`](SPEC-005-maquina-de-estados-y-fases.md): su enumerado es
cerrado, tiene ocho valores y nunca es `null`.

## Errores

Toda creación que falla lanza `ConfigError`, con `code` de un enumerado
cerrado y un `path` que señala la clave culpable. **Estado que queda: no hay
sesión; ningún puerto se invoca; no hay eventos.** Ningún fallo de creación
deja un objeto a medio construir.

| `code` | condición |
|---|---|
| `invalid_config` | falta una clave obligatoria, hay una clave desconocida o una declaración está mal formada |
| `missing_policy` | un paso exige una declaración de política que el consumidor no aportó |

Fail-closed de política (`definicion-tecnica.md` §9.3, pregunta A): **lo que
el consumidor no declara no se habla**. Sin `policy.degradation` la sesión
no se crea, porque el núcleo no puede aplicar fail-closed en la vista si no
sabe cómo se ve el fallo (§9.3, pregunta F). `blockedClasses`, `safeTextKey`,
`filter` y `data` se exigen en cuanto un paso los necesita; hoy sólo el
texto conversacional los necesita, y ese camino llega con el canal de
agente, que no está en la primera versión. Mientras no exista, su ausencia
no bloquea la creación y su efecto es que **no se habla texto
conversacional**.

Los fallos en vuelo se anuncian por `onEvent`, nunca se convierten en un
valor guardado ni cambian el modo (§4.6). Su código y el estado que dejan:

| `code` | condición | estado que queda |
|---|---|---|
| `speech_failed` | el `speaker` devuelve `error` (`SPEC-003`) | el turno no encadena; salida declarada |
| `speech_watchdog` | el `speaker` devuelve `watchdog` (`SPEC-003`) | el turno no encadena; salida declarada |
| `no_speech` | silencio | caso propio, nunca valor cero |
| `recognition_failed` | error de reconocimiento | se mapea a su tipo; no consume el turno |
| `unresolved_value` | interpretación no resuelta | repregunta; no se guarda nada |
| `unclassified_control` | control sin categoría | no se interpreta como afirmación |
| `port_failure` | un puerto lanza, rechaza o rompe contrato | se descarta el turno **antes** de hablar y se rehace en determinista |
| `port_budget_exhausted` | un puerto agota `budgetMs` | se descarta el turno y se rehace en determinista; `error` · `failed` sólo si el reintento también agota o falla; nunca éxito inferido |
| `missing_text` | falta una clave del catálogo | no se improvisa texto; salida declarada |
| `over_budget` | el texto excede el presupuesto del catálogo | no se habla; salida declarada |
| `missing_policy` | un paso exige política ausente | el paso no se ejecuta |
| `invalid_agent_text` | texto del agente fuera de esquema, acción, campo, filtro o compuerta | no se habla; texto seguro o descarte |

Un `onEvent` que lanza **no tumba el turno**: el núcleo descarta el fallo
del observador y sigue (§4.2). Es contrato, no tolerancia: un consumidor no
puede detener un turno desde su propio observador.

## Casos

Cada caso es convertible en prueba. El identificador es estable: los casos
nuevos se **añaden** con el siguiente número libre, nunca se insertan ni se
renumeran los existentes.

- **C-001-01** DADO una `config` sin `fields` CUANDO se llama
  `createVoiceSession(config)` ENTONCES lanza `ConfigError` con
  `code = 'invalid_config'` y no se devuelve sesión.
- **C-001-02** DADO una `config` con una clave desconocida en la raíz
  CUANDO se llama `createVoiceSession(config)` ENTONCES lanza `ConfigError`
  con `code = 'invalid_config'` y ninguna otra clave se lee.
- **C-001-03** DADO una `config` sin `policy.degradation` CUANDO se llama
  `createVoiceSession(config)` ENTONCES lanza `ConfigError` con
  `code = 'missing_policy'`, no se invoca ningún puerto y no hay eventos.
- **C-001-04** DADO una `config` válida CUANDO se llama
  `createVoiceSession(config)` ENTONCES la sesión tiene `state = 'idle'`,
  `mode = 'deterministic'` y `values` vacío.
- **C-001-05** DADO dos sesiones creadas con la misma `config` CUANDO una
  avanza un turno ENTONCES el `state` y los `values` de la otra no cambian.
- **C-001-06** DADO un runner de pruebas sin `document` ni `window` y una
  `config` con los contadores por omisión CUANDO se crea una sesión con
  puertos deterministas y se ejecuta `start()` hasta el desenlace ENTONCES el
  turno llega a su fin sin lanzar por ausencia de DOM y su desenlace es el
  valor confirmado, no la entrada manual (`REQ-1`).
- **C-001-07** DADO el mismo módulo del núcleo sin editar CUANDO dos
  configuraciones de un dominio inventado y distinto —campos, tipos,
  rangos, unidades y claves de texto distintos— conducen un turno cada una
  ENTONCES las dos llegan a su desenlace y ninguna exige tocar el núcleo
  (`REQ-6`, `REQ-10`).
- **C-001-08** DADO el código fuente del paquete del núcleo y los dos
  identificadores de campo, unidades, claves de pregunta y textos seguros
  de las configuraciones de C-001-07 CUANDO se recorren los literales de
  texto del paquete ENTONCES ninguno de esos valores aparece en el núcleo
  (`REQ-10`).
- **C-001-09** DADO un turno completo con puertos deterministas y con
  `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`,
  `localStorage`, `sessionStorage`, `indexedDB` y `console` instrumentados
  para fallar CUANDO se ejecuta el turno ENTONCES
  ninguna de esas APIs se invoca (`REQ-11`).
- **C-001-10** DADO el módulo importado y sin leer su código CUANDO se lee
  `CAPABILITIES` ENTONCES declara `opensNetwork: false`, `persists: false`,
  `writesStorage: false`, `writesLogs: false` y `touchesDom: false`
  (`REQ-11`).
- **C-001-11** DADO un `onEvent` que lanza en cada llamada CUANDO se
  conduce un turno ENTONCES el turno llega a su desenlace y el fallo del
  observador no se propaga al camino crítico.
- **C-001-12** DADO cualquier evento con `displayText` y `speechText`
  CUANDO se comparan ENTONCES todo dato concreto —valor, unidad o
  identificador de campo— presente en `speechText` aparece también en
  `displayText`: el de voz no lleva información ausente del de pantalla.
- **C-001-13** DADO un campo `integer` con `range { min: 1, max: 10 }` y
  un `fieldInterpreter` que devuelve un valor fuera de rango CUANDO el
  turno lo procesa ENTONCES no se escribe en `session.values`, no hay
  `confirmation_requested` y el evento es `failure` con
  `code = 'unresolved_value'`.
- **C-001-14** DADO una sesión en cada uno de los cinco estados visibles
  CUANDO se llama `submitText('x')` ENTONCES la entrada se acepta en todos
  los casos y ninguno la rechaza por el estado.
- **C-001-15** DADO el módulo del núcleo CUANDO se importa dos veces en el
  mismo proceso ENTONCES la importación no ejecuta ningún efecto observable
  —ni red, ni DOM, ni almacenamiento, ni consola— y no deja estado mutable
  compartido entre sesiones.
- **C-001-16** DADO un campo con `deltaPolicy.onExceeded = 'none'` y un
  valor previo que difiere más de `maxDifference` CUANDO el turno lo procesa
  ENTONCES el valor sigue el camino normal de confirmación y se guarda tras
  una sola confirmación (`REQ-6`).
- **C-001-17** DADO un campo con `deltaPolicy.onExceeded = 'reconfirm'` y un
  valor previo que difiere más de `maxDifference`, con `maxAttempts` y
  `maxConsecutiveFailures` por omisión CUANDO el turno lo procesa ENTONCES el
  núcleo repite el readback y pide una segunda confirmación antes de
  escribir, y no degrada a manual: el intento resuelto no consume unidad
  (`REQ-6`).
- **C-001-18** DADO un campo con `deltaPolicy` declarado y **sin**
  `getPreviousValue` CUANDO el turno lo procesa ENTONCES la diferencia no se
  evalúa, `onExceeded` no se aplica, el valor sigue el camino normal de
  confirmación y el paso no degrada por la comparación ausente (`REQ-6`).

## Invariantes

- La creación **no toca** el DOM, ni red, ni almacenamiento, ni estado
  global de módulo.
- Dos sesiones en el mismo documento no comparten estado mutable; el
  arbitraje del audio del documento lo declara el adaptador, no el núcleo.
- La sesión arranca en `deterministic` y **nunca** pasa a `assisted` sin
  configuración explícita: no se activa por detección de disponibilidad.
- Cada evento lleva `mode` y `port`; el catálogo de eventos es cerrado.
- `displayText` y `speechText` son campos distintos y el de voz no añade
  información al de pantalla.
- El núcleo nunca escribe en el DOM ni en almacenamiento; importar no
  ejecuta efectos.
- Un valor no confirmado nunca llega a `session.values`.
- Ningún fallo se convierte en valor guardado, ninguno produce silencio
  —siempre hay salida declarada— y ninguno cambia el modo.
- La biblioteca no persiste, no abre red ni registra por su cuenta, y
  `CAPABILITIES` lo declara.
- Crear una sesión cuyo `config` no satisface el contrato **no** deja un
  objeto a medio construir: o hay sesión válida, o hay `ConfigError`.

**Cobertura de requisitos.** `REQ-1`: C-001-06, C-001-15. `REQ-6`:
C-001-04, C-001-07, C-001-13, C-001-14, C-001-16, C-001-17, C-001-18.
`REQ-10`: C-001-07, C-001-08, C-001-13, C-001-18. `REQ-11`: C-001-09,
C-001-10.

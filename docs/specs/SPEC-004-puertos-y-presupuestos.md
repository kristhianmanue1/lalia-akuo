# SPEC-004 — Puertos y presupuestos

**Fase:** F1 — entregable de E1 (segunda oleada).
**Cubre:** `REQ-4`, `REQ-5`, `REQ-13`.
**Procedencia:** `../product/definicion-tecnica-nucleo.md` §4.3, §4.4, §4.6
y §4.8; `../product/definicion-tecnica.md` §9.3 (preguntas E y G) y §10;
`../product/definicion-tecnica-extensiones.md` §5 y §6.1;
`../adr/ADR-008-ai-model-seams-only.md`;
`../adr/ADR-001-mechanism-policy-boundary.md`.
**Depende de:** [`SPEC-001`](SPEC-001-contrato-del-nucleo.md) —vocabulario,
`config`, catálogo de eventos y códigos—,
[`SPEC-002`](SPEC-002-disciplina-de-turno.md) —turno, `request` y no-op— y
[`SPEC-003`](SPEC-003-contrato-de-locucion.md) —locución y
`SPEECH_BUDGET_MS`—. Esta spec fija lo que SPEC-001 dejó delegado: el
contrato de cada método de puerto y los contratos de salida. No re-nombra
nada de las tres anteriores; donde las cita, manda su vocabulario.
**Formato:** `../ai-agent-guide/02-specs-adr-contratos.md` §2.2.

```text
SPEC-004 [cubre: REQ-4, REQ-5, REQ-13]
```

## Comportamiento

Los seis puertos de `SPEC-001` son las **costuras** por las que un modelo
entraría después (`ADR-008`), y sus firmas de esta spec son las definitivas.
Cada puerto es un **objeto con métodos**, nunca una función suelta, porque el
núcleo cancela lo que está en vuelo (`SPEC-002`). Además de su método
principal, todo puerto expone `cancel()`.

| puerto | método | argumentos | devuelve |
|---|---|---|---|
| `speaker` | `say` | `text: string`, `request` | `Promise<'done' \| 'error' \| 'watchdog'>` |
| `listener` | `listen` | `request`, `callbacks` | `Promise<ListeningResult>` |
| `fieldInterpreter` | `interpret` | `text: string`, `field: Field`, `request` | `Promise<Interpretation>` |
| `controlInterpreter` | `interpret` | `text: string`, `confidence: number`, `request` | `Promise<ControlCategory>` |
| `phrases` | `text` | `key: string`, `context: object`, `request` | `Promise<string>` |
| `proposer` | `propose` | `state`, `event`, `allowedOptions: Decision[]`, `request` | `Promise<Decision>` |

`Field` es la de `SPEC-001`; `state` es un estado visible de
[`SPEC-005`](SPEC-005-maquina-de-estados-y-fases.md); `event` es lo que
dispara la decisión. `callbacks` es
`{ onPartial(text), onNoSpeech(), onError(error) }`. `speaker` no cambia:
su contrato completo es `SPEC-003`, y aquí sólo se reitera su firma.

**Los nombres de los contratos de salida.** Los cuatro contratos
—`Interpretation`, `ControlCategory`, `ListeningResult` y `Decision`— los
fija **esta spec**; `SPEC-001` no los nombra. Van en inglés por la regla de
idioma del repositorio (`AGENTS.md`, «Convenciones de edición») y porque el
código publicado nombra en inglés. `../product/definicion-tecnica-nucleo.md`
§4.3 escribe ya estas cuatro formas como definitivas.

Reglas comunes a los seis:

1. **Devuelven promesa siempre**, también las implementaciones
   deterministas por omisión, que resuelven en el mismo bucle de eventos.
2. **Aceptan cancelación y reciben presupuesto**: toda invocación lleva
   `request` con `budgetMs`.
3. **Ningún puerto resuelve un resultado de éxito por temporizador.**
   Resolver una locución por tiempo transcurrido está prohibido
   (`SPEC-003`) y, en general, ningún resultado aceptado nace del reloj
   (`SPEC-002`): el agotamiento del presupuesto es un fallo explícito.
4. **Un puerto no decide política.** Recibe lo que el núcleo declaró y
   devuelve uno de los valores de su contrato. Los contadores y los umbrales
   del núcleo no son alcanzables desde un puerto (`ADR-008`).

### La petición

```text
request = {
  turn:     Turn,        // SPEC-002: { id, token, expectedState }
  budgetMs: entero > 0,  // la tabla de presupuestos de abajo
  signal:   AbortSignal, // se aborta al cancelar el turno (SPEC-002)
}
```

`request.turn` es el `Turn` de `SPEC-002`. El `turn` del sobre de eventos
(`SPEC-001`) es su `id`: mismo concepto, distinta granularidad, y así se lee
en [`../../schema/eventos.json`](../../schema/eventos.json).

El núcleo puede entregar **el mismo objeto `request`** a varias invocaciones
del turno: el puerto lo trata como sólo lectura y no se apoya en su
identidad. La petición no lleva contadores, umbrales ni política declarada:
lo único que el puerto sabe del turno es su etiqueta, su tope de tiempo y su
señal.

### El presupuesto por turno

```text
SPEECH_BUDGET_MS = 20000   // SPEC-003; esta spec no lo re-decide
TURN_BUDGET_MS   = 30000   // presupuesto por turno

BUDGETS = {                // el budgetMs que recibe cada puerto
  speaker:            SPEECH_BUDGET_MS,
  listener:           TURN_BUDGET_MS,
  fieldInterpreter:   TURN_BUDGET_MS,
  controlInterpreter: TURN_BUDGET_MS,
  phrases:            TURN_BUDGET_MS,
  proposer:           TURN_BUDGET_MS,
}
```

El módulo declara `TURN_BUDGET_MS` y `BUDGETS`, congelados y legibles sin
leer el código, como `CAPABILITIES` en `SPEC-001`.

`TURN_BUDGET_MS` es el presupuesto por turno: el tope de tiempo de una
invocación de cualquiera de los puertos que no son la locución. Su valor es
`30000` y las razones son:

1. **Debe dominar la espera legítima más larga que acota**, que es la
   escucha: la persona oye la pregunta, piensa y responde, y eso dura más
   que pronunciarla. Un tope por debajo del de la locución cortaría el paso
   siguiente, que es justo el que recoge la respuesta.
2. **Domina a `SPEECH_BUDGET_MS` con margen.** `20000` es el techo de una
   locución larga a ritmo lento (`SPEC-003`); `30000` deja el margen de
   pensar y responder sin que el vigilante del turno venza antes que el de
   la voz.
3. **Es un techo de vigilancia, no el control primario.** El control
   primario de la escucha es el cierre por señal real del adaptador; el de
   un puerto asistido, su propio tiempo de respuesta, que `E3-05` mide en
   dispositivo. Este tope sólo cierra en fallo el caso anómalo «el puerto no
   resolvió».
4. **El coste de equivocarse no es simétrico**, con la misma asimetría que
   `SPEC-003`: si el tope es corto, cada turno largo se pierde y la persona
   lo repite; si es largo, sólo se alarga el caso raro. La asimetría pide el
   valor holgado.
5. **El valor es provisional y medible.** `E3-05` mide la latencia real en
   dispositivo; si la medición muestra que el valor no domina la espera
   legítima o que es demasiado holgado, se cambia **el valor**, con la
   medición como fuente, sin cambiar este contrato.

`speaker` conserva `SPEECH_BUDGET_MS` porque su techo lo gobierna la
locución —el cierre real de la voz—, no el turno: `SPEC-003` ya fijó ese
valor con sus razones y esta spec no lo toca.

**Degradación al agotarse.** Agotar `budgetMs` es un fallo explícito, nunca
un éxito inferido (`SPEC-002`):

- se emite `failure` con `code = 'port_budget_exhausted'` y `fallback =
  'deterministic'`;
- el turno se descarta y se rehace en determinista **antes del primer evento
  audible** del turno, sea el puerto agotado una implementación asistida de
  una costura o cualquier otro —así lo manda `definicion-tecnica-nucleo.md`
  §4.6, y el agotamiento es una avería del puerto, no una declaración de
  conectividad—;
- **no** hay salida manual en este paso: la entrada manual es el desenlace de
  la vuelta fallida, no del primer agotamiento;
- **como mucho un reintento por turno.** Si el reintento determinista también
  agota su presupuesto o falla, entonces sí la sesión queda en `error` con el
  estado de fallo declarado y la salida es `manual_input_required` con
  `reason = 'port_budget_exhausted'`. Ese tope es lo que impide que un puerto
  averiado deje el turno girando;
- no hay transición de éxito, no se escribe valor y el `mode` de la sesión
  **no cambia**.

### La cancelación

Cancelar un turno significa dos cosas a la vez (`SPEC-002`): el núcleo pasa
`signal` a abortado **y** llama a `cancel()` del puerto en vuelo. Qué corta
cada `cancel()`: `speaker` corta la locución en curso (`SPEC-003`),
`listener` corta la captura, y `fieldInterpreter`, `controlInterpreter`,
`phrases` y `proposer` abandonan el trabajo en vuelo. Para los seis puertos:

- `cancel()` es **síncrona**, **idempotente** y **no lanza**;
- `cancel()` no resuelve ni rechaza la promesa del puerto: el núcleo
  resuelve el turno por su cuenta y descarta lo que llegue después;
- un resultado posterior al `abort`, aunque sea válido, es **no-op**
  (`SPEC-002`): ni estado, ni evento, ni valor;
- ningún callback se acepta después de la cancelación; una segunda llamada a
  `onNoSpeech` u `onError` es no-op;
- `dispose()` cancela todo lo que esté en vuelo (locución, escucha,
  interpretación, proposición).

### Los contratos de salida

`Interpretation` — qué número se entendió:

```text
Interpretation = {
  code:       'ok' | 'unparseable' | 'ambiguous' | 'out_of_range',
  value?:     <tipo declarado del campo>,   // sólo con code = 'ok'
  unit?:      string | null,                // unidad oída, o null
  candidates?: unknown[],                   // sólo con 'ambiguous', no vacío
}
```

- El enumerado de `code` es **cerrado**: un valor fuera de él es fallo del
  puerto.
- `code = 'ok'` **exige** `value`, del tipo declarado por el campo. `ok` sin
  `value` es un contrato roto, no una lectura vacía.
- `value` no aparece con ningún otro `code`: una lectura no resuelta nunca
  es un candidato a guardar (fail-closed).
- `unit` es la unidad oída o `null`. El núcleo **no convierte unidades ni
  decide su valor** (`REQ-10`); la unidad guardada es la que declara el
  consumidor. Una lectura cuya unidad contradiga la declarada no se
  convierte en silencio: queda no resuelta (`unresolved_value`).
- `candidates` es informativo, nunca se habla y nunca se guarda.

`unparseable`, `ambiguous` y `out_of_range` producen `failure` con
`code = 'unresolved_value'`: no se escribe valor, no hay
`confirmation_requested` y el turno repregunta (`SPEC-001`).

`ControlCategory` — qué intención de control se reconoció:

```text
ControlCategory =
  'affirmation' | 'negation' | 'repetition' | 'manual' | 'unclassified'
```

- El enumerado es **cerrado**; un valor fuera de él es fallo del puerto.
- `unclassified` es la forma inglesa de `sin_categoria`, el nombre que
  `../product/definicion-tecnica-nucleo.md` §4.3 (procedencia) usaba para el
  valor «no se reconoció ninguna categoría». Este enumerado lo fija esta
  spec; `SPEC-001` no nombra las categorías.
- Coincide con el código cerrado `unclassified_control`.
- El **léxico y su umbral de confianza son externos al núcleo**: llegan con
  el paquete de idioma (`../product/definicion-tecnica-extensiones.md` §6.1)
  o con la implementación del puerto. El núcleo no conoce palabras de control
  ni calcula umbrales (`REQ-5`, `REQ-10`).
- `confidence` es el número que el reconocimiento reporta para el texto.
  **Por debajo del umbral, la categoría es `unclassified`**, coincida o no
  la frase con el léxico: fail-closed por confianza (`REQ-5`).
- `unclassified` **nunca se interpreta como afirmación** (`SPEC-001`): no
  cambia el estado lógico del turno —no confirma, no guarda y no cancela— y
  queda registrado como no reconocido, con `failure` y
  `code = 'unclassified_control'`. **Lectura de «no cambia el estado»**
  (`REQ-5`): el paso no avanza y nada se guarda; lo único que se mueve es la
  salida declarada, que ningún fallo puede omitir (§4.6, `SPEC-005`).
- La clasificación es del puerto; el **efecto** es del núcleo: `affirmation`
  confirma —sólo si el readback ya se pronunció (`REQ-7`)—, `negation` no
  guarda y repregunta, `repetition` repite el último texto sin cambiar
  valor, `manual` abre la entrada manual.

`ListeningResult` — qué devolvió la escucha:

```text
ListeningResult = {
  type:        'speech' | 'no_speech' | 'recognition_failed',
  text?:       string,   // no vacío; sólo con type = 'speech'
  confidence?: number,   // sólo con type = 'speech'
}
```

- El enumerado de `type` es **cerrado**; un valor fuera de él es fallo del
  puerto. `type` es la clave que ya usa `§4.3` para este contrato.
- **El silencio es un caso propio**, `no_speech`, nunca un valor cero, nunca
  `text: ''` y nunca un valor guardado (`SPEC-001`).
- `recognition_failed` es el error de reconocimiento **mapeado a su tipo**:
  no consume el turno en silencio, siempre deja salida declarada.
- `onPartial` puede dispararse muchas veces mientras el turno siga abierto;
  `onNoSpeech` y `onError` anuncian el mismo desenlace que resuelve la
  promesa y **cierran** el turno: la promesa resuelve una sola vez y lo que
  llegue después es no-op (`SPEC-002`).
- `listen` no rechaza por un desenlace de reconocimiento: eso es un
  `ListeningResult`. Un rechazo inesperado sí es fallo del puerto.

`Decision` — qué se hace a continuación:

```text
Decision = 'confirm' | 'reask' | 'manual'
```

- El enumerado es **cerrado**, y **el núcleo calcula el conjunto admisible**:
  `allowedOptions` es un subconjunto no vacío de `Decision` que acompaña a la
  invocación. El propositor **sólo elige dentro de él** (`ADR-008`).
- Devolver un valor fuera del enumerado, **o un valor válido que no esté en
  `allowedOptions`**, es fallo del puerto, no una decisión: el turno se
  descarta y se rehace en determinista antes del primer evento audible.
- `confirm` lleva a que el núcleo haga el readback con el valor a confirmar
  y pida confirmación.
- `reask` repite la pregunta del campo. El número de intentos lo gobierna el
  núcleo —no el puerto—, es finito y **siempre desemboca en `manual`**; el
  valor lo declara el consumidor en
  `config.policy.confirmation.maxAttempts`, y la degradación por fallos
  consecutivos en `policy.degradation.maxConsecutiveFailures`: el paso degrada
  en cuanto se agota el primero de los dos (`SPEC-001`, §9.3-G).
- `manual` abre la entrada manual; la entrada por texto está disponible en
  todo estado (`SPEC-001`), así que ningún valor deja el turno sin salida.
- **Guardar no es una `Decision`.** El núcleo guarda sólo con confirmación
  explícita (`REQ-7`); ningún propositor puede confirmar por su cuenta.

### Un puerto fuera de contrato no decide

Cualquier resultado fuera del contrato —un valor fuera de un enumerado
cerrado, un campo obligatorio ausente, un tipo distinto, una promesa
rechazada por algo que no sea un error declarado— es **fallo del puerto**:
`failure` con `code = 'port_failure'` y el turno descartado **antes del
primer evento audible**, rehecho en determinista (`ADR-008`). El núcleo
nunca interpreta «lo más parecido» ni completa el valor que falta.

La única excepción declarada es `phrases`, cuyos dos errores de catálogo
—`missing_text` y `over_budget`— son resultados **declarados** de §4.4 y de
`SPEC-001`, no roturas de contrato. `SPEC-002` rige para todo lo demás.

`phrases` resuelve una cadena **no vacía**; una cadena vacía o un valor que
no sea texto es fallo del puerto. El `context` llega con las ranuras ya
validadas por el núcleo y sin texto libre sin validar (§4.4). Las claves que
llevan el dato —readback, resumen, anuncio de guardado— **no pasan por este
puerto**: las compone el núcleo con el catálogo, para que lo oído coincida
con lo que se guardará (§4.4, `SPEC-001`).

## Entradas

- `config.ports` (`SPEC-001`): cero, uno o los seis puertos. El puerto
  omitido usa la implementación determinista por omisión.
- `config.mode`: `'deterministic'` (omisión) o `'assisted'`; se declara, no
  se infiere de la implementación inyectada.
- La invocación del núcleo: el `text`, el `field`, la `confidence`, el
  `state`, el `event` y las `allowedOptions` que correspondan al puerto.
- El resultado del puerto: promesa resuelta o rechazada, o callback.
- La cancelación: `setMicrophoneMuted(true)`, `dispose()` o cierre del turno.

## Salidas

- Una promesa por invocación, con el contrato cerrado de cada puerto.
- Los eventos que el núcleo deriva del resultado: `confirmation_requested`,
  `manual_input_required`, `failure`, `value_confirmed`, `text_output`.
- El agotamiento de `budgetMs` produce `failure` con
  `code = 'port_budget_exhausted'`, el turno se descarta y se rehace en
  determinista antes del primer evento audible; la salida manual es el
  desenlace del reintento que también falla, no del primer agotamiento.
- Un puerto fuera de contrato produce `failure` con `code = 'port_failure'` y
  la caída al determinista antes del primer evento audible.
- Ninguna invocación de puerto escribe en `session.values`: el valor sólo
  entra con confirmación explícita (`SPEC-001`, `REQ-7`).

## Errores

| condición | `code` | estado que queda |
|---|---|---|
| un puerto no resuelve y se agota `budgetMs` | `port_budget_exhausted` | fallo explícito del turno; se descarta y se rehace en determinista antes del primer evento audible; `manual_input_required` sólo si el reintento también falla; nunca éxito |
| un puerto lanza o rechaza por algo no declarado | `port_failure` | turno descartado antes del primer evento audible; se rehace en determinista |
| un puerto resuelve un valor fuera de su enumerado cerrado | `port_failure` | igual que la fila anterior |
| `proposer` devuelve un `Decision` fuera de `allowedOptions` | `port_failure` | igual; el núcleo conserva el conjunto admisible |
| `fieldInterpreter` devuelve `ok` sin `value` | `port_failure` | no hay lectura; no se confirma ni se guarda |
| `fieldInterpreter` devuelve `unparseable`, `ambiguous` u `out_of_range` | `unresolved_value` | repregunta; no se guarda nada |
| `controlInterpreter` devuelve `unclassified` | `unclassified_control` | no se interpreta como afirmación; estado sin cambio; queda registrado |
| `listener` devuelve `no_speech` | `no_speech` | caso propio; jamás un valor cero; salida declarada |
| `listener` devuelve `recognition_failed` | `recognition_failed` | mapeado a su tipo; no consume el turno en silencio |
| `phrases` rechaza con clave ausente | `missing_text` | no se improvisa texto; salida declarada |
| `phrases` resuelve un texto por encima del presupuesto del catálogo | `over_budget` | no se habla; salida declarada |
| cualquier puerto invocado tras la cancelación | — (no-op) | nada cambia; no hay evento |

Un fallo de puerto **no cambia el `mode`**, **no escribe valor** y **nunca
produce silencio**: siempre deja una salida declarada (`SPEC-001`, §4.6).

## Casos

Identificador estable; los casos nuevos se añaden con el siguiente número
libre.

- **C-004-01** DADO un doble que registra su `request` en cada puerto CUANDO
  se conduce un turno ENTONCES toda invocación lleva `turn`, `budgetMs` y
  `signal`, y ninguna lleva contador, umbral ni política del núcleo
  (`REQ-13`, `ADR-008`).
- **C-004-02** DADO el módulo del núcleo CUANDO se lee `BUDGETS` ENTONCES
  `TURN_BUDGET_MS` vale `30000` y es el `budgetMs` de `listener`,
  `fieldInterpreter`, `controlInterpreter`, `phrases` y `proposer`, y el de
  `speaker` es `SPEECH_BUDGET_MS` (`REQ-13`).
- **C-004-03** DADO un doble de puerto CUANDO se conduce un turno ENTONCES
  `request.turn` es el `Turn` de `SPEC-002` con `id`, `token` y
  `expectedState`, y el `turn` de los eventos emitidos es su `id`.
- **C-004-04** DADO una `config` sin `ports` CUANDO se invoca cada uno de los
  seis puertos ENTONCES los seis devuelven promesa con su implementación
  determinista por omisión y el turno llega a su desenlace (`REQ-13`).
- **C-004-05** DADO un puerto en vuelo CUANDO se cancela el turno ENTONCES
  `signal` queda abortado **y** se ha llamado a `cancel()`, la llamada es
  idempotente y no lanza, y un resultado posterior válido es no-op.
- **C-004-06** DADO un puerto que nunca resuelve CUANDO se agota su
  `budgetMs` ENTONCES se emite `failure` con
  `code = 'port_budget_exhausted'`, el turno se descarta y se rehace en
  determinista, **no** hay salida manual en ese paso y ninguna transición de
  éxito ocurre.
- **C-004-07** DADO un puerto asistido que agota su presupuesto CUANDO se
  conduce el turno ENTONCES el turno se descarta y se rehace en determinista
  antes del primer evento audible, y el `mode` de la sesión no cambia
  (`REQ-13`).
- **C-004-27** DADO un turno en el que el reintento determinista también
  agota su `budgetMs` CUANDO se resuelve ese reintento ENTONCES hay
  `manual_input_required` con `reason = 'port_budget_exhausted'`, no hay un
  tercer intento y ninguna transición de éxito ocurre.
- **C-004-08** DADO un `fieldInterpreter` que resuelve un `code` fuera del
  enumerado CUANDO llega el resultado ENTONCES se emite `failure` con
  `code = 'port_failure'` y el turno se rehace en determinista antes de
  hablar.
- **C-004-09** DADO un `fieldInterpreter` que resuelve `code = 'ok'` sin
  `value` CUANDO llega el resultado ENTONCES se emite `failure` con
  `code = 'port_failure'` y no hay confirmación ni valor.
- **C-004-10** DADO un `fieldInterpreter` que resuelve `unparseable`,
  `ambiguous` u `out_of_range` CUANDO el turno lo procesa ENTONCES no se
  escribe en `session.values`, no hay `confirmation_requested` y se emite
  `failure` con `code = 'unresolved_value'`.
- **C-004-11** DADO un `controlInterpreter` que resuelve una categoría fuera
  del enumerado CUANDO llega el resultado ENTONCES se emite `failure` con
  `code = 'port_failure'` y el turno se rehace en determinista antes de
  hablar.
- **C-004-12** DADO un `controlInterpreter` que resuelve `unclassified`
  CUANDO el texto coincidía con una frase de afirmación ENTONCES nada se
  confirma ni se guarda y se emite `failure` con
  `code = 'unclassified_control'` (`REQ-5`).
- **C-004-13** DADO un léxico externo y una `confidence` por debajo de su
  umbral CUANDO se clasifica la frase ENTONCES la categoría es
  `unclassified`, no se confirma ni se guarda nada, el paso no avanza y la
  frase queda registrada como no reconocida (`REQ-5`).
- **C-004-14** DADO el mismo `text` y la misma `confidence` CUANDO se cambia
  el umbral del paquete de idioma sin tocar el núcleo ENTONCES la categoría
  devuelta cambia (`REQ-5`).
- **C-004-15** DADO un `listener` que resuelve `no_speech` o
  `recognition_failed` CUANDO el turno lo procesa ENTONCES no hay valor cero
  ni valor guardado, y siempre hay salida declarada.
- **C-004-16** DADO un `listener` que resuelve un `type` fuera del enumerado
  CUANDO llega el resultado ENTONCES se emite `failure` con
  `code = 'port_failure'` antes del primer evento audible.
- **C-004-17** DADO un `proposer` que resuelve un `Decision` válido que no
  está en `allowedOptions` CUANDO llega el resultado ENTONCES se emite
  `failure` con `code = 'port_failure'` y el turno se rehace en determinista
  (`REQ-4`).
- **C-004-18** DADO `confirm` entre las `allowedOptions` CUANDO el
  propositor lo devuelve ENTONCES el núcleo emite `confirmation_requested`
  con el valor a confirmar y el turno siempre tiene salida (`REQ-4`).
- **C-004-19** DADO `reask` entre las `allowedOptions` CUANDO el propositor
  lo devuelve ENTONCES la pregunta se repite y, agotado el contador finito
  del núcleo, el turno desemboca en `manual` (`REQ-4`).
- **C-004-20** DADO `manual` entre las `allowedOptions` CUANDO el propositor
  lo devuelve ENTONCES se emite `manual_input_required` y `submitText` se
  acepta en los cinco estados visibles (`REQ-4`).
- **C-004-21** DADO un `proposer` que resuelve un valor fuera del enumerado
  `Decision` CUANDO llega el resultado ENTONCES se emite `failure` con
  `code = 'port_failure'` antes del primer evento audible.
- **C-004-22** DADO un `phrases` de doble que registra sus claves CUANDO se
  conduce un turno completo ENTONCES ninguna clave de texto que lleve el
  dato —readback, resumen o anuncio de guardado— se le pide.
- **C-004-23** DADO un `phrases` que rechaza con clave ausente CUANDO el
  núcleo pide el texto ENTONCES se emite `failure` con `code = 'missing_text'`
  y hay salida declarada, sin texto improvisado.
- **C-004-24** DADO un `phrases` que resuelve un texto por encima del
  presupuesto del catálogo CUANDO llega el resultado ENTONCES el texto no se
  habla y hay salida declarada con `over_budget`.
- **C-004-25** DADO una `config` sin `mode` CUANDO se conduce un turno con un
  doble ocupando cada puerto ENTONCES el `mode` sigue siendo `deterministic`:
  el núcleo no lo cambia por detectar la implementación inyectada
  (`REQ-13`).
- **C-004-26** DADO un doble por puerto implementado contra la firma de esta
  spec CUANDO se conduce un turno ENTONCES cada invocación llega con los
  argumentos y en el orden declarados aquí (`REQ-13`).

## Invariantes

- Todo puerto devuelve promesa, acepta cancelación y recibe `budgetMs`.
- Los contratos de salida son **cerrados**: un valor fuera del enumerado, un
  campo obligatorio ausente o un tipo distinto es fallo del puerto.
- **Un puerto que devuelve algo fuera de su contrato no decide**: el núcleo
  cae al determinista antes del primer evento audible del turno.
- El puerto nunca elige fuera de `allowedOptions`, nunca guarda, nunca
  transiciona y nunca conoce contadores ni umbrales del núcleo.
- Todo presupuesto agotado produce un fallo explícito y una salida
  declarada; ninguno produce éxito, y ninguno cambia el `mode`.
- Ningún resultado de éxito nace del reloj: resolver por temporizador está
  prohibido.
- Cancelar aborta `signal` **y** llama a `cancel()`; el resultado posterior
  es no-op aunque sea válido.
- `interpret`, `propose`, `listen` y `text` no deciden política: el efecto lo
  aplica el núcleo, que es el único lugar donde se decide si un resultado
  cuenta (`SPEC-002`).
- Las claves que llevan el dato no pasan por `phrases`: las compone el núcleo
  con el catálogo y la ranura ya validada.

**Cobertura de requisitos.** `REQ-4`: C-004-17, C-004-18, C-004-19,
C-004-20, C-004-21. `REQ-5`: C-004-12, C-004-13, C-004-14. `REQ-13`:
C-004-01, C-004-02, C-004-04, C-004-07, C-004-25, C-004-26.

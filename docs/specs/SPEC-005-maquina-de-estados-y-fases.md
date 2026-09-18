# SPEC-005 — Máquina de estados y fases

**Fase:** F1 — entregable de E1 (segunda oleada).
**Cubre:** `REQ-1` (en su parte observable).
**Procedencia:** `../product/definicion-tecnica-nucleo.md` §4.2, §4.6, §4.7 y
§4.8; `../product/definicion-tecnica.md` §9.3 y §10;
`../ai-agent-guide/02-specs-adr-contratos.md` §5 (modelo de estados);
`../adr/ADR-008-ai-model-seams-only.md`.
**Depende de:** [`SPEC-001`](SPEC-001-contrato-del-nucleo.md) —estados
visibles, catálogo de eventos y códigos—,
[`SPEC-002`](SPEC-002-disciplina-de-turno.md) —turno y no-op—,
[`SPEC-003`](SPEC-003-contrato-de-locucion.md) —sólo `done` encadena— y
[`SPEC-004`](SPEC-004-puertos-y-presupuestos.md) —puertos, presupuestos y
contratos de salida—. Esta spec no re-nombra nada de allí.
**Formato:** `../ai-agent-guide/02-specs-adr-contratos.md` §2.2.

```text
SPEC-005 [cubre: REQ-1]
```

## Comportamiento

**Los estados visibles** son los cinco que fija `SPEC-001` y aquí no se
renombra ninguno: `idle`, `listening`, `thinking`, `speaking`, `error`. El
estado visible refleja el estado real, y cada cambio se anuncia con un
`state_changed` (§4.7).

**Las fases internas.** `SPEC-001` dejó `phase` sin enumerado a la espera de
esta spec, y aquí queda fijado: el enumerado es **cerrado**, tiene ocho
valores y `phase` **nunca** es `null`. `SPEC-001`, esta spec y
`../product/definicion-tecnica-nucleo.md` §4.7 apuntan al mismo contrato.

```text
PHASES = [
  'idle',         // no hay turno abierto
  'asking',       // el núcleo pregunta el campo
  'capturing',    // el turno escucha
  'interpreting', // el turno interpreta lo que oyó
  'confirming',   // readback y petición de confirmación
  'closing',      // anuncio de guardado
  'degrading',    // salida declarada: repregunta, aviso o entrada manual
  'failed',       // fallo explícito del turno
]
```

Cada fase pertenece a **exactamente un** estado visible. Esta es la tabla de
verdad de la máquina:

| estado visible | fases admitidas |
|---|---|
| `idle` | `idle` |
| `speaking` | `asking`, `confirming`, `closing`, `degrading` |
| `listening` | `capturing` |
| `thinking` | `interpreting` |
| `error` | `failed` |

La entrada por texto no tiene estado ni fase propios: `submitText(text)` entra
por `thinking` · `interpreting`, venga del estado que venga (`SPEC-001`).

### Transiciones

El disparador de cada transición es un **resultado aceptado** (`SPEC-002`):
uno etiquetado con el turno abierto, que no está resuelto ni cancelado. Un
resultado tardío, cancelado, de otro turno o de un estado esperado que ya no
se cumple **no es disparador**: no hay transición ni evento.

```text
ORIGEN     DISPARADOR                              DESTINO          FASE
idle       -- start()                           --> speaking      · asking
speaking   -- speaker 'done', fase asking |
              confirming                        --> listening     · capturing
speaking   -- speaker 'done', fase closing |
              degrading                         --> idle          · idle
listening  -- ListeningResult 'speech'          --> thinking      · interpreting
thinking   -- Interpretation 'ok'               --> speaking      · confirming
listening  -- control 'affirmation'             --> speaking      · closing
listening  -- control 'repetition'              --> speaking      · confirming
thinking   -- Decision 'confirm'                --> speaking      · confirming
thinking   -- Decision 'reask'                  --> speaking      · asking | degrading
thinking   -- Decision 'manual'                 --> speaking      · degrading
cualquiera -- submitText(text)                  --> thinking      · interpreting
cualquiera -- port_failure (rehace el turno)    --> speaking      · asking
cualquiera -- port_budget_exhausted (rehace)    --> speaking      · asking
cualquiera -- reintento que agota o falla       --> error         · failed
```

La repregunta depende de un contador finito del núcleo: lleva `asking`
mientras queden intentos y `degrading` al agotarse **el primero** de los dos
contadores de `SPEC-001` —`confirmation.maxAttempts` o
`degradation.maxConsecutiveFailures`—, que siempre desemboca en la entrada
manual (`../product/definicion-tecnica.md` §9.3, pregunta G). Con los
controles de silencio, la tabla queda así:

```text
listening  -- 'no_speech' | 'recognition_failed' --> speaking     · asking | degrading
thinking   -- lectura no resuelta                --> speaking     · asking | degrading
listening  -- control 'negation'                 --> speaking     · asking | degrading
listening  -- control 'unclassified'             --> speaking     · asking | degrading
listening  -- control 'manual'                   --> speaking     · degrading
idle       -- start(), voz silenciada            --> listening    · capturing
cualquiera -- setMicrophoneMuted(true)           --> idle         · idle
```

La reconfirmación por `deltaPolicy.onExceeded = 'reconfirm'` (`SPEC-001`) no
introduce estado ni fase: dentro del mismo par `speaking` · `confirming`, el
núcleo emite un segundo `confirmation_requested` tras una afirmación y sólo
escribe con la segunda afirmación.

**Lectura de «no cambia el estado»** (`REQ-5`, `SPEC-004`): cuando el control
no se clasifica, lo que no cambia es el **estado lógico** del turno —no
confirma, no guarda y no cancela—; el único movimiento visible es el de la
salida declarada, que ningún fallo puede omitir (§4.6).

**El estado de fallo explícito.** `error` · `failed` no es la respuesta al
primer agotamiento: agotar `budgetMs` (`port_budget_exhausted`) descarta el
turno y lo rehace en determinista **antes del primer evento audible**, y sólo
si ese reintento también agota o falla la sesión entra en `error` · `failed`
con la salida manual declarada (abajo, tabla de errores, y `SPEC-004`).
Desde `error` **no se vuelve al flujo por voz**: la única salida es la
declarada, que es la entrada manual, y `submitText` es esa salida. Por sí
sola la sesión resuelve el estado así:

```text
error      -- salida declarada (manual)         --> idle          · idle
```

La fila `cualquiera -- submitText(text)` de la tabla de arriba también
alcanza a `error`: `submitText` es la salida declarada de la entrada manual
—no un paso del flujo de voz— y lleva a `thinking` · `interpreting` como en
los otros estados (C-005-11).

Los demás fallos **no** pasan por `error`, porque son recuperaciones
declaradas y no estados: `port_failure` descarta el turno y lo rehace en
determinista —la máquina vuelve a abrir el turno con los deterministas—, y
una degradación a manual o un fallo de locución ofrecen su salida declarada
sin declarar un estado de error (§4.6; `SPEC-008`). Ninguna de esas
recuperaciones produce silencio.

### Silencios y controles

- **Micrófono apagado**: la máquina **nunca** entra en `listening` (`§4.7`).
  El paso que iba a escuchar cierra el turno en `idle` · `idle` con la salida
  declarada (`manual_input_required`). Apagar el micrófono cancela el turno
  en vuelo (`SPEC-002`) y deja el estado en `idle`.
- **Voz del agente silenciada**: la máquina **nunca** entra en `speaking`,
  porque no hay locución en curso que mostrar (§4.7). Los textos de esos
  pasos salen igual a pantalla, como `text_output`, y la máquina va directo
  al destino del paso: `idle -- start(), voz silenciada --> listening` ·
  `capturing`.
- **Entrada por texto**: `submitText(text)` se acepta en los cinco estados
  (`SPEC-001`, C-001-14), incluido `error`, donde es la salida declarada de
  la entrada manual, y es siempre una transición válida a `thinking` ·
  `interpreting`.
- **Cierre**: `dispose()` no es una transición: termina la sesión, cancela lo
  que esté en vuelo y no deja estado siguiente.

**Un turno y su desenlace.** Un turno recorre los pasos preguntar, escuchar,
interpretar y confirmar, y termina en un desenlace **observable**: un valor
confirmado (`value_confirmed` y `session.values`), una entrada manual
(`manual_input_required`) o un fallo explícito (`failure`). Llegar al
desenlace no depende del DOM ni de un navegador (`REQ-1`).

## Entradas

- `start()`, `submitText(text)`, `setMicrophoneMuted(muted)`,
  `setSpeechMuted(muted)` y `dispose()` (`SPEC-001`).
- Los resultados aceptados de los puertos (`SPEC-004`): locución, escucha,
  interpretación, control y proposición.
- El agotamiento de `budgetMs` de un puerto en vuelo (`SPEC-002`).
- El límite finito de intentos del mismo paso, declarado por el consumidor
  en `config.policy.confirmation.maxAttempts` (`SPEC-001`; §9.3, pregunta G).

## Salidas

- Un `state_changed` por cada transición, con `state` y `phase` de los
  enumerados de arriba; `phase` nunca es `null`.
- Los eventos del paso: `text_output`, `confirmation_requested`,
  `manual_input_required`, `failure` y `value_confirmed` (`SPEC-001`).
- El desenlace del turno, observable en `session.values` y en los eventos.
- Ninguna transición escribe un valor: el valor sólo entra con confirmación
  explícita (`SPEC-001`, `REQ-7`).

## Errores

| condición | `code` | estado que queda |
|---|---|---|
| se agota `budgetMs` de un puerto en vuelo | `port_budget_exhausted` | el turno se descarta y se rehace en determinista **antes del primer evento audible**; **si el reintento también agota o falla**, `error` · `failed` con la salida manual declarada; nunca éxito |
| un puerto lanza, rechaza o rompe contrato | `port_failure` | no hay estado `error`: el turno se descarta y se rehace en determinista |
| el `speaker` devuelve `error` o `watchdog` | `speech_failed` / `speech_watchdog` | no encadena: nunca `listening`; `speaking` · `asking` si la salida es repregunta, `idle` · `idle` si es manual; nunca `error` |
| el `listener` devuelve `no_speech` | `no_speech` | no hay valor cero; `speaking` · `asking` o `degrading`; salida declarada |
| el `listener` devuelve `recognition_failed` | `recognition_failed` | igual que la fila anterior; nunca `error` |
| la lectura no se resuelve | `unresolved_value` | repregunta; no se guarda nada |
| el control no se clasifica | `unclassified_control` | no se interpreta como afirmación; salida declarada |
| micrófono apagado, o permiso denegado reportado por el `listener` | `recognition_failed` | nunca `listening`; salida manual declarada; **no** es `error` |

Fail-closed de las transiciones: **ningún fallo cambia el `mode`**, ninguna
transición de éxito nace de un temporizador y ninguna deja el turno en un
estado del que no se salga. Todo fallo tiene salida declarada; ninguno
produce silencio.

## Casos

Identificador estable; los casos nuevos se añaden con el siguiente número
libre.

- **C-005-01** DADO un runner sin `document` ni `window` y puertos
  deterministas CUANDO se conduce un turno completo ENTONCES la secuencia de
  `state` es `idle → speaking → listening → thinking → speaking → listening →
  speaking → idle` y el turno llega a su desenlace (`REQ-1`).
- **C-005-02** DADO el mismo turno —con `maxAttempts` y
  `maxConsecutiveFailures` por omisión (1)— CUANDO se observa su desenlace
  ENTONCES hay `value_confirmed` con el valor confirmado y `session.values`
  lo contiene: el desenlace es el valor confirmado, no la entrada manual, y
  es observable (`REQ-1`).
- **C-005-03** DADO cualquier turno CUANDO se recorren sus `state_changed`
  ENTONCES todo `phase` pertenece al enumerado de ocho valores y ninguno es
  `null` (`REQ-1`).
- **C-005-04** DADO cualquier `state_changed` CUANDO se compara el par
  (`state`, `phase`) con la tabla de verdad ENTONCES el par pertenece a la
  tabla, y `failed` sólo aparece con `error`.
- **C-005-05** DADO una sesión en `idle` y sin turno abierto CUANDO llega un
  resultado de `listener` ENTONCES no hay `state_changed` y ningún estado
  cambia.
- **C-005-06** DADO un turno en `speaking` CUANDO el `speaker` resuelve
  `error` o `watchdog` ENTONCES **no** hay transición a `listening` y la
  salida es la declarada.
- **C-005-07** DADO el micrófono apagado CUANDO el flujo llegaría a escuchar
  ENTONCES nunca se emite `state_changed` con `state = 'listening'` y el
  turno cierra con la salida manual declarada.
- **C-005-08** DADO la voz del agente silenciada CUANDO se conduce un turno
  ENTONCES nunca se emite `state_changed` con `state = 'speaking'` y los
  textos del paso salen igual como `text_output`.
- **C-005-09** DADO una sesión en `error` CUANDO se resuelve el turno
  ENTONCES su única salida es la salida declarada: no hay transición directa
  a `listening` ni a `speaking` · `confirming`.
- **C-005-10** DADO un turno abierto CUANDO llega un resultado tardío, de otro
  turno o posterior a la cancelación ENTONCES no hay `state_changed`
  (`SPEC-002`).
- **C-005-11** DADO una sesión en cada uno de los cinco estados visibles
  CUANDO se llama `submitText(text)` ENTONCES en los cinco hay transición a
  `thinking` · `interpreting` y ninguno la rechaza por el estado (`REQ-1`).
- **C-005-12** DADO un puerto determinista que nunca resuelve CUANDO se agota
  su `budgetMs` ENTONCES el turno se descarta, se rehace en determinista antes
  del primer evento audible, y el estado no entra en `error` mientras quede
  reintento (`REQ-1`).
- **C-005-13** DADO un `speaker` que no cierra CUANDO transcurre su
  presupuesto ENTONCES el resultado es `watchdog`, no hay transición de éxito
  y ninguna fase avanza por tiempo transcurrido.
- **C-005-14** DADO el módulo del núcleo CUANDO se lee `PHASES` ENTONCES
  declara exactamente los ocho valores de esta spec y cada uno pertenece a un
  solo estado visible de la tabla de verdad.
- **C-005-15** DADO un turno en el que el puerto falló y el reintento
  determinista también agota su `budgetMs` CUANDO se resuelve el reintento
  ENTONCES el estado pasa a `error` · `failed`, después a `idle` · `idle` con
  `manual_input_required`, no hay un tercer intento y ninguna transición
  produce éxito (`REQ-1`).

## Invariantes

- Los estados visibles son cinco y ningún otro; las fases internas son ocho y
  ninguna otra.
- `phase` nunca es `null` y cada par (`state`, `phase`) pertenece a la tabla
  de verdad: cada fase pertenece a un solo estado visible.
- El estado visible refleja el estado real: no se muestra `listening` con el
  micrófono apagado ni `speaking` sin locución en curso.
- Sólo `done` encadena escucha; `error` y `watchdog` no encadenan nunca.
- Ninguna transición de éxito se produce por temporizador; el agotamiento de
  un presupuesto es un fallo explícito, y su desenlace es el reintento
  determinista único y `error` · `failed` sólo si ese reintento también falla.
- Un resultado tardío, cancelado o de otro turno no produce transición ni
  evento: es no-op.
- Desde `error` no se vuelve al flujo por voz: la única salida es la salida
  declarada —la entrada manual—, y `submitText` es esa salida hacia
  `thinking` · `interpreting`.
- La entrada por texto está disponible en todo estado, nunca como castigo, y
  es siempre una transición válida a `thinking` · `interpreting`.
- Ningún fallo cambia el `mode`, ninguno escribe un valor y ninguno produce
  silencio: siempre hay salida declarada.

**Cobertura de requisitos.** `REQ-1`: C-005-01, C-005-02, C-005-03,
C-005-04, C-005-11, C-005-12, C-005-15.

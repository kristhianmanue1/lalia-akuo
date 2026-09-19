# SPEC-003 — Contrato de locución

**Fase:** F1 — entregable de E1 (primera oleada).
**Cubre:** `REQ-2`.
**Procedencia:** `../product/definicion-tecnica-nucleo.md` §4.3, §4.4,
§4.6, §4.7, §4.9; `../product/definicion-tecnica.md` §9.3 (pregunta E) y
§10; `../adr/ADR-008-ai-model-seams-only.md`; `alubia:PROP-005 §7.3`, `§7.6`
y `§9`.
**Depende de:** [`SPEC-001`](SPEC-001-contrato-del-nucleo.md) —vocabulario y
eventos— y [`SPEC-002`](SPEC-002-disciplina-de-turno.md) —turno, `request` y
no-op—. Esta spec no re-nombra nada de allí.
**Formato:** `../ai-agent-guide/02-specs-adr-contratos.md` §2.2.

```text
SPEC-003 [cubre: REQ-2]
```

## Comportamiento

Hablar es el puerto `speaker`:

```text
speaker.say(text, request) → Promise<'done' | 'error' | 'watchdog'>
speaker.cancel()         → void
```

Equivalencia con la procedencia: `fin` → `done`, `vigilante` → `watchdog`,
`error` → `error`. El enumerado es **cerrado**: cualquier otro valor
resolutivo es un resultado fuera de contrato y el núcleo lo trata como
`port_failure` (`SPEC-001`, `SPEC-002`).

Las tres clases significan una sola cosa cada una:

- `done` — se oyó el cierre **real** de la locución: el evento terminal del
  motor de voz llegó.
- `error` — la locución no se completó: el motor no está disponible, falló
  o fue cancelada por el propio adaptador.
- `watchdog` — el vigilante venció **sin** evento terminal **con voz
  utilizable**: la locución no cerró por señal real.

**Sólo `done` encadena.** Ninguna otra clase ejecuta el paso siguiente, y
ninguna se interpreta como éxito parcial. `error` y `watchdog` dejan el turno
sin encadenar y ofrecen la salida declarada de `SPEC-001` —repregunta, texto
seguro o entrada manual—, nunca silencio (§4.6).

**Resolver por temporizador está prohibido.** El tiempo transcurrido no es una
señal de fin. El núcleo no infiere `done`: si el cierre real no llega, el
resultado es `watchdog`, y `watchdog` no encadena. El vigilante no gobierna
nunca una transición a escucha; sólo cierra en fallo el caso anómalo de
ausencia de señal (§4.7).

**El vigilante presupone voz utilizable.** `watchdog` es la ausencia de señal
terminal **con voz presente**: sin ninguna voz para el idioma declarado, el
adaptador lo detecta antes de hablar y resuelve `error`, no `watchdog`
([`SPEC-011`](SPEC-011-adaptador-web-speech-y-parches.md), P-01 y P-13), así
que el reloj no decide ese caso. Las dos clases son la misma frontera —fallo
declarado— y ninguna es un éxito por tiempo.

**El tope de locución: `SPEECH_BUDGET_MS = 20000`.** Es el `budgetMs` que el
núcleo pone en la petición al `speaker`. Esta spec lo fija con su razón, sin
heredarlo de la procedencia: `alubia:ADR-018` documenta 10 s y el código de
origen usa 20 s sin registro normativo (`alubia:PROP-005 §7.6`). Las
razones de esta elección son:

1. **Es un techo, no el control primario.** El control primario es el
   presupuesto del catálogo, expresado en caracteres y palabras
   (`../product/definicion-tecnica-nucleo.md` §4.4), porque la
   duración real no es computable antes de hablar. El tope de locución sólo
   existe para cerrar en fallo «no llegó señal de fin».
2. **Debe dominar al texto legítimo más largo.** Una locución que lleva el
   dato —readback o resumen— puede pasar de treinta palabras, y la persona
   puede haber elegido una velocidad de voz lenta (`REQ-16`). A la velocidad
   lenta que hay que sostener con holgura, 10 s no alcanza y convertiría cada
   resumen largo en un fallo de vigilante: exactamente el modo de fallo que
   la procedencia ya señala.
3. **El coste de equivocarse no es simétrico.** Si el tope es corto, cada
   turno largo se pierde y la persona lo repite; si es largo, sólo se alarga
   el caso raro en que la síntesis se cuelga. La asimetría pide el valor
   holgado.
4. **El valor es provisional y medible.** `E3-05` mide la duración real de la
   locución más larga en dispositivo; si la medición muestra que 20 s no
   dominan al texto legítimo, se cambia **el valor**, con la medición como
   fuente, sin cambiar este contrato.

El valor coincide con el del código de origen, pero la razón **no** es esa:
la razón es la dominancia del texto legítimo al ritmo lento soportado. No se
cita `voz.js` como autoridad.

**Cancelación.** Apagar el micrófono, `dispose()` o el cierre del turno
cancelan la locución en vuelo: el núcleo llama a `speaker.cancel()` y pasa
`signal` a abortado. Una locución cancelada no encadena, aunque su promesa
resuelva después con `done`: ese `done` es tardío y `SPEC-002` lo descarta.

## Entradas

- `text`: cadena ya compuesta por el núcleo desde el catálogo por clave, con
  sus ranuras ya validadas. No lleva texto libre del consumidor sin validar.
- `request = { turn, budgetMs, signal }`, con
  `budgetMs = SPEECH_BUDGET_MS = 20000`.
- La cancelación: `setMicrophoneMuted(true)`, `dispose()` o cierre del turno.

## Salidas

- `Promise<'done' | 'error' | 'watchdog'>`, que **nunca rechaza**: un fallo de
  voz no bloquea la captura, se reporta como clase de resultado.
- `done` encadena escucha. `error` y `watchdog` no encadenan.
- `error` y `watchdog` producen `failure` con `code = 'speech_failed'` y
  `code = 'speech_watchdog'` respectivamente (`SPEC-001`), más la salida
  declarada del turno.

## Errores

| condición | `code` | estado que queda |
|---|---|---|
| `error`: motor no disponible, falló o el adaptador canceló | `speech_failed` | el turno **no** encadena; salida declarada |
| `watchdog`: venció sin evento terminal | `speech_watchdog` | el turno **no** encadena; salida declarada |
| el `speaker` resuelve con un valor fuera del enumerado | `port_failure` | turno descartado; se rehace en determinista |
| el `speaker` lanza o rechaza | `port_failure` | turno descartado **antes** de hablar audiblemente; se rehace en determinista |
| `speaker.cancel()` durante la locución | — (resultado tardío) | no encadena; no hay evento de éxito |

Invariantes de error: **ningún fallo de locución se convierte en escucha**;
**ningún fallo produce silencio** —siempre hay salida declarada—; un fallo
de locución no cambia el modo ni escribe un valor.

## Casos

Identificador estable; los casos nuevos se añaden con el siguiente número
libre.

- **C-003-01** DADO un `speaker` determinista que resuelve `done` CUANDO se
  completa la locución ENTONCES el paso siguiente se ejecuta y el estado
  visible avanza a `listening`.
- **C-003-02** DADO un `speaker` que resuelve `error` CUANDO termina la
  locución ENTONCES el paso siguiente **no** se ejecuta, no hay transición a
  `listening` y se emite `failure` con `code = 'speech_failed'` (`REQ-2`).
- **C-003-03** DADO un `speaker` que resuelve `watchdog` CUANDO termina la
  locución ENTONCES el paso siguiente **no** se ejecuta y se emite `failure`
  con `code = 'speech_watchdog'`.
- **C-003-04** DADO una locución cancelada por `setMicrophoneMuted(true)`
  CUANDO el paso siguiente sería la escucha ENTONCES el paso siguiente no se
  ejecuta en ningún caso (`REQ-2`).
- **C-003-05** DADO un `speaker` que nunca resuelve CUANDO se agota
  `SPEECH_BUDGET_MS` ENTONCES se emite `failure` con
  `code = 'port_budget_exhausted'`, el turno se rehace en determinista y
  ninguna transición de éxito ocurre por tiempo (`SPEC-004`).
- **C-003-07** DADO el módulo del núcleo CUANDO se lee `SPEECH_BUDGET_MS`
  ENTONCES vale `20000` y es el `budgetMs` que recibe el `speaker` en su
  `request`.
- **C-003-08** DADO un `speaker` de doble que registra su `request` CUANDO se
  invoca una locución ENTONCES el `request` lleva `turn`, `budgetMs =
  SPEECH_BUDGET_MS` y `signal`.
- **C-003-09** DADO una locución en vuelo CUANDO se llama `speaker.cancel()`
  y después la promesa resuelve `done` ENTONCES ese `done` es tardío y no
  encadena (`SPEC-002`).
- **C-003-10** DADO un `speaker` que resuelve `done` fuera de su
  `expectedState` CUANDO llega el resultado ENTONCES es no-op y no encadena.
- **C-003-11** DADO un `speaker` que resuelve un valor distinto de `done`,
  `error` o `watchdog` CUANDO llega el resultado ENTONCES se emite `failure`
  con `code = 'port_failure'` y el turno se rehace en determinista.

## Invariantes

- Sólo `done` —el cierre real— encadena escucha.
- `error` y `watchdog` **nunca** encadenan y siempre dejan salida declarada.
- Ningún temporizador produce una transición de éxito. `watchdog` es el
  valor que **resuelve el adaptador** —su vigilancia venció sin evento
  terminal, con voz utilizable—; el `budgetMs` del núcleo
  (`SPEECH_BUDGET_MS`) agotado es `port_budget_exhausted` con redo
  determinista (`SPEC-004`, `C-003-05`), y sin voz el resultado declarado
  del adaptador es `error`.
- El enumerado de resultado es cerrado; un valor fuera de él es fallo del
  puerto.
- `SPEECH_BUDGET_MS` es un techo: el control primario de duración es el
  presupuesto del catálogo en caracteres y palabras.
- El texto que se habla sale del catálogo por clave con ranuras ya
  validadas; el núcleo no compone literales.

**Cobertura de requisitos.** `REQ-2`: C-003-01, C-003-02, C-003-03,
C-003-04, C-003-05, C-003-11.

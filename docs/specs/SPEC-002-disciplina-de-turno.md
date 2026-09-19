# SPEC-002 — Disciplina de turno

**Fase:** F1 — entregable de E1 (primera oleada).
**Cubre:** `REQ-3`.
**Procedencia:** `../product/definicion-tecnica-nucleo.md` §4.3, §4.6, §4.7;
`../product/definicion-tecnica.md` §9.3, §10;
`../adr/ADR-008-ai-model-seams-only.md`; `alubia:PROP-005 §7.2` y `§7.3`.
**Depende de:** [`SPEC-001`](SPEC-001-contrato-del-nucleo.md), que fija el
vocabulario (`request`, `ports`, el catálogo de eventos y los códigos de
error). Esta spec no re-nombra nada de allí.
**Formato:** `../ai-agent-guide/02-specs-adr-contratos.md` §2.2.

```text
SPEC-002 [cubre: REQ-3]
```

## Comportamiento

Cada paso del flujo ocurre dentro de un **turno**. Un turno es la unidad que
decide si un resultado cuenta: si pertenece al turno abierto y vigente, se
aplica; si no, es **no-op** — ni estado, ni valor, ni transición. La regla no
adjudica «lo más parecido»: un resultado ajeno se descarta.

Un turno nace al emitir la petición, con tres partes:

```text
Turn = {
  id:            entero >= 1, estrictamente creciente por sesión,
  token:         valor opaco único en la sesión,
  expectedState: uno de los estados visibles de SPEC-001,
}
```

- `id` es **monotónico**: no se reutiliza, no se reinicia y no salta hacia
  atrás. Es la parte que un rastro puede ordenar.
- `token` es opaco: su forma la elige el núcleo y el consumidor no la
  interpreta. Sirve para distinguir dos turnos con el mismo `id` en
  documentos distintos y como clave de comparación, nada más.
- `expectedState` es el estado visible que el turno espera al resolverse.
  Resolver fuera de ese estado —porque el estado cambió mientras estaba en
  vuelo— es una condición de no-op, no un resultado a aplicar.

La petición que recibe cada puerto es `request = { turn, budgetMs, signal }`
(equivalencia: `Peticion` de §4.3). El núcleo **etiqueta** con ese turno cada
invocación y cada callback de puerto; al llegar un resultado compara la
etiqueta con el turno abierto:

```text
ACEPTADO  ⇔  etiqueta.id == turnoAbierto.id
           y  etiqueta.token == turnoAbierto.token
           y  session.state == etiqueta.expectedState
           y  el turno no está resuelto ni cancelado
NO-OP     ⇔  cualquier otra combinación
```

**Cancelación.** Un turno se cancela al apagar el micrófono, al llamar
`dispose()` o cuando el propio núcleo cierra el turno. Cancelar significa dos
cosas a la vez: el núcleo pasa `signal` a abortado y llama a `cancel()` del
puerto en vuelo. Un resultado posterior al `abort` es no-op.

**Doble callback.** `onPartial` puede dispararse muchas veces mientras el
turno está abierto y cada llamada se acepta. `onNoSpeech` y `onError`
resuelven el turno y por eso lo cierran: una segunda llamada para el mismo
turno es no-op. Cualquier callback posterior a la resolución o a la
cancelación es no-op.

**Ningún temporizador decide.** El transcurso del tiempo no produce un
resultado aceptado: `budgetMs` es el tope de la petición y su agotamiento
produce un **fallo explícito** del turno —`port_budget_exhausted`—, nunca
un éxito inferido ni una transición a escucha. El reloj del núcleo no cierra
turnos con resultado; sólo los abre a fallo.

## Entradas

- La invocación de un puerto del turno abierto, con su `request`.
- El resultado —promesa resuelta o callback— que el puerto entrega.
- Las señales que cancelan: `setMicrophoneMuted(true)`, `dispose()`.
- El agotamiento de `budgetMs`.

## Salidas

- Un resultado aceptado aplica al turno abierto y puede producir transición,
  evento o valor confirmado.
- Un resultado no-op **no produce ninguna salida observable**: ni evento, ni
  cambio de `state`, ni escritura en `session.values`.
- El agotamiento de `budgetMs` produce `failure` con
  `code = 'port_budget_exhausted'` y el estado de fallo declarado.
- La cancelación de un turno en vuelo produce la salida declarada del paso
  —repregunta, texto seguro o entrada manual—, nunca silencio.

## Errores

| condición | `code` | estado que queda |
|---|---|---|
| resultado tardío: llega con el turno ya resuelto | — (no-op) | sin cambio; no hay evento |
| resultado cancelado: llega tras `abort` | — (no-op) | sin cambio; no hay evento |
| resultado de otro turno o con otro `token` | — (no-op) | sin cambio; no hay evento |
| resultado con `expectedState` que ya no se cumple | — (no-op) | sin cambio; no hay evento |
| segundo `onNoSpeech` o segundo `onError` del mismo turno | — (no-op) | sin cambio; no hay evento |
| callback después de resolver o cancelar | — (no-op) | sin cambio; no hay evento |
| puerto que agota `budgetMs` | `port_budget_exhausted` | fallo explícito del turno; nunca éxito |
| puerto que lanza, rechaza o rompe contrato | `port_failure` | el turno se descarta **antes** de hablar y se rehace en determinista |

Invariantes de error: un resultado no-op **no deja rastro observable**; el
agotamiento del presupuesto nunca se convierte en resultado aceptado; un
turno cancelado no vuelve a abrirse.

## Casos

Identificador estable; los casos nuevos se añaden con el siguiente número
libre.

- **C-002-01** DADO una sesión que abre varios turnos seguidos CUANDO se
  leen sus `turn.id` ENTONCES la secuencia es estrictamente creciente y
  ningún `id` se repite.
- **C-002-02** DADO un turno ya resuelto CUANDO la promesa de su puerto
  resuelve más tarde con un resultado válido ENTONCES `session.state` y
  `session.values` no cambian y no se emite ningún evento.
- **C-002-03** DADO un turno cancelado por `setMicrophoneMuted(true)`
  CUANDO su promesa resuelve después ENTONCES el resultado es no-op.
- **C-002-04** DADO un doble de puerto que responde después de que se abrió
  el turno siguiente CUANDO llega su resultado ENTONCES se descarta y el
  turno abierto sigue sin cambio.
- **C-002-05** DADO un resultado etiquetado con un `token` distinto del
  turno abierto CUANDO llega ENTONCES es no-op.
- **C-002-06** DADO un turno cuyo `expectedState` dejó de cumplirse porque
  el estado cambió en vuelo CUANDO llega su resultado ENTONCES es no-op.
- **C-002-07** DADO un turno abierto CUANDO `onNoSpeech` se dispara dos
  veces para el mismo turno ENTONCES sólo la primera se acepta y la segunda
  es no-op.
- **C-002-08** DADO un turno abierto CUANDO `onPartial` se dispara varias
  veces ENTONCES todas se aceptan mientras el turno siga abierto.
- **C-002-09** DADO un turno cerrado CUANDO su `onError` se dispara después
  ENTONCES ese callback es no-op y no abre un turno nuevo.
- **C-002-10** DADO cualquier puerto invocado por el núcleo CUANDO se
  inspecciona su `request` ENTONCES lleva `turn`, `budgetMs` y `signal`, y
  `signal` es un `AbortSignal` que se aborta al cancelar el turno.
- **C-002-11** DADO un puerto que nunca resuelve CUANDO se agota su
  `budgetMs` ENTONCES se emite `failure` con
  `code = 'port_budget_exhausted'` y no hay ninguna transición de éxito.
- **C-002-12** DADO un turno en vuelo CUANDO el estado observable se
  inspecciona tras inyectar resultados tardíos, cancelados y de otro turno
  ENTONCES el estado es idéntico al de antes de inyectarlos (`REQ-3`).

## Invariantes

- Todo turno lleva `id` monotónico, `token` y `expectedState`.
- Un resultado tardío, cancelado o de otro turno **no altera nada**: es
  no-op, sin evento ni valor.
- El agotamiento del presupuesto **también aborta `signal`**: el cierre del
  turno por parte del núcleo es cancelación para el puerto en vuelo, con
  `cancel()` de ese puerto llamado por quien conduce (`SPEC-004`).
- Ninguna transición se produce por temporizador; el agotamiento del
  presupuesto produce un fallo explícito del turno, nunca éxito.
- Un turno resuelto o cancelado no se reabre ni acepta más callbacks.
- El núcleo es el único lugar donde se decide si un resultado cuenta
  (`../product/definicion-tecnica-frontera.md` §3.2).
- Cancelar un turno pasa `signal` a abortado **y** llama a `cancel()` del
  puerto; no basta con una de las dos.

**Cobertura de requisitos.** `REQ-3`: C-002-01, C-002-02, C-002-03,
C-002-04, C-002-05, C-002-06, C-002-07, C-002-09, C-002-12.

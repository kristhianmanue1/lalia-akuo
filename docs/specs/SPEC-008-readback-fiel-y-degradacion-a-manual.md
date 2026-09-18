# SPEC-008 — Readback fiel y degradación a manual

**Fase:** F1 — entregable de E1 (segunda oleada).
**Cubre:** `REQ-7`, `REQ-8`.
**Procedencia:** `../product/definicion-tecnica-nucleo.md` §4.4, §4.6, §4.7
y §4.8; `../product/definicion-tecnica.md` §9.3 (preguntas F y G);
`../adr/ADR-008-ai-model-seams-only.md`;
`../adr/ADR-007-no-persistence.md`; `alubia:PROP-005 §5.1 OBJ-6` y `OBJ-7`.
**Depende de:** [`SPEC-001`](SPEC-001-contrato-del-nucleo.md) —vocabulario,
eventos y códigos—, [`SPEC-003`](SPEC-003-contrato-de-locucion.md) —clases
de resultado de la locución— y
[`SPEC-007`](SPEC-007-catalogo-de-idioma.md) —composición por clave—. Esta
spec no re-nombra nada de allí.
**Formato:** `../ai-agent-guide/02-specs-adr-contratos.md` §2.2.

```text
SPEC-008 [cubre: REQ-7, REQ-8]
```

## Comportamiento

Las dos mitades de esta spec comparten una sola pregunta: **qué oye la
persona frente a lo que se guarda**. El readback fiel fija que lo oído y
lo guardado sean el mismo valor; la degradación a manual fija que, cuando
la voz no puede seguir, el flujo siga —por texto— sin declarar un éxito
de voz que no ocurrió.

### Readback fiel

El ciclo de confirmación de un campo es:

```text
interpretar → validar (tipo y rango) → componer readback
  → confirmation_requested{ value, unit, spokenValue, displayText,
                            speechText }
  → speaker.say(readback)
  → escuchar el control → afirmación
  → value_confirmed{ fieldId, value, unit, spokenValue }
  → session.values[fieldId] = { value, unit }
```

`spokenValue` es el readback literal: el texto tal como se pronunció. El
núcleo lo compone con la plantilla del catálogo y el valor ya validado
como ranura (`SPEC-007`); no lo pide a un puerto de redacción y no lo
inventa. La garantía es de igualdad exacta:

- `value_confirmed.value` es **el mismo** valor que llevaba
  `confirmation_requested.value`;
- `value_confirmed.spokenValue` es **la misma cadena** que se pronunció en
  el readback;
- `session.values[fieldId].value` es ese valor y
  `session.values[fieldId].unit` es la unidad declarada por el campo.

El núcleo **no transforma el valor** entre el readback y el guardado: no
redondea, no trunca, no reconvierte unidades ni reformatea con la
locale. Si el interpretador produjo una aproximación, esa aproximación es
el valor, y es la que se dice y se guarda. Cambiar el valor entre lo
dicho y lo guardado es exactamente lo que `REQ-7` prohíbe.

**Resumen y anuncio de guardado.** El resumen de lo reunido y el anuncio
de que se guardó son texto de formulario que **compone el núcleo** con la
plantilla del catálogo y el valor ya validado. **No pasan por el puerto
`phrases`** ni por un redactor, porque son los textos que llevan el dato y
deben coincidir con lo que se guarda (`ADR-008`, §4.4). El anuncio se
emite como `text_output` y la señal de guardado es `value_confirmed`:
ninguno de los dos lo redacta un puerto. Estas claves pueden declararse en
`policy.immutableTextKeys` (`SPEC-006`) y entonces ningún reemplazo se
acepta.

**Sin confirmación no hay valor.** Ningún valor llega a `session.values`
sin confirmación explícita; ninguna confirmación se pide sin un readback
previo que haya dicho el valor. Si la locución del readback falla —`error`
o `watchdog` (`SPEC-003`)—, el turno no encadena la escucha, no hay
`value_confirmed` y el valor **no se guarda**: queda la salida declarada.

### Degradación a manual

La degradación es **parte del flujo, nunca un error**. Cuando la voz no
puede seguir, el núcleo emite `manual_input_required` con el motivo y la
persona continúa escribiendo. Concretamente:

- **no** deja la sesión en `state = 'error'`;
- **nunca** declara éxito de voz: no emite `value_confirmed` por la vía
  hablada; el valor que se confirme después vendrá de `submitText`;
- **nunca** produce silencio: siempre hay un aviso visible, tomado por
  clave de `policy.degradation.noticeKey`;
- la entrada por texto está disponible en **todo** estado y no es un
  castigo (`REQ-9`, `SPEC-001`).

**Disparadores.** Esta spec fija tres, y ninguno lo adivina el núcleo: la
condición la reporta el adaptador o el puerto.

1. **Sin permiso de micrófono.** El `listener` lo reporta como error de
   reconocimiento; el núcleo lo mapea al enumerado cerrado
   (`recognition_failed`). El núcleo no pide permiso ni inspecciona el
   navegador.
2. **Sin conexión.** El adaptador o el puerto reporta la indisponibilidad;
   el núcleo **no** sondea la red ni el DOM (no tiene ninguno de los dos).
   Si la reporta la escucha, se mapea a `recognition_failed` y degrada a
   manual. Si la reporta otro puerto, es `port_failure`: el turno se descarta
   **antes** del primer evento audible y se rehace en determinista, sin pasar
   por la entrada manual. `port_failure` significa siempre lo mismo en todas
   las spec (`SPEC-001`, `SPEC-004`, `SPEC-005`); la indisponibilidad de
   conexión no cambia su desenlace.
3. **Fallos repetidos.** El núcleo cuenta los fallos consecutivos del
   mismo paso. Al alcanzar el límite declarado, degrada a manual. El
   límite vive en `policy.degradation.maxConsecutiveFailures`, un entero
   positivo y finito cuyo contrato fija `SPEC-001`. Si no está declarado,
   el límite es **1**: ante el primer fallo del paso se degrada a manual.
   Es la lectura fail-closed —degradar antes es más seguro que insistir—.
   Un valor que no sea un entero finito positivo es `invalid_config`.

El motivo del evento es un valor del enumerado cerrado de
`manual_input_required.reason`, la definición `manualReason` de
[`../../schema/eventos.json`](../../schema/eventos.json): `no_speech`,
`recognition_failed`, `speech_failed`, `speech_watchdog`, `port_failure` y
`port_budget_exhausted`. El núcleo no inventa cadenas de motivo ni emite uno
fuera de esa lista. El texto visible del aviso sale de
`policy.degradation.noticeKey`.

**La entrada manual recorre el mismo camino.** Un valor que llega por
`submitText` pasa por la misma validación de tipo y rango, la misma
confirmación con readback y la misma señal de guardado que un valor
dictado. La fidelidad de `REQ-7` no depende del canal: lo que se oye o se
lee antes de confirmar es lo que se guarda. La degradación tampoco cambia
`mode`, no escribe `session.values` por sí sola y no deja el flujo sin
salida: todo paso que falla desemboca en reintento de voz, texto seguro o
entrada manual, nunca en un bucle.

## Entradas

- El valor interpretado y **ya validado** (tipo y, si aplica, rango) del
  campo activo.
- El campo declarado (`field.id`, `field.type`, `field.unit`) y las claves
  de readback, resumen y anuncio, resueltas del catálogo.
- Las condiciones de fallo que reportan los puertos: permiso denegado,
  indisponibilidad de conexión, errores de reconocimiento y de locución.
- `policy.degradation`: `noticeKey` (obligatorio en la creación) y
  `maxConsecutiveFailures` (opcional; ausente = 1).
- `submitText(text)`, disponible en todo estado.

## Salidas

- `confirmation_requested` con `value`, `unit`, `spokenValue`,
  `displayText` y `speechText`; el valor que se va a guardar, dicho.
- `value_confirmed` con el mismo `value` y el mismo `spokenValue` que se
  pronunciaron, y la escritura correspondiente en `session.values`.
- `text_output` con el resumen y el anuncio de guardado.
- `manual_input_required` con `reason`, `fieldId`, `displayText` y
  `speechText` cuando el flujo pasa a texto.
- En ningún caso la degradación produce `state = 'error'` ni un fallo sin
  salida declarada.

## Errores

| condición | `code` | estado que queda |
|---|---|---|
| la locución del readback devuelve `error` | `speech_failed` | el turno no encadena; el valor **no** se guarda; salida declarada |
| la locución del readback devuelve `watchdog` | `speech_watchdog` | el turno no encadena; el valor **no** se guarda; salida declarada |
| falta la clave de readback, de resumen o de anuncio | `missing_text` | no se improvisa texto; no se confirma ni se guarda |
| el readback excede el presupuesto del catálogo | `over_budget` | no se habla; salida declarada; no se guarda |
| el control de confirmación no se resuelve | `unresolved_value` | repregunta; no se guarda nada |
| el control no se clasifica | `unclassified_control` | fail-closed: no se interpreta como afirmación; no se guarda |
| micrófono denegado, reportado por el `listener` | `recognition_failed` | se emite `manual_input_required`; el flujo sigue por texto; **no** es `error` |
| conexión indisponible, reportada por el `listener` | `recognition_failed` | se emite `manual_input_required`; el flujo sigue por texto |
| conexión indisponible reportada por otro puerto | `port_failure` | el turno se descarta **antes** de hablar y se rehace en determinista; **no** es degradación a manual |
| fallos consecutivos hasta el límite declarado | el del último fallo | se emite `manual_input_required`; el flujo sigue por texto |
| confirmación afirmativa | — | `value_confirmed` con el valor y el `spokenValue` del readback |

Invariantes de error: ningún fallo se convierte en un valor guardado;
ningún fallo produce silencio —siempre hay salida declarada—; ningún fallo
de degradación cambia el modo ni declara un éxito de voz; un valor no
confirmado no llega a `session.values`.

## Casos

Identificador estable; los casos nuevos se añaden con el siguiente número
libre.

- **C-008-01** DADO un valor interpretado y validado CUANDO se emite
  `confirmation_requested` ENTONCES `spokenValue` es el readback con el
  valor exacto y `value` es ese mismo valor.
- **C-008-02** DADO una confirmación afirmativa CUANDO se guarda ENTONCES
  `value_confirmed.value` es exactamente el de `confirmation_requested`,
  `value_confirmed.spokenValue` es la cadena pronunciada y
  `session.values[fieldId].value` también (`REQ-7`).
- **C-008-03** DADO un valor con parte decimal CUANDO se compone el
  readback ENTONCES `spokenValue` lo dice tal cual: sin redondeo, sin
  truncamiento y sin conversión de unidad (`REQ-7`).
- **C-008-04** DADO el resumen y el anuncio de guardado CUANDO se
  componen ENTONCES no se invoca el puerto `phrases` para sus claves: los
  compone el núcleo con el valor ya validado (`REQ-7`).
- **C-008-05** DADO una clave de readback ausente del catálogo CUANDO el
  turno pide la confirmación ENTONCES no se pide confirmación verbal, se
  emite `failure` con `code = 'missing_text'` y el valor no se guarda.
- **C-008-06** DADO que la locución del readback devuelve `error` o
  `watchdog` CUANDO termina el paso ENTONCES el turno no encadena, no hay
  `value_confirmed` y el valor no se guarda.
- **C-008-07** DADO un turno que termina sin confirmación explícita
  CUANDO se inspecciona `session.values` ENTONCES el campo está ausente:
  ningún valor no confirmado se escribe (`REQ-7`).
- **C-008-08** DADO un `listener` que reporta permiso de micrófono
  denegado CUANDO el flujo pide escucha ENTONCES se emite
  `manual_input_required` con un `reason` del enumerado, la sesión **no**
  entra en `error` y `submitText` queda disponible (`REQ-8`).
- **C-008-09** DADO un entorno sin conexión reportado por el `listener`
  CUANDO el flujo no puede seguir por voz ENTONCES termina por entrada
  manual y **nunca** emite `value_confirmed` por la vía de voz (`REQ-8`).
- **C-008-10** DADO fallos consecutivos del mismo paso CUANDO se alcanza
  el límite declarado ENTONCES se emite `manual_input_required` y el flujo
  termina por texto (`REQ-8`).
- **C-008-11** DADO un valor que llega por `submitText` tras degradar
  CUANDO se confirma ENTONCES pasa por la misma validación, confirmación y
  readback, y `value_confirmed.spokenValue` coincide con el readback
  mostrado (`REQ-7`).
- **C-008-12** DADO una degradación CUANDO se inspecciona la sesión
  ENTONCES `state` no es `'error'`, `mode` no cambia, `session.values` no
  crece y hay un aviso visible por `policy.degradation.noticeKey`
  (`REQ-8`).
- **C-008-13** DADO fallos repetidos del paso y **sin**
  `maxConsecutiveFailures` declarado CUANDO ocurre el primer fallo ENTONCES
  degrada a manual: el límite por omisión es 1, fail-closed.
- **C-008-14** DADO una `config` sin `policy.degradation` CUANDO se crea
  la sesión ENTONCES `ConfigError` con `code = 'missing_policy'` y no hay
  sesión: la salida manual no es un extra opcional (`REQ-8`).
- **C-008-15** DADO un paso con `confirmation.maxAttempts` y
  `degradation.maxConsecutiveFailures` declarados y un intento que primero
  se repregunta y luego falla CUANDO se agota el primero de los dos
  contadores ENTONCES el paso degrada a manual en ese punto y no espera al
  otro (`REQ-8`).

## Invariantes

- Lo que se dice y lo que se guarda son **el mismo valor**: `spokenValue`,
  el valor del evento y `session.values` coinciden exactamente.
- El núcleo no redondea, no trunca y no reconvierte unidades entre el
  readback y el guardado.
- El resumen y el anuncio de guardado los compone el núcleo; **no pasan
  por el puerto `phrases`**.
- Ningún valor llega a `session.values` sin confirmación explícita, y
  ninguna confirmación se pide sin un readback previo que dijera el valor.
- La degradación es parte del flujo: **nunca** es `state = 'error'` y
  **nunca** declara un éxito de voz.
- La degradación no produce silencio: siempre hay salida visible, y la
  entrada por texto está disponible en todo estado.
- El límite de fallos repetidos es un entero finito declarado; ausente,
  vale 1. Sin él, el flujo no puede entrar en un bucle.
- La degradación por contadores ocurre en cuanto se agota **el primero** de
  `policy.confirmation.maxAttempts` o
  `policy.degradation.maxConsecutiveFailures`, y desemboca en la entrada
  manual.
- El valor que llega tras degradar recorre la misma validación,
  confirmación y readback que el valor dictado.
- Un fallo no cambia el modo y no escribe un valor.

**Cobertura de requisitos.** `REQ-7`: C-008-01, C-008-02, C-008-03,
C-008-04, C-008-05, C-008-06, C-008-07, C-008-11. `REQ-8`: C-008-08,
C-008-09, C-008-10, C-008-12, C-008-13, C-008-14, C-008-15.

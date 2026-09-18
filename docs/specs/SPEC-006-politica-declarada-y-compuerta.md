# SPEC-006 — Política declarada y compuerta

**Fase:** F1 — entregable de E1 (segunda oleada).
**Cubre:** `REQ-10`, `REQ-11`.
**Procedencia:** `../product/definicion-tecnica-nucleo.md` §4.4, §4.5,
§4.8 y §4.9; `../product/definicion-tecnica-frontera.md` §2;
`../product/definicion-tecnica.md` §9.3 (preguntas A y F);
`../adr/ADR-001-mechanism-policy-boundary.md`; `alubia:PROP-005 §4.4`.
**Depende de:** [`SPEC-001`](SPEC-001-contrato-del-nucleo.md), que fija el
vocabulario (`config.policy`, los puertos, los eventos y los códigos de
error); [`SPEC-002`](SPEC-002-disciplina-de-turno.md) y
[`SPEC-003`](SPEC-003-contrato-de-locucion.md). Esta spec no re-nombra
nada de allí.
**Formato:** `../ai-agent-guide/02-specs-adr-contratos.md` §2.2.

```text
SPEC-006 [cubre: REQ-10, REQ-11]
```

## Comportamiento

La política entra por un solo punto: `config.policy`. El núcleo **expone
el punto y no decide su contenido**. Declarar no es una operación: no
emite eventos, no cambia el estado y no toca nada. Lo que esta spec fija
es (1) qué se puede declarar, (2) qué hace el núcleo cuando no se declara
nada y (3) en qué orden la compuerta se aplica respecto de la locución.

**Qué se puede declarar.** Los miembros son los de `config.policy`
(SPEC-001); aquí se fija su efecto:

| miembro | declara el consumidor | efecto en el núcleo |
|---|---|---|
| `degradation` | cómo se ve la degradación (`noticeKey`) y cuántos fallos consecutivos admite (`maxConsecutiveFailures`) | obligatorio en la creación: sin él no hay sesión |
| `confirmation` | cuántos intentos no resueltos del mismo paso admite (`maxAttempts`) | al agotar el contador finito, degrada a la entrada manual |
| `blockedClasses` | qué clases cierran la compuerta | una clase de la lista no se habla |
| `safeTextKey` | el texto que sustituye a lo bloqueado | sustituye al candidato cuando la compuerta cierra |
| `immutableTextKeys` | qué claves no admiten redacción sustituida | el núcleo rechaza todo reemplazo de esas claves |
| `filter` | qué se filtra del texto que se va a pronunciar | punto de declaración; su evaluación llega con el canal de agente |
| `data` | qué sale, a quién y con qué retención | punto de declaración; el núcleo no lo evalúa |

`filter` y `data` son puntos, no contenido: su forma interna la fija el
consumidor. Esta spec **no** dice qué se filtra, qué se bloquea ni con qué
retención: fijarlo sería introducir una política de dominio, que es
exactamente lo que `REQ-10` prohíbe.

**Clases de texto.** Del origen del texto el núcleo deriva una clase, de
un enumerado cerrado:

```text
class ∈ { 'form', 'conversational' }
```

`form` es el camino de formulario de §4.4: preguntas, readback, resumen,
avisos y anuncios, resueltos del catálogo por clave con ranuras ya
validadas. `conversational` es el camino de texto libre, que llega con el
canal de agente y no entra en la primera versión. La clasificación por
origen es lo único que decide el núcleo; **qué clase se bloquea lo declara
el consumidor**.

El enumerado de clases es **vocabulario del núcleo, no política del
consumidor**: `blockedClasses` sólo admite miembros de ese enumerado, y uno
fuera de él —`'conversacional'` en lugar de `'conversational'`, por
ejemplo— es `invalid_config` en la creación, sin sesión. Aceptarlo y
compararlo después contra un enumerado con el que nunca coincide dejaría la
compuerta abierta para siempre, y ese fallo sería silencioso.

Un texto que un puerto de sustitución devuelve para una clave —el puerto
`phrases`, o un redactor futuro— deja de ser texto de catálogo y cuenta
como `conversational` para la compuerta, aunque su clave pertenezca al
formulario. Razón: el «filtro es completo por construcción» de §4.4 sólo
vale para el texto resuelto del catálogo por clave directa; en cuanto un
puerto introduce texto, hay texto libre que filtrar.

**La compuerta, antes de hablar.** Para cada texto que va a pronunciarse,
y **antes** de invocar al `speaker`:

```text
candidate(text, class)
  → filtro        (si está declarado; en la primera versión sólo tiene
                   efecto sobre `conversational`)
  → compuerta     ¿class ∈ blockedClasses?
        no   → habla el candidato
        sí   → habla el texto seguro de `safeTextKey`
               sin `safeTextKey` → no habla; salida declarada
  → speaker.say(resolved_text, request)
```

El texto resuelto —candidato o texto seguro— es el mismo que llevan
`displayText` y `speechText` de `text_output` y de
`confirmation_requested`: un candidato bloqueado no aparece en ninguno de
los dos. Decisión de esta spec: la compuerta sustituye el candidato en
los dos campos, no sólo en `speechText`, porque el bloqueo es sobre el
contenido y dejar el texto bloqueado a la vista cumpliría el mismo
propósito que pronunciarlo. El texto seguro se emite **sólo** como
resultado de una compuerta cerrada y no se vuelve a someter a la
compuerta: no hay recursión.

**Claves intocables.** Una clave de `immutableTextKeys` se resuelve
siempre del catálogo por clave directa. Si un puerto de sustitución
devuelve otro texto para esa clave, el núcleo rechaza el reemplazo: es un
fallo del puerto y el turno se descarta antes de hablar, sin emitir el
texto sustituido. §6.1 habla de «la marca de las claves que no admiten
sustitución» dentro del paquete; por precedencia de vocabulario
(SPEC-001), el lugar canónico de esa declaración es
`policy.immutableTextKeys`, y una marca del paquete se lee como la misma
declaración.

**Qué pasa si no se declara nada.** Fail-closed, con la forma que cierra
§9.3-A:

- `policy` ausente, o `policy.degradation` ausente: se lanza
  `ConfigError` con `code = 'missing_policy'` en la creación. No queda
  sesión, ningún puerto se invoca y no hay eventos. La declaración
  exigida es obligatoria porque el núcleo no puede aplicar fail-closed en
  la vista si no sabe cómo se ve el fallo (§9.3-F).
- `filter`, `blockedClasses` y `safeTextKey` ausentes: el camino de texto
  conversacional queda cerrado y **no se habla ningún texto
  conversacional**. El camino de formulario sigue funcionando: sus claves
  y sus campos los declaró el consumidor, y §9.3-A dice que quien no
  declara nada obtiene «texto de formulario y ningún texto
  conversacional». Como el texto sustituido por un puerto cuenta como
  conversacional, con estas tres declaraciones ausentes no se habla: el
  paso usa el texto del catálogo por clave directa o su salida declarada.
- `data` ausente: no hay punto donde declarar qué sale. La ausencia no
  bloquea la creación —hoy ningún paso lo necesita— y no cambia el
  comportamiento, porque el núcleo no tiene ruta propia de salida.
- `confirmation.maxAttempts` o `degradation.maxConsecutiveFailures`
  ausentes: rige su valor por omisión (**1**), fail-closed; el paso degrada
  al primer intento o fallo no resuelto.
- `immutableTextKeys` ausente: ninguna clave queda protegida por
  política; las marcas del paquete de idioma, si existen, siguen
  aplicando ([`SPEC-007`](SPEC-007-catalogo-de-idioma.md)).
- Un paso que exige una declaración ausente **no se ejecuta** y produce
  `failure` con `code = 'missing_policy'`; nunca se ejecuta con un
  defecto inventado.

**Sin red y sin almacenamiento.** Aplicar la política es una operación
local y determinista: el filtro y la compuerta no abren red, no leen ni
escriben almacenamiento y no registran. El punto `data` declara lo que el
consumidor permite que salga del dispositivo, pero el núcleo no evalúa
esa declaración en la primera versión ni tiene una ruta por la que sacar
nada. `CAPABILITIES` declara esta polaridad (SPEC-001) y esta spec sólo
añade que la aplicación de la política no la rompe.

## Entradas

- `config.policy`, con los siete miembros y los tipos que fija SPEC-001.
  Un miembro desconocido o mal formado es `invalid_config`.
- El texto candidato y su clase, en cada punto donde el núcleo va a
  hablar.
- El catálogo del paquete activo (`config.language.pack`), para resolver
  por clave el texto seguro y el aviso de degradación.
- Las declaraciones del consumidor son datos de configuración: el núcleo
  las valida en la frontera, una sola vez, y no las reinterpreta.

## Salidas

- El texto resuelto que llega a `speaker.say` y a los campos
  `displayText` y `speechText` de los eventos.
- Nada más observable: declarar no produce salida, y la compuerta no
  emite un evento propio. Su efecto se observa en el texto que sí se
  habla.
- Cuando el núcleo no puede resolver —falta la declaración que el paso
  exige o falta el texto seguro—, `failure` con `code = 'missing_policy'`
  o `code = 'missing_text'` y la salida declarada del paso.

## Errores

| condición | `code` | estado que queda |
|---|---|---|
| `policy` ausente, o `policy.degradation` ausente, en la creación | `missing_policy` | no hay sesión; ningún puerto se invoca; no hay eventos |
| un paso exige `filter`, `blockedClasses` o `safeTextKey` y no está | `missing_policy` | el paso no se ejecuta; no se habla; salida declarada |
| candidato de clase bloqueada sin `safeTextKey` | `missing_policy` | el candidato no se habla; salida declarada |
| texto conversacional fuera de política (filtro) | `invalid_agent_text` | no se habla; texto seguro o descarte |
| `safeTextKey` declarado pero su clave no está en el catálogo | `missing_text` | no se improvisa texto; salida declarada |
| un puerto sustituye una clave de `immutableTextKeys` | `port_failure` | el turno se descarta antes de hablar y se rehace en determinista |
| la clase del candidato queda fuera del enumerado cerrado | `port_failure` | el turno se descarta; se rehace en determinista |
| `policy` con un miembro desconocido o mal formado | `invalid_config` | no hay sesión |
| `blockedClasses` con un miembro fuera del enumerado cerrado de clases | `invalid_config` | no hay sesión; la compuerta no queda inerte en silencio |

Invariantes de error: ninguna ausencia de política se rellena con un
defecto; ninguna compuerta cerrada produce silencio —siempre hay texto
seguro o salida declarada—; ningún fallo de compuerta se convierte en
valor guardado ni cambia el modo.

## Casos

Identificador estable; los casos nuevos se añaden con el siguiente número
libre.

- **C-006-01** DADO una `config` sin `policy` CUANDO se llama
  `createVoiceSession(config)` ENTONCES lanza `ConfigError` con
  `code = 'missing_policy'`, no se devuelve sesión, no se invoca ningún
  puerto y no hay eventos.
- **C-006-02** DADO una `config` con `policy` pero sin
  `policy.degradation` CUANDO se crea la sesión ENTONCES lanza
  `ConfigError` con `code = 'missing_policy'`: declarar cómo se ve la
  degradación es obligatorio para crear la sesión.
- **C-006-03** DADO una `config` sin `filter`, sin `blockedClasses` y sin
  `safeTextKey` CUANDO se conduce un turno determinista por el camino de
  formulario ENTONCES el turno llega a su desenlace y no se habla ningún
  texto conversacional (`REQ-10`).
- **C-006-04** DADO `blockedClasses` que contiene `'conversational'`, un
  `safeTextKey` válido y un puerto `phrases` que devuelve texto
  conversacional CUANDO el núcleo va a hablar ENTONCES ese texto no llega
  a `speaker.say` y sí llega el texto de `safeTextKey`.
- **C-006-05** DADO `blockedClasses` que contiene la clase de un candidato
  y **sin** `safeTextKey` CUANDO la compuerta cierra ENTONCES el candidato
  no se habla, se emite `failure` con `code = 'missing_policy'` y queda
  la salida declarada del paso.
- **C-006-06** DADO un candidato cuya clase no está en `blockedClasses`
  CUANDO pasa la compuerta ENTONCES se habla el candidato y `displayText`
  y `speechText` lo llevan sin alteración.
- **C-006-07** DADO un candidato bloqueado CUANDO se resuelve ENTONCES ni
  `displayText` ni `speechText` contienen el candidato: los dos llevan el
  texto seguro.
- **C-006-08** DADO una clave en `immutableTextKeys` CUANDO un puerto de
  sustitución devuelve otro texto para esa clave ENTONCES el reemplazo se
  rechaza con `port_failure`, el texto sustituido no se habla y el turno
  se rehace en determinista.
- **C-006-09** DADO el mismo módulo del núcleo sin editar CUANDO dos
  configuraciones de dominios inventados y distintos declaran políticas
  distintas —`blockedClasses`, `safeTextKey` e `immutableTextKeys`
  distintos— y conducen un turno cada una ENTONCES las dos llegan a su
  desenlace sin tocar el núcleo (`REQ-10`).
- **C-006-10** DADO el código fuente del paquete del núcleo y los valores
  de política de las dos configuraciones de C-006-09 CUANDO se recorren
  sus literales ENTONCES ninguno de esos valores aparece en el núcleo
  (`REQ-10`).
- **C-006-11** DADO una `config` con un miembro desconocido dentro de
  `policy` CUANDO se crea la sesión ENTONCES lanza `ConfigError` con
  `code = 'invalid_config'`: una política a medias no se completa con un
  defecto.
- **C-006-12** DADO un turno completo que aplica filtro y compuerta
  CUANDO `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
  `sendBeacon`, `localStorage`, `sessionStorage`, `indexedDB` y `console`
  están instrumentados para fallar ENTONCES ninguna de esas APIs se
  invoca al aplicar la política (`REQ-11`).
- **C-006-13** DADO `policy.data` declarado CUANDO se conduce un turno
  completo ENTONCES el núcleo no envía ni persiste nada al amparo de esa
  declaración: el punto declara una política del consumidor, no una ruta
  de salida del núcleo (`REQ-11`).
- **C-006-14** DADO un texto que un puerto devuelve para una clave de
  formulario no intocable CUANDO va a hablarse ENTONCES cuenta como clase
  `conversational` y pasa por el filtro y la compuerta.
- **C-006-15** DADO un `safeTextKey` cuya clave no existe en el catálogo
  CUANDO la compuerta cierra ENTONCES no se improvisa texto: se emite
  `failure` con `code = 'missing_text'` y queda la salida declarada.
- **C-006-16** DADO una `config` cuyo `policy.blockedClasses` contiene
  `'conversacional'`, fuera del enumerado cerrado de clases CUANDO se llama
  `createVoiceSession(config)` ENTONCES lanza `ConfigError` con
  `code = 'invalid_config'` y no se devuelve sesión: una clase fuera del
  vocabulario del núcleo no puede dejar la compuerta inerte en silencio
  (`REQ-10`).

## Invariantes

- El núcleo aplica la política declarada; **nunca decide su contenido**.
  No define qué se filtra, qué clases se bloquean, qué claves son
  intocables, qué sustituye a lo bloqueado ni qué se retiene (`REQ-10`).
- Toda declaración ausente se resuelve fail-closed en el punto donde se
  necesita: **lo no declarado no se habla**.
- La declaración exigida (`degradation`) es obligatoria y su ausencia
  impide crear la sesión.
- La compuerta se aplica **antes** de hablar; ningún candidato bloqueado
  llega al `speaker` ni a los campos de texto del evento.
- La clase de seguridad es una **compuerta**, no una etiqueta: una clase
  bloqueada no se habla.
- El enumerado de clases es vocabulario del núcleo: `blockedClasses` sólo
  admite miembros suyos, y uno fuera de él impide crear la sesión
  (`invalid_config`), de modo que una compuerta no puede quedar inerte por
  una clase mal escrita.
- El texto seguro se emite sólo tras una compuerta cerrada y no se vuelve
  a someter a la compuerta.
- El núcleo no evalúa `filter` ni `data` en la primera versión: sólo
  garantiza que el punto existe y que su ausencia se trata fail-closed.
- Aplicar la política no abre red, no escribe almacenamiento y no
  registra (`REQ-11`).
- `displayText` y `speechText` llevan el texto resuelto; el de voz no
  añade información al de pantalla.

**Cobertura de requisitos.** `REQ-10`: C-006-01, C-006-02, C-006-03,
C-006-09, C-006-10, C-006-11, C-006-14, C-006-16. `REQ-11`: C-006-12,
C-006-13.

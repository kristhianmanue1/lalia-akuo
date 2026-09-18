# SPEC-010 — Protocolo agente-página

**Fase:** F1 — entregable de E1 (primera oleada).
**Cubre:** `REQ-14`, `REQ-17`.
**Procedencia:** `../product/definicion-tecnica-canal-agente.md` §7.1 a §7.5;
`../product/definicion-tecnica-nucleo.md` §4.3, §4.5, §4.6 y §4.9;
`../product/definicion-tecnica-frontera.md` §3.2;
`../product/definicion-tecnica.md` §9.3 (preguntas A y B) y §10;
`../product/plan.md` §5.2 (`REQ-14`) y §5.3 (`REQ-17`);
`../adr/ADR-003-agent-channel-after-core.md`;
`../adr/ADR-004-transport-interface-and-reference-relay.md`;
`../adr/ADR-005-no-mcp-server-in-first-version.md`.
**Depende de:** [`SPEC-001`](SPEC-001-contrato-del-nucleo.md) —sesión,
eventos, códigos de error, puertos y puntos de declaración de política—.
Esta spec no re-nombra nada de allí.
**Formato:** `../ai-agent-guide/02-specs-adr-contratos.md` §2.2.

```text
SPEC-010 [cubre: REQ-14, REQ-17]
```

## Comportamiento

**La pieza no entra en la primera versión.** Esta spec escribe la **frontera
como contrato**, no como implementación: fija el formato de los mensajes, la
validación que los gobierna y el establecimiento del canal, para que activar
la etapa después no obligue a rehacer el núcleo (`ADR-003`; §9.3, pregunta
B). Sus casos son de contrato y su implementación vive en una etapa
posterior. Lo que `REQ-14` exige hoy es lo contrario: que la biblioteca
compile, corra y pase sus pruebas **sin ninguna pieza del canal instalada**.

El canal deja que un agente reciba el estado de la sesión y devuelva **texto
y propuesta de acción, nunca estado**
(`../product/definicion-tecnica-canal-agente.md` §7.1). La razón de que sea
una capa aparte es exactamente esa: si el agente pudiera transicionar,
activarlo sobre un flujo perdería las garantías del
núcleo.

**Dos sentidos, mensajes cerrados.** El canal tiene dos direcciones y cinco
tipos de mensaje. Todos llevan el mismo sobre, todas las claves son
obligatorias salvo las marcadas, y una clave desconocida —en el sobre o en
el cuerpo— es rechazo, nunca omisión.

Sobre, común a los cinco tipos:

| clave | tipo | obligatoria | significado |
|---|---|---|---|
| `protocol` | `'lalia-akuo/agent-channel'` | sí | discriminador del canal |
| `protocolVersion` | `string` | sí | versión del contrato de mensajes; viaja en cada mensaje |
| `kind` | `'page_state' \| 'person_input' \| 'agent_proposal' \| 'page_resume' \| 'channel_error'` | sí | tipo del mensaje |
| `sessionId` | `string` | sí | sesión de la página a la que pertenece |
| `cursor` | `string` | sí | cursor custodiado por el consumidor |
| `turn` | entero o `null` | sí | turno abierto al que pertenece |
| `payload` | objeto | sí | cuerpo del tipo declarado |

**Hacia el agente** — la página publica lo que el agente puede saber:

- `page_state.payload`: `state` (uno de los estados visibles de `SPEC-001`),
  `allowedActions` (las decisiones que el núcleo declaró admisibles ahora),
  `field` (el campo activo con su tabla: `id`, `type`, `range`, `unit` —la
  del núcleo, no la del agente—) y `lastDisplayText` (lo último mostrado a
  la persona).
- `person_input.payload`: `personText` (el texto de la persona) y `fieldId`.
  `personText` es **dato no confiable**.
- `page_resume.payload`: objeto vacío; la sesión y el cursor viajan en el
  sobre. Declara desde qué punto la página pide continuidad tras una recarga.

**Hacia la página** — el agente propone, nunca impone:

- `agent_proposal.payload`: `agentText` (texto libre que el agente propone
  mostrar o hablar), `proposedAction` (una de las `allowedActions` que la
  página declaró), `fieldId` (el campo activo al que se refiere),
  `candidates` (valores propuestos, **sin validar**) y `safetyClass` (la
  clase que el consumidor declara en `policy.blockedClasses`).
- `channel_error.payload`: `code` de un enumerado cerrado y `key` de catálogo
  cuando el consumidor quiera un texto; nunca texto libre.

**El texto de entrada de la persona es dato no confiable** (§7.2). La
biblioteca no lo clasifica: declarar si es sensible, si puede salir del
dispositivo y con qué retención es política del consumidor, y el punto donde
se declara es `policy.data` (`SPEC-001`). Lo que sí garantiza el contrato es
la marcación: `personText` y `agentText` viajan en campos de **texto** y
ninguna parte del canal —ni la página, ni el relay— los interpreta como
instrucción, comando o autorización. Un texto que pida cambiar de estado,
saltarse una validación o ampliar un permiso es, para el canal, exactamente
el mismo dato que un texto neutro: no ejecuta nada.

**La garantía de `REQ-17`: el agente no puede saltarse la validación del
núcleo.** Antes de mostrar o pronunciar **cualquier** texto del agente, el
núcleo aplica sus validaciones, en este orden (§7.2):

1. mensaje válido contra el contrato cerrado y `protocolVersion` soportada;
2. `proposedAction` está permitida en el estado actual;
3. `fieldId` corresponde al paso activo;
4. cada candidato pasa analizador, tipo, precisión y rango;
5. `agentText` pasa el filtro que el consumidor declaró;
6. `safetyClass` obra como compuerta: una clase bloqueada no se habla;
7. toda transición sensible exige confirmación explícita.

Un mensaje que falla cualquiera de los siete pasos es `invalid_agent_text`
(`SPEC-001`): no se habla, se dice el texto seguro declarado o se descarta,
el estado no cambia, no se fija ningún valor y el modo no cambia. El agente
**no puede transicionar por contrato**: el mensaje no tiene campo de estado
y un campo así se rechaza por el contrato cerrado de mensajes; como mucho,
propone una acción que el núcleo ya declaró admisible, y el núcleo decide si
esa transición vale.

**Cursor.** El cursor del turno lo custodia el consumidor —su servidor—, no
la página ni la biblioteca, que no persiste (§7.2). Un cursor que no
coincide con el turno esperado se descarta como no-op: no se aplica «lo más
parecido».

**Reanudación tras una recarga.** El núcleo no custodia la sesión entre
recargas (§4.9). Tras una recarga hay una **sesión nueva**: `sessionId`
nuevo, `state = 'idle'`, `values` vacío. La continuidad la aporta el
consumidor: entrega el cursor vigente y, por `getPreviousValue`, el valor
previo que quiera inyectar. La página envía `page_resume` con ese cursor y
**descarta** todo mensaje dirigido a la sesión anterior, igual que descarta
cualquier mensaje cuyo cursor no coincida. La biblioteca no reconstruye
estado, no reanuda un turno ajeno y no re-habla nada por su cuenta: lo que
ocurra después de la recarga nace de una sesión nueva.

**Establecimiento fuera de banda.** El canal no se establece desde la
página: el consumidor crea y autentica el transporte **fuera de banda** y
entrega a la página un canal ya establecido junto con `sessionId` y el
cursor inicial. La biblioteca no abre red, no negocia credenciales y no
custodia tokens (`ADR-004`; `SPEC-001`). Por contrato, el relay de
referencia —que se documenta y se prueba, pero no es producto— exige
validación de origen con rechazo explícito y token por sesión, y `stdio`
nunca se expone al navegador (`ADR-004`, `ADR-005`). Sin servidor MCP en la
primera versión.

## Entradas

- Los mensajes de los cinco tipos, con el sobre completo.
- El canal ya establecido, con `sessionId` y cursor inicial, aportados por el
  consumidor.
- El estado y las decisiones admisibles del núcleo, que la página publica en
  `page_state`.
- Los puntos de declaración de política de `SPEC-001`: `policy.filter`,
  `policy.blockedClasses`, `policy.safeTextKey` y `policy.data`.

## Salidas

- Pasos validados para el núcleo: texto a mostrar o hablar, petición de
  confirmación y, como mucho, una acción admisible entre las declaradas.
- Mensajes `page_state`, `person_input` y `page_resume` hacia el agente.
- `failure` con `code = 'invalid_agent_text'` cuando un mensaje no pasa la
  validación, y `code = 'missing_policy'` cuando el paso exige una
  declaración ausente.
- Nada más: el canal no escribe valores, no cambia el modo, no persiste y no
  abre red por su cuenta.

## Errores

| condición | `code` | estado que queda |
|---|---|---|
| mensaje inválido contra el contrato cerrado, o clave desconocida en el sobre o en el cuerpo | `invalid_agent_text` | no se muestra ni se habla nada; descarte; estado sin cambio |
| `protocolVersion` no soportada | `invalid_agent_text` | rechazo explícito; nunca adaptación silenciosa |
| `proposedAction` fuera de `allowedActions`, o no permitida en el estado actual | `invalid_agent_text` | la transición no ocurre; el flujo sigue determinista |
| `fieldId` no corresponde al paso activo | `invalid_agent_text` | el mensaje se descarta; el paso activo no cambia |
| candidato que no pasa analizador, tipo, precisión o rango | `invalid_agent_text` | no se fija ningún valor y no hay `confirmation_requested` |
| `agentText` no pasa el filtro declarado | `invalid_agent_text` | no se habla; texto seguro declarado o descarte |
| `safetyClass` en `blockedClasses` | `invalid_agent_text` | compuerta cerrada: no se habla y se dice el texto seguro declarado |
| falta `policy.filter`, `policy.blockedClasses` o `policy.safeTextKey` cuando el paso los exige | `missing_policy` | el paso no se ejecuta; no se habla texto conversacional (§9.3, pregunta A) |
| cursor que no coincide con el turno esperado | — (no-op) | sin cambio; no se aplica «lo más parecido» |
| mensaje de un turno ya cerrado o resuelto | — (no-op) | sin cambio; no se reabre el turno |
| mensaje dirigido a la sesión anterior, tras una recarga | — (no-op) | la sesión nueva no reconstruye estado |
| canal no establecido o cerrado | `channel_error` fuera del núcleo | el flujo determinista sigue; el turno del núcleo no se interrumpe por el canal |

Fail-closed: nada del agente se muestra ni se pronuncia antes de pasar las
validaciones; lo que el consumidor no declara no se habla; un cursor ajeno
no se aplica.

## Casos

Identificador estable; los casos nuevos se añaden con el siguiente número
libre. Son casos de contrato: se escriben contra el contrato cerrado de
mensajes de esta spec y contra dobles, sin implementar el canal.

- **C-010-01** DADO el paquete de la biblioteca sin ninguna pieza del canal
  instalada CUANDO se ejecutan sus pruebas ENTONCES compila, corre y pasa
  (`REQ-14`).
- **C-010-02** DADO un mensaje `agent_proposal` que incluye una clave de
  estado (`state`) CUANDO llega a la página ENTONCES se rechaza por el
  contrato cerrado de mensajes con `invalid_agent_text` y el estado de la
  sesión no cambia (`REQ-17`).
- **C-010-03** DADO un estado con `allowedActions` declaradas CUANDO llega un
  `proposedAction` que no está en esa lista ENTONCES se rechaza con
  `invalid_agent_text`, no hay transición y el flujo sigue determinista
  (`REQ-17`).
- **C-010-04** DADO un `proposedAction` que figura en `allowedActions` pero
  no es admisible en el estado actual CUANDO llega ENTONCES se rechaza con
  `invalid_agent_text` y no hay transición (`REQ-17`).
- **C-010-05** DADO un `candidates` con un valor fuera del rango declarado
  CUANDO llega ENTONCES no se escribe en `session.values`, no hay
  `confirmation_requested` y el evento es `failure` con
  `code = 'invalid_agent_text'` (`REQ-17`).
- **C-010-06** DADO un `fieldId` que no es el del paso activo CUANDO llega
  ENTONCES se rechaza con `invalid_agent_text` y el paso activo no cambia
  (`REQ-17`).
- **C-010-07** DADO un `agentText` con `safetyClass` en `blockedClasses`
  CUANDO llega ENTONCES no se pronuncia ese texto y se dice el texto seguro
  declarado (`REQ-17`).
- **C-010-08** DADO un consumidor que no declaró `policy.filter`,
  `policy.blockedClasses` ni `policy.safeTextKey` CUANDO llega un
  `agent_proposal` que exige filtro o compuerta ENTONCES el paso no se
  ejecuta, el evento es `failure` con `code = 'missing_policy'` y no se
  habla texto conversacional (`REQ-17`).
- **C-010-09** DADO un doble del `speaker` que registra sus llamadas CUANDO
  llega un mensaje que falla cualquier validación ENTONCES el `speaker` no
  recibe ninguna llamada: nada del agente se oye antes de validarse
  (`REQ-17`).
- **C-010-10** DADO un mensaje con un cursor distinto del esperado CUANDO
  llega ENTONCES es no-op: ni evento, ni cambio de `state`, ni valor
  (`REQ-17`).
- **C-010-11** DADO un turno ya cerrado CUANDO llega un mensaje dirigido a
  ese turno ENTONCES es no-op y el turno no se reabre (`REQ-17`).
- **C-010-12** DADO una recarga de la página CUANDO se crea la sesión
  ENTONCES es una sesión nueva con `sessionId` distinto, `state = 'idle'` y
  `values` vacío; un mensaje dirigido a la sesión anterior se descarta y el
  consumidor aporta el cursor y el valor previo (`REQ-17`).
- **C-010-13** DADO un canal ya establecido que el consumidor entrega CUANDO
  se conduce el canal ENTONCES la biblioteca no crea el transporte, no abre
  red, no lee ni guarda credenciales (`REQ-14`).
- **C-010-14** DADO un `personText` que contiene una orden dirigida al
  sistema CUANDO llega al canal ENTONCES el resultado es idéntico al de un
  texto neutro: no se ejecuta, no cambia el estado, no amplía permisos
  (`REQ-17`).
- **C-010-15** DADO un mensaje al que le falta `protocolVersion`, `sessionId`,
  `cursor` o `turn` CUANDO llega ENTONCES se rechaza por el contrato cerrado
  de mensajes con `invalid_agent_text` y no hay salida hacia el núcleo
  (`REQ-17`).
- **C-010-16** DADO un mensaje con una clave desconocida en el sobre o en el
  cuerpo CUANDO llega ENTONCES se rechaza: el contrato cerrado de mensajes no
  admite claves desconocidas ni las ignora (`REQ-17`).
- **C-010-17** DADO un canal que no se estableció CUANDO transcurre un turno
  del núcleo ENTONCES el flujo determinista llega a su desenlace y el canal
  no produce fallo de sesión (`REQ-14`).

## Invariantes

- El agente propone texto y acción siguiente; el núcleo decide si la
  transición es válida. Ningún mensaje transporta estado.
- Todo mensaje lleva `protocol` y `protocolVersion`, `sessionId`, `cursor` y
  `turn`; el contrato de mensajes es cerrado en las dos direcciones.
- Nada del agente se muestra ni se pronuncia antes de pasar las siete
  validaciones; un fallo es `invalid_agent_text` y no cambia nada.
- Un valor propuesto no llega a `session.values` sin validación y sin
  confirmación explícita.
- `personText` y `agentText` son datos, nunca instrucciones ni autorización.
- El cursor lo custodia el consumidor; un cursor que no coincide es no-op.
- Tras una recarga hay sesión nueva: la biblioteca no reconstruye estado ni
  custodia la sesión.
- El canal se establece fuera de banda: la biblioteca no abre red, no
  negocia credenciales y no custodia tokens.
- Sin declaración de política, lo no declarado no se habla.
- Esta pieza no entra en la primera versión; la biblioteca corre y pasa sus
  pruebas sin ella.

**Cobertura de requisitos.** `REQ-14`: C-010-01, C-010-13, C-010-17.
`REQ-17`: C-010-02, C-010-03, C-010-04, C-010-05, C-010-06, C-010-07,
C-010-08, C-010-09, C-010-10, C-010-11, C-010-12, C-010-14, C-010-15,
C-010-16.

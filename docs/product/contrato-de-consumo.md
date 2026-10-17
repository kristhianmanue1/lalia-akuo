# Contrato de consumo — lalia-akuo

**Qué es.** El contrato base para todo artefacto que consume esta
biblioteca: otro proyecto, un agente de IA, un harness de pruebas o una
interfaz de referencia. Fija superficie, ciclo de vida, eventos, errores,
garantías y canales, cada uno con su procedencia. **No fija política de
dominio**: qué se guarda, qué es sensible y qué se filtra lo declara cada
consumidor (`AGENTS.md`, `product/plan.md` §7).

**Qué no es.** No sustituye a las spec: si este documento diverge de
`../specs/`, gana la spec y el divergencia es un defecto de este archivo.
Tampoco es un enumerado paralelo: cada código y cada evento que aquí se
mencionan viven en su spec con su caso, y la forma legible por máquina de
los eventos es `../../schema/eventos.json` —única fuente—.

## 1. El canal de la primera versión: biblioteca ESM por copia

El modo de consumo vigente es la **copia desde el repositorio, sin registro
de paquetes** (`ADR-010`, `REQ-15`): se importa por ruta, cada commit copiado
compila y pasa sus pruebas, y la superficie pública es pequeña y estable por
commit mientras dure esta etapa. La revisión que puede cambiar el modo está
fijada para el **30 de diciembre de 2026** (`ADR-010`).

- Entrada única: `src/index.js` (`package.json` → `exports["."]`).
- Entorno: Node >= 18 para desarrollo y pruebas; en el navegador, los
  motores objetivo de `ADR-009` bajo la ventana de `ADR-011` (§7).
- Sin dependencias de ejecución y sin paso de construcción: módulos ES tal
  cual (`README` §«Cómo se construye»).

## 2. Superficie pública

Lo que no está en esta lista no es superficie pública (`src/index.js`):

| Nombre | Qué es | Procedencia |
|---|---|---|
| `createVoiceSession(config, runtime?)` | La fábrica de sesiones | `SPEC-001` |
| `CAPABILITIES` | Declaración congelada de lo que el núcleo hace y no hace | `SPEC-001` |
| `PHASES` | Las ocho fases internas | `SPEC-005` |
| `SPEECH_BUDGET_MS`, `TURN_BUDGET_MS` | Los techos de tiempo por puerto | `SPEC-003`, `SPEC-004` |
| `createCatalog`, `interpolate`, `verifyPack`, `DEFAULT_READ_BUDGET` | El mecanismo de paquetes de idioma | `SPEC-007` |
| `PACK_ES` | El paquete español de la biblioteca (claves propias, no de dominio) | `SPEC-007` |
| `ConfigError`, `PortContractError`, `MissingTextError`, `MissingPlaceholderError`, `InvalidPackError` | Los errores de frontera | `SPEC-001`, `SPEC-004`, `SPEC-007` |

Todo lo demás —`src/core/*` sin pasar por `index.js`— es interno y puede
cambiar sin aviso. Los seis puertos (`SPEC-004`) son inyección del
consumidor, no exportaciones.

## 3. Ciclo de vida de una sesión

`SPEC-001` fija la creación fail-closed: o hay sesión válida o hay
`ConfigError`, nunca un objeto a medio construir. La sesión (`SPEC-005`):

1. `createVoiceSession(config)` valida todo en la frontera y arranca en
   `idle` · `idle`, en modo `deterministic` —el de omisión; `assisted`
   nunca se activa solo (`REQ-13`).
2. `start()` conduce el primer campo por voz: `speaking` · `asking` →
   `listening` · `capturing` → `thinking` · `interpreting` →
   `speaking` · `confirming` → cierre (`C-005-01`). En una sesión
   degradada a manual, ningún paso `asking` vuelve a hablar ni a escuchar:
   la salida declarada es `submitText` (`C-005-16`).
3. `submitText(text)` entra por `thinking` · `interpreting` desde cualquier
   estado —la entrada por texto nunca es castigo (`C-005-11`); con un valor
   que no es cadena es un no-op declarado (`C-001-22`).
4. `setMicrophoneMuted` y `setSpeechMuted` son los dos silencios separados
   (`SPEC-009` declara la interfaz mínima que los consume).
5. `dispose()` cancela todo lo en vuelo; después de él, todo método es
   no-op.

El catálogo de estados y transiciones es cerrado y vive en `SPEC-005`; el
conjunto de eventos, en `schema/eventos.json`.

## 4. Eventos

Todo evento lleva `type`, `sessionId`, `mode`, `port` y `turn` (`SPEC-001`),
más sus campos propios. La única fuente máquina es
[`schema/eventos.json`](../schema/eventos.json); en prosa: `state_changed`
(con `state` y `phase`), `text_output`, `confirmation_requested`,
`value_confirmed`, `failure` (con `code`) y `manual_input_required` (con
`reason`). El observador (`onEvent`) que lanza no tumba el turno: es
información, no control.

## 5. Códigos de fallo, derivados de las spec

Esta tabla **deriva** de las spec; si diverge, gana la spec:

| Código | Dónde queda fijado |
|---|---|
| `invalid_config`, `missing_policy` | `SPEC-001` (creación fail-closed) |
| `port_failure` | `SPEC-004` (puerto fuera de contrato) |
| `speech_failed`, `speech_watchdog` | `SPEC-003` §Salidas |
| `port_budget_exhausted` | `SPEC-004` §presupuestos; `C-005-13` |
| `no_speech`, `recognition_failed` | `SPEC-005` §tabla de errores |
| `unresolved_value`, `unclassified_control` | `SPEC-004`, `SPEC-005` |
| `missing_text`, `over_budget` | `SPEC-007` (catálogo fail-closed) |
| `manual_input_required.reason` (seis valores) | `SPEC-008` |

Ningún fallo produce silencio, ninguno cambia el `mode` y ninguno escribe
valor (`SPEC-005` §Invariantes). El fallo de la propia locución del aviso de
degradación también se anuncia (`C-008-16`).

## 6. Garantías

- **Sin confirmación explícita no se guarda nada**, y el readback dice el
  valor que se va a guardar (`REQ-7`, `SPEC-008`).
- Los turnos se cierran **por señal real, nunca por temporizador**; el
  agotamiento de presupuesto es un fallo explícito con reintento determinista
  único (`SPEC-002`, `C-005-12`/`C-005-15`).
- El núcleo **no persiste, no abre red, no registra y no toca el DOM**;
  `CAPABILITIES` lo declara y la verificación contra el código lo respalda
  (`estado.md` §6).
- Sin modelo de IA y sin servidor MCP en la primera versión; los puertos del
  modelo son costuras sin implementación (`ADR-008`, `REQ-13`).

## 7. Compatibilidad y versionado

La compatibilidad se define por **ventana de tiempo** —cuatro años desde la
primera versión estable de cada motor—, no por lista de versiones
(`ADR-011`). Esa ventana es hoy un **objetivo sin medir**: nada se ha
ejecutado en un navegador real y «sin medición no se declara compatibilidad»
(`estado.md` §6, `SPEC-011`). No hay versionado semántico público mientras
no haya releases; mientras tanto, la superficie de §2 es estable por commit
(`ADR-010`) y los cambios incompatibles se documentan con guía de migración.

## 8. Canales considerados: qué es v1 y qué no

| Canal | Estado en v1 | Costura declarada |
|---|---|---|
| Biblioteca ESM (esta superficie) | **Es la v1** | `ADR-010` |
| Servidor MCP | **No objetivo** — prohibido en v1 | `ADR-005`: cuando llegue, es paquete aparte con superficie declarada desde antes |
| CLI propio | **No objetivo** | `product/plan.md` §6; un CLI sería un consumidor más, no parte de la biblioteca |
| API/servidor HTTP | **No objetivo** | `product/plan.md` §6; la biblioteca no abre red (`CAPABILITIES`) |
| Canal agente↔página | Contrato escrito, implementación posterior | `SPEC-010`, `ADR-003`: el texto del agente entra como dato no confiable y no se salta la validación del núcleo (`REQ-17`) |

Un agente de IA hoy consume por la biblioteca embebida en la página del
consumidor —inyectando puertos y leyendo eventos— y, cuando exista, por el
protocolo de `SPEC-010`. Nunca por dentro del núcleo.

## 9. Cómo cambia este contrato

Por enmienda de spec con su caso y su prueba, o por ADR nuevo si cambia una
decisión; nunca por edición silenciosa de este archivo. El estado de qué
está implementado y verificado está en [`estado.md`](../estado.md), que la
prueba de trazabilidad contrasta contra las pruebas reales.

## 10. Recetas de integración

Cableos canónicos, cada uno con su fuente. Un ejemplo vivo y completo de
todos ellos está en [`examples/tres-campos/`](../../examples/tres-campos/)
y su prueba de humo en `tests/ejemplo-tres-campos.test.js`.

**R1 — Valor previo ↔ almacenamiento del consumidor.** La biblioteca no
persiste (`CAPABILITIES`); quien tiene historial lo inyecta:

```js
getPreviousValue: (fieldId) => almacen.leer(fieldId),
```

Se llama síncrono con `field.id` sólo cuando hay `deltaPolicy` declarado
(`SPEC-001` §deltaPolicy; C-001-17, C-001-21: si lanza o no es comparable,
el núcleo reconfirma en vez de callar).

**R2 — Gramática y léxico del dominio ↔ puertos intérpretes.** El dominio
no se muda a la biblioteca: se conecta por `fieldInterpreter` y
`controlInterpreter` (`SPEC-004` fija firmas y enumerados de salida;
`PortContractError` si el puerto rompe contrato). El ejemplo trae los
deterministas más simples que funcionan: números y sí/no
(`examples/tres-campos/flujo.js`).

**R3 — Eventos ↔ interfaz.** El núcleo emite; la vista decide. `state_changed`
lleva `state` y `phase` —el anuncio por cambio de estado lo monta la vista
con las claves `announce.state.*` de `PACK_ES` (interfaz mínima de
`SPEC-009`, pendiente como capa)—; `text_output` y `confirmation_requested`
llevan `displayText` (y `speechText` si hay voz); `manual_input_required`
dice `reason`, `fieldId` y el aviso visible: es el momento de enfocar la
entrada de texto; `value_confirmed` es el único momento en que
`session.values` cambia. El catálogo cerrado, en `schema/eventos.json`.

**R4 — Reloj inyectado para pruebas.** `runtime = { schedule,
cancelSchedule }` es la pareja cerrada de `SPEC-001` (C-001-19): con un
reloj falso, ningún `setTimeout` real decide nada y los presupuestos se
avanzan a mano — el patrón que usan las pruebas de la biblioteca
(`tests/helpers/session-harness.js`).

**R5 — Paquete regional con respaldo, en sus dos formas.**

- En `config` de sesión, paquetes crudos — el núcleo envuelve el respaldo:

```js
language: { pack: TEXTO_MX, fallback: PACK_ES },
```

- En `createCatalog` directo, el respaldo ya debe ser un catálogo — el
  paquete crudo lanza `InvalidPackError` (`invalid_config`):

```js
const base = createCatalog(PACK_ES);
const mx = createCatalog(TEXTO_MX, { fallback: base });
```

La variante regional es un paquete distinto con `fallback` explícito
(`SPEC-007` §3, caso C-007-09); `has()` cubre lo resuelto por el respaldo.

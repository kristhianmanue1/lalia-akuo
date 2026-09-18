# Índice de especificaciones — E1

**Propósito:** ser el punto de entrada del conjunto de spec. Aquí se ve qué
fija cada documento, qué requisito cubre y con cuántos casos, sin abrir
once archivos.
**Estado:** E1 **escrita, no implementada**. Las spec fijan contrato; el
núcleo no existe todavía (`src/` sólo tiene el mecanismo de paquetes de
idioma). Los casos son casos de spec, convertibles en prueba: se convierten
en pruebas en la implementación, no antes.
**Fecha:** 18 de septiembre de 2026

## 1. Formato y convención de casos

Todas siguen el formato de `../ai-agent-guide/02-specs-adr-contratos.md`
§2.2: `Comportamiento`, `Entradas`, `Salidas`, `Errores`, `Casos`,
`Invariantes`. Cada caso se escribe `DADO … CUANDO … ENTONCES …` y lleva un
identificador estable `C-<spec>-<número>` —por ejemplo `C-004-17`—, de modo
que una prueba pueda trazar a su caso y que añadir casos después no renombre
los existentes. Los errores son parte del contrato: cada fallo dice qué
estado deja.

## 2. El conjunto

| Spec | Qué fija | `REQ` | Casos |
|---|---|---|---:|
| `SPEC-001-contrato-del-nucleo.md` | Arranque de la sesión, configuración, eventos, códigos de error y la declaración de lo que el núcleo hace y no hace | 1, 6, 10, 11 | 18 |
| `SPEC-002-disciplina-de-turno.md` | Token, identificador monotónico, resultado tardío, cancelado y doble callback | 3 | 12 |
| `SPEC-003-contrato-de-locucion.md` | Las tres clases de resultado de la locución, la prohibición de encadenar sin cierre real y el tope de locución | 2 | 10 |
| `SPEC-004-puertos-y-presupuestos.md` | Las firmas definitivas de los seis puertos, los contratos de salida y el presupuesto por turno | 4, 5, 13 | 27 |
| `SPEC-005-maquina-de-estados-y-fases.md` | Estados visibles, transiciones y la enumeración de fases internas | 1 | 15 |
| `SPEC-006-politica-declarada-y-compuerta.md` | Dónde declara el consumidor su política y la compuerta que se aplica antes de hablar | 10, 11 | 16 |
| `SPEC-007-catalogo-de-idioma.md` | El mecanismo de paquetes de idioma, la etiqueta de idioma y el fallo en cerrado por clave ausente | 7, 12 | 13 |
| `SPEC-008-readback-fiel-y-degradacion-a-manual.md` | Que lo que se oye diga el valor que se va a guardar, y que la degradación a manual sea parte del flujo | 7, 8 | 15 |
| `SPEC-009-accesibilidad-e-interfaz-minima.md` | Los cuatro controles, un anuncio por cambio de estado, los dos silencios separados y el aviso de audio fuera del dispositivo | 9, 16 | 18 |
| `SPEC-010-protocolo-agente-pagina.md` | La frontera del canal de agente como contrato, con el texto de entrada como dato no confiable | 14, 17 | 17 |
| `SPEC-011-adaptador-web-speech-y-parches.md` | El adaptador de motor y los parches obligatorios por motor, con su síntoma y su prueba | 18 | 24 |

Total: **185 casos** en once spec.

Los esquemas de [`../../schema/`](../../schema/) son el contrato legible por
máquina de lo que estas spec describen en prosa: `configuracion.json` para lo
que declara el consumidor y `eventos.json` para lo que el núcleo emite.

## 3. Cobertura de los requisitos

Los `REQ-*` son los de `../product/plan.md` §5. La columna de spec dice dónde
vive su caso testable.

| `REQ` | Qué exige | Spec |
|---|---|---|
| REQ-1 | El núcleo conduce un turno completo sin DOM | `SPEC-001`, `SPEC-005` |
| REQ-2 | Tres clases de resultado y sólo el cierre real encadena | `SPEC-003` |
| REQ-3 | Disciplina de turno | `SPEC-002` |
| REQ-4 | Política de confirmación enumerada | `SPEC-004` |
| REQ-5 | Léxico y umbral de confianza externos | `SPEC-004` |
| REQ-6 | Formularios declarativos | `SPEC-001` |
| REQ-7 | Sin confirmación no se guarda, y el readback dice el valor | `SPEC-007`, `SPEC-008` |
| REQ-8 | Degradación a manual como parte del flujo | `SPEC-008` |
| REQ-9 | Interfaz mínima de conversación | `SPEC-009` |
| REQ-10 | Ninguna política de dominio | `SPEC-001`, `SPEC-006` |
| REQ-11 | No persiste, no abre red y lo declara | `SPEC-001`, `SPEC-006` |
| REQ-12 | Paquetes de idioma, español primero | `SPEC-007` |
| REQ-13 | Puertos sin modelo, modo determinista por omisión | `SPEC-004` |
| REQ-14 | El canal de agente fuera y el servidor MCP fuera | `SPEC-010` |
| REQ-15 | Apache-2.0 y consumo desde el repositorio | **sin spec** — ver §4 |
| REQ-16 | Accesibilidad por defecto | `SPEC-009` |
| REQ-17 | El agente no se salta la validación del núcleo | `SPEC-010` |
| REQ-18 | Navegadores objetivo y parches obligatorios | `SPEC-011` |

Diecisiete de los dieciocho requisitos tienen spec con casos testables.

## 4. Huecos declarados

Nada de esto se resuelve por suposición; cada uno dice qué falta y qué
bloquea.

- **`REQ-15` no lleva spec, y es deliberado.** No describe comportamiento del
  núcleo: exige licencia y modo de consumo, y su criterio —que un consumidor
  externo lo instale desde el repositorio y ejecute el caso de uso con las
  instrucciones del README— se verifica sobre el repositorio y su
  documentación, no con una spec de comportamiento. Escribir una sería un
  documento decorativo. Se comprueba en la etapa de publicación.
- **La superficie pública todavía no es la que describen las spec.** Hoy
  `src/` sólo contiene el mecanismo de paquetes de idioma, y ese módulo no
  cumple aún el contrato completo de `SPEC-007`: le falta presupuesto de
  lectura, validación y normalización de la etiqueta de idioma, mensajes de
  error que no dependan del paquete activo, validación de que los textos sean
  cadenas, y decir de qué paquete salió un texto cuando intervino el respaldo.
  Además, `src/i18n/es.js` sólo trae tres de las catorce claves de catálogo
  que fija `SPEC-007`: faltan las once de `controls.*`, `announce.state.*` y
  `notice.offDeviceAudio`, lo que bloquea la resolución de textos de
  `SPEC-009`. Está enumerado en `SPEC-007`; implementarlo es de la etapa
  siguiente.
- **El piso de versiones de navegador sigue sin decidirse** (pregunta abierta
  del humano). Por eso `SPEC-011` fija los parches por **síntoma y condición**
  y nunca por número de versión, y por eso no se declara compatibilidad.
- **El valor del tope de locución y el del presupuesto por turno son
  provisionales.** Los fija `SPEC-003` y `SPEC-004` con su razón, y la
  medición en dispositivo los puede cambiar sin cambiar el contrato. Fíjarlos
  con una medición es la única forma honesta de fijarlos.
- **La implementación no existe.** Ninguna spec autoriza escribir código: la
  casilla del gate de F1 queda cerrada en cuanto a contrato, y la
  implementación es de su propia etapa, con su prueba por caso.

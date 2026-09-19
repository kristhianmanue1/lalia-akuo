# estado.md — estado del proyecto y por dónde retomar

**Propósito:** que una sesión nueva sepa qué está hecho, qué no, y cuál es el
siguiente paso concreto, **sin leer la conversación de nadie**.
**Última actualización:** 19 de septiembre de 2026.

Este archivo no es una promesa: lo comprueba la puerta. La prueba de
trazabilidad (`../tests/traceability.test.js`) lee la tabla del §2 y exige que
coincida con lo que hay probado de verdad. Si un caso de una spec declarada
`implementada` no tiene prueba, o si una declarada `pendiente` tiene casos
probados, la puerta queda en rojo. Este documento no puede mentir sin que se
note.

## 1. Dónde está cada cosa

| Qué | Dónde |
|---|---|
| El problema, los requisitos y los no objetivos | `product/plan.md` (F0, cerrado) |
| El diseño: frontera, contratos, puertos, estados | `product/definicion-tecnica.md` y sus cuatro documentos hermanos (F1, cerrado) |
| Las decisiones, con sus alternativas descartadas | `adr/ADR-001` a `ADR-011` |
| El contrato de comportamiento, caso por caso | `specs/SPEC-001` a `SPEC-011`, con el índice en `specs/00-INDICE.md` |
| La forma legible por máquina de la configuración y los eventos | `../schema/configuracion.json` y `../schema/eventos.json` |
| El método con que se trabaja aquí | `ai-agent-guide/` y `estandar-diseno-software-github.md` |

## 2. Estado por spec

`implementada` quiere decir que **todos** sus casos tienen prueba. `pendiente`
quiere decir que ninguno la tiene todavía.

| Spec | Estado | Quién la implementa o por qué espera |
|---|---|---|
| `SPEC-001-contrato-del-nucleo.md` | implementada | `../src/core/session.js` |
| `SPEC-002-disciplina-de-turno.md` | implementada | `../src/core/turn.js` |
| `SPEC-003-contrato-de-locucion.md` | implementada | `../src/core/ports.js` (contrato y tope del `speaker`) |
| `SPEC-004-puertos-y-presupuestos.md` | implementada | `../src/core/ports.js` |
| `SPEC-005-maquina-de-estados-y-fases.md` | implementada | `../src/core/session.js` |
| `SPEC-006-politica-declarada-y-compuerta.md` | implementada | `../src/core/policy.js` |
| `SPEC-007-catalogo-de-idioma.md` | implementada | `../src/i18n/catalog.js` |
| `SPEC-008-readback-fiel-y-degradacion-a-manual.md` | implementada | `../src/core/session.js` |
| `SPEC-009-accesibilidad-e-interfaz-minima.md` | pendiente | Necesita DOM: la interfaz mínima y los anuncios por cambio de estado son de la capa de vista, que el núcleo no toca |
| `SPEC-010-protocolo-agente-pagina.md` | pendiente | El canal de agente no entra en la primera versión (`ADR-003`, `ADR-005`). Su spec fija la frontera como contrato; implementarlo es de una etapa posterior |
| `SPEC-011-adaptador-web-speech-y-parches.md` | pendiente | Necesita un motor de voz real. Los catorce parches sólo se pueden escribir y medir contra Safari y Blink |

## 3. Cómo se comprueba y cómo se retoma

```bash
npm test                               # las pruebas de la biblioteca y de trazabilidad
python3 scripts/check_sizes.py         # estructura, tamaños y ruta de lectura
python3 -m unittest discover -s tests  # el gate del método
npm run gate                           # los tres, en orden
```

Lo que una sesión nueva debería hacer, en este orden:

1. Leer `AGENTS.md` y `../docs/ai-agent-guide/00-INDICE.md`: es la puerta de
   entrada del método, y manda sobre lo que supongas.
2. Leer `specs/00-INDICE.md`: qué fija cada spec, qué `REQ` cubre y qué huecos
   hay declarados.
3. Leer este archivo, §2 y §4.
4. Correr `npm run gate` **antes de tocar nada**. Si está en rojo, el rojo es
   el primer trabajo.
5. Elegir el siguiente paso de §5 y trabajar contra los casos de la spec que
   corresponda, con una prueba por caso y su identificador.

## 4. Huecos declarados y decisiones que hay que revisar

Nada de esto se resuelve por suposición. Lo que no está cerrado, está escrito.
**La ronda adversarial del núcleo se ejecutó el 19-09-2026 con veredicto
`fix-and-retry` y la oleada de corrección está aplicada y verificada con
re-ronda** (§5, §6). Los hallazgos resueltos se tachan con su fecha; los
que quedan se declaran.

- ~~Las claves de readback, resumen y anuncio no tienen dónde declararse.~~
  **Resuelto (19-09-2026):** la derivación `<promptKey>.readback` y
  `<promptKey>.saved` quedó declarada en `SPEC-001` (contrato, no detalle).
- ~~El agotamiento del `speaker` tiene dos códigos en juego.~~ **Resuelto
  (19-09-2026):** presupuesto agotado es `port_budget_exhausted` para todo
  puerto, con redo determinista (`C-005-12`, `C-005-13`); `speech_watchdog`
  es sólo el valor que el adaptador resuelve (`C-003-03`). Las enunciados de
  `C-003-05` y `C-005-13` y el invariante de `SPEC-003` quedaron enmendados
  en la misma fecha.
- ~~Cómo sale la sesión de `error`.~~ **Resuelto (19-09-2026):** la sesión
  se resuelve sola `error` → `idle` · `idle` con la salida manual, y
  `submitText` sigue siendo la salida declarada (`C-005-09`, `C-005-15`).
- **Faltan motivos en el enumerado de `manual_input_required.reason`.**
  `SPEC-008` lo cierra a seis valores, pero `SPEC-005` hace degradar por
  lectura no resuelta, negación y control manual. La implementación mapea los
  códigos que sobran a `recognition_failed` y el control manual a `no_speech`.
- **`phrases` no se invoca.** `SPEC-004` insinúa que las claves que no son de
  dato pasan por ahí, pero `SPEC-006` cuenta como `conversational` todo texto
  que devuelve un puerto de sustitución, así que la pregunta quedaría muda sin
  filtro declarado. La implementación resuelve pregunta, aviso, readback y
  anuncio del catálogo directo. **`phrases` y `proposer` quedan como costuras
  de `ADR-008` sin uso en la primera versión**; conviene que eso sea explícito.
- ~~`createVoiceSession` recibe el planificador como segundo argumento...~~
  ~~Hay un `setTimeout` en el núcleo como planificador por omisión...~~
  **Resuelto (19-09-2026):** `SPEC-001` declara ahora `runtime` como segundo
  parámetro cerrado (`schedule` + `cancelSchedule` en pareja, `C-001-19`) y
  el planificador del entorno como omisión declarada. Validación
  fail-closed en la creación.
- **`SPEC-009` fija los cuatro controles y los anuncios, y no hay capa de
  vista.** El núcleo no toca el DOM y no debe tocarlo: la interfaz mínima es un
  consumidor de la biblioteca, no parte de ella.
- **`SPEC-010` es contrato sin implementación.** Su frontera está escrita para
  que el canal entre después sin rehacer el núcleo (`ADR-008`).
- **`SPEC-011` no se puede cerrar sin dispositivo.** Los parches están por
  síntoma y condición y cada uno tiene su prueba declarada, pero escribir el
  adaptador exige un motor de voz real.
- **Una rama sin cubrir.** Quitar la consulta a la compuerta antes de hablar no
  pone ninguna prueba en rojo, porque la rama no es alcanzable sin clases
  bloqueadas declaradas. Con `SPEC-009` o `SPEC-010` implementadas dejaría de
  serlo. Lo declaró el implementador mutando su propio código; **no lo ha
  confirmado la ronda adversarial**.
- **El piso de versiones no es un hueco abierto**: la compatibilidad se decide
  por ventana de tiempo (`ADR-011`) y no bloquea nada. Lo que falta es
  **medirla**, y eso es de la etapa de dispositivo.

## 5. El siguiente paso

Por orden, y cada uno es un trabajo independiente:

1. ~~**La ronda adversarial sobre el código.**~~ **Ejecutada (19-09-2026)**,
   con veredicto `fix-and-retry` y su oleada de corrección aplicada el mismo
   día: 2 BLOCKER (valor negado guardado por texto ajeno; presupuesto sin
   abortar señal ni cancelar el puerto), los HIGH de contrato y de flujo, y
   la compuerta que no medía el presupuesto de lectura. **Re-ronda de los
   fixes ejecutada: segunda oleada aplicada y verificación final con
   veredicto `proceed`** (residual bajo declarado en §4).
2. ~~Formalizar o revertir las claves de readback.~~ **Hecho (19-09-2026):**
   derivación declarada en `SPEC-001` y `SPEC-007`; resto de huecos de la
   ronda corregido o justificado en §4.
3. **El adaptador de motor, `SPEC-011`.** Es el activo que justifica el
   proyecto. Exige dispositivo, así que trae de la mano la medición que
   resuelve la ventana de compatibilidad.
4. **La capa de vista, `SPEC-009`.** Los cuatro controles, los dos silencios y
   los anuncios por cambio de estado.
5. **El canal de agente, `SPEC-010`.** Último por decisión explícita: entra
   después de que el núcleo esté estable (`ADR-003`).

## 6. Qué está verificado y qué no

Se dice con la misma precisión que la evidencia permite, porque un «verificado»
sin respaldo es justo lo que este método prohíbe.

**Verificado, con su comando:**

- La puerta completa en verde: `check_sizes` OK con 81 archivos, las 66 pruebas
  del método, y `npm test` con **150 pruebas en verde** — de las cuales 128 son
  casos de spec con su identificador y 22 son regresiones y casos de la ronda.
- **La ronda adversarial del núcleo se ejecutó el 19-09-2026** con cuatro
  revisores de contexto fresco (uno por módulo contra su spec, sólo lectura,
  con sondas ejecutables). Veredicto: `fix-and-retry`; los BLOCKER y HIGH se
  corrigieron; los MED restantes quedan justificados en §4.
- Las cuatro pruebas de trazabilidad: cada caso de las spec implementadas tiene
  su prueba, ninguna prueba se apoya en un caso inexistente, el estado declarado
  coincide con lo probado, y el índice declara el mismo número de casos que las
  spec.
- Que el núcleo no abre red, no persiste, no escribe almacenamiento ni toca el
  DOM: comprobado **sobre el código** buscando `fetch`, `XMLHttpRequest`,
  `WebSocket`, `localStorage`, `indexedDB`, `document`, `window` y `console`.
  Las dos únicas API del entorno son el planificador por omisión del §4.
- Que cada módulo se puede mutar y sus pruebas se ponen en rojo: lo hicieron
  los cuatro implementadores y cada uno reportó su tabla. **Es evidencia de
  ellos, no mía**: quien retome puede repetirla.

**No verificado:**

- **Los fixes de la ronda pasaron re-ronda y verificación final con
  veredicto `proceed`** (§5.3); los MED sin corrección quedaron justificados
  en §4 y el residual bajo, declarado.
- **Nada se ha ejecutado en un navegador.** El núcleo es determinista y se
  prueba con dobles; el adaptador real (`SPEC-011`) no existe.
- **La ventana de compatibilidad no se ha medido.** Sin dispositivo no hay
  medición, y sin medición no se declara compatibilidad (`ADR-011`).

## 7. Lo que este proyecto no hace

Para que nadie lo reintroduzca por costumbre: la biblioteca **no persiste, no
abre red y no registra por su cuenta**; **no guarda un valor sin confirmación
explícita**; **cierra los turnos por señal real y nunca por temporizador**;
**no implementa ningún modelo de IA ni servidor MCP** en su primera versión; y
**no contiene ninguna política de dominio**: qué se guarda, qué datos son
sensibles, qué textos son intocables y qué se filtra lo declara el consumidor.
El detalle está en `specs/SPEC-006` y en el §7 de `product/plan.md`.

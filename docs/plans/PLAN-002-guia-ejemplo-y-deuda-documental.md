# PLAN 002 — guía de integración, ejemplo ejecutable y deuda documental

> Artefacto según `templates/skevi/plan-de-implementacion.md`. Nace de la
> ronda adversarial M1–M6 del 17-oct-2026: de seis propuestas sólo sobreviven
> M-A (E6-01/E6-02, ya planificados por `PROP-005-parte-3` de alubia como
> entregables de lalia-akuo) y M-C (deuda documental propia). Las rondas de
> este plan se registran en §Rondas.

```text
PLAN 002 — guía de integración, ejemplo ejecutable y deuda documental
Autoriza: instrucción humana del 17-oct-2026 («únicamente aspectos que
mejoren lalia-akuo»); filas E6-01 y E6-02 de la propuesta
PROP-005-parte-3 del consumidor (docs/proposals/ de alubia), que fija estos
entregables EN lalia-akuo; veredicto de la ronda adversarial M1–M6
Clase de tarea: Bounded — documentación, ejemplo de consumidor y una corrección
documental; ningún cambio al núcleo, ninguna spec nueva
Orden: T-01 → T-02 → T-03 → T-04

Restricciones globales (verbatim del artefacto que autoriza):
- «La biblioteca no persiste, no abre red ni registra por su cuenta, y lo
  declara.» (AGENTS.md)
- «Español primero, inglés después», sobre el mecanismo de paquetes de
  idioma. El inglés no puede exigir reescribir el núcleo. (AGENTS.md)
- «Evidencia o no pasó. Toda afirmación sobre el estado del repo viene de un
  comando ejecutado y su resultado real.» (AGENTS.md)
- El ejemplo es un consumidor: no toca src/, no implementa el adaptador de
  SPEC-011 (no hay motor medido) y no declara SPEC-009 implementada.

TAREAS:

TAREA T-01 (M-C) — recomponer el paso 6 de §5 de estado.md
  Consumes: docs/estado.md §5, paso 6 (líneas ~156-163)
  Produce:  el paso 6 describe sus flujos sin número sin referente y sin
            fragmentos huérfanos de ediciones anteriores
  Steps:
  - [x] Reescribir el paso 6 completo: retirar «42/43» (grep verificado: sin
        referente en ningún documento de lalia-akuo ni de alubia; entró en
        ffd076a sin referente) y el fragmento huérfano de las líneas 162-163
        («cierra los turnos por señal real...», cabeza de oración perdida del
        cierre del PLAN-001, git show 457ebd5) — verificación: grep -rn
        «42/43» docs/ → sin resultados; la sección §5 lee continua de arriba
        a abajo; npm test (trazabilidad) verde

TAREA T-02 (E6-02) — ejemplo ejecutable de tres campos, sin voz y con costura
  Consumes: src/index.js (superficie pública), PACK_ES (claves controls.*,
            announce.state.*, notice.offDeviceAudio de SPEC-007), SPEC-001
            (config y eventos), contrato-de-consumo.md §2–4
  Produce:  examples/tres-campos/ (página, cableo, adaptador ingenuo opcional,
            README) + prueba de humo del cableo en tests/
  Steps:
  - [x] Módulo de cableo sin DOM (examples/tres-campos/flujo.js): construye la
        sesión con tres campos, paquete es-mx con respaldo explícito al
        PACK_ES, **voz silenciada por omisión** (`setSpeechMuted(true)`:
        sin motor medido, el speaker por omisión falla y sin silenciar el
        flujo no avanza de campo — sonda D de R1) e interpreters deterministas
        inyectados (fieldInterpreter/controlInterpreter de ejemplo), y
        devuelve { session, events } — verificación: node --check y que la
        prueba de humo lo importa por esa ruta
  - [x] Prueba de humo (tests/ejemplo-tres-campos.test.js): SIN puertos de voz
        (speaker/listener por omisión) la sesión degrada a manual por su
        camino declarado (manual_input_required con su failure visible,
        C-008-16); con el cableo de flujo.js —interpreters inyectados y voz
        silenciada— los tres campos se completan por submitText con
        value_confirmed por campo (sonda B de R1: 3/3). **Restricción: no
        cita identificadores C-009-*/C-010-*/C-011-*** — la trazabilidad los
        leería como casos probados de specs declaradas pendientes y pondría
        el gate en rojo — verificación: node --test
        tests/ejemplo-tres-campos.test.js → pass; grep «C-0(09|10|11)» en el
        archivo → sin resultados; npm test completo verde
  - [x] Página mínima (examples/tres-campos/index.html + app.js) con los cinco
        elementos de SPEC-009 (cuatro controles + indicador de estado) y el
        anuncio por cambio de estado usando las claves de PACK_ES; el aviso
        `notice.offDeviceAudio` visible ANTES de cualquier petición de
        micrófono; importa sólo por src/index.js — verificación: node
        --check de app.js; grep de que index.html no referencia módulos de
        src/core directamente
  - [x] Adaptador ingenuo opcional (examples/tres-campos/voz-navegador.js):
        Web Speech sin parches, con el aviso visible de que NO es el
        adaptador de SPEC-011 y que nada de él está medido — verificación:
        el ejemplo corre sin él (sólo texto) y el archivo lo declara en su
        cabecera
  - [x] README del ejemplo con las dos formas de correrlo (sin voz, con voz
        ingenua) — verificación: npm run gate verde (tamaños dentro de
        límites)

TAREA T-03 (E6-01) — recetas de integración en el contrato
  Consumes: docs/product/contrato-de-consumo.md, src/core/session.js
            (getPreviousValue, ports, onEvent, runtime), SPEC-007 §3
            (variante regional con respaldo)
  Produce:  §10 «Recetas de integración» en el contrato y enlace desde README
  Steps:
  - [x] Recetas, cada una con su cita: (1) getPreviousValue ↔ almacenamiento
        del consumidor; (2) gramática/léxico del dominio ↔ puertos
        fieldInterpreter/controlInterpreter; (3) eventos ↔ UI (el núcleo sólo
        emite `state_changed` con `state` y `phase`: el anuncio lo monta la
        vista, SPEC-009); (4) runtime inyectado para pruebas con reloj falso
        (la pareja cerrada de C-001-19); (5) paquete es-mx con respaldo, en
        sus DOS formas: en config de sesión `language: { pack, fallback }`
        con paquetes crudos (el núcleo los envuelve, session.js buildCatalog)
        y en `createCatalog` directo el respaldo exige envoltura —
        `createCatalog(esMx, { fallback: createCatalog(PACK_ES) })`; el
        paquete crudo como respaldo lanza invalid_config (sonda C de R1) —
        verificación: cada afirmación cita spec o archivo; la receta (5)
        coincide con la práctica del ejemplo de T-02
  - [x] README: enlazar las recetas junto al ejemplo — verificación:
        grep «recetas» README.md; npm run gate verde

TAREA T-04 — cierre y ronda del delta
  Consumes: todas las anteriores
  Produce:  gate verde final, estado al día, plan cerrado
  Steps:
  - [x] npm run gate completo con las cifras nuevas — verificación: salida OK
        con el número real de pruebas
  - [x] estado.md: registrar E6-01/E6-02 con **satisfacción parcial
        declarada** — sin voz ✓ (determinista + texto); «con voz» = vía
        ingenua NO medida, SPEC-011 pendiente; la guía de migración de E6-01
        sigue vacía por diseño (contrato §7: sin releases no hay migración) y
        la integración por tercero es el criterio de E6-03, del lado del
        consumidor, no verificable desde aquí — y actualizar el DESGLOSE de
        §6 (casos de spec / regresiones / ejemplo), no sólo el total —
        verificación: npm test (trazabilidad) verde; grep «SPEC-009»
        docs/estado.md sigue diciendo pendiente
  - [x] Ronda adversarial del delta T-01..T-03 en contexto fresco —
        verificación: veredicto registrado en §Rondas con sus correcciones
        aplicadas si aplica

DoD:
- grep -rn «42/43» docs/ → sin resultados
- npm run gate verde de punta a punta, con la prueba de humo del ejemplo en
  la cuenta
- examples/tres-campos corre sin voz por diseño (determinista + texto) y la
  vía con voz queda declarada como ingenua y no medida
- contrato con §10 recetas citadas; README enlaza guía y ejemplo
- estado.md sin declarar implementada SPEC-009 ni medida SPEC-011
Partición: no excede el límite; no se parte.
```

## Rondas

### R1 — sobre este plan (17-oct-2026)

Revisor independiente, contexto fresco, solo lectura, con sondas ejecutables
(probe-a sin puertos, probe-b cableo, probe-c respaldo, probe-d cierre
hablado). Veredicto: **fix-and-retry** — «ninguna proposición factual del
plan resultó falsa salvo una (la prueba de humo tal como estaba escrita)».
Correcciones aplicadas:

1. La prueba de humo era inejecutable: sin puertos, `submitText` nunca
   confirma (los intérpretes por omisión devuelven `unparseable`/
   `unclassified`). Reescrita: puertos de voz por omisión → degradación
   declarada; interpreters de ejemplo en `flujo.js` + voz silenciada por
   omisión (sin silenciar, el cierre hablado falla y el flujo no avanza de
   campo — sonda D).
2. Restricción nueva: la prueba de humo no cita `C-009/010/011-*` (la
   trazabilidad los leería como probados y el gate en rojo).
3. T-01 ampliada: el paso 6 de §5 tiene también un fragmento huérfano de la
   edición del PLAN-001 (líneas 162-163); se recompone completo.
4. Receta (5) con las dos formas del respaldo (crudo en config de sesión;
   envuelto en `createCatalog` directo — el crudo lanza `invalid_config`).
5. T-04 registra satisfacción parcial de E6-01/E6-02 y actualiza el
   desglose de §6.
6. Cita «Evidencia o no pasó.» corregida byte a byte (AGENTS.md:69).
7. Página: cinco elementos (cuatro controles + indicador) y
   `notice.offDeviceAudio` visible antes de cualquier micrófono.

### R2 — delta de código y documentos (17-oct-2026)

Revisor independiente, contexto fresco, solo lectura, con sondas ejecutables
(servidor real, stub de navegador, mutación equivalente sin tocar el repo).
Veredicto: **fix-and-retry** — «el mecanismo del núcleo y las recetas del
contrato resisten todo lo que les eché (incluido el resolve tardío tras
cancel y la mutación)». Correcciones aplicadas:

1. `voz-navegador.js` dejaba una referencia a una variable eliminada
   (`void sintetizadorActivo`): el camino «con voz» del ejemplo rechazaba
   en toda llamada a `listen()` con `ReferenceError` — `node --check` no lo
   ve y el gate no ejecuta ese archivo. Eliminada; corregido además el
   comentario que prometía distinguir permiso cuando el ternario no
   distinguía nada.
2. El comando del README enraizaba el servidor en `examples/tres-campos`:
   el import `../../src/index.js` daba 404 y la página no ejecutaba JS.
   Ahora enraiza en la raíz del repositorio, verificado con servidor real
   (`app.js` 200, `src/index.js` 200).
3. `estado.md` §6: la ruta de lectura se re-midió tras los ajustes (1577,
   no 1564) y el desglose pasó al corte observable: 137 con identificador
   `C-*` + 21 regresiones/rondas + 1 de humo.
4. Cabecera del adaptador declara su desviación de
   `CANCEL_CONTRACT.settlesPromise` (resuelve tras `cancel()`; el núcleo lo
   tolera por disciplina de turno).

La mutación de control (quitar `setSpeechMuted(true)` del cableo) pone la
prueba de humo en roja — verificada por el revisor sin tocar el repo.

Evidencia del cierre: `sh scripts/run-gate.sh` exit 0; servidor real 200 en
ambos imports.

# PLAN 003 — Adaptador de motor de voz (SPEC-011) por olas

> Artefacto según `templates/skevi/plan-de-implementacion.md`. Nace de
> `PROP-003-adaptador-spec-011-por-olas.md` y su ronda adversarial R1
> (§Rondas). Ejecución por olas: cada una cierra con gate en verde y ronda
> sobre su delta. **Ola 0** (deriva documental y este paquete) aplicada en
> la rama `agent/ola-0-reactivacion`; **cierra** con
> `informe-ola-0.md` y la corrida del gate registrada en `estado.md` §6.

```text
PLAN 003 — adaptador de motor de voz (SPEC-011) por olas
Autoriza: SPEC-011-adaptador-web-speech-y-parches.md [cubre REQ-18];
  ADR-009-browser-targets.md; ADR-011-compatibility-window.md; instrucción
  del Operador del 12-11-2026 (reactivación; Ola 0 autorizada con
  commits, push, PR y merge por avance rápido tras gates y revisión);
  PROP-003 con veredicto R1
Clase de tarea: Architectural — crea superficie pública nueva con frontera
  externa (el motor del navegador) y extiende el plan de implementación
Orden: T-01 (Ola 1) → T-02 (Ola 2) → T-03 (Ola 3); rondas en cada cierre

Restricciones globales (verbatim del artefacto que autoriza):
- «Sólo el evento terminal real produce done; ningún temporizador produce
  done y error y watchdog nunca encadenan (SPEC-003).» (SPEC-011 §Invariantes)
- «Todo parche obligatorio tiene síntoma, disparo y prueba; quitar el
  parche deja su prueba en rojo.» (SPEC-011 §Invariantes)
- «La biblioteca no persiste, no abre red ni registra por su cuenta, y lo
  declara.» (AGENTS.md; el adaptador declara opensNetwork: true, SPEC-011)
- «Evidencia o no pasó. Toda afirmación sobre el estado del repo viene de
  un comando ejecutado y su resultado real.» (AGENTS.md)

TAREAS:

TAREA T-01 (Ola 1) — adaptador con dobles y superficie pública
  Consumes: SPEC-001 (request, vocabulario, runtime C-001-19), SPEC-002
            (callbacks, disciplina de turno), SPEC-003 (enumerado de
            locución y presupuesto), SPEC-004 (firmas de speaker/listener),
            SPEC-011 (contrato completo: 14 parches, 24 casos más el que
            añada la enmienda del paso 1),
            docs/product/contrato-de-consumo.md §1–§2
  Produce:  src/adapter/index.js (createWebSpeechAdapter(voiceEngine?,
            runtime?), PATCHES, ADAPTER_CAPABILITIES, congelados),
            tests/spec-011.test.js, enmienda de SPEC-011 §Entradas (reloj
            inyectable, hallazgo HIGH-2 de R1), subentrada "./adapter" en
            package.json, enmienda del contrato §1–§2, fila SPEC-011 de
            estado.md §2 vuelta a implementada con su celda de motivo
            reescrita, y §4/§6 de estado.md reconciliados
  Steps:
  - [ ] Enmendar SPEC-011 §Entradas declarando runtime = { schedule,
        cancelSchedule } con el entorno como omisión, y la validación
        fail-closed del par — rechazo en frontera de media pareja, claves
        de más o no funciones, como C-001-19 en el núcleo — con su caso
        nuevo y su cascada de índice en el mismo commit — verificación:
        la enmienda cita su procedencia (R1 y R1b) y los casos C-011-02,
        C-011-04, C-011-24 y el nuevo la prueban; npm test
  - [ ] Escribir src/adapter/index.js con la fábrica inyectada
        (voiceEngine, runtime) y los globales sólo como omisión —
        verificación: node --check src/adapter/index.js; grep de globales
        sólo en la omisión, nunca en el arranque del módulo
  - [ ] Escribir tests/spec-011.test.js cubriendo todos los casos
        declarados tras la enmienda —C-011-01 a C-011-24 y el nuevo del
        paso 1— con dobles de motor y reloj falso, cada caso citando su
        identificador — verificación: node --test
        tests/spec-011.test.js → todos en pass; grep setTimeout en el
        test → sin resultados; mutación de muestra:
        comentar un parche → su prueba en rojo
  - [ ] Voltear SPEC-011 a implementada en estado.md §2 con la celda de
        motivo reescrita (la implementación con dobles no espera
        dispositivo; lo que espera es la medición), y reconciliar §4 (el
        bullet «SPEC-011 no se puede cerrar sin dispositivo») y §6 («el
        adaptador real no existe») EN EL MISMO COMMIT que las pruebas —
        verificación: npm test (la trazabilidad exige coincidencia);
        reescrituras sin crecimiento neto de líneas (presupuesto de
        lectura 1600: contar antes de escribir)
  - [ ] Amendar contrato de consumo §1 (dos entradas: "." y "./adapter",
        declarando que la frontera es el contrato §2, no el mapa exports)
        y §2 (fila del adaptador con procedencia SPEC-011) — verificación:
        npm run gate en verde
  - [ ] Ronda adversarial sobre el delta de T-01 — superficie nueva,
        enmiendas de spec y contrato, volteo de estado — verificación:
        veredicto proceed con hallazgos cerrados o aceptados por escrito;
        re-ronda si el cambio fue material

TAREA T-02 (Ola 2) — arnés de medición en dispositivos reales
  Consumes: src/adapter/index.js (Ola 1), ADR-009 (matriz por motor,
            medición por navegador), ADR-011 (ventana y estado de medición)
  Produce:  examples/medidor-spec-011/ (página, cableo, guía de medición)
            con la costura de activación para P-05, y el registro de cada
            medición en docs/plans/informe-ola-2-medicion.md (JSON compacto)
  Steps:
  - [ ] Página sin construcción, servida desde la raíz del repositorio,
        que reproduce las condiciones de disparo de los 14 parches contra
        el motor real — verificación: node --check de su JS; abrir la
        página servida y reproducir al menos un disparo por parche
        aplicable a cada navegador/plataforma
  - [ ] Recorrido de matriz completa por navegador —las seis celdas de
        ADR-009: Safari macOS, Safari iOS, Chrome escritorio, Chrome
        Android, Edge escritorio, Edge móvil— más la sonda P-05 aparte:
        carga fresca sin activación en WebKit móvil, separada del flujo
        que sí recoge la activación — verificación: registro con fecha,
        navegador, plataforma, resultado por parche y versión derivada
        por ventana si aplica; una celda sin medir queda declarada «sin
        medir», incluida Edge móvil
  - [ ] Ronda adversarial sobre el delta del arnés — verificación:
        veredicto proceed con hallazgos cerrados o aceptados por escrito

TAREA T-03 (Ola 3) — cierre por evidencia
  Consumes: registro de medición de T-02, SPEC-003/SPEC-004 (techos
            provisionales), contrato §7, estado.md §4 y §6
  Produce:  docs/compatibilidad.md (objetivo + estado de medición por
            navegador), techos fijados con valores medidos (con enmienda
            de spec y su caso si cambian), parches recortados sólo por
            evidencia, estado §6 actualizado con la nueva evidencia
  Steps:
  - [x] Crear docs/compatibilidad.md declarando objetivo y estado de
        medición, enlazado desde contrato §7 — verificación: ninguna fila
        dice compatibilidad sin su medición; npm run gate en verde
        (13-11-2026: matriz con 4 celdas medidas + sonda, dos sin medir,
        sin declarar compatibilidad)
  - [x] Ajustar SPEECH_BUDGET_MS/TURN_BUDGET_MS a valores medidos sólo si
        la medición los contradice — sin cambio y sin enmienda: las
        locuciones medidas (1,9–3,4 s) y las escuchas quedan muy por
        debajo de 20000/30000; npm test en verde, valores intactos
  - [x] Recortar parches sólo con evidencia de motor fuera de objetivo —
        el recorte arrastra su cascada en el mismo commit: caso fuera de
        SPEC-011, prueba fuera de tests/, fila y total de
        docs/specs/00-INDICE.md ajustados — verificación: cada recorte
        cita su medición; PATCHES sigue cerrado y C-011-19 sigue en
        verde; npm run gate en verde (la trazabilidad y el total del
        índice caen en rojo si la cascada queda a medias) —
        **sin recortes el 13-11-2026**: ningún motor quedó fuera del
        objetivo; el hallazgo de la sonda P-05 se resolvió por enmienda
        de la spec (medición 13-11-2026), no por recorte
  - [x] Ronda adversarial final sobre el delta — verificación: veredicto
        proceed; npm run gate en verde — ejecutada el 13-11-2026 en dos
        asaltos (R5 fix-and-retry con 1 HIGH/1 MED/2 LOW, corregidos en
        5e1cfc7; R5c **proceed** con 1 LOW cosmético restaurado en el
        cierre), revisor OpenCode GLM de contexto fresco visible en pane
        hermano; registro en §Rondas

DoD:
- gate completo en verde (check_sizes, 66 del método, npm test completo)
- SPEC-011 implementada: todos sus casos declarados —los 24 originales y
  el nuevo de la enmienda— con prueba que cita su identificador
- PATCHES y ADAPTER_CAPABILITIES exportados, congelados y legibles
- matriz de medición registrada por navegador, o su falta declarada
- compatibilidad declarada sólo con estado de medición (ADR-011)
- cero operaciones de autoridad separada sin autorización vigente

Partición: no excede límite; no parte.
```

## Rondas

**R1 (12-11-2026) — sobre PROP-003 + PLAN-003, revisor de contexto fresco
en sólo lectura.** Veredicto: **fix-and-retry** (2 HIGH, 4 MED, 1 LOW).
Disposición de cada hallazgo:

- **HIGH-1 (matriz de 5 celdas, Edge móvil omitido):** corregido — la
  matriz es ahora las **seis celdas** de `ADR-009` en PROP-003 §O-2 y
  T-02, con Edge móvil declarado y «sin medir» como estado explícito si
  no se mide.
- **HIGH-2 (sin reloj inyectable para C-011-02/04/24):** corregido — la
  firma pasa a `createWebSpeechAdapter(voiceEngine?, runtime?)` con el par
  cerrado `{ schedule, cancelSchedule }` del núcleo (`C-001-19`) y el
  entorno como omisión; T-01 gana el paso de enmienda de SPEC-011
  §Entradas con esta procedencia; las pruebas usan reloj falso.
- **MED-1 (recorte sin su cascada de trazabilidad):** corregido — el paso
  de recorte de T-03 arrastra caso, prueba, fila y total del índice en el
  mismo commit.
- **MED-2 (estado §2/§4/§6 sin reconciliar en T-01):** corregido — el
  Produce de T-01 incluye la celda de motivo de §2 y la reconciliación de
  §4 y §6, con reescritura sin crecimiento neto (ruta entonces 1593/1600).
- **MED-3 (sonda P-05 imposible en el flujo activado):** corregido —
  sonda aparte en carga fresca sin activación, y la meta del arnés es
  «un disparo por parche aplicable».
- **MED-4 (evidencia de §6 anterior a los commits de Ola 0):** corregido
  — §6 registra la corrida del gate al cierre de la Ola 0. **R1b halló
  que la disposición se adelantaba:** el registro entra en el commit que
  añade `informe-ola-0.md`, no antes; hasta ese commit es un compromiso
  con dueño explícito —el cierre de esta ola— y no una corrección ya
  aplicada.
- **LOW-1 (`exports` no es frontera bajo consumo por copia):** corregido
  como declaración explícita en PROP-003 §O-1 y en el paso de enmienda
  del contrato.

Re-ronda R1b sobre el paquete corregido: ver registro abajo.

**R1b (12-11-2026) — re-ronda sobre el paquete corregido, revisor de
contexto fresco en sólo lectura.** Veredicto: **fix-and-retry** (1 HIGH,
1 MED, 2 LOW). Disposición:

- **HIGH (MED-4 declarado corregido sin estarlo):** corregido en el
  cierre — §6 se actualiza con la corrida del gate al cierre de la Ola 0
  en el commit que añade `docs/plans/informe-ola-0.md`.
- **MED (T-01 sin paso de ronda):** corregido — T-01 gana su paso de
  ronda adversarial con verificación de veredicto y re-ronda.
- **LOW (validación de runtime malformado sin declarar):** corregido —
  la enmienda declara el rechazo fail-closed del par, con caso nuevo y
  cascada de índice (PROP-003 §O-1 y paso 1 de T-01).
- **LOW («exponer» la activación de P-05 sin caso ni dueño):** corregido
  — la enmienda aclara que es costura de SPEC-009 y que lo testeable es
  C-011-08; sin superficie nueva (PROP-003 §O-1).

Re-ronda R1c sobre estos ajustes: ver registro abajo.

**R1c (12-11-2026) — re-ronda sobre el delta de 8cb6f85, revisor de
contexto fresco en sólo lectura.** Veredicto: **fix-and-retry** (1 HIGH,
2 MED, 1 LOW). Disposición:

- **HIGH (conteos sin reconciliar tras prometer un caso nuevo):**
  corregido — todas las menciones pasan a «todos los casos declarados»:
  PROP-003 §O-1, Consumes de T-01, paso 3 de T-01 y DoD.
- **MED (bloque R1b insertado en medio de la lista de R1, LOW-1 huérfano
  y puntero R1b sobrante):** corregido — §Rondas reordenado: R1 completa,
  puntero R1b, bloque R1b, puntero R1c.
- **MED (cierre de la Ola 0 no trazable desde estado.md §5 ni desde la
  cabecera):** corregido — la cabecera de este plan y la nota de
  reactivación de `estado.md` §5 declaran el cierre con
  `informe-ola-0.md` y la corrida del gate en §6.
- **LOW (frase auto-referencial en la disposición R1b):** corregido —
  nombra el artefacto explícito: «el commit que añade
  `docs/plans/informe-ola-0.md`».

Re-ronda R1d sobre estos ajustes: se registra abajo al ejecutarse.

**R1d (12-11-2026) — re-ronda sobre el delta de cd89aa5, revisor de
contexto fresco en sólo lectura.** Veredicto: **proceed** (3 LOW, sin
BLOCKER/HIGH/MED). Los tres LOW quedaron cerrados en el commit de cierre
de la Ola 0 —el que añade `informe-ola-0.md`—, como el propio revisor
asignó:

- **LOW (cifra de ruta citada como 1593 siendo 1594):** corregido —
  PROP-003 §2 actualizada a 1594/1600; las menciones operativas de
  T-01 relativizadas a «presupuesto 1600: contar antes de escribir», y
  el registro histórico de R1 MED-2 precisa «ruta entonces 1593/1600».
  Nota: la disposición del HIGH de R1c decía «todas las menciones pasan
  a “todos los casos declarados”»; tres de cuatro usan esa fórmula y la
  cuarta (Consumes de T-01) reconcilia por cuenta explícita — la
  sustancia del fix era la reconciliación, y las cuatro están
  reconciliadas.
- **LOW (presente deóntico del cierre sin marcar el pendiente):**
  corregido — este commit es el cierre: `informe-ola-0.md` existe a
  partir de él y la corrida del gate queda registrada en `estado.md` §6.
- **LOW ya descrito arriba (frase auto-referencial):** sin cambios
  adicionales; R1d verificó su corrección.

Con esto el paquete PROP-003 + PLAN-003 queda ejecutable para la Ola 1.

**R5 (13-11-2026) — sobre el delta 4ea5a8b (Ola 3), revisor OpenCode GLM
de contexto fresco en pane hermano (visible), sólo lectura.** El primer
lanzamiento (lalia-r5) se cortó por cuota Z.AI; reanudado como lalia-r5b.
Veredicto: **fix-and-retry** (1 HIGH, 1 MED, 2 LOW). Disposición, en
`5e1cfc7`:

- **HIGH (C-011-08 contradecía la rama sin señal del P-05 enmendado):**
  corregido — el DADO acotado al doble que **señala** `not-allowed`, y
  caso nuevo **C-011-26** para la rama sin señal (motor mudo → watchdog
  con voz presente), con cascada completa (26 casos, índice 194, prueba
  nueva, estado §6).
- **MED (escenario P-05 del medidor con accept pre-enmienda):** corregido
  — accept `['error','watchdog']` con las dos ramas explicadas; el
  `fail` histórico de la sonda queda narrado como tal en el registro.
- **LOW (causa de P-12-edge sin traza en JSON):** corregido — presentada
  como reporte del Operador, sin desenlace en `06`.
- **LOW (primeras pasadas fallidas de P-14 no narradas):** corregido —
  nota de re-medición en el registro.

**R5c — re-ronda sobre 5e1cfc7.** Veredicto: **proceed**, con 1 LOW
cosmético (línea de declaración de C-011-25 pegada por la edición),
restaurado en el commit de cierre. La cascada de C-011-26 quedó verificada
por el revisor con la trazabilidad en verde.

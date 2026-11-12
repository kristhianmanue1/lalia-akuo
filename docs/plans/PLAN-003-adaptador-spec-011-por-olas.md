# PLAN 003 — Adaptador de motor de voz (SPEC-011) por olas

> Artefacto según `templates/skevi/plan-de-implementacion.md`. Nace de
> `PROP-003-adaptador-spec-011-por-olas.md` y su ronda adversarial R1
> (§Rondas). Ejecución por olas: cada una cierra con gate en verde y ronda
> sobre su delta. **Ola 0** (deriva documental y este paquete) ya está
> aplicada en la rama `agent/ola-0-reactivacion`.

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
  Consumes: SPEC-001 (request, vocabulario), SPEC-002 (callbacks,
            disciplina de turno), SPEC-003 (enumerado de locución y
            presupuesto), SPEC-004 (firmas de speaker/listener),
            SPEC-011 (contrato completo: 14 parches, 24 casos),
            docs/product/contrato-de-consumo.md §1–§2
  Produce:  src/adapter/index.js (createWebSpeechAdapter, PATCHES,
            ADAPTER_CAPABILITIES, congelados), tests/spec-011.test.js,
            subentrada "./adapter" en package.json, enmienda del contrato
            §1–§2, fila SPEC-011 de estado.md §2 vuelta a implementada
  Steps:
  - [ ] Escribir src/adapter/index.js con la fábrica inyectada
        (voiceEngine) y los globales sólo como omisión — verificación:
        node --check src/adapter/index.js; grep de globales sólo en la
        omisión, nunca en el arranque del módulo
  - [ ] Escribir tests/spec-011.test.js cubriendo C-011-01 a C-011-24 con
        dobles de motor, cada caso citando su identificador —
        verificación: node --test tests/spec-011.test.js → 24 pass;
        mutación de muestra: comentar un parche → su prueba en rojo
  - [ ] Voltear SPEC-011 a implementada en estado.md §2 EN EL MISMO
        COMMIT que las pruebas — verificación: npm test (la prueba de
        trazabilidad exige coincidencia; un commit sin el otro da BLOQ)
  - [ ] Amendar contrato de consumo §1 (dos entradas: "." y "./adapter")
        y §2 (fila del adaptador) — verificación: la fila declara
        procedencia SPEC-011; npm run gate en verde

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
  - [ ] Recorrido de matriz por navegador: Safari macOS, Safari iOS,
        Chrome escritorio, Chrome Android, Edge escritorio —
        verificación: registro con fecha, navegador, plataforma,
        resultado por parche y versión derivada por ventana si aplica;
        un navegador sin medir queda declarado «sin medir»
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
  - [ ] Crear docs/compatibilidad.md declarando objetivo y estado de
        medición, enlazado desde contrato §7 — verificación: ninguna fila
        dice compatibilidad sin su medición; npm run gate en verde
  - [ ] Ajustar SPEECH_BUDGET_MS/TURN_BUDGET_MS a valores medidos sólo si
        la medición los contradice — verificación: enmienda de SPEC-003/
        SPEC-004 con su caso y su prueba en el mismo commit; npm test
  - [ ] Recortar parches sólo con evidencia de motor fuera de objetivo —
        verificación: cada recorte cita su medición; PATCHES sigue
        cerrado y C-011-19 sigue en verde
  - [ ] Ronda adversarial final sobre el delta — verificación: veredicto
        proceed; npm run gate en verde

DoD:
- gate completo en verde (check_sizes, 66 del método, npm test completo)
- SPEC-011 implementada: 24 casos con prueba que cita su identificador
- PATCHES y ADAPTER_CAPABILITIES exportados, congelados y legibles
- matriz de medición registrada por navegador, o su falta declarada
- compatibilidad declarada sólo con estado de medición (ADR-011)
- cero operaciones de autoridad separada sin autorización vigente

Partición: no excede límite; no parte.
```

## Rondas

**R1 (12-11-2026) — sobre PROP-003 + PLAN-003.** Revisor de contexto fresco
en sólo lectura contra el repositorio real. Estado: pendiente de ejecución;
se registra aquí su veredicto y la disposición de cada hallazgo.

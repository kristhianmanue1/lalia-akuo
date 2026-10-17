# PLAN 001 — correcciones del núcleo, CI interno y contrato de consumo

> Artefacto de escala según `templates/skevi/plan-de-implementacion.md`: el
> plan es dueño de los criterios (DoD, steps). Las rondas adversariales de
> este plan se registran en §Rondas al cerrarse cada una.
> **Fuente de las correcciones:** análisis crítico del 17-oct-2026 contra el
> código + ronda adversarial 1 (§Rondas, R1).

```text
PLAN 001 — correcciones del núcleo, CI interno y contrato de consumo
Autoriza: instrucción humana del 17-oct-2026 (CI interno sin GitHub Actions;
contrato base de consumo para agentes de IA; ejecución por olas con rondas
adversariales) · AGENTS.md «Reglas no negociables» · enmiendas a
SPEC-001/002/005/008 · ADR-005, ADR-010, ADR-011
Clase de tarea: Bounded — defectos con sonda reproducible y huecos ya
declarados en docs/estado.md §4; ninguna tarea amplía alcance del producto
Orden: T-01..T-03 → T-04→T-05→T-06→T-07→T-08 en secuencia estricta (los
totales del índice son absolutos y acumulan) → T-09..T-12

Restricciones globales (verbatim del artefacto que autoriza):
- «La biblioteca no persiste, no abre red ni registra por su cuenta, y lo
  declara.» (AGENTS.md)
- «No se guarda un valor sin confirmación explícita.» (AGENTS.md)
- «Los turnos se cierran por señal real, nunca por temporizador.» (AGENTS.md)
- «Sin modelo de IA y sin servidor MCP en la primera versión.» (AGENTS.md)
- «Evidencia o no pasó. Toda afirmación sobre el estado del repo viene de un
  comando ejecutado y su resultado real.» (AGENTS.md)

TAREAS:

TAREA T-01 (Ola 0) — presupuesto de la ruta de lectura
  Consumes: skevi-gate.json (reading_path), check_sizes.py §check_reading_path
  Produce:  gate desbloqueado con la razón registrada
  Steps:
  - [x] Subir reading_path.limit de 1400 a 1600 en skevi-gate.json —
        verificación: python3 scripts/check_sizes.py → OK, trinquete
        «ruta de lectura 1532/1600»
  - [x] Registrar la razón (AN-KLA beta.33 dejó +135 líneas en AN-KLA.md y
        +2 netas en AGENTS.md según git diff --numstat, gestionadas por la
        herramienta; la clave «limit» no admite prosa porque CONFIG_KEYS es
        cerrado) en el mensaje del commit y en docs/estado.md §4 —
        verificación: grep «1600» docs/estado.md skevi-gate.json

TAREA T-02 (Ola 0) — upgrade AN-KLA beta.33 aplicado y versionado
  Consumes: AGENTS.md, AN-KLA.md, docs/estado.md (ya modificados en el árbol)
  Produce:  commit del upgrade con el gate en verde
  Steps:
  - [x] Revisar el diff (hecho en R1: bloque gestionado + referencia rápida)
        y `.venv/bin/python -m an_kla --project-root . context status` →
        ok: true, sin diagnósticos
  - [x] Commit acotado a AGENTS.md, AN-KLA.md, skevi-gate.json y
        docs/estado.md — verificación: git log -1 --stat y npm run gate verde
        antes del commit
  - [x] Los commits de las tareas siguientes van en la rama plan-001; push,
        merge a main y remoto quedan para autorización humana expresa, una
        por operación (AGENTS.md «Autoridad por operación»)

TAREA T-03 (Ola 0) — estado.md al día (interino; T-12 lo re-escribe)
  Consumes: docs/estado.md §3/§4/§6
  Produce:  declaración fiel a la evidencia vigente
  Steps:
  - [x] Actualizar «Última actualización», §4 (nota del presupuesto 1600 y de
        los defectos que este plan corrige), §6 (salida real del gate) —
        verificación: npm test (trazabilidad) en verde

TAREA T-04 (Ola 1, H3) — getPreviousValue que lanza o no comparable: fail-closed
  Consumes: SPEC-001 §deltaPolicy (C-001-16..18), session.js needsReconfirm
  Produce:  caso C-001-21 + prueba + corrección fail-closed
  Steps:
  - [x] Añadir C-001-21 a SPEC-001: DADO onExceeded='reconfirm' y un
        getPreviousValue que lanza o devuelve un valor no numérico finito
        CUANDO el turno procesa un valor ENTONCES la comparación no se
        desactiva en silencio: se aplica la segunda confirmación y el valor
        no se guarda con una sola confirmación (REQ-6)
  - [x] Prueba en tests/session.test.js citando C-001-21 (lanzador y
        no-número) — verificación: roja antes del fix, verde después
  - [x] session.js needsReconfirm: catch → return true; previous no finito →
        return true — verificación: npm test
  - [x] Actualizar contadores de docs/specs/00-INDICE.md (SPEC-001 → 21;
        total → 188) — verificación: npm test (trazabilidad)

TAREA T-05 (Ola 1, H2) — en modo manual ningún paso asking habla ni escucha
  Consumes: SPEC-005 §Comportamiento/Casos (C-005-01..15), session.js stageAsk
  Produce:  caso C-005-16 + prueba + corrección de la transición zombi
  Steps:
  - [x] Enmendar SPEC-005 por completo: la transición incondicional
        idle --start()--> speaking·asking (§Comportamiento) Y la de
        idle --start(), voz silenciada--> listening·capturing quedan
        condicionadas a que la sesión no esté en modo manual; añadir
        C-005-16: DADO una sesión degradada a entrada manual CUANDO se llama
        start() o el flujo llega a un paso asking (incluye submitText
        multi-campo) ENTONCES no hay locución del prompt, ni text_output del
        prompt, ni state_changed a speaking/listening, la sesión queda
        idle·idle y la salida declarada sigue siendo submitText
  - [x] Pruebas en tests/session.test.js citando C-005-16 (start() tras
        degradar; campo siguiente por submitText tras degradar) —
        verificación: rojas antes del fix, verdes después
  - [x] session.js stageAsk: primera línea if (manualMode) return 'rest' —
        verificación: npm test
  - [x] Actualizar 00-INDICE (SPEC-005 → 16; total → 189, con T-04 ya
        aplicado) — verificación: npm test (trazabilidad)

TAREA T-06 (Ola 1, H6a) — el aviso de degradación no calla sus fallos
  Consumes: SPEC-003 §Salidas, SPEC-004 (fallo explícito), SPEC-008,
            session.js degradeStep/guarded
  Produce:  caso C-008-16 + pruebas + corrección de las dos variantes
  Steps:
  - [x] Añadir C-008-16 a SPEC-008: DADO la locución del aviso de degradación
        que falla (speech_failed, speech_watchdog, port_failure o
        port_budget_exhausted) CUANDO se degrada ENTONCES además del
        manual_input_required se emite failure con su código, la sesión
        termina en idle·idle y ningún fallo produce silencio
  - [x] Pruebas en tests/session-regression.test.js citando C-008-16 (say →
        'error'; presupuesto de locución agotado durante el aviso) —
        verificación: rojas antes del fix, verdes después
  - [x] degradeStep: si speakText devuelve ok:false sin señal, emitir
        failure con su código y resolver el turno abierto (como hace
        speakOrFail en session.js); guarded: con PortSignal en modo manual,
        emitir failure antes de 'rest' — verificación: npm test y, en las
        pruebas nuevas, clock sin vigilantes ni turnos huérfanos
  - [x] Actualizar 00-INDICE (SPEC-008 → 16; total → 190, con T-04 y T-05 ya
        aplicados) — verificación: npm test (trazabilidad)

TAREA T-07 (Ola 1, H6b) — razón precisa del no-op por presupuesto
  Consumes: SPEC-002 (C-002-11), turn.js decide/NOOP_REASONS
  Produce:  caso C-002-13 + prueba + miembro budget_exhausted
  Steps:
  - [x] Añadir C-002-13 a SPEC-002: DADO un turno agotado por presupuesto
        CUANDO decide() evalúa un resultado ENTONCES rechaza con razón
        'budget_exhausted', más precisa que 'turn_cancelled'
  - [x] Prueba en tests/turn.test.js citando C-002-13 — verificación: roja
        antes, verde después
  - [x] turn.js: añadir NOOP_REASONS.budget_exhausted y decidir por status —
        verificación: npm test; actualizar 00-INDICE (SPEC-002 → 13;
        total → 191)

TAREA T-08 (Ola 1, H6c) — submitText con no-cadena es no-op declarado
  Consumes: SPEC-001 §Salidas (submitText), session.js submitText
  Produce:  caso C-001-22 + prueba
  Steps:
  - [x] Añadir C-001-22 a SPEC-001: DADO submitText con un valor que no es
        cadena CUANDO se llama ENTONCES es un no-op declarado: sin eventos,
        sin transiciones y sin excepción — la entrada por texto nunca es
        castigo ni trampa
  - [x] Prueba en tests/session.test.js citando C-001-22 — verificación:
        verde contra el comportamiento existente; actualizar 00-INDICE
        (SPEC-001 → 22; total → 192)

TAREA T-09 (Ola 2, H5) — superficie del paquete declarada
  Consumes: ADR-010 (superficie pequeña y estable por commit), package.json
  Produce:  exports/engines/files declarados
  Steps:
  - [x] package.json: exports {".": "./src/index.js"}, engines.node ">=18",
        files ["src", "schema"] — verificación: reejecutar tras el cambio el
        probe de importación por nombre (symlink a este repo desde un
        directorio efímero) y npm test
  - [x] README: sección de consumo con el ejemplo mínimo y enlace al contrato
        (sólo nombres ya exportados, que public-api.test.js compara contra
        index.js) — verificación: npm run gate verde

TAREA T-10 (Ola 2, H4) — CI interno honesto
  Consumes: docs/estandar-diseno-software-github.md (l.352), scripts/hooks/pre-push,
            requisito humano: Python >= 3.12
  Produce:  scripts/run-gate.sh + hook completo + npm run gate con intérprete fijado
  Steps:
  - [x] scripts/run-gate.sh: elige .venv/bin/python si existe, si no python3
        (rebasable con GATE_PYTHON para probar); verifica versión >= 3.12 y
        si no falla cerrado con mensaje claro; corre check_sizes + unittest
        + npm test — verificación: sh scripts/run-gate.sh → verde;
        GATE_PYTHON=python3 (3.9.6) → mensaje claro y salida distinta de cero
  - [x] package.json gate → "sh scripts/run-gate.sh"; pre-push invoca el mismo
        script (corrige la cita a un ADR-034 inexistente: la procedencia pasa
        a ser el estándar §5.4) — verificación: npm run gate verde

TAREA T-11 (Ola 2) — contrato base de consumo para agentes
  Consumes: ADR-005/008/010/011, SPEC-010 y §no-objetivos de product/plan.md,
            schema/eventos.json, src/index.js
  Produce:  docs/product/contrato-de-consumo.md
  Steps:
  - [x] Escribir el contrato: superficie pública ESM como canal v1; ciclo de
        vida y eventos con schema/eventos.json como única fuente máquina;
        códigos de error DERIVADOS de SPEC-001/003/004 con cita de caso (sin
        enumerado paralelo); presupuestos; CAPABILITIES; compatibilidad por
        ventana de ADR-011 redactada como objetivo SIN medir; canales CLI,
        MCP y API = no objetivos v1 (ADR-005 para MCP; ADR-003 y §no-objetivos
        para CLI/API) con su costura (SPEC-010, puertos); consumo por copia y
        revisión del 30-dic-2026
  - [x] Verificación: cada afirmación cita su ADR/spec; npm run gate verde;
        sin política de dominio (revisión contra AGENTS.md)

TAREA T-12 (cierre) — verificación y registro
  Consumes: todas las anteriores
  Produce:  gate verde final, estado.md §6 con cifras reales, rondas cerradas
  Steps:
  - [x] npm run gate completo — verificación: salida OK con el número real de
        pruebas; actualizar docs/estado.md §6 (definitivo) y este plan
        (casillas y §Rondas)
  - [x] Ronda adversarial del delta de código (T-04..T-08) en contexto fresco,
        sólo el delta — verificación: veredicto registrado en §Rondas

DoD:
- npm run gate verde de punta a punta con run-gate.sh (Python >= 3.12)
- Trazabilidad en verde: casos nuevos citados por sus pruebas y contadores
  del índice exactos (21+22, 16, 16, 13; total 192)
- Los defectos H2, H3, H6a, H6b, H6c con spec enmendada, prueba y corrección
- Contrato de consumo publicado en docs/product/ con las dos cautelas de R1
- Rondas adversariales R1 y R2 registradas con veredicto en §Rondas
Partición: no excede el límite; no se parte.
```

## Rondas

### R1 — sobre el paquete de propuestas (17-oct-2026)

Revisor independiente, contexto fresco, solo lectura, con sondas ejecutables
(`probe-h2-h3.mjs`, `probe-h2-multicampo.mjs`). Veredicto: **fix-and-retry**
(del paquete, no del código: ninguna proposición resultó falsa).

Correcciones que este plan incorpora:

1. H2 agravado: estado zombi `listening·capturing` alcanzable también por
   `submitText` multi-campo, no sólo por `start()` → T-05 cubre ambos caminos
   y enmienda SPEC-005, no sólo el código.
2. H6a elevado a divergencia SPEC-003/SPEC-004: el aviso de degradación calla
   `speech_failed`, `speech_watchdog` y `port_budget_exhausted` → T-06 cubre
   las variantes no-señal y presupuesto, contra el invariante «ningún fallo
   produce silencio».
3. H3: semántica elegida y declarada (fail-closed: reconfirmar) con caso
   nuevo, no silencio → T-04.
4. H1: la razón del límite no cabe en `skevi-gate.json` (claves cerradas);
   va en commit y estado.md → T-01/T-03.
5. H4: el hook omite `npm test` y cita un ADR-034 inexistente; el intérprete
   no está fijado → T-10.
6. Estrategia: ventana de ADR-011 como objetivo sin medir; códigos de error
   derivados de las specs, sin enumerado paralelo → T-11.

Hallazgos nuevos de R1 absorbidos: estado zombi (T-05), silencio del aviso
(T-06), ADR-034 roto y hook incompleto (T-10), estado.md §6 desactualizado
(T-03/T-12).

### R2 — sobre este plan (17-oct-2026)

Revisor independiente, contexto fresco, solo lectura. Veredicto:
**fix-and-retry** del plan: «ninguna proposición factual resultó falsa;
lo que se refuta es la ejecutabilidad literal de cuatro pasos». Correcciones
aplicadas al plan en la misma fecha:

1. T-05 extendido: la enmienda cubre también la transición de SPEC-005 §100
   (voz silenciada) y C-005-16 declara que tampoco hay `text_output` del
   prompt en modo manual.
2. T-06 extendido: degradeStep resuelve el turno abierto en la variante sin
   señal (como `speakOrFail`), sin turnos huérfanos ni vigilantes armados.
3. T-07/T-08 con cifras exactas del índice (total → 191; SPEC-001 → 22 y
   total → 192) y restricción de orden de la Ola 1 declarada en el encabezado.
4. T-09: el probe de importación por nombre se reejecuta tras el cambio de
   `exports` (la evidencia de R1 es previa al cambio); limpiado el vestigio
   editorial de `files`.
5. T-02: commit acotado a sus cuatro archivos; política de commits del resto
   declarada (rama plan-001; push/merge por autorización expresa).
6. T-01: cifra reproducible del crecimiento (+135 AN-KLA.md, +2 netos
   AGENTS.md, por `git diff --numstat`).
7. Verificación de T-05 confirmada inofensiva para C-005-01/02; la de T-06,
   sin duplicación de eventos en C-008-10/13 y C-005-12/13/15; la de T-07,
   sin colisión con la aserción de razón del camino de cancelación.

### R3 — delta de código (17-oct-2026)

Revisor independiente, contexto fresco, solo lectura, con sondas ejecutables
y mutaciones sobre copia. Alcance: los cinco commits de corrección
(`02c8bc4..fa8d047`). Veredicto: **fix-and-retry** — cuatro correcciones
SÓLIDAS (C-001-21, C-005-16, C-008-16, C-002-13), una FRÁGIL.

Correcciones exigidas y aplicadas (commit `d3cfbef`):

1. La prueba de C-001-22 era vacua: corría con el flujo ya terminado, así
   que ninguna mutación la ponía roja. Rehecha para morder en pleno turno
   de voz: el no-cadena no produce eventos, el turno sobrevive y el flujo
   posterior completa y guarda.
2. La rama manual de `guarded` emitía el `failure` del presupuesto pero
   dejaba la sesión colgada en `speaking`·`confirming` o
   `thinking`·`interpreting` sin flujo vivo (escenarios fuera del aviso de
   degradación). Ahora vuelve a `idle` · `idle`, con prueba nueva y el
   invariante de SPEC-008 extendido.

Residuales declarados: `deltaPolicy` en campos no numéricos se admite en la
validación y la comparación no aplica (borde preexistente, declarado en
`estado.md` §4); la emisión de `failure` por señal en modo manual ensancha
el bus de eventos —válido contra `schema/eventos.json` y en la dirección
del invariante— y queda fijada por las pruebas nuevas.

Evidencia del cierre: `npm test` 158/158 en verde; `sh scripts/run-gate.sh`
exit 0 (85 archivos, ruta 1544/1600, 66 del método).

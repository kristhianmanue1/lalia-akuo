# Informe — Ola 0: reactivación, paquete de propuestas y PLAN-003

**Fecha:** 12 de noviembre de 2026 · **Rama:** `agent/ola-0-reactivacion`
**Orden del coordinador:** ejecutar la Ola 0 del plan propuesto en la
toma de contexto del mismo día. Autorización vigente para commits, push,
PR y merge por avance rápido tras gates y revisión.

## 1. Qué se ejecutó

1. **Gate base sobre `main`** (`12277f6`) con los archivos
   `opencode.json` y `opencode.flash.json` ya presentes en la raíz: en
   verde; el gate los absorbe sin incumplimiento.
2. **Deriva documental** en `docs/estado.md`: fecha de actualización,
   reactivación del proyecto y **tequio como segundo consumidor nombrado**
   (con la frontera §7 explícita: nada de su dominio entra; su spec v1.0
   aún no declara el consumo y queda registrado como deuda suya), y el
   paso activo pasa a ser el 3 (SPEC-011) por olas.
3. **Paquete de propuestas** `PROP-003-adaptador-spec-011-por-olas.md`:
   cuatro olas (adaptador con dobles; arnés de medición con las seis
   celdas de `ADR-009` y sonda P-05 aparte; cierre por evidencia con
   presupuestos medidos y `docs/compatibilidad.md`; rondas por delta), con
   alternativas descartadas y riesgos declarados.
4. **Plan** `PLAN-003-adaptador-spec-011-por-olas.md` según la plantilla
   `templates/skevi/plan-de-implementacion.md`: T-01/T-02/T-03 con
   Consumes/Produce reales y un criterio de verificación por paso.
5. **Rondas adversariales R1 → R1d** con revisores de contexto fresco en
   sólo lectura, contra el repositorio real (registros y disposición de
   hallazgos en PLAN-003 §Rondas).

## 2. Rondas (resumen; el registro vivo está en PLAN-003 §Rondas)

| Ronda | Objeto | Veredicto | Hallazgos | Disposición |
|---|---|---|---|---|
| R1 | PROP-003 + PLAN-003 | fix-and-retry | 2 HIGH, 4 MED, 1 LOW | corregidos en `518ff2a` |
| R1b | paquete corregido | fix-and-retry | 1 HIGH, 1 MED, 2 LOW | corregidos en `8cb6f85` y cierre |
| R1c | delta `8cb6f85` | fix-and-retry | 1 HIGH, 2 MED, 1 LOW | corregidos en `cd89aa5` |
| R1d | delta `cd89aa5` | **proceed** | 3 LOW | cerrados en el commit de cierre (este informe) |

Hallazgos materiales que las rondas introdujeron al plan (ya incorporados):
matriz de **seis** celdas (Edge móvil contaba), **reloj inyectable**
`runtime = { schedule, cancelSchedule }` con validación fail-closed y caso
nuevo, **cascada completa del recorte** de parches (caso, prueba, fila y
total del índice), reconciliación de `estado.md` §2/§4/§6 en T-01,
**sonda P-05 aparte** (carga fresca sin activación), conteos por «todos
los casos declarados», y la frontera declarada como contrato y no como
`exports`.

## 3. Evidencia

- `npm run gate` sobre `12277f6` → check_sizes OK (95 archivos, ruta
  1577/1600), 66 del método, 159 de biblioteca [pass]
- `npm run gate` en cada commit de la rama (b893a0e, a4a5185, 518ff2a,
  8cb6f85, cd89aa5) → OK, sin BLOQ ni fails [pass]
- `npm run gate` sobre el árbol final de la Ola 0 (este commit) →
  check_sizes OK con **98 archivos** y ruta **1594/1600**, 66 del método,
  **159** de biblioteca [pass]
- `git ls-remote origin main` (antes de ramificar) → `12277f6` = HEAD
  local: sin divergencia [pass]
- Revisores R1–R1d con sus propias verificaciones (`grep`, `git show`,
  `check_sizes`, `npm test`) → registradas en cada reporte de ronda [pass]

## 4. Commits de la Ola 0

- `b893a0e` — docs(estado): deriva de reactivación (fecha, gate del día,
  tequio como segundo consumidor)
- `a4a5185` — docs(plans): PROP-003 y PLAN-003
- `518ff2a` — correcciones R1
- `8cb6f85` — ajustes R1b
- `cd89aa5` — ajustes R1c
- cierre — ajustes R1d + este informe + corrida del gate en estado.md §6

## 5. No cubierto por esta ola (declarado)

- Ninguna línea de `src/` ni de `tests/`: la Ola 0 es documental.
- La matriz de medición no existe; nada se ha medido en navegador.
- Nada se editó en tequio; su spec sigue sin declarar el consumo de
  lalia-akuo (deuda suya, reportada al coordinador).
- La Ola 1 (T-01) requiere orden nueva: es código y superficie pública.

## 6. Siguiente decisión recomendada

Autorizar la **Ola 1 (T-01)**: adaptador con dobles, enmienda de
SPEC-011 §Entradas (runtime), subentrada `./adapter`, volteo de SPEC-011
a implementada y reconciliación de estado, con su ronda adversarial.
En paralelo, del lado de tequio: declarar en su tabla de ecosistema el
consumo de lalia-akuo.

FIN ola-0 R1 7 hallazgos corregidos (2H/4M/1L) · R1b 4 (1H/1M/2L) · R1c 4 (1H/2M/1L) · R1d proceed con 3 LOW cerrados en el commit de cierre · gate final en verde (98 archivos, ruta 1594/1600, 66+159 pruebas)

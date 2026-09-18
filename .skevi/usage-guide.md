# Uso de Skevi en este proyecto

> Plantilla — reemplaza cada `<...>` con el dato real del proyecto. Borra
> cualquier sección que no aplique; no dejes placeholders sin llenar.

**Proyecto:** lalia-akuo
**Fase actual:** F2
**Procedencia de las plantillas:** registrada en `installed.json`
(esquema `skevi/template-install/v1`), en este mismo directorio (`.skevi/`)
una vez copiado — única fuente de verdad de qué se copió, de dónde y con
qué versión; no la dupliques aquí.

## Qué leer primero

1. `AGENTS.md` (o `CLAUDE.md`) en la raíz — punto de entrada, trae el
   bloque de registro que enlaza a este archivo.
2. `docs/ai-agent-guide/00-INDICE.md` — fases F0→F3 y reglas de aplicación.
3. `docs/estandar-diseno-software-github.md` — capa normativa transversal.

## Desviaciones de este proyecto respecto al estándar por defecto

Se declaran en `skevi-gate.json`, que es la fuente que lee el gate:

- límite de 870 líneas para `scripts/check_sizes.py`, que es la copia del
  gate y mide 867;
- exención por ruta de `.DS_Store` y de `docs/.DS_Store`;
- `required` con los archivos canónicos de este proyecto, incluidos el
  documento F0 y los del corpus adoptado;
- no se instalan los gates `check_plans.py` ni `check_reports.py`, y por eso
  `scripts/hooks/pre-push` es la versión recortada que corre sólo
  `check_sizes` y las pruebas: este proyecto todavía no tiene
  `docs/plans/` ni reportes de dos capas que verificar.

## Idiomas elegidos

Fuente normativa: estándar §3.1 (ADR-015, precisión ADR-029).

- Comunicación humana predeterminada: español.
- Producto: español primero; inglés después, sobre el mismo mecanismo de
  paquetes de idioma, que existe desde la primera versión (REQ-12).
- Comentarios/docstrings: español.
- Excepciones a identificadores nuevos en inglés: ninguna.

La preferencia de conversación no modifica estas elecciones persistentes.
Antes de fijar texto persistente, pregunta si falta la elección necesaria.

## Verificación local

```bash
python3 scripts/check_sizes.py         # estructura, tamaños y ruta de lectura
python3 -m unittest discover -s tests  # pruebas del gate
npm test                               # pruebas de la biblioteca
```

El conjunto es también `npm run gate`, y `scripts/hooks/pre-push` lo conecta
al push local con `git config core.hooksPath scripts/hooks`.

## Dónde están los ADRs y specs de F1

`docs/adr/` para las decisiones y `docs/product/definicion-tecnica.md` para
la definición técnica. El documento F0 es `docs/product/plan.md`.

## Drift contra el canon

Compara tus copias versionadas contra los manifiestos fuente de Skevi
(señal válida: la versión declarada, nunca el contenido). Para el corpus,
copia también el `docs/MANIFEST.json` del canon junto a estándar y guía:
es tu referencia de versión:

```bash
python3 <ruta-a-skevi>/scripts/check_templates.py --manifest <ruta-a-skevi>/templates/skevi/MANIFEST.json --installed .skevi/installed.json
python3 <ruta-a-skevi>/scripts/check_templates.py --manifest <ruta-a-skevi>/scripts/MANIFEST.json --installed .skevi/scripts-installed.json
python3 <ruta-a-skevi>/scripts/check_templates.py --manifest <ruta-a-skevi>/docs/MANIFEST.json --installed .skevi/corpus-installed.json
```

`<ruta-a-skevi>` es tu checkout local del origen (mismo uso que en la
sección "Verificación" del README de Skevi) — estos tres comandos viven
en el script de Skevi, no en tu proyecto; `.skevi/installed.json` y sus
pares sí son de tu proyecto.

**Qué significa `OK`.** El resultado compara tu registro contra la copia
**local** del manifest fuente que trajiste al `.skevi/` de este proyecto —
no consulta el origen en vivo. `OK` dice "coherente con esa copia local",
no "al día contra el repositorio de origen ahora mismo". Para saber si hay
una versión más nueva en el origen, actualiza esa copia local del manifest
deliberadamente (nueva lectura del origen, con su propia autorización si el
proyecto la exige) y vuelve a comparar.

## Gate de push (local) y gate en CI (opcional)

La activación local es config, no viaja con el clon — un clon fresco
pierde el gate de push en silencio si no la repites:

```bash
git config core.hooksPath scripts/hooks
```

Si tu proyecto usa GitHub Actions (u otro CI), puedes exigir el mismo gate
ahí en vez de depender sólo del hook local, que un `--no-verify` o un clon
sin configurar puede saltarse en silencio. El origen de Skevi hace esto
consigo mismo (ADR-034 en su propio repositorio, si tu origen es Skevi):
`.github/workflows/skevi-gate.yml` es un ejemplo real y copiable, pero no
copiable literal — fija Ubuntu 24.04 y una matriz de dos versiones de
Python sin paso de instalación de dependencias (asume stdlib, como los
gates de Skevi). Al adaptarlo:

- cambia la rama principal, el runner/SO si tu proyecto lo necesita, y los
  comandos por los de tu sección "Verificación local";
- si tu verificación sí tiene dependencias, añade el paso de instalación
  correspondiente — el ejemplo de Skevi no lo necesita porque sus gates
  son stdlib puro;
- decide explícitamente si vas a exigir **cada** job de la matriz por
  separado (uno por versión) o un solo **check agregado**; la protección
  de rama exige nombres de check concretos, y "gate en CI" sin esa
  decisión queda ambiguo.

**Copiar el workflow no exige nada por sí solo.** El check corre, pero
nadie está obligado a esperarlo hasta que:

1. lo pruebas con un **control positivo** — una violación deliberada del
   gate debe hacer fallar el CI por la razón esperada, no por otra;
2. lo marcas como **check requerido** en la protección de tu rama
   principal (configuración de tu hosting, no de este repositorio).

Sin esos dos pasos, el workflow es informativo, no un gate.

## Dependencias activas del ecosistema

- **AN-KLA Memory:** no instalada. Si se instala, el contrato
  `skevi/an-kla-integration` (guía `05` §6) hace obligatorias dos
  lecturas más por sesión material (`05` y `AN-KLA.md`): decláralas en
  `reading_path` de `skevi-gate.json` y sube el límite por decisión
  escrita (ADR-021, ADR-025), p. ej. límite 1400 con `05` y `AN-KLA.md`
  añadidas a `files`.
- Otras dependencias: ninguna. El gate y sus pruebas son biblioteca
  estándar de Python; la biblioteca no declara dependencias de ejecución.

## Plantilla opcional: árboles congelados

Si tu proyecto tiene código que no se edita en sitio (export de
generador, entrega de tercero, baseline sellado), copia también
`frozen-trees.md` a tu `.skevi/` y sigue sus instrucciones (ADR-033).

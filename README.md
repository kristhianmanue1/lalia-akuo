# lalia-akuo

Biblioteca de interacción por voz para la web, **agnóstica de dominio**: sirve
para armar formularios hablados y, más adelante, para conversar con agentes de
IA desde el navegador.

La biblioteca aporta **mecanismo**. El **consumidor aporta política**.

## La frontera

Es la razón de ser del proyecto: si las dos columnas se mezclan, la biblioteca
sirve para un solo dominio y pierde su valor.

| Es mecanismo de la biblioteca | Es política del consumidor |
|---|---|
| No persistir ni abrir red por su cuenta | Qué se guarda, dónde y por cuánto tiempo |
| Declarar lo que hace y lo que no | Qué datos son sensibles y con qué reglas |
| No guardar un valor sin confirmación explícita | Qué textos son intocables y quién los aprueba |
| Que el readback diga el valor que se va a guardar | Qué frases se pueden redactar y cuáles no |
| Cerrar los turnos por señal real, nunca por temporizador | Qué acciones se permiten en cada paso |
| Aplicar el filtro y la compuerta antes de hablar | Qué se filtra y qué clases se bloquean |

Aquí no vive ninguna regla de dominio, ningún dato personal y ninguna política
de retención. Si aparece una, es un defecto de este repositorio.

## Estado

| Fase | Qué es | Estado |
|---|---|---|
| F0 | Problema, resultado observable, requisitos y no objetivos | **PARCIAL** — `docs/product/plan.md`, con tres preguntas abiertas |
| F1 | Contratos del núcleo y fronteras | En curso — `docs/product/definicion-tecnica.md` |
| F2 | Cascarón que corre y pasa su verificador | En curso — método adoptado, gate verde |
| F3 | Ejecución y verificación por tarea | No empezada |

El documento F0 cierra con su bloque de reporte y declara lo que falta. **Nada
se construye sin cerrar F0**, y las tres preguntas abiertas están en su §8.

## Cómo se construye, se corre y se prueba

No hay paso de construcción: es JavaScript de módulos ES que corre tal cual en
el navegador y en Node, sin dependencias de ejecución.

```bash
npm test                               # pruebas de la biblioteca
python3 scripts/check_sizes.py         # estructura, tamaños y ruta de lectura
python3 -m unittest discover -s tests  # pruebas del gate
npm run gate                           # los tres, en orden
```

Requisitos del entorno, comprobados: Node v24.15.0, npm 11.12.1 y
Python 3.9.6. El gate y sus pruebas usan sólo la biblioteca estándar de
Python; la biblioteca no declara dependencias de ejecución.

Para conectar el gate al push local, una vez por clon:

```bash
git config core.hooksPath scripts/hooks
```

La activación es configuración local y no viaja con el clon: un clon fresco
pierde el gate de push en silencio si no se repite.

## Estructura

```text
lalia-akuo/
├── AGENTS.md            # punto de entrada para ejecutores automatizados
├── README.md            # este archivo: el contrato de arranque
├── LICENSE              # Apache-2.0
├── package.json         # manifiesto; sin dependencias de ejecución
├── skevi-gate.json      # límites, exenciones y archivos canónicos del gate
├── .skevi/              # adopción del método: registro de lo copiado y de dónde
├── docs/
│   ├── ai-agent-guide/  # método por fases F0→F3
│   ├── adr/             # decisiones aceptadas
│   ├── product/         # plan.md (F0) y definición técnica (F1)
│   ├── estandar-diseno-software-github.md
│   └── MANIFEST.json    # versión del corpus normativo adoptado
├── scripts/
│   ├── check_sizes.py   # el gate, copiado del canon de Skevi
│   └── hooks/pre-push   # el gate en el push local
├── src/                 # la biblioteca
├── templates/skevi/     # plantillas de adopción, copiadas del canon
└── tests/               # pruebas del gate y de la biblioteca
```

## Método

El proyecto adopta [Skevi](https://github.com/kristhianmanue1/skevi): una guía
por fases F0→F3 y un gate de estructura y tamaños. Lo adoptado se copió del
canon y **su procedencia está registrada**, con digest y versión, en `.skevi/`:

- `.skevi/installed.json` — plantillas;
- `.skevi/scripts-installed.json` — el gate;
- `.skevi/corpus-installed.json` — el corpus normativo (estándar y guía).

Lo que este proyecto cambió respecto al canon está declarado ahí y en
`skevi-gate.json`: se instaló `check_sizes.py` pero no `check_plans.py` ni
`check_reports.py`, porque todavía no hay planes de implementación ni reportes
de dos capas que verificar, y `scripts/hooks/pre-push` es la versión recortada
que corre sólo lo que existe.

## Qué no es

- No sustituye a los SDK de las plataformas de agentes.
- No es un motor de formularios general: no valida, no calcula y no resuelve
  campos condicionales; sólo la capa hablada y de confirmación.
- No implementa un modelo de IA ni un servidor MCP en su primera versión.
- No es el canal de voz de otro proyecto en producción.

El detalle está en `docs/product/plan.md` §6.

## Licencia

Apache-2.0. Ver `LICENSE`.

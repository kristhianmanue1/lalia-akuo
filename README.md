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
| F0 | Problema, resultado observable, requisitos y no objetivos | **Cerrada** — `docs/product/plan.md` |
| F1 | Contratos del núcleo y fronteras | **Cerrada** — `docs/product/definicion-tecnica.md` y sus cuatro hermanos |
| E1 | Contrato de comportamiento, caso por caso | **Escrita** — `docs/specs/`, 192 casos; índice en `docs/specs/00-INDICE.md` |
| Implementación | El núcleo, contra los casos de E1 | **En curso** — ocho de las once spec implementadas y probadas |

**Para retomar el trabajo, lee [`docs/estado.md`](docs/estado.md).** Ahí está el
estado spec por spec, los huecos declarados y cuál es el siguiente paso. Ese
archivo no es una promesa: la prueba de trazabilidad lo contrasta con lo que
hay probado de verdad, así que no puede quedarse atrás sin que la puerta lo
diga.

## Cómo se construye, se corre y se prueba

No hay paso de construcción: es JavaScript de módulos ES que corre tal cual en
el navegador y en Node, sin dependencias de ejecución.

```bash
npm test                # pruebas de la biblioteca
npm run gate            # los tres componentes, con Python >= 3.12 fijado
sh scripts/run-gate.sh  # lo mismo, sin npm
```

Requisitos del entorno: Node >= 18 (probado en v24.15.0) y Python >= 3.12
(probado en 3.12.12, el `.venv` del proyecto). El gate elige el venv si
existe y falla cerrado con un intérprete menor: el requisito no se degrada a
«cualquiera que haya». La biblioteca no declara dependencias de ejecución.

Para conectar el gate al push local, una vez por clon:

```bash
git config core.hooksPath scripts/hooks
```

La activación es configuración local y no viaja con el clon: un clon fresco
pierde el gate de push en silencio si no se repite.

## Consumo

El modo vigente es la **copia desde el repositorio**, sin registro de
paquetes (`ADR-010`): importa por ruta; cada commit copiado compila y pasa
sus pruebas. La entrada única es `src/index.js`.

```js
import { createVoiceSession, PACK_ES } from '<ruta-a-lalia-akuo>/src/index.js';

const session = createVoiceSession({
  fields: [{ id: 'peso', type: 'number', unit: 'kg', promptKey: 'form.peso' }],
  language: {
    pack: {
      language: 'es',
      texts: {
        ...PACK_ES.texts,
        'form.peso': '¿Cuánto pesas?',
        'form.peso.readback': 'Confirmas {value} {unit}.',
        'form.peso.saved': 'Guardado {value} {unit}.',
        'aviso.manual': 'Continúa por texto.',
      },
    },
  },
  policy: { degradation: { noticeKey: 'aviso.manual' } },
  onEvent(event) { /* el catálogo cerrado vive en schema/eventos.json */ },
});

await session.start();
```

La superficie pública completa, el ciclo de vida, las garantías y los
no-objectivos por canal están en el
[contrato de consumo](docs/product/contrato-de-consumo.md).

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
`check_reports.py` —los planes viven en `docs/plans/` y los reportes de dos
capas viajan en la conversación, sin verificación de script todavía—, y
`scripts/hooks/pre-push` delega en `run-gate.sh`, que corre los tres
componentes con el intérprete fijado.

## Qué no es

- No sustituye a los SDK de las plataformas de agentes.
- No es un motor de formularios general: no valida, no calcula y no resuelve
  campos condicionales; sólo la capa hablada y de confirmación.
- No implementa un modelo de IA ni un servidor MCP en su primera versión.
- No es el canal de voz de otro proyecto en producción.

El detalle está en `docs/product/plan.md` §6.

## Licencia

Apache-2.0. Ver `LICENSE`.

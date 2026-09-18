# ADR-001: Frontera entre mecanismo y política

**Estado:** aceptado. Implementación: no iniciada (F1 en diseño).
**Fecha:** 18-sep-2026.
**Fuente:** instrucción humana del 18-sep-2026; derivada de la fundación de
`lalia-akuo` y del análisis de `alubia:PROP-005 §4.1` y `§5.4`.

## Contexto

La biblioteca nace de extraer y generalizar la capa de voz de otro proyecto
(alubia). Ese proyecto resolvió, durante muchos ADR, políticas de su dominio:
qué se guarda, con qué retención, qué textos son intocables y qué contenido
no debe pronunciarse. Nada de eso es una propiedad técnica de una biblioteca
de voz: es la política de un consumidor concreto.

Si la biblioteca adopta esa política como contrato propio, sirve para un solo
dominio y arrastra las reglas de otro proyecto. Si en cambio la omite por
completo, deja al consumidor sin punto donde declararla y el vacío se llena
con un defecto silencioso.

## Decisión

La biblioteca aporta **mecanismo**; el consumidor aporta **política**, y la
declara por configuración. Son mecanismo de la biblioteca:

- no persistir ni abrir red por su cuenta, y declararlo;
- no guardar un valor sin confirmación explícita;
- que el readback diga el valor que se va a guardar;
- cerrar los turnos por señal real, nunca por temporizador;
- aplicar el filtro y la compuerta antes de hablar.

Son política del consumidor, y ninguno de estos puntos tiene valor por
defecto dentro de la biblioteca:

- qué se guarda, dónde y con qué retención;
- qué datos son sensibles y con qué reglas;
- qué textos son intocables y quién los aprueba;
- qué frases se pueden redactar y cuáles no;
- qué se filtra y qué clases se bloquean;
- qué acciones se permiten en cada paso.

## Alternativas descartadas

- **Heredar la política de alubia como defecto.** Convertiría la biblioteca
  en la biblioteca de un solo consumidor, y sus reglas de otro dominio
  regirían a terceros que nunca las aprobaron.
- **Política configurable con un defecto permisivo.** El defecto decidiría
  por el consumidor: permitir hablar todo lo que el consumidor no pensó en
  prohibir es una decisión de política tomada en silencio dentro del núcleo.
- **Deducir la política del corpus de alubia al migrar el código.** El
  corpus se lee como procedencia de diseño, no como fuente normativa.

## Consecuencias

- El núcleo no contiene literales de dominio, umbrales, textos intocables ni
  retenciones. Lo que el consumidor no declara no existe para la biblioteca.
- El corpus normativo de alubia se cita como **procedencia** y no se hereda
  como contrato (`docs/product/definicion-tecnica.md` §2.2).
- El punto donde el consumidor declara su política es una frontera con
  contrato propio (`docs/product/definicion-tecnica.md` §4.5).
- Qué hace el núcleo cuando falta una declaración de política que un paso
  exige quedó cerrado por derivación del fail-closed en F1: lo no declarado no
  se habla y la declaración exigida es obligatoria
  (`docs/product/definicion-tecnica.md` §9.3, pregunta A).
- Toda garantía que dependa de la política del consumidor se declara como
  tal: el núcleo no puede prometer lo que no gobierna.

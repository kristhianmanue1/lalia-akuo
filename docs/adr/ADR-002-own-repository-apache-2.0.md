# ADR-002: Repositorio propio con licencia Apache-2.0

**Estado:** aceptado. Implementación: parcial — el repositorio y `LICENSE`
existen; los nombres de paquete no están fijados.
**Fecha:** 18-sep-2026.
**Fuente:** instrucción humana del 18-sep-2026 (`alubia:PROP-005 §8`,
PREGUNTA-1).

## Contexto

La capacidad de voz existe hoy dentro de otro proyecto. Hay que decidir si el
trabajo nuevo vive en un repositorio propio o como carpeta de paquetes dentro
del proyecto existente. La decisión define licencia, integración continua,
versionado y si el proyecto existente arrastra el historial y los términos de
un producto que no es suyo.

## Decisión

Repositorio propio, `lalia-akuo`, con licencia **Apache-2.0**. Alubia pasa a
ser **consumidor externo**, no propietario del código.

## Alternativas descartadas

- **Carpeta `packages/` dentro de alubia.** Habría atado la licencia, el
  ciclo de publicación y el historial al proyecto consumidor, y la extracción
  no habría sido verificable como tal: el consumidor no puede probar contra
  su propio directorio que la dependencia es externa.
- **Monorepo con historial compartido.** El historial de alubia contiene
  material de su dominio y de su política; publicarlo como herencia del
  repositorio nuevo mezcla procedencia con contrato.

## Consecuencias

- La licencia permite uso comercial y redistribución con aviso de cambios;
  el proyecto no queda copyleft ni obligado a publicar derivados.
- El ciclo de publicación, el versionado y la integración continua son
  propios y no dependen de las decisiones de alubia.
- Alubia consume la biblioteca como dependencia externa; su adopción es la
  prueba de extracción (`E6-03` de `alubia:PROP-005 §9`).
- El corpus normativo de alubia no rige este repositorio ni al contrario.
- Los **nombres de los paquetes** y el nombre publicado no están fijados:
  corresponden a la tarea de fundación del proyecto y quedan fuera de este
  ADR. Este documento cita las piezas por su rol.

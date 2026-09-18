# ADR-010: Distribución por copia y sin registro de paquetes

**Estado:** aceptado. Implementación: no iniciada — la etapa de distribución
empieza cuando exista algo que copiar.
**Fecha:** 18-sep-2026.
**Fuente:** instrucción humana del 18-sep-2026, respuestas textuales «alubia
copia mientras madura, tiempo estimado 3 meses, después evaluar» y «sólo
repositorio mientras no haya consumidores fuera», registradas en el F0
(`docs/product/plan.md` §8, RESPUESTA-2 y RESPUESTA-3, y `REQ-15`).

## Contexto

El proyecto nace para que otro proyecto lo consuma, así que hay que decidir
cómo: como dependencia desde el primer día o con una copia mientras el núcleo
se estabiliza; y si se publica en un registro de paquetes.

Una dependencia exige una frontera estable y una política de compatibilidad
antes de haber probado la API con un consumidor real. Publicar en un registro
añade versionado semántico público y notas de release para consumidores que
todavía no existen. Copiar difiere el problema, pero duplica mantenimiento y
abre la puerta a la divergencia.

## Decisión

- El primer consumidor **copia** el código mientras el proyecto madura, con
  una **revisión estimada a los 3 meses** para decidir si pasa a consumirlo
  como dependencia desde el repositorio.
- Mientras no haya consumidores fuera de este autor, **no se publica en
  ningún registro de paquetes**.

## Alternativas descartadas

- **Dependencia desde el repositorio desde el primer día.** Obliga a fijar la
  superficie pública y su compatibilidad antes de haber probado la API con un
  consumidor real: cada error de diseño se paga como versión.
- **Copia permanente, sin revisión.** Difiere el problema y duplica el
  mantenimiento para siempre; sin fecha de salida, la divergencia deja de ser
  una etapa y pasa a ser el estado.
- **Publicar en un registro.** Añade versionado semántico público, notas de
  release y guía de migración para consumidores que no existen; el estándar
  §5.5 lo exige por release, y no hay release que publicar.

## Consecuencias

- **Una copia es una instantánea.** La superficie pública tiene que ser
  **pequeña y estable por commit** mientras dure esta etapa: lo copiado no se
  actualiza solo, se importa por ruta del repositorio —así que no puede
  depender de un paso de publicación—, y cada commit copiado tiene que ser
  utilizable, compilando y pasando sus pruebas (estándar §5.4).
- **No hay resolución automática de versiones.** Un cambio incompatible en
  esta etapa no lo detecta ningún gestor de paquetes: rompe al consumidor que
  copió. Se documenta con guía de migración (estándar §5.5) cuando ocurra.
- **La revisión de los 3 meses es una tarea con fecha, no una intención.** Su
  fecha exacta queda pendiente de declarar
  (`docs/product/definicion-tecnica.md` §9.3, PREGUNTA-I); es la que abre el
  segundo tramo: dependencia desde el repositorio, versionado semántico
  público y guía de migración.
- **No nace todavía la obligación de versionado semántico público**, porque no
  hay release que publicar; cuando los haya, el estándar §5.5 sigue rigiendo
  para ellos.
- **El «paquete» de idioma es un módulo del repositorio**, con interfaz
  estable: sin registro, la sustituibilidad que exige `REQ-12` se prueba con
  un módulo de sustitución, no con una publicación.
- **La divergencia entre la copia y el original se arbitra con un ADR**, no
  con una nota al pie: una divergencia silenciosa deja dos implementaciones de
  la misma disciplina de turno, que es exactamente lo que la extracción venía
  a evitar.
- **El consumo sigue siendo desde el repositorio**, como exige `REQ-15`: el
  modo vigente durante la maduración es la copia, y el criterio de un
  consumidor que lo instala desde el repositorio rige desde la revisión de los
  3 meses.

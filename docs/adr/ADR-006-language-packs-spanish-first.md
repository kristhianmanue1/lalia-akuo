# ADR-006: Paquetes de idioma, español primero

**Estado:** aceptado. Implementación: no iniciada (F1 en diseño).
**Fecha:** 18-sep-2026.
**Fuente:** instrucción humana del 18-sep-2026 (`alubia:PROP-005 §8`,
PREGUNTA-5).

## Contexto

El primer consumidor trabaja en español de México. La biblioteca aspira a ser
reutilizable por otros proyectos y por otros idiomas, y la experiencia del
proyecto de origen muestra que la interpretación de voz no es solo texto:
hay gramática numérica, léxico de control, unidades y rangos.

Se puede publicar solo el idioma del primer consumidor y aplazar el resto, o
publicar dos idiomas desde el inicio. La primera opción arriesga que la lógica
de idioma quede dentro del núcleo y que añadir otro idioma obligue a
reescribirlo; la segunda duplica implementación sin consumidor que la use.

## Decisión

**Español primero, inglés después.** El **mecanismo de paquetes de idioma
existe desde el día uno**: el núcleo no contiene literales, gramática ni
léxico de ningún idioma, y todo eso llega por un paquete de idioma. La primera
versión incluye exactamente un paquete, en español.

## Alternativas descartadas

- **Solo el idioma del primer consumidor, sin mecanismo.** El texto y el
  léxico quedarían dentro del núcleo; el segundo idioma exigiría reescribirlo,
  que es el coste que esta decisión evita.
- **Dos idiomas en la primera versión.** Duplica gramática numérica y léxico
  de control sin consumidor real que los pruebe, y multiplica la superficie
  que hay que mantener estable antes de tener adopción.
- **Traducir el paquete de español para obtener el inglés.** Los patrones
  numéricos y el léxico de control de cada idioma son implementaciones
  distintas, no traducciones de las del otro.

## Consecuencias

- El núcleo debe poder probarse con un paquete de idioma de sustitución sin
  modificarse: es el criterio de que el mecanismo existe de verdad.
- Todo texto visible al usuario sale del catálogo por clave; nada se escribe
  como literal dentro del núcleo.
- El paquete inglés, cuando llegue, es una etapa propia con sus pruebas por
  entrada de léxico, no una traducción de la etapa de español.
- La forma de distribución del paquete y la cobertura de los controles de la
  interfaz quedaron cerradas por derivación —módulo del repositorio, y todo
  texto visible por clave del catálogo—; la etiqueta concreta del idioma y el
  comportamiento con una clave ausente son decisiones técnicas de E1
  (`docs/product/definicion-tecnica.md` §9.3, preguntas C y D).

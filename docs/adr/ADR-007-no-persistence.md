# ADR-007: Sin persistencia, ni la mínima

**Estado:** aceptado. Implementación: no iniciada (F1 en diseño).
**Fecha:** 18-sep-2026.
**Fuente:** instrucción humana del 18-sep-2026 (`alubia:PROP-005 §8`,
PREGUNTA-6).

## Contexto

Una biblioteca de captura hablada tiene, en apariencia, razones para guardar
algo: reanudar tras una recarga, recordar el valor previo para comparar,
llevar el rastro de la sesión. En el proyecto de origen, la política de
confirmación depende de leer el último valor guardado, y esa dependencia es
justamente lo que ata la capa de voz al esquema de persistencia del dominio.

Guardar datos convierte a la biblioteca en custodio de información ajena y la
obliga a decidir retención, borrado y sensibilidad: decisiones que pertenecen
al consumidor y a su marco legal.

## Decisión

La biblioteca **no persiste**, ni la mínima. No escribe en almacenamiento del
navegador, ni en archivos, ni en memoria entre sesiones, y lo declara.

El dato previo, cuando un paso lo necesita, llega por **función inyectada por
el consumidor**. Sin esa función no hay comparación con el valor anterior, y
el núcleo lo declara en vez de fallar en silencio.

## Alternativas descartadas

- **Persistencia mínima interna.** Convierte a la biblioteca en custodio de
  datos del consumidor y le exige decidir política que no le corresponde: la
  retención de datos de otra persona no es un detalle de implementación.
- **Persistencia opcional incluida.** Aunque fuera desactivable, traería
  esquema, migraciones y borrado al alcance de la biblioteca, y con ellos la
  obligación de sostenerlos.
- **Sin dato previo en absoluto.** Si el consumidor no puede inyectar el
  valor anterior, la confirmación pierde una de sus comprobaciones; la
  decisión mantiene el dato como entrada, no como almacenamiento.

## Consecuencias

- La biblioteca no ofrece historial, reanudación propia tras recarga ni
  cuota; tampoco puede ofrecer auditoría por sí sola.
- El rastro de lo ocurrido en una sesión solo existe si el consumidor conecta
  un destino para los eventos de sesión; el núcleo lo exige declarar, en vez
  de prometer un rastro que no guarda.
- La continuidad de una sesión entre recargas, cuando exista, la custodia el
  consumidor —su servidor, en el canal de agente— y no la página ni la
  biblioteca.
- La comparación contra el valor anterior es una capacidad opcional del
  consumidor, no una garantía del núcleo.

# ADR-011: Compatibilidad por ventana de tiempo, no por lista de versiones

**Estado:** aceptado. Implementación: no iniciada — la política no bloquea
ninguna etapa; se aplica cuando hay una publicación a la que aplicarla.
**Fecha:** 18-sep-2026.
**Fuente:** instrucción humana del 18-sep-2026, respuesta textual «no sé de
versiones pero retrocompatible hasta 4 años sería bueno pero no quiero sea
bloqueante». Cierra `PREGUNTA-H` (`docs/product/definicion-tecnica.md` §9.3)
y resuelve la parte que `ADR-009` dejó sin decidir: las versiones mínimas de
cada motor.

## Contexto

El F0 y `ADR-009` fijaron los navegadores objetivo —Safari, Chrome y Edge,
en móvil y escritorio— y dejaron abierto el **piso de versiones** por motor.
Elegir números de versión obliga a sabérselos, a revisarlos en cada
publicación y a declarar una lista que envejece por silencio: cuando ya nadie
la mira, sigue escrita y ha dejado de significar algo.

El humano no eligió números, y no hace falta que lo haga. Lo que pidió es
retrocompatibilidad de hasta cuatro años que **no bloquee** ninguna etapa.
`REQ-18` exige los parches obligatorios por motor y una prueba por parche; no
exige ningún número de versión.

## Decisión

La compatibilidad se define por una **ventana de tiempo móvil**, no por una
lista de versiones.

- **La ventana es el criterio.** Un motor entra en el objetivo si su primera
  versión estable se publicó dentro de los **cuatro años anteriores a la
  fecha de publicación** de la versión de lalia-akuo en cuestión. La ventana
  se mueve con cada publicación: no envejece por silencio.
- **La fecha concreta se deriva, no se decide a mano.** En cada publicación
  se fijan los números que la ventana implica en esa fecha y se anotan **como
  consecuencia de la política**, con la fecha de derivación. Así nadie tiene
  que saberse versiones y el piso no se queda obsoleto.
- **No bloquea nada.** Ninguna etapa espera a esta política: no bloquea el
  cierre de E3, ni la implementación, ni la publicación. Es un criterio que
  se aplica cuando hay una publicación a la que aplicarlo.
- **La lista de parches no depende de la ventana.** `SPEC-011` fija los
  catorce parches por **síntoma y condición**, nunca por versión. La ventana
  puede **recortar** esa lista cuando la medición lo demuestre, y **nunca
  alargarla por suposición**.
- **La declaración pública de compatibilidad lleva su estado de medición.**
  Una versión publicada puede declarar el objetivo —los motores de los
  últimos cuatro años— y, junto a él, qué se ha medido y qué no. Lo que no
  puede declarar es «funciona en X» sin haberlo medido: ése es el defecto que
  este proyecto existe para evitar. No bloquear por no medir no autoriza a
  afirmar sin medir.

Ejemplo de la derivación, con fechas y sin versiones: una versión publicada
el 1 de enero de 2030 alcanza los motores cuya primera versión estable
apareció el 1 de enero de 2026 o después. La fecha es de ejemplo; lo que se
deriva en un caso real es la fecha, nunca una lista de números.

## Alternativas descartadas

- **Lista fija de versiones.** Es la opción que obliga a saberse números y a
  mantenerlos; envejece por silencio —la lista sigue escrita cuando ya nadie
  la revisa— y no es lo que se pidió.
- **Sólo la versión vigente al publicar.** Convierte cada publicación en una
  promesa de un día: obliga a subir el piso en cada release y descarta a
  quien no actualiza, que es justo a quien una retrocompatibilidad de cuatro
  años quiere cubrir.
- **Cualquier navegador con la API presente.** Ya descartada en `ADR-009`:
  la presencia de la API no dice si la voz es usable y convierte la
  compatibilidad en una promesa que nadie mide. La misma razón vale aquí.

## Consecuencias

- **El piso de versiones deja de ser una pregunta sin responder.** `ADR-009`
  dejó abiertas «las versiones mínimas» por motor; esta política las resuelve
  por derivación en cada publicación. Con ello `PREGUNTA-H` queda cerrada.
- **Nada la espera.** No es requisito de entrada de ninguna etapa: el cierre
  de E3, la implementación y la publicación no dependen de ella.
- **No declara compatibilidad.** Declara el **objetivo**: los motores de los
  últimos cuatro años. La compatibilidad la sigue declarando la matriz medida
  (`ADR-009`), navegador por navegador y con su registro de evidencia; esta
  política añade que esa declaración lleva siempre su estado de medición.
- **El piso derivado deja rastro.** Cada publicación anota los números que la
  ventana implica en su fecha, con la fecha de derivación y la referencia a
  esta política, y no como una decisión nueva.
- **La lista de parches sólo se acorta por evidencia.** `SPEC-011` no se
  reescribe por la ventana: un parche sale de la lista cuando la medición
  muestre que su motor quedó fuera del objetivo, y ninguno entra por
  suposición.
- **No se ramifica por versión ni por cadena de agente de usuario.** Sigue
  vigente el criterio del adaptador: los parches se seleccionan por capacidad
  observada (`SPEC-011`).

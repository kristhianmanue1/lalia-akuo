# ADR-009: Navegadores objetivo — Safari, Chrome y Edge

**Estado:** aceptado. Implementación: parcial — la decisión existe; los
parches obligatorios y su matriz todavía no.
**Fecha:** 18-sep-2026.
**Fuente:** instrucción humana del 18-sep-2026, respuesta textual
«navegadores safari, chrome y edge», registrada en el F0
(`docs/product/plan.md` §8, RESPUESTA-1, y `REQ-18`).

## Contexto

La capa de voz vive sobre la API de voz del navegador, y el proyecto nace de
un corpus de parches de plataforma descubiertos en WebKit móvil
(`alubia:PROP-005 §3`). Sin navegadores declarados no se puede decidir qué
parches son obligatorios, qué compatibilidad se promete al consumidor ni de
qué tamaño es la matriz de pruebas. El F0 lo dejó como pregunta abierta y
esperaba que F1 fijara las versiones.

El humano eligió **navegadores**, no números de versión.

## Decisión

Safari, Chrome y Edge son los navegadores objetivo, **en móvil y en
escritorio**. Un parche de plataforma es obligatorio cuando el motor que lo
motivó es objetivo declarado, y cada parche obligatorio lleva su prueba, de
modo que quitarlo ponga una prueba en rojo (`REQ-18`).

## Alternativas descartadas

- **Sólo Chrome de escritorio.** Reduce el alcance y con él el valor: deja
  fuera el motor cuyos parches son el activo que justifica la extracción.
- **Tratar los tres navegadores como tres objetivos independientes.**
  Multiplica la matriz y su mantenimiento sin cambiar una línea de código,
  porque dos de los tres comparten motor.
- **Cualquier navegador con la API presente.** La presencia de la API no dice
  si la voz es usable; el propio proyecto prohíbe declarar compatibilidad por
  presencia de API, y esa vía convertiría la matriz en una promesa que nadie
  mide.

## Consecuencias

- **Tres navegadores, dos motores.** Chrome y Edge comparten Chromium/Blink:
  comparten parches y una sola entrada de matriz. Safari es WebKit y lleva la
  suya. El alcance real de ingeniería es de dos motores.
- **Los parches de WebKit dejan de ser opcionales.** Pasan de «los parches que
  hay que escribir» a requisito de un navegador objetivo, con una prueba por
  parche.
- **La matriz de pruebas se organiza por motor**, con los tres navegadores
  como casos. La medición en dispositivo sigue siendo por navegador, porque el
  motor no determina qué voces ni qué red usa el dispositivo: el aviso de que
  el audio puede procesarse fuera de él sigue vigente.
- **La plataforma cubierta es móvil y escritorio**, decidida por el humano el
  18-sep-2026. Consecuencia: los parches de WebKit móvil siguen siendo
  obligatorios —la plataforma que los motiva está dentro— y la matriz cubre los
  tres navegadores en las dos plataformas, por motor.
- **Queda sin decidir, y no se resuelve por supuesto:** las **versiones
  mínimas** de cada motor. F1 no tiene evidencia para elegir números; el piso
  se fija con la matriz medida (`E3-05`), y hasta entonces no se declara
  compatibilidad.
- Declarar un navegador objetivo **no** declara compatibilidad: eso lo hará la
  matriz medida, navegador por navegador y con su registro de evidencia.

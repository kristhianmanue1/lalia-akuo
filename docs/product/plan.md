# plan.md — F0 de lalia-akuo

**Propósito:** cerrar el problema y los requisitos antes de diseñar. Este
documento es la entrada de F1; no contiene diseño ni código.
**Estado:** F0 **OK** — cerrado el 18 de septiembre de 2026. El problema, el
resultado observable y los requisitos están cerrados con fuente, y las tres
preguntas que quedaban abiertas las respondió el humano el mismo día (§8).
**Fecha:** 18 de septiembre de 2026
**Fuente principal:** `PROP-005` (tres partes) del proyecto `alubia`, citado
como **procedencia**. Este proyecto no hereda sus contratos: ver §7.

## 1. Problema

Hoy no existe una biblioteca de voz para la web que sirva a cualquier dominio
sin arrastrar las reglas de un dominio concreto. La capacidad está escrita
dentro de una aplicación, atada a su vocabulario, a su almacén y a su
identidad de módulo.

## 2. Resultado observable

Una persona que hoy no puede resolverlo podrá **añadir voz a una página web
declarando sus campos, sus rangos y sus textos**, sin escribir código de
reconocimiento ni de síntesis, **y con la garantía de que la biblioteca no
guarda un valor sin confirmación explícita, no persiste y no abre red por su
cuenta** — de modo que quien la integra pueda demostrarlo ante un tercero
señalando la frontera de §7, no confiando en la palabra de la biblioteca.

Segundo resultado, con su propio gate: el mismo proyecto ofrece un **canal de
agente** por el que un agente externo envía mensajes al navegador, el navegador
los habla y la persona contesta con su micrófono, con la interfaz mínima de
conversación.

## 3. Clasificación de la tarea

**Architectural.** El trabajo crea el proyecto, define contratos públicos y
extiende un plan de implementación; cualquier de esas tres cosas basta para
esta clase por sí sola.

## 4. Fuentes

| Clase | Fuente | Uso |
|---|---|---|
| Autoridad | instrucción directa del humano del 18-sep-2026, con las siete decisiones del §8 | define requisitos |
| Autoridad | `AGENTS.md` y `docs/estandar-diseno-software-github.md` de este repositorio | define el método |
| Evidencia | repositorio `alubia`, en `docs/proposals/PROP-005-*.md` y en su código bajo `app/js/` | verifica afirmaciones técnicas |
| Evidencia | comandos ejecutados en este entorno, registrados como `EV-*` en §9 | verifica el entorno |
| Referencia | especificación de MCP, Web Speech API, documentación de navegadores | informa decisiones; no define requisitos |

`PROP-005` pertenece a otro proyecto. Es **evidencia y procedencia**, nunca
autoridad sobre este repositorio.

## 5. Requisitos

### 5.1 Núcleo determinista

```text
REQ-1 [funcional] [fuente: PROP-005 §5.1 OBJ-1]
Enunciado: el núcleo conduce un turno completo de voz —preguntar, escuchar,
  interpretar, confirmar— sin depender del DOM.
Criterio de aceptación: el núcleo corre bajo un runner de pruebas sin
  documento ni navegador, y un turno de prueba llega a su desenlace.
Prioridad: imprescindible

REQ-2 [funcional] [fuente: PROP-005 §3, pieza 1]
Enunciado: hablar devuelve una de tres clases de resultado, y sólo el cierre
  real encadena el paso siguiente.
Criterio de aceptación: con una locución cancelada y con una locución
  interrumpida, el paso siguiente no se ejecuta en ningún caso.
Prioridad: imprescindible

REQ-3 [funcional] [fuente: PROP-005 §3, pieza 3]
Enunciado: cada turno lleva token, estado esperado e identificador monotónico,
  y un resultado tardío, cancelado o de otro estado no altera nada.
Criterio de aceptación: inyectando un resultado de un turno ya cerrado, el
  estado observable no cambia.
Prioridad: imprescindible

REQ-4 [funcional] [fuente: PROP-005 §3, pieza 4]
Enunciado: la política de confirmación es una decisión enumerada que el
  consumidor configura, no una cadena de condiciones dispersas.
Criterio de aceptación: cada valor de la enumeración es alcanzable desde las
  pruebas, y ninguno deja el turno en un estado del que no se salga.
Prioridad: imprescindible

REQ-5 [funcional] [fuente: PROP-005 §3, pieza 5]
Enunciado: las frases de control se clasifican contra un léxico externo y un
  umbral de confianza configurable.
Criterio de aceptación: con confianza por debajo del umbral, la frase no
  cambia el estado y queda registrada como no reconocida.
Prioridad: deseable

REQ-6 [funcional] [fuente: PROP-005 §5.1 OBJ-2]
Enunciado: los formularios hablados son declarativos: campos, tipos, rangos,
  unidades y textos los aporta el consumidor.
Criterio de aceptación: dos consumidores con campos distintos usan la misma
  biblioteca sin tocar su código.
Prioridad: imprescindible

REQ-7 [funcional] [fuente: PROP-005 §5.1 OBJ-7]
Enunciado: la biblioteca no guarda un valor sin confirmación explícita, y el
  readback dice el valor que se va a guardar.
Criterio de aceptación: sin confirmación, no se emite la señal de guardado; la
  señal incluye el valor exacto que el readback dijo.
Prioridad: imprescindible

REQ-8 [funcional] [fuente: PROP-005 §5.1 OBJ-6]
Enunciado: la degradación a captura manual es parte del flujo, no un error.
Criterio de aceptación: negando el permiso de micrófono y sin conexión, el
  flujo termina por entrada manual y nunca declara éxito de voz.
Prioridad: imprescindible

REQ-9 [funcional] [fuente: PROP-005 §5.1 OBJ-4]
Enunciado: la interfaz mínima de conversación ofrece iniciar, silenciar,
  escribir y un estado de escucha visible.
Criterio de aceptación: los cuatro controles existen, y el estado de escucha
  es perceptible sin oír.
Prioridad: imprescindible
```

### 5.2 Fronteras y restricciones

```text
REQ-10 [restricción] [fuente: PROP-005 §5.4 y §4.4]
Enunciado: ninguna política de dominio vive en la biblioteca. Los rangos, los
  textos intocables, qué se filtra y qué se persiste los aporta el consumidor.
Criterio de aceptación: un consumidor de otro dominio integra la biblioteca
  sin editar ningún archivo de ella, y hay una prueba que lo demuestra con
  dos configuraciones de dominio distintas.
Prioridad: imprescindible

REQ-11 [restricción] [fuente: PROP-005 §5.4]
Enunciado: la biblioteca no persiste, no abre red ni registra por su cuenta, y
  lo declara.
Criterio de aceptación: con la red y el almacenamiento instrumentados, un
  turno completo no produce ninguna llamada de red ni ninguna escritura, y la
  declaración de qué hace y qué no es legible por el consumidor sin leer el
  código.
Prioridad: imprescindible

REQ-12 [restricción] [fuente: decisión 5 del §8]
Enunciado: existe un mecanismo de paquetes de idioma desde la primera versión,
  con español como primer paquete; el inglés entra después sin reescribir el
  núcleo.
Criterio de aceptación: sustituir el paquete de idioma por otro de prueba
  cambia todos los textos hablados sin tocar el núcleo, y la prueba lo
  comprueba en las dos direcciones.
Prioridad: imprescindible

REQ-13 [restricción] [fuente: decisión 7 del §8]
Enunciado: la primera versión no implementa ningún modelo de IA, pero deja los
  puertos por los que un modelo entraría después sin rehacer el núcleo.
Criterio de aceptación: el modo determinista es el de omisión; los puertos
  están declarados; y un doble de prueba que ocupe el puerto asistido no
  obliga a cambiar ninguna firma del núcleo.
Prioridad: imprescindible

REQ-14 [restricción] [fuente: decisiones 2, 3 y 4 del §8]
Enunciado: el canal de agente no entra en la primera versión y el servidor MCP
  no entra como dependencia de la biblioteca.
Criterio de aceptación: la biblioteca compila, corre y pasa sus pruebas sin
  ninguna pieza del canal de agente instalada.
Prioridad: imprescindible

REQ-15 [restricción] [fuente: decisión 1 del §8 y RESPUESTA-3]
Enunciado: el proyecto se distribuye con licencia Apache-2.0 y se consume
  desde otro proyecto sin publicar en un registro de paquetes, mientras no
  haya consumidores fuera de este autor.
Prioridad: imprescindible
Criterio de aceptación: un consumidor externo instala la biblioteca desde su
  repositorio y ejecuta el caso de uso de §2 con las instrucciones del README.

REQ-18 [restricción] [fuente: RESPUESTA-1 del §8]
Enunciado: Safari es navegador objetivo en móvil y en escritorio, y con él los
  parches de motor que hacen usable la voz en WebKit; Chrome y Edge también lo
  son, sobre el mismo motor entre ellos.
Criterio de aceptación: cada parche obligatorio tiene su prueba, de modo que
  quitarlo ponga una prueba en rojo.
Prioridad: imprescindible
```

### 5.3 No funcionales

```text
REQ-16 [no-funcional] [fuente: PROP-005 §5.1 OBJ-6]
Enunciado: accesible por defecto: teclado, lector de pantalla, movimiento
  reducido y contraste suficiente.
Criterio de aceptación: el flujo completo se completa sólo con teclado y con
  un lector de pantalla, sin oír la síntesis y sin usar el micrófono;
  registro de la comprobación como evidencia.
Prioridad: imprescindible

REQ-17 [no-funcional] [fuente: PROP-005 §4.1]
Enunciado: el agente, cuando exista, no puede saltarse por contrato la
  validación del núcleo: propone texto y acción siguiente, y el núcleo decide
  si esa transición es válida.
Criterio de aceptación: con el puerto asistido devolviendo una transición
  inválida, el núcleo la rechaza y el flujo sigue siendo el determinista.
Prioridad: imprescindible
```

## 6. No objetivos

- Sustituir a los SDK de las plataformas de agentes.
- Ser un motor de formularios general: validación, campos condicionales y
  cálculos quedan fuera; sólo la capa hablada y de confirmación.
- Convertirse en el canal de voz de `alubia` en producción: `alubia` no adopta
  el canal de agente y su primera versión sigue determinista.
- Implementar un modelo de IA o el servidor MCP en la primera versión.
- Reconocimiento de voz en servidor, WebRTC, WebMCP, multiusuario, salas
  concurrentes, cuentas y facturación.
- Decidir por el consumidor: ninguna regla de dominio, ninguna retención y
  ningún texto intocable viven aquí.

## 7. La frontera, en una tabla

Es la razón de ser del proyecto. Confundir las dos columnas lo reduciría a
servir a un solo dominio.

| Es **mecanismo** de la biblioteca | Es **política** del consumidor |
|---|---|
| No persistir ni abrir red por su cuenta | Qué se guarda, dónde y por cuánto tiempo |
| Declarar lo que hace y lo que no | Qué datos son sensibles y con qué reglas |
| No guardar un valor sin confirmación explícita | Qué textos son intocables y quién los aprueba |
| Que el readback diga el valor que se va a guardar | Qué frases se pueden redactar y cuáles no |
| Cerrar los turnos por señal real, nunca por temporizador | Qué acciones se permiten en cada paso |
| Aplicar el filtro y la compuerta antes de hablar | Qué se filtra y qué clases se bloquean |

El corpus de `alubia` —sus ADR, sus specs y sus reglas de minimización— se cita
aquí como **de dónde viene el diseño**. Este proyecto hereda las propiedades
técnicas que las hacen posibles, no las decisiones.

## 8. Decisiones cerradas

**Siete decisiones** por instrucción humana del 18-sep-2026, registradas como
ADR en F1: repositorio propio con Apache-2.0 y `alubia` como consumidor
externo; el canal de agente entra después del núcleo; interfaz de transporte
más un relay de referencia que no es producto; sin servidor MCP en la primera
versión; español primero e inglés después sobre un mecanismo de paquetes de
idioma; sin persistencia; y sin modelo de IA, pero con sus puertos desde el
día uno.

**Cerradas por el humano el 18-sep-2026.** Las tres preguntas que quedaban
abiertas, con su respuesta textual:

```text
RESPUESTA-1: «navegadores safari, chrome y edge» y, al precisar la
  plataforma, «móvil y escritorio»
Consecuencia: los parches de WebKit pasan a ser obligatorios, porque Safari es
  objetivo declarado y es el motor que los motivó. Chrome y Edge comparten
  motor (Chromium/Blink), así que el alcance real son dos motores y tres
  navegadores, en las dos plataformas. Las versiones mínimas concretas no
  venían en esta respuesta —el humano no dio números— y ese resto quedó
  cerrado el mismo 18-sep-2026 por su política de compatibilidad, registrada
  en `docs/adr/ADR-011-compatibility-window.md`.
Registrada en: docs/adr/ADR-009-browser-targets.md

RESPUESTA-2: «alubia copia mientras madura, tiempo estimado 3 meses, después
  evaluar»
Consecuencia: durante esa etapa el primer consumidor mantiene una instantánea,
  así que la superficie pública del núcleo tiene que ser pequeña y estable por
  revisión. La revisión es una tarea con fecha, no una intención: **el 30 de
  diciembre de 2026**, que el humano fijó el mismo 18-sep-2026.
Registrada en: docs/adr/ADR-010-distribution-and-first-consumer.md

RESPUESTA-3: «sólo repositorio mientras no haya consumidores fuera de él»
Consecuencia: no se publica en ningún registro de paquetes, y con ello no nace
  todavía la obligación de versionado semántico público. Es coherente con el
  REQ-15, que exige consumo desde el repositorio.
Registrada en: docs/adr/ADR-010-distribution-and-first-consumer.md
```

Con estas tres respuestas, la lista de preguntas abiertas de F0 queda vacía.
Las que F1 mantenga por su cuenta viven en su propia definición técnica.

## 9. Evidencia del entorno

```text
EV-1: el repositorio remoto existe, es público y su licencia es Apache-2.0
  | gh api repos/kristhianmanue1/lalia-akuo → PUBLIC, apache-2.0 [pass]
EV-2: el clon local está sincronizado con el remoto
  | git log → un único commit, 4fd8bf7 Initial commit [pass]
EV-3: el contenido previo del repositorio es sólo la licencia
  | gh api .../contents → un archivo, LICENSE [pass]
EV-4: versión del runtime de JavaScript disponible
  | node --version → v24.15.0; npm --version → 11.12.1 [pass]
EV-5: versión de Python disponible para el gate del método
  | python3 --version → Python 3.9.6 [pass]
EV-6: el gate de estructura y tamaños corre en este proyecto
  | python3 scripts/check_sizes.py → BLOQ al 18-sep por falta de AGENTS.md y
  README.md, y por el límite del propio check_sizes.py; los tres se resuelven
  en F2 [pass: el gate detecta lo que debe detectar]
EV-7: el idioma humano y los idiomas del producto
  | elección del humano del 18-sep-2026 → español como idioma humano y como
  primer idioma del producto; inglés después sobre el mismo mecanismo [pass]
EV-8: los navegadores objetivo, la plataforma y el modo de distribución
  | instrucción directa del humano del 18-sep-2026 → Safari, Chrome y Edge, en
  móvil y escritorio; el primer consumidor copia con revisión el 30 de
  diciembre de 2026; sólo repositorio mientras no haya consumidores fuera [pass]
```

## 10. Reporte de fase

```text
FASE F0: OK
Gate: problema y resultado observable en una frase; REQ-* con fuente,
  criterio y prioridad; no objetivos; restricciones y entorno confirmados por
  evidencia; y preguntas abiertas respondidas.
Evidencia:
- gh api repos/kristhianmanue1/lalia-akuo → existe, público, Apache-2.0 [pass]
- git log → 4fd8bf7 Initial commit; un solo archivo versionado [pass]
- node --version → v24.15.0; python3 --version → 3.9.6 [pass]
- python3 scripts/check_sizes.py → OK, 53 archivos dentro de límites, el gate
  y su hook en verde [pass]
- instrucción del humano del 18-sep-2026 → las tres preguntas respondidas, y
  sus consecuencias escritas en §8 y en ADR-009 y ADR-010 [pass]
- instrucción del humano del 18-sep-2026 → la fecha de la revisión de la copia
  fijada el 30 de diciembre de 2026 [pass]
- instrucción del humano del 18-sep-2026 → la plataforma cubierta es móvil y
  escritorio [pass]
Pendientes: ninguno propio de F0. Lo único que F0 dejó a F1 —el **piso de
  versiones por motor** (su PREGUNTA-H)— quedó cerrado el 18-sep-2026 por la
  política de ventana de tiempo del humano; está registrada en
  `docs/adr/ADR-011-compatibility-window.md` y en
  `docs/product/definicion-tecnica.md` §9.3, y el piso se deriva en cada
  publicación, sin rellenarse por suposición.
```

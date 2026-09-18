# lalia-akuo — definición técnica: frontera y capas

**Secciones §1-§3 del conjunto F1.** Entrada y mapa del conjunto:
[`definicion-tecnica.md`](definicion-tecnica.md).
**Documentos hermanos:** [`definicion-tecnica-nucleo.md`](definicion-tecnica-nucleo.md)
(§4), [`definicion-tecnica-extensiones.md`](definicion-tecnica-extensiones.md)
(§5-§6), [`definicion-tecnica-canal-agente.md`](definicion-tecnica-canal-agente.md)
(§7).

Los números de sección son únicos en el conjunto: una referencia `§N` se lee
en el documento que contiene esa sección, aunque quien la escriba esté en
otro.

## 1. Qué es lalia-akuo

Una biblioteca reutilizable de interacción por voz para la web, agnóstica de
dominio, más un canal de agente que **no entra en la primera versión**.

**Resultado observable.** Un tercero instala el núcleo, declara sus campos,
sus textos y su política, y obtiene un flujo hablado que pregunta, escucha,
interpreta, confirma con el valor a la vista, guarda solo tras confirmación
explícita y degrada a escritura cuando no puede seguir. Puede probarlo sin
micrófono ni navegador, y sustituir cualquier pieza de voz por otra sin tocar
el núcleo.

**Lo que aporta la biblioteca** es el mecanismo probado de interacción por
voz: disciplina de turno, confirmación, filtro y compuerta, degradación y
accesibilidad. **Lo que aporta el consumidor** es la política: qué se guarda,
qué es sensible, qué textos son intocables y qué se bloquea. La separación es
la regla de arquitectura del proyecto, no un matiz: sin ella la biblioteca
sirve a un solo dominio.

### 1.1 Qué fija este documento y qué no

Fija: fronteras, contratos de frontera, modelo de estados, decisiones con
alternativas y lo excluido. **No fija:** el inventario exhaustivo de claves de
configuración ni su esquema, los códigos de error del protocolo, la lista
cerrada de eventos de sesión, las firmas definitivas de los puertos, el valor
del presupuesto por turno, la lista exacta de llamadas prohibidas de red ni
los nombres de paquete. Todo eso son entregables de E1 y de las etapas
siguientes (`alubia:PROP-005 §9`); aquí se fija su **forma** y su **criterio**,
no su contenido literal.

Las reglas de diseño que este documento fija sin fuente directa son
propuestas de F1, sujetas a ronda adversarial y etiquetadas donde ocurren;
las que dependen de una decisión humana se citan como tales, y lo que no está
en las fuentes ni aquí queda como pregunta abierta
(`definicion-tecnica.md` §9.3).

### 1.2 Relación con alubia

Alubia es **consumidor externo** (`ADR-002`), no propietario. Su corpus de
diseño se cita como procedencia. La biblioteca no hereda sus decisiones de
producto: hereda las propiedades técnicas que las hacen posibles (§2.2).

## 2. Frontera mecanismo / política

### 2.1 La tabla

| Es **mecanismo** de la biblioteca | Es **política** del consumidor |
|---|---|
| No persistir ni abrir red por su cuenta, y declararlo | Qué se guarda, dónde y por cuánto tiempo |
| Declarar lo que hace y lo que no | Qué datos son sensibles y con qué reglas |
| No guardar un valor sin confirmación explícita | Qué textos son intocables y quién los aprueba |
| Que el readback diga el valor que se va a guardar | Qué frases se pueden redactar y cuáles no |
| Cerrar los turnos por señal real, nunca por temporizador | Qué acciones se permiten en cada paso |
| Aplicar el filtro y la compuerta antes de hablar | Qué se filtra y qué clases se bloquean |

La frontera se aplica así: **el mecanismo no tiene valor por defecto de
política**. Un consumidor que no declara nada no obtiene una política
permisiva heredada: obtiene exactamente lo que declaró, y lo que falta se
resuelve fail-closed en el punto donde se necesita, con la forma que cierra
`definicion-tecnica.md` §9.3 (pregunta A): lo no declarado no se habla, y la
declaración que un paso exige es obligatoria.

### 2.2 Corolario de procedencia

El corpus de alubia —sus ADR, sus SPEC y su código— se cita aquí como **de
dónde viene el diseño**. La biblioteca **no hereda** esas decisiones como
contrato propio: hereda las propiedades técnicas que las hacen posibles
—no simular éxito, cerrar turnos por señal real, no decidir con un modelo,
degradar a manual con salida visible— y nada más.

Un proyecto de otro dominio cambia las políticas de alubia por las suyas sin
tocar el núcleo. Esa es la prueba de la separación, y también su límite: si
cambiar de dominio obliga a tocar el núcleo, la frontera falló.

### 2.3 Lo que este repositorio no puede contener

Queda fuera de todos los archivos de este repositorio: nombres de personas,
cifras y umbrales de cualquier dominio, unidades de negocio, textos
obligatorios concretos, plazos de retención y reglas de aplicación. Las
categorías de política de alubia se citan **por clase** y por su fuente
(`alubia:PROP-005 §4.4`); reproducir aquí sus cifras, sus textos o sus
umbrales sería introducir la política de otro dominio en el contrato de la
biblioteca. Toda política entra por configuración declarada por el
consumidor, y el punto donde se declara es parte del contrato
(`definicion-tecnica-nucleo.md` §4.5).

## 3. Capas y paquetes

### 3.1 Capas

```text
                     consumidor (declara campos, textos, política)
                                  │
        ┌─────────────────────────┴─────────────────────────┐
        │  interfaz mínima de conversación                   │ DOM,
        │  iniciar · silenciar (dos) · texto · estado        │ accesibilidad
        └─────────────────────────┬─────────────────────────┘
                                  │ callbacks, nunca DOM
        ┌─────────────────────────┴─────────────────────────┐
        │  núcleo                                            │ sin DOM
        │  sesión · turnos · validación · confirmación       │ sin red
        │  contadores y umbrales · decisiones admisibles     │ sin persistencia
        └───┬───────────────┬───────────────────┬───────────┘
            │               │                   │
     ┌──────┴──────┐  ┌─────┴──────┐  ┌─────────┴──────────┐
     │  adaptador  │  │  paquete   │  │  canal de agente   │
     │  de voz     │  │  de idioma │  │  (posterior)       │
     └─────────────┘  └────────────┘  └─────────┬──────────┘
                                                 │
                                       ┌─────────┴──────────┐
                                       │ relay de referencia │
                                       │ (no es producto)    │
                                       └────────────────────┘
```

### 3.2 Frontera de cada capa

- **Núcleo.** Sin DOM, sin red, sin persistencia, sin literales de idioma ni
  de dominio. Es el ÚNICO lugar donde se decide si una transición es válida.
  Instanciable: crear una sesión no toca objetos globales y **importar no
  ejecuta efectos**.
- **Adaptador de voz.** Implementa el contrato de locución y escucha sobre la
  API de voz del navegador. Safari es navegador objetivo, así que los parches
  de WebKit son obligatorios, con una prueba por parche (§3.3); Chrome y Edge
  comparten motor y no duplican parches entre sí. Es quien puede abrir red
  (`definicion-tecnica-nucleo.md` §4.9), y eso se declara al consumidor.
- **Adaptador de texto.** Mismo contrato, entrada por teclado. Sirve para
  pruebas automatizadas y como degradación.
- **Paquete de idioma.** Gramática numérica, léxico de control, tablas,
  rangos, unidades y presupuesto de lectura. Todo eso es inyectable.
- **Interfaz mínima de conversación.** Los controles y el indicador. Consume
  callbacks; no conoce el estado interno de la sesión salvo lo que el núcleo
  publica.
- **Canal de agente.** Frontera de transporte y validación. No entra en la
  primera versión (`definicion-tecnica-canal-agente.md` §7).

Los nombres concretos de los paquetes no están decididos: son un entregable
de la fundación del proyecto (`alubia:PROP-005 §9`, E0-05). Este documento
los cita por su rol.

### 3.3 Navegadores objetivo y parches obligatorios

Decisión humana del 18-sep-2026 (`ADR-009`): los navegadores objetivo son
**Safari, Chrome y Edge**.

Son **tres navegadores y dos motores**: Safari es WebKit y Chrome y Edge
comparten Chromium/Blink. De ahí se siguen cuatro consecuencias:

- **Los parches de WebKit son obligatorios**, no opcionales: Safari es
  objetivo declarado y es el motor cuyos parches motivan el proyecto. Cada
  parche obligatorio lleva su prueba, de modo que quitarlo ponga una prueba
  en rojo (REQ-18).
- **Chrome y Edge no duplican parches entre sí**: lo que se escribe para un
  motor aplica a los dos navegadores que lo comparten.
- **La matriz de pruebas se organiza por motor**, no por navegador: dos
  entradas de motor con tres navegadores como casos. La medición en
  dispositivo (E3-05) sigue siendo por navegador, porque el motor no decide
  qué voces ni qué red usa el dispositivo.
- **Ningún navegador se declara compatible por la presencia de la API**: la
  compatibilidad se declara con la matriz medida, y esa matriz es lo que
  queda pendiente.

Queda **opcional** solo lo que no pertenece a ninguno de los dos motores
objetivo: un parche para otro motor, o para una plataforma que el humano no
declaró, no entra en la matriz obligatoria y no se declara soportado por
escribirlo. En los dos motores objetivo no queda ningún parche de WebKit en
opcional: Safari es objetivo declarado.

**Sin decidir**, y por eso abierto en `definicion-tecnica.md` §9.3
(PREGUNTA-H):

- las **versiones mínimas** de cada motor. El humano eligió navegadores, no
  números de versión, y este documento no inventa ninguno; sin ese piso no se
  puede cerrar la lista de parches obligatorios ni declarar compatibilidad;
- la **plataforma** cubierta —móvil, escritorio o ambas—. Los parches de
  plataforma que motivan el proyecto se descubrieron en WebKit móvil
  (`alubia:PROP-005 §3`), y la plataforma cambia la matriz.

# lalia-akuo — definición técnica

**Fase F1.** Fija diseño, fronteras, contratos y decisiones antes de
construir. **Entrada:** el F0 del proyecto (`docs/product/plan.md`: problema,
resultado observable y `REQ-*`; su §7 fija la frontera mecanismo/política).
**Salida:** lo que F2 y F3 deben respetar. La trazabilidad con los `REQ-*`
está en §10.

**Estado:** diseño cerrado con las **ocho decisiones P0** de §8. No autoriza
implementación: no se escribe código antes de cerrar E1 (`§11`).

**Convención de citas.** `alubia:<documento>` designa un documento del
repositorio externo del proyecto alubia; no es una ruta de este repositorio ni
lo rige. La propuesta de la que nace este diseño vive allí y se cita como
`alubia:PROP-005 §n`. Las rutas `docs/…` y `ADR-00n-…md` sí son de este
repositorio.

## Índice

| Sección | Contenido |
|---|---|
| §1 | Qué es lalia-akuo y qué fija este documento |
| §2 | Frontera mecanismo / política, y el corolario de procedencia |
| §3 | Capas y paquetes |
| §4 | Contratos del núcleo: entradas, salidas, errores y garantías |
| §5 | Punto de extensión para un modelo de IA |
| §6 | Paquetes de idioma y qué significa «español primero» |
| §7 | Fronteras del canal de agente |
| §8 | Decisiones P0 y criterio de prueba |
| §9 | No decisiones, no objetivos y excluido |
| §10 | Trazabilidad con los `REQ-*` del F0 |
| §11 | Gate de F1: estado |

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
en las fuentes ni aquí queda como pregunta abierta (§9.3).

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
resuelve fail-closed en el punto donde se necesita. Qué forma toma esa
ausencia es una pregunta abierta (§9.3), no una decisión de este documento.

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
consumidor, y el punto donde se declara es parte del contrato (§4.5).

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
  API de voz del navegador, con los parches de plataforma documentados; qué
  parches son obligatorios depende del objetivo de navegadores, todavía
  abierto en el F0. Es quien puede abrir red (§4.9), y eso se declara al
  consumidor.
- **Adaptador de texto.** Mismo contrato, entrada por teclado. Sirve para
  pruebas automatizadas y como degradación.
- **Paquete de idioma.** Gramática numérica, léxico de control, tablas,
  rangos, unidades y presupuesto de lectura. Todo eso es inyectable.
- **Interfaz mínima de conversación.** Los controles y el indicador. Consume
  callbacks; no conoce el estado interno de la sesión salvo lo que el núcleo
  publica.
- **Canal de agente.** Frontera de transporte y validación. No entra en la
  primera versión (§7).

Los nombres concretos de los paquetes no están decididos: son un entregable
de la fundación del proyecto (`alubia:PROP-005 §9`, E0-05). Este documento
los cita por su rol.

## 4. Contratos del núcleo

### 4.1 Crear una sesión (entrada)

```text
CONTRATO: crearSesionVoz v0 — frontera de entrada del núcleo
Entrada:
  config: objeto cerrado, con cuatro familias declaradas (§4.1.1).
          Campo desconocido se rechaza; no se ignora.
Salida:
  sesion: objeto con operaciones, eventos (§4.2) y los valores
          confirmados (`sesion.valores`): los únicos que el consumidor
          puede llegar a guardar, porque la biblioteca no persiste.
Errores:
  configuracion_invalida: falta un campo obligatorio, hay campo
    desconocido, o un paso exige una declaración de política ausente.
    La sesión NO se crea: no queda un objeto a medio construir.
Invariantes:
  - la creación no toca el DOM, ni red, ni almacenamiento, ni estado
    global de módulo;
  - dos sesiones en el mismo documento no comparten estado mutable; el
    arbitraje del audio del documento lo declara el adaptador;
  - la sesión arranca en modo `determinista`.
Compatibilidad: v0 mientras dure E1. Todo cambio incompatible sube versión.
```

#### 4.1.1 Las cuatro familias de `config`

1. **Campos declarativos.** `campos: [{ id, tipo, rango, unidad,
   textoPregunta, politicaDelta }]`. `id` lo elige el consumidor; el núcleo
   no conoce ningún nombre de campo y no deduce el tipo a partir del
   identificador. Sin `campos` no hay sesión.
2. **Entradas inyectadas.** `obtenerValorPrevio(campo)`, opcional. Sin ella,
   la comparación con el valor anterior no existe y la sesión **lo declara**
   en vez de degradar en silencio. Los puertos de §4.3 también son configuración,
   y tienen implementación determinista por omisión.
3. **Política declarada.** Qué textos son intocables, qué se filtra, qué
   clases de seguridad se bloquean, cuál es el texto seguro que las
   sustituye, y cómo se muestra la degradación. El núcleo **exige** la
   declaración de la degradación: no puede aplicar fail-closed en la vista si
   no sabe cómo se ve el fallo.
4. **Rastro y modo.** Destino de eventos de sesión, opcional: sin él la
   sesión declara que no habrá auditoría. `modo`, que solo puede pasar a
   `asistido` por configuración explícita.

El inventario exhaustivo de claves y su esquema son entregables de E1.

### 4.2 Eventos de sesión (salida)

```text
CONTRATO: eventos de sesion v0 — frontera de salida del núcleo
Salida:
  eventos entregados por callbacks declarados en `config`:
    - cambio de estado y de fase;
    - texto destinado a pantalla y texto destinado a voz (separados);
    - petición de confirmación, con el valor a confirmar;
    - necesidad de entrada manual y su motivo;
    - fallo de un puerto y caída al determinista.
Errores:
  destino de eventos que lanza: el núcleo no propaga el fallo a su
    camino crítico; lo descarta y sigue. Un consumidor no puede tumbar
    un turno desde su propio observador. (Regla de diseño de este
    documento; se fija en E1.)
Invariantes:
  - cada evento lleva el modo de la sesión y qué puerto respondió;
  - el texto de pantalla y el de voz son campos distintos, y el de voz
    no contiene información ausente del de pantalla;
  - el núcleo nunca escribe en el DOM ni en almacenamiento;
  - un cambio de estado produce un anuncio accesible (REQ-16; su
    contrato se escribe en E1).
Compatibilidad: el catálogo cerrado de eventos se fija en E1.
```

### 4.3 Puertos

Los puertos son objetos con métodos, no funciones sueltas: el núcleo necesita
cancelar lo que está en vuelo. Toda petición lleva `{ turno, presupuestoMs,
senal }` — el turno en curso, un tope de tiempo y una señal de cancelación.

```text
Peticion = { turno, presupuestoMs, senal }

Lector    = { decir(texto, Peticion)
                → Promise<'fin' | 'error' | 'vigilante'>
              cancelar() }
Escucha   = { escuchar(Peticion, { alParcial, alSinHabla, alError })
                → Promise<ResultadoEscucha>
              cancelar() }
InterpretadorCampo  (texto, campo, Peticion)     → Promise<Interpretacion>
InterpretadorControl(texto, confianza, Peticion) → Promise<CategoriaControl>
Frases    = { texto(clave, contexto, Peticion)   → Promise<string> }
Propositor(estado, evento, opcionesAdmitidas, Peticion) → Promise<Decision>
```

Reglas de contrato, válidas para todos:

- **Todos devuelven promesa**, aunque su implementación resuelva en el mismo
  turno del bucle de eventos.
- **Todos aceptan cancelación y declaran presupuesto.** El silencio del
  micrófono debe poder detener una respuesta en vuelo.
- **Solo `'fin'` encadena escucha.** Resolver una locución por temporizador
  está prohibido: es la vía por la que se simula éxito.
- Un resultado **tardío, cancelado o de otro turno es no-op**. No se aplica
  «lo más parecido».
- Un puerto que devuelve algo fuera de su contrato no decide: **es un fallo
  del puerto** y el núcleo cae al determinista antes del primer evento
  audible.

Contratos de salida:

| Tipo | Forma | Fuente |
|---|---|---|
| `Interpretacion` | `{codigo, valor?, unidad?, candidatos?}`, `codigo ∈ {ok, no_parseable, ambiguo, fuera_de_rango}` | procedencia: gramática numérica de alubia |
| `CategoriaControl` | `∈ {afirmacion, negacion, repeticion, manual, sin_categoria}`, fail-closed por confianza | procedencia: léxico de control de alubia |
| `ResultadoEscucha` | `{tipo, texto?, confianza?}`; los errores de reconocimiento mapeados y **el silencio como caso propio, nunca como cero** | procedencia: sesión de reconocimiento de alubia |
| `Decision` | una de las decisiones enumeradas por el núcleo, y solo una de las que el núcleo ya declaró admisibles en `opcionesAdmitidas` | `alubia:PROP-005 §7.4` |

`Interpretacion` y `CategoriaControl` son contratos **distintos**: uno dice
qué número se entendió, el otro qué intención de control se reconoció. Una
versión anterior de la propuesta los confundía; aquí quedan separados.

### 4.4 Catálogo de textos

```text
CONTRATO: catalogo de textos v0
Entrada:
  clave: identificador estable; el núcleo la pide, nunca escribe texto.
  contexto: ranuras ya validadas, sin texto libre del consumidor sin
    validar.
Salida:
  texto: cadena, dentro del presupuesto declarado por el catálogo.
Errores:
  clave_ausente: el contrato del catálogo exige declarar si eso es un
    fallo o si el paquete sustituye una clave de reserva; no puede
    resolverse en silencio con texto improvisado.
  fuera_de_presupuesto: el texto no se habla; se usa la salida declarada.
Invariantes:
  - hay dos caminos de texto, y no se mezclan:
    (a) TEXTO DE FORMULARIO — preguntas, readback, resumen, avisos y
        anuncios: sale por clave, con ranuras ya validadas. El filtro es
        completo por construcción, porque no hay texto libre que filtrar;
    (b) TEXTO CONVERSACIONAL — respuestas del agente a una pregunta de la
        persona: texto libre, filtro best-effort, declarado como tal.
        Nunca transporta datos, nunca confirma y nunca sustituye un texto
        de formulario;
  - las claves marcadas como no generables no admiten sustitución: el
    núcleo rechaza cualquier reemplazo;
  - el texto que lleva el dato —readback, resumen, anuncio de guardado— no
    pasa por un puerto de redacción: el núcleo lo compone con plantilla y
    ranura ya validada, para que lo oído coincida con lo que se guardará.
Compatibilidad: claves versionadas; una clave retirada se marca, no se borra
en silencio.
```

El presupuesto del catálogo se expresa en **caracteres y palabras**, no en
segundos: la duración real depende de la voz y del ritmo, y no es computable
antes de hablar. La duración real en dispositivo se mide, no se promete.

### 4.5 Política declarada

```text
CONTRATO: declaracion de politica v0 — punto, no contenido
Entrada:
  filtro: qué se filtra del texto que se va a pronunciar;
  clases_bloqueadas: qué clases de seguridad producen compuerta cerrada;
  texto_seguro: qué se dice en lugar de lo bloqueado;
  datos: qué se envía fuera, a quién y con qué retención (punto de
    declaración; el contenido lo fija el consumidor);
  textos_intocables: qué claves no admiten redacción sustituida.
Salida:
  ninguna: es una declaración, no una operación.
Errores:
  politica_ausente: cuando un paso exige una declaración y no está, el
    paso no se ejecuta. La forma exacta de esa ausencia (§9.3) es una
    pregunta abierta.
Invariantes:
  - el núcleo aplica la política declarada; nunca decide su contenido;
  - `safety_class` es una COMPUERTA, no una etiqueta: una clase bloqueada
    no se habla y produce el texto seguro declarado;
  - el filtro y la compuerta se aplican ANTES de hablar;
  - el modelo nunca decide si su propio texto es admisible.
Compatibilidad: v0; el conjunto de campos se cierra en E1.
```

### 4.6 Errores y estado tras el fallo

| Clase | Condición | Estado que queda |
|---|---|---|
| Configuración inválida | Faltan campos, hay campo desconocido o falta política exigida | La sesión no se crea; error explícito |
| Locución fallida | El lector devuelve `error` o `vigilante` | El turno **no encadena** escucha; se ofrece la salida declarada |
| Locución sin señal real | No hay señal de fin | No se infiere éxito por tiempo transcurrido; el turno no encadena |
| Escucha sin habla | Silencio | Caso propio de `ResultadoEscucha`, **nunca un valor cero** |
| Escucha fallida | Error de reconocimiento | Se mapea a su tipo; no consume el turno en silencio |
| Interpretación no resuelta | `no_parseable`, `ambiguo`, `fuera_de_rango` | Repregunta según la política del núcleo; no se guarda nada |
| Control no clasificado | `sin_categoria` | Fail-closed: no se interpreta como afirmación |
| Puerto que falla, agota su presupuesto o rompe contrato | Cualquiera de las tres | Se descarta el turno **antes** de hablar y se rehace en determinista |
| Resultado tardío o de otro turno | Llega fuera de su turno | No-op |
| Texto del agente inválido | Esquema, acción, campo, filtro o compuerta | No se habla; texto seguro declarado o descarte (canal de agente, §7) |
| Texto fuera de presupuesto | Excede caracteres o palabras declarados | No se habla; se usa la salida declarada |

Invariantes de error, para todas las clases:

- **Ningún fallo se convierte en un valor guardado.**
- **Ningún fallo produce silencio:** siempre hay una salida declarada —texto
  seguro, repregunta o entrada manual—, porque callar sin salida visible es
  una forma de simular éxito.
- Un fallo **no cambia el modo** de la sesión.
- Agotar un presupuesto produce un **estado de fallo explícito**, nunca éxito
  inferido.

### 4.7 Estado de sesión y transiciones

```text
ESTADOS visibles (indicador de `alubia:PROP-005 §6.6`): inactivo |
  escuchando | pensando | hablando | error

TRANSICIONES — la enumeración de fases internas se fija en E1; aquí rigen
las reglas:
  - solo la locución con resultado 'fin' encadena escucha;
  - un resultado tardío, cancelado o de otro turno es no-op;
  - ningún temporizador produce una transición de éxito; el agotamiento
    del presupuesto produce un estado de fallo explícito;
  - micrófono apagado no anima ni transiciona a `escuchando`;
  - la caída al determinista ocurre antes del primer evento audible.

INVARIANTES:
  - el estado visible refleja el estado real: no se anima escucha con el
    micrófono apagado ni se muestra «hablando» sin locución en curso;
  - dos controles de silencio separados —micrófono y voz del agente—, y su
    efecto es verificable por prueba (REQ-9);
  - la entrada por texto está disponible en todo estado, nunca como
    castigo (REQ-9).
```

### 4.8 Garantías del núcleo y su prueba

| Garantía | Cómo se prueba |
|---|---|
| No abre red | Análisis estático del paquete del núcleo con lista cerrada de llamadas prohibidas, más una sesión con dobles donde cualquier intento de red falla la prueba |
| No persiste ni registra | Análisis estático con lista cerrada de APIs de almacenamiento y registro; el núcleo no expone operación de escritura |
| No guarda un valor sin confirmación explícita | Prueba de que el camino de guardado exige la confirmación y de que un valor no confirmado no llega a `sesion.valores` |
| El readback dice el valor que se va a guardar | Prueba de coincidencia entre lo pronunciado y `sesion.valores` |
| Cierra los turnos por señal real | Prueba de que ninguna transición de encadenamiento ocurre por temporizador, y de que `error` y `vigilante` no encadenan |
| Aplica filtro y compuerta antes de hablar | Prueba sobre texto de agente con clase bloqueada y con contenido fuera de política: no se pronuncia |
| Sin efectos al importar | Prueba que importa dos veces y verifica que no hay estado compartido ni efectos |
| Cero DOM | Prueba de que el núcleo funciona sin `document` |
| Determinista por omisión | Prueba de que sin configuración de modo no se invoca ningún puerto asistido |
| Caída antes del primer evento audible | Prueba con un puerto que falla, uno que nunca responde y uno que rompe contrato |

Las pruebas de red y de ausencia de persistencia se acotan a lo decidible:
**análisis estático del núcleo más dobles**. No pretenden detectar el tráfico
interno del reconocimiento de voz nativo, que es invisible desde JavaScript.
La lista exacta de llamadas prohibidas de red es un entregable de E1; la de
APIs de almacenamiento y registro es un criterio propuesto en este documento.

Alcance del filtro en la primera versión: solo hay texto libre que filtrar
cuando el consumidor declare un camino de texto conversacional, y ese camino
llega con el canal de agente (§7). El texto de formulario es completo por
construcción (§4.4). La prueba de la compuerta se ejecuta sobre el canal de
agente; hasta entonces, lo que se comprueba es que ningún texto sale sin
pasar por el catálogo.

### 4.9 Lo que el núcleo no garantiza

- **No garantiza que el audio no salga del dispositivo.** El núcleo no abre
  red; el adaptador de voz sí puede, porque el reconocimiento nativo del
  navegador puede resolver contra un servicio de tercero. Se declara al
  consumidor y se avisa en la interfaz **antes** de conceder el micrófono.
- **No garantiza ausencia de red en los puertos que inyecta el consumidor.**
  Quedan fuera del alcance de la prueba estática.
- **No garantiza que el texto libre quede filtrado sin falsos negativos.** El
  filtro sobre texto conversacional es best-effort y se declara como tal.
- **No garantiza la duración de una locución antes de hablar.** Gobierna el
  presupuesto en caracteres y palabras; la duración real se mide.
- **No garantiza la vista.** Exige que el consumidor declare cómo se muestra
  la degradación; si no la implementa, el núcleo no puede sustituirla.
- **No custodia la sesión entre recargas.** No persiste: la continuidad la
  aporta el consumidor.

## 5. Punto de extensión para un modelo de IA

### 5.1 Qué queda abierto hoy

El modo `determinista` está implementado por completo. El modo `asistido`
existe como **costura**: los puntos donde un modelo entraría sin cambiar la
forma del núcleo. Nada del modo asistido se documenta como estable para
terceros antes de medir la latencia que añade.

### 5.2 Dónde entraría

Un modelo puede sustituir **implementaciones de puerto**, y solo esas:

- el **Propositor**, que elige entre las decisiones que el núcleo ya declaró
  admisibles;
- los **interpretadores**, de campo y de control;
- el **redactor** de los textos que el catálogo marca como generables.

No entra en: la disciplina de turno, los contadores y umbrales, el conjunto
de decisiones admisibles, la validación de rangos y tipos, la decisión de
guardar, la política declarada por el consumidor ni los textos que llevan el
dato.

### 5.3 Qué no habría que rehacer

- **La disciplina de turno**, porque los puertos ya devuelven promesa, aceptan
  cancelación y declaran presupuesto desde la primera versión.
- **Los contratos de salida**, porque ya existen y no conocen al modelo.
- **El camino de la decisión**, porque el puerto solo elige entre opciones ya
  seguras y no puede repreguntar sin fin ni agotar la salida a escritura.
- **La redacción de los textos que llevan el dato**, porque no pasa por el
  puerto de redacción.
- **La auditoría del modo**, porque la sesión y cada evento ya declaran el
  modo y qué puerto respondió.
- **El transporte del canal de agente**, porque su validación es la misma
  puerta que un modelo tendría que atravesar.

### 5.4 Qué sí habría que construir

- El puerto asistido, su proveedor y la custodia de credenciales: **no son de
  la biblioteca**, que no persiste ni abre red.
- La política de datos aprobada por el consumidor para lo que salga del
  dispositivo, que es prerequisito del canal, no del núcleo.
- **La ampliación de la tabla de decisiones del núcleo**, cuando se quiera
  admitir preguntas y explicaciones. Eso no es sustituir un puerto: la
  categoría de pregunta no existe hoy y el núcleo no tiene decisiones con las
  que responderla. Se declara por etapa; el alcance real de cada costura se
  cierra en E1.

### 5.5 Prohibiciones que no se relajan

Un modelo, cuando llegue, queda sujeto a lo mismo que un agente: **no
transiciona, no fija valores, no persiste, no decide rangos y no redacta los
textos que el consumidor marcó como intocables.** Si devuelve algo fuera del
conjunto admisible, no es una decisión: es un fallo del puerto.

## 6. Paquetes de idioma y qué significa «español primero»

### 6.1 El mecanismo

El núcleo no contiene literales, léxico, gramática numérica ni reglas de
idioma. Todo eso llega por un **paquete de idioma** que aporta:

- la interpretación de cantidades dichas en voz alta, con sus patrones
  numéricos y sus aproximaciones;
- el léxico de control con sus categorías y su umbral de confianza;
- las tablas, rangos, unidades y el presupuesto de lectura, inyectables;
- las claves del catálogo de textos, incluida la marca de las que no admiten
  sustitución.

Un paquete crece **por anexo versionado, con una prueba por entrada**, no por
edición silenciosa de su tabla. El núcleo debe poder probarse con un paquete
de sustitución sin modificarse: es la prueba de que el mecanismo existe.

### 6.2 Qué significa «español primero»

Significa que la **primera versión publica exactamente un paquete de idioma,
en español**, y que el mecanismo ya está en su sitio desde el primer día.
Significa, en concreto:

- el núcleo no asume español en ninguna parte: no concatena palabras de un
  número, no conoce palabras de control y no decide rangos léxicos;
- la cadena de texto no visible al usuario —claves, códigos y categorías— no
  es español de interfaz ni depende del idioma del paquete;
- añadir un idioma no toca el núcleo ni los contratos de §4: es un paquete
  nuevo con sus propias pruebas;
- las decisiones y los contratos de este documento no cambian por idioma.

### 6.3 Qué implica un segundo idioma

El paquete inglés, cuando llegue, es una **etapa propia**: sus patrones
numéricos y su léxico de control son implementaciones nuevas, no traducciones
de los del español. No está en la primera versión.

Preguntas abiertas asociadas: la forma de distribución del paquete, la
etiqueta de idioma base, qué ocurre cuando falta una clave y si los controles
de la interfaz de conversación también se cubren con paquetes de idioma. Están
en §9.3 y no se resuelven por supuesto.

## 7. Fronteras del canal de agente

### 7.1 Qué es y qué no es

El canal deja que un agente reciba el estado de la sesión y devuelva **texto y
propuesta de acción, nunca estado**. Que el agente no pueda transicionar por
contrato es la razón de que el canal exista como capa aparte: si pudiera,
activarlo sobre un flujo perdería las garantías del núcleo.

**No entra en la primera versión.** Lo que F1 fija son sus fronteras, porque
son prerequisito para no rehacer el núcleo cuando la etapa se ejecute.

### 7.2 Protocolo (frontera)

Antes de mostrar o pronunciar **cualquier** texto del agente, el núcleo aplica
sus validaciones, no solo la de esquema:

1. esquema válido y versión soportada;
2. la acción propuesta está permitida en el estado actual;
3. el campo corresponde al paso activo;
4. un candidato pasa analizador, tipo, precisión y rango;
5. el texto pasa el filtro que el consumidor haya declarado;
6. `safety_class` obra como compuerta: una clase bloqueada no se habla;
7. toda transición sensible exige confirmación explícita.

Propiedades de la frontera:

- **El agente no envía valores de campo.** Los propone, y el núcleo los
  valida contra su tabla.
- **El texto de entrada de la persona es dato no confiable.** La biblioteca
  no lo clasifica: declarar si es sensible, si puede salir del dispositivo y
  con qué retención es política del consumidor, y el punto donde declararlo
  es parte del contrato (§4.5).
- **El cursor del turno lo custodia el consumidor** —su servidor—, no la
  página ni la biblioteca, que no persiste. Un cursor que no coincide con el
  turno esperado se descarta como no-op; no se aplica «lo más parecido».
- **La versión del esquema viaja en cada mensaje**, igual que la sesión y el
  cursor.

El detalle del protocolo, sus campos y su esquema son entregables de E1. El
esquema de mensajes que el primer consumidor fijó para su propia evolución se
cita como procedencia y **no se adopta como base** del protocolo de la
biblioteca: la base la fija E1 con las propiedades de esta sección, y cada
consumidor puede declarar su perfil sobre ella.

### 7.3 Transporte y relay de referencia

El reparto es **interfaz de transporte** más un **relay de referencia que no
es producto**:

- la interfaz admite implementaciones por WebSocket, por eventos de servidor
  y por mensajería de ventana para incrustar en un host;
- el relay se documenta y se prueba, pero no se presenta como producto ni se
  promete su operación;
- el proyecto **no opera infraestructura en producción** y no custodia
  credenciales de agentes.

### 7.4 MCP

**Sin servidor MCP en la primera versión.** Cuando llegue, será paquete aparte
con la versión de especificación fijada, y su superficie de herramientas
habrá estado declarada desde antes.

Restricciones ya fijadas para ese paquete: validación de origen con rechazo
explícito, token por sesión, y `stdio` nunca expuesto al navegador. La razón
está registrada en `ADR-005`, incluido el patrón que ya produjo una
vulnerabilidad de ejecución remota de comandos en una herramienta de
referencia del ecosistema.

### 7.5 Qué implica el aplazamiento

- El primer conjunto publicado **no incluye** el canal de agente.
- El canal no empieza antes de que el núcleo tenga su ronda adversarial con
  veredicto favorable.
- Lo que sí se diseña ahora es su frontera: protocolo, validación, superficie
  de herramientas y punto de declaración de política. Diseñarla no es
  implementarla.
- Existe una ambigüedad de fuente, acotada pero no resuelta: `REQ-14` excluye
  la pieza del canal de la primera versión, mientras la propuesta lista la
  interfaz de transporte y el relay como parte de ella y la decisión de
  secuencia los sitúa después del núcleo. La pregunta concreta está en §9.3.

## 8. Decisiones P0 y criterio de prueba

Las ocho decisiones de fundación, con su resolución y el criterio con el que
se comprueba que se respetaron. **P0-1** es la frontera que hace coherentes a
las demás; **P0-2 a P0-8** corresponden, en ese orden, a las siete decisiones
cerradas por instrucción humana del 18-sep-2026.

| id | Decisión | Resolución | ADR | Criterio de prueba |
|---|---|---|---|---|
| P0-1 | Mecanismo y política | La biblioteca aporta mecanismo; el consumidor, política | `ADR-001` | El núcleo no contiene literales, umbrales ni textos de dominio; toda política entra por configuración declarada |
| P0-2 | Repositorio y licencia | Repositorio propio, Apache-2.0; alubia es consumidor externo | `ADR-002` | La licencia del repositorio y la declarada por los paquetes son Apache-2.0; alubia consume como dependencia externa |
| P0-3 | Secuencia | El canal de agente entra después de estabilizar el núcleo | `ADR-003` | Ninguna tarea del canal inicia antes del veredicto favorable de la ronda adversarial del núcleo |
| P0-4 | Transporte | Interfaz de transporte más relay de referencia que no es producto | `ADR-004` | El proyecto no opera infraestructura; el relay se documenta como referencia y no como producto |
| P0-5 | MCP | Sin servidor MCP en la primera versión; después, paquete aparte con spec fijada | `ADR-005` | Ninguna dependencia de MCP en los paquetes de la primera versión |
| P0-6 | Idiomas | Español primero, inglés después, con el mecanismo desde el día uno | `ADR-006` | El núcleo se prueba con un paquete de idioma de sustitución sin modificarse; la primera versión publica un solo paquete |
| P0-7 | Persistencia | Ninguna, ni la mínima; el dato previo es entrada inyectada | `ADR-007` | Análisis estático sin APIs de almacenamiento; ninguna operación del núcleo escribe estado entre sesiones |
| P0-8 | Modelo de IA | Solo las costuras; el modo asistido se activa por configuración explícita | `ADR-008` | Todo puerto devuelve promesa, acepta cancelación y declara presupuesto; los contadores y umbrales no son alcanzables desde un puerto |

Nota de lectura: P0-6 y P0-8 tienen criterio en forma de prueba sobre el
núcleo; P0-3, P0-4 y P0-5 se comprueban sobre el alcance y el contenido del
conjunto publicado, no sobre el código.

## 9. No decisiones, no objetivos y excluido

### 9.1 No objetivos

- Sustituir a los SDK de las plataformas de agentes.
- Ser un motor de formularios general: validación, campos condicionales y
  cálculos quedan fuera; la biblioteca aporta la capa hablada y de
  confirmación.
- Convertirse en el canal de voz del proyecto de origen en producción: ese
  proyecto no adopta el canal de agente en su primera versión.
- Tomar cualquier decisión de dominio: las reglas, los umbrales y el marco
  aplicable son del consumidor.

### 9.2 Fuera de la primera versión

- El canal de agente implementado (§7).
- El servidor MCP.
- La implementación del puerto asistido: solo las costuras.
- El paquete de idioma inglés.
- `stdio` expuesto al navegador; WebRTC; reconocimiento de voz en servidor.
- Multiusuario y salas concurrentes; cuentas y facturación.
- Publicar la salida de voz por flujo: no basta con añadirla, porque obliga a
  cambiar la forma del puerto de locución y el camino de agregación del
  núcleo. Se reconoce el coste de no hacerlo.

### 9.3 Preguntas abiertas

Ninguna de estas tiene respuesta en las fuentes disponibles. No se resuelven
por supuesto.

```text
PREGUNTA-A: ¿Qué hace el núcleo cuando el consumidor no declara una política
  que un paso exige —filtro, clases bloqueadas o texto seguro—?
  Por qué importa: decide si la ausencia de declaración es una compuerta
  cerrada o un comportamiento permisivo. Un defecto permisivo decide
  política en silencio; un cierre absoluto puede impedir cualquier uso.
  Recomendación: fail-closed —lo no declarado no se habla—, con el punto de
  declaración obligatorio en la configuración.

PREGUNTA-B: ¿La interfaz de transporte y el relay de referencia se publican
  con la primera versión, o quedan para la etapa posterior al núcleo?
  Por qué importa: fija el contenido del primer conjunto publicado y el DoD
  de la etapa del canal. `REQ-14` exige que la biblioteca corra sin ninguna
  pieza del canal instalada, y la propuesta lista la interfaz y el relay
  dentro de la primera versión mientras la decisión de secuencia los sitúa
  después.

PREGUNTA-C: ¿Cuál es la forma de distribución del paquete de idioma
  —subruta del mismo paquete o paquete independiente— y cuál su etiqueta
  base?
  Por qué importa: define el mecanismo de sustitución y la resolución de
  claves cuando falta una.

PREGUNTA-D: ¿Los controles de la interfaz de conversación —iniciar,
  silenciar, entrada de texto, indicador— se cubren con paquetes de idioma?
  Por qué importa: si no se cubren, su texto queda fuera del mecanismo y el
  segundo idioma obliga a tocar la interfaz.

PREGUNTA-E: ¿Cuál es el valor del presupuesto de locución y del presupuesto
  por turno, y cómo se degrada al agotarse?
  Por qué importa: gobierno del camino crítico. La fuente escrita y el
  código de origen no coinciden en el tope, y ningún documento normativo
  registra el valor vigente. Debe fijarse con su razón.

PREGUNTA-F: Si el consumidor no implementa la vista de degradación que el
  núcleo exige declarar, ¿la sesión no se crea o se crea sin red de
  seguridad visible?
  Por qué importa: la degradación a manual es la red de seguridad del flujo
  hablado; sin ella, callar sin salida equivale a simular éxito.

PREGUNTA-G: Los umbrales de la política de confirmación —cuántos fallos o
  negaciones agotan el intento— ¿son mecanismo fijo del núcleo o política
  que declara el consumidor?
  Por qué importa: la fuente los trata como mecanismo no cedible y a la vez
  declara configurable la política de confirmación y la comparación por
  campo. Un umbral fijo heredado de otro dominio es una cifra de política
  dentro del núcleo; uno declarable exige que el núcleo valide que es finito
  y que siempre desemboca en la salida a texto.
  Recomendación: el núcleo conserva los contadores y la garantía de intento
  finito con salida a texto; el valor numérico lo declara el consumidor.
```

### 9.4 Pendientes de fase

- **F0.** El F0 existe (`docs/product/plan.md`, estado PARCIAL) y sus `REQ-*`
  se trazan en §10. Mantiene abiertas tres preguntas propias —navegadores
  objetivo, forma de consumo desde alubia y publicación en registro— que
  condicionan E3 y la publicación; no se duplican aquí.
- **Nombres de paquete.** Corresponden a la fundación del proyecto.
- **Inventario y esquema de configuración, catálogo de eventos, códigos de
  error del protocolo y firmas definitivas de los puertos.** Entregables de
  E1.
- **Índice de ADR.** Este repositorio aún no tiene índice de ADR en
  `docs/adr/`; las ocho decisiones P0 están registradas en sus ADR.

## 10. Trazabilidad con los `REQ-*` del F0

Cada requisito del F0 tiene sección responsable aquí. La columna de prueba
apunta al entregable que fijará el caso testable; ninguna sección de este
documento introduce requisitos ausentes del F0.

| REQ | Sección de este documento | Dónde vive el caso testable |
|---|---|---|
| REQ-1 núcleo sin DOM | §3.2, §4.1, §4.8 | E1 contrato del núcleo; E2-02 |
| REQ-2 locución y encadenamiento | §4.3, §4.6 | E1 contrato de locución |
| REQ-3 disciplina de turno | §4.3, §4.6, §4.7 | E1 disciplina de turno |
| REQ-4 confirmación enumerada | §4.3, §4.8 | E1 puertos; E2-04 |
| REQ-5 léxico y umbral externos | §4.3, §6.1 | E3-04 |
| REQ-6 formularios declarativos | §4.1.1 | E1 contrato del núcleo; E2-02 |
| REQ-7 confirmación y readback fiel | §4.4, §4.8 | E1 catálogo; E2-06 |
| REQ-8 degradación a manual | §4.6, §4.7 | E4-02, E4-03 |
| REQ-9 interfaz mínima | §3.2, §4.7 | E1 accesibilidad; E4-01 |
| REQ-10 ninguna política de dominio | §2, `ADR-001` | E1 catálogo; prueba con dos configuraciones de dominio |
| REQ-11 no persiste, no red, lo declara | §4.8, §4.9 | E2-07 y la prueba de ausencia de escritura |
| REQ-12 paquetes de idioma | §6, `ADR-006` | E3-04 |
| REQ-13 puertos sin modelo | §5, `ADR-008` | E2-05, E2-06 |
| REQ-14 canal y MCP fuera | §7, P0-3 a P0-5 | E5-03, posterior a la primera versión |
| REQ-15 Apache-2.0, consumo externo | `ADR-002`, §9.4 | E6-01, E6-03 |
| REQ-16 accesibilidad | §4.2, §4.7 | E1 accesibilidad; E4-03, E4-04 |
| REQ-17 el agente no se salta la validación | §7.2 | E1 protocolo; E5-01 |

Las tareas `E<n>-<m>` citadas son las de `alubia:PROP-005 §9`, usadas como
procedencia; el plan de implementación propio de este repositorio se crea en
F2.

## 11. Gate de F1: estado

Checklist del gate, con su estado real:

- [x] decisiones con alternativas registradas en ADR: las ocho P0;
- [x] componentes con frontera externa con contrato: núcleo, eventos,
      puertos, catálogo, política declarada, protocolo de agente;
- [x] máquina de estados definida: estados visibles y reglas de transición,
      con la enumeración de fases internas delegada a E1;
- [x] todo `REQ` imprescindible con sección responsable y prueba prevista:
      §10;
- [ ] todo `REQ` imprescindible cubierto por una spec con casos testables:
      las spec son entregables de E1, todavía sin escribir;
- [x] ninguna sección introduce requisitos ausentes de F0: §10 lo traza.

**Fase F1: PARCIAL.** Faltan los entregables de E1; ninguna sección de este
documento autoriza escribir código.

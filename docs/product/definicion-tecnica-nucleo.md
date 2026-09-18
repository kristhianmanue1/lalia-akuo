# lalia-akuo — definición técnica: contratos del núcleo

**Sección §4 del conjunto F1.** Entrada y mapa del conjunto:
[`definicion-tecnica.md`](definicion-tecnica.md).
**Documentos hermanos:** [`definicion-tecnica-frontera.md`](definicion-tecnica-frontera.md)
(§1-§3), [`definicion-tecnica-extensiones.md`](definicion-tecnica-extensiones.md)
(§5-§6), [`definicion-tecnica-canal-agente.md`](definicion-tecnica-canal-agente.md)
(§7).

Los números de sección son únicos en el conjunto: una referencia `§N` se lee
en el documento que contiene esa sección, aunque quien la escriba esté en
otro.

Los identificadores y las claves definitivos viven en
[`SPEC-001`](../specs/SPEC-001-contrato-del-nucleo.md),
[`SPEC-002`](../specs/SPEC-002-disciplina-de-turno.md) y
[`SPEC-003`](../specs/SPEC-003-contrato-de-locucion.md), y este documento los
usa ya con esa forma.

## 4. Contratos del núcleo

### 4.1 Crear una sesión (entrada)

```text
CONTRATO: createVoiceSession v0 — frontera de entrada del núcleo
Entrada:
  config: objeto cerrado, con seis familias y una clave inyectada suelta
          (§4.1.1).
          Campo desconocido se rechaza; no se ignora.
Salida:
  session: objeto con operaciones, eventos (§4.2) y los valores
          confirmados (`session.values`): los únicos que el consumidor
          puede llegar a guardar, porque la biblioteca no persiste.
Errores:
  invalid_config: falta un campo obligatorio, hay campo
    desconocido, o un paso exige una declaración de política ausente.
    La sesión NO se crea: no queda un objeto a medio construir.
Invariantes:
  - la creación no toca el DOM, ni red, ni almacenamiento, ni estado
    global de módulo;
  - dos sesiones en el mismo documento no comparten estado mutable; el
    arbitraje del audio del documento lo declara el adaptador;
  - la sesión arranca en modo `deterministic`.
Compatibilidad: v0 mientras dure E1. Todo cambio incompatible sube versión.
```

Las firmas y las claves exactas se fijan en
[`SPEC-001`](../specs/SPEC-001-contrato-del-nucleo.md).

#### 4.1.1 Las familias de `config`

`SPEC-001` fija el inventario exhaustivo: **seis familias** más la clave
inyectada suelta `getPreviousValue`. Las familias:

1. **Campos declarativos.** `fields: [{ id, type, range, unit,
   promptKey, deltaPolicy }]`. `id` lo elige el consumidor; el núcleo
   no conoce ningún nombre de campo y no deduce el tipo a partir del
   identificador. Sin `fields` no hay sesión.
2. **Idioma.** `language: { pack, fallback? }`. El paquete aporta los
   textos; sin él no hay clave que resolver (`ADR-006`).
3. **Política declarada.** Qué textos son intocables, qué se filtra, qué
   clases de seguridad se bloquean, cuál es el texto seguro que las
   sustituye, cómo se muestra la degradación y cuántos intentos admite un
   paso antes de degradar. El núcleo **exige** la declaración de la
   degradación: no puede aplicar fail-closed en la vista si no sabe cómo
   se ve el fallo.
4. **Modo.** `mode`, que sólo puede pasar a `assisted` por configuración
   explícita.
5. **Puertos.** `ports`, las costuras de §4.3; el puerto omitido usa la
   implementación determinista por omisión.
6. **Rastro.** `onEvent`, destino de eventos de sesión, opcional: sin él
   la sesión declara que no habrá auditoría.

Fuera de las familias, la clave inyectada **`getPreviousValue(fieldId)`**,
opcional: sin ella la comparación con el valor anterior no existe —la
diferencia no se evalúa, `onExceeded` no se aplica y el valor sigue el camino
normal de confirmación—, sin degradar en silencio.

El inventario exhaustivo de claves y su esquema viven en `SPEC-001` y en
`schema/configuracion.json`.

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

El catálogo cerrado de eventos, con el sobre de cada tipo, se fija en
[`SPEC-001`](../specs/SPEC-001-contrato-del-nucleo.md).

### 4.3 Puertos

Los puertos son objetos con métodos, no funciones sueltas: el núcleo necesita
cancelar lo que está en vuelo. Toda petición lleva `{ turn, budgetMs,
signal }` — el turno en curso, un tope de tiempo y una señal de cancelación.

```text
request = { turn, budgetMs, signal }

speaker = { say(text, request)
              → Promise<'done' | 'error' | 'watchdog'>
            cancel() }
listener = { listen(request, { onPartial, onNoSpeech, onError })
               → Promise<ListeningResult>
             cancel() }
fieldInterpreter   (text, field, request)      → Promise<Interpretation>
controlInterpreter (text, confidence, request) → Promise<ControlCategory>
phrases = { text(key, context, request) → Promise<string> }
proposer(state, event, allowedOptions, request) → Promise<Decision>
```

Las firmas exactas de los puertos se fijan en
[`SPEC-001`](../specs/SPEC-001-contrato-del-nucleo.md); el turno y la
petición, en [`SPEC-002`](../specs/SPEC-002-disciplina-de-turno.md), y la
locución, en [`SPEC-003`](../specs/SPEC-003-contrato-de-locucion.md).

Reglas de contrato, válidas para todos:

- **Todos devuelven promesa**, aunque su implementación resuelva en el mismo
  turno del bucle de eventos.
- **Todos aceptan cancelación y declaran presupuesto.** El silencio del
  micrófono debe poder detener una respuesta en vuelo.
- **Solo `'done'` encadena escucha.** Resolver una locución por temporizador
  está prohibido: es la vía por la que se simula éxito.
- Un resultado **tardío, cancelado o de otro turno es no-op**. No se aplica
  «lo más parecido».
- Un puerto que devuelve algo fuera de su contrato no decide: **es un fallo
  del puerto** y el núcleo cae al determinista antes del primer evento
  audible.

Contratos de salida:

| Tipo | Forma | Fuente |
|---|---|---|
| `Interpretation` | `{code, value?, unit?, candidates?}`, `code ∈ {ok, unparseable, ambiguous, out_of_range}` | procedencia: gramática numérica de alubia |
| `ControlCategory` | `∈ {affirmation, negation, repetition, manual, unclassified}`, fail-closed por confianza | procedencia: léxico de control de alubia |
| `ListeningResult` | `{type, text?, confidence?}`; los errores de reconocimiento mapeados y **el silencio como caso propio, nunca como cero** | procedencia: sesión de reconocimiento de alubia |
| `Decision` | una de las decisiones enumeradas por el núcleo, y solo una de las que el núcleo ya declaró admisibles en `allowedOptions` | `alubia:PROP-005 §7.4` |

`Interpretation` y `ControlCategory` son contratos **distintos**: uno dice
qué número se entendió, el otro qué intención de control se reconoció. Una
versión anterior de la propuesta los confundía; aquí quedan separados.

### 4.4 Catálogo de textos

```text
CONTRATO: catalogo de textos v0
Entrada:
  key: identificador estable; el núcleo la pide, nunca escribe texto.
  context: ranuras ya validadas, sin texto libre del consumidor sin
    validar.
Salida:
  text: cadena, dentro del presupuesto declarado por el catálogo.
Errores:
  missing_text: el contrato del catálogo exige declarar si eso es un
    fallo o si el paquete sustituye una clave de reserva; no puede
    resolverse en silencio con texto improvisado.
  over_budget: el texto no se habla; se usa la salida declarada.
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

El contrato exacto del catálogo se fija en
[`SPEC-001`](../specs/SPEC-001-contrato-del-nucleo.md).

### 4.5 Política declarada

```text
CONTRATO: declaracion de politica v0 — punto, no contenido
Entrada:
  filter: qué se filtra del texto que se va a pronunciar;
  blockedClasses: qué clases de seguridad producen compuerta cerrada;
  safeTextKey: qué se dice en lugar de lo bloqueado;
  data: qué se envía fuera, a quién y con qué retención (punto de
    declaración; el contenido lo fija el consumidor);
  immutableTextKeys: qué claves no admiten redacción sustituida.
Salida:
  ninguna: es una declaración, no una operación.
Errores:
  missing_policy: cuando un paso exige una declaración y no está, el
    paso no se ejecuta. La forma de esa ausencia está cerrada en
    `definicion-tecnica.md` §9.3 (pregunta A): lo no declarado no se
    habla, y la declaración que un paso exige es obligatoria.
Invariantes:
  - el núcleo aplica la política declarada; nunca decide su contenido;
  - `safetyClass` es una COMPUERTA, no una etiqueta: una clase bloqueada
    no se habla y produce el texto seguro declarado;
  - el filtro y la compuerta se aplican ANTES de hablar;
  - el modelo nunca decide si su propio texto es admisible.
Compatibilidad: v0; el conjunto de campos se cierra en E1.
```

Las claves exactas de la política se fijan en
[`SPEC-001`](../specs/SPEC-001-contrato-del-nucleo.md). Los identificadores
van en inglés (`AGENTS.md`, «Convenciones de edición»): la clase de
seguridad es `safetyClass`, la forma que `SPEC-010` usa ya; la prosa puede
decir «clase de seguridad».

### 4.6 Errores y estado tras el fallo

| Clase | Condición | Estado que queda |
|---|---|---|
| Configuración inválida | Faltan campos, hay campo desconocido o falta política exigida | La sesión no se crea; error explícito |
| Locución fallida | El lector devuelve `error` o `watchdog` | El turno **no encadena** escucha; se ofrece la salida declarada |
| Locución sin señal real | No hay señal de fin | No se infiere éxito por tiempo transcurrido; el turno no encadena |
| Escucha sin habla | Silencio | Caso propio de `ListeningResult`, **nunca un valor cero** |
| Escucha fallida | Error de reconocimiento | Se mapea a su tipo; no consume el turno en silencio |
| Interpretación no resuelta | `unparseable`, `ambiguous`, `out_of_range` | Repregunta según la política del núcleo; no se guarda nada |
| Control no clasificado | `unclassified` | Fail-closed: no se interpreta como afirmación |
| Puerto que falla, agota su presupuesto o rompe contrato | Cualquiera de las tres | Se descarta el turno **antes** de hablar y se rehace en determinista |
| Resultado tardío o de otro turno | Llega fuera de su turno | No-op |
| Texto del agente inválido | Esquema, acción, campo, filtro o compuerta | No se habla; texto seguro declarado o descarte (canal de agente, `definicion-tecnica-canal-agente.md` §7) |
| Texto fuera de presupuesto | Excede caracteres o palabras declarados | No se habla; se usa la salida declarada |

Invariantes de error, para todas las clases:

- **Ningún fallo se convierte en un valor guardado.**
- **Ningún fallo produce silencio:** siempre hay una salida declarada —texto
  seguro, repregunta o entrada manual—, porque callar sin salida visible es
  una forma de simular éxito.
- Un fallo **no cambia el modo** de la sesión.
- Agotar un presupuesto produce un **estado de fallo explícito** —`failure`,
  con un único reintento determinista y `error` · `failed` sólo si ese
  reintento también agota o falla—, nunca éxito inferido.

### 4.7 Estado de sesión y transiciones

```text
ESTADOS visibles (indicador de `alubia:PROP-005 §6.6`): idle |
  listening | thinking | speaking | error

TRANSICIONES — las fases internas son las ocho de
  `../specs/SPEC-005-maquina-de-estados-y-fases.md`; aquí rigen las reglas:
  - solo la locución con resultado `'done'` encadena escucha;
  - un resultado tardío, cancelado o de otro turno es no-op;
  - ningún temporizador produce una transición de éxito; el agotamiento
    del presupuesto produce un fallo explícito, nunca un éxito inferido;
  - micrófono apagado no anima ni transiciona a `listening`;
  - la caída al determinista ocurre antes del primer evento audible.

INVARIANTES:
  - el estado visible refleja el estado real: no se anima escucha con el
    micrófono apagado ni se muestra `speaking` sin locución en curso;
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
| No guarda un valor sin confirmación explícita | Prueba de que el camino de guardado exige la confirmación y de que un valor no confirmado no llega a `session.values` |
| El readback dice el valor que se va a guardar | Prueba de coincidencia entre lo pronunciado y `session.values` |
| Cierra los turnos por señal real | Prueba de que ninguna transición de encadenamiento ocurre por temporizador, y de que `error` y `watchdog` no encadenan |
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
llega con el canal de agente (`definicion-tecnica-canal-agente.md` §7). El
texto de formulario es completo por construcción (§4.4). La prueba de la
compuerta se ejecuta sobre el canal de agente; hasta entonces, lo que se
comprueba es que ningún texto sale sin pasar por el catálogo.

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

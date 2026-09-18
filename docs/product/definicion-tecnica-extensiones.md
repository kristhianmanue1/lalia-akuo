# lalia-akuo — definición técnica: extensiones previstas

**Secciones §5-§6 del conjunto F1.** Entrada y mapa del conjunto:
[`definicion-tecnica.md`](definicion-tecnica.md).
**Documentos hermanos:** [`definicion-tecnica-frontera.md`](definicion-tecnica-frontera.md)
(§1-§3), [`definicion-tecnica-nucleo.md`](definicion-tecnica-nucleo.md) (§4),
[`definicion-tecnica-canal-agente.md`](definicion-tecnica-canal-agente.md) (§7).

Los números de sección son únicos en el conjunto: una referencia `§N` se lee
en el documento que contiene esa sección, aunque quien la escriba esté en
otro.

## 5. Punto de extensión para un modelo de IA

### 5.1 Qué queda abierto hoy

El modo `deterministic` está implementado por completo. El modo `assisted`
existe como **costura**: los puntos donde un modelo entraría sin cambiar la
forma del núcleo. Nada del modo asistido se documenta como estable para
terceros antes de medir la latencia que añade.

### 5.2 Dónde entraría

Un modelo puede sustituir **implementaciones de puerto**, y solo esas:

- el **`proposer`**, que elige entre las decisiones que el núcleo ya declaró
  admisibles;
- los **`fieldInterpreter`** y **`controlInterpreter`**;
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
- añadir un idioma no toca el núcleo ni los contratos de
  `definicion-tecnica-nucleo.md` §4: es un paquete nuevo con sus propias
  pruebas;
- las decisiones y los contratos de este documento no cambian por idioma.

### 6.3 Qué implica un segundo idioma

El paquete inglés, cuando llegue, es una **etapa propia**: sus patrones
numéricos y su léxico de control son implementaciones nuevas, no traducciones
de los del español. No está en la primera versión.

Preguntas asociadas, con su cierre en `definicion-tecnica.md` §9.3: la forma
de distribución del paquete es un módulo del repositorio (pregunta C), y los
controles de la interfaz también toman su texto del catálogo por clave
(pregunta D). La etiqueta concreta del idioma y qué ocurre cuando falta una
clave son decisiones técnicas de E1.

# SPEC-011 — Adaptador de motor de voz y parches obligatorios

**Fase:** F1 — entregable de E1 (primera oleada).
**Cubre:** `REQ-18`.
**Procedencia:** `../product/definicion-tecnica-frontera.md` §3.2 y §3.3;
`../product/definicion-tecnica-nucleo.md` §4.3, §4.6, §4.7 y §4.9;
`../product/definicion-tecnica.md` §8 (P0-8 y P0-9) y §9.3 (PREGUNTA-H);
`../product/plan.md` §5.2 (`REQ-18`) y §8 (RESPUESTA-1);
`../adr/ADR-009-browser-targets.md`.
**Depende de:** [`SPEC-001`](SPEC-001-contrato-del-nucleo.md) —nombres de
los puertos, `request` y vocabulario—,
[`SPEC-002`](SPEC-002-disciplina-de-turno.md) —no-op de un resultado tardío
o ajeno— y
[`SPEC-003`](SPEC-003-contrato-de-locucion.md) —enumerado cerrado del
resultado de locución y su presupuesto—. Esta spec no re-nombra nada de allí
y **no escribe** ni cita como existente el entregable de puertos que corre en
paralelo.
**Formato:** `../ai-agent-guide/02-specs-adr-contratos.md` §2.2.

```text
SPEC-011 [cubre: REQ-18]
```

## Comportamiento

El adaptador es la **implementación de los puertos `speaker` y `listener`**
de `SPEC-001` sobre la API de voz del navegador. Es la capa que sí puede
abrir red, porque el reconocimiento nativo puede resolver contra un tercero
(`../product/definicion-tecnica-nucleo.md` §4.9), y por eso lo **declara** en
vez de prometer lo contrario. No decide turnos: entrega resultados y es el
núcleo quien decide si cuentan (`SPEC-002`).

```text
speaker.say(text, request)  → Promise<'done' | 'error' | 'watchdog'>
speaker.cancel()            → void
listener.listen(request, callbacks) → Promise<ListeningResult>
listener.cancel()           → void
```

`request = { turn, budgetMs, signal }` (`SPEC-001`). `callbacks` lleva
`onPartial`, `onNoSpeech` y `onError` (`SPEC-002`).

**Tres navegadores, dos motores.** Safari es WebKit; Chrome y Edge comparten
Chromium/Blink (`ADR-009`). Un parche se escribe **por motor**: lo que sirve
a Blink sirve a los dos navegadores que lo comparten y no se duplica. La
matriz de pruebas se organiza por motor, con los tres navegadores como casos.

**Sin números de versión.** La pregunta del piso de versiones sigue abierta
por decisión humana (`../product/definicion-tecnica.md` §9.3, PREGUNTA-H) y
no se rellena por suposición. En consecuencia, el adaptador **no ramifica
por versión de navegador ni por cadena de agente de usuario**: selecciona sus
parches por **capacidad observada** en el entorno, y cada parche se describe
por su síntoma y su condición de disparo. Declarar compatibilidad es otra
decisión, y la hará la matriz medida.

**Superficie del motor inyectada.** El adaptador recibe la superficie del
motor como entrada (`voiceEngine`), y usa los objetos globales del navegador
sólo como omisión. Es lo que permite probar cada parche con un doble, sin
navegador y sin versiones: cada condición de disparo se construye a mano.
Sin superficie de voz disponible, el adaptador falla declarando —nunca
simula éxito en silencio.

**Locución.** `say()` resuelve uno de los tres valores de `SPEC-003` y
**nunca rechaza**. Sólo el evento terminal real encadena. El adaptador arma
su vigilante con `request.budgetMs`: al agotarse **con una voz disponible** y
sin evento terminal el resultado es `watchdog`, jamás `done`. La excepción
declarada es no tener voz utilizable para el idioma declarado (P-01, P-13):
esa condición se detecta antes de hablar y resuelve `error`, no `watchdog`,
porque no hay señal que esperar. `watchdog` es la ausencia de señal con voz
presente; `error` es la ausencia de voz, y no depende del reloj. `cancel()`
aborta lo que esté en vuelo y a partir de ahí ningún evento del motor tiene
efecto.

**Escucha.** `listen()` resuelve un `ListeningResult`; los errores del
motor se mapean a sus clases declaradas y **el silencio es un caso propio**,
nunca un valor cero. La cancelación propia no se reporta como error. Un
resultado parcial repetido o un resultado final reemitido no se entrega dos
veces.

**Parches obligatorios.** Cada parche tiene síntoma observable, condición de
disparo y una prueba que lo cubre; **quitar el parche pone esa prueba en
rojo**. La lista es cerrada y legible sin leer el código: el adaptador
exporta `PATCHES`, congelado, y cada entrada declara `id`, `engine`
(`'webkit' | 'blink' | 'both'`), `symptom`, `trigger` y `test`. `engine`
nunca es el nombre de un navegador.

```text
P-01 · engine: both · voces no listas
  Síntoma: la primera locución no tiene voz que hablar; no suena y no llega
    a `done`.
  Disparo: `getVoices()` devuelve lista vacía en el primer `say`, o
    `voiceschanged` no se observó todavía.
  Parche: observar `voiceschanged` y resolver la voz dentro del presupuesto
    del turno; sin voz al agotarse, `error`, nunca `done`.
  Prueba: C-011-04.

P-02 · engine: both · la utterance se pierde antes del cierre
  Síntoma: no llega el evento terminal y la locución queda en vuelo.
  Disparo: la utterance no está retenida por el adaptador mientras habla.
  Parche: retención explícita hasta el cierre o la cancelación.
  Prueba: C-011-05.

P-03 · engine: both · cierre de una locución cancelada
  Síntoma: el cierre de la locución cancelada llega después y cierra la
    siguiente.
  Disparo: `cancel()` con una locución en vuelo.
  Parche: identificar cada locución, descartar el evento terminal de una ya
    cancelada y limpiar la cola.
  Prueba: C-011-06.

P-04 · engine: both · cierre duplicado
  Síntoma: dos eventos terminales para la misma locución; doble
    encadenamiento.
  Disparo: el motor dispara el evento terminal más de una vez para la misma
    utterance.
  Parche: cierre idempotente; el segundo evento es no-op.
  Prueba: C-011-07.

P-05 · engine: webkit · primera locución sin activación
  Síntoma: la primera locución no arranca y no llega evento terminal.
  Disparo: `say()` sin activación de usuario previa en móvil.
  Parche: resolver `error` en el acto —nunca `watchdog` ni `done`— y
    exponer que la voz exige activación; la interfaz de `SPEC-009` presenta
    el aviso y recoge esa activación.
  Prueba: C-011-08.

P-06 · engine: webkit · síntesis que arranca en pausa
  Síntoma: `say()` no suena y no llega evento terminal.
  Disparo: la cola de síntesis está en pausa al empezar una locución.
  Parche: reanudar y limpiar la cola antes de hablar.
  Prueba: C-011-09.

P-07 · engine: webkit · escucha que no se reinicia
  Síntoma: el reconocimiento termina tras el primer tramo y la persona cree
    que el turno se cerró sin habla.
  Disparo: `end` con el turno abierto y escucha continua no aplicada por el
    motor.
  Parche: re-escuchar dentro de la **misma** petición hasta que el turno se
    cierre o `signal` aborte; el adaptador nunca cierra el turno.
  Prueba: C-011-10.

P-08 · engine: webkit · arranque sobre una instancia ya iniciada
  Síntoma: la segunda escucha lanza y el turno falla.
  Disparo: arrancar el reconocimiento con una instancia ya activa.
  Parche: una instancia por escucha, o estado comprobado antes de arrancar.
  Prueba: C-011-11.

P-09 · engine: webkit · cancelación propia reportada como error
  Síntoma: la cancelación se reporta como error de reconocimiento.
  Disparo: abortar con reconocimiento en vuelo y recibir el error de aborto
    del motor.
  Parche: no-op; una cancelación propia no es un error.
  Prueba: C-011-12.

P-10 · engine: webkit · fin de escucha sin resultado
  Síntoma: la escucha queda sin habla y sin cierre.
  Disparo: `end` sin `result` con el turno abierto.
  Parche: resolver el silencio como caso propio (`no_speech`), nunca como
    cero ni como éxito.
  Prueba: C-011-13.

P-11 · engine: blink · resultado final reemitido
  Síntoma: la misma frase se interpreta dos veces.
  Disparo: segundo `onresult` con el mismo índice y resultado final.
  Parche: deduplicar por índice; el segundo es no-op.
  Prueba: C-011-14.

P-12 · engine: blink · resultados interinos no pedidos
  Síntoma: las llamadas `onPartial` no llegan aunque el motor produzca
    resultados interinos.
  Disparo: la escucha arranca sin resultados interinos declarados.
  Parche: declararlos y entregar `onPartial` por cada uno.
  Prueba: C-011-15.

P-13 · engine: both · voz que no coincide con el idioma declarado
  Síntoma: no hay voz para el idioma declarado y la locución no suena.
  Disparo: ninguna voz del entorno empieza por el idioma declarado.
  Parche: emparejar por prefijo de idioma y, sin ninguna voz, `error`
    declarado; nunca silencio con éxito.
  Prueba: C-011-16.

P-14 · engine: both · permiso de micrófono denegado
  Síntoma: el turno queda esperando una escucha que no puede haber.
  Disparo: error de permiso del motor.
  Parche: mapearlo a error de reconocimiento declarado y degradar a entrada
    manual; nunca declarar éxito.
  Prueba: C-011-17.
```

**Declaración de capacidades.** El adaptador exporta
`ADAPTER_CAPABILITIES`, congelado y legible sin leer el código, que declara
lo que el adaptador sí hace y lo que no. Es contrato, no comentario: si el
adaptador cambiara de polaridad, la declaración cambia con él y una prueba
falla.

```text
ADAPTER_CAPABILITIES = {
  opensNetwork:      true,    // el reconocimiento nativo puede ir a un tercero
  touchesDom:        false,   // el adaptador no toca el documento
  persists:          false,   // no guarda entre sesiones
  writesStorage:     false,   // no escribe almacenamiento del navegador
  decidesTurns:      false,   // el turno lo decide el núcleo
  selectsPatchesBy:  'capability',
}
```

## Entradas

- `text` de una locución, ya compuesto por el núcleo desde el catálogo por
  clave con sus ranuras validadas (`SPEC-003`).
- `request = { turn, budgetMs, signal }`.
- Los `callbacks` de la escucha: `onPartial`, `onNoSpeech`, `onError`.
- `voiceEngine`: la superficie del motor, inyectada; por omisión, los
  objetos globales del navegador cuando existen.
- La preferencia de voz y de idioma que el consumidor declare, o las de
  omisión del entorno.

## Salidas

- `Promise<'done' | 'error' | 'watchdog'>` en la locución, que nunca rechaza.
- `ListeningResult` en la escucha, con el silencio como caso propio y los
  errores del motor mapeados a las clases declaradas.
- `PATCHES`: la lista cerrada de parches obligatorios, cada uno con su
  síntoma, su disparo y su prueba.
- `ADAPTER_CAPABILITIES`: la declaración de lo que el adaptador hace y no
  hace.
- Nada más: el adaptador no abre red por sí mismo, no persiste, no escribe
  almacenamiento y no decide transiciones.

## Errores

| condición | resultado | estado que queda |
|---|---|---|
| no hay superficie de voz en el entorno | locución `error`; escucha `recognition_failed` | salida declarada del núcleo; nunca éxito simulado |
| sin evento terminal antes de `budgetMs` y con voz disponible | `watchdog` | el turno **no** encadena; ninguna transición por tiempo |
| ninguna voz para el idioma declarado, aunque se agote `budgetMs` | `error` | el turno no encadena; salida declarada; nunca `watchdog` |
| locución sin activación de usuario en móvil | `error` | el turno no encadena; la interfaz presenta el aviso y recoge la activación |
| `cancel()` durante la locución o la escucha | resultado tardío no-op | sin efecto; no hay evento de éxito |
| segundo evento terminal de la misma locución | no-op | sin efecto; cierre único |
| `end` sin resultado | `no_speech` | caso propio, nunca un valor cero |
| error del motor en la escucha | `recognition_failed` | degradación a entrada manual declarada |
| permiso de micrófono denegado | `recognition_failed` | degradación declarada; **nunca** éxito de voz |
| resultado parcial o final repetido | no-op | sin efecto; se entrega una vez |
| resultado de otro turno o posterior al cierre | no-op (`SPEC-002`) | sin cambio de estado ni de valor |
| error de aborto tras cancelación propia | no-op | no es un error del turno |

Fail-closed: ningún fallo de voz produce silencio sin salida declarada,
ningún temporizador produce `done`, y ningún resultado ajeno al turno tiene
efecto.

## Casos

Identificador estable; los casos nuevos se añaden con el siguiente número
libre. C-011-04 a C-011-17 son uno por parche obligatorio: cada uno
construye la condición de disparo con un doble del motor, de modo que
retirar el parche lo deja en rojo.

- **C-011-01** DADO un doble del motor CUANDO se completa una locución
  ENTONCES `say()` resuelve uno de `done`, `error` o `watchdog`, nunca
  rechaza, y sólo con el evento terminal real el resultado es `done`.
- **C-011-02** DADO un doble que nunca emite el evento terminal CUANDO se
  agota `request.budgetMs` ENTONCES el resultado es `watchdog` y ninguna
  transición de éxito ocurre por tiempo.
- **C-011-03** DADO un doble del motor que informa silencio y otro que
  informa un error CUANDO se escucha ENTONCES el silencio se entrega como
  `no_speech` —nunca como cero— y el error se mapea a su clase declarada.
- **C-011-04** DADO un doble cuyo `getVoices()` devuelve lista vacía y que
  sólo anuncia voces al disparar `voiceschanged` CUANDO se habla ENTONCES la
  locución espera la voz dentro del presupuesto y llega a `done` con una voz
  declarada (`P-01`).
- **C-011-05** DADO un doble que sólo emite el evento terminal si el
  adaptador conserva la referencia de la utterance CUANDO se habla ENTONCES
  el resultado es `done`; la prueba falla si la referencia no se retiene
  (`P-02`).
- **C-011-06** DADO un doble que emite el cierre de la locución cancelada
  después de iniciada la siguiente CUANDO llega ese cierre ENTONCES es
  no-op y la locución vigente no se cierra (`P-03`).
- **C-011-07** DADO un doble que emite el evento terminal dos veces para la
  misma locución CUANDO se habla ENTONCES el cierre se aplica una sola vez y
  el segundo evento es no-op (`P-04`).
- **C-011-08** DADO un doble de motor WebKit sin activación de usuario previa
  CUANDO se habla ENTONCES el resultado es `error` en el acto y nunca
  `watchdog` ni `done` (`P-05`).
- **C-011-09** DADO un doble cuya cola de síntesis está en pausa al empezar
  la locución CUANDO se habla ENTONCES la cola se reanuda y la locución
  llega a `done` (`P-06`).
- **C-011-10** DADO un doble WebKit que termina la escucha tras el primer
  tramo sin cerrar el turno CUANDO el turno sigue abierto ENTONCES el
  adaptador vuelve a escuchar dentro de la misma petición y no cierra el
  turno (`P-07`).
- **C-011-11** DADO un doble que lanza si se arranca sobre una instancia ya
  activa CUANDO se escucha por segunda vez ENTONCES la escucha arranca sin
  lanzar (`P-08`).
- **C-011-12** DADO un doble que emite el error de aborto tras una
  cancelación propia CUANDO llega ENTONCES es no-op y no se reporta error
  (`P-09`).
- **C-011-13** DADO un doble WebKit que termina sin resultado CUANDO ocurre
  ENTONCES el resultado es `no_speech`, nunca un valor cero (`P-10`).
- **C-011-14** DADO un doble Blink que reemite el resultado final cuando la
  escucha sigue abierta CUANDO llega el duplicado ENTONCES se entrega una
  sola interpretación (`P-11`).
- **C-011-15** DADO un doble Blink que emite resultados interinos CUANDO se
  escucha ENTONCES la escucha se arranca declarando resultados interinos y
  cada parcial llega a `onPartial` (`P-12`).
- **C-011-16** DADO un doble cuyas voces no empiezan por el idioma declarado
  CUANDO se habla ENTONCES el resultado es `error` declarado y nunca
  silencio con éxito (`P-13`).
- **C-011-17** DADO un doble que informa permiso de micrófono denegado
  CUANDO se escucha ENTONCES el error se mapea a `recognition_failed` y la
  degradación a entrada manual queda declarada (`P-14`).
- **C-011-18** DADO una locución y una escucha en vuelo CUANDO se llama a
  `cancel()` ENTONCES `signal` queda abortado y ningún evento posterior del
  motor produce efecto.
- **C-011-19** DADO el valor de `PATCHES` CUANDO se recorre ENTONCES cada
  entrada declara `id`, `engine`, `symptom`, `trigger` y `test`, su `test`
  corresponde a un caso de esta spec, y no hay dos entradas con el mismo
  `engine` y el mismo síntoma.
- **C-011-20** DADO dos dobles con la misma capacidad observada y distinta
  cadena de agente de usuario CUANDO se conduce una locución con cada uno
  ENTONCES el comportamiento es idéntico: la selección es por capacidad y no
  por versión.
- **C-011-21** DADO el módulo importado y sin leer su código CUANDO se lee
  `ADAPTER_CAPABILITIES` ENTONCES declara que puede abrir red y que no toca
  el documento, no persiste, no escribe almacenamiento y no decide turnos.
- **C-011-22** DADO un resultado tardío, cancelado o de otro turno CUANDO
  llega al adaptador ENTONCES no produce efecto y el adaptador no cierra
  ningún turno.
- **C-011-23** DADO el valor de `PATCHES` CUANDO se recorren sus entradas
  ENTONCES `engine` sólo toma `webkit`, `blink` o `both`, nunca el nombre de
  un navegador: un parche de Blink cubre Chrome y Edge con una sola entrada.
- **C-011-24** DADO un doble sin ninguna voz para el idioma declarado CUANDO
  se agota el presupuesto de la locución ENTONCES el resultado es `error` y
  nunca `done` ni `watchdog` (`P-01`, `P-13`).

## Invariantes

- Sólo el evento terminal real produce `done`; ningún temporizador produce
  `done` y `error` y `watchdog` nunca encadenan (`SPEC-003`).
- Todo parche obligatorio tiene síntoma, disparo y prueba; quitar el parche
  deja su prueba en rojo.
- La lista de parches es cerrada, se declara en `PATCHES` y no se ramifica
  por versión de navegador ni por cadena de agente de usuario.
- Tres navegadores, dos motores: un parche de Blink sirve a Chrome y Edge, y
  no hay entradas por navegador.
- El adaptador puede abrir red y lo declara; no persiste, no escribe
  almacenamiento, no toca el documento y no decide turnos.
- El silencio es un caso propio de la escucha, nunca un valor cero.
- Una cancelación propia no es un error y no deja eventos con efecto.
- Un resultado tardío, cancelado o de otro turno es no-op (`SPEC-002`).

**Cobertura de requisitos.** `REQ-18`: C-011-04 a C-011-17 y C-011-24
—una prueba por parche obligatorio, de modo que quitarlo la ponga en
rojo—, más C-011-19, C-011-20 y C-011-23 para la lista cerrada y la matriz
por motor. Los casos C-011-01 a C-011-03, C-011-18, C-011-21 y C-011-22
comprueban la implementación de los puertos `speaker` y `listener` que fijan
`SPEC-001` y `SPEC-003`; no añaden requisitos nuevos.

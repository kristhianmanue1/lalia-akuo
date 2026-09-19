# SPEC-007 — Catálogo de idioma

**Fase:** F1 — entregable de E1 (segunda oleada).
**Cubre:** `REQ-12`; la parte de catálogo de `REQ-7`.
**Procedencia:** `../product/definicion-tecnica-extensiones.md` §6;
`../product/definicion-tecnica-nucleo.md` §4.4 y §4.8;
`../product/definicion-tecnica.md` §9.3 (preguntas C y D) y §9.4;
`../adr/ADR-006-language-packs-spanish-first.md`;
`../adr/ADR-010-distribution-and-first-consumer.md`;
`../adr/ADR-007-no-persistence.md`.
**Depende de:** [`SPEC-001`](SPEC-001-contrato-del-nucleo.md), que fija el
vocabulario (`config.language`, los eventos y los códigos de error). Esta
spec no re-nombra nada de allí.
**Formato:** `../ai-agent-guide/02-specs-adr-contratos.md` §2.2.

```text
SPEC-007 [cubre: REQ-12, REQ-7]
```

## Comportamiento

El núcleo no contiene literales de idioma ni de dominio: **todo texto
visible sale del catálogo por clave** (`ADR-006`). El catálogo es el
mecanismo que convierte una clave y sus ranuras en una cadena; el paquete
de idioma es el dato que ese mecanismo resuelve.

**Forma del paquete.** Un paquete de idioma es un módulo del repositorio
(`ADR-010`) con esta forma cerrada:

```text
pack = {
  language: string,                 // etiqueta BCP-47, minúsculas
  texts: { [key: string]: string }, // plantillas con marcas {slot}
  budget?: {                        // presupuesto de lectura (§4.4)
    maxCharacters: integer >= 1,    // opcional; si falta, rige el de omisión
    maxWords: integer >= 1,
  },
}
```

El paquete aporta, además de los textos, el resto de lo que §6.1 le
encomienda —patrones numéricos, léxico de control con su umbral de
confianza, tablas, rangos y unidades—; esas partes son implementaciones
propias del idioma y sus entregables no son éste. Lo que esta spec fija
es el **contrato del catálogo de textos** y el mecanismo que hace que un
idioma nuevo entre sin tocar el núcleo.

**La etiqueta del idioma (pendiente de §9.4).** La etiqueta se fija en
**`es`** para el primer paquete. Las razones:

1. El paquete es un paquete de **lengua**, no de región: la etiqueta es
   un identificador BCP-47 y su subtag primario describe el idioma.
2. `es` es ya el valor que declara el paquete existente
   (`../../src/i18n/es.js`), el que acepta el esquema y el que afirman
   las pruebas (`../../tests/catalog.test.js`). Fijarlo conserva la
   coherencia entre contrato y código sin reescribir ninguno.
3. Una variante regional —`es-MX`, `es-ES`— es un paquete **distinto**
   que se declara después, con `fallback` explícito hacia `es`. El núcleo
   **no infiere** una variante regional a partir de la etiqueta.
4. La región del primer consumidor es política suya, no una propiedad de
   la biblioteca; hacerla la base del primer paquete la importaría.

La etiqueta se normaliza a minúsculas y se compara de forma **exacta**. El
núcleo no elige paquete por etiqueta: el consumidor pasa el paquete en
`config.language.pack`, y la etiqueta lo identifica y permite comparar el
paquete con su respaldo y con una referencia.

**Interfaz del catálogo.** El módulo `../../src/i18n/catalog.js` expone el
mecanismo; el contrato es éste:

```text
createCatalog(pack, { fallback? }) → catalog
  catalog.language          etiqueta normalizada del paquete
  catalog.has(key)          → booleano
  catalog.text(key, slots)  → string
  catalog.measure(text)     → { within: booleano, … }
  catalog.keys()            → claves del paquete, ordenadas
interpolate(template, slots) → string
verifyPack(pack, reference)  → { missing: string[], extra: string[] }
```

`createCatalog` resuelve `key` en el paquete; sólo si no está y hay
`fallback` la resuelve en el respaldo. `interpolate` sustituye cada marca
`{slot}` por su valor. `measure` es la frontera del presupuesto de lectura:
`within` dice si el texto cabe y todo texto que vaya a hablarse pasa por
ella — un texto fuera de presupuesto no se habla (`REQ-16`,
`definicion-tecnica-nucleo.md` §4.4). `verifyPack` compara un paquete contra
otro de referencia y devuelve qué claves le faltan y qué claves le sobran,
sin lanzar.

**Claves de la biblioteca.** La forma literal de las claves que consumen
los componentes de la biblioteca queda fijada aquí, en una lista cerrada;
no son textos de dominio, sino el vocabulario de mecanismo que el paquete
debe aportar para que el catálogo y la interfaz mínima funcionen:

```text
catalog.missing_text, catalog.missing_placeholder, catalog.invalid_pack,
controls.start, controls.microphoneMute, controls.speechMute,
controls.textInput, controls.stateIndicator, announce.state.idle,
announce.state.listening, announce.state.thinking, announce.state.speaking,
announce.state.error, notice.offDeviceAudio
```

A esta lista cerrada pertenecen, por derivación declarada en `SPEC-001`,
las claves `<promptKey>.readback` y `<promptKey>.saved` que el núcleo
resuelve para la confirmación y el resumen de cada campo declarado.

Un paquete que no traiga una de estas claves se resuelve por
`language.fallback` si está declarado y, si no, es `missing_text`: nunca se
publica la clave cruda. `SPEC-009` consume `controls.*`, `announce.state.*`
y `notice.offDeviceAudio`, así que fijarlas aquí es lo que hace testables
sus casos.

**Composición del texto.** El texto de formulario se resuelve del catálogo
por clave directa, con las ranuras ya validadas: el valor que lleva el
dato no se reformatea. El núcleo **no escribe literales**: pide clave y
ranuras. Esto es lo que hace que el readback sea exacto (la parte de
catálogo de `REQ-7`): el valor entra en la plantilla como ranura y la
cadena resultante es la que se dice.

**Fail-closed de la clave ausente.** §4.4 exige que el contrato **declare**
si una clave ausente es un fallo o si el paquete sustituye una clave de
reserva; no puede resolverse en silencio. La declaración es
`language.fallback`: si está, la sustitución es explícita y declarada; si
no está, la ausencia es un fallo. En los dos casos:

- la clave **cruda nunca llega a pantalla ni a voz**;
- nunca se devuelve cadena vacía ni texto improvisado;
- una plantilla con una marca sin valor **no se publica a medias**: se
  trata como texto que no se puede componer.

**Presupuesto de lectura.** El paquete puede declarar `budget` en caracteres y
palabras, no en segundos: la duración real depende de la voz y del ritmo,
y no es computable antes de hablar (§4.4, §4.9). Un texto compuesto que
excede cualquiera de los dos topes **no se habla**; se emite `failure` con
`code = 'over_budget'` y la salida declarada. En la primera versión el
núcleo cuenta caracteres y palabras separadas por espacios; un idioma con
límites de palabra distintos declara su propio contador en su paquete, y
eso no es de esta etapa.

**Si el paquete no declara `budget`, rige el de omisión, y la omisión nunca
significa «sin tope».** El presupuesto por omisión del núcleo es finito y
provisional: `DEFAULT_READ_BUDGET = { maxCharacters: 400, maxWords: 60 }`. La
razón de esos dos valores es de coherencia interna, no de gusto: tienen que
**dominar al texto legítimo más largo** que el núcleo compone —el readback y
el resumen— y **no ser más estrictos que lo que el tope de locución admite**,
porque un presupuesto de lectura más corto que la locución bloquearía texto
válido por la puerta equivocada, y el fallo aparecería como `over_budget`
cuando el problema sería otro. El tope de locución son 20 s a ritmo lento,
del orden de 60 palabras; de ahí los dos valores. Son provisionales y
medibles: la medición en dispositivo los puede cambiar sin cambiar el
contrato, igual que el de locución y el de turno.

**Un idioma nuevo no toca el núcleo.** Añadir un idioma es añadir un
módulo que exporta un paquete y sus implementaciones propias —patrones
numéricos, léxico de control, umbral, tablas, rangos, unidades y textos—.
El consumidor lo pasa en `config.language.pack` y el núcleo lo resuelve:
no hay despacho por etiqueta dentro del núcleo, así que no hay rama que
editar. `verifyPack(newPack, PACK_ES)` dice de entrada qué claves
faltan y qué claves sobran; vaciar `missing` es la condición de cobertura
mínima. La prueba de `REQ-12` sustituye el paquete por uno de prueba y
comprueba que **todos** los textos hablados cambian, y que el paquete
original sigue resolviendo: la comprobación vale en las dos direcciones.

**Relación con el código actual.** `../../src/i18n/catalog.js` ya
implementa la resolución por clave, la interpolación, el respaldo
declarado, los tres errores de catálogo y la comparación de cobertura;
`../../src/i18n/es.js` ya publica la etiqueta `es`. El contrato de esta
spec **añade** exigencias que el módulo todavía no cumple; las seis
brechas observadas están enumeradas en «Estado de la implementación», más
abajo. Esta spec no reescribe el código.

## Estado de la implementación

`../../src/i18n/catalog.js` y `../../src/i18n/es.js` no cumplen todavía este
contrato. Se registran aquí las seis brechas observadas; cerrarlas es trabajo
del entregable de implementación, no de esta spec:

1. **Sin presupuesto de lectura.** El módulo no lee `pack.budget` ni cuenta
   caracteres ni palabras: `over_budget` no existe y el caso C-007-08 no es
   ejecutable. C-007-05 ya no depende de esto: `budget` es opcional.
2. **Sin validación ni normalización de la etiqueta.** No comprueba que
   `pack.language` sea una etiqueta BCP-47 ni la pasa a minúsculas; C-007-10
   no es ejecutable y C-007-05 queda sin cubrir por esta parte.
3. **Mensajes de error fijos en español.** Importa `PACK_ES` directamente
   para componer `MissingTextError`, `MissingPlaceholderError` e
   `InvalidPackError`, con lo que rompe la independencia del paquete de
   idioma que exige C-007-13.
4. **Sin validación de `texts`.** No comprueba que los valores del catálogo
   sean cadenas no vacías; un valor vacío o de otro tipo publica texto
   inválido. Por esta parte C-007-05 tampoco es ejecutable.
5. **Sin procedencia del respaldo.** `catalog.text()` devuelve la cadena
   pero no declara si salió del paquete o del respaldo, así que el
   consumidor no puede distinguir la sustitución declarada (C-007-09).
6. **Faltan once de las catorce claves de la biblioteca.** `es.js` sólo
   define las tres `catalog.*`; no define `controls.start`,
   `controls.microphoneMute`, `controls.speechMute`, `controls.textInput`,
   `controls.stateIndicator`, `announce.state.idle`,
   `announce.state.listening`, `announce.state.thinking`,
   `announce.state.speaking`, `announce.state.error` ni
   `notice.offDeviceAudio`. Bloquea la resolución de textos de `SPEC-009`
   mientras no se implementen.

Esta spec no reescribe el código: las seis son trabajo de implementación.

## Entradas

- `pack`: paquete con `language` y `texts`; sin alguno de los dos es
  inválido. `budget` es **opcional**: si falta, el núcleo aplica su
  presupuesto por omisión, que es finito y está declarado en el contrato, de
  modo que un paquete que no lo traiga no queda sin tope. Un `budget`
  presente pero mal formado sí es inválido.
- `key`: cadena no vacía; identificador estable que el núcleo pide y
  nunca escribe.
- `slots`: ranuras ya validadas, sin texto libre del consumidor sin
  validar. Un valor de ranura se inserta tal cual; el catálogo no lo
  reformatea.
- `options.fallback`: catálogo de respaldo, opcional. El núcleo construye
  ese respaldo a partir del paquete `config.language.fallback` cuando está
  declarado. Su presencia **declara** que una clave ausente se sustituye;
  su ausencia declara que es un fallo.
- `reference` de `verifyPack`: otro paquete, tomado como referencia de
  cobertura.

## Salidas

- `string` con el texto resuelto, dentro del presupuesto del paquete.
- El catálogo con `language`, `has`, `text` y `keys`.
- El informe de `verifyPack`: `{ missing, extra }`, cada uno ordenado.
- Los dos caminos de texto de §4.4 —formulario y conversacional— usan el
  mismo catálogo; la compuerta que decide qué se habla es de
  [`SPEC-006`](SPEC-006-politica-declarada-y-compuerta.md), no de aquí.

## Errores

| condición | error del catálogo | `code` en la sesión | estado que queda |
|---|---|---|---|
| falta la clave y no hay `fallback` | `MissingTextError` | `missing_text` | no se improvisa texto; salida declarada |
| plantilla con una marca sin valor | `MissingPlaceholderError` | `missing_text` | no se emite texto a medias; salida declarada |
| paquete sin `language` o sin `texts` | `InvalidPackError` | `invalid_config` | no se crea la sesión |
| `budget` presente y mal formado | `InvalidPackError` | `invalid_config` | no se crea la sesión |
| etiqueta que no es BCP-47 normalizable | `InvalidPackError` | `invalid_config` | no se crea la sesión |
| texto compuesto fuera de `budget` —el del paquete o el de omisión— | — | `over_budget` | no se habla; salida declarada |
| el respaldo tampoco tiene la clave | `MissingTextError` | `missing_text` | no se improvisa texto; salida declarada |
| `verifyPack` con un paquete mal formado | `InvalidPackError` | — | no hay informe de cobertura |

Invariantes de error: una clave ausente **nunca** produce la clave cruda
ni una cadena vacía; una ranura sin valor **nunca** produce un texto a
medias; un paquete inválido no crea sesión; un texto fuera de presupuesto
**no se habla**.

## Casos

Identificador estable; los casos nuevos se añaden con el siguiente número
libre.

- **C-007-01** DADO un paquete de prueba con etiqueta `xx` y sus textos
  CUANDO se resuelve una de sus claves ENTONCES devuelve el texto de ese
  paquete y `catalog.language = 'xx'` (`REQ-12`).
- **C-007-02** DADO el paquete `es` CUANDO se resuelve una clave de la
  biblioteca ENTONCES el texto sale del paquete `es` y su etiqueta es
  `'es'`.
- **C-007-03** DADO una clave ausente y **sin** `fallback` CUANDO se pide
  el texto ENTONCES se lanza `MissingTextError`, la clave cruda no
  aparece en ninguna salida y la sesión emite `failure` con
  `code = 'missing_text'` y salida declarada.
- **C-007-04** DADO una plantilla con una marca `{slot}` sin valor CUANDO
  se interpola ENTONCES se lanza `MissingPlaceholderError` y no se emite
  ningún texto a medias.
- **C-007-05** DADO un paquete sin `language` o sin `texts` CUANDO se
  construye el catálogo ENTONCES `InvalidPackError`, y en la sesión
  `ConfigError` con `code = 'invalid_config'`: no se crea sesión.
- **C-007-06** DADO el paquete `es` como referencia y un paquete nuevo
  CUANDO se comparan ENTONCES `verifyPack` devuelve `{ missing, extra }`
  en las dos direcciones y no lanza.
- **C-007-07** DADO el mismo módulo del núcleo sin editar CUANDO se
  sustituye `config.language.pack` por un paquete de prueba con otros
  textos ENTONCES todos los textos hablados cambian y el núcleo no se
  toca; con el paquete original, los textos vuelven a los suyos
  (`REQ-12`, dos direcciones).
- **C-007-08** DADO un texto compuesto que excede `budget.maxCharacters`
  o `budget.maxWords` CUANDO el núcleo va a hablarlo ENTONCES no se habla,
  se emite `failure` con `code = 'over_budget'` y queda la salida
  declarada.
- **C-007-09** DADO `language.fallback` declarado y una clave ausente del
  paquete principal CUANDO se pide el texto ENTONCES sale del respaldo;
  sin `fallback`, la misma clave falla.
- **C-007-10** DADO una etiqueta de paquete con mayúsculas o con una
  variante regional CUANDO se normaliza ENTONCES la comparación es exacta
  sobre la etiqueta en minúsculas y el núcleo no sustituye `es-MX` por
  `es` ni al revés.
- **C-007-11** DADO el texto de readback de un campo CUANDO se compone
  ENTONCES la clave del readback se resuelve del catálogo con el valor
  como ranura validada y el texto no procede del puerto `phrases`
  (`REQ-7`).
- **C-007-12** DADO un valor con parte decimal CUANDO se inserta como
  ranura ENTONCES la cadena lo contiene tal cual, sin redondeo,
  truncamiento ni conversión de unidad (`REQ-7`).
- **C-007-13** DADO el código fuente del paquete del núcleo y las claves
  y textos de dos paquetes de idioma distintos CUANDO se recorren los
  literales del núcleo ENTONCES ninguno de esos textos aparece en el
  núcleo (`REQ-12`).

## Invariantes

- El núcleo no contiene literales, léxico ni gramática de ningún idioma:
  todo texto visible sale del catálogo por clave (`REQ-12`).
- La cadena no visible —claves, códigos y categorías— es independiente
  del idioma del paquete.
- Un idioma nuevo entra como módulo y no exige editar el núcleo.
- Una clave ausente nunca produce la clave cruda, ni cadena vacía, ni
  texto improvisado.
- Una ranura sin valor nunca produce un texto a medias.
- El texto que lleva el dato se compone con plantilla y ranura ya
  validada: lo que se oye coincide con lo que se va a guardar (`REQ-7`).
- El presupuesto se declara en caracteres y palabras; un texto fuera de
  presupuesto no se habla.
- `verifyPack` informa de lo que falta y de lo que sobra sin decidir por
  el consumidor qué hacer con ello.

**Cobertura de requisitos.** `REQ-12`: C-007-01, C-007-02, C-007-06,
C-007-07, C-007-09, C-007-10, C-007-13. `REQ-7` (parte de catálogo):
C-007-03, C-007-04, C-007-11, C-007-12.

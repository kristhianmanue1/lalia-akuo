# PROP-003 — Adaptador real de voz (SPEC-011) por olas

**Propósito:** paquete de propuestas para implementar y medir el adaptador
de motor que `SPEC-011` fija como contrato. Se somete a ronda adversarial
R1 antes de ejecutar nada; el plan operativo es
`PLAN-003-adaptador-spec-011-por-olas.md`.
**Procedencia:** instrucción del Operador del 12-11-2026 (reactivación del
proyecto con tequio como segundo consumidor); `../estado.md` §5 paso 3;
`../specs/SPEC-011-adaptador-web-speech-y-parches.md`; `../adr/ADR-009-browser-targets.md`;
`../adr/ADR-011-compatibility-window.md`; `../product/contrato-de-consumo.md`.
**Fecha:** 12 de noviembre de 2026.

## 0. Por qué ahora y por qué por olas

`estado.md` §5 marca SPEC-011 como «el activo que justifica el proyecto», y
la reactivación le pone consumidor y fecha: tequio necesita formularios
hablados en su UI React antes de que la revisión del modo de distribución
(30-12-2026, `ADR-010`) decida si la copia sigue siendo suficiente. Las
olas separan lo que depende de dispositivos reales de lo que no: la parte
medible con dobles no debe esperar a ningún hardware.

## 1. Propuestas

### O-1 — Adaptador con dobles, sin dispositivo

Implementar `src/adapter/` (código en inglés): una fábrica
`createWebSpeechAdapter(voiceEngine?, runtime?)` que devuelve
`{ speaker, listener }` con las firmas de SPEC-011, más las exportaciones
congeladas `PATCHES` (14 entradas: `id`, `engine`, `symptom`, `trigger`,
`test`) y `ADAPTER_CAPABILITIES`. Superficie del motor inyectada; los
globales del navegador sólo como omisión. Sus pruebas (`tests/spec-011.test.js`) cubren
los 24 casos de la spec con dobles de motor, citando cada `C-011-*`.

**Reloj inyectable (hallazgo HIGH de R1).** Los casos C-011-02, C-011-04 y
C-011-24 exigen que `budgetMs` transcurra, y SPEC-011 no declara ningún
reloj para el adaptador. Propuesta: el segundo parámetro `runtime` con el
**mismo par cerrado del núcleo** —`{ schedule, cancelSchedule }` de
SPEC-001 (`C-001-19`)— y el planificador del entorno como omisión
declarada. Exige enmienda de SPEC-011 §Entradas (declarar la entrada y la
omisión) con procedencia de este hallazgo; los casos existentes la
prueban. En las pruebas, reloj falso: ningún temporizador real decide nada
(receta R4 del contrato).

**Decisión de superficie propuesta:** nueva subentrada de exportación
`"./adapter"` en `package.json` apuntando a `src/adapter/index.js`. La
entrada `"."` no cambia: el núcleo sigue determinista y sin globales, y
quien no usa voz no importa el adaptador. Exige enmienda del contrato de
consumo §1 («entrada única») y §2 (fila nueva en la superficie pública).
**La frontera real es el contrato §2, no `exports`:** bajo consumo por
copia (ADR-010) el mapa `exports` no restringe nada — la enmienda debe
decirlo para que nadie dependa de una barrera mecánica inexistente
(hallazgo LOW de R1).

**Alternativas descartadas:**
- *Exportar desde `src/index.js`:* engorda la superficie del núcleo y crea
  una cadena de importación desde el núcleo hacia código que referencia
  globales del navegador; no hay razón para pagarla.
- *Dejar el adaptador importable sólo por ruta interna:* lo convierte en
  interno según el contrato §2, y SPEC-011 es contrato público (`PATCHES`,
  `ADAPTER_CAPABILITIES`); sería una superficie mentida.

**Costura con la trazabilidad:** al citar los casos `C-011-*`, las pruebas
ponen en rojo la puerta si `estado.md` §2 sigue declarando SPEC-011
`pendiente`. La misma ola que añade las pruebas voltea SPEC-011 a
`implementada` — son la misma verdad, no dos pasos.

### O-2 — Arnés de medición en dispositivos reales

Página instrumental `examples/medidor-spec-011/` (sin paso de construcción,
servida desde la raíz del repositorio, como `tres-campos`): reproduce, una
por una, las condiciones de disparo de los 14 parches contra el motor real,
guía la matriz completa por navegador —las **seis celdas** de `ADR-009`:
Safari macOS, Safari iOS, Chrome escritorio, Chrome Android, Edge
escritorio, Edge móvil; compartir Blink no excusa a ningún navegador de su
medición— y exporta el registro como JSON compacto para evidencia.
**Sonda P-05 aparte** (hallazgo MED de R1): su disparo es `say()` **sin**
activación previa en WebKit móvil, así que el arnés la mide en una carga
fresca sin toque, separada del flujo que sí recoge la activación; para el
resto de parches aplica «un disparo por parche aplicable a cada
navegador/plataforma».

**Alternativa descartada:** automatizar con Playwright como matriz
principal. Playwright no es Safari real ni iOS real, y medir en algo que
no es el motor del navegador sería exactamente la promesa sin medir que
`ADR-009` prohíbe. Queda como mejora opcional posterior, sólo para
regresión de Blink.

### O-3 — Cierre por evidencia: presupuestos, matriz y declaración

Con la matriz medida: (a) fijar `SPEECH_BUDGET_MS` y `TURN_BUDGET_MS` con
valores medidos —las spec los declaran provisionales y la medición puede
cambiarlos sin cambiar contrato—; (b) crear `docs/compatibilidad.md` con la
declaración de objetivo y su **estado de medición** por navegador y
plataforma, referenciada desde el contrato §7; (c) recortar parches sólo si
la evidencia muestra un motor fuera de objetivo (`ADR-011`: la ventana
recorta, nunca alarga); (d) derivar y anotar el piso de versiones que la
ventana implique en esa fecha, si hay publicación.

### O-4 — Orden y rondas

Orden: **O-1 → O-2 → O-3**, cada ola con gate en verde antes y después, y
ronda adversarial sobre el delta de código de cada una (re-ronda hasta
`proceed`). O-1 no depende de dispositivos y desbloquea O-2; O-3 sólo
puede cerrarse con la matriz de O-2. La costura P-05 de O-2 es del arnés
(consumidor de ejemplo), no del núcleo: la biblioteca no gana interfaz.

## 2. Riesgos declarados

- **Dispositivos:** sin Safari real (macOS/iOS) no hay matriz ni ventana
  medida; O-2 queda esperando hardware. No se declara compatibilidad sin
  matriz (`ADR-009`, `estado.md` §6).
- **Presupuesto de lectura:** la ruta va en 1593/1600; las adiciones de
  esta ola (estado §5/§6, contrato, compatibilidad) caben, pero cada ola
  posterior debe volver a contarlo antes de escribir.
- **Fuga de dominio:** tequio nombra inscripción de participantes; nada de
  eso entra aquí. Cada ronda lo comprueba contra la frontera de §7.
- **Doble pila de voz en tequio:** su ecosistema ya trae STT local; si su
  UI resuelve los formularios por esa vía, el adaptador pierde consumidor
  inmediato. No cambia el diseño, sí la urgencia.

## 3. Lo que esta propuesta no hace

No implementa SPEC-009 ni SPEC-010; no toca `src/core/`; no añade receta
React al contrato (espera a la integración real de tequio); no edita nada
en tequio; no publica en ningún registro; no automatiza la matriz; no
declara compatibilidad de nada que no esté medido.

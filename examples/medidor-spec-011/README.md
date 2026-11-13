# Medidor SPEC-011 — guía de medición

Instrumental para medir el adaptador (`SPEC-011`) contra motores reales.
No es producto: es la herramienta de la Ola 2 de
`../../docs/plans/PLAN-003-adaptador-spec-011-por-olas.md`. La matriz es
la de `ADR-009` —tres navegadores en dos plataformas, seis celdas— y la
declaración de compatibilidad sólo sale de aquí, con su estado de
medición (`ADR-011`).

## Cómo se sirve

Desde la **raíz del repositorio** (los imports van por ruta a `src/`):

```bash
python3 -m http.server
# abrir http://localhost:8000/examples/medidor-spec-011/
```

En iOS/Android, sirve desde la raíz en tu computadora y abre la URL
 desde el dispositivo en la misma red.

## Cómo se mide una celda

1. Elige la celda (Safari·macOS, Safari·iOS, Chrome·escritorio,
   Chrome·Android, Edge·escritorio, Edge·móvil) — puedes fijarla en la
   URL con `?cell=<id>` — y recarga.
2. Marca «voz activada por gesto» y recorre un flujo por botón — mide
   **Locución primero**: P-01 se registra con la primera locución
   resuelta de la carga (de cualquier flujo salvo P-13, que no la gasta:
   un idioma sin voz no ejercita la espera de voces). Luego: **P-06**
   (observacional: la condición no se fuerza), **Escucha** (P-07/P-12:
   habla, calla unos segundos y vuelve a hablar — sin habla no hay
   síntoma y no se registran; **P-10 se mide con una segunda pasada del
   mismo botón en silencio total**, dejando agotar los 30 s: ahí el
   silencio sí es la condición), **Doble escucha** (P-08, sin recargar),
   **Permiso denegado** (P-14: deniega el micrófono cuando aparezca la
   petición) y **Cancelación** (P-03/09: la página cancela por ti y
   observa qué queda sin resolver). Para **P-13**, pulsa «Idioma sin voz»:
   el medidor locuta en `qaa` (rango BCP-47 reservado; ningún entorno
   trae voces `qaa-*`, así el disparo siempre se reproduce — con «fr»
   la medición del 2026-11-13 no valió porque había voces francesas).
   **P-04 y P-11 no se registran por diseño**: la duplicación que cazan no
   atraviesa la promesa (la entrega única queda probada con dobles); el
   JSON los lleva como `notObservable` (sólo los aplicables por motor).
   La página **avisa si el navegador no corresponde a la celda** elegida:
   si ves el aviso, corrige `?cell=` antes de medir.
3. Cada parche se registra con el desenlace **observado**; un desenlace
   fuera de los aceptados marca `fail`, y una celda sólo cuenta como
   medida cuando se recorrió todo lo aplicable (la cobertura se deriva
   al exportar).
4. Copia el JSON compacto y pégalo en la celda correspondiente de
   `../../docs/plans/informe-ola-2-medicion.md`.

## Sonda P-05 (aparte, sólo WebKit móvil)

Su condición es **sin activación previa**: carga fresca y sin tocar
nada. Abre directamente
`/examples/medidor-spec-011/?probe=p05`, no marques la casilla de
activación y no toques la pantalla: la locución arranca sola. El
desenlace aceptable es `error` **en el acto**; `watchdog` o `done` son
el síntoma vivo del parche sin cubrir. La sonda se registra
**transversal** (con su `userAgent`), no en la celda del select: nada
de toques previos para atribuirla.

## Qué desenlace acepta cada parche

La tabla vive en `medidor-core.js` (`SCENARIOS`): cada parche declara su
flujo y sus desenlaces aceptables. El registro marca `pass`/`fail` por
parche al exportar. Una celda sin recorrer queda **«sin medir»**: sin
medición no se declara compatibilidad.

## Lo que este arnés no hace

No fuerza condiciones artificiales del motor (no inyecta dobles): mide
el motor tal cual. No publica nada: el registro vive en memoria hasta
que lo copias (sólo la celda elegida queda en `localStorage`, como
confort del operador).

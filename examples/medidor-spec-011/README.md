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
   Chrome·Android, Edge·escritorio, Edge·móvil) y recarga.
2. Marca «voz activada por gesto» y ejecuta **Locución**, **Escucha** y
   **Cancelación**. Para **P-13**, pulsa «Idioma sin voz». Para **P-14**,
   deniega el micrófono cuando aparezca la petición durante una escucha.
3. Copia el JSON compacto y pégalo en la celda correspondiente de
   `../../docs/plans/informe-ola-2-medicion.md`.

## Sonda P-05 (aparte, sólo WebKit móvil)

Su condición es **sin activación previa**: carga fresca y sin tocar
nada. Abre directamente
`/examples/medidor-spec-011/?probe=p05`, no marques la casilla de
activación y no toques la pantalla: la locución arranca sola. El
desenlace aceptable es `error` **en el acto**; `watchdog` o `done` son
el síntoma vivo del parche sin cubrir.

## Qué desenlace acepta cada parche

La tabla vive en `medidor-core.js` (`SCENARIOS`): cada parche declara su
flujo y sus desenlaces aceptables. El registro marca `pass`/`fail` por
parche al exportar. Una celda sin recorrer queda **«sin medir»**: sin
medición no se declara compatibilidad.

## Lo que este arnés no hace

No fuerza condiciones artificiales del motor (no inyecta dobles): mide
el motor tal cual. No publica nada, no persiste nada: el registro vive
en memoria hasta que lo copias.

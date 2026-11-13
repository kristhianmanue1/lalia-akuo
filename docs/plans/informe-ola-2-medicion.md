# Registro de medición — SPEC-011 (Ola 2)

**Registro vivo.** Una fila por celda de la matriz de `ADR-009`; se llena
con el JSON compacto que exporta `examples/medidor-spec-011/` (protocolo
en su README). **Sin medición no se declara compatibilidad** (`ADR-011`):
una celda sin recorrer queda «sin medir», y así se publica.

## Estado de la matriz

Medida por el Operador el **2026-11-13** (~23:05–05:07 UTC-6) con el
medidor servido en `0.0.0.0` (HTTP :8791 en el Mac por `localhost`,
TLS autofirmado :8792 en el iPhone). Evidencia cruda: un JSON por
exportación en [`medicion-2026-11-13/`](medicion-2026-11-13/); la
consolidación por celda, en [`matriz-consolidada.json`](medicion-2026-11-13/matriz-consolidada.json)
(cada parche cita su archivo fuente).

| Celda | Motor | Estado | Fecha | Fuente |
|---|---|---|---|---|
| Safari · macOS | webkit | **medida** — 9/10 válidos; P-13 sin medir válido | 2026-11-13 | `02`, `08`, `11` |
| Safari · iOS | webkit | **medida** — 9/10 válidos; P-13 sin medir válido | 2026-11-13 | `10` |
| Chrome · escritorio | blink | **medida** — 5/6 válidos; P-13 sin medir válido | 2026-11-13 | `03`, `07` |
| Edge · escritorio | blink | **medida parcial** — 4/6; P-12 sin medir (reconocimiento fallido en 2 intentos con micrófono permitido, `06`); P-13 sin medir válido | 2026-11-13 | `04` |
| Chrome · Android | blink | **sin medir** | — | sin dispositivo |
| Edge · Android | blink | **sin medir** | — | sin dispositivo (ver nota de celda) |

**Sonda P-05** (WebKit móvil, sin activación): **medida, `watchdog`,
fail** (`09-iphone-sonda-p05.json`, iPhone, carga fresca sin toque). Es
hallazgo real contra el parche: el motor no señala la falta de activación
y sin señal el desenlace honesto es `watchdog` — ver la enmienda de P-05
en `SPEC-011` y `docs/compatibilidad.md`.

### Notas de la medición

- **P-13 no se midió válido en ninguna celda:** el instrumental usaba
  francés como «idioma sin voz» y los equipos traen voces `fr` (31/19/3);
  el disparo —ninguna voz para el idioma— no se reprodujo y la locución
  terminó `done`. Corregido: el medidor usa `qaa` (rango BCP-47 reservado
  para uso local; ningún entorno instala voces `qaa-*`). P-13 queda
  **pendiente de remedir** (~30 s por celda).
- **Excluidos:** `01` (Edge en Mac registrado como `safari-macos` por
  falta de `?cell`) y `05` (sonda contaminada por toques y celda mal
  etiquetada).
- **Reasignación aceptada:** `11` se exportó bajo `safari-ios` pero su
  `userAgent` es `… Version/27.2 Safari/605.1.15` con `platform:
  MacIntel` — Safari de macOS; se cuenta como **P-14 de safari-macos**
  (el propio iPhone aporta su P-14 en `10`).
- **Celda Edge móvil:** Edge en iOS usa WebKit, no Blink: no es un motor
  nuevo (la cobertura WebKit móvil la da `safari-ios`) y la celda `blink`
  corresponde a **Edge en Android**. El medidor ya la etiqueta así.
- Dispositivos: macOS (Safari 27.2, Chrome 157 y 149, Edge 149) e
  iPhone iOS 18.7 (Safari 27.2). Sin más datos de equipo que el
  `userAgent` registrado en cada JSON.

## Mediciones

Consolidación por celda (una línea; el detalle por parche, con su archivo
fuente, vive en `medicion-2026-11-13/matriz-consolidada.json`):

```
2026-11-13 · safari-macos    · webkit · P-01 done, P-02 done, P-03 done, P-06 done, P-07 speech, P-08 speech, P-09 cancelled-clean, P-10 no_speech, P-14 recognition_failed · P-13 sin medir válido
2026-11-13 · safari-ios      · webkit · P-01 done, P-02 done, P-03 done, P-06 done, P-07 speech, P-08 no_speech, P-09 cancelled-clean, P-10 no_speech, P-14 recognition_failed · P-13 sin medir válido
2026-11-13 · chrome-desktop  · blink  · P-01 done, P-02 done, P-03 done, P-12 speech (15 parciales), P-14 recognition_failed · P-13 sin medir válido
2026-11-13 · edge-desktop    · blink  · P-01 done, P-02 done, P-03 done, P-14 recognition_failed · P-12 y P-13 sin medir
2026-11-13 · sonda P-05 (iPhone, ?probe=p05) · watchdog · fail
```

## Reglas de llenado

1. Una celda se marca medida sólo con su JSON pegado arriba, la fecha,
   y cobertura completa de sus parches aplicables (el JSON la lleva).
2. Un parche con desenlace fuera de `accept` queda `fail` en el JSON:
   no se corrige a mano; se investiga contra `SPEC-011`.
3. La sonda P-05 se registra aparte (transversal, con `userAgent`),
   nunca en la celda del select ni con activación previa.
4. El piso de versiones por ventana (`ADR-011`) se deriva en la
   publicación, no aquí; aquí se registra el `userAgent` tal cual lo
   reporta la página.

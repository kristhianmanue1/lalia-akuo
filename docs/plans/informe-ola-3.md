# Informe — Ola 3 (T-03): matriz medida, compatibilidad y enmienda P-05

**Fecha:** 13 de noviembre de 2026 · **Rama:** `agent/ola-3-t03`
**Mandato:** `/var/tmp/asistente2/mandato-lalia-matriz-ola3.md`
(ASISTENTE2), con autorización expresa del Operador para registrar la
matriz que él midió, corregir el instrumental y ejecutar la Ola 3;
revisión adversarial visible (pane hermano, OpenCode GLM) y merge por
avance rápido tras `proceed`.

## 1. Qué se ejecutó

1. **Matriz registrada** en `informe-ola-2-medicion.md`: 4 celdas medidas
   (safari-macos 9/10, safari-ios 9/10, chrome-desktop 5/6, edge-desktop
   4/6) + sonda P-05 (`watchdog`); `chrome-android` y `edge-mobile` sin
   medir; P-13 «sin medir válido» en todas (voces `fr` instaladas: el
   disparo no se reprodujo); exclusiones `01`/`05` y **reasignación
   aceptada de `11`** (userAgent `Safari/605.1.15` + `MacIntel` → P-14 de
   safari-macos; el iPhone aporta el suyo en `10`). Evidencia cruda: 12
   JSON en `medicion-2026-11-13/`.
2. **`docs/compatibilidad.md`**: objetivo por ventana (`ADR-011`), estado
   por celda, sonda como hallazgo, **sin declarar compatibilidad** (dos
   celdas sin medir y P-13/P-12-edge pendientes), techos 20000/30000
   confirmados (locuciones 1,9–3,4 s), sin recortes. Enlazado desde el
   contrato §7.
3. **Enmienda P-05** en SPEC-011 con la sonda real como procedencia: con
   señal del motor, `error` en el acto; **sin señal, `watchdog` con voz
   presente** — y el caso C-011-08 acotado al doble que señala, más el
   caso nuevo **C-011-26** para la rama sin señal (26 casos, total 194).
4. **Instrumental corregido**: P-13 con `qaa` (rango BCP-47 reservado);
   celda `edge-mobile` = Edge · Android (Edge en iOS es WebKit, no aporta
   motor); `cellMatchesUserAgent` con aviso visible (los tres errores de
   etiqueta de esa noche ya son detectables por la página).
5. **Servidores del medidor detenidos** (8791/8792, verificados como
   míos antes del `kill`).

## 2. Evidencia

- `npm run gate` en cada commit → OK (122 archivos, ruta 1599/1600 neto
  cero en `estado.md`) [pass]
- `npm test` al cierre → **198 pass** (26 casos de SPEC-011 con prueba;
  trazabilidad en verde) [pass]
- Cross-check de los 12 JSON contra registro y declaración → conteos,
  outcomes, userAgent y fuentes coinciden [pass: verificación del revisor]
- `git diff 4ea5a8b^ 4ea5a8b | grep -c '^src/'` → **0**: `src/` intacto
  en toda la ola [pass]

## 3. Rondas (registro completo en PLAN-003 §Rondas)

| Ronda | Revisor | Veredicto | Hallazgos |
|---|---|---|---|
| R5 | lalia-r5 → cortado por cuota Z.AI; reanudado como lalia-r5b (GLM, pane hermano) | fix-and-retry | 1 HIGH (C-011-08 vs rama sin señal), 1 MED (accept del escenario P-05), 2 LOW (narrativa P-12/P-14) |
| R5c | lalia-r5b | **proceed** | 1 LOW cosmético, restaurado en el cierre |

## 4. Pendientes declarados (para el coordinador, con recomendación)

- **Remedir P-13** con `qaa` (~30 s por celda) y **P-12 en Edge** en la
  próxima sesión de medición; con eso, `compatibilidad.md` puede declarar
  las cuatro celdas de escritorio. Recomendación: hacerlo junto con la
  integración de tequio, que necesita la ventana.
- `chrome-android` y `edge-mobile` siguen sin medir: sin dispositivo
  Android no hay declaración móvil Blink; recomendación: declarar el
  objetivo móvil cubierto por WebKit (safari-ios) y dejar Blink móvil
  «sin medir» hasta haber dispositivo.
- El hallazgo de la sonda (WebKit iOS no señala la falta de activación)
  queda abierto hasta la costura de activación de SPEC-009.

FIN ola-3 R5 fix-and-retry (1H/1M/2L) corregidos · R5c proceed · gate en verde (122 archivos, ruta 1599/1600, 198 pruebas) · matriz registrada sin declarar compatibilidad · remedir P-13 (qaa) y P-12-edge

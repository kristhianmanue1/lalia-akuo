# Informe — Ola 2b: cierre de los LOW residuales del arnés

**Fecha:** 12 de noviembre de 2026 · **Rama:** `agent/ola-2b-lows`
**Orden:** cerrar los 4 LOW residuales de R3d (informe-ola-2 §4) con sus
tests, manteniendo la honestidad del registro —lo que no se observa no se
registra—. **La medición física de la matriz queda pendiente de decisión
del Operador: no se midió nada ni se tocó el registro.** Ronda con
revisor OpenCode GLM de contexto fresco, gates en verde, PR y merge por
avance rápido tras `proceed`.

## 1. Qué se cerró (LOW por LOW)

1. **Rama muerta del aviso de P-01:** el aviso pasa a ANTES de la
   locución (alcanzable) y la rama muerta desaparece; `speakOnce` recibe
   `{flow}` y el registro de P-01 lleva el flujo de proveniencia en su
   detail.
2. **`notObservable` sin cruce por motor:** nueva `notObservableFor(cellId)`
   en `medidor-core.js` —cruza `observable:false` con los aplicables por
   motor— y `exportar()` la usa por celda: webkit exporta `['P-04']`,
   blink `['P-04','P-11']`.
3. **Protocolo de P-10:** el README instruye su segunda pasada en
   silencio total (dejando agotar los 30 s), recomienda «Locución
   primero» para que P-01 refleje la primera locución de la carga, y
   acota el inciso de silencio a P-07/P-12.
4. **P-13 no gasta P-01:** un idioma sin voz resuelve error sin ejercitar
   la espera de voces que P-01 mide; `speakOnce` no gasta el flag con
   ese flujo (razón comentada en el código), el flujo lo loguea, y el
   test documental fija las tres frases del protocolo.

## 2. Evidencia

- `node --check` de `medidor.js` y `medidor-core.js` → OK [pass]
- `node --test tests/medidor-core.test.js` → **11 pass** (+2 nuevos:
  cruce de `notObservableFor`, protocolo documental) [pass]
- `npm run gate` → OK: 108 archivos, ruta 1599/1600, **195 pass** [pass]
- Servido efímero + curl → 200 en página, `medidor.js`, `medidor-core.js`
  y `/src/adapter/index.js` [pass]

## 3. Ronda R4 (12-11-2026)

Veredicto: **proceed**, con los 4 LOW verificados cerrados y un LOW nuevo
declarado con seguimiento: el JSON aún no distingue los null «no aplica
por motor» de los null «pendiente» (p. ej. P-11 en una celda webkit); el
revisor sugiere un `notApplicableFor` análogo o cubrirlo en la leyenda.
No se tocó en esta ola para no reabrir el ciclo cerrado; queda como
seguimiento del arnés.

Regla de honestidad verificada por el revisor: ningún `record()` del delta
escribe sin observación, y nada del commit mide ni insinúa medición
física.

## 4. No cubierto (declarado)

- La matriz sigue íntegramente «sin medir» (seis celdas y sonda), como
  manda la orden: la medición espera dispositivos del Operador.
- La Ola 3 (presupuestos medidos, recortes por evidencia,
  `docs/compatibilidad.md`) sigue bloqueada por esa medición.

## 5. Siguiente decisión

La del Operador sobre dispositivos para la matriz; con ella llenada, la
Ola 3. Sin hardware, sólo queda el LOW de legibilidad del JSON como
seguimiento menor.

FIN ola-2b R4 proceed con 4 LOW de R3d cerrados y 1 LOW nuevo declarado (null por motor sin etiquetar) · gate en verde (108 archivos, ruta 1599/1600, 195 pruebas) · matriz sin medir, pendiente del Operador

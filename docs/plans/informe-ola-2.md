# Informe — Ola 2 (T-02): arnés de medición de SPEC-011

**Fecha:** 12 de noviembre de 2026 · **Rama:** `agent/ola-2-t02`
**Orden:** «analiza y continua» — interpretado, con el precedente de las
olas 0 y 1, como autorización para ejecutar la Ola 2 (T-02) bajo el mismo
régimen: rama propia, gates en verde por commit, rondas adversariales con
revisores OpenCode GLM de contexto fresco en sólo lectura, y PR con merge
por avance rápido tras `proceed`.

## 1. Qué se ejecutó

1. `examples/medidor-spec-011/` — el arnés completo: núcleo sin DOM
   (`medidor-core.js`: seis celdas de `ADR-009`, catorce escenarios con
   desenlaces que discriminan, registro vivo, cobertura derivada), cableo
   del navegador (`medidor.js`), página (`index.html`) y guía de medición
   (`README.md`). Servido desde la raíz del repositorio, sin construcción.
2. La **costura de activación** (gesto antes de locución/escucha) y la
   **sonda P-05 aparte** (`?probe=p05`): carga fresca sin toque, locución
   automática, registro transversal con `userAgent`.
3. `tests/medidor-core.test.js` — humo del aparato (9 pruebas), sin citar
   casos `C-*`: celdas, escenarios cruzados contra `PATCHES` del adaptador,
   discriminación de desenlaces, registro vacío, cobertura.
4. `docs/plans/informe-ola-2-medicion.md` — el registro vivo de la matriz:
   las **seis celdas y la sonda declaradas «sin medir»**, con las reglas de
   llenado y sin insinuación de medición que no ocurrió.

## 2. Evidencia

- `npm run gate` en cada commit de la rama → OK (107 archivos, ruta
  1599/1600 sin cambios) [pass]
- `node --test tests/medidor-core.test.js` → 9 pass [pass]
- `npm test` al cierre → **193 pass** (184 de antes + 9 del humo) [pass]
- Servido efímero desde la raíz + curl → 200 en la página, `medidor.js`,
  `medidor-core.js` y `/src/adapter/index.js` [pass]
- Sin dispositivos recorridos: ninguna celda se midió y así se declara.

## 3. Rondas (resumen; la sustancia vive en los commits)

| Ronda | Objeto | Veredicto | Hallazgos | Disposición |
|---|---|---|---|---|
| R3 | arnés inicial (dade277) | fix-and-retry | 2 HIGH, 5 MED, 3 LOW | corregidos en 2ea544c |
| R3b | delta corregido | fix-and-retry | 1 HIGH, 4 MED, 3 LOW | corregidos en b768d43/d33a32e |
| R3c | delta corregido | fix-and-retry | 3 MED, 1 LOW | corregidos en f11af30 |
| R3d | delta final | **proceed** | 4 LOW declarados | residuales, abajo |

Lo que las rondas le sacaron al arnés (ya incorporado): P-03/P-09 pasaron
de desenlaces **fabricados** a observados (carrera real de 2 s, callbacks
contados sólo tras la cancelación); P-08/P-14 ganaron flujo propio — la
doble escucha **sobre el mismo listener**, que el desplazamiento es el
comportamiento parcheado; P-04/P-11 quedaron **no observables por diseño**
(la duplicación no atraviesa la promesa; declararlo sería evidencia
fabricada); la sonda se volvió transversal con `userAgent`; «medida» pasó
a ser cobertura derivada del recorrido; P-01 se gasta en la primera
locución resuelta; P-07/P-12 sólo se registran con evidencia de habla.

## 4. Residuales declarados (LOW, con seguimiento)

- De R3d: rama muerta del aviso de P-01 en `medirLocucion`;
  `notObservable` sin cruzar con aplicabilidad por motor; el README no
  instruye la segunda pasada en silencio que mide P-10; P-01 puede
  gastarse con el flujo P-13 (proveniencia no registrada en el detail).
- De la Ola 1 (ya declarados ahí): sonda del `catch` con getter hostil;
  borde defensivo con `budgetMs` hostil.

## 5. No cubierto por esta ola (declarado)

- **Ninguna celda medida**: sin dispositivos no hay matriz ni ventana; el
  registro vive en `informe-ola-2-medicion.md` con las seis celdas y la
  sonda en «sin medir». La Ola 3 (presupuestos medidos, recortes por
  evidencia, `docs/compatibilidad.md`) **no puede cerrarse sin esa
  medición**.
- La ruta de lectura sigue a 1599/1600: la Ola 3 debe contar su presupuesto
  antes de tocar `estado.md` o crear `docs/compatibilidad.md` (que NO está
  en la ruta, pero conviene declararlo al crearlo).

## 6. Siguiente decisión

Poner dispositivos a medir (Safari macOS/iOS, Chrome escritorio/Android,
Edge escritorio/móvil) con el protocolo del README y llenar el registro;
con la matriz medida, autorizar la **Ola 3 (T-03)**. Sin dispositivos, lo
único ejecutable son los residuales LOW del arnés.

FIN ola-2 R3 10 hallazgos (2H/5M/3L) · R3b 8 (1H/4M/3L) · R3c 4 (3M/1L) · R3d proceed con 4 LOW declarados · gate final en verde (107 archivos, ruta 1599/1600, 193 pruebas) · arnés entregado; seis celdas y sonda sin medir

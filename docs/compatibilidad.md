# Compatibilidad — estado de medición

**Qué es.** La declaración de compatibilidad de lalia-akuo con su estado
de medición, como exige `ADR-011`: la ventana de tiempo define el
**objetivo** (motores cuya primera versión estable se publicó en los
cuatro años anteriores a una publicación), y **nada se declara
compatible sin medirlo**. La matriz es la de `ADR-009`: tres navegadores
en dos plataformas, por motor (WebKit = Safari; Blink = Chrome y Edge).
La medición se hace con [`examples/medidor-spec-011/`](../examples/medidor-spec-011/)
y su registro vivo está en [`plans/informe-ola-2-medicion.md`](plans/informe-ola-2-medicion.md)
(evidencia cruda en [`plans/medicion-2026-11-13/`](plans/medicion-2026-11-13/)).

**Última actualización:** 13 de noviembre de 2026 (Ola 3 de
[`plans/PLAN-003-adaptador-spec-011-por-olas.md`](plans/PLAN-003-adaptador-spec-011-por-olas.md)).

## Matriz de medición

| Celda | Motor | Estado | Detalle |
|---|---|---|---|
| Safari · macOS | webkit | **medida** 2026-11-13 | 9/10 válidos; sólo P-13 sin medir válido |
| Safari · iOS | webkit | **medida** 2026-11-13 | 9/10 válidos; sólo P-13 sin medir válido |
| Chrome · escritorio | blink | **medida** 2026-11-13 | 5/6 válidos; P-13 sin medir válido |
| Edge · escritorio | blink | **medida parcial** 2026-11-13 | 4/6; P-12 sin medir (reconocimiento falló con permiso concedido, causa sin determinar) y P-13 sin medir válido |
| Chrome · Android | blink | **sin medir** | sin dispositivo |
| Edge · Android | blink | **sin medir** | sin dispositivo (Edge en iOS es WebKit, no una celda blink) |

**Sonda P-05** (WebKit móvil sin activación): **medida, `watchdog`,
fail** — el motor no señala la falta de activación y, sin señal, el
desenlace honesto del adaptador es `watchdog` (`SPEC-011` enmendado el
13-11-2026). El aviso y la recogida de activación son la costura de
`SPEC-009`; hallazgo abierto hasta esa capa.

## Qué se declara y qué no

- **No se declara compatibilidad** de ninguna celda: dos de seis están
  sin medir y dos huecos (P-12 en Edge, P-13 en todas) esperan
  remedición; con la matriz incompleta, declararla sería la promesa sin
  medir que este proyecto existe para evitar.
- **P-13 queda pendiente de remedir** en las cuatro celdas (~30 s por
  celda): la medición del 13-11-13 no reprodujo su disparo (voces `fr`
  instaladas); el medidor ya usa `qaa`, sin voces posibles.
- **Ningún parche se recorta** (`ADR-011`: la ventana sólo recorta con
  evidencia de motor fuera del objetivo, y no la hay).
- **Los techos provisionales no cambian**: `SPEECH_BUDGET_MS = 20000` y
  `TURN_BUDGET_MS = 30000` (`SPEC-003`/`SPEC-004`) dominan con margen lo
  medido — locuciones completas de 1,9 a 3,4 s y escuchas dentro de su
  presupuesto; la medición no los contradice.
- El **piso de versiones por ventana** se deriva y anota en la primera
  publicación, como consecuencia de la política (`ADR-011`); hoy no hay
  publicaciones, sólo consumo por copia (`ADR-010`).

## Cómo cambia este documento

Por medición nueva registrada en el registro vivo, o por enmienda de
spec/ADR con su caso y su prueba; nunca por edición silenciosa.

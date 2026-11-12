# Registro de medición — SPEC-011 (Ola 2)

**Registro vivo.** Una fila por celda de la matriz de `ADR-009`; se llena
con el JSON compacto que exporta `examples/medidor-spec-011/` (protocolo
en su README). **Sin medición no se declara compatibilidad** (`ADR-011`):
una celda sin recorrer queda «sin medir», y así se publica.

## Estado de la matriz

| Celda | Motor | Estado | Fecha | Fuente |
|---|---|---|---|---|
| Safari · macOS | webkit | **sin medir** | — | — |
| Safari · iOS | webkit | **sin medir** | — | — |
| Chrome · escritorio | blink | **sin medir** | — | — |
| Chrome · Android | blink | **sin medir** | — | — |
| Edge · escritorio | blink | **sin medir** | — | — |
| Edge · móvil | blink | **sin medir** | — | — |

**Sonda P-05** (WebKit móvil, sin activación): **sin medir** · —.

El arnés se entregó el 12-11-2026 (Ola 2 de
`PLAN-003-adaptador-spec-011-por-olas.md`) con su prueba de humo en
`../../tests/medidor-core.test.js`. Esta sesión no midió ningún
navegador: no hubo dispositivos recorridos, y declarar lo contrario sería
la promesa sin medir que el proyecto existe para evitar.

## Mediciones

(cada celda medida se registra como una línea de JSON compacto, con la
fecha y el dispositivo; nada más)

```
— aún ninguna —
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

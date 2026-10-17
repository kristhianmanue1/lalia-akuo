# Ejemplo — tres campos por voz

Un consumidor de lalia-akuo, mínimo y completo: tres campos declarativos
(edad, peso, minutos), confirmación leída y degradación a texto cuando no
hay motor. Sin construcción y sin dependencias.

## Correrlo

**Con página (con o sin voz según el navegador):** el servidor debe
enraizar en la raíz del repositorio — la página importa `src/index.js` por
ruta relativa y con el servidor enraizado en este directorio ese import da
404:

```bash
python3 -m http.server 8000          # desde la raíz del repositorio
# abre http://localhost:8000/examples/tres-campos/
```

El aviso de audio fuera del dispositivo es visible antes de cualquier
petición de micrófono. Si el navegador trae `SpeechRecognition`, la página
conecta `voz-navegador.js` —un adaptador **de ejemplo, sin medir y sin los
parches de SPEC-011**—; si no, el flujo continúa por texto por su camino
declarado.

**Sin navegador (determinista + texto):** la prueba de humo
`tests/ejemplo-tres-campos.test.js` corre el mismo cableo en Node:

```bash
node --test tests/ejemplo-tres-campos.test.js
```

## Qué muestra

- **Campos declarativos** y claves derivadas `<promptKey>.readback` /
  `<promptKey>.saved` (SPEC-001).
- **Paquete regional**: `es-mx` propio con respaldo explícito al `PACK_ES`
  de la biblioteca (SPEC-007 §3).
- **Puertos**: los intérpretes de números y sí/no son puertos inyectados
  (SPEC-004); el dominio vive en el consumidor.
- **Sin motor, no hay simulación**: el `speaker` por omisión falla por
  contrato, la sesión degrada a entrada manual y todo sigue por
  `submitText`.
- **Vista**: los cinco elementos y el anuncio por cambio de estado
  (SPEC-009 vista desde el consumidor); el núcleo no toca el DOM.

Las recetas completas de cableo están en el
[contrato de consumo](../../docs/product/contrato-de-consumo.md) §10.

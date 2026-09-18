# ADR-004: Interfaz de transporte más un relay de referencia que no es producto

**Estado:** aceptado. Implementación: no iniciada (etapa posterior al núcleo).
**Fecha:** 18-sep-2026.
**Fuente:** instrucción humana del 18-sep-2026 (`alubia:PROP-005 §8`,
PREGUNTA-3).

## Contexto

Hay que decidir si el canal de agente trae backend propio —y con él,
infraestructura que el proyecto opera— o si se declara «trae tu transporte».
La decisión define si el proyecto sostiene servicio en producción,
credenciales de terceros y disponibilidad.

Del análisis previo se sabe además que un puente local hacia un proceso con
`stdio` ya produjo una vulnerabilidad de ejecución remota de comandos en una
herramienta de referencia del ecosistema, y que la especificación de MCP no
norma CORS: el navegador no es cliente directo de un servidor MCP.

## Decisión

Se reparte una **interfaz de transporte** y un **relay de referencia que no es
producto**. El proyecto **no opera infraestructura en producción**.

La interfaz admite implementaciones por WebSocket, por eventos de servidor y
por mensajería de ventana para incrustar en un host. El relay se documenta y
se prueba como referencia; no se presenta como producto ni se promete su
operación.

## Alternativas descartadas

- **Backend propio operado como producto.** Obliga a sostener
  disponibilidad, cuentas, cuotas y datos de terceros: no objetivos del
  proyecto y superficie de seguridad que nadie pidió.
- **«Trae tu transporte» sin referencia.** Sin un relay mínimo no hay forma
  de probar el canal de punta a punta ni de mostrar el contrato funcionando;
  el coste de adopción lo paga cada consumidor.
- **Puente local hacia `stdio`.** Es el patrón que ya produjo una
  vulnerabilidad de ejecución remota; queda prohibido en vez de desaconsejado.

## Consecuencias

- Nadie está obligado a operar el relay en producción, y el proyecto no
  responde por su disponibilidad.
- El proyecto no custodia credenciales de agentes ni de terceros.
- El relay prohíbe `stdio` expuesto al navegador, exige token por sesión y
  validación de origen con rechazo explícito.
- El consumidor que quiera canal de agente en producción aporta su propio
  transporte por la interfaz, bajo su política de datos.
- El alcance exacto que se publica con la primera versión quedó resuelto: la
  interfaz de transporte y el relay de referencia no entran en ella
  (`docs/product/definicion-tecnica.md` §9.3, pregunta B).

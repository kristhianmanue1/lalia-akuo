# ADR-003: El canal de agente entra después de estabilizar el núcleo

**Estado:** aceptado. Implementación: no iniciada (F1 en diseño).
**Fecha:** 18-sep-2026.
**Fuente:** instrucción humana del 18-sep-2026 (`alubia:PROP-005 §8`,
PREGUNTA-2).

## Contexto

El encargo inicial pedía dos cosas a la vez: armar formularios hablados y
conversar con un agente de IA. Lo que hace valiosa la capa de voz no es que
hable, sino que **un modelo no decide nada**: el valor está en la disciplina
de turno, la confirmación explícita y la degradación a manual.

Construir las dos capas a la vez invita a mezclarlas. El día que un consumidor
active el agente sobre un flujo cuya garantía depende del núcleo, se pierden
exactamente las propiedades que justifican la extracción.

## Decisión

El canal de agente **no entra en la primera versión**. El núcleo determinista
se estabiliza primero, con alubia como cliente y prueba; el canal de agente es
la etapa siguiente del mismo ciclo de vida.

Del canal de agente, F1 fija **solo sus fronteras** —protocolo, superficie de
herramientas y punto de declaración de política de datos—, porque son
prerequisito para no rehacer el núcleo cuando la etapa se ejecute.

## Alternativas descartadas

- **Construir núcleo y agente juntos.** Es el riesgo explícito del análisis:
  mezclar capas destruye la auditabilidad y convierte la garantía del núcleo
  en una promesa que el agente puede rodear.
- **Dejar el canal fuera incluso del diseño.** Habría obligado a rehacer
  turno, transporte e interpretación al habilitarlo, que es justo lo que la
  decisión evita.

## Consecuencias

- La etapa del canal de agente no empieza antes de que el núcleo tenga su
  ronda adversarial con veredicto favorable (`E2-08` de
  `alubia:PROP-005 §9`).
- El agente queda sin autoridad por contrato: propone texto y acción, nunca
  transiciona, nunca fija valores y nunca persiste.
- El primer conjunto publicado no incluye el canal de agente.
- La ambigüedad de fuente sobre el alcance exacto del primer conjunto
  publicado —`alubia:PROP-005 §5.2` listaba la interfaz de transporte y el
  relay dentro de la primera versión, y esta decisión los sitúa después del
  núcleo— quedó resuelta a favor de esta decisión y de `REQ-14`:
  `docs/product/definicion-tecnica.md` §9.3, pregunta B.

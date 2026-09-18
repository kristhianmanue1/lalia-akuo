# lalia-akuo — definición técnica: canal de agente

**Sección §7 del conjunto F1.** Entrada y mapa del conjunto:
[`definicion-tecnica.md`](definicion-tecnica.md).
**Documentos hermanos:** [`definicion-tecnica-frontera.md`](definicion-tecnica-frontera.md)
(§1-§3), [`definicion-tecnica-nucleo.md`](definicion-tecnica-nucleo.md) (§4),
[`definicion-tecnica-extensiones.md`](definicion-tecnica-extensiones.md)
(§5-§6).

Los números de sección son únicos en el conjunto: una referencia `§N` se lee
en el documento que contiene esa sección, aunque quien la escriba esté en
otro.

## 7. Fronteras del canal de agente

### 7.1 Qué es y qué no es

El canal deja que un agente reciba el estado de la sesión y devuelva **texto y
propuesta de acción, nunca estado**. Que el agente no pueda transicionar por
contrato es la razón de que el canal exista como capa aparte: si pudiera,
activarlo sobre un flujo perdería las garantías del núcleo.

**No entra en la primera versión.** Lo que F1 fija son sus fronteras, porque
son prerequisito para no rehacer el núcleo cuando la etapa se ejecute.

### 7.2 Protocolo (frontera)

Antes de mostrar o pronunciar **cualquier** texto del agente, el núcleo aplica
sus validaciones, no solo la de esquema:

1. esquema válido y versión soportada;
2. la acción propuesta está permitida en el estado actual;
3. el campo corresponde al paso activo;
4. un candidato pasa analizador, tipo, precisión y rango;
5. el texto pasa el filtro que el consumidor haya declarado;
6. `safety_class` obra como compuerta: una clase bloqueada no se habla;
7. toda transición sensible exige confirmación explícita.

Propiedades de la frontera:

- **El agente no envía valores de campo.** Los propone, y el núcleo los
  valida contra su tabla.
- **El texto de entrada de la persona es dato no confiable.** La biblioteca
  no lo clasifica: declarar si es sensible, si puede salir del dispositivo y
  con qué retención es política del consumidor, y el punto donde declararlo
  es parte del contrato (`definicion-tecnica-nucleo.md` §4.5).
- **El cursor del turno lo custodia el consumidor** —su servidor—, no la
  página ni la biblioteca, que no persiste. Un cursor que no coincide con el
  turno esperado se descarta como no-op; no se aplica «lo más parecido».
- **La versión del esquema viaja en cada mensaje**, igual que la sesión y el
  cursor.

El detalle del protocolo, sus campos y su esquema son entregables de E1. El
esquema de mensajes que el primer consumidor fijó para su propia evolución se
cita como procedencia y **no se adopta como base** del protocolo de la
biblioteca: la base la fija E1 con las propiedades de esta sección, y cada
consumidor puede declarar su perfil sobre ella.

### 7.3 Transporte y relay de referencia

El reparto es **interfaz de transporte** más un **relay de referencia que no
es producto**:

- la interfaz admite implementaciones por WebSocket, por eventos de servidor
  y por mensajería de ventana para incrustar en un host;
- el relay se documenta y se prueba, pero no se presenta como producto ni se
  promete su operación;
- el proyecto **no opera infraestructura en producción** y no custodia
  credenciales de agentes.

### 7.4 MCP

**Sin servidor MCP en la primera versión.** Cuando llegue, será paquete aparte
con la versión de especificación fijada, y su superficie de herramientas
habrá estado declarada desde antes.

Restricciones ya fijadas para ese paquete: validación de origen con rechazo
explícito, token por sesión, y `stdio` nunca expuesto al navegador. La razón
está registrada en `ADR-005`, incluido el patrón que ya produjo una
vulnerabilidad de ejecución remota de comandos en una herramienta de
referencia del ecosistema.

### 7.5 Qué implica el aplazamiento

- El primer conjunto publicado **no incluye** el canal de agente.
- El canal no empieza antes de que el núcleo tenga su ronda adversarial con
  veredicto favorable.
- Lo que sí se diseña ahora es su frontera: protocolo, validación, superficie
  de herramientas y punto de declaración de política. Diseñarla no es
  implementarla.
- La ambigüedad de fuente queda **resuelta**: `REQ-14` excluye la pieza del
  canal de la primera versión y la decisión humana de secuencia la sitúa
  después del núcleo. `alubia:PROP-005 §5.2` lo listaba dentro de la primera
  versión, pero es anterior y de otro repositorio. El cierre, con su
  consecuencia, está en `definicion-tecnica.md` §9.3 (pregunta B).

# lalia-akuo — definición técnica

**Fase F1.** Fija diseño, fronteras, contratos y decisiones antes de
construir. **Entrada:** el F0 del proyecto (`plan.md`: problema, resultado
observable, `REQ-*` y no objetivos; su §7 fija la frontera mecanismo/política
y su §8 las decisiones humanas del 18-sep-2026). **Salida:** lo que F2 y F3
deben respetar. Las secciones §1-§7 viven en los documentos del mapa; éste es
el documento de entrada del conjunto.

**Estado:** diseño cerrado con las **diez decisiones P0** de §8. No autoriza
implementación: no se escribe código antes de cerrar E1 (§11).

**Convención de citas.** `alubia:<documento>` designa un documento del
repositorio externo del proyecto alubia; no es una ruta de este repositorio ni
lo rige. La propuesta de la que nace este diseño vive allí y se cita como
`alubia:PROP-005 §n`. Las rutas `docs/…` y `ADR-00n-…md` sí son de este
repositorio.

**Convención de numeración.** Los cinco documentos del conjunto F1 comparten
una sola numeración de secciones: `§N` se lee en el documento que contiene esa
sección, aunque quien la escriba esté en otro. Cada documento declara su rango
en su encabezado.

## Mapa del conjunto F1

| Documento | Secciones | Contiene | Cuándo leerlo |
|---|---|---|---|
| **este** (`definicion-tecnica.md`) | §8-§11 | decisiones P0 con su criterio de prueba, alcance excluido, preguntas cerradas y abiertas, trazabilidad con el F0 y gate | siempre: es la entrada |
| [`definicion-tecnica-frontera.md`](definicion-tecnica-frontera.md) | §1-§3 | qué es la biblioteca, la frontera mecanismo/política, las capas y los navegadores objetivo | antes de leer cualquier contrato |
| [`definicion-tecnica-nucleo.md`](definicion-tecnica-nucleo.md) | §4 | contratos del núcleo: entradas, salidas, puertos, catálogo de textos, política declarada, errores, estado y garantías | al diseñar o implementar el núcleo |
| [`definicion-tecnica-extensiones.md`](definicion-tecnica-extensiones.md) | §5-§6 | punto de extensión para un modelo de IA y paquetes de idioma | al tocar puertos, redacción o idiomas |
| [`definicion-tecnica-canal-agente.md`](definicion-tecnica-canal-agente.md) | §7 | frontera del canal de agente, aplazado a la etapa siguiente | al planificar esa etapa |

El conjunto nace de partir un documento único que llegó a 794 de las 800
líneas del gate. El corte es estructural —separar por vida útil y por
audiencia, en el orden de preferencia del estándar §3.4— y **no cambia
ninguna decisión**: los contratos y las fronteras son los mismos, movidos. Lo
que sí cambia respecto al documento único es lo que estas decisiones nuevas
agregan: §3.3, §8.1 y §9.3.

## 8. Decisiones P0 y criterio de prueba

Las diez decisiones de fundación, con su resolución y el criterio con el que
se comprueba que se respetaron. **P0-1** es la frontera que hace coherentes a
las demás; **P0-2 a P0-8** son, en ese orden, las siete decisiones cerradas
por instrucción humana del 18-sep-2026; **P0-9 y P0-10** son las respuestas
del mismo día a las preguntas que el F0 dejó abiertas.

| id | Decisión | Resolución | ADR | Criterio de prueba |
|---|---|---|---|---|
| P0-1 | Mecanismo y política | La biblioteca aporta mecanismo; el consumidor, política | `ADR-001` | El núcleo no contiene literales, umbrales ni textos de dominio; toda política entra por configuración declarada |
| P0-2 | Repositorio y licencia | Repositorio propio, Apache-2.0; alubia es consumidor externo | `ADR-002` | La licencia del repositorio y la declarada por los paquetes son Apache-2.0; alubia consume desde fuera de este repositorio |
| P0-3 | Secuencia | El canal de agente entra después de estabilizar el núcleo | `ADR-003` | Ninguna tarea del canal inicia antes del veredicto favorable de la ronda adversarial del núcleo |
| P0-4 | Transporte | Interfaz de transporte más relay de referencia que no es producto | `ADR-004` | El proyecto no opera infraestructura; el relay se documenta como referencia y no como producto |
| P0-5 | MCP | Sin servidor MCP en la primera versión; después, paquete aparte con spec fijada | `ADR-005` | Ninguna dependencia de MCP en los paquetes de la primera versión |
| P0-6 | Idiomas | Español primero, inglés después, con el mecanismo desde el día uno | `ADR-006` | El núcleo se prueba con un paquete de idioma de sustitución sin modificarse; la primera versión publica un solo paquete |
| P0-7 | Persistencia | Ninguna, ni la mínima; el dato previo es entrada inyectada | `ADR-007` | Análisis estático sin APIs de almacenamiento; ninguna operación del núcleo escribe estado entre sesiones |
| P0-8 | Modelo de IA | Solo las costuras; el modo asistido se activa por configuración explícita | `ADR-008` | Todo puerto devuelve promesa, acepta cancelación y declara presupuesto; los contadores y umbrales no son alcanzables desde un puerto |
| P0-9 | Navegadores y plataformas objetivo | Safari, Chrome y Edge en móvil y escritorio: tres navegadores, dos motores, dos plataformas | `ADR-009` | Cada parche obligatorio tiene su prueba, de modo que quitarlo ponga una prueba en rojo; la matriz se organiza por motor y cubre las dos plataformas |
| P0-10 | Distribución y consumo | El primer consumidor copia mientras madura, con revisión el 30 de diciembre de 2026; sin publicación en registro | `ADR-010` | No hay paquete publicado ni entrada en registro; cada commit copiado compila y pasa sus pruebas; la revisión está declarada como tarea con su fecha fija |

Nota de lectura: P0-6, P0-8 y P0-9 tienen criterio en forma de prueba sobre el
código; P0-3, P0-4, P0-5 y P0-10 se comprueban sobre el alcance y el contenido
de lo publicado, no sobre el código; P0-1 y P0-7 se comprueban con análisis
estático y con la configuración.

### 8.1 Cómo se distribuye y se consume (P0-10)

El consumo es **desde el repositorio y sin registro de paquetes**. Mientras no
haya consumidores fuera de este autor, el proyecto no publica en ningún
registro (`ADR-010`).

Durante la etapa de maduración, el primer consumidor **copia** el código, con
una **revisión el 30 de diciembre de 2026** —fecha fijada por el humano el
18-sep-2026— para decidir si pasa a consumirlo como dependencia desde el
repositorio. De ahí se siguen cuatro consecuencias:

- **Una copia es una instantánea.** La superficie pública tiene que ser
  pequeña y estable por commit mientras dure esta etapa: lo copiado no se
  actualiza solo, y cada commit que se copia tiene que ser utilizable —compila
  y pasa sus pruebas—, como exige el estándar §5.4 de la rama principal.
- **No hay resolución automática de versiones.** Un cambio incompatible en
  esta etapa no lo detecta ningún gestor de paquetes: rompe al consumidor que
  copió, y se documenta con guía de migración (estándar §5.5) cuando ocurra.
- **La revisión es una tarea con fecha, no una intención**: el 30 de diciembre
  de 2026, que abre el segundo tramo: dependencia desde el repositorio,
  versionado semántico público y guía de migración.
- **El «paquete» de idioma es un módulo del repositorio**, con interfaz
  estable (cierra PREGUNTA-C).

`REQ-15` exige el consumo desde el repositorio sin publicación en registro.
La lectura de este documento es que el modo vigente durante la maduración es
la copia de ese repositorio, y que el criterio de aceptación de REQ-15 —un
consumidor externo lo instala desde el repositorio— rige desde esa revisión.

## 9. No decisiones, no objetivos y excluido

### 9.1 No objetivos

- Sustituir a los SDK de las plataformas de agentes.
- Ser un motor de formularios general: validación, campos condicionales y
  cálculos quedan fuera; la biblioteca aporta la capa hablada y de
  confirmación.
- Convertirse en el canal de voz del proyecto de origen en producción: ese
  proyecto no adopta el canal de agente en su primera versión.
- Tomar cualquier decisión de dominio: las reglas, los umbrales y el marco
  aplicable son del consumidor.

### 9.2 Fuera de la primera versión

- El canal de agente implementado (§7).
- El servidor MCP.
- La implementación del puerto asistido: solo las costuras.
- El paquete de idioma inglés.
- `stdio` expuesto al navegador; WebRTC; reconocimiento de voz en servidor.
- Multiusuario y salas concurrentes; cuentas y facturación.
- Publicar la salida de voz por flujo: no basta con añadirla, porque obliga a
  cambiar la forma del puerto de locución y el camino de agregación del
  núcleo. Se reconoce el coste de no hacerlo.

### 9.3 Preguntas cerradas por derivación y preguntas abiertas

De las siete preguntas que este documento dejó abiertas, **siete se cierran
por derivación**: una regla ya escrita las responde, así que no son decisiones
para el humano. Quedan **dos abiertas**, al final de esta sección.

#### Cerradas por derivación

```text
A. Política ausente: ¿qué hace el núcleo cuando el consumidor no declara
   filtro, clases bloqueadas ni texto seguro?
   Regla que la responde: AGENTS.md, «Fail-closed. Permiso ausente, requisito
   ambiguo o estado inconsistente: detente, reporta y pregunta»; estándar
   §6.8, «Sin declaración, no hay red: el silencio es prohibición, no
   permiso», aplicado con la misma polaridad a lo que se habla; contrato de
   §4.1.
   Cierre: lo que el consumidor no declara no se habla. Sin política
   declarada, el camino de texto conversacional queda cerrado, y un paso que
   exige la declaración y no la tiene termina en `configuracion_invalida`: la
   sesión no se crea.
   Consecuencia: la configuración mínima es obligatoria; un consumidor que no
   declare nada obtiene texto de formulario y ningún texto conversacional.

B. Alcance publicado del canal de agente: ¿la interfaz de transporte y el
   relay se publican en la primera versión?
   Regla que la responde: decisión humana 2 (`ADR-003`) y REQ-14,
   imprescindible: la biblioteca corre y pasa sus pruebas sin ninguna pieza
   del canal instalada.
   Cierre: el canal —incluidas sus implementaciones de transporte y el relay
   de referencia— no entra en la primera versión ni en el primer conjunto
   publicado. Lo que F1 y E1 fijan es su frontera como contrato, que es
   diseño, no entrega.
   Consecuencia: el primer conjunto publicado es núcleo, adaptadores, paquete
   de idioma e interfaz mínima. La especificación del protocolo existe igual
   desde E1, porque es prerequisito para no rehacer el núcleo.
   Nota: `alubia:PROP-005 §5.2` lo listaba dentro de la primera versión; la
   decisión humana de secuencia es posterior y prevalece.

C. Distribución del paquete de idioma y etiqueta base.
   Regla que la responde: `ADR-010` (sin publicación en registro) y REQ-12
   (mecanismo desde la primera versión, sustituible sin tocar el núcleo).
   Cierre: mientras no haya registro, el «paquete» de idioma es un módulo con
   interfaz estable dentro del repositorio; la sustituibilidad que REQ-12
   exige se prueba con un módulo de sustitución, no con una publicación.
   Consecuencia: la etiqueta concreta del idioma y la resolución de una clave
   ausente son decisiones técnicas de E1, no preguntas para el humano.

D. Textos de la interfaz mínima de conversación: ¿los controles entran en el
   mecanismo de paquetes de idioma?
   Regla que la responde: `ADR-006`, consecuencia primera: «Todo texto visible
   al usuario sale del catálogo por clave; nada se escribe como literal dentro
   del núcleo», con §6.2 (el núcleo no asume español).
   Cierre: los cuatro controles y el indicador toman su texto del catálogo por
   clave, como el resto; lo aporta el paquete de idioma.
   Consecuencia: la interfaz mínima tampoco puede llevar literales en español,
   y el segundo idioma no la reescribe.

E. Valores del presupuesto de locución y del presupuesto por turno.
   Regla que la responde: la guía de F1
   (`docs/ai-agent-guide/02-specs-adr-contratos.md` §1) —F1 no elige detalles
   reversibles— y AGENTS.md, que exige declarar procedencia y razón de toda
   regla nueva.
   Cierre: no es pregunta para el humano. Es un parámetro que E1 fija con su
   razón declarada y que E3-05 mide en dispositivo.
   Consecuencia: el valor no se hereda del corpus de otro proyecto ni de un
   comentario de código; sin razón escrita no hay valor.

F. Vista de degradación no implementada: ¿se crea la sesión?
   Regla que la responde: contrato de §4.1 y §4.1.1 punto 3, con el
   fail-closed de AGENTS.md.
   Cierre: declarar cómo se muestra la degradación es parte de la
   configuración exigida. Sin esa declaración la sesión no se crea.
   Consecuencia: no existe el modo «sigue sin red de seguridad»; la salida
   manual es el último recurso del flujo, no un extra.

G. Umbrales de la política de confirmación: ¿mecanismo fijo o declaración del
   consumidor?
   Regla que la responde: REQ-10, imprescindible —ninguna política de dominio
   vive en la biblioteca: los rangos los aporta el consumidor— y AGENTS.md,
   que rechaza cualquier decisión de dominio dentro de la biblioteca; con
   §2.1, que separa mecanismo de política.
   Cierre: el mecanismo se queda en el núcleo —contadores, garantía de
   intento finito y salida a texto—; el valor numérico lo declara el
   consumidor, porque una cifra heredada de otro dominio es política de ese
   dominio.
   Consecuencia: la configuración declara el valor, y el núcleo valida que
   sea finito y que desemboque en la salida a texto. `ADR-008` se lee así: su
   decisión no cambia —el núcleo conserva el mecanismo—, cambia el alcance de
   lo que el núcleo fija por su cuenta.
   Nota: `alubia:PROP-005 §7.4` proponía fijar cifras concretas en el núcleo;
   REQ-10 y AGENTS.md son de este repositorio y mandan sobre la procedencia.
```

#### Abiertas

```text
PREGUNTA-H: ¿Qué **versión mínima** se declara soportada por motor (WebKit y
  Blink)?
  Por qué importa: fija qué parches de plataforma son obligatorios, el tamaño
  de la matriz de pruebas y qué compatibilidad se puede declarar. El F0
  esperaba que F1 fijara las versiones, y F1 no tiene evidencia para elegir
  números.
  Estado: la parte de **plataforma** quedó decidida por el humano el
  18-sep-2026 —**móvil y escritorio**— y ya no es pregunta; queda sólo el piso
  de versiones, que el humano no dio y declinó elegir al pedírselo. Se deja
  abierta tal cual: convertirlo en un número sería inventar, y dar por elegida
  la recomendación sería atribuirle una decisión que no tomó.
  Bloquea: el cierre de E3 y cualquier declaración pública de compatibilidad.
  Recomendación: fijar el piso con la matriz medida en E3-05 como evidencia,
  nunca por presencia de API ni por «versiones vigentes» supuestas.
```

`PREGUNTA-I` quedó cerrada: el humano fijó el **30 de diciembre de 2026** como
fecha de la revisión (registrada en `ADR-010` y en §8.1).

### 9.4 Pendientes de fase

- **F0.** No mantiene preguntas abiertas: sus tres respuestas del 18-sep-2026
  están registradas en su §8 y en `ADR-009` y `ADR-010`.
- **Nombres de paquete.** Corresponden a la fundación del proyecto. Con el
  consumo por copia, su urgencia baja: lo que se copia se importa por ruta
  del repositorio.
- **Inventario y esquema de configuración, catálogo de eventos, códigos de
  error del protocolo, firmas definitivas de los puertos y etiqueta del
  idioma.** Entregables de E1.
- **Índice de ADR.** La tabla de §8 hace de índice mientras todas las
  decisiones vivan en ella; si aparecen ADR fuera de las P0, se crea uno.

## 10. Trazabilidad con los `REQ-*` del F0

Cada requisito del F0 tiene sección responsable en el conjunto F1. Las
secciones §1-§7 viven en los documentos del mapa; las §8-§11, aquí. La columna
de prueba apunta al entregable que fijará el caso testable; ninguna sección
introduce requisitos ausentes del F0.

| REQ | Sección del conjunto | Dónde vive el caso testable |
|---|---|---|
| REQ-1 núcleo sin DOM | §3.2, §4.1, §4.8 | E1 contrato del núcleo; E2-02 |
| REQ-2 locución y encadenamiento | §4.3, §4.6 | E1 contrato de locución |
| REQ-3 disciplina de turno | §4.3, §4.6, §4.7 | E1 disciplina de turno |
| REQ-4 confirmación enumerada | §4.3, §4.8 | E1 puertos; E2-04 |
| REQ-5 léxico y umbral externos | §4.3, §6.1 | E3-04 |
| REQ-6 formularios declarativos | §4.1.1 | E1 contrato del núcleo; E2-02 |
| REQ-7 confirmación y readback fiel | §4.4, §4.8 | E1 catálogo; E2-06 |
| REQ-8 degradación a manual | §4.6, §4.7 | E4-02, E4-03 |
| REQ-9 interfaz mínima | §3.2, §4.7 | E1 accesibilidad; E4-01 |
| REQ-10 ninguna política de dominio | §2, `ADR-001` | E1 catálogo; prueba con dos configuraciones de dominio |
| REQ-11 no persiste, no red, lo declara | §4.8, §4.9 | E2-07 y la prueba de ausencia de escritura |
| REQ-12 paquetes de idioma | §6, `ADR-006` | E3-04 |
| REQ-13 puertos sin modelo | §5, `ADR-008` | E2-05, E2-06 |
| REQ-14 canal y MCP fuera | §7, P0-3 a P0-5 | E5-03, posterior a la primera versión |
| REQ-15 Apache-2.0, consumo desde el repositorio sin registro | §8.1, `ADR-002`, `ADR-010` | E6-01, E6-03; el tramo por dependencia se abre el 30 de diciembre de 2026 |
| REQ-16 accesibilidad | §4.2, §4.7 | E1 accesibilidad; E4-03, E4-04 |
| REQ-17 el agente no se salta la validación | §7.2 | E1 protocolo; E5-01 |
| REQ-18 navegadores objetivo y parches obligatorios | §3.3, `ADR-009` | E3-02 —una prueba por parche— y E3-05 |

Las tareas `E<n>-<m>` citadas son las de `alubia:PROP-005 §9`, usadas como
procedencia; el plan de implementación propio de este repositorio se crea en
F2.

## 11. Gate de F1: estado

Checklist del gate, con su estado real:

- [x] decisiones con alternativas registradas en ADR: las diez P0;
- [x] componentes con frontera externa con contrato: núcleo, eventos,
      puertos, catálogo, política declarada, protocolo de agente;
- [x] máquina de estados definida: estados visibles y reglas de transición,
      con la enumeración de fases internas delegada a E1;
- [x] todo `REQ` imprescindible con sección responsable y prueba prevista:
      §10;
- [ ] todo `REQ` imprescindible cubierto por una spec con casos testables:
      las spec son entregables de E1, todavía sin escribir;
- [x] ninguna sección introduce requisitos ausentes de F0: §10 lo traza.

**Partición registrada.** El conjunto nace de partir un documento único de 794
líneas, según el orden de preferencia del estándar §3.4: separar por vida útil
y por audiencia. Los contratos y las decisiones se movieron sin reescribirse;
los conteos por archivo de este conjunto sustituyen al conteo único anterior
(§3.4, «al partir un archivo ya verificado»).

**Fase F1: PARCIAL.** Faltan los entregables de E1 y las dos respuestas
humanas que pide §9.3; ninguna sección de este conjunto autoriza escribir
código.

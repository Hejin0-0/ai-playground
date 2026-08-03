# Plan de QA visual — Empires RTS

**Estado:** benchmark y cuatro iteraciones de revisión terminados. La puntuación de esta entrega es provisional porque el juez conocía las fuentes; el protocolo ciego reproducible queda definido más abajo para una sesión externa.

## Resultado de la entrega

El juez visual independiente revisó `empires-final-intro.png`, `empires-final-gameplay-v8.png`, `empires-final-selection-v6.png`, `empires-final-combat.png`, `empires-final-1366-v2.png` y `empires-final-post-review.png`. La secuencia fue **53 → 66 → 69 → 78/100** tras corregir densidad de base, texturas, agua, niebla/minimapa, estadísticas, selección, actividad económica, arquitectura, costa, siluetas 1800, materiales y adaptación del HUD a 1366×768.

| Comparación | Ganador | Confianza |
|---|---|---:|
| Portada/editorial | `empires-rts` | 0,96 |
| Mundo y riqueza ambiental | *Age of Empires II: DE* | 0,98 |
| HUD y selección | *Age of Empires II: DE* | 0,91 |

**Dictamen:** vertical slice RTS aceptado, convincente y cohesionado, pero no AAA. La captura oficial de *Age of Empires II: DE* conserva la victoria con confianza alta por riqueza ambiental, unidades, profundidad material y lectura de escenas densas. La brecha restante es producción artística —variedad de activos, relieve, animación, impactos y formaciones—, no un defecto oculto de build o de flujo principal. Esta comparación no se presenta como ciega real: el juez conocía qué imágenes pertenecían al candidato. El apartado 3 documenta cómo ejecutar una prueba verdaderamente enmascarada con evaluadores externos.

## Objetivo y criterio de referencia

La revisión medirá si el juego alcanza la gramática visual de un RTS histórico legible al nivel de *Age of Empires II: Definitive Edition* (AoE II: DE): cámara isométrica coherente, siluetas reconocibles, densidad controlada, terreno que explica el espacio jugable y un HUD que prioriza decisiones. No se exige copiar activos, edificios ni la disposición exacta de la interfaz; se exige conseguir cualidades comparables con recursos propios.

Las capturas promocionales oficiales sin HUD sirven para mundo, escala, terreno, color e iluminación. El tutorial oficial de Xbox sirve para arquitectura de información y estados del HUD, no para exigir una copia literal de su layout en PC/web.

### Referencias oficiales y primarias

Consultadas el 3 de agosto de 2026.

| ID | Fuente directa | Qué informa | Límite de uso |
|---|---|---|---|
| R1 | [Página oficial de AoE II: DE](https://www.ageofempires.com/games/aoeiide/) | Posicionamiento visual general, riqueza del mundo y objetivo de nitidez | Material de producto; no sustituye capturas equivalentes de juego |
| R2 | [Selección visual oficial de AoE II: DE](https://www.ageofempires.com/news/visual-look-at-aoe2de/) | Conjunto declarado de capturas de juego de alta calidad | Varias imágenes omiten el HUD y favorecen escenas vistosas |
| R3 | [Ciudad densa, combate, agua y relieve](https://cdn.ageofempires.com/aoe/wp-content/uploads/2019/10/screenshot1.jpg) | Densidad, jerarquía, oclusión, caminos, costa, agua y color de jugador | Escena promocional sin HUD |
| R4 | [Base japonesa en nieve](https://cdn.ageofempires.com/aoe/wp-content/uploads/2019/10/BLUE_E5_JAPANESE.jpg) | Lectura sobre terreno claro, siluetas, color de jugador y separación de masas | Escena promocional sin HUD |
| R5 | [Base tártara](https://cdn.ageofempires.com/aoe/wp-content/uploads/2019/10/RED_S4_Tartar.jpg) | Escala edificio–unidad, lectura de ejército y acentos de facción | Escena promocional sin HUD |
| R6 | [Asentamiento tropical de Gajah Mada](https://cdn.ageofempires.com/aoe/wp-content/uploads/2019/10/camp_gajah_mada.jpg) | Transiciones costa–roca–vegetación, composición y landmark | Escena promocional sin HUD |
| R7 | [Tutorial oficial: control, recursos e interfaz](https://www.ageofempires.com/learn-to-play/controlling-your-empire-gathering-resources-xbox/) | Función y jerarquía de recursos, población, edad, selección, estadísticas y minimapa | Es la variante Xbox; comparar semántica y jerarquía, no posición exacta |
| R8 | [Recursos, población, edad y tiempo](https://cdn.ageofempires.com/aoe/wp-content/uploads/2023/01/1-2-3-A.webp) | Agrupación, contraste y lectura inmediata de datos críticos | Recorte didáctico de Xbox |
| R9 | [Panel de unidad y estadísticas](https://cdn.ageofempires.com/aoe/wp-content/uploads/2023/01/1-2-7-ABCD.webp) | Retrato, vida, ataque, armadura, rango y color de jugador | Recorte didáctico de Xbox |
| R10 | [Niebla de guerra y minimapa](https://cdn.ageofempires.com/aoe/wp-content/uploads/2023/01/1-4-1-ABCDE.webp) | Estados explorado/no explorado, relación mundo–minimapa y foco del jugador | Recorte didáctico de Xbox |
| R11 | [Funciones oficiales de accesibilidad](https://www.ageofempires.com/age-ii-de-accessibility/) | Escala de HUD, paneles de legibilidad, color de jugador, rejilla y resaltado de objetos | Referencia de principios, no lista obligatoria de opciones |
| R12 | [Explicación oficial del motor isométrico 2D](https://www.ageofempires.com/news/age-empires-definitive-edition-3d-2d-game/) | Herencia isométrica, reconocimiento de activos, direcciones y nitidez al cambiar zoom | Habla de *Age of Empires: DE*; se usa solo como contexto técnico de la serie |

## Benchmark imperios-1800-2100

### Alcance, versión y límites

Se auditó en modo de solo lectura el repositorio MIT [`alandaitch/imperios-1800-2100`](https://github.com/alandaitch/imperios-1800-2100) en el commit [`30e7ff7`](https://github.com/alandaitch/imperios-1800-2100/commit/30e7ff7f450e4fbe5813db317a1ec158bd964283), comparando sus capturas y rutas de código con `empires-gameplay-c2.png`, `empires-selection-c3.png`, `empires-era1900-c3.png`, `empires-intro.png` y el código actual de `empires-rts`. La orilla irregular de C3-1900 ya fue corregida en código; esa captura solo informa diferenciación de era, no el estado actual de la costa.

La referencia no es un listón absoluto. Su propio informe registra **cero victorias** en los pares ciegos ([`README.md:51–65`](https://github.com/alandaitch/imperios-1800-2100/blob/main/README.md#L51-L65)) y reconoce todavía falta de contraste local, agua somera demasiado clara y junturas de edificios ([`README.md:201–206`](https://github.com/alandaitch/imperios-1800-2100/blob/main/README.md#L201-L206)). Además, su primer arranque tarda unos 40 segundos generando texturas ([`README.md:6–17`](https://github.com/alandaitch/imperios-1800-2100/blob/main/README.md#L6-L17)). Por tanto, se toman **patrones y pruebas**, no grandes bloques ni su complejidad completa.

### Dictamen comparativo

| Dimensión | `empires-rts` | `imperios-1800-2100` | Conclusión exigente |
|---|---|---|---|
| Dirección y entrada | La portada tiene una identidad editorial más clara, mejor foco tipográfico y mejor llamada a la acción. | Entra directamente al mundo y prioriza demostración sistémica. | **Conservar la portada actual.** No hay ganancia en imitar la presentación de la referencia. |
| HUD | El marco oscuro, la barra de eras y la composición son más cohesionados; varios textos secundarios quedan en 8–10 px y la selección solo expone vida y descripción (`src/styles.css:182–186, 240–290, 302–350`; `src/main.js:405–433`). | Expone tasas, escasez, coste faltante, estadísticas y tooltips; su tema cambia de forma más profunda con la edad ([`HUD.js:1214–1229`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/ui/HUD.js#L1214-L1229), [`HUD.js:1584–1610`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/ui/HUD.js#L1584-L1610)). | La estética del candidato es mejor; la **densidad informativa y legibilidad funcional** son peores. Refinar, no reemplazar. |
| Terreno y detalle | Grandes campos de color por vértice, con una sola variación de ruido (`src/world.js:95–135`); 105 árboles cónicos y 52 rocas distribuidos casi uniformemente (`src/world.js:281–355`). | Combina detalle y macroescala en el suelo y agrupa vegetación con claros deliberados ([`TerrenoShader.js:176–255`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/world/TerrenoShader.js#L176-L255), [`Foliaje.js:824–852`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/world/Foliaje.js#L824-L852)). | Es la brecha visual principal: en C2 el HUD parece producto y el mundo parece maqueta temprana. |
| Contraste local | No existe medición reproducible todavía; la captura muestra superficies extensas y suaves. | Demostró que luma/croma globales podían estar en rango mientras el contraste local 32×32 seguía en 28,3 frente a 41,5 ([`README.md:94–112`](https://github.com/alandaitch/imperios-1800-2100/blob/main/README.md#L94-L112)). | No tocar exposición como remedio principal. La hipótesis a probar es **frecuencia media/alta estructural**. |
| Agua | Las bandas diagonales del shader (`src/world.js:186–220`) ocupan una gran superficie y se convierten en el primer patrón de C2. | Tiene profundidad, espuma y oleaje más ricos, pero su propia auditoría aún marca el agua somera como demasiado clara ([`Agua.js:210–232`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/world/Agua.js#L210-L232)). | Adoptar separación profundidad/orilla; no adoptar brillo ni el sistema Gerstner completo. |
| Niebla y minimapa | Solo hay niebla atmosférica (`src/world.js:441–446`); el minimapa siempre revela recursos y enemigos (`src/main.js:984–1013`). | Distingue no explorado, recordado y visible, y aplica la misma máscara al minimapa ([`Niebla.js:1–35`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/sim/Niebla.js#L1-L35), [`Minimapa.js:304–340`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/ui/Minimapa.js#L304-L340)). | Falta una capa táctica esencial; la bruma atmosférica no la sustituye. |
| Feedback | Hay selección, tooltip, proyectil, escombros y un pulso genérico cuyo color cambia (`src/world.js:606–617, 768–798`; `src/main.js:692–725, 831–842`). | Separa marcas de mover, atacar, recolectar y construir por semántica ([`Efectos.js:59–67`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/render/Efectos.js#L59-L67), [`Efectos.js:1562–1591`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/render/Efectos.js#L1562-L1591)). | La base existe; falta que cada acción se entienda sin leer el registro de texto. |
| Controles | Ya existen WASD/flechas, borde, `Shift`, Q/E, zoom hacia cursor, H y `.` (`src/main.js:728–734, 942–982, 1155–1173`), aunque la ayuda omite varios (`index.html:130–143`). El doble clic centra, no selecciona por tipo. | Incluye doble clic por tipo y grupos, además del mismo núcleo de cámara ([`README.md:116–127`](https://github.com/alandaitch/imperios-1800-2100/blob/main/README.md#L116-L127), [`CamaraRTS.js:117–145`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/render/CamaraRTS.js#L117-L145)). | No reimplementar la cámara. Completar selección RTS y hacer visible lo que ya funciona. |
| Eras | Cambian nombres, estadísticas, materiales, algunos accesorios y tokens del HUD, pero C3-1900 sigue leyendo como el mismo mundo (`src/catalog.js:1–10, 52–177`; `src/world.js:542–558, 621–750`; `src/styles.css:32–61`). | Cambia paleta completa del HUD, siluetas, cielo, agua y música mediante un evento de remodelado ([`styles.css:48–211`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/ui/styles.css#L48-L211), [`edades.js:5–45`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/data/edades.js#L5-L45), [`Edades.js:199–207`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/sim/Edades.js#L199-L207)). | La progresión está en datos, pero no alcanza todavía el umbral de reconocimiento visual. |

### Ocho mejoras de mayor impacto realizables hoy

1. **P0 — Subir contraste local con suelo procedural de dos escalas.** Mantener el `MeshStandardMaterial` actual y generar una textura determinista pequeña —detalle de matas/tierra/piedra más una modulación macro— o inyectar solo esas dos señales; no portar el shader de cinco capas. Aplicarla con amplitud contenida sobre `src/world.js:95–135`. La referencia demuestra por qué detalle y macro no deben mezclarse 50/50 ([`TerrenoShader.js:497–510`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/world/TerrenoShader.js#L497-L510)). **Aceptación:** con el mismo recorte de mundo, resolución y máscara sin HUD/agua, el promedio del desvío de luma en baldosas 32×32 sube al menos 20 % frente a C2, la luma global cambia como máximo 5 puntos y no aparecen mosaico ni grano de pantalla.

2. **P0 — Quitar las cintas diagonales dominantes del agua.** Sustituir `sin((u+v)*110)` por dos ondas cruzadas de baja amplitud, reservar la línea clara para la costa ya calculada y bajar opacidad/brillo del patrón en mar abierto. No añadir todavía Gerstner, refracción ni lectura de profundidad. **Aceptación:** en una prueba de 3 segundos nadie describe “rayas diagonales” como primer rasgo; unidades/costa vencen al agua en jerarquía y la orilla sigue siendo continua en dos zooms.

3. **P0 — Añadir cobertura instanciada en manchones y claros.** Reutilizar `InstancedMesh` para 2–3 siluetas baratas —pasto alto, mata y piedra baja— gobernadas por ruido de baja frecuencia, con claros amplios y exclusión de huellas/centro de la base. El patrón útil está en la agrupación y el vacío, no en la cantidad ([`Foliaje.js:1234–1310`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/world/Foliaje.js#L1234-L1310), [`Foliaje.js:1351–1403`](https://github.com/alandaitch/imperios-1800-2100/blob/main/src/world/Foliaje.js#L1351-L1403)). **Aceptación:** se leen al menos tres masas y dos claros desde el zoom inicial; ningún prop atraviesa edificios o recursos; a 50 % de escala las unidades conservan su silueta y no aparece “confeti”.

4. **P0 — Implementar niebla de guerra mínima y sincronizada con el minimapa.** Para el corte de hoy basta una grilla 96–128² actualizada a 10 Hz: negro no explorado, velo frío recordado y transparente visible; revelar discos alrededor de entidades propias, ocultar enemigos fuera de visión y componer la misma máscara encima del minimapa. No copiar altura, bosque, recuerdos persistentes ni postproceso de la referencia. **Aceptación:** los tres estados se distinguen sin tooltip, el minimapa nunca revela un enemigo que el mundo oculta y el borde no muestra celdas duras al zoom inicial.

5. **P1 — Convertir el feedback existente en un lenguaje de órdenes.** Extender `createCommandFX` con tipo y forma: mover = anillo/chevrón, atacar = retícula roja, recolectar = pulso con icono o forma del recurso; sumar flash de impacto de un fotograma, barra de vida temporal y `+N` al recolectar. No depender solo del color. **Aceptación:** cinco evaluadores identifican mover/atacar/recolectar en al menos 13 de 15 clips de un segundo sin ver el registro; cada impacto y cada tick de recolección producen una respuesta visible en menos de 100 ms.

6. **P1 — Hacer que cada era se reconozca por el mundo, no solo por el HUD.** Definir cuatro presets ligeros de atmósfera/sol/niebla y un kit de silueta por era dentro de las fábricas actuales: 1800 tejado y chimenea; 1900 acero, cubierta plana y tubería; 2000 vidrio, antena y panel; 2100 volumen elevado y acento emisivo. Mantener el color de agua base coherente; cambiar rugosidad, turbiedad y detalle, no teñir océanos distintos. **Aceptación:** en recortes del mundo sin HUD ni texto, al menos 4 de 5 revisores ordenan correctamente las cuatro eras; ningún edificio se identifica solo por cambiar de color.

7. **P1 — Elevar legibilidad y contenido del HUD sin perder su dirección visual.** En selección, mostrar ataque, defensa y alcance que ya existen en `catalog.js`; elevar texto crítico secundario de 8–9 px a un mínimo efectivo de 11 px a 1920×1080; marcar solo el recurso faltante y explicar el bloqueo en el botón/tooltip, en vez de reducir todo a `opacity:.36`. Mantener composición, tipografía y portada actuales. **Aceptación:** texto crítico con contraste mínimo 4,5:1, estadísticas leíbles a zoom 100 %, y el motivo exacto de todo comando bloqueado se identifica sin intentar ejecutarlo.

8. **P2 — Completar selección RTS y documentar controles reales.** Cambiar el doble clic de “centrar” a “seleccionar todas las unidades visibles del mismo tipo”, añadir `Shift` para sumar/quitar selección y actualizar ayuda/pistas con borde, aceleración, H y `.`. Posponer grupos de control hasta resolver el conflicto actual entre `1..9` y los nueve comandos; no introducir un mapeo ambiguo hoy. **Aceptación:** clic, arrastre, `Shift` y doble clic superan una prueba funcional; la ayuda coincide con el código y las teclas numéricas de comandos no sufren regresiones.

### Decisiones de alcance derivadas del benchmark

- No subir exposición o saturación global para “arreglar” contraste: la referencia ya demostró que esa métrica puede estar correcta mientras las superficies siguen planas.
- No portar hoy el splatting triplanar, las cinco capas PBR, la niebla 256² completa ni el sistema masivo de partículas. Su coste y riesgo exceden este corte.
- No llenar uniformemente el mapa. Cada aumento de densidad debe venir acompañado de claros, exclusión de huellas y una prueba a 50 % de escala.
- Preservar la portada, la identidad tipográfica y la arquitectura general del HUD de `empires-rts`: son ventajas comparativas, no deuda.

## Evidencia mínima para puntuar

La nota final requiere capturas nativas, sin reescalado posterior, sin DevTools ni cursor tapando información. Usar el mismo zoom del navegador y la misma resolución en toda la serie.

| Captura | Estado requerido | Qué permite evaluar |
|---|---|---|
| C1 | Vista general al cargar, 1920×1080 | Composición, cámara, jerarquía y HUD completo |
| C2 | Economía/base poblada | Escala, terreno, recursos, edificios, caminos y densidad |
| C3 | Unidad y edificio seleccionados, una captura de cada uno | Selección, estadísticas, comandos, estados disponibles/no disponibles |
| C4 | Combate o estado de máxima actividad disponible | Siluetas en grupo, color de bando, efectos y ruido visual |
| C5 | Borde de bioma, agua, relieve o límite del mapa más complejo | Transiciones, oclusión, materiales y terminaciones |
| C6 | 1366×768, si esa resolución está dentro del alcance | Recorte, solapamiento, legibilidad y adaptación del HUD |

Si falta evidencia, el ítem se marca **NE (no evaluable)**, nunca con un cero inventado. No puede emitirse aceptación final mientras una categoría crítica tenga elementos NE. C6 solo es obligatoria si 1366×768 forma parte del alcance declarado.

## 1. Rúbrica ponderada — 100 puntos

Cada subcriterio recibe una nota de 0 a 5, admitiendo medios puntos. Puntos obtenidos = `peso × nota / 5`.

- **0 — ausente o roto:** contradice la lectura o no existe.
- **1 — deficiente:** el defecto domina la experiencia.
- **2 — débil:** funciona parcialmente, pero se ve genérico, confuso o inacabado.
- **3 — competente:** se entiende y resulta creíble, con diferencias visibles respecto al listón.
- **4 — fuerte:** calidad consistente y cercana a la referencia en condiciones reales.
- **5 — referente:** resuelve el objetivo tan bien como la referencia pertinente, sin necesitar copiarla.

| Categoría | Peso | Subcriterios puntuables |
|---|---:|---|
| **A. Cámara, geometría isométrica y escala** | **16** | Proyección y ejes consistentes (6); huellas, profundidad y orden de oclusión (5); escala relativa de terreno, unidades y edificios (5) |
| **B. Jerarquía y legibilidad táctica** | **18** | Foco primario frente a detalle secundario (6); siluetas y color de propiedad/bando (5); espacio negativo, rutas y control del amontonamiento (4); lectura correcta en barrido de 3 segundos (3) |
| **C. Terreno y construcción del mundo** | **14** | Material base y paleta de bioma (4); transiciones, costas, relieve y límites (4); vegetación y recursos reconocibles (3); variación sin repetición ni ruido gratuito (3) |
| **D. Edificios y unidades** | **14** | Lenguaje arquitectónico y siluetas de edificios (5); landmarks y jerarquía de tamaños (3); unidades individuales y grupos/formaciones (4); contacto con suelo, pivotes y selección (2) |
| **E. Iluminación, color y materiales** | **10** | Dirección de luz y sombras coherentes (4); contraste y saturación funcionales (3); separación material y atmósfera (3) |
| **F. HUD y arquitectura de información** | **16** | Recursos, población, edad y tiempo (5); selección, estadísticas, comandos y estados (4); minimapa y relación con el mundo (3); densidad y oclusión del área jugable (2); tipografía, iconos y contraste (2) |
| **G. Feedback y estados visuales** | **7** | Selección, hover y propiedad (3); construcción, daño, combate o actividad (2); niebla, alcance, rejilla y estados deshabilitados cuando apliquen (2) |
| **H. Cohesión, acabado y accesibilidad visual** | **5** | Consistencia entre mundo y HUD (2); acabado técnico, iconografía y tipografía (1); ausencia de roturas visibles (1); información crítica no dependiente solo del color (1) |
|  | **100** |  |

**Categorías críticas:** A, B, C y F. Una nota alta en decoración no compensa una cámara incoherente, una escena ilegible, terreno pobre o un HUD fallido.

## 2. Inventario de revisión individual

Cada elemento se revisa por separado y se registra como **OK**, **menor**, **mayor**, **bloqueante**, **NE** o **N/A justificado**. “No implementado” no equivale a N/A si el elemento es parte del flujo principal mostrado.

### Cámara y marco global

- Ángulo isométrico y paralelismo de los dos ejes del suelo.
- Centro visual, horizonte implícito y cantidad de suelo útil visible.
- Nivel de zoom y nitidez a tamaño nativo.
- Consistencia de la cámara entre terreno, edificios, unidades, sombras y efectos.
- Orden de dibujo delante/detrás; ausencia de sprites o mallas atravesadas.
- Márgenes seguros frente al HUD y bordes del viewport.
- Escala relativa: aldeano, infantería, caballería, árbol, casa, centro urbano, torre y muralla.

### Terreno, agua y recursos

- Suelo principal: frecuencia de detalle y ausencia de textura “papel pintado”.
- Variantes de tierra, hierba, arena, nieve o piedra que estén presentes.
- Caminos y plazas: continuidad, anchura y conexión con entradas de edificios.
- Mezcla entre materiales; ausencia de cortes rectangulares o halos.
- Elevación, acantilados, rocas y límites transitables/no transitables.
- Costa, orilla, agua, espuma, reflejo y contacto de objetos con el agua.
- Árboles individuales y masas forestales: borde legible y volumen controlado.
- Oro, piedra, alimento y madera: silueta, valor visual y separación del fondo.
- Granjas: retícula, orientación, estado y legibilidad sin competir con unidades.
- Detalle ambiental: densidad, repetición, escala y utilidad compositiva.
- Terminación en esquinas, bordes del mapa y zonas parcialmente ocultas.

### Edificios

- Centro urbano o landmark principal: prioridad, escala y lectura inmediata.
- Viviendas y edificios económicos: familia visual y diferenciación funcional.
- Edificios militares: silueta distinta y peso visual adecuado.
- Torres, murallas, puertas y fortificaciones: continuidad y oclusión.
- Entradas, escaleras y orientación coherentes con el suelo y las rutas.
- Color de jugador integrado como acento, no como contorno accidental.
- Sombras de contacto y base asentada; ningún edificio debe “flotar”.
- Detalle de cubierta/fachada legible al zoom real, no solo ampliado.
- Estados disponibles: seleccionado, en construcción, activo, dañado o destruido.
- Repetición: rotación/variación suficiente sin perder identidad.

### Unidades y agrupaciones

- Aldeanos, militares y unidades especiales se distinguen por silueta.
- Tamaño consistente y proporcional frente a puertas, árboles y edificios.
- Color de jugador visible en fondos claros, oscuros y saturados.
- Dirección, postura y sombra de cada unidad coinciden.
- Separación entre unidades; las formaciones no se convierten en una mancha.
- Armas, monturas y accesorios no desaparecen contra el terreno.
- Selección individual y múltiple: anillo/base, contorno, barra de vida y prioridad.
- Contacto de pies, ruedas o cascos con el suelo.
- Superposición con edificios, vegetación y efectos.
- Si se aporta vídeo: locomoción, giro, ataque, idle y cadencia de animación.

### Jerarquía y lectura táctica

- En 3 segundos se localizan landmark, fuerza militar, recursos y ruta principal.
- Se distingue aliado, enemigo y neutral sin leer texto.
- Se diferencia terreno decorativo de terreno operativo.
- Los objetos interactivos vencen al detalle de fondo.
- El color más brillante corresponde a información o acción importante.
- Las zonas densas conservan huecos, rutas y siluetas.
- El foco no depende de un único efecto excesivo de brillo, bloom o contorno.
- A 50 % de escala todavía se entiende la estructura global de la escena.

### HUD e interfaz

- Madera, alimento, oro y piedra: icono, cifra, orden y actualización visual.
- Población actual/máxima, edad y tiempo: agrupación y prioridad.
- Retrato/nombre del objeto seleccionado y color del jugador.
- Vida, ataque, armadura, rango y demás estadísticas presentes.
- Botones de comando: iconos, etiquetas, affordance y tamaño de objetivo.
- Estado normal, hover, pulsado, seleccionado, deshabilitado y no asequible.
- Cola de producción/progreso, si existe.
- Tooltip: contraste, posición, ancho y no oclusión de la acción relevante.
- Minimapa: orientación, terreno, unidades, edificios, recursos y viewport actual.
- Correspondencia cromática y espacial entre minimapa y mundo.
- Alertas, objetivos, mensajes y feedback temporal, si existen.
- Separación entre marco decorativo e información accionable.
- Tipografía: tamaño nativo, cifras tabulares cuando ayudan y antialiasing.
- Contraste de texto mediante panel u otro respaldo estable sobre cualquier fondo.
- Adaptación a 1920×1080 y a toda resolución declarada en alcance.

### Luz, color, materiales y efectos

- Dirección única y plausible de luz principal.
- Longitud, dureza y opacidad coherentes de las sombras.
- Sombras de contacto bajo unidades, edificios, árboles y recursos.
- Valores separados entre suelo, objetos interactivos y fondos.
- Saturación controlada; los colores de jugador no contaminan toda la escena.
- Piedra, madera, metal, tela, vegetación y agua se distinguen por valor/material.
- Oclusión ambiental o profundidad equivalente sin ensuciar contornos.
- Fuego, humo, polvo, proyectiles, impactos y partículas: escala y prioridad.
- Niebla de guerra: estados no explorado, explorado y visible claramente distintos.
- Ausencia de banding, halos, bloom lavado o negros empastados.

### Acabado técnico y accesibilidad visual

- Sin activos ausentes, iconos rotos, texto provisional ni valores inválidos.
- Sin costuras, z-fighting, clipping, recortes o overflow del HUD.
- Sin pixelación desigual ni mezcla accidental de estilos/resoluciones.
- Ningún dato crítico se comunica solo por rojo/verde o por un matiz mínimo.
- Selección y hover siguen visibles con simulación de deuteranopia, protanopia y tritanopia.
- Texto crítico conserva contraste suficiente sobre la escena más clara y la más oscura.
- El HUD no tapa la unidad seleccionada ni la zona principal de acción.
- Consistencia de biseles, radios, trazos, sombras, iconos y espaciado.

Plantilla de registro:

| Elemento | Captura | Observación verificable | Referencia | Severidad | Decisión |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

## 3. Protocolo de comparación lado a lado con etiquetas ocultas

### Preparación por una persona que no puntúa

1. Crear seis pares equivalentes: vista general, economía, ejército, escena densa, terreno/agua y HUD con selección.
2. Usar únicamente capturas oficiales marcadas como juego o tutorial; excluir arte conceptual, cinemáticas y key art.
3. Igualar **lienzo, resolución de salida y área visible**, sin deformar, reenfocar, recolorear ni aplicar sharpening. Si las relaciones de aspecto difieren, usar bandas neutras y registrarlo.
4. No intentar que dos escenas distintas tengan objetos idénticos. Igualar función, densidad y estado; por ejemplo, “base económica media con unidades visibles”.
5. Quitar nombres de archivo, metadatos, navegador y pies de foto. Conservar dentro de la imagen todo HUD original pertinente.
6. Asignar A/B al azar por par mediante una semilla registrada. Balancear el lado del candidato: tres veces a la izquierda y tres a la derecha.
7. Guardar la clave fuera de la hoja de puntuación hasta cerrar todas las respuestas.

### Sesión de evaluación

1. Usar la misma pantalla, brillo, escala del sistema y zoom 100 %. No ampliar por encima del tamaño nativo.
2. Antes de cualquier análisis, mirar cada par durante **3 segundos** y registrar sin corregir:
   - primer foco percibido;
   - qué es transitable y qué bloquea;
   - ubicación de unidades, landmark y recursos;
   - bando/selección y primer dato legible del HUD.
3. En una segunda pasada de hasta **20 segundos**, puntuar A y B por separado de 0 a 5 en: lectura isométrica, jerarquía, terreno, escala/siluetas, iluminación/color y HUD cuando aplique.
4. Solo después emitir preferencia forzada por par en tres preguntas: **más legible**, **más cohesivo** y **más próximo a la gramática de AoE II: DE**. Se permite empate únicamente si la diferencia no es defendible con una observación concreta.
5. Revisar cada par también al 50 % de escala para comprobar lectura macro; no usar esa vista para juzgar detalle fino.
6. Registrar confianza (`baja`, `media`, `alta`) y si se cree reconocer la referencia (`no`, `probable`, `seguro`) **antes** de revelar la clave.
7. Bloquear la hoja, revelar la clave y añadir conclusiones. No se modifican puntuaciones tras conocer la identidad.
8. Ideal: tres revisores sin conversación previa y usar la mediana. Con un solo revisor, repetir 24 horas después con lados reordenados; la segunda pasada es una comprobación de estabilidad, no una muestra independiente.

### Límites honestos de la prueba “ciega”

Esto es una prueba **enmascarada**, no verdaderamente ciega. Un revisor que conozca AoE II: DE puede reconocer sus edificios, sprites, HUD o acabado incluso sin etiqueta. Ocultar A/B reduce sesgo de posición, nombre y expectativa; no elimina conocimiento de autoría.

Tampoco existe correspondencia perfecta entre escenas: densidad, facción, bioma y estado cambian. Las capturas promocionales oficiales pueden usar un zoom o paquete gráfico favorable y omitir HUD; los recortes didácticos son de Xbox. Por eso cada fuente solo puntúa la dimensión que realmente demuestra, y la nota absoluta de la rúbrica pesa más que una preferencia subjetiva aislada.

Métricas a conservar por par:

| Par | Semilla | Candidato A/B | Reconocimiento previo | Δ lectura | Δ cohesión | Δ gramática AoE | Preferencias | Confianza |
|---|---|---|---|---:|---:|---:|---|---|
|  |  |  |  |  |  |  |  |  |

`Δ = nota del candidato − nota de la referencia` en la escala 0–5.

## 4. Umbrales de aceptación y defectos que obligan a iterar

### Umbral acumulativo

La versión solo se acepta si cumple **todos** estos puntos:

- **88/100 o más** en la rúbrica total.
- Al menos **80 % del peso** en cada categoría crítica A, B, C y F.
- Al menos **70 % del peso** en cada categoría no crítica.
- C1–C5 presentes y ningún subcriterio crítico marcado NE.
- Ningún defecto bloqueante ni mayor abierto.
- Como máximo cinco defectos menores, sin que tres indiquen el mismo problema sistémico.
- En la comparación enmascarada: mediana `Δ ≥ -0,5` en legibilidad y `Δ ≥ -0,75` en cohesión; al menos cinco de seis pares dentro de ambos márgenes.
- El resultado se mantiene en la resolución principal y en todas las resoluciones declaradas dentro del alcance.

Bandas informativas, sin sustituir las puertas anteriores:

| Nota | Dictamen |
|---:|---|
| 92–100 | Candidato de lanzamiento visual |
| 88–91,5 | Aceptable solo si supera todas las puertas |
| 80–87,5 | Iteración obligatoria; buena base, no aceptada |
| 70–79,5 | Revisión sustancial |
| <70 | Dirección visual o ejecución insuficiente |

### Defectos bloqueantes — iteración automática

- La proyección, profundidad u orden de oclusión hacen que el mapa no se pueda leer como un espacio isométrico coherente.
- El jugador no puede distinguir con rapidez unidades, edificios, recursos, terreno transitable o bandos.
- Escala contradictoria que hace flotar, hunde o atraviesa objetos de forma recurrente.
- HUD crítico ilegible, cortado, solapado o ausente: recursos, población, selección o comandos principales.
- El HUD tapa sistemáticamente el foco de acción o impide seleccionar/entender el mundo.
- Minimapa que contradice la orientación, posiciones o colores del mundo.
- Activos rotos, áreas vacías accidentales, texto provisional, `NaN`/`undefined` o errores visibles.
- Información crítica comunicada solo mediante una diferencia cromática que falla en una simulación común de daltonismo.
- Rotura de viewport dentro del alcance: overflow, bandas no diseñadas, controles inaccesibles o contenido esencial fuera de pantalla.
- Un efecto, niebla, sombra o capa decorativa oculta la acción principal de manera persistente.

### Defectos mayores — no se acepta hasta corregirlos

- Ángulo, sombra o orientación inconsistentes entre familias de objetos.
- Terreno con costuras, mosaico repetitivo dominante o transiciones rectangulares visibles.
- Escena demasiado vacía para parecer un asentamiento RTS o tan cargada que pierde rutas y siluetas.
- Landmark sin prioridad o decorado que compite con unidades/recursos interactivos.
- Color de jugador débil en uno de los fondos principales o usado como contorno estridente sin integración.
- Edificios genéricos sin jerarquía funcional; unidades que se leen como puntos indistintos a zoom real.
- Iluminación plana o incoherente que elimina volumen y separación material.
- Cifras, iconos o estados del HUD ambiguos; normal, hover, seleccionado y deshabilitado se confunden.
- Niebla de guerra, selección o feedback de daño/actividad incapaz de comunicar su estado.
- La apariencia “AoE” depende solo de un marco ornamental, mientras mundo, escala y jerarquía siguen otra gramática visual.
- Diferencia de nitidez o acabado evidente entre componentes vecinos.
- Un patrón menor repetido tres o más veces que revela un fallo sistémico.

### Defectos menores

Pequeña desalineación, repetición localizada, recorte no crítico, inconsistencia puntual de sombra/icono o detalle cosmético que no cambia la lectura. Se documenta con ubicación exacta; no se usa “pulir” como diagnóstico.

## Formato del informe posterior

Cuando lleguen las capturas, la revisión entregará en este orden:

1. Dictamen: `ACEPTA`, `ITERA` o `EVIDENCIA INSUFICIENTE`.
2. Tabla de puntuación completa sobre 100, sin redondear antes de sumar.
3. Defectos ordenados por severidad, cada uno con captura y región precisa.
4. Resultado de los pares enmascarados y límites observados.
5. Las tres correcciones visuales de mayor impacto; ninguna lista de extras especulativos.

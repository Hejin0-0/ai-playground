# Dominios 2100

Vertical slice jugable de estrategia en tiempo real, realizado con Three.js y sin recursos gráficos binarios. El mapa, el agua, la costa, la vegetación, las unidades, los edificios, los iconos de mundo y los efectos se generan en código.

## Ejecutar

```bash
npm install
npm run dev
```

Para verificar la entrega:

```bash
npm run check
```

## Equivalencias históricas

| Dominios 2100 | Periodo | Equivalente en Age of Empires II | Cambio visual |
|---|---:|---|---|
| Era del Vapor | 1800 | Edad Oscura | Ladrillo, madera, carbón y producción artesanal |
| Era Industrial | 1900 | Edad Feudal | Acero, motores, hormigón y producción en serie |
| Era Digital | 2000 | Edad de los Castillos | Redes, automatización y guerra de precisión |
| Era de Fusión | 2100 | Edad Imperial | Materia programable, energía limpia y unidades sintéticas |

## Controles

- `WASD` o flechas: mover la cámara; `Shift` acelera.
- `Q` / `E`: girar 15 grados.
- Rueda: zoom hacia el cursor.
- Clic o arrastre: selección individual o múltiple; `Shift` suma o quita unidades.
- Doble clic: seleccionar todas las unidades visibles del mismo tipo.
- Clic derecho: mover, atacar o recolectar.
- `H`: volver al centro de mando.
- `.`: buscar un operario ocioso.
- `1`–`9`: ejecutar las órdenes visibles.
- `Esc`: cancelar una construcción.

## Qué incluye

- Economía con cuatro recursos que cambian de identidad por era, población, recolección activa e ingresos de edificios.
- Nueve órdenes contextuales: cuatro unidades, cuatro edificios y avance de era.
- Colocación de edificios con previsualización y validación del terreno.
- Base inicial activa, caminos, unidades en formación, combate, proyectiles, daño, barras de vida, escombros e incursiones de IA.
- Remodelado procedural de todas las entidades al avanzar de era.
- Cámara ortográfica isométrica con inercia, borde de pantalla, zoom al cursor y sacudida de impacto.
- HUD completo en español, estadísticas, minimapa sincronizado, objetivos, alertas, ayuda, audio WebAudio y modo de movimiento reducido.
- Niebla de guerra suavizada con estados visible/recordado/no explorado y ocultación táctica de recursos y enemigos.
- Terreno determinista con texturas periódicas, agua animada, costa, cobertura instanciada, cielo, atmósferas por era, sombras y postproceso.
- Feedback geométrico distinto para mover, atacar, recolectar, construir e impactar.

## Arquitectura

- `src/catalog.js`: eras y fichas de unidades/edificios.
- `src/gameplay.js`: reglas puras e inmutables de economía, población, avance y combate.
- `src/visibility.js`: cuadrícula persistente compartida por niebla, entidades y minimapa.
- `src/world.js`: generación visual y fábricas Three.js.
- `src/main.js`: integración, entrada, IA, cámara y bucle de juego.
- `src/styles.css`: sistema visual del HUD y sus variantes por era.

## Referencias

La gramática visual se contrastó con material oficial de *Age of Empires II: Definitive Edition*. También se consultó el proyecto MIT [alandaitch/imperios-1800-2100](https://github.com/alandaitch/imperios-1800-2100) como referencia técnica para detalle procedural, cámara RTS y evaluación de contraste; esta implementación mantiene una arquitectura y código propios.

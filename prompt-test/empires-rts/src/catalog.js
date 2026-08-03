export const ERA_IDS = Object.freeze([1800, 1900, 2000, 2100]);
export const ERA_INICIAL = ERA_IDS[0];
export const ERA_FINAL = ERA_IDS.at(-1);

export const ERAS = Object.freeze([
  Object.freeze({ id: 1800, nombre: 'Era del Vapor', equivalente: 'Edad Oscura', descripcion: 'Vapor, carbón y producción artesanal.' }),
  Object.freeze({ id: 1900, nombre: 'Era Industrial', equivalente: 'Edad Feudal', descripcion: 'Motores, acero y producción en serie.' }),
  Object.freeze({ id: 2000, nombre: 'Era Digital', equivalente: 'Edad de los Castillos', descripcion: 'Redes, automatización y guerra de precisión.' }),
  Object.freeze({ id: 2100, nombre: 'Era de Fusión', equivalente: 'Edad Imperial', descripcion: 'Fusión, inteligencia sintética y materia programable.' }),
]);

export const RECURSOS = Object.freeze({
  alimentos: Object.freeze({ id: 'alimentos', nombre: 'Alimentos', icono: '◆', color: '#e5b85c' }),
  materiales: Object.freeze({ id: 'materiales', nombre: 'Materiales', icono: '⬢', color: '#b6c2c9' }),
  energia: Object.freeze({ id: 'energia', nombre: 'Energía', icono: 'ϟ', color: '#65d5ff' }),
  datos: Object.freeze({ id: 'datos', nombre: 'Datos', icono: '◫', color: '#c088ff' }),
});
export const RECURSO_IDS = Object.freeze(Object.keys(RECURSOS));

// Patrón de recursos narrativos por era adaptado de la referencia MIT:
// https://github.com/alandaitch/imperios-1800-2100
export const IDENTIDAD_ERAS = Object.freeze({
  1800: Object.freeze({
    tema: 'Vapor',
    recursos: Object.freeze({ alimentos: 'Provisiones', materiales: 'Madera y hierro', energia: 'Carbón', datos: 'Planos' }),
    bono: Object.freeze({ nombre: 'Calderas eficientes', recurso: 'energia', multiplicador: 1.1 }),
  }),
  1900: Object.freeze({
    tema: 'Industrial',
    recursos: Object.freeze({ alimentos: 'Raciones', materiales: 'Acero', energia: 'Petróleo', datos: 'Patentes' }),
    bono: Object.freeze({ nombre: 'Producción en serie', recurso: 'materiales', multiplicador: 1.1 }),
  }),
  2000: Object.freeze({
    tema: 'Digital',
    recursos: Object.freeze({ alimentos: 'Biocultivos', materiales: 'Compuestos', energia: 'Red eléctrica', datos: 'Información' }),
    bono: Object.freeze({ nombre: 'Economía en red', recurso: 'datos', multiplicador: 1.1 }),
  }),
  2100: Object.freeze({
    tema: 'Fusión',
    recursos: Object.freeze({ alimentos: 'Nutrientes sintéticos', materiales: 'Nanofibra', energia: 'Fusión', datos: 'Cómputo cuántico' }),
    bono: Object.freeze({ nombre: 'Reactores de fusión', recurso: 'energia', multiplicador: 1.15 }),
  }),
});

export const COSTES_AVANCE = Object.freeze({
  1800: null,
  1900: Object.freeze({ alimentos: 500, materiales: 700, energia: 150 }),
  2000: Object.freeze({ alimentos: 800, materiales: 1_000, energia: 600, datos: 200 }),
  2100: Object.freeze({ alimentos: 1_200, materiales: 1_400, energia: 1_000, datos: 800 }),
});

const LINEAS_UNIDAD = [
  {
    tipo: 'trabajador',
    rol: 'Economía',
    nombres: ['Obrero', 'Operario', 'Ingeniero de campo', 'Sintético'],
    costes: [
      { alimentos: 50 },
      { alimentos: 55 },
      { alimentos: 60, energia: 10 },
      { alimentos: 70, datos: 20 },
    ],
    vida: [40, 50, 60, 75], ataque: [3, 4, 6, 9], defensa: [0, 1, 2, 4],
    alcance: [1, 1, 2, 2], velocidad: [4, 4.2, 4.5, 5], poblacion: [1, 1, 1, 1],
    recoleccion: [10, 12, 15, 18],
  },
  {
    tipo: 'infanteria',
    rol: 'Infantería',
    nombres: ['Fusilero', 'Soldado', 'Comando', 'Centinela fotónico'],
    costes: [
      { alimentos: 60, materiales: 20 },
      { alimentos: 70, materiales: 30 },
      { alimentos: 80, materiales: 40, energia: 20 },
      { alimentos: 90, energia: 45, datos: 25 },
    ],
    vida: [70, 90, 115, 150], ataque: [12, 18, 26, 38], defensa: [2, 4, 7, 11],
    alcance: [6, 7, 8, 9], velocidad: [4.2, 4.3, 4.5, 4.8], poblacion: [1, 1, 1, 1],
    recoleccion: [0, 0, 0, 0],
  },
  {
    tipo: 'vehiculo',
    rol: 'Unidad rápida',
    nombres: ['Dragón blindado', 'Tanque', 'Blindado autónomo', 'Meca gravitatorio'],
    costes: [
      { alimentos: 80, materiales: 80 },
      { materiales: 120, energia: 50 },
      { materiales: 150, energia: 100, datos: 30 },
      { materiales: 180, energia: 160, datos: 80 },
    ],
    vida: [120, 180, 240, 330], ataque: [18, 28, 40, 58], defensa: [5, 9, 14, 22],
    alcance: [2, 6, 7, 8], velocidad: [6, 5, 5.5, 6.5], poblacion: [2, 3, 3, 3],
    recoleccion: [0, 0, 0, 0],
  },
  {
    tipo: 'artilleria',
    rol: 'Asedio',
    nombres: ['Cañón de campaña', 'Obús', 'Lanzamisiles', 'Cañón de plasma'],
    costes: [
      { materiales: 120, energia: 40 },
      { materiales: 160, energia: 80 },
      { materiales: 200, energia: 140, datos: 50 },
      { materiales: 240, energia: 220, datos: 120 },
    ],
    vida: [85, 120, 160, 220], ataque: [32, 46, 65, 95], defensa: [1, 3, 6, 10],
    alcance: [10, 12, 14, 16], velocidad: [2.5, 2.8, 3.2, 4], poblacion: [3, 3, 4, 4],
    recoleccion: [0, 0, 0, 0],
  },
];

const LINEAS_EDIFICIO = [
  {
    tipo: 'centro',
    funcion: 'Centro principal',
    nombres: ['Puesto industrial', 'Ayuntamiento moderno', 'Centro de mando', 'Núcleo de colonia'],
    costes: [
      { alimentos: 200, materiales: 350 },
      { alimentos: 250, materiales: 450, energia: 100 },
      { alimentos: 300, materiales: 550, energia: 250, datos: 100 },
      { alimentos: 400, materiales: 700, energia: 450, datos: 300 },
    ],
    vida: [900, 1_150, 1_450, 1_900], defensa: [5, 8, 12, 18], ataque: [6, 10, 16, 25],
    alcance: [7, 8, 9, 10], capacidadPoblacion: [10, 10, 10, 10], entrena: ['trabajador'],
  },
  {
    tipo: 'vivienda',
    funcion: 'Aumenta la población',
    nombres: ['Barracón', 'Casa urbana', 'Módulo habitacional', 'Hábitat orbital'],
    costes: [
      { materiales: 100 },
      { materiales: 120, energia: 20 },
      { materiales: 140, energia: 40 },
      { materiales: 170, energia: 70, datos: 20 },
    ],
    vida: [350, 430, 520, 650], defensa: [1, 2, 4, 7], ataque: [0, 0, 0, 0],
    alcance: [0, 0, 0, 0], capacidadPoblacion: [5, 8, 10, 12], entrena: [],
  },
  {
    tipo: 'cuartel',
    funcion: 'Entrena infantería',
    nombres: ['Arsenal', 'Cuartel mecanizado', 'Base táctica', 'Bastión fotónico'],
    costes: [
      { materiales: 180 },
      { materiales: 220, energia: 50 },
      { materiales: 260, energia: 100, datos: 30 },
      { materiales: 320, energia: 160, datos: 70 },
    ],
    vida: [550, 700, 900, 1_150], defensa: [3, 5, 8, 13], ataque: [0, 0, 0, 0],
    alcance: [0, 0, 0, 0], capacidadPoblacion: [0, 0, 0, 0], entrena: ['infanteria'],
  },
  {
    tipo: 'fabrica',
    funcion: 'Produce vehículos y artillería',
    nombres: ['Fundición', 'Fábrica de guerra', 'Planta robótica', 'Ensamblador nanométrico'],
    costes: [
      { materiales: 240, energia: 60 },
      { materiales: 300, energia: 100 },
      { materiales: 360, energia: 180, datos: 60 },
      { materiales: 440, energia: 280, datos: 140 },
    ],
    vida: [600, 780, 980, 1_280], defensa: [3, 6, 9, 14], ataque: [0, 0, 0, 0],
    alcance: [0, 0, 0, 0], capacidadPoblacion: [0, 0, 0, 0], entrena: ['vehiculo', 'artilleria'],
  },
  {
    tipo: 'laboratorio',
    funcion: 'Genera datos',
    nombres: ['Academia', 'Instituto técnico', 'Centro de datos', 'Singularidad aplicada'],
    costes: [
      { materiales: 160, energia: 80 },
      { materiales: 200, energia: 120 },
      { materiales: 250, energia: 180, datos: 40 },
      { materiales: 320, energia: 260, datos: 120 },
    ],
    vida: [420, 520, 680, 880], defensa: [2, 3, 6, 10], ataque: [0, 0, 0, 0],
    alcance: [0, 0, 0, 0], capacidadPoblacion: [0, 0, 0, 0], entrena: [],
  },
];

const crearUnidad = (linea, indice) => Object.freeze({
  tipo: linea.tipo,
  nombre: linea.nombres[indice],
  rol: linea.rol,
  era: ERA_IDS[indice],
  coste: Object.freeze(linea.costes[indice]),
  vida: linea.vida[indice],
  ataque: linea.ataque[indice],
  defensa: linea.defensa[indice],
  alcance: linea.alcance[indice],
  velocidad: linea.velocidad[indice],
  poblacion: linea.poblacion[indice],
  recoleccion: linea.recoleccion[indice],
});

const crearEdificio = (linea, indice) => Object.freeze({
  tipo: linea.tipo,
  nombre: linea.nombres[indice],
  funcion: linea.funcion,
  era: ERA_IDS[indice],
  coste: Object.freeze(linea.costes[indice]),
  vida: linea.vida[indice],
  ataque: linea.ataque[indice],
  defensa: linea.defensa[indice],
  alcance: linea.alcance[indice],
  capacidadPoblacion: linea.capacidadPoblacion[indice],
  entrena: Object.freeze([...linea.entrena]),
});

export const UNIDADES = Object.freeze(Object.fromEntries(
  ERA_IDS.map((era, indice) => [era, Object.freeze(LINEAS_UNIDAD.map((linea) => crearUnidad(linea, indice)))]),
));

export const EDIFICIOS = Object.freeze(Object.fromEntries(
  ERA_IDS.map((era, indice) => [era, Object.freeze(LINEAS_EDIFICIO.map((linea) => crearEdificio(linea, indice)))]),
));

export const TIPOS_UNIDAD = Object.freeze(LINEAS_UNIDAD.map(({ tipo }) => tipo));
export const TIPOS_EDIFICIO = Object.freeze(LINEAS_EDIFICIO.map(({ tipo }) => tipo));

export const obtenerEra = (era) => ERAS.find(({ id }) => id === Number(era)) ?? null;
export const obtenerUnidad = (tipo, era) => UNIDADES[Number(era)]?.find((unidad) => unidad.tipo === tipo) ?? null;
export const obtenerEdificio = (tipo, era) => EDIFICIOS[Number(era)]?.find((edificio) => edificio.tipo === tipo) ?? null;

export function catalogoDeEra(era) {
  const ficha = obtenerEra(era);
  return ficha ? { era: ficha, unidades: UNIDADES[ficha.id], edificios: EDIFICIOS[ficha.id] } : null;
}

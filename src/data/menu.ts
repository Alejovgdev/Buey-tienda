// src/data/menu.ts

export interface MenuItem {
  id: string;
  categoria: "Entrantes" | "Carnes" | "Hamburguesas" | "Kebabs" | "Postres" | "Bebidas";
  nombre: string;
  descripcion: string;
  alergenos?: string;
  precio: string;
  imagen?: string;
  unidad?: boolean; 
  detalle?: string;
  incluye?: string;
  tipo?: string;

  subcategoria?: "Cervezas" | "Refrescos" | "Vinos" | "Cafes" | "Cavas";
}

export const menuItems: MenuItem[] = [
  // =========================
  // ENTRANTES FRÍOS Y NO TAN FRÍOS
  // =========================
  {
    id: "ent-1",
    categoria: "Entrantes",
    tipo: "Frío",
    nombre: "Tartar de auténtico buey gallego LYO",
    descripcion:
      "Carne de auténtico buey gallego selección LYO con maduración extrema, fusionada con emulsión de yema y grasa de buey.",
    precio: "24€",
  },
  {
    id: "ent-3",
    categoria: "Entrantes",
    tipo: "Frío",
    nombre: "Tabla de picaña",
    descripcion:
      "Picaña de buey selección LYO con 500 días de maduración, atemperada a 60 grados.",
    precio: "28€",
  },
  {
    id: "ent-4",
    categoria: "Entrantes",
    tipo: "Frío",
    nombre: "Tabla de cecina",
    descripcion: "Cecina de auténtico buey.",
    precio: "20€",
  },
  {
    id: "ent-2",
    categoria: "Entrantes",
    tipo: "Frío",
    nombre: "Tabla mixta",
    descripcion:
      "Combinación de picaña y cecina de buey.",
    precio: "26€",
  },
  {
    id: "ent-5",
    categoria: "Entrantes",
    tipo: "Frío",
    nombre: "Rueda de queso",
    descripcion:
      "Cubos de queso de leche cruda de oveja con virutas de cecina en su interior.",
    precio: "12€",
  },
  {
    id: "ent-7",
    categoria: "Entrantes",
    tipo: "Frío",
    nombre: "Trinchado de wagyu (máxima infiltración)",
    descripcion: "Trinchado de wagyu japonés A5.",
    precio: "27€",
    detalle: "100 g",
  },

  // =========================
  // ENTRANTES (CALIENTES)
  // =========================
    {
    id: "ent-17",
    categoria: "Entrantes",
    tipo: "Entrante",
    nombre: "Croquetas de chuletón",
    descripcion:
      "Espectacular croqueta de chuletón acompañada con mayonesa de grasa de chuletón.\nMínimo 2 unidades.",
    precio: "4€/ud",
    unidad: true,
  },
  {
    id: "ent-8",
    categoria: "Entrantes",
    tipo: "Entrante",
    nombre: "Las croquetas del buey",
    descripcion:
      "Croqueta de cecina de buey con leche de oveja envuelta con cecina de buey, sobre palomitas de torrezno deshidratado. Pídela y nosotros te diremos cómo comértela.\nMínimo 2 unidades.",
    precio: "4€/ud",
    unidad: true,
  },
  {
    id: "ent-9",
    categoria: "Entrantes",
    tipo: "Entrante",
    nombre: "Croquetas de gamba roja al ajillo con kimchi",
    descripcion:
      "Croqueta de gamba roja al ajillo con kimchi.\nMínimo 2 unidades.",
    precio: "3€/ud",
    unidad: true,
  },
  {
    id: "ent-11",
    categoria: "Entrantes",
    tipo: "Entrante",
    nombre: "Patatas EL BUEY",
    descripcion:
      "Patata natural, pastrami de vaca madurada premium, salsa de trufa negra y queso parmesano.",
    precio: "15€",
  },
  {
    id: "ent-12",
    categoria: "Entrantes",
    tipo: "Entrante",
    nombre: "Buñuelos de vaca madurada",
    descripcion:
      "Masa de buñuelo valenciano relleno de vaca madurada y queso de tetilla, acompañados con salsa de trufa, 2 unidades.",
    precio: "10€",
    detalle: "2 unidades",
  },
  {
    id: "ent-13",
    categoria: "Entrantes",
    tipo: "Entrante",
    nombre: "Quesadilla de buey gallego",
    descripcion:
      "Carne de buey gallego con 500 días de maduración, salsa de trufa negra, queso parmesano, topping de doritos y foie fresco rallado.",
    precio: "15€",
  },
  {
    id: "ent-14",
    categoria: "Entrantes",
    tipo: "Entrante",
    nombre: "Tentáculos del buey",
    descripcion:
      "Tentáculos de pulpo a la brasa sobre parmentier de patata y kimchi, fusionados con picaña de buey de 500 días de maduración.",
    precio: "28€",
  },
  {
    id: "ent-15",
    categoria: "Entrantes",
    tipo: "Entrante",
    nombre: "Calamar de playa XXL",
    descripcion:
      "Calamar de playa XXL en dos texturas con salsa de ajo y perejil, acompañado con mayonesa de ajo puerro y cecina.",
    precio: "24€",
  },
  {
    id: "ent-16",
    categoria: "Entrantes",
    tipo: "Entrante",
    nombre: "Cesta de pan",
    descripcion:
      "4 unidades.",
    precio: "6€",
  },

  // =========================
  // HAMBURGUESAS
  // =========================
  {
    id: "ham-0",
    categoria: "Hamburguesas",
    tipo: "Suplemento",
    nombre: "Mejora a carne de buey (500 días)",
    descripcion:
      "Sustituye la carne de vaca de la hamburguesa por carne de buey madurada 500 días LYO.",
    precio: "5€",
    unidad: true,
  },
    {
    id: "ham-9",
    categoria: "Hamburguesas",
    tipo: "Suplemento",
    nombre: "Carne extra de vaca (200 días)",
    descripcion:
      "Añade 180 g extra de carne de vaca madurada 200 días.",
    precio: "5€",
    unidad: true,
  },
    {
    id: "ham-10",
    categoria: "Hamburguesas",
    tipo: "Suplemento",
    nombre: "Carne extra de buey (500 días)",
    descripcion:
      "Añade 180 g extra de carne de buey madurado 500 días.",
    precio: "8€",
    unidad: true,
  },
  {
    id: "ham-11",
    categoria: "Hamburguesas",
    tipo: "Hamburguesa",
    nombre: "La Navarra",
    descripcion:
      "Burger del mes de noviembre: carne de chuletón de vaca frisona madurada, queso Idiazábal de oveja ahumado, pimientos del piquillo y mayonesa de chistorra.",
    precio: "17€",
  },
  {
    id: "ham-14",
    categoria: "Hamburguesas",
    tipo: "Hamburguesa",
    nombre: "La Carbonara",
    descripcion:
      "180 g de carne de vaca rubia gallega con más de 150 días de maduración, emulsión de yema con aceite de guanciale, guanciale fundido sobre la hamburguesa, queso trufado, chips de guanciale, queso pecorino rallado por encima del pan.",
    precio: "17€",
  },
  {
    id: "ham-15",
    categoria: "Hamburguesas",
    tipo: "Hamburguesa",
    nombre: "Boss",
    descripcion:
      "180 g de carne de vaca rubia gallega con más de 150 días de maduración, queso brie, mermelada de bacon, queso cheddar y demiglace de salsa barbacoa.",
    precio: "17€",
  },
  {
    id: "ham-8",
    categoria: "Hamburguesas",
    tipo: "Hamburguesa",
    nombre: "Los Cuñaos",
    descripcion:
      "180 g de carne mitad buey nacional mitad rubia gallega. Mayonesa de tuétano. Secreto de buey gallego 200 días de maduración. Demiglace de buey caramelizada. Queso cheddar madurado picante.",
    precio: "20€",
  },
  {
    id: "ham-1",
    categoria: "Hamburguesas",
    tipo: "Hamburguesa",
    nombre: "Búfalo",
    descripcion:
      "180 g de carne de vaca rubia gallega con +150 días de maduración (selección especial LYO), costilla de vaca rubia gallega, queso ahumado y glaseado de barbacoa de Coca-Cola.",
    precio: "18€",
  },
  {
    id: "ham-2",
    categoria: "Hamburguesas",
    tipo: "Hamburguesa",
    nombre: "EsMMY Buey",
    descripcion:
      "180 g de carne de vaca rubia gallega con +150 días de maduración (selección especial LYO), cebolla caramelizada, queso ahumado, salsa EMMY, envuelta en picaña de buey gallego con 500 días de maduración.",
    precio: "18€",
  },
  {
    id: "ham-3",
    categoria: "Hamburguesas",
    tipo: "Hamburguesa",
    nombre: "La Suprema",
    descripcion:
      "180 g de carne de vaca rubia gallega con +150 días de maduración (selección especial LYO), cecina de buey, queso de tetilla estilo raclette y mayonesa de ajo puerro y cecina.",
    precio: "18€",
  },
  {
    id: "ham-4",
    categoria: "Hamburguesas",
    tipo: "Hamburguesa",
    nombre: "Buey",
    descripcion:
      "180 g de carne de vaca rubia gallega con +150 días de maduración (selección especial LYO), pastrami de vaca selección LYO, queso cheddar inglés madurado y crema de trufa negra.",
    precio: "18€",
  },
  {
    id: "ham-5",
    categoria: "Hamburguesas",
    tipo: "Hamburguesa",
    nombre: "Doritos Cheese Lover",
    descripcion:
      "180 g de carne de vaca rubia gallega con +150 días de maduración (selección especial LYO), tortita de queso mozzarella, queso ahumado, crema de queso azul, mayonesa de chili dulce y topping de doritos.",
    precio: "16€",
  },
  {
    id: "ham-6",
    categoria: "Hamburguesas",
    tipo: "Hamburguesa",
    nombre: "Carlos Catalá",
    descripcion:
      "180 g de carne de vaca rubia gallega con +150 días de maduración (selección especial LYO), panceta cocinada a baja temperatura y ahumada, queso ahumado, salsa hotney y relish de pepinillo.",
    precio: "18€",
    detalle: "200 g",
  },
  {
    id: "ham-7",
    categoria: "Hamburguesas",
    tipo: "Hamburguesa",
    nombre: "👑 The Golden Burger",
    descripcion:
      "180 g de auténtico buey gallego (cárnicas LYO) con maduración extrema de 500 días, auténtico wagyu japonés A5, queso ahumado, toque de mayonesa yakitori con grasa de vaca madurada, brioche envuelto en oro de 24k.",
    precio: "28€",
    detalle: "200 g",
  },
  {
    id: "ham-12",
    categoria: "Hamburguesas",
    tipo: "Hamburguesa",
    nombre: "Bandeja de patatas fritas",
    descripcion:
      "",
    precio: "5€",
    detalle: "200 g",
  }, 
    {
    id: "ham-13",
    categoria: "Hamburguesas",
    tipo: "Hamburguesa",
    nombre: "Bandeja de boniato frito",
    descripcion:
      "",
    precio: "6€",
    detalle: "200 g",
  },
  // =========================
  // KEBABS
  // =========================
  {
    id: "kebab-1",
    categoria: "Kebabs",
    tipo: "Kebab",
    nombre: "Tradicional",
    descripcion:
      "Lechuga, tomate, cebolla, salsa de ajo y salsa de yogur.",
    precio: "12€",
  },
  {
    id: "kebab-2",
    categoria: "Kebabs",
    tipo: "Kebab",
    nombre: "Calixto XIII",
    descripcion:
      "Patatas fritas, cebolla caramelizada, queso cheddar inglés ahumado y salsa curry española de pimientos asados.",
    precio: "13€",
  },
  {
    id: "kebab-3",
    categoria: "Kebabs",
    tipo: "Kebab",
    nombre: "Sultán",
    descripcion:
      "Patatas fritas, pastrami de carne madurada, queso cheddar inglés madurado y salsa de trufa.",
    precio: "13€",
  },
  // =========================
  // CARNES
  // =========================

  {
    id: "car-1",
    categoria: "Carnes",
    nombre: "Entrecot de vaca rubia gallega",
    descripcion: "Entrecot de vaca rubia gallega con 50 días de maduración.",
    precio: "28€",
    detalle: "300–350 g",
  },
  {
    id: "car-2",
    categoria: "Carnes",
    nombre: "Entrecot Old Special Beef PREMIUM",
    descripcion:
      "Entrecot Old Especial Beef PREMIUM con 70 días de maduración.",
    precio: "38€",
    detalle: "300–350 g",
  },
  {
    id: "car-8",
    categoria: "Carnes",
    nombre: "★ Edición especial · Tomahawk Vaca",
    descripcion: "Tomahawk de vaca madurada con un marmoleado de escándalo. Piezas limitadas.\nNo te lo pierdas.",
    precio: "60€/kg",
    detalle: "",
  },
  {
    id: "car-3",
    categoria: "Carnes",
    nombre: "Chuletón VACA WAGYU",
    descripcion: "Chuletón de vaca Wagyu con +180 días de maduración. Pieza exclusiva hasta fin de existencias.",
    precio: "100€/kg",
    detalle: "50€",
  },
  {
    id: "car-4",
    categoria: "Carnes",
    nombre: "Chuletón GOLD",
    descripcion:
      "Chuletón de vaca Simmental con +50 días de maduración. Selección especial Juan Navarro.",
    precio: "80€/kg",
    detalle: "€/kg",
  },
  {
    id: "car-5",
    categoria: "Carnes",
    nombre: "Chuletón ESMERALDA",
    descripcion:
      "Chuletón de vaca rubia gallega con +90 días de maduración. Selección especial Juan Navarro.",
    precio: "100€/kg",
    detalle: "€/kg",
  },
  {
    id: "car-6",
    categoria: "Carnes",
    nombre: "Chuletón DIAMANTE TOP",
    descripcion:
      "Chuletón de vaca Simmental con +150 días de maduración. Selección especial Juan Navarro.",
    precio: "120€/kg",
    detalle: "€/kg",
  },
  {
    id: "car-7",
    categoria: "Carnes",
    nombre: "Chuletón BUEY NACIONAL",
    descripcion:
      "Chuletón de buey nacional con más de +250 días de maduración, otro nivel.",
    precio: "150€/kg",
    detalle: "€/kg",
  },
  {
    id: "car-9",
    categoria: "Carnes",
    nombre: "🔥 Chuletón de vaca\n MADURACIÓN EXTREMA",
    descripcion:
      "Chuletón de vaca nacional con más de 500 días de maduración.\n Una vez que lo pruebes, entenderás por qué la espera de meses vale la pena. Porque la verdadera excelencia nunca tiene prisa.",
    precio: "150€/kg",
    detalle: "€/kg",
  },
  // POSTRES
  // =========================
  {
    id: "pos-5",
    categoria: "Postres",
    nombre: "Postre carnívoro",
    descripcion:
      "Helado de queso parmesano con picaña de buey con 500 días de maduración y Peta Zetas de chocolate.",
    precio: "7,50€",
  },
  {
    id: "pos-12",
    categoria: "Postres",
    nombre: "Torrija brioche caramelizada",
    descripcion:
      "Torrija de pan brioche caramelizada con helado de vainilla.",
    precio: "7,50€",
  },
  {
    id: "pos-13",
    categoria: "Postres",
    nombre: "Cookie de chocolate",
    descripcion:
      "Cookie de chocolate con helado de vainilla y sirope a elegir (chocolate blanco, Kinder o pistacho).",
    precio: "7€",
  },
  {
    id: "pos-2",
    categoria: "Postres",
    nombre: "Tarta de queso Kinder",
    descripcion:
      "Tarta de queso cremosa con el sabor inconfundible de Kinder, suave, dulce y perfecta para los más golosos.",
    precio: "7,50€",
  },
  {
    id: "pos-14",
    categoria: "Postres",
    nombre: "Tarta de la abuela",
    descripcion:
      "Vainilla, galleta y chocolate.",
    precio: "6€",
  },
  {
    id: "pos-4",
    categoria: "Postres",
    nombre: "Flan casero",
    descripcion:
      "Flan cremoso elaborado a base de huevos, nata y leche condensada, con una textura suave y un sabor tradicional.",
    precio: "6€",
  },
  {
    id: "pos-15",
    categoria: "Postres",
    nombre: "Tarta crujiente de almendras",
    descripcion:
      "Tarta crujiente de almendras con caramelo.",
    precio: "6€",
  },
  {
    id: "pos-11",
    categoria: "Postres",
    nombre: "Tarta de queso de coco y maracuyá",
    descripcion:
      "Tarta de queso cremosa con coco y maracuyá, una combinación tropical, fresca y equilibrada entre dulzor y acidez.",
    precio: "7,50€",
  },
    {
    id: "pos-7",
    categoria: "Postres",
    nombre: "Coulant de Lotus",
    descripcion:
      "Cremoso coulant con sabor a lotus con una bola de helado a elegir (vainilla, nata o chocolate).",
    precio: "7,50€",
  },
  {
    id: "pos-8",
    categoria: "Postres",
    nombre: "Coulant de Baileys",
    descripcion:
      "Cremoso coulant con sabor a Baileys con una bola de helado a elegir (vainilla, nata o chocolate).",
    precio: "7,50€",
  },
  {
  id: "pos-16",
  categoria: "Postres",
  nombre: "Tarta Dubái",
  descripcion:
    "Tarta de chocolate con crema de pistacho y crujiente de kataifi, inspirada en el irresistible chocolate Dubái.",
  precio: "7€",
},
{
  id: "pos-17",
  categoria: "Postres",
  nombre: "Tarta de leche merengada",
  descripcion:
    "Suave y cremosa tarta de leche merengada con toques de canela y limón.",
  precio: "7€",
},
{
  id: "pos-18",
  categoria: "Postres",
  nombre: "Tiramisú de pistacho",
  descripcion:
    "Una versión del clásico tiramisú con suave crema de mascarpone y el intenso sabor del pistacho.",
  precio: "7€",
},
{
  id: "pos-19",
  categoria: "Postres",
  nombre: "Tarta de queso donostiarra con turrón",
  descripcion:
    "Cremosa tarta de queso al estilo donostiarra con el sabor tradicional del turrón.",
  precio: "7€",
},
{
  id: "pos-9",
  categoria: "Postres",
  nombre: "Helado",
  descripcion:
    "2 bolas de helado a elegir (vainilla, nata o chocolate), combínalas como quieras.",
  precio: "6€",
},
  // =========================
  // BEBIDAS
  // =========================

  // 🍺 CERVEZAS
  {
    id: "beb-cer-9",
    categoria: "Bebidas",
    subcategoria: "Cervezas",
    nombre: "Mahou Maestra Doble Lúpulo",
    descripcion: "",
    precio: "3,20€",
  },
  {
    id: "beb-cer-2",
    categoria: "Bebidas",
    subcategoria: "Cervezas",
    nombre: "Alhambra Reserva 1925",
    descripcion: "",
    precio: "3,20€",
  },
    {
    id: "beb-cer-10",
    categoria: "Bebidas",
    subcategoria: "Cervezas",
    nombre: "Stella Artois",
    descripcion: "",
    precio: "3,20€",
  },
  {
    id: "beb-cer-3",
    categoria: "Bebidas",
    subcategoria: "Cervezas",
    nombre: "Mahou Barrica Bourbon",
    descripcion: "",
    precio: "4,30€",
  },
  {
    id: "beb-cer-4",
    categoria: "Bebidas",
    subcategoria: "Cervezas",
    nombre: "Mahou 5 Estrellas",
    descripcion: "",
    precio: "2,80€",
  },
  {
    id: "beb-cer-5",
    categoria: "Bebidas",
    subcategoria: "Cervezas",
    nombre: "Mahou 0,0 Tostada",
    descripcion: "",
    precio: "2,80€",
  },
  {
    id: "beb-cer-6",
    categoria: "Bebidas",
    subcategoria: "Cervezas",
    nombre: "Mahou Sin Gluten",
    descripcion: "",
    precio: "2,80€",
  },
  {
    id: "beb-cer-7",
    categoria: "Bebidas",
    subcategoria: "Cervezas",
    nombre: "Mahou Radler",
    descripcion: "",
    precio: "2,80€",
  },
  {
    id: "beb-cer-8",
    categoria: "Bebidas",
    subcategoria: "Cervezas",
    nombre: "Mahou Rosé (fresa)",
    descripcion: "",
    precio: "3,20€",
  },

  // 🥤 REFRESCOS & AGUAS
  {
    id: "beb-ref-3",
    categoria: "Bebidas",
    subcategoria: "Refrescos",
    nombre: "Refrescos",
    descripcion: "",
    precio: "2,80€",
  },
  {
    id: "beb-ref-1",
    categoria: "Bebidas",
    subcategoria: "Refrescos",
    nombre: "Agua",
    descripcion: "",
    precio: "2,20€",
  },
  {
    id: "beb-ref-2",
    categoria: "Bebidas",
    subcategoria: "Refrescos",
    nombre: "Agua con gas",
    descripcion: "",
    precio: "2,50€",
  },
  {
    id: "beb-ref-6",
    categoria: "Bebidas",
    subcategoria: "Refrescos",
    nombre: "Tinto de verano",
    descripcion: "",
    precio: "4,50€",
  },
  {
    id: "beb-ref-4",
    categoria: "Bebidas",
    subcategoria: "Refrescos",
    nombre: "Tónica Royal Bliss",
    descripcion: "",
    precio: "2,50€",
  },
  {
    id: "beb-ref-5",
    categoria: "Bebidas",
    subcategoria: "Refrescos",
    nombre: "Tónica Royal Bliss Berry",
    descripcion: "",
    precio: "2,50€",
  },
  // ☕ CAFÉS
{
  id: "beb-caf-1",
  categoria: "Bebidas",
  subcategoria: "Cafes",
  nombre: "Solo",
  descripcion: "",
  precio: "1,60€",
},
{
  id: "beb-caf-2",
  categoria: "Bebidas",
  subcategoria: "Cafes",
  nombre: "Cortado",
  descripcion: "",
  precio: "1,80€",
},
{
  id: "beb-caf-3",
  categoria: "Bebidas",
  subcategoria: "Cafes",
  nombre: "Bombón",
  descripcion: "",
  precio: "1,90€",
},
{
  id: "beb-caf-4",
  categoria: "Bebidas",
  subcategoria: "Cafes",
  nombre: "Café con leche",
  descripcion: "",
  precio: "2,20€",
},
{
  id: "beb-caf-5",
  categoria: "Bebidas",
  subcategoria: "Cafes",
  nombre: "Carajillo",
  descripcion: "",
  precio: "2,40€",
},
{
  id: "beb-caf-6",
  categoria: "Bebidas",
  subcategoria: "Cafes",
  nombre: "Infusión",
  descripcion: "",
  precio: "1,50€",
},
{
  id: "beb-caf-7",
  categoria: "Bebidas",
  subcategoria: "Cafes",
  nombre: "Americano",
  descripcion: "",
  precio: "2€",
},
{
  id: "beb-caf-8",
  categoria: "Bebidas",
  subcategoria: "Cafes",
  nombre: "Copa licor",
  descripcion: "",
  precio: "5€",
},
{
  id: "beb-caf-9",
  categoria: "Bebidas",
  subcategoria: "Cafes",
  nombre: "Chupito",
  descripcion: "",
  precio: "2,50€",
},
{
  id: "beb-cav-1",
  categoria: "Bebidas",
  subcategoria: "Cavas",
  nombre: "Cava blanco",
  descripcion: "",
  precio: "20€",
},
{
  id: "beb-cav-2",
  categoria: "Bebidas",
  subcategoria: "Cavas",
  nombre: "Cava rosé",
  descripcion: "",
  precio: "25€",
},

  // 🍷 VINOS
  // Copas
  {
    id: "beb-vin-1",
    categoria: "Bebidas",
    subcategoria: "Vinos",
    tipo: "Copa",
    nombre: "Vino Portia Verdejo (Rueda)",
    descripcion: "Copa, blanco.",
    precio: "3,50€",
  },
  {
    id: "beb-vin-2",
    categoria: "Bebidas",
    subcategoria: "Vinos",
    tipo: "Copa",
    nombre: "Vino Mucho Más",
    descripcion: "Copa, tinto.",
    precio: "3,50€",
  },
  {
    id: "beb-vin-18",
    categoria: "Bebidas",
    subcategoria: "Vinos",
    tipo: "Copa",
    nombre: "Copa Ribera/Rioja",
    descripcion: "Copa, tinto.",
    precio: "4€",
  },
  // Botella - Blanco
  {
    id: "beb-vin-3",
    categoria: "Bebidas",
    subcategoria: "Vinos",
    tipo: "Blanco",
    nombre: "Castillo de Miraflores (Verdejo)",
    descripcion: "Botella, blanco.",
    precio: "16€",
  },
  {
    id: "beb-vin-4",
    categoria: "Bebidas",
    subcategoria: "Vinos",
    tipo: "Blanco",
    nombre: "Quinta do Sil (Godello)",
    descripcion: "Botella, blanco.",
    precio: "22€",
  },
  {
    id: "beb-vin-5",
    categoria: "Bebidas",
    subcategoria: "Vinos",
    tipo: "Blanco",
    nombre: "Gran Bazán Etiqueta Verde (Albariño)",
    descripcion: "D.O. Rías Baixas · 100% Albariño · Botella, blanco.",
    precio: "25€",
  },

  // Botella - Tinto
  {
    id: "beb-vin-9",
    categoria: "Bebidas",
    subcategoria: "Vinos",
    tipo: "Tinto",
    nombre: "Bordón (Crianza)",
    descripcion: "Rioja · Botella, tinto.",
    precio: "16€",
  },
  {
    id: "beb-vin-8",
    categoria: "Bebidas",
    subcategoria: "Vinos",
    tipo: "Tinto",
    nombre: "Álvarez Nölting",
    descripcion: "Utiel, Requena · Botella, tinto.",
    precio: "28€",
  },
  {
    id: "beb-vin-6",
    categoria: "Bebidas",
    subcategoria: "Vinos",
    tipo: "Tinto",
    nombre: "Pago de Fuentecojo",
    descripcion: "Ribera del Duero · Tempranillo 2021 · Botella, tinto.",
    precio: "28€",
  },
  {
    id: "beb-vin-10",
    categoria: "Bebidas",
    subcategoria: "Vinos",
    tipo: "Tinto",
    nombre: "BAI GORRI 2023",
    descripcion: "Rioja · Botella, tinto.",
    precio: "35€",
  },
  {
    id: "beb-vin-13",
    categoria: "Bebidas",
    subcategoria: "Vinos",
    tipo: "Tinto",
    nombre: "Bordón Reserva",
    descripcion: "Rioja · Botella, tinto.",
    precio: "35€",
  },
  {
    id: "beb-vin-11",
    categoria: "Bebidas",
    subcategoria: "Vinos",
    tipo: "Tinto",
    nombre: "Valparaíso Raíces",
    descripcion: "Ribera del Duero · Botella, tinto.",
    precio: "45€",
  },
  {
    id: "beb-vin-12",
    categoria: "Bebidas",
    subcategoria: "Vinos",
    tipo: "Tinto",
    nombre: "Pálpito",
    descripcion: "Bodegas Franco Españolas · Botella, tinto.",
    precio: "60€",
  },
  {
    id: "beb-vin-15",
    categoria: "Bebidas",
    subcategoria: "Vinos",
    tipo: "Tinto",
    nombre: "Clio 2023",
    descripcion: "Juan Gil Jumilla · Botella, tinto.",
    precio: "75€",
  },
  {
    id: "beb-vin-14",
    categoria: "Bebidas",
    subcategoria: "Vinos",
    tipo: "Tinto",
    nombre: "Macán Clásico 2021",
    descripcion: "Rioja · Botella, tinto.",
    precio: "95€",
  },
  {
    id: "beb-vin-16",
    categoria: "Bebidas",
    subcategoria: "Vinos",
    tipo: "Tinto",
    nombre: "El Nido 2023",
    descripcion: "Juan Gil Jumilla · Botella, tinto.",
    precio: "180€",
  },
  {
    id: "beb-vin-17",
    categoria: "Bebidas",
    subcategoria: "Vinos",
    tipo: "Tinto",
    nombre: "Vega Sicilia UNICO 2015",
    descripcion: "Botella, tinto.",
    precio: "475€",
  },
];

export const getMenuByCategory = (categoria: MenuItem["categoria"]) => {
  return menuItems.filter((item) => item.categoria === categoria);
};

export const getMenuItemById = (id: string) => {
  return menuItems.find((item) => item.id === id);
};

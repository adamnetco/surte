export interface Category {
  id: string;
  name: string;
  icon: string;
  slug: string;
  color: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  category_id: string;
  stock: number;
  unit: string;
  isFresh: boolean;
  isWholesale: boolean;
}

export const categories: Category[] = [
  { id: "1", name: "Cárnicos", icon: "Drumstick", slug: "carnicos", color: "hsl(0, 65%, 50%)" },
  { id: "2", name: "Pulpas", icon: "Cherry", slug: "pulpas", color: "hsl(340, 70%, 50%)" },
  { id: "3", name: "Agua", icon: "Droplets", slug: "agua", color: "hsl(200, 70%, 50%)" },
  { id: "4", name: "Salsas", icon: "Flame", slug: "salsas", color: "hsl(25, 90%, 55%)" },
  { id: "5", name: "Panificados", icon: "Croissant", slug: "panificados", color: "hsl(35, 70%, 55%)" },
];

export const products: Product[] = [
  {
    id: "1", name: "Alotas de Pollo SURTE", description: "Alotas de pollo frescas, empacadas al vacío. Ideales para restaurantes.", price: 12500, originalPrice: 15000,
    image: "", category_id: "1", stock: 150, unit: "kg", isFresh: true, isWholesale: true,
  },
  {
    id: "2", name: "Pechuga de Pollo SURTE", description: "Pechuga deshuesada premium, corte uniforme.", price: 14800,
    image: "", category_id: "1", stock: 200, unit: "kg", isFresh: true, isWholesale: true,
  },
  {
    id: "3", name: "Pulpa de Fruta Mango", description: "Pulpa 100% natural de mango, sin conservantes.", price: 8500, originalPrice: 9500,
    image: "", category_id: "2", stock: 80, unit: "500g", isFresh: true, isWholesale: false,
  },
  {
    id: "4", name: "Pulpa de Fruta Mora", description: "Pulpa natural de mora, ideal para jugos y postres.", price: 7800,
    image: "", category_id: "2", stock: 120, unit: "500g", isFresh: true, isWholesale: false,
  },
  {
    id: "5", name: "Agua Natural SURTE 600ml", description: "Agua purificada, presentación personal.", price: 1200,
    image: "", category_id: "3", stock: 500, unit: "unidad", isFresh: false, isWholesale: true,
  },
  {
    id: "6", name: "Agua Natural SURTE 5L", description: "Agua purificada, presentación familiar.", price: 5500,
    image: "", category_id: "3", stock: 300, unit: "unidad", isFresh: false, isWholesale: true,
  },
  {
    id: "7", name: "Salsa BBQ SURTE", description: "Salsa BBQ artesanal, sabor ahumado.", price: 6200, originalPrice: 7000,
    image: "", category_id: "4", stock: 90, unit: "350ml", isFresh: false, isWholesale: false,
  },
  {
    id: "8", name: "Salsa de Tomate SURTE", description: "Salsa de tomate natural sin conservantes.", price: 4500,
    image: "", category_id: "4", stock: 200, unit: "400g", isFresh: false, isWholesale: true,
  },
  {
    id: "9", name: "Pan Tajado Integral", description: "Pan integral tajado, horneado diariamente.", price: 5800,
    image: "", category_id: "5", stock: 60, unit: "500g", isFresh: true, isWholesale: false,
  },
  {
    id: "10", name: "Mogolla Artesanal x6", description: "Mogollas artesanales frescas, paquete x6.", price: 4200,
    image: "", category_id: "5", stock: 45, unit: "paquete", isFresh: true, isWholesale: false,
  },
];

export const MIN_ORDER_AMOUNT = 40000;

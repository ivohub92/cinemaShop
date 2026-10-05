export interface CategoriaProducto {
  id: string;
  nombre: string;
}

export interface Producto {
  id: string;
  categoriaId: string;
  categoria: string;
  nombre: string;
  descripcion: string;
  precio: number;
  imagenUrl: string;
  activo: boolean;
}

/** Lo que manda el formulario del admin para crear o editar. */
export type DatosProducto = Omit<Producto, 'id' | 'categoria' | 'activo'>;

export interface ItemCarrito {
  productoId: string;
  cantidad: number;
}

export interface ItemCombo {
  productoId: string;
  productoNombre: string;
  cantidad: number;
}

export interface Combo {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  imagenUrl: string;
  activo: boolean;
  destacado: boolean;
  items: ItemCombo[];
}

/** Lo que manda el formulario: los ítems solo con id y cantidad. */
export type DatosCombo = Omit<Combo, 'id' | 'activo' | 'items'> & {
  items: { productoId: string; cantidad: number }[];
};
/** Un combo elegido en la compra y cuántas veces. */
export interface ComboElegido {
  comboId: string;
  cantidad: number;
}

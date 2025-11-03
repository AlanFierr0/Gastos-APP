export interface Gasto {
  id: string;
  concepto: string;
  monto: number;
  fecha: string;
  categoria: string;
  descripcion?: string;
}

export interface GastoStats {
  totalGastos: number;
  promedio: number;
  porCategoria: { [key: string]: number };
}

export interface UploadResponse {
  message: string;
  count: number;
  gastos?: Gasto[];
}

export interface FilterOptions {
  categoria?: string;
  fechaInicio?: string;
  fechaFin?: string;
  montoMin?: number;
  montoMax?: number;
}

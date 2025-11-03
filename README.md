# Gastos-APP

Frontend para página de gestión de gastos construido con Next.js, TypeScript y Tailwind CSS.

## Características

- 📊 **Dashboard**: Vista general con estadísticas y tabla de gastos
- 📤 **Upload**: Subida de archivos Excel para importar gastos
- 📈 **Analytics**: Gráficos interactivos y análisis detallado de gastos
- 🔍 **Filtros**: Búsqueda y filtrado de datos en tablas
- 📱 **Responsive**: Diseño adaptativo para todos los dispositivos

## Tecnologías

- **Next.js 16**: Framework de React para producción
- **TypeScript**: Tipado estático para JavaScript
- **Tailwind CSS**: Framework de CSS utility-first
- **Recharts**: Librería para gráficos interactivos
- **Axios**: Cliente HTTP para consumir la API
- **XLSX**: Manejo de archivos Excel

## Requisitos Previos

- Node.js 18+ 
- npm o yarn
- Backend NestJS ejecutándose (por defecto en http://localhost:3001)

## Instalación

1. Clonar el repositorio:
```bash
git clone <repository-url>
cd Gastos-APP
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
```

Edita `.env` y configura la URL de tu API NestJS:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Uso

### Desarrollo

Ejecutar el servidor de desarrollo:
```bash
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000)

### Producción

Construir para producción:
```bash
npm run build
```

Iniciar el servidor de producción:
```bash
npm start
```

### Linting

Ejecutar ESLint:
```bash
npm run lint
```

## Estructura del Proyecto

```
├── app/                    # Páginas de Next.js App Router
│   ├── page.tsx           # Dashboard (página principal)
│   ├── upload/            # Página de carga de archivos
│   ├── analytics/         # Página de análisis
│   ├── layout.tsx         # Layout raíz
│   └── globals.css        # Estilos globales
├── components/            # Componentes reutilizables
│   ├── Layout.tsx        # Layout principal con navegación
│   ├── DataTable.tsx     # Tabla de datos con filtros
│   ├── FileUpload.tsx    # Componente de carga de archivos
│   ├── Charts.tsx        # Gráficos interactivos
│   └── StatsCards.tsx    # Tarjetas de estadísticas
├── hooks/                # Custom hooks de React
│   ├── useGastos.ts     # Hook para fetch de gastos
│   └── useUpload.ts     # Hook para subida de archivos
├── lib/                  # Utilidades y configuración
│   └── api.ts           # Cliente API con Axios
├── types/               # Definiciones de TypeScript
│   └── index.ts        # Tipos e interfaces
└── utils/              # Funciones utilitarias

```

## Formato de Datos

### API Endpoints Esperados

La aplicación espera que el backend NestJS exponga los siguientes endpoints:

- `GET /gastos`: Obtener todos los gastos (soporta query params para filtros)
- `POST /gastos/upload`: Subir archivo Excel con gastos

### Estructura del Archivo Excel

El archivo Excel debe tener las siguientes columnas:

| Columna | Tipo | Requerido | Descripción |
|---------|------|-----------|-------------|
| concepto | string | Sí | Nombre o concepto del gasto |
| monto | number | Sí | Monto del gasto |
| fecha | date | Sí | Fecha del gasto |
| categoria | string | Sí | Categoría del gasto |
| descripcion | string | No | Descripción adicional |

### Tipo de Gasto

```typescript
interface Gasto {
  id: string;
  concepto: string;
  monto: number;
  fecha: string;
  categoria: string;
  descripcion?: string;
}
```

## Características Principales

### Dashboard
- Tarjetas con estadísticas clave (total, promedio, cantidad, categoría mayor)
- Tabla de gastos con ordenamiento y filtros
- Búsqueda por concepto o descripción
- Filtro por categoría

### Upload
- Carga de archivos Excel mediante drag & drop o selección
- Validación de tipo de archivo
- Feedback visual del proceso de carga
- Visualización de gastos cargados

### Analytics
- Gráfico circular de distribución por categoría
- Gráfico de líneas con tendencia mensual
- Gráfico de barras con top 10 gastos
- Gráfico de barras comparando categorías

## Seguridad

⚠️ **Nota sobre Vulnerabilidades**: El proyecto usa `xlsx@0.18.5` que tiene vulnerabilidades conocidas. Se recomienda actualizar a una versión más reciente cuando esté disponible o usar alternativas como `exceljs`.

## Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

ISC

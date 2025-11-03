'use client';

import { useGastos } from '@/hooks/useGastos';
import FileUpload from '@/components/FileUpload';
import DataTable from '@/components/DataTable';

export default function UploadPage() {
  const { gastos, loading, refetch } = useGastos();

  const handleUploadSuccess = () => {
    // Refetch data after successful upload
    refetch();
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-3xl font-bold text-gray-900">Subir Gastos</h1>
          <p className="mt-2 text-sm text-gray-700">
            Sube un archivo Excel con tus gastos para importarlos al sistema
          </p>
        </div>
      </div>

      <div className="mt-8 max-w-2xl">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Cargar Archivo Excel</h2>
          <p className="text-sm text-gray-600 mb-6">
            El archivo debe contener las columnas: concepto, monto, fecha, categoria, y opcionalmente descripcion.
          </p>
          <FileUpload onUploadSuccess={handleUploadSuccess} />
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Gastos Cargados</h2>
        <DataTable gastos={gastos} loading={loading} />
      </div>
    </div>
  );
}

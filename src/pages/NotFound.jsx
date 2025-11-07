import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 py-8">
      <div className="max-w-xl w-full text-center">
        {/* Icono animado */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500/20 dark:bg-red-500/10 rounded-full blur-2xl animate-pulse"></div>
            <div className="relative bg-gradient-to-br from-red-500/10 to-red-500/5 dark:from-red-500/20 dark:to-red-500/10 rounded-full p-6">
              <div className="relative">
                <span className="material-symbols-outlined text-6xl text-red-500 dark:text-red-400">
                  description
                </span>
                <span className="material-symbols-outlined text-3xl text-red-600 dark:text-red-500 absolute -top-1 -right-1 rotate-12">
                  close
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Número 404 con estilo */}
        <div className="mb-4">
          <h1 className="text-7xl md:text-8xl font-black leading-none">
            <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent dark:from-primary dark:via-primary/90 dark:to-primary/70">
              404
            </span>
          </h1>
        </div>

        {/* Título y descripción */}
        <div className="mb-8 space-y-3">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Página no encontrada
          </h2>
          <p className="text-base text-[#616f89] dark:text-gray-400 max-w-md mx-auto">
            Lo sentimos, la página que estás buscando no existe o ha sido movida a otra ubicación.
          </p>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="group flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 dark:hover:bg-primary/80 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
          >
            <span className="material-symbols-outlined text-lg">dashboard</span>
            <span>Volver al Dashboard</span>
          </button>
          
          <button
            onClick={() => navigate(-1)}
            className="group flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span>Volver atrás</span>
          </button>
        </div>

        {/* Enlaces rápidos */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-[#616f89] dark:text-gray-500 mb-3">
            O navega a una de estas páginas:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => navigate('/spreadsheet')}
              className="px-4 py-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Planilla
            </button>
            <button
              onClick={() => navigate('/grid')}
              className="px-4 py-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Grilla
            </button>
            <button
              onClick={() => navigate('/analysis')}
              className="px-4 py-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Análisis
            </button>
            <button
              onClick={() => navigate('/upload')}
              className="px-4 py-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cargar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


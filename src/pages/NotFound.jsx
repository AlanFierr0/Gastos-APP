import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background-light text-[#111318] dark:bg-background-dark dark:text-gray-100 flex flex-col items-center justify-start px-4 pt-16">
      <div className="max-w-xl w-full text-center">
        {/* Logo */}
        <div className="mb-12 flex justify-center">
          <img 
            src="/logo.png" 
            alt="Spendo Logo" 
            className="h-64 w-64 object-contain flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate('/dashboard')}
          />
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
      </div>
    </div>
  );
}


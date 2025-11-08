import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

export default function Logo({ className = '', showLink = true }) {
  const { t } = useApp();
  
  const logoContent = (
    <div className={`flex items-center gap-1 ${className}`}>
      <img 
        src="/logo.png" 
        alt="Spendo Logo" 
        className="h-16 w-16 object-contain flex-shrink-0"
      />
      <span 
        className="font-semibold text-2xl text-[#F0FFF4] tracking-[0.02em]"
        style={{ 
          fontFamily: 'Martius, Poppins, sans-serif',
          fontWeight: 600
        }}
      >
        {t('appName')}
      </span>
    </div>
  );

  if (showLink) {
    return (
      <Link to="/dashboard" className="hover:opacity-80 transition-opacity">
        {logoContent}
      </Link>
    );
  }

  return logoContent;
}


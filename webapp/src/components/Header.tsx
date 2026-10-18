import React from 'react';
import { Menu, FlaskConical } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, subtitle, onMenuClick }) => {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0 z-20">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-label="Open navigation menu"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-gray-900 leading-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-gray-500 leading-tight truncate mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      {/* Demo mode indicator */}
      <div className="demo-banner flex-shrink-0" role="status" aria-label="Application is running in demo mode with simulated data">
        <FlaskConical size={12} aria-hidden="true" />
        <span>DEMO MODE</span>
      </div>
    </header>
  );
};

export default Header;

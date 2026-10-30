import React from 'react';
import { Menu, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, subtitle, onMenuClick }) => {
  const { user } = useAuth();
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

      <div className="hidden sm:flex items-center gap-2 rounded-full bg-gray-50 border border-gray-200 px-3 py-1.5">
        {user?.role === 'admin'
          ? <ShieldCheck size={14} className="text-emerald-700" aria-hidden="true" />
          : <UserRound size={14} className="text-gray-500" aria-hidden="true" />}
        <span className="text-xs font-medium text-gray-600 capitalize">{user?.role}</span>
      </div>
    </header>
  );
};

export default Header;

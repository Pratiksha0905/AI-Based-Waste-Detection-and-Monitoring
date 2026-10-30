import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ScanSearch,
  MapPin,
  BarChart3,
  ClipboardList,
  Info,
  Leaf,
  X,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  onClose?: () => void;
  isMobile?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose, isMobile }) => {
  const { user, logout } = useAuth();
  const navItems: NavItem[] = [
    { label: 'Dashboard', to: '/', icon: <LayoutDashboard size={18} /> },
    ...(user?.role === 'admin'
      ? [{ label: 'All reports', to: '/admin/reports', icon: <ClipboardList size={18} /> }]
      : [
          { label: 'Submit report', to: '/analysis', icon: <ScanSearch size={18} /> },
          { label: 'My reports', to: '/history', icon: <ClipboardList size={18} /> },
        ]),
    ...(user?.role === 'admin'
      ? [
          { label: 'Hotspot map', to: '/map', icon: <MapPin size={18} /> },
          { label: 'Analytics', to: '/analytics', icon: <BarChart3 size={18} /> },
        ]
      : []),
  ];

  return (
    <div className="sidebar h-full select-none">
      {/* Logo / Brand */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
            <Leaf size={16} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight leading-none">
              EcoWatch AI
            </div>
            <div className="text-[10px] text-white/50 mt-0.5 leading-none font-medium tracking-wide uppercase">
              Smart City Waste Intelligence
            </div>
          </div>
        </div>
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto no-scrollbar" aria-label="Main navigation">
        <div className="px-3 mb-2">
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-1 mb-1">
            Navigation
          </p>
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={isMobile ? onClose : undefined}
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <span className="flex-shrink-0">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer info */}
      <div className="mt-auto px-4 py-4 border-t border-white/10">
        <NavLink
          to="/about"
          onClick={isMobile ? onClose : undefined}
          className={({ isActive }) =>
            `sidebar-nav-item ${isActive ? 'active' : ''} text-xs`
          }
        >
          <Info size={15} />
          <span>About &amp; Integration</span>
        </NavLink>
        <div className="mt-3 mx-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
          <p className="text-xs font-medium text-white truncate">{user?.name}</p>
          <p className="text-[10px] text-white/45 truncate">{user?.email}</p>
          <p className="text-[10px] text-emerald-300 mt-1 capitalize">{user?.role} account</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="sidebar-nav-item w-[calc(100%-1rem)] text-left text-xs"
        >
          <LogOut size={15} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

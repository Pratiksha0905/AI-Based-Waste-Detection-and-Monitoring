import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Waste Reports', subtitle: 'Monitor submissions and review status' },
  '/analysis': { title: 'Submit a Report', subtitle: 'Upload an image and select its location' },
  '/map': { title: 'Hotspot Map', subtitle: 'Report clusters from submitted locations' },
  '/analytics': { title: 'Analytics', subtitle: 'Statistics calculated from report records' },
  '/history': { title: 'My Reports', subtitle: 'Your submitted waste reports' },
  '/admin/reports': { title: 'All Reports', subtitle: 'Review and manage submitted reports' },
  '/about': { title: 'About EcoWatch AI', subtitle: 'System capabilities and AI status' },
};

const AppShell: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const pageInfo = PAGE_TITLES[location.pathname] ?? {
    title: 'EcoWatch AI',
    subtitle: 'Smart City Waste Intelligence',
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface">
      {/* ── Desktop sidebar ──────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 flex-col h-full border-r border-gray-200">
        <Sidebar />
      </aside>

      {/* ── Mobile sidebar overlay ───────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="relative w-64 h-full shadow-2xl z-10">
            <Sidebar isMobile onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* ── Main content area ────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Header
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto overflow-x-hidden"
          aria-label="Main content"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppShell;

import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'City Overview', subtitle: 'Waste monitoring dashboard — demonstration data' },
  '/analysis': { title: 'Image Analysis', subtitle: 'AI-powered waste detection workspace — demo mode' },
  '/map': { title: 'Hotspot Map', subtitle: 'Geographic waste concentration — demonstration locations' },
  '/analytics': { title: 'Analytics', subtitle: 'Trend analysis and reporting — simulated dataset' },
  '/history': { title: 'Observation History', subtitle: 'Analyzed image records — demo observations' },
  '/about': { title: 'About & Integration', subtitle: 'System information and future integration guide' },
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

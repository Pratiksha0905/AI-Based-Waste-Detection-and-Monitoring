import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowUpRight, Boxes, Camera, Database, Gauge, Layers3, Leaf, Ruler } from 'lucide-react';

const links = [
  { label: 'Project overview', path: '/', icon: Layers3 },
  { label: 'TACO dataset', path: '/dataset', icon: Database },
  { label: 'YOLOv8n detection', path: '/detection', icon: Camera },
  { label: 'MiDaS depth', path: '/depth', icon: Gauge },
  { label: 'Calibration', path: '/calibration', icon: Ruler },
  { label: 'Volume estimate', path: '/volume', icon: Boxes },
];

const titles: Record<string, string> = {
  '/': 'Project overview', '/dataset': 'TACO dataset preprocessing', '/detection': 'YOLOv8n waste detection',
  '/depth': 'MiDaS depth estimation', '/calibration': 'Calibration & scale', '/volume': 'Preliminary volume estimation',
};

export default function AppShell() {
  const location = useLocation();
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <NavLink to="/" className="brand" aria-label="EcoWatch AI project overview">
          <span className="brand-mark"><Leaf size={19} strokeWidth={2.1} /></span>
          <span><strong>EcoWatch <i>AI</i></strong><small>WASTE MEASUREMENT LAB</small></span>
        </NavLink>
        <div className="nav-kicker">PROJECT WORKSPACE</div>
        <nav className="primary-nav" aria-label="Project modules">
          {links.map(({ label, path, icon: Icon }, index) => (
            <NavLink key={path} to={path} end={path === '/'} className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>
              <span className="nav-index">{String(index).padStart(2, '0')}</span><Icon size={17} strokeWidth={1.8} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-scope"><span className="scope-dot" />Prototype scope<br /><small>5 connected modules</small></div>
          <a href="https://tacodataset.org/" target="_blank" rel="noreferrer" className="external-link">TACO dataset <ArrowUpRight size={14} /></a>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><Leaf size={17} /></span><strong>EcoWatch <i>AI</i></strong></div>
          <div className="breadcrumb"><span>PROJECT /</span> {titles[location.pathname] ?? 'Project overview'}</div>
          <div className="topbar-right"><span className="status-dot" />LOCAL DEMO <span className="topbar-divider" /> SCOPE 01—05</div>
        </header>
        <nav className="mobile-nav" aria-label="Project modules">
          {links.map(({ label, path }) => <NavLink key={path} to={path} end={path === '/'}>{label}</NavLink>)}
        </nav>
        <main id="main-content"><Outlet /></main>
        <footer className="app-footer"><span>ECOWATCH AI · PROJECT PROTOTYPE</span><span>SIMULATED WORKFLOWS · NO MODEL INFERENCE</span></footer>
      </div>
    </div>
  );
}

import { ArrowRight, Check, CircleAlert, FlaskConical, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PageHeading({ eyebrow, title, summary, number }: { eyebrow: string; title: string; summary: string; number?: string }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{summary}</p></div>{number && <div className="module-number">MODULE <b>{number}</b> / 05</div>}</div>;
}

export function Panel({ title, kicker, action, children, className = '' }: { title: string; kicker?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-heading"><div>{kicker && <div className="eyebrow">{kicker}</div>}<h2>{title}</h2></div>{action}</div>{children}</section>;
}

export function DemoNotice({ children }: { children: React.ReactNode }) {
  return <div className="demo-notice"><FlaskConical size={16} /><p><strong>Illustrative demo</strong> {children}</p></div>;
}

export function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: LucideIcon }) {
  return <div className="metric"><span className="metric-icon"><Icon size={17} /></span><span className="metric-label">{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

export function StepLink({ to, label, title, detail, number }: { to: string; label: string; title: string; detail: string; number: string }) {
  return <Link className="step-link" to={to}><span className="step-number">{number}</span><span className="step-copy"><small>{label}</small><strong>{title}</strong><span>{detail}</span></span><ArrowRight size={17} /></Link>;
}

export function StateMessage({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  const Icon = error ? CircleAlert : Check;
  return <div className={`state-message ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}><Icon size={16} />{children}</div>;
}

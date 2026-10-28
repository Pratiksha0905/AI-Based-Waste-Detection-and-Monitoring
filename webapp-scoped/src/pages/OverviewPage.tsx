import { ArrowDown, ArrowRight, Boxes, Camera, Database, Gauge, Ruler, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DemoNotice, PageHeading, StepLink } from '../components/ModuleUI';

const modules = [
  { to: '/dataset', label: '01 / DATA PREPARATION', title: 'TACO dataset', detail: 'Inspect categories, annotation conversion and split checks.', number: '01' },
  { to: '/detection', label: '02 / OBJECT DETECTION', title: 'YOLOv8n detection', detail: 'Upload an image and inspect a clearly simulated detection pass.', number: '02' },
  { to: '/depth', label: '03 / RELATIVE GEOMETRY', title: 'MiDaS depth', detail: 'Explore relative depth concepts, not metric distance.', number: '03' },
  { to: '/calibration', label: '04 / SCALE REFERENCE', title: 'Calibration', detail: 'Set a reference dimension and review what calibration assumes.', number: '04' },
  { to: '/volume', label: '05 / MEASUREMENT LIMITS', title: 'Volume estimation', detail: 'Review required inputs and why metric volume is unavailable.', number: '05' },
];

export default function OverviewPage() {
  return <div className="page-wrap">
    <PageHeading eyebrow="ECO-WASTE · TECHNICAL SCOPE" title="From image to measured insight." summary="A five-module prototype for preparing waste imagery and exploring the path from detection to preliminary volume estimation." />
    <section className="overview-hero">
      <div className="hero-copy"><div className="hero-label"><Sparkles size={14} /> CURRENT PROJECT SCOPE</div><h2>One image.<br /><em>Five stages</em> of analysis.</h2><p>Follow the technical workflow from TACO annotation preparation through detection, relative depth, camera scale and the limits of physical volume.</p><Link className="button button-light" to="/dataset">Begin with dataset <ArrowRight size={16} /></Link></div>
      <div className="hero-graphic" aria-label="Diagram connecting image, detection, depth, calibration, and volume"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="graphic-core"><span><Camera size={27} /></span><small>IMAGE</small></div><div className="graphic-node node-dataset"><Database size={16} /><small>DATA</small></div><div className="graphic-node node-detection"><span className="mini-box" /><small>OBJECTS</small></div><div className="graphic-node node-depth"><Gauge size={17} /><small>DEPTH</small></div><div className="graphic-node node-calibration"><Ruler size={16} /><small>SCALE</small></div><div className="graphic-node node-volume"><Boxes size={16} /><small>VOLUME</small></div><div className="graphic-caption">ILLUSTRATIVE PIPELINE · NO INFERENCE</div></div>
    </section>
    <DemoNotice>Upload interactions and outputs on this site are simulations. YOLOv8n and MiDaS are not connected; no physical measurement is claimed.</DemoNotice>
    <div className="overview-lower"><section className="module-list"><div className="section-title-row"><div><div className="eyebrow">THE WORKFLOW</div><h2>Five connected modules</h2></div><span className="count-pill">01—05 <ArrowDown size={13} /></span></div><div className="steps">{modules.map((item) => <StepLink key={item.number} {...item} />)}</div></section><aside className="overview-aside"><div className="eyebrow">PROTOTYPE STATUS</div><h3>Interface complete.<br />Models not connected.</h3><p>Every output is identified as illustrative. A validated model, camera setup and measurement pipeline remain future work.</p><div className="status-list"><span><i className="status-dot" /> Dataset workflow</span><b>DEMO</b><span><i className="status-dot" /> Detection + depth</span><b>SIMULATED</b><span><i className="status-dot unavailable" /> Metric volume</span><b>UNAVAILABLE</b></div><Link to="/volume" className="text-link">See measurement requirements <ArrowRight size={14} /></Link></aside></div>
    <div className="scope-strip"><strong>IN SCOPE</strong><span>TACO preprocessing</span><span>YOLOv8n workflow</span><span>MiDaS depth</span><span>Calibration</span><span>Preliminary volume</span><span className="scope-excluded">NO MAPS · NO HISTORY · NO CITY ANALYTICS</span></div>
  </div>;
}

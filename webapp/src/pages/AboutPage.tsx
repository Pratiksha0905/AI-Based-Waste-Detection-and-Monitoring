import React from 'react';
import { Leaf, GitBranch, Code2, Zap, BookOpen } from 'lucide-react';

const AboutPage: React.FC = () => (
  <div className="p-5 max-w-3xl mx-auto space-y-5">
    {/* Hero */}
    <div className="card">
      <div className="card-body flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <Leaf size={22} className="text-emerald-700" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">EcoWatch AI</h2>
          <p className="text-sm text-gray-500 mt-0.5">Smart City Waste Intelligence — Frontend Prototype</p>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            This website is a production-ready frontend prototype for the AI-Based Smart City Waste
            Detection, Depth and Volume Estimation, and Waste Hotspot Monitoring System.
            The real AI pipeline is under development. All data is simulated.
          </p>
        </div>
      </div>
    </div>

    {/* Tech stack */}
    <div className="card">
      <div className="card-header flex items-center gap-2">
        <Code2 size={14} className="text-gray-400" />
        <span className="section-title">Technology Stack</span>
      </div>
      <div className="card-body">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-gray-500">Framework</dt>
          <dd className="text-gray-800 font-medium">React 19 + TypeScript</dd>
          <dt className="text-gray-500">Build tool</dt>
          <dd className="text-gray-800 font-medium">Vite</dd>
          <dt className="text-gray-500">Styling</dt>
          <dd className="text-gray-800 font-medium">Tailwind CSS v4</dd>
          <dt className="text-gray-500">Routing</dt>
          <dd className="text-gray-800 font-medium">React Router v7</dd>
          <dt className="text-gray-500">Charts</dt>
          <dd className="text-gray-800 font-medium">Recharts</dd>
          <dt className="text-gray-500">Map</dt>
          <dd className="text-gray-800 font-medium">Leaflet + React-Leaflet</dd>
          <dt className="text-gray-500">Icons</dt>
          <dd className="text-gray-800 font-medium">Lucide React</dd>
          <dt className="text-gray-500">Data</dt>
          <dd className="text-gray-800 font-medium">Local mock service</dd>
        </dl>
      </div>
    </div>

    {/* AI system */}
    <div className="card">
      <div className="card-header flex items-center gap-2">
        <Zap size={14} className="text-gray-400" />
        <span className="section-title">Underlying AI System (Under Development)</span>
      </div>
      <div className="card-body">
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" aria-hidden="true" />
            <span><strong>YOLOv8n</strong> — Waste object detection and classification</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" aria-hidden="true" />
            <span><strong>MiDaS</strong> — Monocular depth estimation</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" aria-hidden="true" />
            <span><strong>Camera calibration</strong> — Scale estimation for physical measurements</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 flex-shrink-0" aria-hidden="true" />
            <span><strong>Volume estimation</strong> — Geometric approximation from depth and detection</span>
          </li>
        </ul>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
          None of the above models are currently connected to this frontend.
          All displayed results are explicitly simulated demonstration data.
        </p>
      </div>
    </div>

    {/* Integration guide */}
    <div className="card">
      <div className="card-header flex items-center gap-2">
        <GitBranch size={14} className="text-gray-400" />
        <span className="section-title">Future AI Integration Contract</span>
      </div>
      <div className="card-body space-y-3">
        <p className="text-sm text-gray-600">
          The frontend is designed for a clean swap: replace the mock service functions
          in <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">src/services/analysisService.ts</code> with
          real API calls. The TypeScript types in <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">src/types/observation.ts</code> define
          the integration contract.
        </p>
        <div className="bg-gray-900 text-green-300 rounded-xl p-4 font-mono text-xs space-y-1 overflow-x-auto">
          <p className="text-gray-500">// Replace these mock implementations:</p>
          <p><span className="text-blue-300">analyzeImage</span>(file) <span className="text-gray-500">→</span> POST /api/analyze</p>
          <p><span className="text-blue-300">getObservations</span>(filters) <span className="text-gray-500">→</span> GET /api/observations</p>
          <p><span className="text-blue-300">getObservationById</span>(id) <span className="text-gray-500">→</span> GET /api/observations/:id</p>
          <p><span className="text-blue-300">getDashboardSummary</span>() <span className="text-gray-500">→</span> GET /api/dashboard/summary</p>
          <p><span className="text-blue-300">getHotspots</span>(filters) <span className="text-gray-500">→</span> GET /api/hotspots</p>
          <p><span className="text-blue-300">getAnalytics</span>(filters) <span className="text-gray-500">→</span> GET /api/analytics</p>
        </div>
        <p className="text-xs text-gray-500">
          The real model pipeline should return <code className="font-mono bg-gray-100 px-1 rounded">Detection[]</code>,
          {' '}<code className="font-mono bg-gray-100 px-1 rounded">DepthResult</code>,
          {' '}<code className="font-mono bg-gray-100 px-1 rounded">CalibrationInfo</code>, and
          {' '}<code className="font-mono bg-gray-100 px-1 rounded">VolumeEstimate</code> exactly
          as defined in the type file — no UI refactoring required.
        </p>
      </div>
    </div>

    {/* Setup */}
    <div className="card">
      <div className="card-header flex items-center gap-2">
        <BookOpen size={14} className="text-gray-400" />
        <span className="section-title">Setup Instructions</span>
      </div>
      <div className="card-body">
        <div className="bg-gray-900 text-green-300 rounded-xl p-4 font-mono text-xs space-y-1">
          <p className="text-gray-500"># From the webapp/ directory:</p>
          <p>npm install</p>
          <p>npm run dev</p>
          <p className="text-gray-500 mt-2"># Type check:</p>
          <p>npx tsc --noEmit</p>
          <p className="text-gray-500"># Production build:</p>
          <p>npm run build</p>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          No GPU, model weights, Python environment, or external API is required.
          The frontend runs entirely in the browser.
        </p>
      </div>
    </div>
  </div>
);

export default AboutPage;

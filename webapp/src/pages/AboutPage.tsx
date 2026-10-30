import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Leaf } from 'lucide-react';
import { healthApi, type ModelStatus } from '../api/endpoints';

export default function AboutPage() {
  const [model, setModel] = useState<ModelStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    healthApi.model()
      .then((status) => {
        if (active) setModel(status);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to retrieve model status.');
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-5">
      <section className="card">
        <div className="card-body flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
            <Leaf size={22} className="text-emerald-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">EcoWatch AI</h2>
            <p className="mt-1 text-sm text-gray-600">
              A waste reporting and monitoring application. Reports, locations, review states, and analytics are supplied by the backend API.
            </p>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header"><h2 className="section-title">AI checkpoint status</h2></div>
        <div className="card-body">
          {error ? (
            <p className="flex items-start gap-2 text-sm text-red-800" role="alert"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</p>
          ) : model ? (
            <div className="space-y-2 text-sm">
              <p className={`flex items-center gap-2 font-medium ${model.available ? 'text-emerald-800' : 'text-amber-800'}`}>
                <CheckCircle2 size={16} />{model.available ? 'Model checkpoint available' : 'AI analysis unavailable'}
              </p>
              {model.error && <p className="text-gray-600">{model.error}</p>}
              {model.model_path && <p className="break-all text-xs text-gray-500">Configured model: {model.model_path}</p>}
              <p className="text-xs text-gray-500">
                Reports can be submitted without a configured model. Their processing status and any real detections returned by the backend are shown on each report.
              </p>
            </div>
          ) : <p className="text-sm text-gray-500">Loading model status…</p>}
        </div>
      </section>

      <section className="card">
        <div className="card-header"><h2 className="section-title">Connected backend capabilities</h2></div>
        <div className="card-body">
          <ul className="space-y-2 text-sm text-gray-700">
            <li><strong>Authentication:</strong> account registration, login, and role-aware user profile.</li>
            <li><strong>Reports:</strong> image and coordinate submission, own/all report lists, details, image retrieval, retry, and admin review status.</li>
            <li><strong>Hotspots:</strong> report clustering and severity from submitted report locations.</li>
            <li><strong>Admin analytics:</strong> report counts, status distributions, daily submission trends, and AI metrics when available.</li>
          </ul>
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Relative depth, camera calibration, and volume estimation are not exposed by the current report API. They are not displayed as if they were real measurements.
          </p>
        </div>
      </section>
    </div>
  );
}

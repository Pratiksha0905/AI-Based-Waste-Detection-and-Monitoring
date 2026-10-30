import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ImagePlus, MapPin, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { reportsApi, type ReportOut } from '../api/endpoints';
import LocationPicker, { type SelectedLocation } from '../components/LocationPicker';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function ImageAnalysisPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const [description, setDescription] = useState('');
  const [report, setReport] = useState<ReportOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function chooseFile(file?: File) {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setImage(null);
      setPreviewUrl(null);
      setReport(null);
      setError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setImage(null);
      setPreviewUrl(null);
      setReport(null);
      setError('Image must be 20 MB or smaller.');
      return;
    }
    setImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setReport(null);
    setError(null);
  }

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!image) {
      setError('Select an image before submitting.');
      return;
    }
    if (!location) {
      setError('Choose the waste location on the map.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const created = await reportsApi.submit(
        image,
        location.latitude,
        location.longitude,
        description.trim() || undefined,
      );
      setReport(created);
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Report submission failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-5">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Submitted reports are stored by the backend. AI analysis runs only when a model checkpoint is configured;
        submitting a report does not mean analysis has completed.
      </div>

      {report && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4" role="status">
          <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={18} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-900">Report submitted</p>
            <p className="mt-1 text-xs text-emerald-800">
              Current processing status: <strong>{report.processing_status}</strong>. You can follow updates on the report page.
            </p>
            <Link className="mt-2 inline-flex text-sm font-medium text-emerald-800 underline" to={`/reports/${report.id}`}>
              View report details
            </Link>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form className="space-y-5" onSubmit={submitReport}>
        <section className="card">
          <div className="card-header flex items-center gap-2">
            <ImagePlus size={16} className="text-emerald-700" />
            <h2 className="section-title">Waste image</h2>
          </div>
          <div className="card-body">
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                chooseFile(event.target.files?.[0]);
                event.target.value = '';
              }}
              aria-label="Select a waste image"
            />
            {previewUrl ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <img src={previewUrl} alt="Selected waste report" className="max-h-64 w-full rounded-lg bg-gray-50 object-contain sm:max-w-sm" />
                <div className="min-w-0">
                  <p className="break-all text-sm font-medium text-gray-800">{image?.name}</p>
                  <p className="mt-1 text-xs text-gray-500">{((image?.size ?? 0) / 1024 / 1024).toFixed(2)} MB</p>
                  <button type="button" className="btn-secondary mt-4" onClick={() => fileInput.current?.click()}>
                    Choose a different image
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="upload-zone w-full"
                onClick={() => fileInput.current?.click()}
              >
                <span className="flex flex-col items-center gap-2 text-sm text-gray-700">
                  <Upload size={24} className="text-emerald-700" />
                  <span className="font-medium">Choose a JPEG, PNG, or WebP image</span>
                  <span className="text-xs text-gray-500">Maximum file size: 20 MB</span>
                </span>
              </button>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header flex items-center gap-2">
            <MapPin size={16} className="text-emerald-700" />
            <h2 className="section-title">Waste location</h2>
          </div>
          <div className="card-body space-y-4">
            <LocationPicker
              value={location}
              onChange={(selectedLocation) => {
                setLocation(selectedLocation);
                setReport(null);
                setError(null);
              }}
            />
          </div>
        </section>

        <section className="card">
          <div className="card-header"><h2 className="section-title">Additional details</h2></div>
          <div className="card-body">
            <label htmlFor="description" className="mb-1 block text-xs font-medium text-gray-700">
              Description <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <textarea
              id="description"
              className="input min-h-24 resize-y"
              maxLength={1000}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setReport(null);
              }}
              placeholder="Add helpful context about the waste or its surroundings."
            />
            <p className="mt-1 text-right text-xs text-gray-500">{description.length}/1000</p>
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={() => {
            setImage(null);
            setPreviewUrl(null);
            setLocation(null);
            setDescription('');
            setReport(null);
            setError(null);
          }}>
            Clear form
          </button>
          <button type="submit" className="btn-primary justify-center" disabled={loading}>
            {loading ? 'Submitting…' : 'Submit report'}
          </button>
        </div>
      </form>
    </div>
  );
}

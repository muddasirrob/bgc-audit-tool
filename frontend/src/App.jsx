import React, { useState } from 'react';
import Header from './components/Header';
import InputPanel from './components/InputPanel';
import ReportView from './components/ReportView';

export default function App() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleProcess(formData) {
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const res = await fetch('/api/process', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Processing failed');
      setReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <main className="app-main">
        <InputPanel onProcess={handleProcess} loading={loading} />
        {loading && (
          <div className="loading-overlay">
            <div className="loading-card">
              <div className="loading-spinner-lg" />
              <div className="loading-title">Analyzing Your Listing</div>
              <div className="loading-desc">Processing files & generating AI-optimized content...</div>
              <div className="loading-bar"><div className="loading-bar-fill" /></div>
            </div>
          </div>
        )}
        {error && (
          <div className="error-banner">
            <span>⚠️</span> {error}
          </div>
        )}
        {report && <ReportView report={report} />}
      </main>
    </>
  );
}

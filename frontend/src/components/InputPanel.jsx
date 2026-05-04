import React, { useState, useRef } from 'react';

const FILE_CONFIGS = [
  { key: 'jungleScoutAll', label: 'Jungle Scout All-Products', icon: '📊', hint: 'CSV or XLSX', required: true },
  { key: 'jungleScoutAsin', label: 'Jungle Scout ASIN-Specific', icon: '🎯', hint: 'CSV or XLSX', required: true },
  { key: 'cerebroExport', label: 'Helium 10 Cerebro Export', icon: '🧠', hint: 'CSV or XLSX', required: true },
  { key: 'titleBullets', label: 'Title & Bullets Sheet', icon: '📝', hint: 'CSV or XLSX', required: true },
];

export default function InputPanel({ onProcess, loading }) {
  const [brandName, setBrandName] = useState('');
  const [auditAsin, setAuditAsin] = useState('');
  const [files, setFiles] = useState({});
  const [dragOver, setDragOver] = useState(null);

  function handleFile(key, file) {
    if (file) setFiles((prev) => ({ ...prev, [key]: file }));
  }

  function handleDrop(key, e) {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(key, file);
  }

  function handleSubmit() {
    const fd = new FormData();
    fd.append('brandName', brandName);
    fd.append('auditAsin', auditAsin);
    Object.entries(files).forEach(([k, f]) => fd.append(k, f));
    onProcess(fd);
  }

  const fileCount = Object.keys(files).length;
  const canSubmit = brandName.trim() && auditAsin.trim() && fileCount === 4 && !loading;

  return (
    <section className="input-section">
      <div className="card">
        <div className="card-header">
          <div className="card-icon purple">🔧</div>
          <div>
            <div className="card-title">Audit Configuration</div>
            <div className="card-desc">Enter product details and upload your data files</div>
          </div>
        </div>
        <div className="card-body">
          <div className="input-grid">
            <div className="form-group">
              <label htmlFor="brand-name">Brand Name</label>
              <input
                id="brand-name"
                className="form-input"
                placeholder="e.g. Acme Products"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="audit-asin">Audit ASIN</label>
              <input
                id="audit-asin"
                className="form-input"
                placeholder="e.g. B09XYZ1234"
                value={auditAsin}
                onChange={(e) => setAuditAsin(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="upload-grid">
            {FILE_CONFIGS.map((cfg) => (
              <div
                key={cfg.key}
                className={`upload-zone${files[cfg.key] ? ' has-file' : ''}${dragOver === cfg.key ? ' drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(cfg.key); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => handleDrop(cfg.key, e)}
              >
                <input
                  type="file"
                  accept=".csv,.tsv,.xlsx,.xls"
                  onChange={(e) => handleFile(cfg.key, e.target.files[0])}
                />
                {cfg.required && <span className="upload-required">Required</span>}
                <span className="upload-icon">{files[cfg.key] ? '✅' : cfg.icon}</span>
                <div className="upload-label">{cfg.label}</div>
                <div className="upload-hint">{cfg.hint}</div>
                {files[cfg.key] && (
                  <div className="upload-file-name">{files[cfg.key].name}</div>
                )}
              </div>
            ))}
          </div>

          <div className="process-bar">
            <div className="process-status">
              {fileCount > 0 && <span>{fileCount}/4 files uploaded</span>}
            </div>
            <div className="tooltip-wrapper" title={!canSubmit ? 'Please fill in Brand Name, Audit ASIN, and upload the required Cerebro Export file.' : ''}>
              <button
                id="process-btn"
                className={`btn-process${loading ? ' loading' : ''}`}
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {loading ? <><span className="spinner" /> Analyzing...</> : '🚀 Process Audit'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

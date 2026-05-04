import React, { useState } from 'react';

export default function OptimizedListing({ aiResult, aiError, currentListing }) {
  const [copied, setCopied] = useState(null);

  function copyToClipboard(text, id) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  if (aiError) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-icon rose">⚠️</div>
          <div>
            <div className="card-title">AI Generation Error</div>
            <div className="card-desc">The AI could not generate an optimized listing</div>
          </div>
        </div>
        <div className="card-body">
          <div className="error-banner">
            <span>⚠️</span> {aiError}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Make sure your <code style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>OPENAI_API_KEY</code> is set correctly in the backend <code style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>.env</code> file.
          </p>
        </div>
      </div>
    );
  }

  if (!aiResult) {
    return (
      <div className="card">
        <div className="empty-state">
          <span className="empty-icon">✨</span>
          <div className="empty-title">No AI Draft Available</div>
          <div className="empty-desc">
            Configure your OpenAI API key in the backend .env file (or ensure your n8n reroute is working) to enable AI-powered listing optimization.
          </div>
        </div>
      </div>
    );
  }

  const allBulletsText = aiResult.bullets?.map((b, i) => `• ${b.text}`).join('\n') || '';
  const fullListing = `${aiResult.optimizedTitle}\n\n${allBulletsText}`;

  return (
    <div className="optimized-section">
      {/* Title comparison */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-icon emerald">✨</div>
          <div style={{ flex: 1 }}>
            <div className="card-title">AI-Optimized Listing Draft</div>
            <div className="card-desc">SEO-optimized using top keyword opportunities</div>
          </div>
          <button className="btn-copy" onClick={() => copyToClipboard(fullListing, 'all')}>
            {copied === 'all' ? '✓ Copied!' : '📋 Copy All'}
          </button>
        </div>
        <div className="card-body">
          {/* Title */}
          <div className="optimized-vs">
            {currentListing?.title && (
              <div className="vs-card original">
                <div className="vs-tag old">Original Title</div>
                <div className="listing-title-text" style={{ fontSize: 14 }}>{currentListing.title}</div>
              </div>
            )}
            <div className={`vs-card optimized${!currentListing?.title ? '' : ''}`} style={!currentListing?.title ? { gridColumn: '1 / -1' } : {}}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="vs-tag new">Optimized Title</div>
                <button className="btn-copy" onClick={() => copyToClipboard(aiResult.optimizedTitle, 'title')} style={{ fontSize: 11, padding: '4px 10px' }}>
                  {copied === 'title' ? '✓' : '📋'}
                </button>
              </div>
              <div className="listing-title-text" style={{ fontSize: 14 }}>{aiResult.optimizedTitle}</div>
            </div>
          </div>

          {/* Bullets */}
          <div className="listing-block">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="listing-label" style={{ marginBottom: 0 }}>Optimized Bullet Points</div>
              <button className="btn-copy" onClick={() => copyToClipboard(allBulletsText, 'bullets')} style={{ fontSize: 11, padding: '4px 10px' }}>
                {copied === 'bullets' ? '✓ Copied!' : '📋 Copy Bullets'}
              </button>
            </div>
            <ul className="bullet-list">
              {aiResult.bullets?.map((b, i) => (
                <li key={i} className="bullet-item">
                  <span className="bullet-num">{i + 1}</span>
                  <span className="bullet-text">{b.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Strategy & Backend Keywords */}
      {(aiResult.keywordStrategy || aiResult.backendKeywords?.length > 0) && (
        <div className="card">
          <div className="card-body">
            {aiResult.keywordStrategy && (
              <div className="strategy-block">
                <div className="strategy-title">📊 Keyword Strategy Notes</div>
                <div className="strategy-text">{aiResult.keywordStrategy}</div>
              </div>
            )}

            {aiResult.changesSummary && (
              <div className="strategy-block" style={{ marginTop: 16 }}>
                <div className="strategy-title">📝 Changes Summary</div>
                <div className="strategy-text">{aiResult.changesSummary}</div>
              </div>
            )}

            {aiResult.backendKeywords?.length > 0 && (
              <div className="strategy-block" style={{ marginTop: 16 }}>
                <div className="strategy-title">🔒 Suggested Backend / Hidden Keywords</div>
                <div className="backend-keywords">
                  {aiResult.backendKeywords.map((kw, i) => (
                    <span key={i} className="backend-kw-tag">{kw}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

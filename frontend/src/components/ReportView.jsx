import React, { useState } from 'react';
import KeywordOpportunities from './KeywordOpportunities';
import CurrentListing from './CurrentListing';
import OptimizedListing from './OptimizedListing';

const TABS = [
  { id: 'keywords', label: 'Keyword Opportunities', icon: '🔑' },
  { id: 'current', label: 'Current Listing', icon: '📋' },
  { id: 'optimized', label: 'AI-Optimized Draft', icon: '✨' },
];

export default function ReportView({ report }) {
  const [activeTab, setActiveTab] = useState('keywords');

  const highOpp = report.keywordOpportunities?.filter((k) => k.opportunity === 'HIGH').length || 0;
  const medOpp = report.keywordOpportunities?.filter((k) => k.opportunity === 'MEDIUM').length || 0;
  const avgVolume = report.keywordOpportunities?.length
    ? Math.round(report.keywordOpportunities.reduce((s, k) => s + k.searchVolume, 0) / report.keywordOpportunities.length)
    : 0;

  return (
    <section className="report-section">
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{report.totalKeywords}</div>
          <div className="stat-label">Total Keywords</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{highOpp}</div>
          <div className="stat-label">High Opportunity</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{medOpp}</div>
          <div className="stat-label">Medium Opportunity</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{avgVolume.toLocaleString()}</div>
          <div className="stat-label">Avg Search Volume</div>
        </div>
      </div>

      <div className="report-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
            {tab.id === 'keywords' && (
              <span className="tab-badge">{report.keywordOpportunities?.length || 0}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'keywords' && (
        <KeywordOpportunities keywords={report.keywordOpportunities || []} />
      )}
      {activeTab === 'current' && (
        <CurrentListing listing={report.currentListing} asin={report.auditAsin} />
      )}
      {activeTab === 'optimized' && (
        <OptimizedListing
          aiResult={report.aiOptimizedListing}
          aiError={report.aiError}
          currentListing={report.currentListing}
        />
      )}
    </section>
  );
}

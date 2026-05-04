import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

const PAGE_SIZE = 25;

export default function KeywordOpportunities({ keywords }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [sortCol, setSortCol] = useState('searchVolume');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let list = keywords;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((k) => k.keyword.toLowerCase().includes(q));
    }
    if (filter !== 'ALL') {
      list = list.filter((k) => k.opportunity === filter);
    }
    list = [...list].sort((a, b) => {
      const av = a[sortCol] ?? -Infinity;
      const bv = b[sortCol] ?? -Infinity;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return list;
  }, [keywords, search, filter, sortCol, sortDir]);

  // Data for the chart: Top 15 keywords with the highest search volume
  const chartData = useMemo(() => {
    return [...keywords]
      .sort((a, b) => b.searchVolume - a.searchVolume)
      .slice(0, 15)
      .map(k => ({
        name: k.keyword.length > 20 ? k.keyword.substring(0, 20) + '...' : k.keyword,
        fullKeyword: k.keyword,
        volume: k.searchVolume,
        rankGap: k.rankGap > 0 ? k.rankGap : 0 // only show positive gaps (opportunities)
      }));
  }, [keywords]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(col) {
    if (sortCol === col) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortCol(col); setSortDir('desc'); }
    setPage(0);
  }

  function sortIcon(col) {
    if (sortCol !== col) return '';
    return sortDir === 'desc' ? ' ▾' : ' ▴';
  }

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'rgba(17, 24, 39, 0.95)', border: '1px solid rgba(99, 102, 241, 0.4)', padding: '12px', borderRadius: '8px', color: '#fff', fontSize: '12px' }}>
          <p style={{ fontWeight: 600, marginBottom: '8px', color: '#a5b4fc' }}>{payload[0].payload.fullKeyword}</p>
          <p style={{ color: '#06b6d4' }}>Search Volume: <strong style={{color: 'white'}}>{payload[0].value.toLocaleString()}</strong></p>
          {payload[1] && <p style={{ color: '#f43f5e', marginTop: '4px' }}>Rank Gap: <strong style={{color: 'white'}}>+{payload[1].value}</strong></p>}
        </div>
      );
    }
    return null;
  };

  if (!keywords.length) {
    return (
      <div className="card">
        <div className="no-data">No keyword data available. Upload a Cerebro export to see opportunities.</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '0 0 24px 0' }}>
      
      {/* Chart Section */}
      <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <span style={{ fontSize: '18px' }}>📊</span>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Top Search Volume & Rank Gaps</h3>
        </div>
        <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} angle={-45} textAnchor="end" height={60} tickMargin={5} />
              <YAxis yAxisId="left" stroke="var(--accent-cyan)" fontSize={11} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
              <YAxis yAxisId="right" orientation="right" stroke="var(--accent-rose)" fontSize={11} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', color: 'var(--text-secondary)' }} />
              <Bar yAxisId="left" dataKey="volume" name="Search Volume" fill="url(#colorVolume)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Line yAxisId="right" type="monotone" dataKey="rankGap" name="Rank Gap (Opportunity)" stroke="var(--accent-rose)" strokeWidth={3} dot={{ r: 4, fill: 'var(--bg-card)', strokeWidth: 2 }} activeDot={{ r: 6 }} />
              <defs>
                <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0.2}/>
                </linearGradient>
              </defs>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card-body" style={{ paddingTop: '24px' }}>
        <div className="keyword-controls">
          <div className="search-wrapper">
            <input
              className="search-input"
              placeholder="Search keywords..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
          {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((f) => (
            <button
              key={f}
              className={`filter-btn${filter === f ? ' active' : ''}`}
              onClick={() => { setFilter(f); setPage(0); }}
            >
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('keyword')}>Keyword{sortIcon('keyword')}</th>
                <th onClick={() => toggleSort('searchVolume')}>Search Vol{sortIcon('searchVolume')}</th>
                <th onClick={() => toggleSort('organicRank')}>Organic Rank{sortIcon('organicRank')}</th>
                <th onClick={() => toggleSort('competitorRank')}>Comp. Rank{sortIcon('competitorRank')}</th>
                <th onClick={() => toggleSort('rankGap')}>Rank Gap{sortIcon('rankGap')}</th>
                <th onClick={() => toggleSort('rankingCompetitors')}>Comp. Count{sortIcon('rankingCompetitors')}</th>
                <th>Opportunity</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((k, i) => (
                <tr key={i}>
                  <td>{k.keyword}</td>
                  <td>{k.searchVolume?.toLocaleString() ?? '—'}</td>
                  <td>{k.organicRank ?? '—'}</td>
                  <td>{k.competitorRank ?? '—'}</td>
                  <td style={{ color: k.rankGap > 0 ? 'var(--accent-rose)' : k.rankGap < 0 ? 'var(--accent-emerald)' : undefined }}>
                    {k.rankGap != null ? (k.rankGap > 0 ? `+${k.rankGap}` : k.rankGap) : '—'}
                  </td>
                  <td>{k.rankingCompetitors ?? '—'}</td>
                  <td>
                    <span className={`opp-badge ${k.opportunity.toLowerCase()}`}>{k.opportunity}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button className="page-btn" disabled={page === 0} onClick={() => setPage(page - 1)}>← Prev</button>
            <span className="page-info">Page {page + 1} of {totalPages} ({filtered.length} results)</span>
            <button className="page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

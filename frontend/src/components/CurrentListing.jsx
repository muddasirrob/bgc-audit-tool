import React from 'react';

export default function CurrentListing({ listing, asin }) {
  if (!listing || (!listing.title && listing.bullets?.length === 0)) {
    return (
      <div className="card">
        <div className="empty-state">
          <span className="empty-icon">📋</span>
          <div className="empty-title">No Listing Data</div>
          <div className="empty-desc">
            Upload a Title & Bullets sheet to see the current listing content for this ASIN.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon cyan">📋</div>
        <div>
          <div className="card-title">Current Listing — {asin}</div>
          <div className="card-desc">Extracted from your uploaded sheet</div>
        </div>
      </div>
      <div className="card-body">
        <div className="listing-block">
          <div className="listing-label">Product Title</div>
          <div className="listing-title-text">{listing.title || 'No title found'}</div>
        </div>

        {listing.bullets?.length > 0 && (
          <div className="listing-block">
            <div className="listing-label">Bullet Points</div>
            <ul className="bullet-list">
              {listing.bullets.map((b, i) => (
                <li key={i} className="bullet-item">
                  <span className="bullet-num">{i + 1}</span>
                  <span className="bullet-text">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

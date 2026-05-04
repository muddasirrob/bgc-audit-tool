import { readFileSync } from 'fs';

const BASE = 'http://localhost:3001';
const TASKS = 'C:/Users/ST/Downloads/tasks';

async function testAPI() {
  const formData = new FormData();
  formData.append('brandName', 'OakTen');
  formData.append('auditAsin', 'B0DD2XC38R');

  const files = {
    jungleScoutAll: `${TASKS}/OakTen All product.csv`,
    jungleScoutAsin: `${TASKS}/B0DD2XC38R Jungle scout data.csv`,
    cerebroExport: `${TASKS}/US_AMAZON_cerebro_B0DD2XC38R_2026-03-27.csv`,
    titleBullets: `${TASKS}/Title & Bullets (All 4 ASINs).xlsx`,
  };

  for (const [field, filePath] of Object.entries(files)) {
    const buf = readFileSync(filePath);
    const fileName = filePath.split('/').pop();
    formData.append(field, new Blob([buf]), fileName);
  }

  console.log('Sending request to', BASE + '/api/process');
  console.log('Using files from:', TASKS);
  const res = await fetch(BASE + '/api/process', { method: 'POST', body: formData });
  const data = await res.json();

  console.log('\n=== API RESPONSE ===');
  console.log('Status:', res.status);
  console.log('Success:', data.success);
  console.log('Brand:', data.brandName, '| ASIN:', data.auditAsin);
  console.log('Total Keywords:', data.totalKeywords);
  console.log('\nTop 5 Keyword Opportunities:');
  (data.keywordOpportunities || []).slice(0, 5).forEach((k, i) => {
    console.log(`  ${i + 1}. "${k.keyword}" — SV: ${k.searchVolume}, Rank: ${k.organicRank ?? '—'}, CompRank: ${k.competitorRank ?? '—'}, Gap: ${k.rankGap ?? '—'}, Opp: ${k.opportunity}`);
  });

  console.log('\nCurrent Listing:');
  console.log('  Title:', data.currentListing?.title || '(none)');
  console.log('  Bullets:', data.currentListing?.bullets?.length || 0);
  (data.currentListing?.bullets || []).forEach((b, i) => {
    console.log(`    ${i + 1}. ${b.substring(0, 100)}...`);
  });

  console.log('\nJungle Scout: Top Products:', data.jungleScoutContext?.topProducts?.length || 0, '| ASIN Data:', data.jungleScoutContext?.asinData ? 'Present' : 'Missing');

  console.log('\n=== AI OPTIMIZED LISTING ===');
  if (data.aiError) {
    console.log('  ❌ AI Error:', data.aiError);
  }
  if (data.aiOptimizedListing) {
    console.log('  ✅ Title:', data.aiOptimizedListing.optimizedTitle);
    console.log('  Bullets:');
    (data.aiOptimizedListing.bullets || []).forEach((b, i) => {
      console.log(`    ${i + 1}. [${b.header}] ${b.text}`);
    });
    console.log('  Strategy:', data.aiOptimizedListing.keywordStrategy);
    console.log('  Backend Keywords:', (data.aiOptimizedListing.backendKeywords || []).join(', '));
    console.log('  Changes:', data.aiOptimizedListing.changesSummary);
  } else {
    console.log('  (No AI result)');
  }
}

testAPI().catch(console.error);

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { OpenAI } from 'openai';
import { readFileSync } from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Multer setup — store in memory
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// OpenAI client using official API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-dummy'
});

// ────────────────────────────────────────────
// Utility: parse CSV or XLSX buffer → array of objects
// ────────────────────────────────────────────
function parseFileBuffer(buffer, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === '.csv' || ext === '.tsv') {
    const text = buffer.toString('utf-8');
    const result = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: true });
    return result.data;
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

// ────────────────────────────────────────────
// Utility: normalize column names (lowercase, trim, collapse spaces)
// ────────────────────────────────────────────
function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[normalizeKey(k)] = v;
  }
  return out;
}

// ────────────────────────────────────────────
// Extract Cerebro keyword opportunities
// ────────────────────────────────────────────
function extractCerebroKeywords(rows) {
  return rows
    .map((r) => {
      const n = normalizeRow(r);

      // Search volume — Cerebro uses "Search Volume" or "Srch Vol"
      const searchVolume =
        n['searchvolume'] ?? n['srchvol'] ?? n['searchvol'] ?? n['volume'] ?? 0;

      // Keyword
      const keyword =
        n['keywordphrase'] ?? n['keyword'] ?? n['searchterm'] ?? n['phrases'] ?? '';

      // Competitor ranking data
      const competitorRank =
        n['competitorrank'] ?? n['competitorrankavg'] ?? n['comprank'] ?? n['avgrank'] ?? null;
      // In Cerebro exports, Position (Rank) = 0 means "not ranking" — treat as null
      const rawOrganicRank =
        n['positionrank'] ?? n['position'] ?? n['positionorganic'] ?? n['organicrank'] ?? n['rank'] ?? null;
      const organicRank = (rawOrganicRank != null && rawOrganicRank > 0) ? rawOrganicRank : null;
      const rawSponsoredRank =
        n['sponsoredrankavg'] ?? n['positionsponsored'] ?? n['sponsoredrank'] ?? null;
      const sponsoredRank = (rawSponsoredRank != null && rawSponsoredRank > 0) ? rawSponsoredRank : null;
      const rankingCompetitors =
        n['rankingcompetitorscount'] ?? n['rankingcompetitors'] ?? n['competitorrankcount'] ?? n['numcompetitors'] ?? null;
      const cpr =
        n['cpr'] ?? n['cerebroproductrank'] ?? n['cpr8daygiveaways'] ?? null;
      const relevancy =
        n['relevancyscore'] ?? n['relevancy'] ?? null;

      // Rank gap = how far behind the audited ASIN is versus the best competitor
      let rankGap = null;
      if (competitorRank != null && organicRank != null) {
        rankGap = (organicRank || 306) - (competitorRank || 306);
      }

      return {
        keyword: String(keyword).trim(),
        searchVolume: Number(searchVolume) || 0,
        organicRank: organicRank != null ? Number(organicRank) : null,
        sponsoredRank: sponsoredRank != null ? Number(sponsoredRank) : null,
        competitorRank: competitorRank != null ? Number(competitorRank) : null,
        rankingCompetitors: rankingCompetitors != null ? Number(rankingCompetitors) : null,
        cpr: cpr != null ? Number(cpr) : null,
        relevancy: relevancy != null ? Number(relevancy) : null,
        rankGap,
      };
    })
    .filter((k) => k.keyword && k.searchVolume > 0)
    .sort((a, b) => b.searchVolume - a.searchVolume);
}

// ────────────────────────────────────────────
// Extract current listing title & bullets from sheet
// ────────────────────────────────────────────
function extractCurrentListing(rows, auditAsin) {
  // Try to find relevant columns
  if (!rows || rows.length === 0) return { title: '', bullets: [] };

  // If the sheet has an ASIN column, find the row matching the audit ASIN
  let targetRow = rows[0];
  if (auditAsin) {
    const match = rows.find((r) => {
      const n = normalizeRow(r);
      return String(n['asin'] ?? '').toUpperCase() === auditAsin.toUpperCase();
    });
    if (match) targetRow = match;
  }

  const first = normalizeRow(targetRow);

  const title =
    first['title'] ?? first['producttitle'] ?? first['listingtitle'] ?? first['itemname'] ?? '';

  const bullets = [];
  for (let i = 1; i <= 10; i++) {
    const val =
      first[`bulletpoint${i}`] ??
      first[`bullet${i}`] ??
      first[`bulletpoints${i}`] ??
      first[`keyfeature${i}`] ??
      first[`bp${i}`] ??
      null;
    if (val) bullets.push(String(val).trim());
  }

  // If no numbered bullets found, try generic columns
  if (bullets.length === 0) {
    const bulletKey = Object.keys(first).find(
      (k) => k.includes('bullet') || k.includes('keyfeature')
    );
    if (bulletKey && first[bulletKey]) {
      // Might be multiple lines separated by newlines or pipes
      const raw = String(first[bulletKey]);
      const parts = raw.split(/[\n|]/).filter(Boolean);
      bullets.push(...parts.map((p) => p.trim()).filter(Boolean));
    }
  }

  return { title: String(title).trim(), bullets };
}

// ────────────────────────────────────────────
// Extract Jungle Scout market context
// ────────────────────────────────────────────
function extractJungleScoutContext(allProductsRows, asinRows) {
  const topProducts = (allProductsRows || []).slice(0, 20).map((r) => {
    const n = normalizeRow(r);
    return {
      name: n['productname'] ?? n['name'] ?? n['title'] ?? '',
      brand: n['brand'] ?? '',
      asin: n['asin'] ?? '',
      price: n['price'] ?? '',
      revenue: n['revenue'] ?? n['estimatedrevenue'] ?? n['estrevenue'] ?? '',
      sales: n['sales'] ?? n['estimatedsales'] ?? n['estsales'] ?? '',
      reviews: n['reviews'] ?? n['numberofreviews'] ?? '',
      rating: n['rating'] ?? n['avgrating'] ?? '',
    };
  });

  let asinData = null;
  if (asinRows && asinRows.length > 0) {
    const n = normalizeRow(asinRows[0]);
    asinData = {
      name: n['productname'] ?? n['name'] ?? n['title'] ?? '',
      price: n['price'] ?? '',
      revenue: n['revenue'] ?? n['estimatedrevenue'] ?? '',
      sales: n['sales'] ?? n['estimatedsales'] ?? '',
      reviews: n['reviews'] ?? n['numberofreviews'] ?? '',
      rating: n['rating'] ?? n['avgrating'] ?? '',
      category: n['category'] ?? n['productcategory'] ?? '',
      seller: n['seller'] ?? n['sellername'] ?? '',
    };
  }

  return { topProducts, asinData };
}

// ────────────────────────────────────────────
// Build the AI prompt
// ────────────────────────────────────────────
function buildPrompt({ brandName, auditAsin, currentListing, topKeywords, jungleScoutContext }) {
  const keywordBlock = topKeywords
    .slice(0, 60)
    .map(
      (k, i) =>
        `${i + 1}. "${k.keyword}" — SV: ${k.searchVolume}${k.organicRank != null ? `, Current Rank: ${k.organicRank}` : ''}${k.competitorRank != null ? `, Competitor Avg Rank: ${k.competitorRank}` : ''}${k.rankGap != null ? `, Rank Gap: ${k.rankGap > 0 ? '+' : ''}${k.rankGap}` : ''}`
    )
    .join('\n');

  const currentBlock = currentListing.title
    ? `CURRENT TITLE:\n${currentListing.title}\n\nCURRENT BULLETS:\n${currentListing.bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}`
    : 'No current listing data provided.';

  const marketBlock = jungleScoutContext.topProducts.length
    ? `TOP COMPETING PRODUCTS:\n${jungleScoutContext.topProducts
        .slice(0, 10)
        .map(
          (p, i) =>
            `${i + 1}. ${p.name} (${p.brand}) — $${p.price}, ${p.reviews} reviews, ${p.rating}★`
        )
        .join('\n')}`
    : '';

  return `You are an expert Amazon listing copywriter and SEO strategist. Your task is to create an SEO-optimized Amazon product listing for the brand "${brandName}" (ASIN: ${auditAsin}).

${currentBlock}

TOP KEYWORD OPPORTUNITIES (sorted by search volume):
${keywordBlock}

${marketBlock}

INSTRUCTIONS:
1. Create an optimized TITLE that:
   - Starts with the brand name "${brandName}"
   - Front-loads the highest-volume, most relevant keywords
   - Stays within Amazon's 200-character limit
   - Reads naturally — no keyword stuffing
   - Includes key product differentiators and benefits
   - Uses pipes (|) or dashes (–) to separate keyword clusters

2. Create exactly 5 BULLET POINTS that:
   - Each starts with a CAPITALIZED BENEFIT HEADER (2-4 words) followed by a colon
   - Naturally weave in remaining high-volume keywords not used in the title
   - Lead with benefits, then support with features
   - Each bullet is 150-250 characters
   - Address common customer pain points and purchase drivers visible in competitor listings
   - Include social proof language, certifications, or guarantees where appropriate
   - Cover: primary benefit, quality/materials, ease of use, versatility, and trust/guarantee

3. KEYWORD STRATEGY NOTES:
   - Explain which keywords you prioritized and why
   - Note any keyword gaps or opportunities
   - Suggest backend/hidden keywords that didn't fit in the listing copy

Respond in this exact JSON format:
{
  "optimizedTitle": "...",
  "bullets": [
    { "header": "BENEFIT HEADER", "text": "Full bullet point text including the header" },
    { "header": "BENEFIT HEADER", "text": "Full bullet point text including the header" },
    { "header": "BENEFIT HEADER", "text": "Full bullet point text including the header" },
    { "header": "BENEFIT HEADER", "text": "Full bullet point text including the header" },
    { "header": "BENEFIT HEADER", "text": "Full bullet point text including the header" }
  ],
  "keywordStrategy": "...",
  "backendKeywords": ["keyword1", "keyword2", "..."],
  "changesSummary": "Brief summary of what was changed and why"
}

Return ONLY the JSON, no markdown fences or additional text.`;
}

// ────────────────────────────────────────────
// POST /api/process — main endpoint
// ────────────────────────────────────────────
const fileFields = upload.fields([
  { name: 'jungleScoutAll', maxCount: 1 },
  { name: 'jungleScoutAsin', maxCount: 1 },
  { name: 'cerebroExport', maxCount: 1 },
  { name: 'titleBullets', maxCount: 1 },
]);

app.post('/api/process', fileFields, async (req, res) => {
  try {
    const { brandName, auditAsin } = req.body;

    if (!brandName || !auditAsin) {
      return res.status(400).json({ error: 'Brand name and audit ASIN are required.' });
    }

    if (!req.files?.cerebroExport?.[0]) {
      return res.status(400).json({ error: 'Cerebro export file is required.' });
    }

    // Parse files
    const cerebroRows = parseFileBuffer(
      req.files.cerebroExport[0].buffer,
      req.files.cerebroExport[0].originalname
    );

    const titleBulletsRows = req.files.titleBullets?.[0]
      ? parseFileBuffer(req.files.titleBullets[0].buffer, req.files.titleBullets[0].originalname)
      : [];

    const jsAllRows = req.files.jungleScoutAll?.[0]
      ? parseFileBuffer(
          req.files.jungleScoutAll[0].buffer,
          req.files.jungleScoutAll[0].originalname
        )
      : [];

    const jsAsinRows = req.files.jungleScoutAsin?.[0]
      ? parseFileBuffer(
          req.files.jungleScoutAsin[0].buffer,
          req.files.jungleScoutAsin[0].originalname
        )
      : [];

    // Extract structured data
    const allKeywords = extractCerebroKeywords(cerebroRows);
    const currentListing = extractCurrentListing(titleBulletsRows, auditAsin);
    const jungleScoutContext = extractJungleScoutContext(jsAllRows, jsAsinRows);

    // Top keyword opportunities (high volume, poor rank or not ranking)
    const keywordOpportunities = allKeywords.map((k) => ({
      ...k,
      opportunity:
        k.organicRank == null || k.organicRank > 50
          ? 'HIGH'
          : k.organicRank > 20
          ? 'MEDIUM'
          : 'LOW',
    }));

    // Build AI prompt
    const prompt = buildPrompt({
      brandName,
      auditAsin,
      currentListing,
      topKeywords: allKeywords,
      jungleScoutContext,
    });

    // Call OpenAI API
    let aiResult = null;
    let aiError = null;

    try {
      console.log('🤖 Calling AI via n8n webhook...');
      const n8nWebhookUrl = 'https://n8n.botnflow.com/webhook/a01758fc-9277-4213-977a-b30dee466537';
      
      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY || 'sk-dummy'}`
        },
        body: JSON.stringify({
          // Adding prompt at the root level so it's easier to map in n8n
          prompt: prompt,
          systemInstruction: 'You are an expert Amazon product listing optimization specialist. Always respond with valid JSON only.',
          
          // Keeping standard OpenAI format as well
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert Amazon product listing optimization specialist. Always respond with valid JSON only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
        })
      });

      if (!response.ok) {
        throw new Error(`n8n webhook failed with status ${response.status}`);
      }

      const data = await response.json();
      
      // Handle standard OpenAI format or direct text response from n8n
      let raw = '';
      if (data.choices && data.choices[0]?.message?.content) {
        raw = data.choices[0].message.content.trim();
      } else if (data.output) {
        raw = data.output.trim();
      } else if (data.text) {
        raw = data.text.trim();
      } else if (typeof data === 'string') {
        raw = data.trim();
      } else {
        // Fallback: try to stringify if it's returning the JSON object directly
        raw = JSON.stringify(data);
      }

      console.log('Raw response length:', raw.length, 'chars');
      
      // Strip markdown code fences if present
      const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
      
      try {
        aiResult = JSON.parse(cleaned);
        console.log('✅ AI response received successfully.');
      } catch (parseErr) {
        console.log('⚠️ AI response was not valid JSON. Returning raw text for debugging.');
        aiResult = {
          optimizedTitle: "⚠️ n8n Workflow Configuration Error",
          bullets: [
            { header: "Raw Output from n8n", text: raw || "No response text received." },
            { header: "Troubleshooting", text: "Your n8n workflow is returning plain text instead of the required JSON format. Make sure your n8n webhook node is passing the full prompt to OpenAI, and the respond-to-webhook node is returning the OpenAI output as valid JSON." }
          ],
          keywordStrategy: "Could not generate strategy due to invalid formatting.",
          backendKeywords: [],
          changesSummary: "Failed to parse JSON."
        };
      }
    } catch (err) {
      console.error('AI generation error:', err.message);
      aiError = err.message;
    }

    res.json({
      success: true,
      brandName,
      auditAsin,
      keywordOpportunities: keywordOpportunities.slice(0, 100),
      totalKeywords: allKeywords.length,
      currentListing,
      jungleScoutContext,
      aiOptimizedListing: aiResult,
      aiError,
    });
  } catch (err) {
    console.error('Processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', usingN8n: true });
});

app.listen(PORT, () => {
  console.log(`\n🚀 BGC Audit Backend running on http://localhost:${PORT}`);
  console.log(`   AI routed through n8n webhook: https://n8n.botnflow.com/webhook/a01758fc-9277-4213-977a-b30dee466537\n`);
});

import formidable from 'formidable';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import path from 'path';

// Disable Vercel's default body parser so formidable can process the multipart stream
// Also increase maxDuration to 60 seconds (Hobby limit) for AI generation
export const config = {
  maxDuration: 60,
  api: {
    bodyParser: false,
  },
};

// ────────────────────────────────────────────
// Utility functions adapted from server.js
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

function extractCerebroKeywords(rows) {
  return rows
    .map((r) => {
      const n = normalizeRow(r);
      const searchVolume = n['searchvolume'] ?? n['srchvol'] ?? n['searchvol'] ?? n['volume'] ?? 0;
      const keyword = n['keywordphrase'] ?? n['keyword'] ?? n['searchterm'] ?? n['phrases'] ?? '';
      const competitorRank = n['competitorrank'] ?? n['competitorrankavg'] ?? n['comprank'] ?? n['avgrank'] ?? null;
      const rawOrganicRank = n['positionrank'] ?? n['position'] ?? n['positionorganic'] ?? n['organicrank'] ?? n['rank'] ?? null;
      const organicRank = (rawOrganicRank != null && rawOrganicRank > 0) ? rawOrganicRank : null;
      const rankingCompetitors = n['rankingcompetitorscount'] ?? n['rankingcompetitors'] ?? n['competitorrankcount'] ?? n['numcompetitors'] ?? null;

      let rankGap = null;
      if (competitorRank != null && organicRank != null) {
        rankGap = (organicRank || 306) - (competitorRank || 306);
      }

      return {
        keyword: String(keyword).trim(),
        searchVolume: Number(searchVolume) || 0,
        organicRank: organicRank != null ? Number(organicRank) : null,
        competitorRank: competitorRank != null ? Number(competitorRank) : null,
        rankingCompetitors: rankingCompetitors != null ? Number(rankingCompetitors) : null,
        rankGap,
      };
    })
    .filter((k) => k.keyword && k.searchVolume > 0)
    .sort((a, b) => b.searchVolume - a.searchVolume);
}

function extractCurrentListing(rows, auditAsin) {
  if (!rows || rows.length === 0) return { title: '', bullets: [] };

  let targetRow = rows[0];
  if (auditAsin) {
    const match = rows.find((r) => String(normalizeRow(r)['asin'] ?? '').toUpperCase() === auditAsin.toUpperCase());
    if (match) targetRow = match;
  }

  const first = normalizeRow(targetRow);
  const title = first['title'] ?? first['producttitle'] ?? first['listingtitle'] ?? first['itemname'] ?? '';

  const bullets = [];
  for (let i = 1; i <= 10; i++) {
    const val = first[`bulletpoint${i}`] ?? first[`bullet${i}`] ?? first[`keyfeature${i}`] ?? null;
    if (val) bullets.push(String(val).trim());
  }

  return { title: String(title).trim(), bullets };
}

function extractJungleScoutContext(allProductsRows, asinRows) {
  const topProducts = (allProductsRows || []).slice(0, 20).map((r) => {
    const n = normalizeRow(r);
    return {
      name: n['productname'] ?? n['name'] ?? n['title'] ?? '',
      brand: n['brand'] ?? '',
      price: n['price'] ?? '',
      reviews: n['reviews'] ?? n['numberofreviews'] ?? '',
      rating: n['rating'] ?? n['avgrating'] ?? '',
    };
  });
  return { topProducts, asinData: null };
}

function buildPrompt({ brandName, auditAsin, currentListing, topKeywords, jungleScoutContext }) {
  const keywordBlock = topKeywords.slice(0, 60).map((k, i) => `${i + 1}. "${k.keyword}" — SV: ${k.searchVolume}`).join('\n');
  const currentBlock = currentListing.title ? `CURRENT TITLE:\n${currentListing.title}\n\nCURRENT BULLETS:\n${currentListing.bullets.join('\n')}` : 'No current listing data provided.';
  const marketBlock = jungleScoutContext.topProducts.length ? `TOP COMPETING PRODUCTS:\n${jungleScoutContext.topProducts.slice(0, 10).map((p, i) => `${i + 1}. ${p.name} (${p.brand})`).join('\n')}` : '';

  return `You are an expert Amazon listing copywriter and SEO strategist. Your task is to create an SEO-optimized Amazon product listing for the brand "${brandName}" (ASIN: ${auditAsin}).\n\n${currentBlock}\n\nTOP KEYWORD OPPORTUNITIES:\n${keywordBlock}\n\n${marketBlock}\n\nRespond EXACTLY in this JSON format:\n{\n  "optimizedTitle": "...",\n  "bullets": [\n    { "header": "HEADER", "text": "text" }\n  ],\n  "keywordStrategy": "...",\n  "backendKeywords": ["k1", "k2"],\n  "changesSummary": "summary"\n}`;
}

// ────────────────────────────────────────────
// Vercel Serverless Function Handler
// ────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Form parsing error' });

    try {
      const brandName = Array.isArray(fields.brandName) ? fields.brandName[0] : fields.brandName;
      const auditAsin = Array.isArray(fields.auditAsin) ? fields.auditAsin[0] : fields.auditAsin;

      if (!brandName || !auditAsin) {
        return res.status(400).json({ error: 'Brand name and audit ASIN are required.' });
      }

      if (!files.cerebroExport) {
        return res.status(400).json({ error: 'Cerebro export file is required.' });
      }

      // Read files from formidable temp paths
      const readParsedFile = (fileKey) => {
        const fileObj = Array.isArray(files[fileKey]) ? files[fileKey][0] : files[fileKey];
        if (!fileObj) return [];
        const buffer = readFileSync(fileObj.filepath);
        return parseFileBuffer(buffer, fileObj.originalFilename);
      };

      const cerebroRows = readParsedFile('cerebroExport');
      const titleBulletsRows = readParsedFile('titleBullets');
      const jsAllRows = readParsedFile('jungleScoutAll');
      const jsAsinRows = readParsedFile('jungleScoutAsin');

      // Process data
      const allKeywords = extractCerebroKeywords(cerebroRows);
      const currentListing = extractCurrentListing(titleBulletsRows, auditAsin);
      const jungleScoutContext = extractJungleScoutContext(jsAllRows, jsAsinRows);

      const keywordOpportunities = allKeywords.map((k) => ({
        ...k,
        opportunity: k.organicRank == null || k.organicRank > 50 ? 'HIGH' : k.organicRank > 20 ? 'MEDIUM' : 'LOW',
      }));

      const prompt = buildPrompt({ brandName, auditAsin, currentListing, topKeywords: allKeywords, jungleScoutContext });

      let aiResult = null;
      let aiError = null;

      try {
        const n8nWebhookUrl = 'https://n8n.botnflow.com/webhook/a01758fc-9277-4213-977a-b30dee466537';
        const response = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY || 'sk-dummy'}`
          },
          body: JSON.stringify({
            prompt,
            systemInstruction: 'You are an expert Amazon product listing optimization specialist. Always respond with valid JSON only.',
            model: 'gpt-4o',
            messages: [{ role: 'system', content: 'JSON only.' }, { role: 'user', content: prompt }]
          })
        });

        if (!response.ok) throw new Error(`n8n webhook failed with status ${response.status}`);
        
        const data = await response.json();
        let raw = '';
        if (data.choices && data.choices[0]?.message?.content) raw = data.choices[0].message.content.trim();
        else if (data.output) raw = data.output.trim();
        else if (data.text) raw = data.text.trim();
        else if (typeof data === 'string') raw = data.trim();
        else raw = JSON.stringify(data);

        const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
        aiResult = JSON.parse(cleaned);
      } catch (e) {
        aiError = e.message;
      }

      res.status(200).json({
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
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });
}

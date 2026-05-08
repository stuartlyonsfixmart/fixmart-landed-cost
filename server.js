// Fixmart Landed Cost Calculator — Cloud Run Server

const express = require('express');
const session = require('express-session');
const admin = require('firebase-admin');
const axios = require('axios');
const { GoogleAuth } = require('google-auth-library');
const XLSX = require('xlsx');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Firebase init
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'fixmart-bi'
});
const db = admin.firestore();
db.settings({ databaseId: 'landedcost' });

// Sessions — in-memory with long TTL (7 days rolling)
// Cloud Run scale-to-zero will still log out on cold start but this is fine for low-traffic use
app.use(session({
  secret: process.env.SESSION_SECRET || 'fixmart-landed-cost-2026',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// ── Auth ──────────────────────────────────────────────────────────────────────
const USERS = {
  karl: process.env.KARL_PASSWORD || 'landed',
  fixmart: process.env.FIXMART_PASSWORD || 'fixmart2026'
};

app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (USERS[username] && USERS[username] === password) {
    req.session.user = username;
    res.redirect('/');
  } else {
    res.redirect('/login.html?error=1');
  }
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login.html'); });

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorised' });
  res.redirect('/login.html');
}

app.use((req, res, next) => {
  if (req.path === '/login.html' || req.path === '/login') return next();
  requireAuth(req, res, next);
});

app.use(express.static(path.join(__dirname, 'public')));

// ── FX Rate — Google Cloud Billing API ───────────────────────────────────────
let fxCache = { rate: 1.17, timestamp: null, source: 'default' };

app.get('/api/fx', async (req, res) => {
  const now = Date.now();
  if (fxCache.timestamp && now - fxCache.timestamp < 60 * 60 * 1000) return res.json(fxCache);
  try {
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    const resp = await axios.get('https://cloudbilling.googleapis.com/v1beta/exchangeRates', {
      headers: { Authorization: `Bearer ${token.token}` }, timeout: 8000
    });
    const rates = resp.data.exchangeRates || resp.data.rates || {};
    const find = (code) => rates[code] || (Array.isArray(rates) && rates.find(r => r.currencyCode === code)?.units);
    const gbp = parseFloat(find('GBP')); const eur = parseFloat(find('EUR'));
    if (gbp && eur) fxCache = { rate: Math.round(eur / gbp * 10000) / 10000, timestamp: now, source: 'live' };
    else fxCache.source = 'cached';
    res.json(fxCache);
  } catch (e) { console.error('FX error:', e.message); fxCache.source = 'cached'; res.json(fxCache); }
});

// ── Assumptions ───────────────────────────────────────────────────────────────
app.get('/api/assumptions', async (req, res) => {
  const doc = await db.collection('config').doc('assumptions').get();
  if (!doc.exists) {
    const defaults = { transportRatePerKg: 1.0, cbamRateEurPerTonneCo2: 5.2, cbamEmissionsFactorTco2PerTonne: 74, defaultGrossMargin: 0.35, sourcingMarkupChina: 1.2 };
    await db.collection('config').doc('assumptions').set({ ...defaults, updatedBy: 'system', updatedAt: new Date().toISOString() });
    return res.json(defaults);
  }
  res.json(doc.data());
});

app.put('/api/assumptions', async (req, res) => {
  const prev = await db.collection('config').doc('assumptions').get();
  if (prev.exists) await db.collection('assumptionsLog').add({ ...prev.data(), loggedAt: new Date().toISOString() });
  await db.collection('config').doc('assumptions').set({ ...req.body, updatedBy: req.session.user, updatedAt: new Date().toISOString() });
  res.json({ ok: true });
});

app.get('/api/assumptions/log', async (req, res) => {
  const snap = await db.collection('assumptionsLog').orderBy('loggedAt', 'desc').limit(20).get();
  res.json(snap.docs.map(d => d.data()));
});

// ── Duty Rates ────────────────────────────────────────────────────────────────
app.get('/api/duty-rates', async (req, res) => {
  const snap = await db.collection('dutyRates').get();
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});

app.post('/api/duty-rates', async (req, res) => {
  const { hsCode, countryOfOrigin, taricDutyRate, notes } = req.body;
  if (!hsCode || !countryOfOrigin || taricDutyRate === undefined) return res.status(400).json({ error: 'hsCode, countryOfOrigin and taricDutyRate are required' });
  const ref = await db.collection('dutyRates').add({ hsCode, countryOfOrigin: countryOfOrigin.toUpperCase(), taricDutyRate: parseFloat(taricDutyRate), notes: notes || '', createdBy: req.session.user, createdAt: new Date().toISOString() });
  res.json({ id: ref.id });
});

app.put('/api/duty-rates/:id', async (req, res) => {
  await db.collection('dutyRates').doc(req.params.id).update({ ...req.body, updatedBy: req.session.user, updatedAt: new Date().toISOString() });
  res.json({ ok: true });
});

app.delete('/api/duty-rates/:id', async (req, res) => {
  await db.collection('dutyRates').doc(req.params.id).delete();
  res.json({ ok: true });
});

// ── SKUs ──────────────────────────────────────────────────────────────────────
app.get('/api/skus', async (req, res) => {
  const snap = await db.collection('skus').orderBy('variantCode').get();
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});

app.post('/api/skus', async (req, res) => {
  const { variantCode, description, hsCode, countryOfOrigin, packQty, weightKg, costGbp, sourcingRate, ukMarginOverride, euMarginOverride } = req.body;
  if (!variantCode || !description || !countryOfOrigin || !weightKg || !costGbp) return res.status(400).json({ error: 'variantCode, description, countryOfOrigin, weightKg and costGbp are required' });
  const existing = await db.collection('skus').where('variantCode', '==', variantCode).get();
  if (!existing.empty) return res.status(409).json({ error: 'Variant code already exists' });
  let dutyWarning = null;
  if (hsCode) {
    const duty = await db.collection('dutyRates').where('hsCode', '==', hsCode).where('countryOfOrigin', '==', countryOfOrigin.toUpperCase()).get();
    if (duty.empty) dutyWarning = `No duty rate found for HS code ${hsCode} / ${countryOfOrigin} — landed cost will use 0% duty until added`;
  }
  const ref = await db.collection('skus').add({ variantCode, description, hsCode: hsCode || '', countryOfOrigin: countryOfOrigin.toUpperCase(), packQty: parseInt(packQty) || 1, weightKg: parseFloat(weightKg), costGbp: parseFloat(costGbp), sourcingRate: parseFloat(sourcingRate) || 1.0, ukMarginOverride: ukMarginOverride ? parseFloat(ukMarginOverride) : null, euMarginOverride: euMarginOverride ? parseFloat(euMarginOverride) : null, createdBy: req.session.user, createdAt: new Date().toISOString() });
  res.json({ id: ref.id, warning: dutyWarning });
});

app.put('/api/skus/:id', async (req, res) => {
  const data = { ...req.body, updatedBy: req.session.user, updatedAt: new Date().toISOString() };
  if (data.weightKg) data.weightKg = parseFloat(data.weightKg);
  if (data.costGbp) data.costGbp = parseFloat(data.costGbp);
  if (data.sourcingRate) data.sourcingRate = parseFloat(data.sourcingRate);
  await db.collection('skus').doc(req.params.id).update(data);
  res.json({ ok: true });
});

app.delete('/api/skus/:id', async (req, res) => {
  await db.collection('skus').doc(req.params.id).delete();
  res.json({ ok: true });
});

// ── Landed Cost Calculation ───────────────────────────────────────────────────
async function calcLandedCost(sku, qty, assumptions, fxRate) {
  const { transportRatePerKg, cbamRateEurPerTonneCo2, cbamEmissionsFactorTco2PerTonne, defaultGrossMargin } = assumptions;
  let taricRate = 0;
  if (sku.hsCode) {
    const dutySnap = await db.collection('dutyRates').where('hsCode', '==', sku.hsCode).where('countryOfOrigin', '==', sku.countryOfOrigin).get();
    if (!dutySnap.empty) taricRate = dutySnap.docs[0].data().taricDutyRate;
  }
  const euBaseCost = sku.costGbp * (sku.sourcingRate || 1.0);
  const taricDuty = euBaseCost * taricRate;
  const weightKgTotal = sku.weightKg * qty;
  const cbamCostGbp = (weightKgTotal / 1000) * cbamEmissionsFactorTco2PerTonne * cbamRateEurPerTonneCo2 / fxRate;
  const transportGbp = weightKgTotal * transportRatePerKg;
  const landedCostGbp = (euBaseCost + taricDuty + cbamCostGbp + transportGbp) * qty;
  const landedCostEur = landedCostGbp * fxRate;
  const ukMargin = sku.ukMarginOverride ?? defaultGrossMargin;
  const euMargin = sku.euMarginOverride ?? defaultGrossMargin;
  const ukSellPrice = (sku.costGbp * qty) / (1 - ukMargin);
  const euSellPrice = landedCostGbp / (1 - euMargin);
  const euSellPriceEur = euSellPrice * fxRate;
  const pctIncreaseVsUk = ukSellPrice > 0 ? (euSellPrice - ukSellPrice) / ukSellPrice : 0;
  return {
    variantCode: sku.variantCode, description: sku.description, qty,
    weightKgUnit: sku.weightKg, weightKgTotal,
    euBaseCost: r(euBaseCost), taricDutyGbp: r(taricDuty * qty), taricRate,
    cbamCostGbp: r(cbamCostGbp * qty), transportGbp: r(transportGbp),
    landedCostGbp: r(landedCostGbp), landedCostEur: r(landedCostEur),
    ukSellPrice: r(ukSellPrice), euSellPrice: r(euSellPrice), euSellPriceEur: r(euSellPriceEur),
    pctIncreaseVsUk: r(pctIncreaseVsUk * 100, 2),
    ukMargin: r(ukMargin * 100, 1), euMargin: r(euMargin * 100, 1)
  };
}

function r(n, dp = 2) { return Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp); }

// ── Transfers ─────────────────────────────────────────────────────────────────
app.get('/api/transfers', async (req, res) => {
  const snap = await db.collection('transfers').orderBy('createdAt', 'desc').limit(50).get();
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});

app.get('/api/transfers/:id', async (req, res) => {
  const doc = await db.collection('transfers').doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Not found' });
  res.json({ id: doc.id, ...doc.data() });
});

const PORT = process.env.PORT || 8080;

app.post('/api/transfers/calculate', async (req, res) => {
  const { lines } = req.body;
  if (!lines || !lines.length) return res.status(400).json({ error: 'No lines provided' });
  const assumDoc = await db.collection('config').doc('assumptions').get();
  const assumptions = assumDoc.exists ? assumDoc.data() : { transportRatePerKg: 1, cbamRateEurPerTonneCo2: 5.2, cbamEmissionsFactorTco2PerTonne: 74, defaultGrossMargin: 0.35 };
  const fxRate = fxCache.rate || 1.17;
  const results = [];
  for (const line of lines) {
    const skuDoc = await db.collection('skus').doc(line.skuId).get();
    if (!skuDoc.exists) continue;
    results.push(await calcLandedCost({ id: skuDoc.id, ...skuDoc.data() }, line.qty, assumptions, fxRate));
  }
  const tot = (f) => r(results.reduce((s, x) => s + x[f], 0));
  res.json({ lines: results, totals: { totalWeightKg: tot('weightKgTotal'), totalLandedCostGbp: tot('landedCostGbp'), totalLandedCostEur: tot('landedCostEur'), totalUkSellValue: tot('ukSellPrice'), totalEuSellValue: tot('euSellPrice'), totalEuSellValueEur: tot('euSellPriceEur'), fxRate, calculatedAt: new Date().toISOString() } });
});

app.post('/api/transfers', async (req, res) => {
  const { name, lines, totals, status } = req.body;
  const refNum = 'TRF-' + Date.now().toString().slice(-6);
  const ref = await db.collection('transfers').add({ refNum, name: name || refNum, lines, totals, status: status || 'Draft', createdBy: req.session.user, createdAt: new Date().toISOString() });
  res.json({ id: ref.id, refNum });
});

app.put('/api/transfers/:id', async (req, res) => {
  await db.collection('transfers').doc(req.params.id).update({ ...req.body, updatedBy: req.session.user, updatedAt: new Date().toISOString() });
  res.json({ ok: true });
});

app.get('/api/transfers/:id/export/:format', async (req, res) => {
  const doc = await db.collection('transfers').doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Not found' });
  const transfer = doc.data(); const fmt = req.params.format;
  const headers = ['Variant Code','Description','Qty','Weight/Unit kg','Total Weight kg','EU Base Cost £','TARIC Duty £','CBAM Cost £','Transport £','Landed Cost £','Landed Cost €','UK Sell Price £','EU Sell Price £','EU Sell Price €','% Inc vs UK','UK Margin %','EU Margin %'];
  const rows = transfer.lines.map(l => [l.variantCode, l.description, l.qty, l.weightKgUnit, l.weightKgTotal, l.euBaseCost, l.taricDutyGbp, l.cbamCostGbp, l.transportGbp, l.landedCostGbp, l.landedCostEur, l.ukSellPrice, l.euSellPrice, l.euSellPriceEur, l.pctIncreaseVsUk+'%', l.ukMargin+'%', l.euMargin+'%']);
  if (fmt === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${transfer.refNum}.csv"`);
    return res.send([headers,...rows].map(r => r.map(v=>`"${v}"`).join(',')).join('\n'));
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Fixmart – Intercompany Transfer Pro-Forma'],['Reference',transfer.refNum],['Name',transfer.name],['Status',transfer.status],['Created By',transfer.createdBy],['Created At',transfer.createdAt],['FX Rate (GBP/EUR)',transfer.totals.fxRate],[],['TOTALS'],['Total Weight (kg)',transfer.totals.totalWeightKg],['Total Landed Cost (£)',transfer.totals.totalLandedCostGbp],['Total Landed Cost (€)',transfer.totals.totalLandedCostEur],['Total EU Sell Value (€)',transfer.totals.totalEuSellValueEur]]), 'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), 'Transfer Lines');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${transfer.refNum}.xlsx"`);
  res.send(buf);
});

app.get('/api/skus/export/:format', async (req, res) => {
  const snap = await db.collection('skus').orderBy('variantCode').get();
  const skus = snap.docs.map(d => d.data());
  const headers = ['Variant Code','Description','HS Code','Country of Origin','Pack Qty','Weight kg','Cost GBP','Sourcing Rate','UK Margin Override','EU Margin Override'];
  const rows = skus.map(s => [s.variantCode, s.description, s.hsCode, s.countryOfOrigin, s.packQty, s.weightKg, s.costGbp, s.sourcingRate, s.ukMarginOverride??'', s.euMarginOverride??'']);
  if (req.params.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="fixmart-sku-master.csv"');
    return res.send([headers,...rows].map(r=>r.map(v=>`"${v??''}"`).join(',')).join('\n'));
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers,...rows]), 'SKU Master');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="fixmart-sku-master.xlsx"');
  res.send(buf);
});

app.listen(PORT, () => console.log(`Fixmart Landed Cost running on port ${PORT}`));

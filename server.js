const express = require('express');
const session = require('express-session');
const { OAuth2Client } = require('google-auth-library');
const admin = require('firebase-admin');
const axios = require('axios');
const XLSX = require('xlsx');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fixmart-landed-cost-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'fixmart-bi'
});

const db = admin.firestore();

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'https://your-service-url/auth/callback'
);

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim());

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ error: 'Unauthorised' });
}

app.get('/auth/login', (req, res) => {
  const url = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: ['profile', 'email'] });
  res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
  try {
    const { tokens } = await oauth2Client.getToken(req.query.code);
    oauth2Client.setCredentials(tokens);
    const ticket = await oauth2Client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (ALLOWED_EMAILS.length && !ALLOWED_EMAILS.includes(payload.email)) return res.status(403).send('Access denied');
    req.session.user = { email: payload.email, name: payload.name };
    res.redirect('/');
  } catch (e) { console.error(e); res.status(500).send('Auth error'); }
});

app.get('/auth/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) res.json(req.session.user);
  else res.status(401).json({ error: 'Not logged in' });
});

let fxCache = { rate: 1.17, timestamp: null };

app.get('/api/fx', requireAuth, async (req, res) => {
  const now = Date.now();
  if (fxCache.timestamp && now - fxCache.timestamp < 60 * 60 * 1000) return res.json(fxCache);
  try {
    const apiKey = process.env.FX_API_KEY;
    const url = apiKey
      ? `https://v6.exchangerate-api.com/v6/${apiKey}/pair/GBP/EUR`
      : `https://api.exchangerate-api.com/v4/latest/GBP`;
    const resp = await axios.get(url, { timeout: 5000 });
    const rate = apiKey ? resp.data.conversion_rate : resp.data.rates.EUR;
    fxCache = { rate, timestamp: now, source: 'live' };
    res.json(fxCache);
  } catch (e) { fxCache.source = 'cached'; res.json(fxCache); }
});

app.get('/api/assumptions', requireAuth, async (req, res) => {
  const doc = await db.collection('config').doc('assumptions').get();
  if (!doc.exists) {
    const defaults = { transportRatePerKg: 1.0, cbamRateEurPerTonneCo2: 5.2, cbamEmissionsFactorTco2PerTonne: 74, defaultGrossMargin: 0.35, sourcingMarkupChina: 1.2 };
    await db.collection('config').doc('assumptions').set({ ...defaults, updatedBy: 'system', updatedAt: new Date().toISOString() });
    return res.json(defaults);
  }
  res.json(doc.data());
});

app.put('/api/assumptions', requireAuth, async (req, res) => {
  const prev = await db.collection('config').doc('assumptions').get();
  if (prev.exists) await db.collection('assumptionsLog').add({ ...prev.data(), loggedAt: new Date().toISOString() });
  await db.collection('config').doc('assumptions').set({ ...req.body, updatedBy: req.session.user.email, updatedAt: new Date().toISOString() });
  res.json({ ok: true });
});

app.get('/api/assumptions/log', requireAuth, async (req, res) => {
  const snap = await db.collection('assumptionsLog').orderBy('loggedAt', 'desc').limit(20).get();
  res.json(snap.docs.map(d => d.data()));
});

app.get('/api/duty-rates', requireAuth, async (req, res) => {
  const snap = await db.collection('dutyRates').get();
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});

app.post('/api/duty-rates', requireAuth, async (req, res) => {
  const { hsCode, countryOfOrigin, taricDutyRate, notes } = req.body;
  if (!hsCode || !countryOfOrigin || taricDutyRate === undefined) return res.status(400).json({ error: 'hsCode, countryOfOrigin and taricDutyRate are required' });
  const ref = await db.collection('dutyRates').add({ hsCode, countryOfOrigin: countryOfOrigin.toUpperCase(), taricDutyRate: parseFloat(taricDutyRate), notes: notes || '', createdBy: req.session.user.email, createdAt: new Date().toISOString() });
  res.json({ id: ref.id });
});

app.put('/api/duty-rates/:id', requireAuth, async (req, res) => {
  await db.collection('dutyRates').doc(req.params.id).update({ ...req.body, updatedBy: req.session.user.email, updatedAt: new Date().toISOString() });
  res.json({ ok: true });
});

app.delete('/api/duty-rates/:id', requireAuth, async (req, res) => {
  await db.collection('dutyRates').doc(req.params.id).delete();
  res.json({ ok: true });
});

app.get('/api/skus', requireAuth, async (req, res) => {
  const snap = await db.collection('skus').orderBy('variantCode').get();
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});

app.post('/api/skus', requireAuth, async (req, res) => {
  const { variantCode, description, hsCode, countryOfOrigin, packQty, weightKg, costGbp, sourcingRate, ukMarginOverride, euMarginOverride } = req.body;
  if (!variantCode || !description || !countryOfOrigin || !weightKg || !costGbp) return res.status(400).json({ error: 'variantCode, description, countryOfOrigin, weightKg and costGbp are required' });
  const existing = await db.collection('skus').where('variantCode', '==', variantCode).get();
  if (!existing.empty) return res.status(409).json({ error: 'Variant code already exists' });
  let dutyWarning = null;
  if (hsCode) {
    const duty = await db.collection('dutyRates').where('hsCode', '==', hsCode).where('countryOfOrigin', '==', countryOfOrigin.toUpperCase()).get();
    if (duty.empty) dutyWarning = `No duty rate found for HS code ${hsCode} / ${countryOfOrigin} — landed cost will use 0% duty until added`;
  }
  const ref = await db.collection('skus').add({ variantCode, description, hsCode: hsCode || '', countryOfOrigin: countryOfOrigin.toUpperCase(), packQty: parseInt(packQty) || 1, weightKg: parseFloat(weightKg), costGbp: parseFloat(costGbp), sourcingRate: parseFloat(sourcingRate) || 1.0, ukMarginOverride: ukMarginOverride ? parseFloat(ukMarginOverride) : null, euMarginOverride: euMarginOverride ? parseFloat(euMarginOverride) : null, createdBy: req.session.user.email, createdAt: new Date().toISOString() });
  res.json({ id: ref.id, warning: dutyWarning });
});

app.put('/api/skus/:id', requireAuth, async (req, res) => {
  const data = { ...req.body, updatedBy: req.session.user.email, updatedAt: new Date().toISOString() };
  if (data.weightKg) data.weightKg = parseFloat(data.weightKg);
  if (data.costGbp) data.costGbp = parseFloat(data.costGbp);
  if (data.sourcingRate) data.sourcingRate = parseFloat(data.sourcingRate);
  await db.collection('skus').doc(req.params.id).update(data);
  res.json({ ok: true });
});

app.delete('/api/skus/:id', requireAuth, async (req, res) => {
  await db.collection('skus').doc(req.params.id).delete();
  res.json({ ok: true });
});

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
  const weightTonnes = weightKgTotal / 1000;
  const cbamCo2 = weightTonnes * cbamEmissionsFactorTco2PerTonne;
  const cbamCostEur = cbamCo2 * cbamRateEurPerTonneCo2;
  const cbamCostGbp = cbamCostEur / fxRate;
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
    euBaseCost: round(euBaseCost), taricDutyGbp: round(taricDuty * qty), taricRate,
    cbamCostGbp: round(cbamCostGbp * qty), transportGbp: round(transportGbp),
    landedCostGbp: round(landedCostGbp), landedCostEur: round(landedCostEur),
    ukSellPrice: round(ukSellPrice), euSellPrice: round(euSellPrice), euSellPriceEur: round(euSellPriceEur),
    pctIncreaseVsUk: round(pctIncreaseVsUk * 100, 2),
    ukMargin: round(ukMargin * 100, 1), euMargin: round(euMargin * 100, 1)
  };
}

function round(n, dp = 2) { return Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp); }

app.get('/api/transfers', requireAuth, async (req, res) => {
  const snap = await db.collection('transfers').orderBy('createdAt', 'desc').limit(50).get();
  res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});

app.get('/api/transfers/:id', requireAuth, async (req, res) => {
  const doc = await db.collection('transfers').doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Not found' });
  res.json({ id: doc.id, ...doc.data() });
});

const PORT = process.env.PORT || 8080;

app.post('/api/transfers/calculate', requireAuth, async (req, res) => {
  const { lines } = req.body;
  if (!lines || !lines.length) return res.status(400).json({ error: 'No lines provided' });
  const assumDoc = await db.collection('config').doc('assumptions').get();
  const assumptions = assumDoc.exists ? assumDoc.data() : { transportRatePerKg: 1, cbamRateEurPerTonneCo2: 5.2, cbamEmissionsFactorTco2PerTonne: 74, defaultGrossMargin: 0.35 };
  const fxRate = fxCache.rate || 1.17;
  const results = [];
  for (const line of lines) {
    const skuDoc = await db.collection('skus').doc(line.skuId).get();
    if (!skuDoc.exists) continue;
    const calc = await calcLandedCost({ id: skuDoc.id, ...skuDoc.data() }, line.qty, assumptions, fxRate);
    results.push(calc);
  }
  const totals = {
    totalWeightKg: round(results.reduce((s, r) => s + r.weightKgTotal, 0)),
    totalLandedCostGbp: round(results.reduce((s, r) => s + r.landedCostGbp, 0)),
    totalLandedCostEur: round(results.reduce((s, r) => s + r.landedCostEur, 0)),
    totalUkSellValue: round(results.reduce((s, r) => s + r.ukSellPrice, 0)),
    totalEuSellValue: round(results.reduce((s, r) => s + r.euSellPrice, 0)),
    totalEuSellValueEur: round(results.reduce((s, r) => s + r.euSellPriceEur, 0)),
    fxRate, calculatedAt: new Date().toISOString()
  };
  res.json({ lines: results, totals });
});

app.post('/api/transfers', requireAuth, async (req, res) => {
  const { name, lines, totals, status } = req.body;
  const refNum = 'TRF-' + Date.now().toString().slice(-6);
  const ref = await db.collection('transfers').add({ refNum, name: name || refNum, lines, totals, status: status || 'Draft', createdBy: req.session.user.email, createdAt: new Date().toISOString() });
  res.json({ id: ref.id, refNum });
});

app.put('/api/transfers/:id', requireAuth, async (req, res) => {
  await db.collection('transfers').doc(req.params.id).update({ ...req.body, updatedBy: req.session.user.email, updatedAt: new Date().toISOString() });
  res.json({ ok: true });
});

app.get('/api/transfers/:id/export/:format', requireAuth, async (req, res) => {
  const doc = await db.collection('transfers').doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Not found' });
  const transfer = doc.data();
  const fmt = req.params.format;
  const headers = ['Variant Code','Description','Qty','Weight/Unit kg','Total Weight kg','EU Base Cost £','TARIC Duty £','CBAM Cost £','Transport £','Landed Cost £','Landed Cost €','UK Sell Price £','EU Sell Price £','EU Sell Price €','% Inc vs UK','UK Margin %','EU Margin %'];
  const rows = transfer.lines.map(l => [l.variantCode, l.description, l.qty, l.weightKgUnit, l.weightKgTotal, l.euBaseCost, l.taricDutyGbp, l.cbamCostGbp, l.transportGbp, l.landedCostGbp, l.landedCostEur, l.ukSellPrice, l.euSellPrice, l.euSellPriceEur, l.pctIncreaseVsUk + '%', l.ukMargin + '%', l.euMargin + '%']);
  if (fmt === 'csv') {
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${transfer.refNum}.csv"`);
    return res.send(csv);
  }
  const wb = XLSX.utils.book_new();
  const summaryData = [['Fixmart – Intercompany Transfer Pro-Forma'],['Reference', transfer.refNum],['Name', transfer.name],['Status', transfer.status],['Created By', transfer.createdBy],['Created At', transfer.createdAt],['FX Rate (GBP/EUR)', transfer.totals.fxRate],[],['TOTALS'],['Total Weight (kg)', transfer.totals.totalWeightKg],['Total Landed Cost (£)', transfer.totals.totalLandedCostGbp],['Total Landed Cost (€)', transfer.totals.totalLandedCostEur],['Total UK Sell Value (£)', transfer.totals.totalUkSellValue],['Total EU Sell Value (£)', transfer.totals.totalEuSellValue],['Total EU Sell Value (€)', transfer.totals.totalEuSellValueEur]];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), 'Transfer Lines');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${transfer.refNum}.xlsx"`);
  res.send(buf);
});

app.get('/api/skus/export/:format', requireAuth, async (req, res) => {
  const snap = await db.collection('skus').orderBy('variantCode').get();
  const skus = snap.docs.map(d => d.data());
  const headers = ['Variant Code','Description','HS Code','Country of Origin','Pack Qty','Weight kg','Cost GBP','Sourcing Rate','UK Margin Override','EU Margin Override'];
  const rows = skus.map(s => [s.variantCode, s.description, s.hsCode, s.countryOfOrigin, s.packQty, s.weightKg, s.costGbp, s.sourcingRate, s.ukMarginOverride ?? '', s.euMarginOverride ?? '']);
  if (req.params.format === 'csv') {
    const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="fixmart-sku-master.csv"');
    return res.send(csv);
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), 'SKU Master');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="fixmart-sku-master.xlsx"');
  res.send(buf);
});

app.listen(PORT, () => console.log(`Fixmart Landed Cost running on port ${PORT}`));

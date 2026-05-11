// Fixmart Landed Cost — Firestore Seed Script
// Seeds 67 SKUs, 17 duty rates, and default assumptions from Karl's original spreadsheet.
//
// Usage (from Cloud Shell):
//   node seed.js

const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'project-aa7ee149-5e29-4eb4-8bc'
});

const db = admin.firestore();
db.settings({ databaseId: 'landedcost-native' });

const SKUS = [
  { variantCode: "101220923", description: "*HDG H.T. Hex Bolt M24 X 120*", hsCode: "7318158290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 40.0, costGbp: 84.11, sourcingRate: 1.2 },
  { variantCode: "201111254", description: "Channel Slotted - 41 X 41 X 2.5mm, HDG, 3M", hsCode: "7326909890", countryOfOrigin: "CHINA", packQty: 1, weightKg: 7.25, costGbp: 10.75, sourcingRate: 1.0 },
  { variantCode: "201201046", description: "Torqx Channel End Cap - Black - For 41 X 41 Channel - Pack of 100", hsCode: "3923509000", countryOfOrigin: "UK MANUFACTURED", packQty: 100, weightKg: 0.6, costGbp: 2.21, sourcingRate: 1.0 },
  { variantCode: "201301034", description: "90° Channel Bracket, 2 Hole (1+1 Hole) 50 X 47 mm HDG", hsCode: "7308909890", countryOfOrigin: "INDIA", packQty: 1, weightKg: 0.12, costGbp: 0.16, sourcingRate: 1.0 },
  { variantCode: "201301039", description: "90° Channel Bracket, 4 Hole (2+2 Hole) 89 X 104 mm HDG", hsCode: "7308909890", countryOfOrigin: "INDIA", packQty: 1, weightKg: 0.26, costGbp: 0.3, sourcingRate: 1.0 },
  { variantCode: "201301059", description: "External Wrap Around Coupler / Joiner - For 41 X 41 Channel HDG", hsCode: "7308909890", countryOfOrigin: "INDIA", packQty: 1, weightKg: 0.9, costGbp: 1.27, sourcingRate: 1.0 },
  { variantCode: "201301062", description: "Flat T Channel Bracket 4 hole 90 X 138 mm HDG", hsCode: "7308909890", countryOfOrigin: "INDIA", packQty: 1, weightKg: 0.285, costGbp: 0.34, sourcingRate: 1.0 },
  { variantCode: "201306067", description: "Unistrut P2072-S1 Channel Base Plates 100 X 100 X 45 mm HDG", hsCode: "7308909890", countryOfOrigin: "UK SUPPLIER", packQty: 1, weightKg: 0.5, costGbp: 2.85, sourcingRate: 1.0 },
  { variantCode: "201401106", description: "Plain Channel Nuts HDG, M10", hsCode: "7318169290", countryOfOrigin: "INDIA", packQty: 100, weightKg: 3.2, costGbp: 6.62, sourcingRate: 1.0 },
  { variantCode: "201401108", description: "Plain Channel Nuts HDG, M12", hsCode: "7318169990", countryOfOrigin: "INDIA", packQty: 100, weightKg: 3.3, costGbp: 6.74, sourcingRate: 1.0 },
  { variantCode: "201411688", description: "HDG Plain Channel Nuts - M16 *", hsCode: "7318169990", countryOfOrigin: "INDIA", packQty: 100, weightKg: 6.0, costGbp: 14.95, sourcingRate: 1.0 },
  { variantCode: "201701188", description: "Square Plate Washer 40 x 40 x 5mm - M10 HDG", hsCode: "7318220098", countryOfOrigin: "INDIA", packQty: 100, weightKg: 5.7, costGbp: 6.5, sourcingRate: 1.0 },
  { variantCode: "201701190", description: "Square Plate Washer 40 x 40 x 5mm - M12 HDG", hsCode: "7318220098", countryOfOrigin: "INDIA", packQty: 100, weightKg: 5.5, costGbp: 6.5, sourcingRate: 1.0 },
  { variantCode: "201706162", description: "Square Plate Washer 40 x 40 x 5mm - M16 HDG *", hsCode: "7318220098", countryOfOrigin: "INDIA", packQty: 100, weightKg: 5.4, costGbp: 6.5, sourcingRate: 1.0 },
  { variantCode: "321610699", description: "Torqx Hardwood Block FSC 95mm Long, 35mm Thick, 168mm (6\"), Single-Foiled *", hsCode: "", countryOfOrigin: "UK MANUFACTURED", packQty: 1, weightKg: 0.843, costGbp: 7.71, sourcingRate: 1.0 },
  { variantCode: "321712190", description: "Heavy Duty HD500 BUP Unlined Pipe Clip, (M8/M10) - 59-65mm - Walraven", hsCode: "7326909890", countryOfOrigin: "CZECH REPUBLIC", packQty: 1, weightKg: 0.225, costGbp: 2.86, sourcingRate: 1.0 },
  { variantCode: "321715949", description: "Heavy Duty HD500 BUP Unlined Pipe Clip, (M8/M10) -66-71mm - Walraven", hsCode: "7326909890", countryOfOrigin: "CZECH REPUBLIC", packQty: 1, weightKg: 0.237, costGbp: 2.94, sourcingRate: 1.0 },
  { variantCode: "321716827", description: "Heavy Duty HD500 BUP Unlined Pipe Clip, (M10/M12) -72-78mm - Walraven", hsCode: "7326909890", countryOfOrigin: "CZECH REPUBLIC", packQty: 1, weightKg: 0.292, costGbp: 3.07, sourcingRate: 1.0 },
  { variantCode: "322310974", description: "Fibre Pipe Joint Ring IBC Gasket (90mm ID, 142mm OD) PN10/PN16 - 80mm NB - 3\" Pipe", hsCode: "", countryOfOrigin: "UK SUPPLIER", packQty: 1, weightKg: 0.02, costGbp: 0.58, sourcingRate: 1.0 },
  { variantCode: "322310977", description: "Fibre Pipe Joint Ring IBC Gasket (169mm ID, 218mm OD) PN10/PN16 - 150mm NB - 6\" Pipe", hsCode: "", countryOfOrigin: "UK SUPPLIER", packQty: 1, weightKg: 0.03, costGbp: 1.33, sourcingRate: 1.0 },
  { variantCode: "322310978", description: "Fibre Pipe Joint Ring IBC Gasket (219mm ID, 273mm OD) PN10/PN16 - 200mm NB - 8\" Pipe", hsCode: "", countryOfOrigin: "UK SUPPLIER", packQty: 1, weightKg: 0.03, costGbp: 1.93, sourcingRate: 1.0 },
  { variantCode: "381903972", description: "JCP Lipped Wedge Anchors ZYP - M10 X 30mm *", hsCode: "", countryOfOrigin: "UK SUPPLIER", packQty: 100, weightKg: 1.7, costGbp: 6.5, sourcingRate: 1.0 },
  { variantCode: "381903979", description: "JCP Wedge Anchors ZYP - M12 x 50mm", hsCode: "", countryOfOrigin: "UK SUPPLIER", packQty: 100, weightKg: 5.2, costGbp: 13.16, sourcingRate: 1.0 },
  { variantCode: "381911780", description: "JCP Wedge Anchor Setting Tool C/W Hand Grip - M10", hsCode: "", countryOfOrigin: "UK SUPPLIER", packQty: 1, weightKg: 0.06, costGbp: 2.83, sourcingRate: 1.0 },
  { variantCode: "381912586", description: "JCP Wedge Anchor Setting Tool C/W Hand Grip - M12", hsCode: "", countryOfOrigin: "UK SUPPLIER", packQty: 1, weightKg: 0.062, costGbp: 2.94, sourcingRate: 1.0 },
  { variantCode: "381914122", description: "Fischer ETA Approved EAII Hammerset Lipped Wedge Anchor - M10 X 40", hsCode: "", countryOfOrigin: "GERMANY", packQty: 100, weightKg: 2.1, costGbp: 17.19, sourcingRate: 1.0 },
  { variantCode: "401413951", description: "HDG H.T. Hex Bolts  M20 X 70 *", hsCode: "7318158290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 2.16, costGbp: 31.0, sourcingRate: 1.2 },
  { variantCode: "401413952", description: "HDG H.T. Hex Bolts  M20 X 80*", hsCode: "7318158290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 22.5, costGbp: 33.93, sourcingRate: 1.2 },
  { variantCode: "401413953", description: "HDG H.T. Hex Bolts  M16 X 65 *", hsCode: "7318158290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 10.0, costGbp: 17.9, sourcingRate: 1.2 },
  { variantCode: "401414417", description: "HDG Hex Set Screws  M24 X 60 *", hsCode: "7318158290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 2.5, costGbp: 50.33, sourcingRate: 1.2 },
  { variantCode: "401417264", description: "HDG Hex Set Screws  M20 X 50 *", hsCode: "7318158290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 19.0, costGbp: 23.39, sourcingRate: 1.2 },
  { variantCode: "401417353", description: "HDG H.T. Hex Bolts  M20 X 100*", hsCode: "7318158290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 3.0, costGbp: 43.95, sourcingRate: 1.2 },
  { variantCode: "401417497", description: "* M20 x 75mm Hex Head HT Gr8.8 HDG Bolt*", hsCode: "7318158290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 2.36, costGbp: 40.4, sourcingRate: 1.2 },
  { variantCode: "401502841", description: "HDG Hex Set Screws  M10 X 25", hsCode: "7318158290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 2.54, costGbp: 3.97, sourcingRate: 1.2 },
  { variantCode: "401502842", description: "HDG Hex Set Screws  M10 X 30", hsCode: "7318158290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 2.74, costGbp: 4.25, sourcingRate: 1.2 },
  { variantCode: "401502843", description: "HDG Hex Set Screws  M10 X 40", hsCode: "7318158290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 3.0, costGbp: 4.48, sourcingRate: 1.2 },
  { variantCode: "401506468", description: "HDG Hex Set Screws  M12 X 60 *", hsCode: "7318158290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 5.0, costGbp: 11.8, sourcingRate: 1.2 },
  { variantCode: "401506473", description: "HDG Hex Set Screws  M16 x 40*", hsCode: "7318158290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 7.94, costGbp: 12.01, sourcingRate: 1.2 },
  { variantCode: "401506475", description: "HDG Hex Set Screws  M16 x 60*", hsCode: "7318158290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 8.0, costGbp: 16.35, sourcingRate: 1.2 },
  { variantCode: "401512149", description: "HDG Hex Set Screws  M10 X 20 *", hsCode: "7318158290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 2.38, costGbp: 3.65, sourcingRate: 1.2 },
  { variantCode: "401519280", description: "Torqx HDG Hex Set Screws  M10 X 30 - Pack of 100", hsCode: "7318158290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 2.74, costGbp: 4.2, sourcingRate: 1.2 },
  { variantCode: "401520767", description: "*HDG Hex Set Screws  M20 X 45*", hsCode: "7318158290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 19.0, costGbp: 23.0, sourcingRate: 1.2 },
  { variantCode: "401520922", description: "*HDG Hex Set Screws  M20 X 40*", hsCode: "7318158290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 2.0, costGbp: 22.73, sourcingRate: 1.2 },
  { variantCode: "401702996", description: "Hex Nut DIN 934 - HDG M10", hsCode: "7318169290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 1.0, costGbp: 1.51, sourcingRate: 1.0 },
  { variantCode: "401702997", description: "Hex Nut DIN 934 - HDG M12", hsCode: "7318169990", countryOfOrigin: "CHINA", packQty: 100, weightKg: 1.5, costGbp: 2.21, sourcingRate: 1.0 },
  { variantCode: "401702998", description: "Hex Nut DIN 934 - HDG M16", hsCode: "7318169990", countryOfOrigin: "CHINA", packQty: 100, weightKg: 2.9, costGbp: 3.59, sourcingRate: 1.0 },
  { variantCode: "401702999", description: "Hex Nut DIN 934 - HDG M20*", hsCode: "7318169990", countryOfOrigin: "CHINA", packQty: 100, weightKg: 5.4, costGbp: 9.88, sourcingRate: 1.0 },
  { variantCode: "401714418", description: "Hex Nut DIN 934 - HDG M24*", hsCode: "7318169990", countryOfOrigin: "CHINA", packQty: 100, weightKg: 6.0, costGbp: 17.68, sourcingRate: 1.0 },
  { variantCode: "401721093", description: "Torqx HDG Hex Nut - M10 - Pack of 100", hsCode: "7318169290", countryOfOrigin: "CHINA", packQty: 100, weightKg: 1.0, costGbp: 1.52, sourcingRate: 1.0 },
  { variantCode: "402003180", description: "HDG Studding 4.6gr - 3M Length M10", hsCode: "7318190090", countryOfOrigin: "CHINA", packQty: 1, weightKg: 1.83, costGbp: 2.39, sourcingRate: 1.0 },
  { variantCode: "402003181", description: "HDG Studding 4.6gr - 3M Length M12", hsCode: "7318190090", countryOfOrigin: "CHINA", packQty: 1, weightKg: 2.1, costGbp: 2.85, sourcingRate: 1.0 },
  { variantCode: "402003191", description: "Stud Hard Plastic Protection Caps - Black  M10", hsCode: "3923509000", countryOfOrigin: "UK MANUFACTURED", packQty: 100, weightKg: 0.07, costGbp: 0.9, sourcingRate: 1.0 },
  { variantCode: "402006486", description: "Stud Protection Caps - Black M16 - Length 25.4mm", hsCode: "3923509000", countryOfOrigin: "UK MANUFACTURED", packQty: 100, weightKg: 0.32, costGbp: 23.94, sourcingRate: 1.0 },
  { variantCode: "402011449", description: "HDG Studding 4.6gr - 3M Length M16 *", hsCode: "7318190090", countryOfOrigin: "CHINA", packQty: 1, weightKg: 3.8, costGbp: 3.68, sourcingRate: 1.0 },
  { variantCode: "402011708", description: "HDG Studding Connector M10 *", hsCode: "", countryOfOrigin: "CHINA", packQty: 100, weightKg: 4.0, costGbp: 17.6, sourcingRate: 1.0 },
  { variantCode: "402011715", description: "HDG Studding Connector M12 *", hsCode: "", countryOfOrigin: "CHINA", packQty: 100, weightKg: 8.0, costGbp: 25.5, sourcingRate: 1.0 },
  { variantCode: "402011866", description: "HDG Studding Connector M16 *", hsCode: "", countryOfOrigin: "CHINA", packQty: 100, weightKg: 11.9, costGbp: 43.0, sourcingRate: 1.0 },
  { variantCode: "402015397", description: "Stud Hard Plastic Protection Caps - Black  M12", hsCode: "3923509000", countryOfOrigin: "UK MANUFACTURED", packQty: 100, weightKg: 0.1, costGbp: 2.0, sourcingRate: 1.0 },
  { variantCode: "402203262", description: "Plain Washer - Form A - HDG M10", hsCode: "7318220098", countryOfOrigin: "CHINA", packQty: 100, weightKg: 0.3, costGbp: 0.95, sourcingRate: 1.2 },
  { variantCode: "402203263", description: "Plain Washer - Form A - HDG M12", hsCode: "7318220098", countryOfOrigin: "CHINA", packQty: 100, weightKg: 0.5, costGbp: 1.39, sourcingRate: 1.2 },
  { variantCode: "402203264", description: "Plain Washer - Form A - HDG M16", hsCode: "7318220098", countryOfOrigin: "CHINA", packQty: 100, weightKg: 1.1, costGbp: 2.4, sourcingRate: 1.2 },
  { variantCode: "402203265", description: "Plain Washer - Form A - HDG M20*", hsCode: "7318220098", countryOfOrigin: "CHINA", packQty: 100, weightKg: 1.5, costGbp: 2.86, sourcingRate: 1.2 },
  { variantCode: "402211493", description: "Penny Washer - HDG M12 X 30", hsCode: "7318220098", countryOfOrigin: "CHINA", packQty: 100, weightKg: 0.6, costGbp: 3.5, sourcingRate: 1.2 },
  { variantCode: "402214419", description: "Plain Washer - Form A - HDG M24 *", hsCode: "7318220098", countryOfOrigin: "CHINA", packQty: 100, weightKg: 2.0, costGbp: 6.72, sourcingRate: 1.2 },
  { variantCode: "402219286", description: "Torqx Penny Washer - HDG M10 X 25 - Pack of 100", hsCode: "7318220098", countryOfOrigin: "CHINA", packQty: 100, weightKg: 0.5, costGbp: 1.3, sourcingRate: 1.2 },
  { variantCode: "501204043", description: "Loctite 55 Pipe Sealing Tape -160m", hsCode: "", countryOfOrigin: "UK SUPPLIER", packQty: 1, weightKg: 0.12, costGbp: 8.49, sourcingRate: 1.0 },
  { variantCode: "501417449", description: "ZG-90 Premium Cold Galv Paint - 500ml Aerosol", hsCode: "", countryOfOrigin: "UK SUPPLIER", packQty: 1, weightKg: 0.51, costGbp: 5.73, sourcingRate: 1.0 },
];

const DUTY_RATES = [
  { hsCode: "7318158290", countryOfOrigin: "CHINA", taricDutyRate: 0.037, notes: "Hex bolts / set screws — standard TARIC." },
  { hsCode: "7318158290", countryOfOrigin: "INDIA", taricDutyRate: 0.037, notes: "Hex bolts from India — standard TARIC, no anti-dumping." },
  { hsCode: "7318158290", countryOfOrigin: "UK MANUFACTURED", taricDutyRate: 0, notes: "UK origin — zero duty under UK-EU TCA." },
  { hsCode: "7318169290", countryOfOrigin: "CHINA", taricDutyRate: 0.037, notes: "Hex nuts — standard TARIC." },
  { hsCode: "7318169290", countryOfOrigin: "INDIA", taricDutyRate: 0.037, notes: "Hex nuts from India." },
  { hsCode: "7318169990", countryOfOrigin: "CHINA", taricDutyRate: 0.037, notes: "Hex nuts (other) — TARIC." },
  { hsCode: "7318169990", countryOfOrigin: "INDIA", taricDutyRate: 0.037, notes: "Hex nuts (other) India." },
  { hsCode: "7318190090", countryOfOrigin: "CHINA", taricDutyRate: 0.037, notes: "Studding / threaded rod — TARIC." },
  { hsCode: "7318220098", countryOfOrigin: "CHINA", taricDutyRate: 0.037, notes: "Plain washers — TARIC." },
  { hsCode: "7318220098", countryOfOrigin: "INDIA", taricDutyRate: 0.037, notes: "Plain washers — India." },
  { hsCode: "7308909890", countryOfOrigin: "INDIA", taricDutyRate: 0, notes: "Channel brackets — India, 0%." },
  { hsCode: "7308909890", countryOfOrigin: "UK SUPPLIER", taricDutyRate: 0, notes: "UK supplied steel items — 0%." },
  { hsCode: "7326909890", countryOfOrigin: "CHINA", taricDutyRate: 0.027, notes: "Misc steel articles — TARIC." },
  { hsCode: "7326909890", countryOfOrigin: "CZECH REPUBLIC", taricDutyRate: 0.027, notes: "Walraven clips — EU origin." },
  { hsCode: "3923509000", countryOfOrigin: "UK MANUFACTURED", taricDutyRate: 0.065, notes: "Plastic fittings — UK origin, 6.5% TARIC." },
  { hsCode: "3923509000", countryOfOrigin: "UK SUPPLIER", taricDutyRate: 0.065, notes: "Plastic caps via UK distributor — 6.5% TARIC." },
];

const ASSUMPTIONS = {
  transportRatePerKg: 1.0,
  cbamRateEurPerTonneCo2: 5.2,
  cbamEmissionsFactorTco2PerTonne: 74,
  defaultGrossMargin: 0.35,
  sourcingMarkupChina: 1.2,
  updatedBy: 'seed',
  updatedAt: new Date().toISOString()
};

async function seed() {
  console.log('Starting Firestore seed...\n');

  await db.collection('landedcost-config').doc('assumptions').set(ASSUMPTIONS);
  console.log('✓ Assumptions written');

  let dutyCount = 0;
  for (const rate of DUTY_RATES) {
    await db.collection('landedcost-dutyRates').add({ ...rate, createdBy: 'seed', createdAt: new Date().toISOString() });
    dutyCount++;
  }
  console.log(`✓ ${dutyCount} duty rates written`);

  let skuCount = 0;
  for (const sku of SKUS) {
    await db.collection('landedcost-skus').add({ ...sku, ukMarginOverride: null, euMarginOverride: null, createdBy: 'seed', createdAt: new Date().toISOString() });
    skuCount++;
    if (skuCount % 10 === 0) console.log(`  ${skuCount}/${SKUS.length} SKUs written...`);
  }
  console.log(`✓ ${skuCount} SKUs written`);

  console.log('\nSeed complete. Open the app and check the SKU Master tab.');
  process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });

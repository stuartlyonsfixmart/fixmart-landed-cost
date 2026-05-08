# Fixmart Landed Cost Calculator

GmbH intercompany transfer pricing tool.

## Environment Variables

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret |
| `GOOGLE_REDIRECT_URI` | `https://YOUR-SERVICE-URL/auth/callback` |
| `ALLOWED_EMAILS` | Comma-separated permitted Google emails |
| `SESSION_SECRET` | Any long random string |
| `FX_API_KEY` | ExchangeRate-API key (free at exchangerate-api.com) |
| `GOOGLE_CLOUD_PROJECT` | `fixmart-bi` |

## Firestore Collections
- `skus` — SKU master
- `dutyRates` — TARIC duty rate table
- `config/assumptions` — model assumptions
- `assumptionsLog` — audit log
- `transfers` — saved transfer orders

## Deploy
```bash
gcloud builds submit --tag gcr.io/fixmart-bi/fixmart-landed-cost
gcloud run deploy fixmart-landed-cost --image gcr.io/fixmart-bi/fixmart-landed-cost --platform managed --region europe-west2 --allow-unauthenticated
```

## First-time Firestore setup
GCP Console → Firestore → Create database → Native mode → europe-west2

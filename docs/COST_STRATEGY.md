# VarA — Budget Strategy & Security Architecture

**Supplements:** VarA MVP PRD v1.0

---

## Critical: Do NOT Use Netlify AI Gateway

Netlify free tier: **180 credits per $1 USD** on AI Gateway. 300 credits = $1.67 max before site pauses.

**Correct architecture:** Netlify Function → direct HTTPS to Google AI Studio using env var keys. Compute credits only (negligible).

---

## Netlify Credit Budget

| Activity | Est. Monthly (77 sessions) | Credits |
|----------|----------------------------|---------|
| Production deploys | 5 deploys | 75 |
| Web requests | ~770 | 0.23 |
| Bandwidth | 0.054GB | 0.54 |
| Compute (functions) | 77 × 6 calls | ~0.3 |
| AI inference | **NOT USED** | **0** |
| **Total** | | **~76 of 300** |

---

## Security

- API keys in **Netlify env vars only** — never client, never committed
- Single endpoint: `/.netlify/functions/generate`
- Three rate limits: Firewall (5/min IP), guest cookie (1), Blobs counter (3 lifetime)
- Auth: Netlify Identity (JWT verified in functions)
- Storage: Netlify Blobs (server-side only)

---

## $20 Budget Allocation

| Allocation | Amount |
|------------|--------|
| Development & testing | $2.00 |
| Production | $18.00 |
| **Total** | **$20.00** |

---

*Supplementary to VarA MVP PRD v1.0*

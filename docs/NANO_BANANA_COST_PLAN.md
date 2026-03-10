# VarA — Nano Banana Cost Breakdown & Trial System

**Replaces:** Section 17A of the PRD | **Based on:** Verified March 2026 pricing

---

## What "Nano Banana" Is

Nano Banana = **Google's Gemini image generation models** via Google AI Studio API:
- **Nano Banana 2** = Gemini 3.1 Flash Image (faster, cheaper, #1 on text-to-image benchmarks)
- **Nano Banana Pro** = Gemini 3 Pro Image (flagship, higher cost)

**VarA uses Nano Banana 2** — optimal for pencil + watercolor fashion illustration prompts.

---

## Nano Banana 2 Pricing (March 2026)

| Resolution | Standard API | Best for VarA |
|------------|--------------|---------------|
| 512px      | $0.045       | **Yes — optimal** |
| 1K         | $0.067       | Good quality bump |
| 4K         | $0.151       | Unnecessary |

**Batch API** is 50% off but 24hr delay — not suitable. VarA uses Standard API.

---

## Cost Per Session

| Component | Cost |
|-----------|------|
| 5 × images at 512px | $0.045 × 5 = **$0.225** |
| 1 × text call (5 Style Analysis blocks) | ~**$0.008** |
| **Total** | **~$0.233** |

Same Google AI Studio API key for both image and text.

---

## $20 Budget

| Allocation | Amount | Sessions |
|------------|--------|----------|
| Dev & QA testing | $2.00 | ~8 |
| Production | $18.00 | **~77** |

---

## Trial System

| User Type | Free Generations | Lifetime Cap |
|-----------|------------------|--------------|
| Guest | **1** | 1 |
| Registered | **2 more = 3 total** | 3 |

**~40–60 users** fully served within $20. Suitable for closed invite beta.

---

## Do NOT Use Netlify AI Gateway

Netlify AI Gateway = 180 credits per $1 USD. Would exhaust 300 credits at $1.67 usage. Call Google AI Studio **directly** from Netlify Function.

---

*Supplements VarA MVP PRD v1.0*

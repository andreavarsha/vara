# VarA — Product Requirements Document (MVP)

**Version:** 2.1 | **Date:** March 2026 | **Status:** Confirmed & Ready to Build

---

## 1. Product Overview

VarA is a lightweight AI fashion discovery app that helps users find on-trend dress ideas tailored to their occasion and personal profile. The name carries three layers: *Variation A* (the best first iteration), *Vara* (the historical Spanish measuring stick for fabric), and the Sanskrit *Vara* (a gift or blessing). Together they signal a tool that is both technically precise and creatively generous.

The core experience is simple: a user answers three quick questions and receives five distinct dress design concepts — each a pencil-and-watercolor style sketch paired with a short trend analysis. All AI generation is powered internally; users interact with **VarA** as the sole brand throughout the experience. The underlying image model (Nano Banana 2 / Google Gemini 3.1 Flash Image) is attributed in the app footer only.

The MVP is strictly a **trend suggestion and inspiration product**. Sewing instructions, pattern generation, and materials sourcing are Phase 2.

---

## 2. Problem Statement

Fashion-aware users — particularly those who sew, create mood boards, or simply want outfit inspiration — have no fast, personalized way to discover what dress silhouettes are currently on-trend for their specific occasion and demographic. Existing tools (Pinterest, Vogue, AI chatbots) are either too broad, too slow, or require fashion expertise to filter well. VarA removes the friction: three inputs, five tailored suggestions, zero fashion knowledge required.

---

## 3. User Goal and Value Proposition

**User goal:** "Show me five distinct dress ideas that are actually trending right now and make sense for my life."

**Value proposition:**
- Trend-matched results in under 60 seconds
- Five visually distinct silhouettes — not five versions of the same look
- AI-generated sketch visuals that feel like a designer's concept board, not stock photos
- Zero fashion vocabulary required to get meaningful output
- Free to try — no account needed for first look

---

## 4. Target Users

**Primary:** Women aged 16–45 who have an interest in fashion, make their own clothes, or want dress inspiration for a specific event. Comfortable with AI tools. May not have formal fashion training.

**Secondary:** Hobby sewists who want trend direction before choosing a project. Phase 2 will serve this group more deeply.

**Not a target for MVP:** Professional fashion designers, retailers, or users seeking technical pattern-making tools.

---

## 5. MVP Scope

The MVP contains exactly **one feature area**: trend-based dress suggestion, with a lightweight account layer to enable saving looks and additional trial sessions.

### 5.1 What the MVP Does
- Accepts three user inputs: Occasion (required), Age Range (required), Material (**optional — clearly labelled in UI**)
- Sends those inputs to a backend serverless function that constructs the AI prompt using system instructions from the JSON schema
- Returns 5 dress design suggestions, each containing:
  - An AI-generated pencil/watercolor sketch image (Nano Banana 2 at 512px, 3:4 ratio)
  - A 2026 Style Analysis (2 sentences)
  - Trend Evidence keywords
  - The silhouette label
  - A **Save / Like button** on each card (heart icon — triggers account gate for guests)
- Each of the 5 results must feature a **different silhouette** from the canonical set (see Section 11)
- The app works correctly whether or not Material is provided
- Guests receive **1 free generation** with no account required
- Guests can see the Save button on cards but clicking it triggers the account gate
- After the guest generation, users are prompted to create a free account to save individual cards they like and unlock 2 more sessions (3 total)

### 5.2 Single-Page Flow
The MVP is a single-page app (SPA): input form on landing, results rendered below on the same page. Account creation is triggered by a soft modal gate after the first guest generation, not a hard wall before use.

---

## 6. Out of Scope for MVP

- DIY sewing instructions
- Step-by-step construction guides
- Materials/notions shopping lists
- Machine sewing blocks or tutorial flows
- Pattern downloads or measurements
- Social sharing
- Multiple outfit categories beyond dresses
- Admin dashboard or trend management UI

> **Note:** Basic user accounts, saved looks, and a "My Looks" view **are** in scope for MVP.

---

## 7. Functional Requirements (Key)

| ID | Requirement |
|----|-------------|
| FR-01 | User must select one Occasion and one Age Range; Material is optional |
| FR-02 | Generate button disabled until required fields filled |
| FR-03 | Backend constructs prompt from JSON system instructions; all output branded as VarA |
| FR-04 | All 5 outputs use different silhouettes from canonical set; dresses only |
| FR-05 | Guest: 1 free generation. Registered: 3 total (1 + 2 post-signup) |
| FR-06 | Heart icon: guest = account gate; registered = save/unsave to My Saved Designs |
| FR-07 | API key in Netlify env only; never client-side |
| FR-08 | Generation count in Netlify Blobs; server-validated |

---

## 8. Canonical Silhouettes (7 options, 5 per generation)

1. **A-Line** — fitted bodice, flared skirt
2. **Wrap** — V-neckline, tied waist
3. **Column / Sheath** — straight, close-fitting
4. **Slip Dress** — thin-strap, bias-cut
5. **Bubble Hem / Mini** — short with gathered puff hem
6. **Midi Flare** — knee-to-ankle, flared skirt
7. **Shirt Dress** — collared, button-through

---

## 9. UX/UI Direction

**Colors:** Primary #005C5C, Secondary #A2CFFE, Accent #F024B3, Base #F5F5F5, Text #2D2926

**Loading:** Iridescent gradient (Mermaidcore); copy: "VarA is designing your looks..."

**Typography:** Serif for headings; neo-grotesque for body/dropdowns

**Components:** Glassmorphism, pill buttons, 2-column card grid (mobile: single column)

**Footer:** "Powered by Nano Banana" — only place Nano Banana appears

---

## 10. Error States

| Scenario | Behavior |
|----------|----------|
| Image fails for 1 of 5 | SVG placeholder for that card |
| Image fails for all 5 | Text cards + "Sketches unavailable" notice |
| $20 budget cap | Text-only mode; "Sketch previews paused" |
| Full API failure | "VarA is taking a moment" + Retry |
| Guest taps heart | Account gate modal |
| Guest 2nd generation | Account gate modal |
| Registered 3 used | "You've curated 3 concept boards" + My Saved Designs |

---

## 11. Stack & Cost

- **Google AI Studio:** Nano Banana 2 + Gemini 3.1 Flash text | $20 cap
- **Netlify:** Hosting, functions, Identity, Blobs | Free plan
- **~$0.233/session** → ~77 production sessions from $18

---

*VarA MVP PRD v2.1 — User-facing brand: VarA only | Attribution: "Powered by Nano Banana" in footer*

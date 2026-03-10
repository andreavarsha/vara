# VarA Planning & Reference

This folder contains the product and technical plans for VarA. **Reference these when building, debugging, or extending the app.**

## Plan Files

| File | Purpose |
|------|---------|
| **MVP_PRD.md** | Full Product Requirements Document — scope, user flows, functional requirements, silhouettes, UX direction |
| **NANO_BANANA_COST_PLAN.md** | Cost breakdown, trial system, Google Gemini image pricing |
| **COST_STRATEGY.md** | Budget allocation, Netlify architecture, security |

## Quick Reference

- **Stack:** Google AI Studio (Nano Banana 2 + Gemini Flash) + Netlify (Functions, Identity, Blobs)
- **Trial:** 1 guest generation, 3 total for registered users
- **Brand:** VarA only in UI; "Powered by Nano Banana" in footer only
- **API key:** `GOOGLE_AI_API_KEY` in Netlify env / `.env` locally — never client-side

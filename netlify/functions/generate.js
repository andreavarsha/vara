import { GoogleGenAI } from '@google/genai/node';
import { getStore } from '@netlify/blobs';
// netlify dev automatically injects .env — no dotenv needed

const SCHEMA = {
  occasions: [
    { value: 'Casual', system_instruction: "Focus on 'Lightweight Structure' and 'Quiet Luxury'. Use organic cotton poplins or linens for breathable, clean silhouettes like the midi wrap or shift dress." },
    { value: 'Date Night', system_instruction: "Apply the '90s Redux' and 'Romantic Sensuality' trends. Prioritize open backs, plunging necklines, and tactile fabrics like satin or lace." },
    { value: 'Vintage', system_instruction: "Blend 20s/30s 'Retro-Fit Florals' with 80s 'Exaggerated Proportions'. Think lace-trimmed slip dresses or dresses with bubble hems and puff sleeves." },
    { value: 'Girls Night', system_instruction: "Execute 'Maximalist Energy' and 'Bold Block Colours'. Focus on high-visibility dresses: bodycon styles, metallic sheens, or vibrant 'Primary Palettes'." },
  ],
  age_ranges: [
    { value: 'Early Teens', system_instruction: "Focus on 'Whimsical Volume' and 'Sporty References'. Use playful bubble hems, tiered ruffles, and oversized, comfy silhouettes." },
    { value: 'Late Teens', system_instruction: "Prioritize 'Expressive Patterns' and 'Y2K Revival'. Design with bold dots, 'Little House on the Prairie' ditsy florals, and daring cut-outs." },
    { value: '20s', system_instruction: "Blend 'Minimalist Sophistication' with 'Modern Flare'. Focus on versatile day-to-night slip dresses and sleek column silhouettes." },
    { value: '30s', system_instruction: "Focus on 'Timeless Leadership' and 'Material Honesty'. Prioritize high-quality tailoring, structured cottons, and refined geometric necklines." },
    { value: '40+', system_instruction: "Master 'Quiet Luxury' and 'Refined Elegance'. Use sophisticated draping, midi lengths, and luxurious fabrics that age well." },
  ],
  materials: [
    { value: 'Viscose', system_instruction: "Use for 'Fluid Textures'. Design dresses with soft drapes and resort-wear flow." },
    { value: 'Cotton', system_instruction: "Use 'Lightweight Structured Cotton' (Poplin/Voile) for architectural but breathable dresses." },
    { value: 'Linen', system_instruction: "The 'Climate-Conscious Hero'. Use for rustic, honest textures in A-line or wrap styles." },
    { value: 'Lace', system_instruction: "Apply as 'Romantic Excellence'. Use for sheer overlays, statement panels, or delicate trims." },
    { value: 'Denim', system_instruction: "Focus on 'Sophisticated Denim Tailoring'. Use dark indigo or raw 'Brut' denim for structured, polished dresses." },
    { value: 'Satin', system_instruction: "Focus on 'Liquid Shine'. Best for vintage-inspired slip dresses and evening glam." },
  ],
  silhouettes: ['A-Line', 'Wrap', 'Column', 'Slip Dress', 'Bubble Hem', 'Midi Flare', 'Shirt Dress'],
};

const TEXT_MODEL = 'gemini-3.1-flash-lite-preview';

function pick5Silhouettes(occasion) {
  const all = [...SCHEMA.silhouettes];
  const prefs = {
    'Date Night': ['Column', 'Slip Dress', 'Wrap', 'Midi Flare', 'A-Line'],
    'Girls Night': ['Bubble Hem', 'Column', 'Slip Dress', 'A-Line', 'Wrap'],
    'Casual': ['A-Line', 'Wrap', 'Midi Flare', 'Shirt Dress', 'Slip Dress'],
    'Vintage': ['Slip Dress', 'Bubble Hem', 'Midi Flare', 'Wrap', 'A-Line'],
  };
  const preferred = prefs[occasion] || all;
  const selected = [];
  for (const s of preferred) {
    if (selected.length >= 5) break;
    if (all.includes(s)) selected.push(s);
  }
  while (selected.length < 5) {
    const remaining = all.filter((s) => !selected.includes(s));
    if (remaining.length === 0) break;
    selected.push(remaining[0]);
  }
  return selected.slice(0, 5);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function getUserFromContext(event, context) {
  try {
    const raw = context?.clientContext?.custom?.netlify;
    if (!raw) return null;
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    const { user } = JSON.parse(decoded);
    return user ? { id: user.id || user.sub, email: user.email } : null;
  } catch {
    return null;
  }
}

function jsonResponse(statusCode, data) {
  return { statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}

export const handler = async (event, context) => {
  try {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
    if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method Not Allowed' });

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_AI_API_KEY not set');
      return jsonResponse(500, { error: 'Server configuration error' });
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON' });
    }

    const serverUser = getUserFromContext(event, context);
    const { occasion, ageRange, material, guestId, userId: bodyUserId } = body;
    const userId = serverUser?.id || bodyUserId;

    if (!occasion || !ageRange) return jsonResponse(400, { error: 'Occasion and age range are required' });

    const occ = SCHEMA.occasions.find((o) => o.value === occasion);
    const age = SCHEMA.age_ranges.find((a) => a.value === ageRange);
    const mat = material && material !== 'No preference' ? SCHEMA.materials.find((m) => m.value === material) : null;

    if (!occ || !age) return jsonResponse(400, { error: 'Invalid occasion or age range' });

    // Track usage in Blobs (optional — falls back gracefully)
    const userKey = userId || `guest_${guestId}`;
    let userData = { count: 0, savedCards: [] };
    let store = null;
    try {
      store = getStore('vara-users');
      const raw = await store.get(userKey);
      userData = raw ? JSON.parse(raw) : { count: 0, savedCards: [] };
    } catch (e) {
      console.warn('Blobs unavailable, using in-memory fallback:', e.message);
    }

    const silhouettes = pick5Silhouettes(occasion);
    const ai = new GoogleGenAI({ apiKey });

    // --- TEXT GENERATION ONLY (images fetched separately per card) ---
    let textCards = silhouettes.map((s) => ({
      silhouette: s,
      styleAnalysis: 'This dress aligns with March 2026 fashion trends.',
      trendEvidence: ['2026 Trends', 'Editorial Style'],
    }));

    try {
      const textPrompt = `You are a fashion analyst. For each of these 5 dress silhouettes, provide exactly:
1. styleAnalysis: 2 sentences explaining why this dress is trending in March 2026.
2. trendEvidence: 2-4 specific 2026 trend keywords (e.g., "Brut Denim," "90s Redux," "Quiet Luxury").

Silhouettes: ${silhouettes.join(', ')}
Occasion context: ${occ.system_instruction}
Age context: ${age.system_instruction}
${mat ? `Material context: ${mat.system_instruction}` : ''}

Return a JSON array of 5 objects: [{ "silhouette": "...", "styleAnalysis": "...", "trendEvidence": ["..."] }]`;

      const resp = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: textPrompt,
        config: { maxOutputTokens: 1024, responseMimeType: 'application/json' },
      });

      const raw = resp?.text?.trim() || '';
      const start = raw.indexOf('[');
      const end = raw.lastIndexOf(']') + 1;
      const parsed = start >= 0 && end > start ? JSON.parse(raw.slice(start, end)) : [];
      if (parsed.length > 0) {
        textCards = parsed;
        while (textCards.length < 5) {
          textCards.push({ silhouette: silhouettes[textCards.length] || 'Dress', styleAnalysis: 'This design reflects current 2026 trends.', trendEvidence: ['Quiet Luxury', '2026 Trends'] });
        }
      }
    } catch (err) {
      console.error('Text generation failed:', err.message);
      // textCards already set to defaults above
    }

    // Increment usage count
    userData.count = (userData.count || 0) + 1;
    if (store) {
      try { await store.set(userKey, JSON.stringify(userData)); } catch (e) { console.warn('Blobs write failed:', e.message); }
    }

    // Build cards WITHOUT images — images will be fetched separately per card
    const cards = silhouettes.map((sil, i) => {
      const tc = textCards[i] || {};
      return {
        silhouette: tc.silhouette || sil,
        styleAnalysis: tc.styleAnalysis || '',
        trendEvidence: tc.trendEvidence || [],
        occasion,
        ageRange,
        material: material || null,
        // Pass prompt context so the frontend can call generate-image
        imagePromptContext: { occasion, ageRange, material: material || null, silhouette: sil },
      };
    });

    return jsonResponse(200, {
      cards,
      generationCount: userData.count,
      limitReached: false,
      imageGenFailed: false,
    });

  } catch (err) {
    console.error('Generate function error:', err);
    return jsonResponse(500, { error: err.message || 'Something went wrong. Please try again.' });
  }
};

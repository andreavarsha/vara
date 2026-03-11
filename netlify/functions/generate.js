import { GoogleGenAI } from '@google/genai/node';
import { getStore } from '@netlify/blobs';
// netlify dev automatically injects .env — no dotenv needed

const SCHEMA = {
  occasions: [
    { value: 'Casual', system_instruction: "Design a relaxed yet polished everyday dress. Think clean silhouettes in neutral or earthy tones — ivory, sand, sage, warm grey. Breathable fabrics, minimal detailing. The dress should look effortlessly put-together, not costumey." },
    { value: 'Date Night', system_instruction: "Design a sophisticated, sensual evening dress. Think satin, lace or structured crepe in deep jewel tones — burgundy, midnight navy, champagne, or classic black. Open backs, delicate straps, or a subtle slit are welcome. Elegant and wearable." },
    { value: 'Vintage', system_instruction: "Design a vintage-inspired dress that feels nostalgic but wearable today. Think 1970s wrap silhouettes, 1950s full skirts, or 1960s shift dresses. Soft florals, polka dots on neutral bases, or warm earthy tones. Nothing costume-like." },
    { value: 'Girls Night', system_instruction: "Design a chic, confidence-boosting night-out dress that women would actually want to wear. Think fitted bodycon or mini lengths in satin, velvet or sequin fabric. Solid jewel tones — emerald, deep red, cobalt, champagne — or subtle metallic finishes. Clean silhouette, tasteful neckline. NOT loud prints, NOT multiple clashing colours, NOT fantasy or maximalist patterns." },
  ],
  age_ranges: [
    { value: 'Early Teens', system_instruction: "Design a fun, age-appropriate dress for a young teenager. Modest hemlines at or below the knee, playful but tasteful colours — pastels, soft brights. Simple silhouettes like A-line or skater. Nothing revealing." },
    { value: '16+', system_instruction: "Design a youthful, stylish dress for a 16–19 year old. Mini to midi lengths are fine. Fresh, modern colours — dusty rose, cream, sky blue, soft lilac. Clean lines with one fun detail like a ruffle hem or bow tie. Trendy but wearable, not revealing." },
    { value: '20s', system_instruction: "Design a versatile, fashion-forward dress for a woman in her 20s. Sleek silhouettes that work for multiple occasions. Neutral or muted tones with one statement element. Contemporary and polished." },
    { value: '30s', system_instruction: "Design a refined, confident dress for a woman in her 30s. High-quality feel — structured cotton, silk or crepe. Midi lengths, geometric or wrap necklines. Sophisticated colour palette: camel, rust, forest green, navy." },
    { value: '40+', system_instruction: "Design an elegant, timeless dress for a woman 40+. Midi to maxi lengths, luxurious draping, quality fabrics. Understated, refined colour palette — cream, dusty rose, deep teal, charcoal. Sophisticated without being conservative." },
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
    if (selected.length >= 4) break;
    if (all.includes(s)) selected.push(s);
  }
  while (selected.length < 4) {
    const remaining = all.filter((s) => !selected.includes(s));
    if (remaining.length === 0) break;
    selected.push(remaining[0]);
  }
  return selected.slice(0, 4);
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

    // --- IP-based rate limiting (max 3 generations per IP) ---
    const MAX_PER_IP = 3;
    const clientIp =
      event.headers['x-nf-client-connection-ip'] ||
      event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      'unknown';

    let ipData = { count: 0 };
    let store = null;
    try {
      store = getStore('vara-ip-limits');
      const raw = await store.get(clientIp);
      ipData = raw ? JSON.parse(raw) : { count: 0 };
    } catch (e) {
      console.warn('Blobs unavailable for IP limiting:', e.message);
      // If Blobs isn't available, we can't enforce limits — allow the request
    }

    if (store && ipData.count >= MAX_PER_IP) {
      return jsonResponse(429, {
        error: 'You have used your 3 free generations. Sign in to continue.',
        limitReached: true,
      });
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
      const textPrompt = `You are a fashion analyst. For each of these 4 dress silhouettes, provide exactly:
1. styleAnalysis: 2 sentences explaining why this design is trending in 2026.
2. trendEvidence: 2-4 specific 2026 trend keywords (e.g., "Brut Denim," "90s Redux," "Quiet Luxury").

Silhouettes: ${silhouettes.join(', ')}
Occasion context: ${occ.system_instruction}
Age context: ${age.system_instruction}
${mat ? `Material context: ${mat.system_instruction}` : ''}

Return a JSON array of 4 objects: [{ "silhouette": "...", "styleAnalysis": "...", "trendEvidence": ["..."] }]`;

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
        while (textCards.length < 4) {
          textCards.push({ silhouette: silhouettes[textCards.length] || 'Dress', styleAnalysis: 'This design reflects current 2026 trends.', trendEvidence: ['Quiet Luxury', '2026 Trends'] });
        }
      }
    } catch (err) {
      console.error('Text generation failed:', err.message);
      // textCards already set to defaults above
    }

    // Increment IP count after successful generation
    ipData.count = (ipData.count || 0) + 1;
    if (store) {
      try { await store.set(clientIp, JSON.stringify(ipData)); } catch (e) { console.warn('Blobs write failed:', e.message); }
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
        imagePromptContext: { occasion, ageRange, material: material || null, silhouette: sil },
      };
    });

    return jsonResponse(200, {
      cards,
      generationCount: ipData.count,
      generationsLeft: Math.max(0, MAX_PER_IP - ipData.count),
      limitReached: ipData.count >= MAX_PER_IP,
      imageGenFailed: false,
    });

  } catch (err) {
    console.error('Generate function error:', err);
    return jsonResponse(500, { error: err.message || 'Something went wrong. Please try again.' });
  }
};

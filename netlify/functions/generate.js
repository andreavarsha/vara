import { GoogleGenAI } from '@google/genai/node';
import { getStore } from '@netlify/blobs';
// Note: netlify dev automatically injects .env variables — no dotenv needed here.

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

const IMAGE_MODEL = 'gemini-2.0-flash-preview-image-generation';
const TEXT_MODEL = 'gemini-2.0-flash';

function pick5Silhouettes(occasion, ageRange) {
  const all = [...SCHEMA.silhouettes];
  const occasionPrefs = {
    'Date Night': ['Column', 'Slip Dress', 'Wrap', 'Midi Flare', 'A-Line'],
    'Girls Night': ['Bubble Hem', 'Column', 'Slip Dress', 'A-Line', 'Wrap'],
    'Casual': ['A-Line', 'Wrap', 'Midi Flare', 'Shirt Dress', 'Slip Dress'],
    'Vintage': ['Slip Dress', 'Bubble Hem', 'Midi Flare', 'Wrap', 'A-Line'],
  };
  const preferred = occasionPrefs[occasion] || all;
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

function buildImagePrompt(silhouette, occasionInst, ageInst, materialInst) {
  const base = `Professional pencil and watercolor fashion sketch, white background, editorial illustration.
Design a ${silhouette} dress. ${occasionInst} ${ageInst}${materialInst ? ` ${materialInst}` : ''}
Dress only. No trousers, no jumpsuits, no two-piece, no separates.`;
  return base;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function getUserIdFromContext(event, context) {
  try {
    const raw = context?.clientContext?.custom?.netlify;
    if (!raw) return null;
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    const { user } = JSON.parse(decoded);
    return user?.id || user?.sub;
  } catch {
    return null;
  }
}

function jsonResponse(statusCode, data) {
  return { statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}

export const handler = async (event, context) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: corsHeaders, body: '' };
    }
    if (event.httpMethod !== 'POST') {
      return jsonResponse(405, { error: 'Method Not Allowed' });
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
    console.error('GOOGLE_AI_API_KEY not set');
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON' });
    }

    const serverUserId = getUserIdFromContext(event, context);
    const { occasion, ageRange, material, guestId, userId: bodyUserId } = body;
    const userId = serverUserId || bodyUserId;
    if (!occasion || !ageRange) {
      return jsonResponse(400, { error: 'Occasion and age range are required' });
    }

    const occ = SCHEMA.occasions.find((o) => o.value === occasion);
    const age = SCHEMA.age_ranges.find((a) => a.value === ageRange);
    const mat = material && material !== 'No preference' ? SCHEMA.materials.find((m) => m.value === material) : null;

    if (!occ || !age) {
      return jsonResponse(400, { error: 'Invalid occasion or age range' });
    }

    const userKey = userId || `guest_${guestId}`;
    let userData;
    let store = null;
    try {
      store = getStore('vara-users');
      const raw = await store.get(userKey);
      userData = raw ? JSON.parse(raw) : { count: 0, savedCards: [] };
    } catch (storeErr) {
      console.error('Blobs store error (using fallback):', storeErr.message);
      userData = { count: 0, savedCards: [] };
    }

    const maxGen = userId ? 3 : 1;
    if (userData.count >= maxGen) {
      return jsonResponse(429, { error: 'Trial limit reached', limitReached: true, isGuest: !userId });
    }

  const silhouettes = pick5Silhouettes(occasion, ageRange);

  const ai = new GoogleGenAI({ apiKey });
  let textCards = [];
  let images = [];
  let imageGenFailed = false;

  const textPrompt = `You are a fashion analyst. For each of these 5 dress silhouettes, provide exactly:
1. styleAnalysis: 2 sentences explaining why this dress is trending in March 2026.
2. trendEvidence: 2-4 specific 2026 trend keywords (e.g., "Brut Denim," "90s Redux," "Quiet Luxury").

Silhouettes: ${silhouettes.join(', ')}
Occasion context: ${occ.system_instruction}
Age context: ${age.system_instruction}
${mat ? `Material context: ${mat.system_instruction}` : ''}

Return a JSON array of 5 objects: [{ "silhouette": "...", "styleAnalysis": "...", "trendEvidence": ["..."] }]`;

  try {
    const textResp = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: textPrompt,
      config: { maxOutputTokens: 1024, responseMimeType: 'application/json' },
    });

    const textStr = textResp?.text?.trim() || '';
    if (!textStr) {
      console.warn('AI returned empty text response, using defaults');
      textCards = silhouettes.map((s) => ({
        silhouette: s,
        styleAnalysis: 'This dress aligns with March 2026 fashion trends.',
        trendEvidence: ['2026 Trends', 'Editorial Style'],
      }));
    } else {
      const start = textStr.indexOf('[');
      const end = textStr.lastIndexOf(']') + 1;
      const jsonStr = start >= 0 && end > start ? textStr.slice(start, end) : '[]';
      try {
        textCards = JSON.parse(jsonStr);
      } catch (parseErr) {
        console.error('Failed to parse AI JSON:', jsonStr);
        throw parseErr;
      }
    }

    while (textCards.length < 5) {
      textCards.push({
        silhouette: silhouettes[textCards.length] || 'Dress',
        styleAnalysis: 'This design reflects current March 2026 trends.',
        trendEvidence: ['Quiet Luxury', '2026 Trends'],
      });
    }
  } catch (err) {
    console.error('Text generation failed:', err);
    textCards = silhouettes.map((s) => ({
      silhouette: s,
      styleAnalysis: 'This dress aligns with March 2026 fashion trends.',
      trendEvidence: ['2026 Trends', 'Editorial Style'],
    }));
  }

  const imgPromptBase = buildImagePrompt(
    '',
    occ.system_instruction,
    age.system_instruction,
    mat?.system_instruction
  );

  for (let i = 0; i < 5; i++) {
    const sil = silhouettes[i];
    const prompt = buildImagePrompt(sil, occ.system_instruction, age.system_instruction, mat?.system_instruction);

    try {
      const resp = await ai.models.generateImages({
        model: IMAGE_MODEL,
        prompt,
        config: { numberOfImages: 1, outputMimeType: 'image/jpeg' },
      });

      const imgData = resp?.generatedImages?.[0]?.image?.imageBytes;
      if (imgData) {
        images.push({
          silhouette: sil,
          base64: imgData,
          mimeType: 'image/jpeg',
        });
      } else {
        console.warn(`Image ${i}: no image bytes returned`, resp?.generatedImages?.[0]?.raiFilteredReason);
        images.push({ silhouette: sil, base64: null, error: true });
        imageGenFailed = true;
      }
    } catch (err) {
      console.error(`Image ${i} failed:`, err.message);
      if (err.status === 402 || err.message?.includes('quota') || err.message?.includes('billing')) {
        imageGenFailed = true;
        for (let j = i; j < 5; j++) {
          images.push({ silhouette: silhouettes[j], base64: null, error: true });
        }
        break;
      }
      images.push({ silhouette: sil, base64: null, error: true });
      imageGenFailed = true;
    }
  }

    userData.count = (userData.count || 0) + 1;
    if (store) {
      try {
        await store.set(userKey, JSON.stringify(userData));
      } catch (storeErr) {
        console.error('Blobs set error:', storeErr.message);
      }
    }

    const cards = silhouettes.map((sil, i) => {
    const tc = textCards[i] || {};
    const img = images[i] || {};
    return {
      silhouette: tc.silhouette || sil,
      styleAnalysis: tc.styleAnalysis || '',
      trendEvidence: tc.trendEvidence || [],
      imageBase64: img.base64 || null,
      imageError: img.error || false,
      occasion,
      ageRange,
      material: material || null,
    };
  });

    return jsonResponse(200, {
      cards,
      imageGenFailed,
      generationCount: userData.count,
      limitReached: userData.count >= maxGen,
    });
  } catch (err) {
    console.error('Generate function error:', err);
    return jsonResponse(500, {
      error: err.message || 'Something went wrong. Please try again.',
    });
  }
};

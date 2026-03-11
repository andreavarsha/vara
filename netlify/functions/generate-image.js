import { GoogleGenAI } from '@google/genai/node';
// netlify dev automatically injects .env — no dotenv needed

const IMAGE_MODEL = 'gemini-3.1-flash-image-preview';

const SCHEMA = {
  occasions: [
    { value: 'Casual', system_instruction: "Design a relaxed yet polished everyday dress. Think clean silhouettes in neutral or earthy tones — ivory, sand, sage, warm grey. Breathable fabrics, minimal detailing." },
    { value: 'Date Night', system_instruction: "Design a sophisticated, sensual evening dress. Think satin, lace or structured crepe in deep jewel tones — burgundy, midnight navy, champagne, or classic black. Open backs, delicate straps, or a subtle slit are welcome." },
    { value: 'Vintage', system_instruction: "Design a vintage-inspired dress that feels nostalgic but wearable today. Think 1970s wrap silhouettes, 1950s full skirts, or 1960s shift dresses. Soft florals or warm earthy tones." },
    { value: 'Girls Night', system_instruction: "Design a chic, confidence-boosting night-out dress. Think fitted bodycon or mini lengths in satin, velvet or sequin. Solid jewel tones — emerald, deep red, cobalt, champagne — or subtle metallic finishes. NOT loud prints, NOT multiple clashing colours." },
  ],
  age_ranges: [
    { value: 'Early Teens', system_instruction: "Design a fun, age-appropriate dress. Modest hemlines, playful but tasteful colours — pastels, soft brights. Simple A-line or skater silhouettes." },
    { value: '16+', system_instruction: "Design a youthful, stylish dress for a 16–19 year old. Mini to midi lengths, fresh modern colours — dusty rose, cream, sky blue, soft lilac. Trendy but wearable." },
    { value: '20s', system_instruction: "Design a versatile, fashion-forward dress for a woman in her 20s. Sleek silhouettes, neutral or muted tones with one statement element." },
    { value: '30s', system_instruction: "Design a refined dress for a woman in her 30s. Midi lengths, structured fabric. Sophisticated palette: camel, rust, forest green, navy." },
    { value: '40+', system_instruction: "Design an elegant, timeless dress for a woman 40+. Midi to maxi lengths, luxurious draping. Understated palette — cream, dusty rose, deep teal, charcoal." },
  ],
  materials: [
    { value: 'Viscose', system_instruction: "Use for 'Fluid Textures'. Design dresses with soft drapes and resort-wear flow." },
    { value: 'Cotton', system_instruction: "Use 'Lightweight Structured Cotton' (Poplin/Voile) for architectural but breathable dresses." },
    { value: 'Linen', system_instruction: "The 'Climate-Conscious Hero'. Use for rustic, honest textures in A-line or wrap styles." },
    { value: 'Lace', system_instruction: "Apply as 'Romantic Excellence'. Use for sheer overlays, statement panels, or delicate trims." },
    { value: 'Denim', system_instruction: "Focus on 'Sophisticated Denim Tailoring'. Use dark indigo or raw 'Brut' denim for structured, polished dresses." },
    { value: 'Satin', system_instruction: "Focus on 'Liquid Shine'. Best for vintage-inspired slip dresses and evening glam." },
  ],
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(statusCode, data) {
  return { statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
    if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method Not Allowed' });

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) return jsonResponse(500, { error: 'Server configuration error' });

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonResponse(400, { error: 'Invalid JSON' });
    }

    const { silhouette, occasion, ageRange, material } = body;
    if (!silhouette || !occasion || !ageRange) {
      return jsonResponse(400, { error: 'silhouette, occasion, and ageRange are required' });
    }

    const occ = SCHEMA.occasions.find((o) => o.value === occasion);
    const age = SCHEMA.age_ranges.find((a) => a.value === ageRange);
    const mat = material && material !== 'No preference' ? SCHEMA.materials.find((m) => m.value === material) : null;

    if (!occ || !age) return jsonResponse(400, { error: 'Invalid occasion or age range' });

    const prompt = `Fashion illustration in a clean, editorial style. White background. Full-length dress centred in frame with generous padding on all sides — nothing cropped.
Style: realistic pencil sketch with tasteful watercolour wash. Wearable, real-world fashion — not fantasy, not costume, not cartoonish.
Design: a ${silhouette} dress. ${occ.system_instruction} ${age.system_instruction}${mat ? ` ${mat.system_instruction}` : ''}
Rules: single dress only, complete and visible. Tasteful, cohesive colour palette. No clashing patterns, no exaggerated proportions, no unrealistic design elements.`;

    const ai = new GoogleGenAI({ apiKey });

    const resp = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: prompt,
      config: { responseModalities: ['image'] },
    });

    const parts = resp?.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find((p) => p.inlineData?.data);

    if (!imgPart) {
      const reason = resp?.candidates?.[0]?.finishReason;
      console.warn(`No image returned for ${silhouette}. Finish reason: ${reason}`);
      return jsonResponse(200, { base64: null, mimeType: null, error: true, reason });
    }

    return jsonResponse(200, {
      base64: imgPart.inlineData.data,
      mimeType: imgPart.inlineData.mimeType || 'image/jpeg',
      error: false,
    });

  } catch (err) {
    console.error('generate-image error:', err.message);
    return jsonResponse(500, { error: err.message || 'Image generation failed', base64: null });
  }
};

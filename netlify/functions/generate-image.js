import { GoogleGenAI } from '@google/genai/node';
// netlify dev automatically injects .env — no dotenv needed

const IMAGE_MODEL = 'gemini-3.1-flash-image-preview';

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

    const prompt = `Fashion design sketch illustration. White background. Full-length dress drawn from head to hem, centred in the frame with generous white space on all sides.
Style: editorial pencil and soft watercolour wash.
Design: a ${silhouette} dress. ${occ.system_instruction} ${age.system_instruction}${mat ? ` ${mat.system_instruction}` : ''}
Rules: Show ONLY the dress — no background, no other clothing pieces. The complete dress must be fully visible within the canvas, nothing cropped.`;

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

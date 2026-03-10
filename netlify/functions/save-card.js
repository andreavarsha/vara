import { getStore } from '@netlify/blobs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function getUserId(event, context) {
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

export const handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }

  const userId = getUserId(event, context);
  if (!userId) {
    return {
      statusCode: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authentication required. Please sign in.' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON' }),
    };
  }

  const { action, card } = body;
  if (!card || !action) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'action and card required' }),
    };
  }

  const required = ['silhouette', 'styleAnalysis', 'trendEvidence', 'occasion', 'ageRange'];
  for (const f of required) {
    if (!card[f]) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Missing card field: ${f}` }),
      };
    }
  }

  const store = getStore('vara-users');
  const userKey = `user_${userId}`;
  let userData = await store.get(userKey);
  userData = userData ? JSON.parse(userData) : { count: 0, savedCards: [] };
  userData.savedCards = userData.savedCards || [];

  if (action === 'save') {
    const savedCard = {
      id: card.id || `${Date.now()}_${card.silhouette}`,
      savedAt: new Date().toISOString(),
      ...card,
    };
    userData.savedCards.unshift(savedCard);
  } else if (action === 'unsave') {
    const id = card.id;
    userData.savedCards = userData.savedCards.filter((c) => c.id !== id);
  } else {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'action must be save or unsave' }),
    };
  }

  await store.set(userKey, JSON.stringify(userData));

  return {
    statusCode: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ savedCards: userData.savedCards }),
  };
};

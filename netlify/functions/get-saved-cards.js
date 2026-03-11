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

  if (event.httpMethod !== 'GET') {
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

  try {
    const store = getStore('vara-users');
    const userKey = `user_${userId}`;
    const userDataRaw = await store.get(userKey);
    const userData = userDataRaw ? JSON.parse(userDataRaw) : { savedCards: [] };
    const savedCards = userData.savedCards || [];

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ savedCards }),
    };
  } catch (err) {
    console.error('Blobs error in get-saved-cards:', err.message);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Storage unavailable. Please try again.' }),
    };
  }
};

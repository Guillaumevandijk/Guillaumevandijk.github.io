/**
 * Supabase Edge Function: openai-private-proxy
 *
 * Your website (js/ai.js) calls this via supabase.functions.invoke().
 * The browser never sees the OpenAI key — only this serverless function does.
 *
 * Flow: browser (logged in) → Supabase (JWT check) → this function → OpenAI → { content }
 */

// Set in Supabase Dashboard → Edge Functions → Secrets (not in the repo).
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

// Browsers block cross-origin requests unless the server allows them (CORS).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** JSON body sent from js/ai.js (and optional extra fields). */
type ChatRequest = {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
};

/** Helper: JSON body + CORS headers on every response. */
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req: Request) => {
  // Browser sends OPTIONS before POST; answer so the real POST is allowed.
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    // Parse body from supabase.functions.invoke('openai-private-proxy', { body: { ... } })
    const {
      model = 'gpt-4o-mini', // used only if the client omits model; ai.js always sends one
      messages,
      temperature, // optional; ai.js does not send this today
      max_tokens, // optional; ai.js does not send this today
    }: ChatRequest = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonResponse(
        { error: 'messages must be a non-empty array' },
        400
      );
    }

    if (!OPENAI_API_KEY) {
      return jsonResponse(
        { error: 'OPENAI_API_KEY missing' },
        500
      );
    }

    // Forward the chat to OpenAI; model/messages come from the client (e.g. gpt-5.4-nano in ai.js).
    const openaiRes = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens,
        }),
      }
    );

    const payload = await openaiRes.json();

    if (!openaiRes.ok) {
      // Pass through OpenAI error JSON; frontend shows a generic error (no data.content).
      return jsonResponse(payload, openaiRes.status);
    }

    // Shape expected by js/ai.js: return data.content
    return jsonResponse({
      content: payload?.choices?.[0]?.message?.content,
    });
  } catch (err) {
    console.error(err);

    return jsonResponse(
      { error: 'Internal server error' },
      500
    );
  }
});

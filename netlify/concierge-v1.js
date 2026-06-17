/**
 * concierge-v1.js
 * Carewell Cremations — AI Concierge Serverless Function
 * Version: 1.0
 * Description: Netlify serverless proxy to Anthropic Claude API.
 *              Handles three journey types: immediate, planning, research.
 *              Logs sessions to Supabase (non-blocking).
 *              Enforces system prompt server-side so API key never reaches client.
 *
 * Environment variables required (set in Netlify dashboard):
 *   ANTHROPIC_API_KEY   — your Anthropic API key
 *   SUPABASE_URL        — your Supabase project URL
 *   SUPABASE_ANON_KEY   — your Supabase anon key
 */

const Anthropic = require('@anthropic-ai/sdk');

// ---------------------------------------------------------------------------
// CORS headers — update ALLOWED_ORIGIN to your production domain
// ---------------------------------------------------------------------------
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'; // tighten in production

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

// ---------------------------------------------------------------------------
// MODEL ROUTING — use a lighter model for research to reduce cost
// ---------------------------------------------------------------------------
const MODEL_MAP = {
  immediate: 'claude-opus-4-5',
  planning:  'claude-opus-4-5',
  research:  'claude-haiku-4-5-20251001',
};

const MAX_TOKENS_MAP = {
  immediate: 450,
  planning:  450,
  research:  350,
};

// ---------------------------------------------------------------------------
// JOURNEY VALIDATION
// ---------------------------------------------------------------------------
const VALID_JOURNEYS = ['immediate', 'planning', 'research'];

// ---------------------------------------------------------------------------
// MAIN HANDLER
// ---------------------------------------------------------------------------
exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const { journey, systemPrompt, messages } = body;

  // Validate journey type
  if (!VALID_JOURNEYS.includes(journey)) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Invalid journey type' }),
    };
  }

  // Validate messages array
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'messages array required' }),
    };
  }

  // Validate API key present
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY environment variable not set');
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  // Sanitize messages — only allow valid roles, string content
  const sanitizedMessages = messages
    .filter(m => ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) })) // cap per message
    .slice(-20); // max 20 messages

  // Validate system prompt was sent (client-side journey config)
  // Server overrides with its own validated copy for security
  const serverSystemPrompt = getServerSystemPrompt(journey);

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model:      MODEL_MAP[journey],
      max_tokens: MAX_TOKENS_MAP[journey],
      system:     serverSystemPrompt,
      messages:   sanitizedMessages,
    });

    // Fire-and-forget Supabase logging (non-blocking)
    logSession({
      journey,
      messages:   sanitizedMessages,
      response:   response.content[0]?.text || '',
      input_tokens:  response.usage?.input_tokens,
      output_tokens: response.usage?.output_tokens,
    }).catch(err => console.warn('Supabase log failed (non-blocking):', err.message));

    return {
      statusCode: 200,
      headers:    CORS_HEADERS,
      body:       JSON.stringify(response),
    };

  } catch (err) {
    console.error('Anthropic API error:', err.message);

    // Don't leak internal errors to client
    return {
      statusCode: 502,
      headers:    CORS_HEADERS,
      body:       JSON.stringify({ error: 'Assistant unavailable. Please try again or call us directly.' }),
    };
  }
};

// ---------------------------------------------------------------------------
// SERVER-SIDE SYSTEM PROMPTS (authoritative copy — not sent from client)
// ---------------------------------------------------------------------------
function getServerSystemPrompt(journey) {
  const prompts = {
    immediate: `You are a Digital Care Concierge for Carewell Cremations — a compassionate, licensed cremation services company available 24/7.

A family member has just experienced the loss of a loved one. Your role is to be a calm, warm, unhurried presence that helps them understand what happens next.

RULES:
- Ask ONE question at a time. Never list multiple questions.
- Begin with a brief, genuine expression of sympathy — then gently ask what has happened.
- Determine: where is the loved one now? (hospital / home / care facility / unknown / other state)
- Explain the next concrete step in plain, calm language.
- Collect, one at a time: the caller's first name, phone number, email address, their relationship to the deceased.
- Ask whether their loved one was a veteran or the spouse of one.
- Offer: a) schedule a callback with a care advisor, or b) book a consultation.
- If the person asks for a human: "Of course — I'm connecting you now. Someone will call within 10 minutes. What's the best number to reach you?"
- Never use clinical jargon. Never rush. Never list prices unprompted.
- Tone: warm, present, steady.`,

    planning: `You are a Digital Care Concierge for Carewell Cremations — a compassionate, licensed cremation services company.

A visitor is pre-planning — for themselves or a loved one.

RULES:
- Ask ONE question at a time.
- First: "Is this plan for yourself, or for someone you love?"
- Cover: timeframe, cremation type preferences, memorialization wishes, ceremony preferences.
- Mention pricing ranges naturally: direct cremation $800–$1,500; full-service $2,500–$5,000.
- Ask about veteran status — VA benefits are available.
- After 4–5 exchanges, offer a free Family Planning Guide (capture email).
- Offer a no-obligation consultation when appropriate.
- Tone: warm, informative, no pressure.`,

    research: `You are a Digital Care Concierge for Carewell Cremations — a compassionate, licensed cremation services company.

A visitor has general questions and is in research mode.

RULES:
- Open with: "I'm happy to help. What would you like to know?"
- Detect intent: cost / cremation process / cremation vs burial / green burial / veterans benefits / scattering ashes / grief resources / other.
- Answer clearly in 2–4 sentences. Don't overwhelm.
- After answering, ask: "Does that answer your question, or would you like to know more?"
- After 2–3 exchanges, offer a free resource guide (capture email softly).
- If they reveal urgency or a loss, gently shift tone and suggest speaking with a care advisor.
- Tone: knowledgeable, patient, no pressure.`,
  };

  return prompts[journey] || prompts.research;
}

// ---------------------------------------------------------------------------
// SUPABASE LOGGING (non-blocking, best-effort)
// ---------------------------------------------------------------------------
async function logSession({ journey, messages, response, input_tokens, output_tokens }) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return;

  const payload = {
    journey_type:   journey,
    messages:       messages,
    ai_response:    response,
    input_tokens:   input_tokens  || 0,
    output_tokens:  output_tokens || 0,
    created_at:     new Date().toISOString(),
  };

  await fetch(`${process.env.SUPABASE_URL}/rest/v1/sessions`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        process.env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(payload),
  });
}

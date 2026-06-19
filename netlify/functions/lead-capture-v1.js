/**
 * lead-capture-v1.js
 * Carewell Cremations — Lead Capture Serverless Function
 * Version: 1.1
 * CR007 — Lead capture active:
 *   - Receives lead JSON from concierge [CAPTURE_LEAD] token via index-v9.html
 *   - Writes to Supabase leads table when SUPABASE_URL + SUPABASE_ANON_KEY are set
 *   - If Supabase not yet configured: logs lead to Netlify function console (no crash)
 *   - Sends confirmation email via Resend when RESEND_API_KEY is set
 *   - Posts to CRM webhook when CRM_WEBHOOK_URL is set (optional)
 *
 * Environment variables (Netlify dashboard → Environment Variables):
 *   SUPABASE_URL        — your Supabase project URL
 *   SUPABASE_ANON_KEY   — your Supabase anon key
 *   RESEND_API_KEY      — your Resend API key (optional)
 *   FROM_EMAIL          — e.g. contact@carewellcremations.com (optional)
 *   CRM_WEBHOOK_URL     — n8n / Make / HubSpot webhook URL (optional)
 *
 * Supabase setup:
 *   1. Create a Supabase project at https://supabase.com
 *   2. Run supabase-schema-v1.sql in Supabase SQL Editor
 *   3. Add SUPABASE_URL and SUPABASE_ANON_KEY to Netlify env vars
 *   4. Leads will begin saving automatically — no code change needed
 */

const { randomUUID } = require('crypto');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const {
    journey_type,
    first_name,
    last_name,
    email,
    phone,
    is_veteran,
    notes,
    session_id,
  } = data;

  // Basic validation — need at least one contact method
  if (!email && !phone) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'At least one of email or phone is required' }),
    };
  }

  const leadId = randomUUID();

  const lead = {
    id:             leadId,
    journey_type:   journey_type  || 'unknown',
    first_name:     first_name    || null,
    last_name:      last_name     || null,
    email:          email         || null,
    phone:          phone         || null,
    is_veteran:     is_veteran    === true || is_veteran === 'true' || false,
    notes:          notes         || null,
    session_id:     session_id    || null,
    status:         'new',
  };

  // Always log to console — visible in Netlify Functions log tab
  console.log('LEAD CAPTURED:', JSON.stringify({
    id:           leadId,
    journey_type: lead.journey_type,
    name:         `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
    email:        lead.email,
    phone:        lead.phone,
    is_veteran:   lead.is_veteran,
    timestamp:    new Date().toISOString(),
  }));

  // Save to Supabase if configured
  const supabaseConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

  if (supabaseConfigured) {
    const supabaseResult = await saveToSupabase(lead);
    if (!supabaseResult.ok) {
      console.error('Supabase write failed:', supabaseResult.error);
      // Don't return error to client — lead is logged, continue to email
    } else {
      console.log('Lead saved to Supabase. ID:', leadId);
    }
  } else {
    console.warn('Supabase not configured — lead logged to console only. Set SUPABASE_URL and SUPABASE_ANON_KEY in Netlify env vars to enable database storage.');
  }

  // Send confirmation email if Resend is configured
  if (email && process.env.RESEND_API_KEY) {
    sendConfirmationEmail({ first_name, email, journey_type: lead.journey_type })
      .catch(err => console.warn('Email send failed (non-blocking):', err.message));
  }

  // Post to CRM webhook if configured
  if (process.env.CRM_WEBHOOK_URL) {
    postToCRM({ leadId, ...lead })
      .catch(err => console.warn('CRM webhook failed (non-blocking):', err.message));
  }

  return {
    statusCode: 200,
    headers:    CORS_HEADERS,
    body:       JSON.stringify({
      success:             true,
      lead_id:             leadId,
      supabase_configured: supabaseConfigured,
    }),
  };
};

// ---------------------------------------------------------------------------
// SUPABASE
// ---------------------------------------------------------------------------
async function saveToSupabase(lead) {
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/leads`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify(lead),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: text };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// EMAIL VIA RESEND
// ---------------------------------------------------------------------------
async function sendConfirmationEmail({ first_name, email, journey_type }) {
  const name     = first_name || 'there';
  const fromAddr = process.env.FROM_EMAIL || 'contact@carewellcremations.com';

  const subjects = {
    immediate: `We're here for you — Carewell Cremations`,
    planning:  `Thank you for planning ahead — Carewell Cremations`,
    research:  `Your questions, answered — Carewell Cremations`,
  };

  const intros = {
    immediate: `Thank you for reaching out to us. One of our care advisors will be in touch with you very shortly. If you need immediate assistance, please call us at 571-300-2273 — we are available 24 hours a day, 7 days a week.`,
    planning:  `Thank you for taking this thoughtful step. We are honored to help you plan ahead. One of our care advisors will follow up with you soon. In the meantime, feel free to call us at 571-300-2273 with any questions.`,
    research:  `Thank you for your questions — we're glad you reached out. One of our care advisors will follow up with you soon. You're also welcome to call us anytime at 571-300-2273.`,
  };

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Georgia, serif; color: #2c2c2a; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
  <div style="border-bottom: 1px solid #e2ebe2; padding-bottom: 16px; margin-bottom: 24px;">
    <p style="color: #3c6240; font-size: 13px; margin: 0; letter-spacing: 0.05em; text-transform: uppercase;">Carewell Cremations</p>
  </div>
  <p style="font-size: 22px; font-weight: 500; margin: 0 0 16px;">Hello, ${name}.</p>
  <p style="font-size: 15px; line-height: 1.7; color: #5a5a58; margin: 0 0 24px;">
    ${intros[journey_type] || intros.research}
  </p>
  <p style="font-size: 15px; line-height: 1.7; color: #5a5a58; margin: 0 0 24px;">
    You can also book a free 30-minute consultation at your convenience:<br/>
    <a href="https://calendly.com/cjtester7/free-30-minute-consultation" style="color: #7c3aed;">Schedule a consultation →</a>
  </p>
  <p style="font-size: 14px; color: #888784; margin: 0;">
    With care,<br/>
    The Carewell Cremations Team<br/>
    <a href="https://carewellcremations.com" style="color: #888784;">carewellcremations.com</a> · 571-300-2273
  </p>
  <div style="border-top: 1px solid #e2ebe2; margin-top: 32px; padding-top: 16px;">
    <p style="font-size: 12px; color: #aaa; margin: 0;">
      2929 Eskridge Road, Suite N, Fairfax, VA 22031<br/>
      <a href="#" style="color: #aaa;">Unsubscribe</a> · <a href="https://carewellcremations.com/privacy" style="color: #aaa;">Privacy Policy</a>
    </p>
  </div>
</body>
</html>`.trim();

  await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from:    fromAddr,
      to:      email,
      subject: subjects[journey_type] || subjects.research,
      html,
    }),
  });
}

// ---------------------------------------------------------------------------
// CRM WEBHOOK (n8n / Make / HubSpot — optional)
// ---------------------------------------------------------------------------
async function postToCRM(lead) {
  await fetch(process.env.CRM_WEBHOOK_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(lead),
  });
}

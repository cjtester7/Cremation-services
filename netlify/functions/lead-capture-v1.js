/**
 * lead-capture-v1.js
 * Carewell Cremations — Lead Capture Serverless Function
 * Version: 1.0
 * Description: Receives lead data from the AI Concierge conversation,
 *              writes to Supabase leads table, and sends confirmation
 *              email via Resend. Optionally posts to CRM webhook.
 *
 * Environment variables required:
 *   SUPABASE_URL        — your Supabase project URL
 *   SUPABASE_ANON_KEY   — your Supabase anon key
 *   RESEND_API_KEY      — your Resend API key
 *   FROM_EMAIL          — e.g. care@carewell-cremations.com
 *   CRM_WEBHOOK_URL     — optional: n8n / Make / HubSpot webhook URL
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
    location_state,
    notes,
    session_id,
  } = data;

  // Basic validation
  if (!email && !phone) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'At least one of email or phone is required' }),
    };
  }

  const leadId = randomUUID();

  // 1. Save to Supabase
  const supabaseResult = await saveToSupabase({
    id:             leadId,
    journey_type:   journey_type || 'unknown',
    first_name:     first_name   || null,
    last_name:      last_name    || null,
    email:          email        || null,
    phone:          phone        || null,
    is_veteran:     is_veteran   || false,
    location_state: location_state || null,
    notes:          notes        || null,
    session_id:     session_id   || null,
    status:         'new',
  });

  if (!supabaseResult.ok) {
    console.error('Supabase write failed:', supabaseResult.error);
    // Don't fail the whole request — still try to send email
  }

  // 2. Send confirmation email (non-blocking)
  if (email) {
    sendConfirmationEmail({ first_name, email, journey_type }).catch(
      err => console.warn('Email send failed:', err.message)
    );
  }

  // 3. Post to CRM webhook (non-blocking)
  if (process.env.CRM_WEBHOOK_URL) {
    postToCRM({ leadId, ...data }).catch(
      err => console.warn('CRM webhook failed:', err.message)
    );
  }

  return {
    statusCode: 200,
    headers:    CORS_HEADERS,
    body:       JSON.stringify({ success: true, lead_id: leadId }),
  };
};

// ---------------------------------------------------------------------------
// SUPABASE
// ---------------------------------------------------------------------------
async function saveToSupabase(lead) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return { ok: false, error: 'Supabase not configured' };
  }

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
}

// ---------------------------------------------------------------------------
// EMAIL VIA RESEND
// ---------------------------------------------------------------------------
async function sendConfirmationEmail({ first_name, email, journey_type }) {
  if (!process.env.RESEND_API_KEY) return;

  const name     = first_name || 'there';
  const fromAddr = process.env.FROM_EMAIL || 'care@carewell-cremations.com';

  const subjects = {
    immediate: `We're here for you — Carewell Cremations`,
    planning:  `Your planning guide is on its way — Carewell Cremations`,
    research:  `Your resource guide — Carewell Cremations`,
  };

  const intros = {
    immediate: `Thank you for reaching out. One of our care advisors will contact you very shortly. If you need immediate assistance, please call us at (800) 555-1234.`,
    planning:  `Thank you for planning ahead — it's a meaningful act of care. We'll follow up soon with your free Family Planning Guide and be happy to answer any questions at your own pace.`,
    research:  `Thank you for your questions. We've noted your inquiry and will send over a resource guide shortly. Feel free to reach out anytime.`,
  };

  const body = `
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
    If there is anything at all we can help with, please don't hesitate to call us at <strong>(800) 555-1234</strong> — we're available around the clock.
  </p>
  <p style="font-size: 14px; color: #888784; margin: 0;">
    With care,<br/>
    The Carewell Cremations Team
  </p>
  <div style="border-top: 1px solid #e2ebe2; margin-top: 32px; padding-top: 16px;">
    <p style="font-size: 12px; color: #aaa; margin: 0;">
      Carewell Cremations · Licensed &amp; Bonded · (800) 555-1234<br/>
      <a href="#" style="color: #aaa;">Unsubscribe</a> · <a href="#" style="color: #aaa;">Privacy Policy</a>
    </p>
  </div>
</body>
</html>
  `.trim();

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
      html:    body,
    }),
  });
}

// ---------------------------------------------------------------------------
// CRM WEBHOOK (n8n / Make / HubSpot)
// ---------------------------------------------------------------------------
async function postToCRM(lead) {
  await fetch(process.env.CRM_WEBHOOK_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(lead),
  });
}

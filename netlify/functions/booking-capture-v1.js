// booking-capture-v1.js
// Carewell Cremations — Consultation Booking Capture
// Location: netlify/functions/booking-capture-v1.js
// CR014 — Writes consultation booking record to Supabase leads table
//          when visitor clicks "Book a Free Consultation" in the concierge.
//          Uses lead data already captured in the conversation session.
// Requires env vars: SUPABASE_URL, SUPABASE_ANON_KEY (already set in Netlify)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const {
    first_name,
    last_name,
    email,
    phone,
    journey_type,
    is_veteran,
    notes,
    session_id
  } = payload;

  // Build Supabase record matching the leads table schema exactly
  const record = {
    first_name:    first_name    || null,
    last_name:     last_name     || null,
    email:         email         || null,
    phone:         phone         || null,
    journey_type:  journey_type  || null,
    is_veretan:    is_veteran    || false,   // matches existing column spelling
    location_state: null,                    // not captured by concierge
    notes:         notes || 'Consultation requested via Care Concierge',
    status:        'consultation_requested',
    session_id:    session_id    || null,
    created_at:    new Date().toISOString(),
    updated_at:    new Date().toISOString()
  };

  const supabaseUrl  = process.env.SUPABASE_URL;
  const supabaseKey  = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Graceful fallback — log and return success so frontend isn't disrupted
    console.log('SUPABASE not configured. Booking payload:', JSON.stringify(record));
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ success: true, stored: false, reason: 'Supabase not configured' })
    };
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':         supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer':         'return=representation'
      },
      body: JSON.stringify(record)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Supabase insert error:', err);
      return {
        statusCode: res.status,
        headers: CORS,
        body: JSON.stringify({ error: err.message || 'Supabase insert failed' })
      };
    }

    const data = await res.json();
    console.log('Booking record saved:', data?.[0]?.id || 'ok');

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ success: true, stored: true, id: data?.[0]?.id })
    };

  } catch (err) {
    console.error('booking-capture-v1 error:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

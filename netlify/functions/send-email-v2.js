// send-email-v2.js
// Carewell Cremations — Resend email Netlify function
// Location: netlify/functions/send-email-v2.js
// CR012 — 3 email types: lead_notification, visitor_confirmation, transcript
// CR013 — transcript email now sends .txt file as attachment (base64 encoded)
//          email body is a simple branded wrapper, not a summary of the content
// Requires env var: RESEND_API_KEY (set in Netlify dashboard)

const RESEND_API = 'https://api.resend.com/emails';
const FROM = 'Carewell Cremations <care@thinkezly.com>';
const REPLY_TO = 'cjtester@gmail.com';
const STAFF_EMAIL = 'cjtester@gmail.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

/* ── Email builders ── */

function buildLeadNotificationEmail(lead) {
  const journeyLabels = {
    immediate: 'Need Help Now',
    planning: 'Planning Ahead',
    research: 'Just Researching'
  };
  const journey = journeyLabels[lead.journey_type] || lead.journey_type || 'Unknown';
  const veteran = lead.is_veteran ? 'Yes' : 'No';
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'full',
    timeStyle: 'short'
  });

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#2c2c2c;">
      <div style="background:linear-gradient(135deg,#2d4a35,#3d5c45);padding:1.5rem 2rem;border-radius:0.75rem 0.75rem 0 0;">
        <h2 style="color:#fff;margin:0;font-size:1.15rem;font-weight:600;">🕊️ New Lead — Carewell Concierge</h2>
        <p style="color:rgba(255,255,255,0.7);margin:0.25rem 0 0;font-size:0.85rem;">${timestamp} ET</p>
      </div>
      <div style="background:#fff;padding:1.5rem 2rem;border:1px solid #e8e4de;border-top:none;">
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
          <tr><td style="padding:0.5rem 0;color:#6b6b6b;width:130px;">Name</td><td style="padding:0.5rem 0;font-weight:500;">${lead.first_name} ${lead.last_name}</td></tr>
          <tr><td style="padding:0.5rem 0;color:#6b6b6b;border-top:1px solid #f0ece6;">Email</td><td style="padding:0.5rem 0;border-top:1px solid #f0ece6;"><a href="mailto:${lead.email}" style="color:#5a7a64;">${lead.email}</a></td></tr>
          <tr><td style="padding:0.5rem 0;color:#6b6b6b;border-top:1px solid #f0ece6;">Phone</td><td style="padding:0.5rem 0;border-top:1px solid #f0ece6;"><a href="tel:${lead.phone}" style="color:#5a7a64;">${lead.phone}</a></td></tr>
          <tr><td style="padding:0.5rem 0;color:#6b6b6b;border-top:1px solid #f0ece6;">Veteran</td><td style="padding:0.5rem 0;border-top:1px solid #f0ece6;">${veteran}</td></tr>
          <tr><td style="padding:0.5rem 0;color:#6b6b6b;border-top:1px solid #f0ece6;">Journey</td><td style="padding:0.5rem 0;border-top:1px solid #f0ece6;">${journey}</td></tr>
        </table>
      </div>
      <div style="background:#f8f5f0;padding:1rem 2rem;border:1px solid #e8e4de;border-top:none;border-radius:0 0 0.75rem 0.75rem;font-size:0.8rem;color:#6b6b6b;">
        Carewell Cremations · 2929 Eskridge Road Suite N, Fairfax VA 22031 · 571-300-2273
      </div>
    </div>`;

  const text = `New Lead — Carewell Concierge\n${timestamp} ET\n\nName: ${lead.first_name} ${lead.last_name}\nEmail: ${lead.email}\nPhone: ${lead.phone}\nVeteran: ${veteran}\nJourney: ${journey}\n\nCarewell Cremations · 571-300-2273`;

  return {
    to: [STAFF_EMAIL],
    subject: `New Lead: ${lead.first_name} ${lead.last_name} — Carewell Concierge`,
    html,
    text
  };
}

function buildVisitorConfirmationEmail(lead) {
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#2c2c2c;">
      <div style="background:linear-gradient(135deg,#2d4a35,#3d5c45);padding:1.5rem 2rem;border-radius:0.75rem 0.75rem 0 0;">
        <h2 style="color:#fff;margin:0;font-size:1.15rem;font-weight:600;">🕊️ Carewell Cremations</h2>
        <p style="color:rgba(255,255,255,0.7);margin:0.25rem 0 0;font-size:0.85rem;">Thank you for reaching out</p>
      </div>
      <div style="background:#fff;padding:1.75rem 2rem;border:1px solid #e8e4de;border-top:none;">
        <p style="margin:0 0 1rem;">Dear ${lead.first_name},</p>
        <p style="margin:0 0 1rem;line-height:1.65;">Thank you for connecting with us. We've received your information and a member of our care team will be in touch with you shortly.</p>
        <p style="margin:0 0 1.5rem;line-height:1.65;">If you need to speak with someone right away, please don't hesitate to call us — we're available 24 hours a day, 7 days a week.</p>
        <div style="background:#f8f5f0;border-left:3px solid #7a9e87;padding:1rem 1.25rem;border-radius:0 0.5rem 0.5rem 0;margin-bottom:1.5rem;">
          <p style="margin:0 0 0.25rem;font-weight:600;color:#2d4a35;">📞 571-300-2273</p>
          <p style="margin:0;font-size:0.85rem;color:#6b6b6b;">Available 24/7 · 2929 Eskridge Road Suite N, Fairfax VA 22031</p>
        </div>
        <p style="margin:0 0 0.75rem;font-size:0.9rem;color:#6b6b6b;">You may also schedule a free 30-minute consultation at a time that works for you:</p>
        <a href="https://calendly.com/cjtester7/free-30-minute-consultation"
           style="display:inline-block;background:linear-gradient(135deg,#2d4a35,#3d5c45);color:#fff;padding:0.65rem 1.25rem;border-radius:0.5rem;text-decoration:none;font-size:0.875rem;font-weight:500;">
          Schedule a Free Consultation
        </a>
      </div>
      <div style="background:#f8f5f0;padding:1rem 2rem;border:1px solid #e8e4de;border-top:none;border-radius:0 0 0.75rem 0.75rem;font-size:0.8rem;color:#6b6b6b;">
        Carewell Cremations · 2929 Eskridge Road Suite N, Fairfax VA 22031<br/>
        Serving Northern Virginia · Maryland · Washington DC Metro Area
      </div>
    </div>`;

  const text = `Dear ${lead.first_name},\n\nThank you for connecting with Carewell Cremations. We've received your information and a member of our care team will be in touch shortly.\n\nIf you need to speak with someone right away, please call us anytime:\n📞 571-300-2273 (available 24/7)\n\nSchedule a free consultation:\nhttps://calendly.com/cjtester7/free-30-minute-consultation\n\nCarewell Cremations\n2929 Eskridge Road Suite N, Fairfax VA 22031\nServing Northern Virginia · Maryland · Washington DC Metro Area`;

  return {
    to: [lead.email],
    subject: 'Thank you for reaching out — Carewell Cremations',
    html,
    text,
    reply_to: REPLY_TO
  };
}

function buildTranscriptEmail(to_email, transcript_text, filename) {
  // CR013: transcript delivered as .txt attachment, not rendered in body
  const attachmentBase64 = Buffer.from(transcript_text, 'utf-8').toString('base64');

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#2c2c2c;">
      <div style="background:linear-gradient(135deg,#2d4a35,#3d5c45);padding:1.5rem 2rem;border-radius:0.75rem 0.75rem 0 0;">
        <h2 style="color:#fff;margin:0;font-size:1.15rem;font-weight:600;">🕊️ Your Conversation Transcript</h2>
        <p style="color:rgba(255,255,255,0.7);margin:0.25rem 0 0;font-size:0.85rem;">Carewell Cremations Care Concierge</p>
      </div>
      <div style="background:#fff;padding:1.75rem 2rem;border:1px solid #e8e4de;border-top:none;">
        <p style="margin:0 0 1rem;line-height:1.65;">Please find your conversation transcript attached as <strong>${filename}</strong>.</p>
        <p style="margin:0 0 1.5rem;line-height:1.65;color:#6b6b6b;font-size:0.9rem;">If you have any questions or would like to speak with a member of our team, we are here for you 24 hours a day.</p>
        <div style="background:#f8f5f0;border-left:3px solid #7a9e87;padding:1rem 1.25rem;border-radius:0 0.5rem 0.5rem 0;margin-bottom:1.5rem;">
          <p style="margin:0 0 0.25rem;font-weight:600;color:#2d4a35;">📞 571-300-2273</p>
          <p style="margin:0;font-size:0.85rem;color:#6b6b6b;">Available 24/7 · 2929 Eskridge Road Suite N, Fairfax VA 22031</p>
        </div>
        <a href="https://calendly.com/cjtester7/free-30-minute-consultation"
           style="display:inline-block;background:linear-gradient(135deg,#2d4a35,#3d5c45);color:#fff;padding:0.65rem 1.25rem;border-radius:0.5rem;text-decoration:none;font-size:0.875rem;font-weight:500;">
          Schedule a Free Consultation
        </a>
      </div>
      <div style="background:#f8f5f0;padding:1rem 2rem;border:1px solid #e8e4de;border-top:none;border-radius:0 0 0.75rem 0.75rem;font-size:0.8rem;color:#6b6b6b;">
        Carewell Cremations · 2929 Eskridge Road Suite N, Fairfax VA 22031<br/>
        Serving Northern Virginia · Maryland · Washington DC Metro Area
      </div>
    </div>`;

  const text = `Your conversation transcript is attached as ${filename}.\n\nIf you have any questions, please call us anytime:\n📞 571-300-2273 (available 24/7)\n\nSchedule a free consultation:\nhttps://calendly.com/cjtester7/free-30-minute-consultation\n\nCarewell Cremations\n2929 Eskridge Road Suite N, Fairfax VA 22031`;

  return {
    to: [to_email],
    subject: `Your Carewell Cremations conversation — ${filename}`,
    html,
    text,
    reply_to: REPLY_TO,
    // CR013: .txt file attached via Resend attachments API
    attachments: [
      {
        filename,
        content: attachmentBase64,
        type: 'text/plain'
      }
    ]
  };
}

/* ── Handler ── */

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not set');
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Email service not configured' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { type } = body;

    let emailPayload;

    if (type === 'lead_notification') {
      const { lead } = body;
      if (!lead || !lead.first_name || !lead.email) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing lead data' }) };
      }
      emailPayload = buildLeadNotificationEmail(lead);

    } else if (type === 'visitor_confirmation') {
      const { lead } = body;
      if (!lead || !lead.email || !lead.first_name) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing lead data' }) };
      }
      emailPayload = buildVisitorConfirmationEmail(lead);

    } else if (type === 'transcript') {
      const { to_email, transcript, filename } = body;
      if (!to_email || !transcript) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing to_email or transcript' }) };
      }
      emailPayload = buildTranscriptEmail(to_email, transcript, filename || 'conversation.txt');

    } else {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid type. Must be lead_notification, visitor_confirmation, or transcript' }) };
    }

    // Build Resend payload
    const resendPayload = {
      from: FROM,
      to: emailPayload.to,
      subject: emailPayload.subject,
      html: emailPayload.html,
      text: emailPayload.text,
      ...(emailPayload.reply_to && { reply_to: emailPayload.reply_to }),
      ...(emailPayload.attachments && { attachments: emailPayload.attachments })
    };

    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(resendPayload)
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend error:', data);
      return { statusCode: res.status, headers: CORS, body: JSON.stringify({ error: data.message || 'Resend API error' }) };
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, id: data.id }) };

  } catch (err) {
    console.error('send-email-v2 error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

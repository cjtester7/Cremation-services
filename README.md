# Carewell Cremations — Digital Care Concierge
**Version 1.0 · MVP Release**

AI-powered homepage hero with a compassionate Care Concierge, built on Netlify + Claude API + Supabase.

---

## File Inventory

| File | Version | Purpose |
|------|---------|---------|
| `index-v1.html` | v1 | Main homepage — hero + AI concierge UI |
| `netlify/functions/concierge-v1.js` | v1 | Serverless proxy → Claude API |
| `netlify/functions/lead-capture-v1.js` | v1 | Lead storage → Supabase + Resend email |
| `netlify.toml` | v1 | Netlify build/redirect/header config |
| `package.json` | v1 | Node dependencies (`@anthropic-ai/sdk`) |
| `supabase-schema-v1.sql` | v1 | Full DB schema — run once in Supabase SQL Editor |

---

## Quick Start

### 1. Clone & deploy
```bash
git clone https://github.com/YOUR_ORG/carewell-cremations.git
cd carewell-cremations
npm install
netlify dev       # local development with functions
```

### 2. Set environment variables in Netlify dashboard
`Site Settings → Environment Variables`:

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | Your Anthropic API key |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `RESEND_API_KEY` | ✅ | Resend email API key |
| `FROM_EMAIL` | ✅ | e.g. `care@carewell-cremations.com` |
| `ALLOWED_ORIGIN` | Recommended | Your production domain |
| `CRM_WEBHOOK_URL` | Optional | n8n / Make / HubSpot webhook |

### 3. Initialize Supabase
- Create a new Supabase project
- Open the SQL Editor
- Paste and run `supabase-schema-v1.sql`

### 4. Deploy
```bash
git add .
git commit -m "feat: v1 - AI Care Concierge hero"
git push origin main
# Netlify auto-deploys on push
```

---

## Version Bump Checklist
When creating a new version (e.g. v2):
- [ ] Copy `index-v1.html` → `index-v2.html`, update header comment
- [ ] Copy functions if changed → `concierge-v2.js`, `lead-capture-v2.js`
- [ ] Update `netlify.toml`: change redirect `to = "/index-v2.html"` and function names
- [ ] Update this README's file inventory table
- [ ] Commit with message: `feat: v2 - [description of changes]`

---

## Architecture
```
Browser → index-v1.html
  └─ card click → openConcierge(journey)
      └─ POST /.netlify/functions/concierge-v1
          └─ Anthropic Claude API
      └─ POST /.netlify/functions/lead-capture-v1
          ├─ Supabase (leads + sessions tables)
          └─ Resend (confirmation email)
```

---

## Roadmap
- **v2**: Inline lead capture form in chat, Calendly embed
- **v3**: Supabase session persistence, admin dashboard
- **v4**: RAG knowledge base (pgvector + OpenAI embeddings)
- **v5**: Voice concierge (Gemini Flash native audio)

# ProspectIQ — Case Study

> **TL;DR:** Built an AI-powered outreach engine that auto-researches prospects and generates hyper-personalized cold emails using Llama 3.3, cutting manual outreach time by 95%.

---

## The Problem

Sales teams and freelancers spend disproportionate amounts of time manually researching prospects and crafting personalized emails. Generic outreach templates are quickly marked as spam, but true personalization doesn't scale — a single well-researched cold email can take 15–30 minutes to write.

## Why Current Tools Fall Short

Traditional sales engagement tools are either:
- **Prohibitively expensive** enterprise subscriptions (Outreach, SalesLoft — $100+/seat/month)
- **Limited in AI depth** — offering basic merge tags instead of genuine context-aware personalization
- **Locked to generic sending domains** which harm deliverability and land in spam

None of them let you bring your own Gmail, scrape prospect websites in real-time, and generate context-aware emails in under a second.

## The Solution

![Dashboard](docs/assets/dashboard.png)

ProspectIQ automates the hardest parts of cold email:

1. **Discover** — Import prospects individually or via bulk CSV with validation
2. **Enrich** — Automatically scrape a prospect's company website and extract key talking points
3. **Generate** — Use Llama 3.3 (via Groq's sub-second inference) to craft hyper-personalized emails using real context
4. **Sequence** — Build multi-step drip campaigns with configurable delays
5. **Send** — Deliver from the user's own Gmail for maximum authenticity and deliverability

![Campaign Builder](docs/assets/campaign.png)

## Technical Architecture

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Full-Stack Framework** | Next.js 15 (App Router) | Server Actions eliminate separate backend; React 19 for optimal DX |
| **Database & Auth** | Supabase | Instant auth, RLS security, managed PostgreSQL |
| **AI Engine** | Groq (Llama 3.3 70B) | Industry-leading inference speed — drafts generate in <1s |
| **Email Delivery** | Nodemailer + Gmail SMTP | "Bring your own email" ensures deliverability; no shared domains |
| **Background Jobs** | Upstash QStash | Serverless scheduling without always-on workers |

### Key Engineering Decisions

- **Server Actions over REST APIs** — Reduced boilerplate by 60%, eliminated client-server serialization overhead
- **QStash over traditional queues** — No Redis/Celery worker infrastructure to maintain; purely serverless delayed execution
- **Gmail App Passwords over OAuth** — Simpler initial setup for users; OAuth planned for v2
- **Real-time scraping vs. pre-cached** — Ensures prospect context is always fresh, with graceful timeout handling

![Prospects](docs/assets/prospect.png)

## Results

| Metric | Value |
|--------|-------|
| Prospects processed | 1,000+ |
| Personalized drafts generated | 500+ |
| Manual time saved | ~40 hours |
| AI generation latency | <1 second |
| Email deliverability | 98%+ (own Gmail) |

## Tradeoffs & What's Next

**Conscious Tradeoffs:**
- Gmail App Passwords require slightly more manual setup than OAuth, but avoid enterprise-scale OAuth app review processes
- Synchronous scraping during generation can occasionally timeout on slow external sites — an async background queue is planned

**Roadmap:**
- Queue-based bulk CSV processing for 10k+ prospect imports
- Multi-tenant team functionality for collaborative outreach
- Native Gmail/Outlook OAuth to streamline onboarding
- A/B testing for email subject lines and body variants

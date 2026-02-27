# ProspectIQ

ProspectIQ is an AI-driven discovery and outreach engine. It enables professionals to effortlessly find, enrich, and contact potential leads at scale using automated, highly personalized email sequences.

## Purpose

The modern outreach process is broken—generic emails get ignored, and manual personalization takes too much time. ProspectIQ bridges this gap by automatically researching prospects and using AI (Llama 3.3 via Groq) to craft hyper-relevant messages that get replies, sent securely right from your own connected Gmail account.

## Features

- **Prospect Management:** Store and organize your contacts.
- **Automated Enrichment:** Scrape prospect company websites to gain valuable context.
- **AI Email Generation:** Automatically draft personalized emails based on prospect data and enrichment context.
- **Campaign Sequences:** Create multi-step drip campaigns to follow up automatically.
- **Bring Your Own Email:** Send campaigns directly through your own Google Workspace / Gmail account via SMTP App Passwords to guarantee deliverability.
- **Built-in Analytics:** Track prospects, sent emails, and reply rates from a sleek dashboard.

## Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS
- **Backend:** Next.js Server Actions & API Routes, Supabase (Postgres & Auth)
- **AI Integration:** Groq (Llama 3.3 70B)
- **Email Delivery:** Nodemailer (Gmail SMTP)
- **Automation Scheduler:** Upstash QStash

## Getting Started

1. **Clone the repository**
2. **Install dependencies:** `npm install`
3. **Set up Environment Variables:** Create a `.env` file based on `.env.example` (you will need Supabase, Groq, and QStash credentials).
4. **Run the development server:** `npm run dev`
5. **Open your browser:** Navigate to `http://localhost:3000`

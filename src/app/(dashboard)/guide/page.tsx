import type { Metadata } from "next";
import Link from "next/link";
import "./guide.css";

export const metadata: Metadata = {
    title: "Getting Started — ProspectIQ",
    description: "Learn how to use ProspectIQ to discover prospects, generate AI emails, and automate outreach.",
};

const steps = [
    {
        number: "01",
        title: "Add Your Prospects",
        icon: (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="7" r="4" />
                <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
                <path d="M19 8v6M16 11h6" />
            </svg>
        ),
        color: "purple",
        what: "Prospects are the people you want to reach out to — potential clients, partners, leads, or hiring managers. Each prospect is a contact with their name, email, company, and role.",
        why: "Everything in ProspectIQ starts with prospects. You need contacts in your database before you can generate personalized emails or run automated campaigns.",
        how: [
            "Go to the **Prospects** page from the sidebar",
            "Click **\"Add Prospect\"** to add contacts one by one",
            "Fill in their details: name, email, company, role, and LinkedIn URL",
            "Or use **CSV Import** (coming soon) to bulk-upload hundreds at once",
        ],
        tip: "The more details you add (company, role), the better the AI can personalize emails later.",
        link: "/prospects",
        linkLabel: "Go to Prospects →",
    },
    {
        number: "02",
        title: "Generate AI-Powered Emails",
        icon: (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
            </svg>
        ),
        color: "blue",
        what: "ProspectIQ uses Groq's Llama 3.3 AI to write personalized outreach emails for each prospect. The AI uses their name, company, and role to craft relevant, human-sounding messages.",
        why: "Generic emails get ignored. Personalized emails that reference a prospect's company and role get 3-5x higher response rates. The AI does this at scale — in seconds, not hours.",
        how: [
            "Click **\"Generate Draft\"** on any prospect's row",
            "The AI writes a personalized subject line + email body",
            "Review and edit the draft to match your voice",
            "Click **\"Send\"** to deliver it via email, or save it for a campaign",
        ],
        tip: "Always review AI drafts before sending. Add a personal touch — mention something specific about their company for even better results.",
        status: "Coming in Phase 2",
    },
    {
        number: "03",
        title: "Send Emails via Brevo",
        icon: (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
        ),
        color: "green",
        what: "Brevo is the email delivery service that actually sends your emails. ProspectIQ connects to Brevo's free tier (300 emails/day) to deliver messages directly to your prospects' inboxes.",
        why: "You can't send bulk emails from your personal Gmail — they'd get flagged as spam. Brevo handles deliverability, tracking, and compliance so your emails actually arrive.",
        how: [
            "After generating an AI draft, click **\"Send Email\"**",
            "ProspectIQ sends it through Brevo's API",
            "Every sent email is logged with timestamp and status",
            "Track your daily send count on the Dashboard (0 / 300)",
        ],
        tip: "Brevo's free tier gives you 300 emails/day — that's plenty for targeted outreach. Quality over quantity.",
        status: "Coming in Phase 2",
    },
    {
        number: "04",
        title: "Create Automated Campaigns",
        icon: (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M3 10h18" />
                <path d="M8 2v4M16 2v4" />
                <path d="M8 14l2 2 4-4" />
            </svg>
        ),
        color: "amber",
        what: "Campaigns are automated multi-step email sequences. You define a series of emails (introduction → follow-up → final check-in) with delays between each step. ProspectIQ sends them automatically.",
        why: "Most prospects don't reply to the first email. Studies show you need 3-5 touchpoints. Campaigns automate this so you don't have to remember to follow up manually — the system does it for you.",
        how: [
            "Go to **Campaigns** and click **\"Create Campaign\"**",
            "Name your campaign (e.g., \"Q1 SaaS Founders Outreach\")",
            "Add **Steps**: each step has a delay (e.g., 3 days) and a prompt template",
            "Assign prospects to the campaign",
            "Click **\"Start\"** — ProspectIQ will send Step 1 immediately, then wait, then send Step 2, etc.",
        ],
        tip: "A classic 3-step sequence: Day 1 = Introduction, Day 4 = Follow-up with value, Day 8 = Friendly break-up email. Keep each email short and focused.",
        status: "Coming in Phase 3",
    },
    {
        number: "05",
        title: "Track Everything on the Dashboard",
        icon: (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" rx="1" />
                <rect x="14" y="3" width="7" height="5" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="10" width="7" height="11" rx="1" />
            </svg>
        ),
        color: "rose",
        what: "The Dashboard gives you a bird's-eye view of your outreach pipeline: total prospects, active campaigns, emails sent today, and reply rate.",
        why: "You need visibility into what's working. The dashboard helps you track your outreach volume and identify which campaigns get the best response rates.",
        how: [
            "Open the **Dashboard** (it's your home page after login)",
            "See at-a-glance stats for your outreach activity",
            "Use Quick Actions to jump to common tasks",
            "Monitor your daily email quota usage",
        ],
        tip: "Check your dashboard daily. If a campaign has a 0% reply rate after Step 2, consider pausing it and tweaking your messaging.",
        link: "/dashboard",
        linkLabel: "Go to Dashboard →",
    },
];

const glossary = [
    { term: "Prospect", definition: "A person you want to contact — your potential lead or client." },
    { term: "Campaign", definition: "An automated multi-step email sequence sent to a group of prospects." },
    { term: "Step", definition: "One email in a campaign sequence, with a delay and AI prompt template." },
    { term: "Draft", definition: "An AI-generated email that you can edit before sending." },
    { term: "RLS", definition: "Row Level Security — Supabase ensures you can only see your own data." },
    { term: "Brevo", definition: "The email delivery service (300 free emails/day)." },
    { term: "Groq", definition: "The AI provider powering email generation (Llama 3.3 70B model)." },
    { term: "QStash", definition: "Serverless scheduler that sends campaign emails at the right time." },
];

export default function GuidePage() {
    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Getting Started 🚀</h1>
                <p className="page-subtitle">
                    Learn how ProspectIQ works — from adding your first prospect to running automated outreach campaigns.
                </p>
            </div>

            {/* How It Works Overview */}
            <div className="guide-flow">
                <div className="guide-flow-step">
                    <div className="guide-flow-num">1</div>
                    <span>Add Prospects</span>
                </div>
                <div className="guide-flow-arrow">→</div>
                <div className="guide-flow-step">
                    <div className="guide-flow-num">2</div>
                    <span>AI Writes Emails</span>
                </div>
                <div className="guide-flow-arrow">→</div>
                <div className="guide-flow-step">
                    <div className="guide-flow-num">3</div>
                    <span>Send via Brevo</span>
                </div>
                <div className="guide-flow-arrow">→</div>
                <div className="guide-flow-step">
                    <div className="guide-flow-num">4</div>
                    <span>Automate Sequences</span>
                </div>
                <div className="guide-flow-arrow">→</div>
                <div className="guide-flow-step">
                    <div className="guide-flow-num">5</div>
                    <span>Track Results</span>
                </div>
            </div>

            {/* Step-by-Step Guides */}
            <div className="guide-steps">
                {steps.map((step) => (
                    <div key={step.number} className="guide-card">
                        <div className="guide-card-header">
                            <div className={`guide-card-icon ${step.color}`}>{step.icon}</div>
                            <div>
                                <span className="guide-card-num">Step {step.number}</span>
                                <h2 className="guide-card-title">{step.title}</h2>
                            </div>
                            {step.status && <span className="guide-badge">{step.status}</span>}
                        </div>

                        <div className="guide-card-body">
                            <div className="guide-section">
                                <h3 className="guide-section-label">What is it?</h3>
                                <p>{step.what}</p>
                            </div>

                            <div className="guide-section">
                                <h3 className="guide-section-label">Why does it matter?</h3>
                                <p>{step.why}</p>
                            </div>

                            <div className="guide-section">
                                <h3 className="guide-section-label">How to use it</h3>
                                <ol className="guide-steps-list">
                                    {step.how.map((h, i) => (
                                        <li key={i} dangerouslySetInnerHTML={{ __html: h }} />
                                    ))}
                                </ol>
                            </div>

                            <div className="guide-tip">
                                <span className="guide-tip-icon">💡</span>
                                <span>{step.tip}</span>
                            </div>

                            {step.link && (
                                <Link href={step.link} className="guide-card-link">
                                    {step.linkLabel}
                                </Link>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Glossary */}
            <div className="guide-glossary">
                <h2 className="guide-glossary-title">📖 Glossary</h2>
                <div className="guide-glossary-grid">
                    {glossary.map((item) => (
                        <div key={item.term} className="guide-glossary-item">
                            <dt>{item.term}</dt>
                            <dd>{item.definition}</dd>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}

import Link from "next/link";
import { ArrowRight, Box, Zap, Lock, BarChart3, Mail, Layers } from "lucide-react"; // Wait, lucide-react might not be installed. Let me check the package.json.
// Actually, I should use standard SVGs to be safe, or just check package.json. I remember it only had recharts, supabase, tailwind. Let's use simple SVG icons.

const FeatureCard = ({ title, description, icon }: { title: string, description: string, icon: React.ReactNode }) => (
    <div className="flex flex-col gap-4 p-8 rounded-2xl bg-[#0a0a0a] border border-[#ffffff1a] transition-all hover:bg-[#111111] hover:border-[#ffffff33]">
        <div className="w-12 h-12 rounded-lg bg-[#ffffff0a] flex items-center justify-center border border-[#ffffff1a] text-[#ededed]">
            {icon}
        </div>
        <h3 className="text-xl font-medium text-[#ededed] tracking-tight">{title}</h3>
        <p className="text-[#a1a1aa] leading-relaxed">{description}</p>
    </div>
);

export function LandingPage() {
    return (
        <div className="min-h-screen bg-[#000000] text-[#ededed] selection:bg-[#ededed] selection:text-[#000000]">
            {/* Navbar */}
            <header className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 bg-[#000000]/50 backdrop-blur-md border-b border-[#ffffff0a]">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-[#ededed] flex items-center justify-center">
                        <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                            <path d="M10 16L14 20L22 12" stroke="#000000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <span className="font-semibold text-lg tracking-tight">ProspectIQ</span>
                </div>
                <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#a1a1aa]">
                    <Link href="#features" className="hover:text-[#ededed] transition-colors">Features</Link>
                    <Link href="#how-it-works" className="hover:text-[#ededed] transition-colors">How it works</Link>
                    <Link href="#pricing" className="hover:text-[#ededed] transition-colors">Pricing</Link>
                </nav>
                <div className="flex items-center gap-4">
                    <Link href="/login" className="text-sm font-medium text-[#a1a1aa] hover:text-[#ededed] transition-colors">
                        Log in
                    </Link>
                    <Link href="/login" className="px-4 py-2 rounded-md bg-[#ededed] text-[#000000] text-sm font-medium hover:bg-[#ffffff] transition-colors">
                        Get Started
                    </Link>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative pt-40 pb-20 md:pt-52 md:pb-32 px-6 md:px-12 flex flex-col items-center text-center overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#ededed] opacity-[0.03] blur-[120px] rounded-full pointer-events-none" />

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ffffff0a] border border-[#ffffff1a] mb-8 text-sm text-[#a1a1aa]">
                    <span className="flex w-2 h-2 rounded-full bg-[#10b981]" />
                    ProspectIQ 2.0 is now live
                </div>

                <h1 className="text-5xl md:text-7xl font-semibold tracking-tighter mb-6 max-w-4xl text-balance bg-clip-text text-transparent bg-gradient-to-b from-[#ffffff] to-[#a1a1aa]">
                    Zero-Cost Outreach,<br /> Infinite Scale.
                </h1>

                <p className="text-lg md:text-xl text-[#a1a1aa] max-w-2xl mb-10 text-balance leading-relaxed">
                    Discover prospects, generate AI-powered sequence emails, and automate your entire outreach workflow—all on free-tier infrastructure.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                    <Link href="/login" className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-lg bg-[#ededed] text-[#000000] font-medium hover:bg-[#ffffff] transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                        Start Deploying Free
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </Link>
                    <a href="#features" className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-lg bg-transparent text-[#ededed] font-medium border border-[#ffffff1a] hover:bg-[#ffffff0a] transition-colors">
                        Explore Features
                    </a>
                </div>
            </section>

            {/* Hero Dashboard Preview */}
            <section className="px-6 md:px-12 pb-32 max-w-6xl mx-auto">
                <div className="relative rounded-2xl overflow-hidden border border-[#ffffff1a] bg-[#0a0a0a] shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#000000]/80 to-transparent z-10" />
                    <div className="h-10 border-b border-[#ffffff1a] bg-[#111111] flex items-center px-4 gap-2">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-[#3f3f46]" />
                            <div className="w-3 h-3 rounded-full bg-[#3f3f46]" />
                            <div className="w-3 h-3 rounded-full bg-[#3f3f46]" />
                        </div>
                        <div className="mx-auto w-1/3 h-5 bg-[#18181b] rounded border border-[#ffffff0a]" />
                    </div>
                    <div className="p-8 grid grid-cols-3 gap-6 opacity-80">
                        <div className="col-span-1 h-32 rounded-xl bg-[#111111] border border-[#ffffff0a]" />
                        <div className="col-span-2 h-32 rounded-xl bg-[#111111] border border-[#ffffff0a]" />
                        <div className="col-span-3 h-64 rounded-xl bg-[#111111] border border-[#ffffff0a]" />
                    </div>
                </div>
            </section>

            {/* Features Outline */}
            <section id="features" className="py-24 px-6 md:px-12 bg-[#050505] border-t border-[#ffffff0a]">
                <div className="max-w-6xl mx-auto">
                    <div className="mb-16">
                        <h2 className="text-3xl md:text-5xl font-semibold tracking-tighter mb-4 text-[#ededed]">
                            Built for performance.
                        </h2>
                        <p className="text-lg text-[#a1a1aa] max-w-2xl">
                            Everything you need to launch world-class unmetered cold email campaigns without the enterprise software price tag.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <FeatureCard
                            title="Automated Discovery"
                            description="Scrape and identify high-value prospects securely from the web to build your pipeline fast."
                            icon={
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            }
                        />
                        <FeatureCard
                            title="AI Generation"
                            description="Leverage Groq's high-speed inference to write hyper-personalized outreach sequences in milliseconds."
                            icon={
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            }
                        />
                        <FeatureCard
                            title="Smart Schedulers"
                            description="Built-in QStash queuing ensures you stay within free-tier email constraints automatically."
                            icon={
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            }
                        />
                        <FeatureCard
                            title="Multi-Provider Routing"
                            description="Fallback support for Google, Brevo, and Resend. Never miss a send due to API rate limits."
                            icon={
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            }
                        />
                        <FeatureCard
                            title="Inbox Health"
                            description="Intelligent delay routing and human-like sending patterns mean your emails actually reach the primary inbox."
                            icon={
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            }
                        />
                        <FeatureCard
                            title="Comprehensive Analytics"
                            description="Real-time open and click tracking metrics built right into your dashboard."
                            icon={
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            }
                        />
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-32 px-6 md:px-12 relative overflow-hidden flex flex-col items-center text-center">
                <div className="absolute inset-0 bg-gradient-to-b from-[#050505] to-[#111111] -z-10" />
                <h2 className="text-4xl md:text-5xl font-semibold tracking-tighter mb-6 text-[#ededed]">
                    Ready to scale your outreach?
                </h2>
                <p className="text-[#a1a1aa] mb-10 max-w-xl text-lg">
                    Join the next generation of sales teams leveraging AI and free-tier infrastructure.
                </p>
                <Link href="/login" className="px-8 py-4 rounded-lg bg-[#ededed] text-[#000000] font-semibold hover:bg-[#ffffff] transition-colors">
                    Start for free
                </Link>
            </section>

            {/* Footer */}
            <footer className="border-t border-[#ffffff0a] py-12 px-6 md:px-12 bg-[#000000]">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-[#ededed] flex items-center justify-center">
                            <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                                <path d="M10 16L14 20L22 12" stroke="#000000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <span className="font-semibold text-[#ededed] tracking-tight text-sm">ProspectIQ</span>
                    </div>
                    <div className="text-sm text-[#71717a]">
                        &copy; {new Date().getFullYear()} ProspectIQ. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    );
}

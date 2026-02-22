"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CampaignStep } from "@/types/database";
import { addStep, updateStep, removeStep } from "@/app/campaigns/actions";

/* ── Delay options for the dropdown ── */

const DELAY_OPTIONS = [
    { value: 0, label: "Immediately" },
    { value: 1, label: "1 day" },
    { value: 2, label: "2 days" },
    { value: 3, label: "3 days" },
    { value: 4, label: "4 days" },
    { value: 5, label: "5 days" },
    { value: 7, label: "7 days" },
    { value: 10, label: "10 days" },
    { value: 14, label: "14 days" },
];

/* ── Placeholder prompts for new steps ── */

const STEP_PLACEHOLDERS = [
    "Write an introductory cold email. Mention their role at {{company_name}} and offer a relevant value proposition.",
    "Write a friendly follow-up referencing the first email. Keep it shorter and add social proof.",
    "Write a polite breakup email. Give one last reason to reply and wish them well.",
];

/* ── Props ── */

interface StepBuilderProps {
    campaignId: string;
    initialSteps: CampaignStep[];
    readOnly?: boolean;
}

export function StepBuilder({ campaignId, initialSteps, readOnly }: StepBuilderProps) {
    const router = useRouter();
    const [steps, setSteps] = useState(initialSteps);
    const [saving, setSaving] = useState<string | null>(null); // step id being saved
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showGuide, setShowGuide] = useState(false);

    /* ── Add step ── */
    async function handleAdd() {
        setAdding(true);
        setError(null);

        const nextOrder = steps.length + 1;
        const defaultDelay = nextOrder === 1 ? 0 : nextOrder === 2 ? 3 : 4;
        const placeholder = STEP_PLACEHOLDERS[Math.min(nextOrder - 1, STEP_PLACEHOLDERS.length - 1)];

        const { data, error: err } = await addStep(campaignId, nextOrder, defaultDelay, placeholder);
        if (err) {
            setError(err);
        } else if (data) {
            setSteps([...steps, data]);
        }
        setAdding(false);
        router.refresh();
    }

    /* ── Update step ── */
    async function handleUpdate(step: CampaignStep, delayDays: number, promptTemplate: string) {
        setSaving(step.id);
        setError(null);

        const { error: err } = await updateStep(step.id, delayDays, promptTemplate);
        if (err) {
            setError(err);
        } else {
            setSteps(steps.map((s) =>
                s.id === step.id ? { ...s, delay_days: delayDays, prompt_template: promptTemplate } : s
            ));
        }
        setSaving(null);
    }

    /* ── Remove step ── */
    async function handleRemove(stepId: string) {
        setSaving(stepId);
        setError(null);

        const { error: err } = await removeStep(stepId, campaignId);
        if (err) {
            setError(err);
        } else {
            const remaining = steps.filter((s) => s.id !== stepId);
            // Update local step_order
            setSteps(remaining.map((s, i) => ({ ...s, step_order: i + 1 })));
        }
        setSaving(null);
        router.refresh();
    }

    return (
        <div className="step-builder">
            <div className="step-builder-header">
                <h2 className="step-builder-title">
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3h10v3H3z" />
                        <path d="M3 10h10v3H3z" />
                        <path d="M8 6v4" />
                    </svg>
                    Email Sequence
                </h2>
                <div className="step-builder-header-right">
                    <span className="step-builder-count">{steps.length} step{steps.length !== 1 ? "s" : ""}</span>
                    <button
                        className="step-info-toggle"
                        onClick={() => setShowGuide(!showGuide)}
                        title="How does the email sequence work?"
                    >
                        ℹ️
                    </button>
                </div>
            </div>

            {showGuide && (
                <div className="step-guide-banner">
                    <p><strong>How it works:</strong> Each step generates a personalized email using AI. When you launch the campaign:</p>
                    <ol>
                        <li><strong>Step 1</strong> sends immediately to all prospects in the campaign.</li>
                        <li><strong>Follow-ups</strong> are scheduled automatically after the delay you set (e.g. 3 days after the previous step).</li>
                        <li>The <strong>AI Prompt</strong> tells the AI what kind of email to write — it will personalize each email using the prospect&apos;s name, role, and company.</li>
                    </ol>
                    <p className="step-guide-tip">💡 <strong>Tip:</strong> 3 steps is the sweet spot — intro, follow-up, and breakup email.</p>
                </div>
            )}

            {error && <div className="alert-error" style={{ marginBottom: "0.75rem" }}>{error}</div>}

            {/* Steps timeline */}
            <div className="steps-timeline">
                {steps.map((step, idx) => (
                    <StepCard
                        key={step.id}
                        step={step}
                        index={idx}
                        isFirst={idx === 0}
                        saving={saving === step.id}
                        readOnly={readOnly}
                        onUpdate={(delay, prompt) => handleUpdate(step, delay, prompt)}
                        onRemove={() => handleRemove(step.id)}
                    />
                ))}
            </div>

            {/* Add step button */}
            {!readOnly && (
                <button
                    className="step-add-btn"
                    onClick={handleAdd}
                    disabled={adding}
                >
                    {adding ? "Adding…" : `+ Add Step ${steps.length + 1}`}
                </button>
            )}
        </div>
    );
}

/* ── Individual Step Card ── */

interface StepCardProps {
    step: CampaignStep;
    index: number;
    isFirst: boolean;
    saving: boolean;
    readOnly?: boolean;
    onUpdate: (delayDays: number, promptTemplate: string) => void;
    onRemove: () => void;
}

const STEP_INFO: Record<string, { what: string; how: string }> = {
    initial: {
        what: "The first email each prospect receives. This is your cold outreach — make a strong first impression.",
        how: "Sent immediately when you launch the campaign. The AI uses the prompt below plus the prospect's name, role, and company to generate a personalized email.",
    },
    followup: {
        what: "A follow-up email for prospects who haven't replied. Keep it shorter and reference the previous email.",
        how: "Automatically scheduled after the delay you set. Only sent to prospects who haven't replied to previous steps.",
    },
    breakup: {
        what: "The final email — a polite 'breakup' that gives one last compelling reason to reply.",
        how: "Scheduled after the delay. This is your last touch — keep it brief, friendly, and give them an easy out.",
    },
};

function getStepInfo(index: number): { what: string; how: string } {
    if (index === 0) return STEP_INFO.initial;
    if (index >= 2) return STEP_INFO.breakup;
    return STEP_INFO.followup;
}

function StepCard({ step, index, isFirst, saving, readOnly, onUpdate, onRemove }: StepCardProps) {
    const [delay, setDelay] = useState(step.delay_days);
    const [prompt, setPrompt] = useState(step.prompt_template ?? "");
    const [dirty, setDirty] = useState(false);
    const [showInfo, setShowInfo] = useState(false);

    function handleDelayChange(val: number) {
        setDelay(val);
        setDirty(true);
    }

    function handlePromptChange(val: string) {
        setPrompt(val);
        setDirty(true);
    }

    function handleSave() {
        onUpdate(delay, prompt);
        setDirty(false);
    }

    const stepLabel = isFirst ? "📨 Initial Email" : `📩 Follow-up ${index}`;
    const delayLabel = delay === 0 ? "Sent immediately" : `Wait ${delay} day${delay !== 1 ? "s" : ""} after previous`;
    const info = getStepInfo(index);

    return (
        <div className="step-card">
            {/* Timeline connector */}
            {!isFirst && (
                <div className="step-connector">
                    <div className="step-connector-line" />
                    <span className="step-connector-label">⏳ {delayLabel}</span>
                    <div className="step-connector-line" />
                </div>
            )}

            <div className="step-card-inner">
                {/* Header */}
                <div className="step-card-header">
                    <div className="step-number">Step {index + 1}</div>
                    <span className="step-type-label">{stepLabel}</span>
                    <button
                        className="step-card-info-btn"
                        onClick={() => setShowInfo(!showInfo)}
                        title="What does this step do?"
                    >
                        ℹ️
                    </button>
                    {saving && <span className="step-saving">Saving…</span>}
                    {!readOnly && !saving && (
                        <button className="step-remove-btn" onClick={onRemove} title="Remove step">
                            ✕
                        </button>
                    )}
                </div>

                {showInfo && (
                    <div className="step-info-panel">
                        <p><strong>What:</strong> {info.what}</p>
                        <p><strong>How:</strong> {info.how}</p>
                    </div>
                )}

                {/* Delay picker */}
                {!isFirst && !readOnly && (
                    <div className="step-field">
                        <label className="step-field-label">Delay</label>
                        <select
                            className="step-delay-select"
                            value={delay}
                            onChange={(e) => handleDelayChange(Number(e.target.value))}
                        >
                            {DELAY_OPTIONS.filter((o) => o.value > 0).map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Prompt template */}
                <div className="step-field">
                    <label className="step-field-label">AI Prompt Instructions</label>
                    {readOnly ? (
                        <p className="step-prompt-preview">{prompt || "No instructions set."}</p>
                    ) : (
                        <textarea
                            className="step-prompt-textarea"
                            value={prompt}
                            onChange={(e) => handlePromptChange(e.target.value)}
                            placeholder="e.g. Write a polite breakup email that references the previous follow-up and gives one compelling reason to reply."
                            rows={4}
                        />
                    )}
                </div>

                {/* Save button */}
                {dirty && !readOnly && (
                    <button className="btn-primary btn-sm step-save-btn" onClick={handleSave} disabled={saving}>
                        {saving ? "Saving…" : "Save Changes"}
                    </button>
                )}
            </div>
        </div>
    );
}

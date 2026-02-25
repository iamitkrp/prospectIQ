import { getUserSettings } from "./actions";
import { SmtpForm } from "./smtp-form";
import "./settings.css";

export const metadata = {
    title: "Settings - ProspectIQ",
};

export default async function SettingsPage() {
    const settings = await getUserSettings();

    return (
        <div className="settings-page">
            <div className="page-header">
                <h1 className="page-title">Settings</h1>
                <p className="page-subtitle">Manage your account and email sending preferences.</p>
            </div>

            <div className="settings-card">
                <div className="settings-card-header">
                    <div className="settings-card-header-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="settings-card-title">Email Sending (SMTP)</h2>
                        <p className="settings-card-desc">
                            Connect your Gmail to send campaigns from your own email address.
                        </p>
                    </div>
                </div>

                <div className="settings-card-body">
                    <div className="smtp-instructions">
                        <h3 className="smtp-instructions-title">How to connect</h3>
                        <ol className="smtp-steps">
                            <li>
                                Go to your{" "}
                                <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer">
                                    Google Account Security
                                </a>
                            </li>
                            <li>
                                Turn on <strong>2-Step Verification</strong>
                            </li>
                            <li>
                                Search for <strong>App Passwords</strong>
                            </li>
                            <li>
                                Create one named <strong>&quot;ProspectIQ&quot;</strong> — Google gives you a 16-letter code
                            </li>
                            <li>
                                Paste that code and your email here →
                            </li>
                        </ol>
                    </div>

                    <div className="smtp-form-wrapper">
                        <SmtpForm initialSettings={settings} />
                    </div>
                </div>
            </div>
        </div>
    );
}

import { getUserSettings, saveSmtpSettings, disconnectSmtpSettings, verifySmtpConnection } from "./actions";
import { SmtpForm } from "./smtp-form";

export const metadata = {
    title: "Settings - ProspectIQ",
};

export default async function SettingsPage() {
    const settings = await getUserSettings();

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
                <p className="text-gray-500">Manage your account and email sending preferences.</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900">Email Sending (SMTP)</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Connect your Gmail account to send campaigns directly from your own email.
                        This ensures higher deliverability and keeps your sent emails in your own Gmail outbox.
                    </p>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="text-md font-semibold text-gray-800 mb-3">How to connect:</h3>
                        <ol className="list-decimal list-inside space-y-3 text-sm text-gray-600">
                            <li>
                                Go to your <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Google Account Security settings</a>.
                            </li>
                            <li>
                                Ensure <strong>2-Step Verification</strong> is turned on.
                            </li>
                            <li>
                                Search for <strong>App Passwords</strong> in the security settings.
                            </li>
                            <li>
                                Create a new app password named <strong>ProspectIQ</strong>. Google will give you a 16-letter code.
                            </li>
                            <li>
                                Paste that code and your email address here.
                            </li>
                        </ol>
                    </div>

                    <div>
                        <SmtpForm
                            initialSettings={settings}
                            saveSettings={saveSmtpSettings}
                            disconnectSettings={disconnectSmtpSettings}
                            verifyConnection={verifySmtpConnection}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

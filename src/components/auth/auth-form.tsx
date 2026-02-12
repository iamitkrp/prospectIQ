"use client";

import { useState } from "react";
import Link from "next/link";

interface AuthFormProps {
    mode: "login" | "signup";
    action: (formData: FormData) => Promise<{ error?: string; success?: string } | void>;
}

export function AuthForm({ mode, action }: AuthFormProps) {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const isLogin = mode === "login";

    async function handleSubmit(formData: FormData) {
        setError(null);
        setSuccess(null);
        setLoading(true);

        try {
            const result = await action(formData);

            if (result && "error" in result && result.error) {
                setError(result.error);
            }
            if (result && "success" in result && result.success) {
                setSuccess(result.success);
            }
        } catch {
            // redirect() throws a NEXT_REDIRECT error — that's expected
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-card">
            <div className="auth-header">
                <div className="auth-logo">
                    <svg
                        width="32"
                        height="32"
                        viewBox="0 0 32 32"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <rect width="32" height="32" rx="8" fill="url(#logo-gradient)" />
                        <path
                            d="M10 16L14 20L22 12"
                            stroke="white"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <defs>
                            <linearGradient id="logo-gradient" x1="0" y1="0" x2="32" y2="32">
                                <stop stopColor="#6366f1" />
                                <stop offset="1" stopColor="#8b5cf6" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <span className="auth-logo-text">ProspectIQ</span>
                </div>
                <h1 className="auth-title">
                    {isLogin ? "Welcome back" : "Create your account"}
                </h1>
                <p className="auth-subtitle">
                    {isLogin
                        ? "Sign in to your account to continue"
                        : "Get started with your free account"}
                </p>
            </div>

            <form action={handleSubmit} className="auth-form">
                <div className="form-group">
                    <label htmlFor="email" className="form-label">
                        Email address
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        placeholder="you@example.com"
                        className="form-input"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="password" className="form-label">
                        Password
                    </label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete={isLogin ? "current-password" : "new-password"}
                        required
                        minLength={6}
                        placeholder="••••••••"
                        className="form-input"
                    />
                </div>

                {error && (
                    <div className="form-error" role="alert">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0V5zm.75 6.25a.75.75 0 100-1.5.75.75 0 000 1.5z" />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="form-success" role="status">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.22 5.97l-4 4a.75.75 0 01-1.06 0l-2-2a.75.75 0 111.06-1.06L6.69 9.4l3.47-3.47a.75.75 0 111.06 1.06z" />
                        </svg>
                        <span>{success}</span>
                    </div>
                )}

                <button type="submit" className="form-button" disabled={loading}>
                    {loading ? (
                        <span className="button-loading">
                            <svg className="spinner" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" />
                            </svg>
                            {isLogin ? "Signing in…" : "Creating account…"}
                        </span>
                    ) : (
                        isLogin ? "Sign in" : "Create account"
                    )}
                </button>
            </form>

            <div className="auth-footer">
                <p>
                    {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                    <Link href={isLogin ? "/signup" : "/login"} className="auth-link">
                        {isLogin ? "Sign up" : "Sign in"}
                    </Link>
                </p>
            </div>
        </div>
    );
}

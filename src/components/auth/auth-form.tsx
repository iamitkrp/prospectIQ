"use client";

import { useState } from "react";
import Link from "next/link";
import { signInWithGoogle } from "@/app/auth/actions";

interface AuthFormProps {
    mode: "login" | "signup";
    action: (formData: FormData) => Promise<{ error?: string; success?: string } | void>;
}

export function AuthForm({ mode, action }: AuthFormProps) {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

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
            if (result && "redirect" in result && (result as { redirect: string }).redirect) {
                // Full page navigation to ensure cookies are sent with the request
                window.location.href = (result as { redirect: string }).redirect;
                return;
            }
        } catch {
            // redirect() throws a NEXT_REDIRECT error — that's expected
        } finally {
            setLoading(false);
        }
    }

    async function handleGoogleSignIn() {
        setError(null);
        setGoogleLoading(true);

        try {
            const result = await signInWithGoogle();
            if (result && "error" in result && result.error) {
                setError(result.error);
            }
        } catch {
            // redirect() throws — expected
        } finally {
            setGoogleLoading(false);
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

            {/* Google OAuth */}
            <button
                type="button"
                className="google-button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
            >
                {googleLoading ? (
                    <span className="button-loading">
                        <svg className="spinner" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" />
                        </svg>
                        Redirecting…
                    </span>
                ) : (
                    <>
                        <svg width="18" height="18" viewBox="0 0 18 18">
                            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
                            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                    </>
                )}
            </button>

            {/* Divider */}
            <div className="auth-divider">
                <span>or</span>
            </div>

            {/* Email/Password Form */}
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

                <button type="submit" className="form-button" disabled={loading || googleLoading}>
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

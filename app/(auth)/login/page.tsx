'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/app/components/Logo';
import { EyeIcon, EyeOffIcon, LoaderIcon } from 'lucide-react';

export default function LoginPage() {
  const { user, loading, authError, signInWithGoogle, signInWithEmail } = useAuth();
  const router = useRouter();

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/campaign');
  }, [user, loading, router]);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    await signInWithEmail(email.trim().toLowerCase(), password);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="panel w-full max-w-md p-10 flex flex-col items-center gap-7 animate-fade-in">

        {/* Logo / Brand */}
        <div className="flex flex-col items-center gap-3">
          <Logo size="md" />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Bulk Email Engine</h1>
            <p className="text-sm text-gray-500 mt-1">Enterprise Campaign Management</p>
          </div>
        </div>

        <div className="w-full h-px bg-gray-200" />

        {/* Error banner */}
        {authError && (
          <div className="w-full px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 text-center">
            {authError}
          </div>
        )}

        {/* Email / password form */}
        <form onSubmit={handleEmailSignIn} className="w-full flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-900
                         placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500
                         focus:border-brand-500 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full px-3 py-2.5 pr-10 rounded-lg border border-gray-300 bg-white text-sm text-gray-900
                           placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500
                           focus:border-brand-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPass ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                       bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {submitting ? <LoaderIcon className="w-4 h-4 animate-spin" /> : null}
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Divider */}
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Google sign-in */}
        <button
          onClick={signInWithGoogle}
          disabled={loading || submitting}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg
                     bg-white text-gray-800 font-medium text-sm
                     border border-gray-300 hover:bg-gray-50 active:bg-gray-100
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors duration-150 shadow-sm"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>

        <p className="text-xs text-gray-400 text-center">
          Access restricted to authorised personnel only.
        </p>
      </div>
    </div>
  );
}

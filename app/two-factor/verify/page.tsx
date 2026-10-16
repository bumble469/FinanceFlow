'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export default function TwoFactorVerifyPage() {
    const router = useRouter();
    const [code, setCode] = useState('');
    const [useBackup, setUseBackup] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const sentOnLoad = useRef(false);
    const [remaining, setRemaining] = useState(3);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const sendCode = async (initial = false) => {
        setError('');
        setNotice('');
        setResending(true);
        try {
            const res = await fetch('/api/auth/two-factor/challenge', { method: 'POST' });
            const result = await res.json().catch(() => ({}));
            if (res.status === 401) { router.push('/login'); return; }
            if (res.status === 429) {
                if (typeof result.remaining === 'number') setRemaining(result.remaining);
                if (!initial || result.remaining === 0) {
                    setError(result.error || 'Please wait before requesting another code.');
                }
                return;
            }
            if (!res.ok) { setError(result.error || 'Could not send code'); return; }
            setNotice(result.destination?.value ? `Code sent to ${result.destination.value}` : 'Code sent');
            setRemaining(result.remaining ?? 0);
            setCooldown(30);
        } catch {
            setError('Could not send code');
        } finally {
            setResending(false);
        }
    };

    useEffect(() => {
        if (sentOnLoad.current) return;
        sentOnLoad.current = true;
        sendCode(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const normalized = useBackup ? code.replace(/[\s-]/g, '') : code;
    const ready = useBackup ? normalized.length === 8 : code.length === 6;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/two-factor/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: normalized }),
            });
            const result = await res.json().catch(() => ({}));
            if (res.status === 401) { router.push('/login'); return; }
            if (!res.ok) { setError(result.error || 'Verification failed'); return; }
            router.push('/');
            router.refresh();
        } catch {
            setError('Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="w-full max-w-md px-4 py-8">
                <h1 className="text-2xl font-bold mb-2">Two-step verification</h1>
                <p className="text-muted-foreground mb-6">
                    {useBackup
                        ? 'Enter one of your 8-character backup codes.'
                        : 'Enter the 6-digit code sent to your recovery contact.'}
                </p>

                {notice && <p className="mb-4 text-sm text-muted-foreground">{notice}</p>}
                {error && (
                    <div className="mb-4 p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {useBackup ? (
                        <Input
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            placeholder="ABCD2345"
                            maxLength={9}
                            autoComplete="off"
                            className="text-center font-mono tracking-widest"
                        />
                    ) : (
                        <InputOTP
                            maxLength={6}
                            pattern={REGEXP_ONLY_DIGITS}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={code}
                            onChange={setCode}
                            containerClassName="justify-center"
                        >
                            <InputOTPGroup>
                                {[0, 1, 2, 3, 4, 5].map((i) => (
                                    <InputOTPSlot key={i} index={i} />
                                ))}
                            </InputOTPGroup>
                        </InputOTP>
                    )}

                    <Button type="submit" disabled={loading || !ready} className="w-full">
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
                            </>
                        ) : (
                            'Verify'
                        )}
                    </Button>
                </form>

                <div className="mt-4 flex items-center justify-between text-sm">
                    {!useBackup && (
                        remaining > 0 ? (
                            <span className="text-muted-foreground">
                                Didn&apos;t receive the code?{' '}
                                <button
                                    type="button"
                                    onClick={() => sendCode(false)}
                                    disabled={resending || cooldown > 0}
                                    className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                                >
                                    {resending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : `Resend (${remaining} left)`}
                                </button>
                            </span>
                        ) : (
                            <span className="text-muted-foreground">No resends left. Try again in 15 minutes.</span>
                        )
                    )}
                    <button
                        type="button"
                        onClick={() => { setUseBackup(!useBackup); setCode(''); setError(''); }}
                        className="text-muted-foreground hover:text-foreground ml-auto"
                    >
                        {useBackup ? 'Use a verification code' : 'Use a backup code'}
                    </button>
                </div>
            </div>
        </div>
    );
}
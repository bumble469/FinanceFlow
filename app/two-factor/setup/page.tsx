'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type Step = 'contact' | 'verify' | 'done';

export default function TwoFactorSetupPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>('contact');
    const [method, setMethod] = useState<'EMAIL' | 'SMS'>('EMAIL');
    const [contact, setContact] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [remaining, setRemaining] = useState(3);
    const [cooldown, setCooldown] = useState(0);
    const [resending, setResending] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const nextStep = async () => {
        setLoading(true);
        setError('');
        try {
            if (step === 'contact') {
                const res = await fetch('/api/auth/two-factor/enable', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ method, contact }),
                });
                const result = await res.json();
                if (!res.ok) {
                    setError(result.error || 'Failed to start setup');
                    return;
                }
                setRemaining(result.remaining ?? 0); setCooldown(30);
                setStep('verify');
            } else if (step === 'verify') {
                const res = await fetch('/api/auth/two-factor/verify-setup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code }),
                });
                const result = await res.json();
                if (!res.ok) {
                    setError(result.error || 'Invalid code');
                    return;
                }
                setBackupCodes(result.backupCodes || []);
                setStep('done');
            }
        } catch {
            setError('Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const resend = async () => {
        setResending(true);
        setError('');
        try {
            const res = await fetch('/api/auth/two-factor/enable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ method, contact }),
            });
            const result = await res.json().catch(() => ({}));
            if (typeof result.remaining === 'number') setRemaining(result.remaining);
            if (!res.ok) { setError(result.error || 'Could not resend the code'); return; }
            setCooldown(30);
        } catch {
            setError('Something went wrong');
        } finally {
            setResending(false);
        }
    };

    const copyCodes = async () => {
        try {
            await navigator.clipboard.writeText(backupCodes.join('\n'));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError('Could not copy. Select the codes and copy them manually.');
        }
    };

    const handleBack = () => {
        if (step === 'verify') {
            setStep('contact');
            setCode('');
            setError('');
        } else {
            router.push('/settings');
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="w-full max-w-md px-4 py-8">
                {step !== 'done' && (
                    <Button type="button" variant="ghost" size="sm" onClick={handleBack} className="-ml-2 mb-4 cursor-pointer">
                        <ArrowLeft /> Back
                    </Button>
                )}
                <h1 className="text-2xl font-bold mb-2">Set up two-step verification</h1>

                {step === 'contact' && (
                    <>
                        <p className="mb-6 text-muted-foreground">Choose how to receive verification codes.</p>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <Button
                                type="button"
                                className='cursor-pointer'
                                variant={method === 'EMAIL' ? 'default' : 'outline'}
                                onClick={() => { setMethod('EMAIL'); setContact(''); setError(''); }}
                            >
                                Email
                            </Button>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="inline-flex">
                                        <Button
                                            type="button"
                                            className='w-full cursor-not-allowed'
                                            variant="outline"
                                            disabled
                                        >
                                            SMS
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>Coming soon</TooltipContent>
                            </Tooltip>
                        </div>

                        <div className="space-y-2 mb-6">
                            <Label htmlFor="contact">{method === 'EMAIL' ? 'Recovery email' : 'Recovery phone'}</Label>
                            {method === 'EMAIL' ? (
                                <Input
                                    id="contact"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={contact}
                                    onChange={(e) => setContact(e.target.value)}
                                />
                            ) : (
                                <Input
                                    id="contact"
                                    type="tel"
                                    placeholder="+15550000000"
                                    value={contact}
                                    onChange={(e) => setContact(e.target.value)}
                                />
                            )}
                            {method === 'SMS' && (
                                <p className="text-xs text-muted-foreground">Include the country code, e.g. +91 or +1.</p>
                            )}
                        </div>

                        <Button onClick={nextStep} disabled={loading || !contact.trim()} className="w-full cursor-pointer">
                            {loading ? 'Sending...' : 'Send code'}
                        </Button>
                        {error && <p className="text-destructive text-sm mt-2">{error}</p>}
                    </>
                )}

                {step === 'verify' && (
                    <>
                        <p className="mb-6 text-muted-foreground">
                            We sent a 6-digit code to your {method === 'EMAIL' ? 'email' : 'phone'}. Enter it below.
                        </p>
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
                        {error && <p className="text-destructive text-sm mt-2">{error}</p>}
                        <div className="mt-4 text-center text-sm text-muted-foreground">
                            {remaining > 0 ? (
                                <>
                                    Didn&apos;t receive the code?{' '}
                                    <button
                                        type="button"
                                        onClick={resend}
                                        disabled={resending || cooldown > 0}
                                        className="text-primary hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
                                    >
                                        {resending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : `Resend (${remaining} left)`}
                                    </button>
                                </>
                            ) : (
                                'No resends left. Try again in 15 minutes.'
                            )}
                            <div>
                                <button type="button" onClick={() => { setStep('contact'); setCode(''); setError(''); }} className="mt-2 text-muted-foreground hover:text-foreground">
                                    Use a different {method === 'EMAIL' ? 'email' : 'number'}
                                </button>
                            </div>
                        </div>
                        <Button
                            onClick={nextStep}
                            disabled={loading || code.length !== 6}
                            className="w-full mt-4 cursor-pointer"
                        >
                            {loading ? 'Verifying...' : 'Verify & enable'}
                        </Button>
                    </>
                )}

                {step === 'done' && (
                    <>
                        <p className="mb-4 text-muted-foreground">
                            Two-step verification is enabled. Save these backup codes:
                        </p>
                        <div className="grid grid-cols-2 gap-2 mb-6">
                            {backupCodes.map((c, i) => (
                                <span key={i} className="border border-border rounded p-2 text-sm font-mono text-center bg-muted">
                                    {c}
                                </span>
                            ))}
                        </div>
                        <Button type="button" variant="outline" onClick={copyCodes} className="w-full mb-4 cursor-pointer">
                            {copied ? (
                                <>
                                    <Check /> Copied
                                </>
                            ) : (
                                <>
                                    <Copy /> Copy all codes
                                </>
                            )}
                        </Button>
                        {error && <p className="text-destructive text-sm mb-4">{error}</p>}
                        <p className="text-xs text-muted-foreground mb-6">
                            Store these somewhere safe. Each code can be used once if you lose access to your{' '}
                            {method === 'EMAIL' ? 'email' : 'phone'}.
                        </p>
                        <Button onClick={() => router.push('/settings')} className="w-full cursor-pointer">Done</Button>
                    </>
                )}
            </div>
        </div>
    );
}
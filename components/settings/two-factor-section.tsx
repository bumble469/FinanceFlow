'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { authClient } from '@/lib/auth-client';
import { useSnackbar } from '@/lib/useSnackbar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function TwoFactorSection() {
    const { show } = useSnackbar();
    const [settings, setSettings] = useState<{ enabled: boolean; method: string; recoveryEmail?: string | null; recoveryPhone?: string | null, hasPassword?: boolean } | null>(null);
    const [loading, setLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [codeSent, setCodeSent] = useState(false);
    const [sending, setSending] = useState(false);
    const [remaining, setRemaining] = useState(3);
    const [error, setError] = useState('');

    const closeDialog = () => {
        setDialogOpen(false);
        setPassword('');
        setCode('');
        setCodeSent(false);
        setError('');
    };

    useEffect(() => {
        authClient
            .request('/api/auth/two-factor/settings')
            .then((res) => setSettings(res.data.data ?? { enabled: false }))
            .catch(() => setSettings(null));
    }, []);

    const toggle = () => {
        if (!settings) return;
        if (!settings.enabled) {
            window.location.href = '/two-factor/setup';
            return;
        }
        setDialogOpen(true);
    };

    const sendDisableCode = async () => {
        setSending(true);
        setError('');
        try {
            const res = await authClient.request('/api/auth/two-factor/disable', {
                method: 'POST',
                data: { sendCode: true },
            });
            setRemaining(res.data?.remaining ?? 0);
            setCodeSent(true);
        } catch (e: any) {
            if (typeof e?.response?.data?.remaining === 'number') setRemaining(e.response.data.remaining);
            setError(e?.response?.data?.error || 'Could not send the code');
        } finally {
            setSending(false);
        }
    };

    const confirmDisable = async () => {
        if (!settings) return;
        setLoading(true);
        setError('');
        try {
            await authClient.request('/api/auth/two-factor/disable', {
                method: 'POST',
                data: settings.hasPassword ? { password } : { code },
            });
            setSettings({ ...settings, enabled: false });
            closeDialog();
            show('Two-step verification disabled', 'success');
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Failed to disable two-step verification');
        } finally {
            setLoading(false);
        }
    };

    if (!settings) return null;

    const maskEmail = (email: string) => {
        const [u, d] = email.split('@');
        return `${u.slice(0, 2)}***@${d}`;
    };
    const maskPhone = (phone: string) => `•••• ${phone.slice(-4)}`;

    return (
        <Card className="border border-border bg-card p-4 sm:p-6">
            <h2 className="text-xl font-semibold text-foreground">Two-step verification</h2>
            <p className="mb-6 text-sm text-muted-foreground">Add a second layer of security to your sign-in.</p>

            <div className="flex items-center justify-between mb-6">
                <div>
                    <p className="text-sm font-medium text-foreground">Require verification code at sign-in</p>
                    <p className="text-xs text-muted-foreground">
                        {settings.enabled
                            ? 'On. A code will be sent to your recovery contact.'
                            : 'Off. Add a second layer of security to your sign-in.'}
                    </p>
                </div>
                {settings.enabled ? (
                    <Button variant="outline" onClick={toggle} disabled={loading}>
                        Turn off
                    </Button>
                ) : (
                    <Button onClick={toggle}>Set up</Button>
                )}
            </div>

            {!settings.enabled && (
                <Button onClick={() => (window.location.href = '/two-factor/setup')} className="w-full sm:w-auto">
                    Set up two-step verification
                </Button>
            )}

            {settings.enabled && (
                <>
                    <div className="space-y-4 mb-6">
                        <div className="space-y-2">
                            <Label>Method</Label>
                            <p className="text-sm text-muted-foreground">{settings.method === 'SMS' ? 'SMS' : 'Email'}</p>
                        </div>
                        {settings.recoveryEmail && (
                            <div className="space-y-2">
                                <Label>Recovery email</Label>
                                <p className="text-sm text-muted-foreground">{maskEmail(settings.recoveryEmail)}</p>
                            </div>
                        )}
                        {settings.recoveryPhone && (
                            <div className="space-y-2">
                                <Label>Recovery phone</Label>
                                <p className="text-sm text-muted-foreground">{maskPhone(settings.recoveryPhone)}</p>
                            </div>
                        )}
                        <a href="/two-factor/setup" className="text-sm text-primary hover:underline">Manage recovery contact</a>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-medium text-foreground">Change recovery email / phone</p>
                        <Button variant="outline" asChild>
                            <a href="/two-factor/setup">Change</a>
                        </Button>
                    </div>
                </>
            )}
            <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Turn off two-step verification</DialogTitle>
                        <DialogDescription>
                            {settings.hasPassword
                                ? 'Enter your password to confirm.'
                                : 'We will email you a code to confirm it is you.'}
                        </DialogDescription>
                    </DialogHeader>

                    {settings.hasPassword ? (
                        <div className="space-y-2">
                            <Label htmlFor="disable-password">Password</Label>
                            <Input
                                id="disable-password"
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={sendDisableCode}
                                disabled={sending || remaining === 0}
                                className="w-full"
                            >
                                {sending
                                    ? 'Sending...'
                                    : remaining === 0
                                        ? 'No sends left, try again in 15 minutes'
                                        : codeSent
                                            ? `Resend code (${remaining} left)`
                                            : 'Send code'}
                            </Button>
                            <div className="space-y-2">
                                <Label htmlFor="disable-code">Code or backup code</Label>
                                <Input
                                    id="disable-code"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder="123456"
                                    autoComplete="one-time-code"
                                />
                            </div>
                        </div>
                    )}

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeDialog}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={confirmDisable}
                            disabled={loading || (settings.hasPassword ? !password : !code.trim())}
                        >
                            {loading ? 'Turning off...' : 'Turn off'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
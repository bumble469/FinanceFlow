'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsSection, SettingsRow } from '@/components/settings/settings-layout';
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
        <>
            <SettingsSection
                title="Two-step verification"
                description="Add a second layer of security to your sign-in."
            >
                <SettingsRow
                    action
                    label="Require verification code at sign-in"
                    description={
                        settings.enabled
                            ? 'On. A code will be sent to your recovery contact.'
                            : 'Off. Add a second layer of security to your sign-in.'
                    }
                >
                    {settings.enabled ? (
                        <Button variant="outline" className="cursor-pointer" onClick={toggle} disabled={loading}>
                            Turn off
                        </Button>
                    ) : (
                        <Button className="cursor-pointer" onClick={toggle}>
                            Set up
                        </Button>
                    )}
                </SettingsRow>

                {settings.enabled && (
                    <>
                        <SettingsRow label="Method">
                            <p className="text-sm text-foreground">{settings.method === 'SMS' ? 'SMS' : 'Email'}</p>
                        </SettingsRow>

                        {settings.recoveryEmail && (
                            <SettingsRow label="Recovery email">
                                <p className="text-sm text-foreground">{maskEmail(settings.recoveryEmail)}</p>
                            </SettingsRow>
                        )}

                        {settings.recoveryPhone && (
                            <SettingsRow label="Recovery phone">
                                <p className="text-sm text-foreground">{maskPhone(settings.recoveryPhone)}</p>
                            </SettingsRow>
                        )}

                        <SettingsRow action label="Recovery contact" description="Change recovery email / phone">
                            <Button variant="outline" asChild className="cursor-pointer">
                                <a href="/two-factor/setup">Change</a>
                            </Button>
                        </SettingsRow>
                    </>
                )}
            </SettingsSection>
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
        </>
    );
}
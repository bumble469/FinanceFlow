export function getOtpDestination(settings: {
    method: string;
    recoveryEmail?: string | null;
    recoveryPhone?: string | null;
}) {
    if (settings.method === 'SMS' && settings.recoveryPhone) {
        return { type: 'sms' as const, value: maskPhone(settings.recoveryPhone) };
    }
    return { type: 'email' as const, value: maskEmail(settings.recoveryEmail ?? '') };
}

function maskEmail(email: string) {
    const [user, domain] = email.split('@');
    if (!user || !domain) return email;
    return `${user.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: string) {
    return `•••• ${phone.slice(-4)}`;
}
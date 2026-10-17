import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';

const BASE32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateOtpCode(length = 6): string {
    let code = '';
    for (let i = 0; i < length; i++) {
        code += randomInt(0, 10);
    }
    return code;
}

export async function hashOtp(code: string): Promise<string> {
    return bcrypt.hash(code, 8);
}

export async function verifyOtp(code: string, hash: string): Promise<boolean> {
    try {
        return await bcrypt.compare(code, hash);
    } catch {
        return false;
    }
}

export function generateBackupCodes(count = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
        let code = '';
        for (let j = 0; j < 8; j++) {
            code += BASE32[randomInt(0, BASE32.length)];
        }
        codes.push(code);
    }
    return codes;
}

export async function hashBackupCode(code: string): Promise<string> {
    return bcrypt.hash(code, 8);
}
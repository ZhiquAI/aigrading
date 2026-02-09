import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { REFRESH_TOKEN_EXPIRY } from '@/lib/auth';

export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export async function storeRefreshToken(userId: string, refreshToken: string) {
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000);
    return prisma.refreshToken.create({
        data: {
            userId,
            tokenHash: hashToken(refreshToken),
            expiresAt
        }
    });
}

export async function findValidRefreshToken(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    return prisma.refreshToken.findFirst({
        where: {
            tokenHash,
            revokedAt: null,
            expiresAt: { gt: new Date() }
        }
    });
}

export async function revokeRefreshToken(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    return prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() }
    });
}

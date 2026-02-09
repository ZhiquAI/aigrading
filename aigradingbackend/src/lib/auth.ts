/**
 * JWT 认证工具函数
 *
 * 功能:
 * - Access Token (短期, 15分钟)
 * - Refresh Token (长期, 7天)
 * - Token Rotation 由数据库负责撤销
 */

import jwt from 'jsonwebtoken';
import { requireAuthEnv } from '@/lib/env';

const { JWT_SECRET, JWT_REFRESH_SECRET } = requireAuthEnv();

// Token 过期时间（秒）
export const ACCESS_TOKEN_EXPIRY = 15 * 60;           // 15 分钟
export const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 天

// JWT 负载类型
export interface JwtPayload {
    userId: string;
    email: string;
    role: 'ADMIN' | 'TEACHER' | 'GUEST';
    type?: 'access' | 'refresh';
}

/**
 * 生成 Access Token (短期)
 */
export function signAccessToken(payload: Omit<JwtPayload, 'type'>): string {
    return jwt.sign(
        { ...payload, type: 'access' },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
}

/**
 * 生成 Refresh Token (长期)
 */
export function signRefreshToken(payload: Omit<JwtPayload, 'type'>): string {
    return jwt.sign(
        { ...payload, type: 'refresh' },
        JWT_REFRESH_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
}

/**
 * 生成 Token 对 (Access + Refresh)
 */
export function signTokenPair(payload: Omit<JwtPayload, 'type'>): {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
} {
    return {
        accessToken: signAccessToken(payload),
        refreshToken: signRefreshToken(payload),
        expiresIn: ACCESS_TOKEN_EXPIRY
    };
}

/**
 * 验证 Access Token
 * @returns 解码后的负载，如果无效则返回 null
 */
export function verifyAccessToken(token: string): JwtPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        if (decoded.type !== 'access') {
            return null;
        }
        return decoded;
    } catch {
        return null;
    }
}

/**
 * 验证 Refresh Token
 */
export function verifyRefreshToken(token: string): JwtPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
        if (decoded.type !== 'refresh') {
            return null;
        }
        return decoded;
    } catch {
        return null;
    }
}

/**
 * 从请求头中提取 Token
 * 支持格式: "Bearer <token>" 或直接 "<token>"
 */
export function extractToken(authHeader: string | null): string | null {
    if (!authHeader) return null;

    if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }

    return authHeader;
}

/**
 * 生成密码重置 Token (1小时有效)
 */
export function signPasswordResetToken(userId: string, email: string): string {
    return jwt.sign(
        { userId, email, purpose: 'password-reset' },
        JWT_SECRET,
        { expiresIn: 60 * 60 } // 1 小时
    );
}

/**
 * 验证密码重置 Token
 */
export function verifyPasswordResetToken(token: string): { userId: string; email: string } | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; purpose: string };
        if (decoded.purpose !== 'password-reset') {
            return null;
        }
        return { userId: decoded.userId, email: decoded.email };
    } catch {
        return null;
    }
}

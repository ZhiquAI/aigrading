/**
 * JWT 认证工具函数 - 增强版
 * 
 * 功能:
 * - Access Token (短期, 15分钟)
 * - Refresh Token (长期, 7天)
 * - Token 黑名单 (登出失效)
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + '-refresh';

// Token 过期时间
const ACCESS_TOKEN_EXPIRY = 15 * 60;           // 15 分钟
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 天

// JWT 负载类型
export interface JwtPayload {
    userId: string;
    email: string;
    type?: 'access' | 'refresh';
}

// Token 黑名单 (内存存储，生产环境可用 Redis)
const tokenBlacklist = new Set<string>();

// 定期清理黑名单中过期的 token (每小时)
setInterval(() => {
    // 黑名单中的 token 最多保留 7 天
    // 实际实现需要存储过期时间，这里简化处理
    if (tokenBlacklist.size > 10000) {
        tokenBlacklist.clear();
    }
}, 60 * 60 * 1000);

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
 * 兼容旧版：生成单一 Token (7天有效期)
 * @deprecated 使用 signTokenPair 替代
 */
export function signToken(payload: Omit<JwtPayload, 'type'>): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRY,
    });
}

/**
 * 验证 Access Token
 * @returns 解码后的负载，如果无效则返回 null
 */
export function verifyAccessToken(token: string): JwtPayload | null {
    try {
        // 检查黑名单
        if (tokenBlacklist.has(token)) {
            return null;
        }
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
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
        // 检查黑名单
        if (tokenBlacklist.has(token)) {
            return null;
        }
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
 * 兼容旧版：验证 Token
 */
export function verifyToken(token: string): JwtPayload | null {
    try {
        if (tokenBlacklist.has(token)) {
            return null;
        }
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        return decoded;
    } catch {
        return null;
    }
}

/**
 * 将 Token 加入黑名单 (登出时使用)
 */
export function blacklistToken(token: string): void {
    tokenBlacklist.add(token);
}

/**
 * 检查 Token 是否在黑名单中
 */
export function isTokenBlacklisted(token: string): boolean {
    return tokenBlacklist.has(token);
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

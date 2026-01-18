/**
 * JWT 认证工具函数
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

// JWT 负载类型
export interface JwtPayload {
    userId: string;
    email: string;
}

/**
 * 生成 JWT Token
 */
export function signToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: 60 * 60 * 24 * 7, // 7 天（秒）
    });
}

/**
 * 验证 JWT Token
 * @returns 解码后的负载，如果无效则返回 null
 */
export function verifyToken(token: string): JwtPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
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

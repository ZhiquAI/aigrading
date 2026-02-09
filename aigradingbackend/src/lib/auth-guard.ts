import { apiForbidden, apiUnauthorized } from '@/lib/api-response';
import { extractToken, verifyAccessToken, JwtPayload } from '@/lib/auth';

export type AuthResult = JwtPayload | Response;

export function requireUser(request: Request): AuthResult {
    const authHeader = request.headers.get('authorization');
    const token = extractToken(authHeader);
    if (!token) {
        return apiUnauthorized();
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
        return apiUnauthorized();
    }

    return payload;
}

export function requireAdmin(request: Request): AuthResult {
    const result = requireUser(request);
    if (result instanceof Response) {
        return result;
    }

    if (result.role !== 'ADMIN') {
        return apiForbidden('没有管理员权限');
    }

    return result;
}

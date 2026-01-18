/**
 * 健康检查接口
 * GET /api/health
 */

import { apiSuccess } from '@/lib/api-response';

export async function GET() {
    return apiSuccess({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
}

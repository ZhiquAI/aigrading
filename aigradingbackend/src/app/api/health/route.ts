/**
 * 健康检查接口
 * GET /api/health
 */

import { apiSuccess } from '@/lib/api-response';

// 强制动态渲染，避免被静态缓存
export const dynamic = 'force-dynamic';

export async function GET() {
    return apiSuccess({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.1',  // 更新版本号以验证部署
    });
}


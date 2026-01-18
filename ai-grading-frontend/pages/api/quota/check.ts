import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { db } from '../../../lib/db';


/**
 * 额度验证接口
 * 目标: <100ms 响应时间
 * 功能: 只查询额度,不扣减
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1️⃣ 验证用户身份 (JWT)
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({
                canUse: false,
                error: '未登录'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
        const userId = decoded.userId;

        // 2️⃣ 快速查询额度 (建议用 Redis 缓存)
        // 如果没有 Redis,直接查数据库也很快
        const quota = await db.query(
            'SELECT remaining, expires_at FROM user_quotas WHERE user_id = ?',
            [userId]
        );

        if (!quota[0]) {
            return res.json({
                canUse: false,
                remaining: 0,
                message: '未激活或额度已用完'
            });
        }

        // 3️⃣ 检查是否过期
        if (quota[0].expires_at && new Date(quota[0].expires_at) < new Date()) {
            return res.json({
                canUse: false,
                remaining: 0,
                message: '额度已过期'
            });
        }

        // 4️⃣ 检查剩余额度
        const remaining = quota[0].remaining;

        if (remaining === -1) {
            // 无限额度 (永久会员)
            return res.json({
                canUse: true,
                remaining: -1,
                message: 'unlimited'
            });
        }

        if (remaining <= 0) {
            return res.json({
                canUse: false,
                remaining: 0,
                message: '额度已用完,请充值'
            });
        }

        // 5️⃣ 返回验证结果
        return res.json({
            canUse: true,
            remaining
        });

    } catch (error: any) {
        console.error('[quota/check] Error:', error);
        return res.status(500).json({
            canUse: false,
            error: 'Server error'
        });
    }
}

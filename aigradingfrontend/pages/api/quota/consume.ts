import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { db } from '../../../lib/db';


/**
 * 额度消耗上报接口
 * 特点: 异步处理,立即返回,不阻塞前端
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1️⃣ 验证用户身份
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: '未登录' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
        const userId = decoded.userId;

        // 2️⃣ 立即返回成功响应 (不等待数据库)
        res.status(200).json({ success: true });

        // 3️⃣ 后台异步处理扣减和日志
        // 使用 Promise.allSettled 确保即使一个失败,其他也能继续
        Promise.allSettled([
            // 扣减额度 (原子操作)
            db.query(
                `UPDATE user_quotas 
                 SET remaining = GREATEST(0, remaining - 1), 
                     used = used + 1 
                 WHERE user_id = ? AND remaining > 0`,
                [userId]
            ),

            // 记录使用日志
            db.query(
                `INSERT INTO usage_logs (user_id, action, created_at) 
                 VALUES (?, 'grade', NOW())`,
                [userId]
            )
        ]).catch(error => {
            console.error('[quota/consume] Background task failed:', error);
        });

    } catch (error: any) {
        console.error('[quota/consume] Error:', error);
        // 即使出错也返回成功,避免阻塞用户
        // 可以记录到错误日志系统
        return res.status(200).json({ success: true });
    }
}

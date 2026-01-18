const cloud = require('@cloudbase/node-sdk');
const app = cloud.init({ env: cloud.SYMBOL_CURRENT_ENV });
const db = app.database();
const _ = db.command;

/**
 * 额度消耗上报云函数
 * 扣减额度并记录使用日志
 */
exports.main = async (event) => {
    const { deviceId } = event;

    if (!deviceId) {
        return { success: false, message: '设备ID不能为空' };
    }

    try {
        // 原子操作扣减额度
        const updateResult = await db.collection('user_quotas')
            .where({
                device_id: deviceId,
                remaining: _.gt(0) // 确保有剩余额度
            })
            .update({
                remaining: _.inc(-1),
                used: _.inc(1),
                updated_at: new Date()
            });

        if (updateResult.updated === 0) {
            return {
                success: false,
                message: '额度不足或设备未激活'
            };
        }

        // 记录使用日志（异步，失败不影响主流程）
        db.collection('usage_logs').add({
            device_id: deviceId,
            action: 'grade',
            created_at: new Date()
        }).catch(err => {
            console.error('[quota-consume] Log error:', err);
        });

        return {
            success: true,
            message: '额度已扣减'
        };

    } catch (error) {
        console.error('[quota-consume] Error:', error);
        return {
            success: false,
            message: '扣减失败: ' + error.message
        };
    }
};

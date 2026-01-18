const cloud = require('@cloudbase/node-sdk');
const app = cloud.init({ env: cloud.SYMBOL_CURRENT_ENV });
const db = app.database();

/**
 * 额度验证云函数
 * 检查设备是否有剩余额度
 */
exports.main = async (event) => {
    const { deviceId } = event;

    if (!deviceId) {
        return {
            canUse: false,
            remaining: 0,
            message: '设备ID不能为空'
        };
    }

    try {
        // 查询设备额度
        const { data } = await db.collection('user_quotas')
            .where({ device_id: deviceId })
            .get();

        // 未激活
        if (data.length === 0) {
            return {
                canUse: false,
                remaining: 0,
                isFirstTime: true,
                message: '欢迎使用！请先激活或注册'
            };
        }

        const quota = data[0];

        // 检查是否过期
        if (quota.expires_at && new Date(quota.expires_at) < new Date()) {
            return {
                canUse: false,
                remaining: 0,
                message: '额度已过期，请重新购买'
            };
        }

        // 额度已用完
        if (quota.remaining <= 0) {
            return {
                canUse: false,
                remaining: 0,
                message: '额度已用完，请购买充值'
            };
        }

        // 正常可用
        return {
            canUse: true,
            remaining: quota.remaining,
            total: quota.total,
            used: quota.used
        };

    } catch (error) {
        console.error('[quota-check] Error:', error);
        return {
            canUse: false,
            remaining: 0,
            message: '查询失败: ' + error.message
        };
    }
};

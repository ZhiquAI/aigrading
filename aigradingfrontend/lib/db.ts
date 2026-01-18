/**
 * 数据库连接层
 * 基于 mysql2/promise
 */
import mysql from 'mysql2/promise';

// 创建连接池
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'grading_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

/**
 * 数据库查询接口
 */
export const db = {
    /**
     * 执行查询
     * @param sql SQL 语句
     * @param params 参数数组
     * @returns 查询结果
     */
    query: async <T = any>(sql: string, params?: any[]): Promise<T[]> => {
        try {
            const [rows] = await pool.execute(sql, params);
            return rows as T[];
        } catch (error) {
            console.error('[DB] Query error:', error);
            throw error;
        }
    },

    /**
     * 执行单条查询（返回第一行）
     */
    queryOne: async <T = any>(sql: string, params?: any[]): Promise<T | null> => {
        const rows = await db.query<T>(sql, params);
        return rows[0] || null;
    },

    /**
     * 测试连接
     */
    test: async (): Promise<boolean> => {
        try {
            await pool.query('SELECT 1');
            console.log('[DB] Connection test successful');
            return true;
        } catch (error) {
            console.error('[DB] Connection test failed:', error);
            return false;
        }
    }
};

// 优雅关闭
process.on('SIGTERM', async () => {
    await pool.end();
    console.log('[DB] Connection pool closed');
});

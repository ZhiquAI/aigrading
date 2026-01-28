module.exports = {
    apps: [
        {
            name: 'ai-grading-backend',
            script: 'node_modules/next/dist/bin/next',
            args: 'start',
            instances: 'max', // 充分利用多核 CPU
            exec_mode: 'cluster', // 集群模式提高吞吐量
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            },
            // 开启自动重启和内存限制
            autorestart: true,
            max_memory_restart: '1G',
            // 日志配置
            error_file: './logs/error.log',
            out_file: './logs/out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss'
        }
    ]
};

module.exports = {
    apps: [{
        name: 'grading-backend',
        script: 'npm',
        args: 'run dev',
        cwd: '/Users/hero/Desktop/ai-grading-backend',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '500M',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        error_file: './logs/error.log',
        out_file: './logs/out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        merge_logs: true
    }]
};

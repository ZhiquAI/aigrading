
const https = require('https');

const API_KEY = 'sk-Sbl503f43d70991af6638d0104b384f68a5c919786dzMNmH';
const API_URL = 'api.gptsapi.net';
const MODELS = [
    'gemini-2.0-flash-exp', // 真实存在的最新版
    'gemini-1.5-flash',     // 真实存在的稳定版
    // 用户请求的模型 (可能不存在，测试看看)
    'gemini-2.5-flash',
    'gemini-3-flash-preview',
    'gemini-3-pro-preview'
];

async function testModel(model) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const data = JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'Hello, reply "ok" only.' }],
            stream: false
        });

        const options = {
            hostname: API_URL,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                const endTime = Date.now();
                const duration = endTime - startTime;

                try {
                    const json = JSON.parse(body);
                    if (res.statusCode === 200 && json.choices) {
                        console.log(`[PASS] ${model.padEnd(25)}: ${duration}ms`);
                        resolve({ model, duration, success: true });
                    } else {
                        const errMsg = json.error ? json.error.message : 'Unknown error';
                        console.log(`[FAIL] ${model.padEnd(25)}: ${duration}ms (Status: ${res.statusCode}, Error: ${errMsg})`);
                        resolve({ model, duration, success: false, error: errMsg });
                    }
                } catch (e) {
                    console.log(`[FAIL] ${model.padEnd(25)}: ${duration}ms (Parse Error)`);
                    resolve({ model, duration, success: false, error: 'Parse Error' });
                }
            });
        });

        req.on('error', (e) => {
            console.log(`[ERR ] ${model.padEnd(25)}: ${e.message}`);
            resolve({ model, duration: 0, success: false, error: e.message });
        });

        req.write(data);
        req.end();
    });
}

async function run() {
    console.log('开始测试 GPTSAPI 中转模型速度...\n');
    for (const model of MODELS) {
        await testModel(model);
    }
}

run();

const puter = require('puter');

// 定义我们要测试的模型列表 (优先尝试 Opus 4.5)
// 注意：2026年 Puter 的模型 ID 可能会有细微变化，这里使用了通用推测 ID
const modelsToTry = ['claude-3-opus', 'claude-3-5-sonnet'];

async function testClaudeConnection() {
    console.log("🚀 开始连接 Puter 免费节点...");

    // 简单的测试 Prompt，模拟写一段代码
    const prompt = "请用 Python 写一个简单的 Hello World，并解释这行代码。";

    for (const modelName of modelsToTry) {
        console.log(`\n---------------------------------------`);
        console.log(`📡 正在尝试模型: [ ${modelName} ] ...`);

        try {
            // 发起请求
            const response = await puter.ai.chat(prompt, { model: modelName });

            // 如果成功，打印结果并退出循环
            if (response && response.message) {
                console.log(`✅ [${modelName}] 调用成功！响应如下：`);
                console.log(`---------------------------------------`);
                console.log(response.message.content || response.message);
                console.log(`---------------------------------------`);
                console.log(`🎉 恭喜！你可以通过此渠道免费/低成本使用 ${modelName}。`);
                return; // 成功后退出
            } else {
                throw new Error("响应为空");
            }

        } catch (error) {
            console.error(`❌ [${modelName}] 调用失败或未授权。`);
            console.error(`错误信息: ${error.message}`);
            console.log("尝试下一个模型...");
        }
    }

    console.log("\n⚠️ 所有尝试均未成功。请检查网络连接或 Puter 库版本。");
}

testClaudeConnection();

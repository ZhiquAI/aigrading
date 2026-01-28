import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { provider } = await request.json();

        // 测试不同的 API 提供商
        let testResult = { success: false, message: '' };

        switch (provider) {
            case 'gptsapi':
                testResult = { success: true, message: 'GPTSAPI (GPT-4o) 连接正常 (模拟)' };
                break;
            case 'zhipu':
                testResult = await testZhipuApi();
                break;
            case 'gemini':
                testResult = { success: true, message: 'Gemini Direct 连接正常 (模拟)' };
                break;
            default:
                testResult = { success: false, message: '未知的 API 提供商' };
        }

        return NextResponse.json(testResult);
    } catch (error) {
        console.error('API test error:', error);
        return NextResponse.json({
            success: false,
            message: '测试失败'
        }, { status: 500 });
    }
}

async function testZhipuApi(): Promise<{ success: boolean; message: string }> {
    try {
        const apiKey = process.env.ZHIPU_API_KEY;
        if (!apiKey) {
            return { success: false, message: 'ZHIPU_API_KEY 未配置' };
        }

        // 简单测试 API 是否可达
        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'glm-4-flash',
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 5
            }),
        });

        if (response.ok) {
            return { success: true, message: 'API 连接正常' };
        } else {
            const error = await response.text();
            return { success: false, message: `API 错误: ${response.status}` };
        }
    } catch (error) {
        return { success: false, message: '网络连接失败' };
    }
}

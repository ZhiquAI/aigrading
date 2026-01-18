import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const ADMIN_PASSWORD = process.env.ADMIN_KEY || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: NextRequest) {
    try {
        const { password } = await request.json();

        if (!password) {
            return NextResponse.json({
                success: false,
                message: '请输入密码'
            }, { status: 400 });
        }

        if (password !== ADMIN_PASSWORD) {
            return NextResponse.json({
                success: false,
                message: '密码错误'
            }, { status: 401 });
        }

        // 生成 JWT token
        const token = jwt.sign(
            { role: 'admin', exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60 },
            JWT_SECRET
        );

        return NextResponse.json({
            success: true,
            message: '登录成功',
            data: { token }
        });
    } catch (error) {
        console.error('Admin login error:', error);
        return NextResponse.json({
            success: false,
            message: '服务器错误'
        }, { status: 500 });
    }
}

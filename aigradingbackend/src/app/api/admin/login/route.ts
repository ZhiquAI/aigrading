import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signTokenPair } from '@/lib/auth';
import { storeRefreshToken } from '@/lib/refresh-token';
import { requireAdminEnv } from '@/lib/env';

export async function POST(request: NextRequest) {
    try {
        const adminEnv = requireAdminEnv();
        const { email, password } = await request.json();

        const loginEmail = email || adminEnv.ADMIN_EMAIL;
        const loginPassword = password;

        if (!loginPassword) {
            return NextResponse.json({
                success: false,
                message: '请输入密码'
            }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { email: loginEmail }
        });

        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({
                success: false,
                message: '管理员不存在'
            }, { status: 401 });
        }

        const isPasswordValid = await bcrypt.compare(loginPassword, user.password);
        if (!isPasswordValid) {
            return NextResponse.json({
                success: false,
                message: '密码错误'
            }, { status: 401 });
        }

        const tokens = signTokenPair({
            userId: user.id,
            email: user.email,
            role: user.role
        });

        await storeRefreshToken(user.id, tokens.refreshToken);

        return NextResponse.json({
            success: true,
            message: '登录成功',
            data: {
                token: tokens.accessToken,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresIn: tokens.expiresIn
            }
        });
    } catch (error) {
        console.error('Admin login error:', error);
        return NextResponse.json({
            success: false,
            message: '服务器错误'
        }, { status: 500 });
    }
}

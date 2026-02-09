import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { requireAdminEnv } from '../src/lib/env';

async function main() {
    const { ADMIN_EMAIL, ADMIN_PASSWORD } = requireAdminEnv();
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const existing = await prisma.user.findUnique({
        where: { email: ADMIN_EMAIL }
    });

    if (existing) {
        await prisma.user.update({
            where: { email: ADMIN_EMAIL },
            data: {
                password: hashedPassword,
                role: 'ADMIN'
            }
        });
        console.log(`[bootstrap-admin] Updated admin user: ${ADMIN_EMAIL}`);
        return;
    }

    await prisma.user.create({
        data: {
            email: ADMIN_EMAIL,
            password: hashedPassword,
            role: 'ADMIN'
        }
    });
    console.log(`[bootstrap-admin] Created admin user: ${ADMIN_EMAIL}`);
}

main()
    .catch((error) => {
        console.error('[bootstrap-admin] Failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

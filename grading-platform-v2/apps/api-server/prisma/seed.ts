import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const seedCodes = [
  { code: "TEST-1111-2222-3333", planType: "trial", totalQuota: 300, maxDevices: 1 },
  { code: "BASIC-AAAA-BBBB-CCCC", planType: "basic", totalQuota: 1000, maxDevices: 2 },
  { code: "PRO-XXXX-YYYY-ZZZZ", planType: "pro", totalQuota: 3000, maxDevices: 3 },
  { code: "PERM-AAAA-BBBB-CCCC", planType: "permanent", totalQuota: 999999, maxDevices: 5 }
];

async function main(): Promise<void> {
  for (const item of seedCodes) {
    await prisma.licenseCode.upsert({
      where: { code: item.code },
      update: {
        planType: item.planType,
        totalQuota: item.totalQuota,
        maxDevices: item.maxDevices,
        isEnabled: true,
        expiresAt: null
      },
      create: {
        code: item.code,
        planType: item.planType,
        totalQuota: item.totalQuota,
        maxDevices: item.maxDevices,
        isEnabled: true,
        expiresAt: null
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error("Failed to seed license codes.", error);
    await prisma.$disconnect();
    process.exit(1);
  });

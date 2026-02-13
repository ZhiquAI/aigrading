import type { PrismaClient } from "@prisma/client";

export type SettingEntryDTO = {
  key: string;
  value: string;
  updatedAt: string;
};

const serializeValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
};

const toSettingEntry = (entry: {
  key: string;
  value: string;
  updatedAt: Date;
}): SettingEntryDTO => {
  return {
    key: entry.key,
    value: entry.value,
    updatedAt: entry.updatedAt.toISOString()
  };
};

export const getSettings = async (
  db: PrismaClient,
  scopeKey: string,
  key?: string
): Promise<SettingEntryDTO | SettingEntryDTO[] | null> => {
  if (key) {
    const setting = await db.settingEntry.findUnique({
      where: {
        scopeKey_key: {
          scopeKey,
          key
        }
      },
      select: {
        key: true,
        value: true,
        updatedAt: true
      }
    });

    return setting ? toSettingEntry(setting) : null;
  }

  const settings = await db.settingEntry.findMany({
    where: { scopeKey },
    orderBy: { updatedAt: "desc" },
    select: {
      key: true,
      value: true,
      updatedAt: true
    }
  });

  return settings.map(toSettingEntry);
};

export const upsertSetting = async (
  db: PrismaClient,
  input: {
    scopeKey: string;
    key: string;
    value: unknown;
  }
): Promise<SettingEntryDTO> => {
  const setting = await db.settingEntry.upsert({
    where: {
      scopeKey_key: {
        scopeKey: input.scopeKey,
        key: input.key
      }
    },
    update: {
      value: serializeValue(input.value)
    },
    create: {
      scopeKey: input.scopeKey,
      key: input.key,
      value: serializeValue(input.value)
    },
    select: {
      key: true,
      value: true,
      updatedAt: true
    }
  });

  return toSettingEntry(setting);
};

export const deleteSetting = async (
  db: PrismaClient,
  scopeKey: string,
  key: string
): Promise<void> => {
  await db.settingEntry.deleteMany({
    where: {
      scopeKey,
      key
    }
  });
};

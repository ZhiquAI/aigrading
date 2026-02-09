type RequiredEnvName =
    | 'JWT_SECRET'
    | 'JWT_REFRESH_SECRET'
    | 'ADMIN_EMAIL'
    | 'ADMIN_PASSWORD';

function getRequiredEnv(name: RequiredEnvName): string {
    const value = process.env[name];
    if (!value || value.trim() === '') {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

export function requireAuthEnv() {
    return {
        JWT_SECRET: getRequiredEnv('JWT_SECRET'),
        JWT_REFRESH_SECRET: getRequiredEnv('JWT_REFRESH_SECRET'),
    };
}

export function requireAdminEnv() {
    return {
        ADMIN_EMAIL: getRequiredEnv('ADMIN_EMAIL'),
        ADMIN_PASSWORD: getRequiredEnv('ADMIN_PASSWORD'),
    };
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateRubricV3 as validateBackendRubricV3 } from '../src/lib/rubric-v3';
import { validateRubricV3 as validateFrontendRubricV3 } from '../../aigradingfrontend/utils/rubric-convert';

function fail(message: string): never {
    console.error(`[contract:rubric-v3] ${message}`);
    process.exit(1);
}

function main() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const contractPath = path.resolve(__dirname, '../../contracts/rubric-v3.sample.json');

    if (!fs.existsSync(contractPath)) {
        fail(`合同样例不存在: ${contractPath}`);
    }

    const raw = fs.readFileSync(contractPath, 'utf-8');
    const payload = JSON.parse(raw);

    const backendValidation = validateBackendRubricV3(payload);
    if (!backendValidation.valid) {
        fail(`后端校验失败: ${backendValidation.errors.join('; ')}`);
    }

    const frontendValidation = validateFrontendRubricV3(payload);
    if (!frontendValidation.valid) {
        fail(`前端校验失败: ${frontendValidation.errors.join('; ')}`);
    }

    console.log('[contract:rubric-v3] 前后端校验通过');
    console.log(`[contract:rubric-v3] 样例路径: ${contractPath}`);
}

main();

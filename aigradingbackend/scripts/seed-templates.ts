/**
 * Seed system rubric templates
 */
import { prisma } from '../src/lib/prisma';

const isSqlite = (process.env.DATABASE_URL || '').startsWith('file:');

function toDbJson(value: unknown) {
    if (!isSqlite) return value as any;
    return JSON.stringify(value ?? {});
}

async function main() {
    const now = new Date().toISOString();
    const templates = [
        {
            scope: 'system',
            subject: '历史',
            grade: '九年级',
            questionType: '材料题',
            strategyType: 'point_accumulation',
            version: '3.0',
            metadata: {
                questionId: 'T-001',
                title: '历史材料分析通用模版',
                subject: '历史',
                grade: '九年级',
                questionType: '材料题'
            },
            content: {
                scoringStrategy: {
                    type: 'pick_n',
                    maxPoints: 3,
                    pointValue: 2,
                    strictMode: false,
                    allowAlternative: true,
                    openEnded: false
                },
                points: [
                    { id: 'T-001-1', questionSegment: '原因', content: '原因要点', keywords: ['原因'], score: 2 },
                    { id: 'T-001-2', questionSegment: '影响', content: '影响要点', keywords: ['影响'], score: 2 },
                    { id: 'T-001-3', questionSegment: '意义', content: '意义要点', keywords: ['意义'], score: 2 }
                ],
                totalScore: 6
            },
            createdAt: now,
            updatedAt: now
        }
    ];

    for (const template of templates) {
        await prisma.rubricTemplate.create({
            data: {
                ...template,
                metadata: toDbJson(template.metadata),
                content: toDbJson(template.content)
            } as any
        });
    }

    console.log(`[seed-templates] inserted ${templates.length} templates`);
}

main()
    .catch((err) => {
        console.error('[seed-templates] failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

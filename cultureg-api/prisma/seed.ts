import { prisma } from "../src/shared/prisma";
import { QuestionType } from "@prisma/client";
import questions from "./questions.json";

async function main() {
    console.log(`🌱 Seeding ${questions.length} questions...`);

    for (const q of questions) {
        const result = await prisma.question.upsert({
            where: { slug: q.slug },
            update: {},
            create: {
                slug: q.slug,
                theme: q.theme,
                type: q.type as QuestionType,
                prompt: q.prompt,
                difficulty: q.difficulty,
                options: {
                    create: q.options.map((o, i) => ({
                        label: o.label,
                        isCorrect: o.isCorrect,
                        orderIndex: i,
                    })),
                },
            },
        });

        console.log(`  ${result.id ? "✅" : "⏭️"}  ${q.slug}`);
    }

    console.log(`✅ Seed done — ${questions.length} questions processed.`);
}

main()
    .catch((e) => {
        console.error("❌ Seed failed:", e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

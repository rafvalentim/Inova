/**
 * Script de migration manual: adiciona coluna `code` à tabela tasks
 * Uso: npx tsx prisma/add-task-code.ts
 */
import dotenv from 'dotenv';
import path from 'path';
// Carrega .env do root do projeto (Inova/.env), 3 níveis acima de apps/api/prisma/
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Verificando coluna code na tabela tasks...');

    // Verifica se a coluna já existe
    const result = await prisma.$queryRaw<any[]>`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'code'
    `;

    if (result.length > 0) {
        console.log('✅ Coluna code já existe. Nada a fazer.');
        return;
    }

    console.log('➕ Adicionando coluna code...');

    // Adiciona a coluna como nullable
    await prisma.$executeRaw`ALTER TABLE "tasks" ADD COLUMN "code" TEXT`;

    // Backfill: atribui TASK-001, TASK-002... para tasks existentes
    const tasks = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM tasks ORDER BY created_at ASC
    `;

    console.log(`📝 Backfill de ${tasks.length} task(s) existente(s)...`);
    for (let i = 0; i < tasks.length; i++) {
        const code = `TASK-${String(i + 1).padStart(3, '0')}`;
        await prisma.$executeRaw`UPDATE tasks SET code = ${code} WHERE id = ${tasks[i].id}`;
    }

    // Aplica NOT NULL e UNIQUE
    await prisma.$executeRaw`ALTER TABLE "tasks" ALTER COLUMN "code" SET NOT NULL`;
    await prisma.$executeRaw`ALTER TABLE "tasks" ADD CONSTRAINT "tasks_code_key" UNIQUE ("code")`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "tasks_code_idx" ON "tasks"("code")`;

    console.log('✅ Migration concluída com sucesso!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

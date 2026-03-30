import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Create system roles
    const adminPerms = {
        users: ['create', 'read', 'update', 'delete'],
        roles: ['create', 'read', 'update', 'delete'],
        projects: ['create', 'read', 'update', 'delete'],
        project_members: ['create', 'read', 'update', 'delete'],
        project_info: ['create', 'read', 'update', 'delete', 'read_sensitive'],
        sprints: ['create', 'read', 'update', 'delete'],
        tasks: ['create', 'read', 'update', 'delete'],
        comments: ['create', 'read', 'update', 'delete'],
        attachments: ['create', 'read', 'update', 'delete'],
        dashboard: ['read'],
        reports: ['read'],
        audit_logs: ['read'],
        settings: ['read', 'update'],
        clockify: ['read', 'update'],
    };
    const adminRole = await prisma.role.upsert({
        where: { name: 'Administrador' },
        update: { permissions: adminPerms },
        create: {
            name: 'Administrador',
            description: 'Acesso total ao sistema',
            isSystem: true,
            permissions: adminPerms,
        },
    });

    const gestorPerms = {
        users: ['read'],
        roles: ['read'],
        projects: ['create', 'read', 'update'],
        project_members: ['create', 'read', 'update'],
        project_info: ['create', 'read', 'update', 'delete'],
        sprints: ['create', 'read', 'update'],
        tasks: ['create', 'read', 'update', 'delete'],
        comments: ['create', 'read', 'update', 'delete'],
        attachments: ['create', 'read', 'update', 'delete'],
        dashboard: ['read'],
        reports: ['read'],
        audit_logs: ['read'],
    };
    const gestorRole = await prisma.role.upsert({
        where: { name: 'Gestor' },
        update: { permissions: gestorPerms },
        create: {
            name: 'Gestor',
            description: 'Gerenciamento de projetos e equipes',
            isSystem: true,
            permissions: gestorPerms,
        },
    });

    const analistaPerms = {
        users: ['read'],
        roles: ['read'],
        projects: ['create', 'read', 'update'],
        project_members: ['read', 'update'],
        project_info: ['create', 'read', 'update', 'delete', 'read_sensitive'],
        sprints: ['create', 'read', 'update', 'delete'],
        tasks: ['create', 'read', 'update', 'delete'],
        comments: ['create', 'read', 'update', 'delete'],
        attachments: ['create', 'read', 'update', 'delete'],
        dashboard: ['read'],
        reports: ['read'],
    };
    const analistaRole = await prisma.role.upsert({
        where: { name: 'Analista' },
        update: { permissions: analistaPerms },
        create: {
            name: 'Analista',
            description: 'Análise de requisitos e planejamento de sprints',
            isSystem: true,
            permissions: analistaPerms,
        },
    });

    const devPerms = {
        users: ['read'],
        projects: ['read'],
        project_members: ['read'],
        project_info: ['read'],
        sprints: ['read'],
        tasks: ['read', 'update'],
        comments: ['create', 'read', 'update'],
        attachments: ['create', 'read', 'update'],
        dashboard: ['read'],
    };
    const devRole = await prisma.role.upsert({
        where: { name: 'Desenvolvedor' },
        update: { permissions: devPerms },
        create: {
            name: 'Desenvolvedor',
            description: 'Desenvolvimento e execução de tarefas',
            isSystem: true,
            permissions: devPerms,
        },
    });

    console.log('✅ Roles criados:', { adminRole: adminRole.id, gestorRole: gestorRole.id, analistaRole: analistaRole.id, devRole: devRole.id });

    // Create admin user
    const hashedPassword = await bcrypt.hash('Admin@123', 12);

    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@inova.local' },
        update: {},
        create: {
            name: 'Administrador',
            email: 'admin@inova.local',
            password: hashedPassword,
            roleId: adminRole.id,
            firstLogin: false,
            status: 'ACTIVE',
        },
    });

    console.log('✅ Admin user criado:', { id: adminUser.id, email: adminUser.email });

    // Create sample users
    const gestorUser = await prisma.user.upsert({
        where: { email: 'carlos@inova.local' },
        update: {},
        create: {
            name: 'Carlos Silva',
            email: 'carlos@inova.local',
            password: await bcrypt.hash('Gestor@123', 12),
            roleId: gestorRole.id,
            firstLogin: false,
            status: 'ACTIVE',
        },
    });

    const analistaUser = await prisma.user.upsert({
        where: { email: 'maria@inova.local' },
        update: {},
        create: {
            name: 'Maria Santos',
            email: 'maria@inova.local',
            password: await bcrypt.hash('Analista@123', 12),
            roleId: analistaRole.id,
            firstLogin: false,
            status: 'ACTIVE',
        },
    });

    const devUser1 = await prisma.user.upsert({
        where: { email: 'ana@inova.local' },
        update: {},
        create: {
            name: 'Ana Oliveira',
            email: 'ana@inova.local',
            password: await bcrypt.hash('Dev@1234', 12),
            roleId: devRole.id,
            firstLogin: false,
            status: 'ACTIVE',
        },
    });

    const devUser2 = await prisma.user.upsert({
        where: { email: 'joao@inova.local' },
        update: {},
        create: {
            name: 'João Pedro',
            email: 'joao@inova.local',
            password: await bcrypt.hash('Dev@1234', 12),
            roleId: devRole.id,
            firstLogin: false,
            status: 'ACTIVE',
        },
    });

    console.log('✅ Usuários de exemplo criados');

    // Create a sample project
    const project = await prisma.project.upsert({
        where: { code: 'PROJ-001' },
        update: {},
        create: {
            code: 'PROJ-001',
            name: 'Hefesto ERP',
            description: 'Sistema ERP para gestão de condomínios e hotelaria',
            status: 'IN_PROGRESS',
            startDate: new Date('2026-01-15'),
            targetDate: new Date('2026-06-30'),
            createdById: gestorUser.id,
            members: {
                create: [
                    { userId: gestorUser.id, roleInProject: 'Líder' },
                    { userId: analistaUser.id, roleInProject: 'Analista' },
                    { userId: devUser1.id, roleInProject: 'Desenvolvedor' },
                    { userId: devUser2.id, roleInProject: 'Desenvolvedor' },
                ],
            },
        },
    });

    console.log('✅ Projeto de exemplo criado:', { id: project.id, code: project.code });

    // Create a sprint
    const sprint = await prisma.sprint.upsert({
        where: { id: 'seed-sprint-1' },
        update: {},
        create: {
            id: 'seed-sprint-1',
            projectId: project.id,
            name: 'Sprint 5',
            goal: 'Implementar módulo de reservas',
            startDate: new Date('2026-03-01'),
            endDate: new Date('2026-03-15'),
            status: 'ACTIVE',
            capacityPts: 40,
        },
    });

    // Create sample tasks
    const taskData = [
        { title: 'Criar endpoint de reservas', status: 'DONE' as const, priority: 'HIGH' as const, storyPoints: 3, assignee: devUser1.id },
        { title: 'Layout da tela de reservas', status: 'IN_REVIEW' as const, priority: 'HIGH' as const, storyPoints: 5, assignee: devUser2.id },
        { title: 'Implementar filtros avançados', status: 'IN_PROGRESS' as const, priority: 'MEDIUM' as const, storyPoints: 3, assignee: devUser1.id },
        { title: 'Ajustar layout responsivo', status: 'TODO' as const, priority: 'MEDIUM' as const, storyPoints: 2, assignee: devUser2.id },
        { title: 'Criar testes unitários do módulo', status: 'BACKLOG' as const, priority: 'LOW' as const, storyPoints: 5, assignee: devUser1.id },
        { title: 'Documentação da API de reservas', status: 'BACKLOG' as const, priority: 'LOW' as const, storyPoints: 2, assignee: analistaUser.id },
    ];

    for (let i = 0; i < taskData.length; i++) {
        const t = taskData[i];
        const code = `TASK-${String(i + 1).padStart(3, '0')}`;
        await prisma.task.upsert({
            where: { code },
            update: {},
            create: {
                code,
                projectId: project.id,
                title: t.title,
                status: t.status,
                priority: t.priority,
                storyPoints: t.storyPoints,
                position: i,
                tags: [],
                createdById: analistaUser.id,
                sprints: {
                    create: [{ sprintId: sprint.id }],
                },
                assignees: {
                    create: [{ userId: t.assignee }],
                },
            },
        });
    }

    console.log('✅ Sprint e tasks de exemplo criados');
    console.log('');
    console.log('🎉 Seed completo!');
    console.log('');
    console.log('📧 Credenciais de acesso:');
    console.log('   Admin:         admin@inova.local / Admin@123');
    console.log('   Gestor:        carlos@inova.local / Gestor@123');
    console.log('   Analista:      maria@inova.local / Analista@123');
    console.log('   Desenvolvedor: ana@inova.local / Dev@1234');
    console.log('   Desenvolvedor: joao@inova.local / Dev@1234');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

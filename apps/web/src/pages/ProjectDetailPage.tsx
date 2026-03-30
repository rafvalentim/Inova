import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Tabs, Button, Tag, Descriptions, Table, Modal, Form, Input, DatePicker, Select, Space, message, Spin, Empty, Alert, Tooltip, Typography, Switch, Divider } from 'antd';
import { AppstoreOutlined, PlusOutlined, TeamOutlined, EditOutlined, DeleteOutlined, ExclamationCircleFilled, CheckCircleOutlined, RocketOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

const { confirm } = Modal;

const statusColors: Record<string, string> = {
    PLANNING: 'blue', IN_PROGRESS: 'orange', PAUSED: 'default', COMPLETED: 'green', CANCELLED: 'red', ACTIVE: 'green',
};
const statusLabels: Record<string, string> = {
    PLANNING: 'Planejamento', IN_PROGRESS: 'Em Andamento', PAUSED: 'Pausado', COMPLETED: 'Concluído', CANCELLED: 'Cancelado', ACTIVE: 'Ativa',
};

const CATEGORY_META: Record<string, { label: string; color: string }> = {
    CONTACT:         { label: 'Contato',           color: 'blue' },
    LINK_STAGING:    { label: 'Staging',            color: 'orange' },
    LINK_PRODUCTION: { label: 'Produção',           color: 'green' },
    LINK_DATABASE:   { label: 'Banco de Dados',     color: 'purple' },
    CREDENTIAL:      { label: 'Credencial',         color: 'red' },
    OTHER:           { label: 'Outro',              color: 'default' },
};

/** Retorna quantos dias faltam para o endDate da sprint (pode ser negativo se vencida) */
function daysUntilEnd(endDate: string): number {
    return dayjs(endDate).diff(dayjs().startOf('day'), 'day');
}

export default function ProjectDetailPage() {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user, hasPermission } = useAuthStore();
    const canSeeCredentials = ['Administrador', 'Analista'].includes(user?.role?.name ?? '');
    const canManageInfo = hasPermission('project_info', 'create');
    const [sprintModal, setSprintModal] = useState(false);
    const [carryOverModal, setCarryOverModal] = useState(false);
    const [completingSprint, setCompletingSprint] = useState<any>(null);
    const [carryOverTarget, setCarryOverTarget] = useState<string | null | undefined>(undefined);
    const [editingSprint, setEditingSprint] = useState<any>(null);
    const [memberModal, setMemberModal] = useState(false);
    const [infoModal, setInfoModal] = useState(false);
    const [editingInfo, setEditingInfo] = useState<any>(null);
    const [sprintForm] = Form.useForm();
    const [memberForm] = Form.useForm();
    const [infoForm] = Form.useForm();

    const { data: project, isLoading } = useQuery({
        queryKey: ['project', projectId],
        queryFn: () => api.get(`/projects/${projectId}`).then((r) => r.data.data),
    });

    const { data: sprints } = useQuery({
        queryKey: ['sprints', projectId],
        queryFn: () => api.get(`/sprints/projects/${projectId}/sprints`).then((r) => r.data.data),
        enabled: !!projectId,
    });

    const { data: users } = useQuery({
        queryKey: ['users-list'],
        queryFn: () => api.get('/users?pageSize=100').then((r) => r.data.data.items),
    });

    const { data: projectInfo = [] } = useQuery({
        queryKey: ['project-info', projectId],
        queryFn: () => api.get(`/projects/${projectId}/info`).then((r) => r.data.data),
        enabled: !!projectId,
    });

    const saveSprint = useMutation({
        mutationFn: (values: any) => {
            const payload = {
                name: values.name, goal: values.goal,
                startDate: values.dates[0].toISOString(), endDate: values.dates[1].toISOString(),
                capacityPts: values.capacityPts ? parseInt(values.capacityPts) : null,
            };
            if (editingSprint) {
                return api.put(`/sprints/${editingSprint.id}`, payload);
            }
            return api.post(`/sprints/projects/${projectId}/sprints`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sprints'] });
            message.success(editingSprint ? 'Sprint atualizada!' : 'Sprint criada!');
            setSprintModal(false);
            setEditingSprint(null);
            sprintForm.resetFields();
        },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro'),
    });

    const deleteSprint = useMutation({
        mutationFn: (id: string) => api.delete(`/sprints/${id}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sprints'] }); message.success('Sprint excluída!'); },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro'),
    });

    const addMember = useMutation({
        mutationFn: (values: any) => api.post(`/projects/${projectId}/members`, values),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project'] });
            message.success('Membro adicionado!');
            setMemberModal(false);
            memberForm.resetFields();
        },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro'),
    });

    const completeSprint = useMutation({
        mutationFn: async ({ sprintId, targetSprintId }: { sprintId: string; targetSprintId: string | null }) => {
            await api.post(`/sprints/${sprintId}/carry-over`, { targetSprintId });
            return api.patch(`/sprints/${sprintId}/status`, { status: 'COMPLETED' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sprints'] });
            queryClient.invalidateQueries({ queryKey: ['project', projectId] });
            message.success('Sprint concluída! Tasks incompletas foram movidas.');
            setCarryOverModal(false);
            setCompletingSprint(null);
            setCarryOverTarget(undefined);
        },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro ao concluir sprint'),
    });

    const saveInfo = useMutation({
        mutationFn: (values: any) => {
            const payload = {
                category: values.category,
                label: values.label,
                value: values.value,
                username: values.username || null,
                isSensitive: values.isSensitive ?? false,
                notes: values.notes || null,
            };
            if (editingInfo) {
                return api.put(`/projects/${projectId}/info/${editingInfo.id}`, payload);
            }
            return api.post(`/projects/${projectId}/info`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-info', projectId] });
            message.success(editingInfo ? 'Informação atualizada!' : 'Informação adicionada!');
            setInfoModal(false);
            setEditingInfo(null);
            infoForm.resetFields();
        },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro'),
    });

    const deleteInfo = useMutation({
        mutationFn: (id: string) => api.delete(`/projects/${projectId}/info/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-info', projectId] });
            message.success('Informação removida!');
        },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro'),
    });

    const activateSprint = useMutation({
        mutationFn: (id: string) => api.patch(`/sprints/${id}/status`, { status: 'ACTIVE' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sprints'] });
            queryClient.invalidateQueries({ queryKey: ['project', projectId] });
            message.success('Sprint ativada!');
        },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro'),
    });

    const showDeleteConfirm = (id: string, name: string) => {
        confirm({
            title: `Tem certeza que deseja excluir a sprint ${name}?`,
            icon: <ExclamationCircleFilled />,
            content: 'As tasks desta sprint serão movidas de volta para o Backlog do projeto.',
            okText: 'Sim, Excluir',
            okType: 'danger',
            cancelText: 'Cancelar',
            onOk() { deleteSprint.mutate(id); },
        });
    };

    const openEditSprint = (sprint: any) => {
        setEditingSprint(sprint);
        sprintForm.setFieldsValue({
            name: sprint.name,
            goal: sprint.goal,
            dates: [dayjs(sprint.startDate), dayjs(sprint.endDate)],
            capacityPts: sprint.capacityPts,
        });
        setSprintModal(true);
    };

    /** Abre modal de conclusão com a próxima sprint ativa pré-selecionada */
    const openCompleteSprint = (sprint: any) => {
        setCompletingSprint(sprint);
        // Pré-seleciona a próxima sprint ACTIVE ou PLANNING mais próxima
        const nextSprint = sprints
            ?.filter((s: any) => s.id !== sprint.id && (s.status === 'ACTIVE' || s.status === 'PLANNING'))
            .sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];
        setCarryOverTarget(nextSprint ? nextSprint.id : null);
        setCarryOverModal(true);
    };

    if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
    if (!project) return <Empty description="Projeto não encontrado" />;

    const sprintColumns = [
        {
            title: 'Nome',
            dataIndex: 'name',
            key: 'name',
            render: (name: string, r: any) => {
                const days = daysUntilEnd(r.endDate);
                const isNearEnd = r.status === 'ACTIVE' && days >= 0 && days <= 3;
                const isOverdue = r.status === 'ACTIVE' && days < 0;
                return (
                    <Space>
                        {name}
                        {isNearEnd && (
                            <Tooltip title={`Atenção: ${days === 0 ? 'termina hoje' : `faltam ${days} dia(s)`}`}>
                                <Tag icon={<WarningOutlined />} color="warning" style={{ margin: 0 }}>
                                    {days === 0 ? 'Termina hoje' : `${days}d restante${days > 1 ? 's' : ''}`}
                                </Tag>
                            </Tooltip>
                        )}
                        {isOverdue && (
                            <Tooltip title={`Sprint vencida há ${Math.abs(days)} dia(s) — será concluída automaticamente`}>
                                <Tag icon={<WarningOutlined />} color="error" style={{ margin: 0 }}>
                                    Vencida
                                </Tag>
                            </Tooltip>
                        )}
                    </Space>
                );
            },
        },
        { title: 'Status', key: 'status', width: 120, render: (_: any, r: any) => <Tag color={statusColors[r.status]}>{statusLabels[r.status] || r.status}</Tag> },
        { title: 'Início', key: 'start', width: 110, render: (_: any, r: any) => dayjs(r.startDate).format('DD/MM/YYYY') },
        { title: 'Fim', key: 'end', width: 110, render: (_: any, r: any) => dayjs(r.endDate).format('DD/MM/YYYY') },
        { title: 'Tasks', key: 'tasks', width: 70, align: 'center' as const, render: (_: any, r: any) => r._count?.tasks || 0 },
        {
            title: 'Ações', key: 'actions', width: 260, render: (_: any, r: any) => (
                <Space>
                    <Button size="small" icon={<AppstoreOutlined />} onClick={() => navigate(`/projects/${projectId}/board?sprint=${r.id}`)}>
                        Kanban
                    </Button>
                    {r.status === 'PLANNING' && (
                        <Button size="small" type="primary" ghost onClick={() => activateSprint.mutate(r.id)}>Ativar</Button>
                    )}
                    {r.status === 'ACTIVE' && (
                        <Button
                            size="small"
                            type="primary"
                            icon={<CheckCircleOutlined />}
                            onClick={() => openCompleteSprint(r)}
                        >
                            Concluir
                        </Button>
                    )}
                    <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEditSprint(r)} />
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => showDeleteConfirm(r.id, r.name)} />
                </Space>
            ),
        },
    ];

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Space>
                    <Tag color="purple" style={{ fontSize: 13, padding: '2px 10px' }}>{project.code}</Tag>
                    <Tag color={statusColors[project.status]}>{statusLabels[project.status]}</Tag>
                </Space>
                <Button type="primary" icon={<AppstoreOutlined />} onClick={() => navigate(`/projects/${projectId}/board`)}>
                    Quadro Kanban
                </Button>
            </div>

            <Tabs items={[
                {
                    key: 'info', label: 'Informações',
                    children: (
                        <>
                            <Card>
                                <Descriptions column={2} bordered size="small">
                                    <Descriptions.Item label="Código">{project.code}</Descriptions.Item>
                                    <Descriptions.Item label="Status"><Tag color={statusColors[project.status]}>{statusLabels[project.status]}</Tag></Descriptions.Item>
                                    <Descriptions.Item label="Data Início">{project.startDate ? dayjs(project.startDate).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
                                    <Descriptions.Item label="Previsão Término">{project.targetDate ? dayjs(project.targetDate).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
                                    <Descriptions.Item label="Horas Estimadas">{project.totalEstimatedHours ? `${project.totalEstimatedHours}h` : '—'}</Descriptions.Item>
                                    <Descriptions.Item label="Criado por">{project.createdBy?.name}</Descriptions.Item>
                                    <Descriptions.Item label="Criado em">{dayjs(project.createdAt).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
                                </Descriptions>
                                {project.description && <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>{project.description}</p>}
                            </Card>

                            <Divider orientation="left" style={{ marginTop: 24 }}>Informações úteis</Divider>

                            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
                                {canManageInfo && (
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        size="small"
                                        onClick={() => { infoForm.resetFields(); setEditingInfo(null); setInfoModal(true); }}
                                    >
                                        Adicionar Informação
                                    </Button>
                                )}
                            </div>

                            {(projectInfo as any[]).length === 0 ? (
                                <Empty description="Nenhuma informação cadastrada" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {(projectInfo as any[]).map((item: any) => (
                                        <Card key={item.id} size="small" styles={{ body: { padding: '10px 14px' } }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <Space size={4} style={{ marginBottom: 4, flexWrap: 'wrap' }}>
                                                        <Typography.Text strong>{item.label}</Typography.Text>
                                                        <Tag color={CATEGORY_META[item.category]?.color ?? 'default'} style={{ margin: 0 }}>
                                                            {CATEGORY_META[item.category]?.label ?? item.category}
                                                        </Tag>
                                                        {canSeeCredentials && item.isSensitive && (
                                                            <Tag color="red" style={{ margin: 0 }}>Sensível</Tag>
                                                        )}
                                                    </Space>
                                                    {item.category === 'CREDENTIAL' ? (
                                                        <>
                                                            {item.username && (
                                                                <div style={{ marginTop: 2 }}>
                                                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>Usuário: </Typography.Text>
                                                                    <Typography.Text copyable style={{ fontSize: 12 }}>{item.username}</Typography.Text>
                                                                </div>
                                                            )}
                                                            <div style={{ marginTop: 2 }}>
                                                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>Senha: </Typography.Text>
                                                                <Typography.Text copyable style={{ fontSize: 12 }}>{item.value}</Typography.Text>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div>
                                                                <Typography.Text copyable style={{ fontSize: 13, wordBreak: 'break-all' }}>
                                                                    {item.value}
                                                                </Typography.Text>
                                                            </div>
                                                            {item.username && (
                                                                <div style={{ marginTop: 2 }}>
                                                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>Usuário: </Typography.Text>
                                                                    <Typography.Text copyable style={{ fontSize: 12 }}>{item.username}</Typography.Text>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                    {item.notes && (
                                                        <div style={{ marginTop: 6, padding: '4px 8px', background: 'var(--bg-subtle, rgba(0,0,0,0.03))', borderRadius: 4, borderLeft: '3px solid var(--color-border, #e0e0e0)' }}>
                                                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Observação: </Typography.Text>
                                                            <Typography.Text style={{ fontSize: 12 }}>{item.notes}</Typography.Text>
                                                        </div>
                                                    )}
                                                </div>
                                                {canManageInfo && (
                                                    <Space size={4} style={{ flexShrink: 0 }}>
                                                        <Button
                                                            type="text"
                                                            size="small"
                                                            icon={<EditOutlined />}
                                                            onClick={() => {
                                                                setEditingInfo(item);
                                                                infoForm.setFieldsValue({
                                                                    category: item.category,
                                                                    label: item.label,
                                                                    value: item.value,
                                                                    username: item.username,
                                                                    isSensitive: item.isSensitive,
                                                                    notes: item.notes,
                                                                });
                                                                setInfoModal(true);
                                                            }}
                                                        />
                                                        <Button
                                                            type="text"
                                                            size="small"
                                                            danger
                                                            icon={<DeleteOutlined />}
                                                            onClick={() => confirm({
                                                                title: 'Remover informação?',
                                                                icon: <ExclamationCircleFilled />,
                                                                okText: 'Remover',
                                                                okType: 'danger',
                                                                cancelText: 'Cancelar',
                                                                onOk: () => deleteInfo.mutate(item.id),
                                                            })}
                                                        />
                                                    </Space>
                                                )}
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </>
                    ),
                },
                {
                    key: 'sprints', label: `Sprints (${sprints?.length || 0})`,
                    children: (
                        <>
                            <div style={{ marginBottom: 16 }}>
                                <Button type="primary" icon={<PlusOutlined />} onClick={() => { sprintForm.resetFields(); setEditingSprint(null); setSprintModal(true); }}>
                                    Nova Sprint
                                </Button>
                            </div>
                            <Table columns={sprintColumns} dataSource={sprints || []} rowKey="id" pagination={false} size="small" />
                        </>
                    ),
                },
                {
                    key: 'members', label: `Membros (${project.members?.length || 0})`,
                    children: (
                        <>
                            <div style={{ marginBottom: 16 }}>
                                <Button type="primary" icon={<TeamOutlined />} onClick={() => { memberForm.resetFields(); setMemberModal(true); }}>
                                    Adicionar Membro
                                </Button>
                            </div>
                            <Table
                                dataSource={project.members || []}
                                rowKey="id"
                                pagination={false}
                                size="small"
                                columns={[
                                    { title: 'Nome', key: 'name', render: (_: any, r: any) => r.user.name },
                                    { title: 'Email', key: 'email', render: (_: any, r: any) => r.user.email },
                                    { title: 'Papel', dataIndex: 'roleInProject', key: 'role' },
                                    { title: 'Desde', key: 'joined', render: (_: any, r: any) => dayjs(r.joinedAt).format('DD/MM/YYYY') },
                                ]}
                            />
                        </>
                    ),
                },
            ]} />

            {/* Modal: Conclusão de Sprint com Carry-Over */}
            <Modal
                title={
                    <Space>
                        <RocketOutlined style={{ color: '#6366f1' }} />
                        <span>Concluir Sprint: {completingSprint?.name}</span>
                    </Space>
                }
                open={carryOverModal}
                onCancel={() => { setCarryOverModal(false); setCompletingSprint(null); }}
                onOk={() => completeSprint.mutate({ sprintId: completingSprint?.id, targetSprintId: carryOverTarget ?? null })}
                okText="Concluir Sprint"
                okButtonProps={{ loading: completeSprint.isPending, type: 'primary' }}
                cancelText="Cancelar"
            >
                {completingSprint && (
                    <div>
                        <Alert
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                            message="O que acontece ao concluir a sprint?"
                            description="As tasks com status DONE permanecerão nesta sprint. As tasks não concluídas serão movidas para a sprint selecionada abaixo (ou para o Backlog se nenhuma for escolhida)."
                        />
                        <Form layout="vertical">
                            <Form.Item label="Mover tasks incompletas para:">
                                <Select
                                    placeholder="Backlog do Projeto"
                                    allowClear
                                    value={carryOverTarget}
                                    onChange={(v) => setCarryOverTarget(v ?? null)}
                                    style={{ width: '100%' }}
                                >
                                    {sprints
                                        ?.filter((s: any) => s.id !== completingSprint?.id && s.status !== 'COMPLETED' && s.status !== 'CANCELLED')
                                        .sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                                        .map((s: any) => (
                                            <Select.Option key={s.id} value={s.id}>
                                                {s.name} — {s.status === 'ACTIVE' ? 'Ativa' : 'Planejamento'} ({dayjs(s.startDate).format('DD/MM')} a {dayjs(s.endDate).format('DD/MM/YY')})
                                            </Select.Option>
                                        ))}
                                </Select>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                                    {carryOverTarget
                                        ? `Tasks incompletas serão movidas para a sprint selecionada.`
                                        : 'Sem seleção: tasks incompletas irão para o Backlog do Projeto.'}
                                </div>
                            </Form.Item>
                        </Form>
                    </div>
                )}
            </Modal>

            {/* Modal: Criar/Editar Sprint */}
            <Modal
                title={editingSprint ? "Editar Sprint" : "Nova Sprint"}
                open={sprintModal}
                onCancel={() => setSprintModal(false)}
                onOk={() => sprintForm.submit()}
                okText={editingSprint ? "Salvar" : "Criar"}
                cancelText="Cancelar"
            >
                <Form form={sprintForm} layout="vertical" onFinish={(v) => saveSprint.mutate(v)}>
                    <Form.Item name="name" label="Nome" rules={[{ required: true }]}><Input placeholder="Ex: Sprint 6" /></Form.Item>
                    <Form.Item name="goal" label="Objetivo"><Input.TextArea rows={2} /></Form.Item>
                    <Form.Item name="dates" label="Período" rules={[{ required: true }]}><DatePicker.RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item>
                    <Form.Item name="capacityPts" label="Capacidade (Story Points)"><Input type="number" /></Form.Item>
                </Form>
            </Modal>

            {/* Modal: Adicionar Membro */}
            <Modal title="Adicionar Membro" open={memberModal} onCancel={() => setMemberModal(false)} onOk={() => memberForm.submit()} okText="Adicionar">
                <Form form={memberForm} layout="vertical" onFinish={(v) => addMember.mutate(v)}>
                    <Form.Item name="userId" label="Usuário" rules={[{ required: true }]}>
                        <Select placeholder="Selecione" showSearch optionFilterProp="children">
                            {users?.map((u: any) => <Select.Option key={u.id} value={u.id}>{u.name}</Select.Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name="roleInProject" label="Papel no Projeto" initialValue="Membro">
                        <Select>
                            <Select.Option value="Líder">Líder</Select.Option>
                            <Select.Option value="Analista">Analista</Select.Option>
                            <Select.Option value="Desenvolvedor">Desenvolvedor</Select.Option>
                            <Select.Option value="Membro">Membro</Select.Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Modal: Adicionar/Editar Informação do Projeto */}
            <Modal
                title={editingInfo ? 'Editar Informação' : 'Adicionar Informação'}
                open={infoModal}
                onCancel={() => { setInfoModal(false); setEditingInfo(null); infoForm.resetFields(); }}
                onOk={() => infoForm.submit()}
                okText={editingInfo ? 'Salvar' : 'Adicionar'}
                okButtonProps={{ loading: saveInfo.isPending }}
                cancelText="Cancelar"
            >
                <Form
                    form={infoForm}
                    layout="vertical"
                    onFinish={(v) => saveInfo.mutate(v)}
                    initialValues={{ category: 'CONTACT', isSensitive: false }}
                >
                    <Form.Item name="category" label="Categoria" rules={[{ required: true }]}>
                        <Select
                            onChange={(v) => {
                                if (v === 'CREDENTIAL') infoForm.setFieldValue('isSensitive', true);
                            }}
                        >
                            <Select.Option value="CONTACT">Contato</Select.Option>
                            <Select.Option value="LINK_STAGING">Ambiente Staging</Select.Option>
                            <Select.Option value="LINK_PRODUCTION">Ambiente Produção</Select.Option>
                            <Select.Option value="LINK_DATABASE">Banco de Dados</Select.Option>
                            {canSeeCredentials && <Select.Option value="CREDENTIAL">Credencial</Select.Option>}
                            <Select.Option value="OTHER">Outro</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="label" label="Identificação" rules={[{ required: true, message: 'Identificação é obrigatória' }]}>
                        <Input placeholder="Ex: João Silva - PO, Sistema ERP Produção..." />
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate={(prev, curr) => prev.category !== curr.category}>
                        {({ getFieldValue }) => {
                            const cat = getFieldValue('category');
                            const isCredential = cat === 'CREDENTIAL';
                            const isLink = ['LINK_STAGING', 'LINK_PRODUCTION', 'LINK_DATABASE'].includes(cat);
                            return (
                                <Form.Item
                                    name="value"
                                    label={isCredential ? 'Senha' : isLink ? 'URL' : 'Valor'}
                                    rules={[{ required: true, message: isCredential ? 'Senha é obrigatória' : 'Valor é obrigatório' }]}
                                >
                                    {isCredential
                                        ? <Input.Password placeholder="Senha de acesso" />
                                        : <Input placeholder={isLink ? 'https://...' : 'Ex: joao@empresa.com, +55 11 99999-9999'} />
                                    }
                                </Form.Item>
                            );
                        }}
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate={(prev, curr) => prev.category !== curr.category}>
                        {({ getFieldValue }) => getFieldValue('category') !== 'CONTACT' && (
                            <Form.Item name="username" label="Usuário (login)">
                                <Input placeholder="Ex: admin, root" />
                            </Form.Item>
                        )}
                    </Form.Item>
                    {canSeeCredentials && (
                        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.category !== curr.category}>
                            {({ getFieldValue }) => (
                                <Form.Item name="isSensitive" label="Informação sensível" valuePropName="checked">
                                    <Switch disabled={getFieldValue('category') === 'CREDENTIAL'} />
                                </Form.Item>
                            )}
                        </Form.Item>
                    )}
                    <Form.Item name="notes" label="Observação">
                        <Input.TextArea rows={2} placeholder="Informações adicionais (opcional)" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

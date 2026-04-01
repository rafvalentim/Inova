import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Modal, Form, Input, InputNumber, DatePicker, Tag, Space, message, Select, Row, Col, Empty, Dropdown, MenuProps } from 'antd';
import { PlusOutlined, TeamOutlined, CalendarOutlined, EllipsisOutlined, EditOutlined, DeleteOutlined, ExclamationCircleFilled, RollbackOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../services/api';

const { confirm } = Modal;

const statusColors: Record<string, string> = {
    PLANNING: 'blue', IN_PROGRESS: 'orange', PAUSED: 'default', COMPLETED: 'green', CANCELLED: 'red',
};
const statusLabels: Record<string, string> = {
    PLANNING: 'Planejamento', IN_PROGRESS: 'Em Andamento', PAUSED: 'Pausado', COMPLETED: 'Concluído', CANCELLED: 'Cancelado',
};

export default function ProjectsPage() {
    const [modalOpen, setModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<any>(null);
    const [filterSearch, setFilterSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string | undefined>();
    const [form] = Form.useForm();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data, isLoading } = useQuery({
        queryKey: ['projects', 'includeCancelled'],
        queryFn: () => api.get('/projects?pageSize=100&includeCancelled=true').then((r) => r.data.data),
    });

    const { data: users } = useQuery({
        queryKey: ['users-list'],
        queryFn: () => api.get('/users?pageSize=100').then((r) => r.data.data.items),
    });

    const saveMutation = useMutation({
        mutationFn: (values: any) => {
            const payload = {
                name: values.name,
                description: values.description,
                totalEstimatedHours: values.totalEstimatedHours ?? null,
                startDate: values.dates?.[0]?.toISOString(),
                targetDate: values.dates?.[1]?.toISOString(),
                memberIds: values.memberIds || [],
            };
            if (editingProject) {
                return api.put(`/projects/${editingProject.id}`, payload);
            }
            return api.post('/projects', payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects', 'includeCancelled'] });
            message.success(editingProject ? 'Projeto atualizado!' : 'Projeto criado!');
            setModalOpen(false);
            setEditingProject(null);
            form.resetFields();
        },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/projects/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects', 'includeCancelled'] });
            message.success('Projeto cancelado!');
        },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro'),
    });

    const reactivateMutation = useMutation({
        mutationFn: (id: string) => api.patch(`/projects/${id}/status`, { status: 'IN_PROGRESS' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects', 'includeCancelled'] });
            message.success('Projeto reativado!');
        },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro'),
    });

    const openEdit = (project: any) => {
        setEditingProject(project);
        form.setFieldsValue({
            name: project.name,
            description: project.description,
            totalEstimatedHours: project.totalEstimatedHours,
            dates: project.startDate ? [dayjs(project.startDate), project.targetDate ? dayjs(project.targetDate) : undefined] : undefined,
        });
        setModalOpen(true);
    };

    const showDeleteConfirm = (id: string, name: string) => {
        confirm({
            title: `Cancelar o projeto "${name}"?`,
            icon: <ExclamationCircleFilled />,
            content: 'O projeto será marcado como cancelado e ficará oculto das demais telas. Você poderá reativá-lo aqui quando quiser.',
            okText: 'Sim, Cancelar',
            okType: 'danger',
            cancelText: 'Voltar',
            onOk() {
                deleteMutation.mutate(id);
            },
        });
    };

    const filteredItems = (data?.items || []).filter((p: any) => {
        const s = filterSearch.toLowerCase();
        const matchSearch = !s || p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s);
        const matchStatus = !filterStatus || p.status === filterStatus;
        return matchSearch && matchStatus;
    });

    return (
        <div className="fade-in">
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <Space wrap>
                    <Input
                        prefix={<SearchOutlined />}
                        placeholder="Buscar por nome ou código..."
                        value={filterSearch}
                        onChange={e => setFilterSearch(e.target.value)}
                        style={{ width: 260 }}
                        allowClear
                    />
                    <Select
                        placeholder="Status"
                        allowClear
                        style={{ width: 160 }}
                        value={filterStatus}
                        onChange={setFilterStatus}
                    >
                        {Object.entries(statusLabels).map(([k, v]) => (
                            <Select.Option key={k} value={k}>{v}</Select.Option>
                        ))}
                    </Select>
                </Space>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setEditingProject(null); setModalOpen(true); }}>
                    Novo Projeto
                </Button>
            </div>

            {isLoading ? (
                <div style={{ textAlign: 'center', padding: 60 }}>Carregando...</div>
            ) : filteredItems.length ? (
                <Row gutter={[16, 16]}>
                    {filteredItems.map((project: any) => {
                        const total = project._count?.tasks || 0;
                        const isCancelled = project.status === 'CANCELLED';
                        const items: MenuProps['items'] = isCancelled
                            ? [{ key: 'reactivate', icon: <RollbackOutlined />, label: 'Reativar' }]
                            : [
                                { key: 'edit', icon: <EditOutlined />, label: 'Editar' },
                                { key: 'delete', icon: <DeleteOutlined />, label: 'Cancelar', danger: true },
                            ];

                        return (
                            <Col key={project.id} xs={24} sm={12} lg={8} xl={6}>
                                <Card
                                    hoverable={!isCancelled}
                                    style={{ borderColor: 'var(--border)', opacity: isCancelled ? 0.6 : 1 }}
                                    styles={{ body: { padding: 20 } }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                        <Tag color="purple" style={{ fontSize: 11, fontWeight: 600 }}>{project.code}</Tag>
                                        <Space>
                                            <Tag color={statusColors[project.status]}>{statusLabels[project.status]}</Tag>
                                            <Dropdown menu={{
                                                items, onClick: ({ key, domEvent }) => {
                                                    domEvent.stopPropagation();
                                                    if (key === 'edit') openEdit(project);
                                                    if (key === 'delete') showDeleteConfirm(project.id, project.name);
                                                    if (key === 'reactivate') reactivateMutation.mutate(project.id);
                                                }
                                            }} trigger={['click']}>
                                                <Button type="text" size="small" icon={<EllipsisOutlined style={{ fontSize: 18 }} />} />
                                            </Dropdown>
                                        </Space>
                                    </div>
                                    <div onClick={() => navigate(`/projects/${project.id}`)} style={{ cursor: 'pointer' }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 600, margin: '8px 0', color: 'var(--text-main)' }}>{project.name}</h3>
                                        {project.description && (
                                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                                                {project.description.substring(0, 80)}{project.description.length > 80 ? '...' : ''}
                                            </p>
                                        )}
                                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                                            <span><TeamOutlined /> {project._count?.members || 0}</span>
                                            <span>📋 {total} tasks</span>
                                            <span>🏃 {project._count?.sprints || 0} sprints</span>
                                            {project.totalEstimatedHours && <span>⏱ {project.totalEstimatedHours}h estimadas</span>}
                                        </div>
                                        {project.startDate && (
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.8 }}>
                                                <CalendarOutlined /> {dayjs(project.startDate).format('DD/MM/YYYY')} → {project.targetDate ? dayjs(project.targetDate).format('DD/MM/YYYY') : '—'}
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>
            ) : (
                <Empty description="Nenhum projeto criado ainda" />
            )}

            <Modal title={editingProject ? "Editar Projeto" : "Novo Projeto"} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} okText={editingProject ? "Salvar" : "Criar"} cancelText="Cancelar" width={600}>
                <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
                    <Form.Item name="name" label="Nome do Projeto" rules={[{ required: true }]}><Input placeholder="Ex: Hefesto ERP" /></Form.Item>
                    <Form.Item name="description" label="Descrição"><Input.TextArea rows={3} /></Form.Item>
                    <Form.Item name="totalEstimatedHours" label="Total de Horas Estimadas">
                        <InputNumber style={{ width: '100%' }} min={0} step={1} placeholder="Ex: 320" addonAfter="h" />
                    </Form.Item>
                    <Form.Item name="dates" label="Período">
                        <DatePicker.RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                    </Form.Item>
                    {!editingProject && (
                        <Form.Item name="memberIds" label="Membros (opcional)">
                            <Select mode="multiple" placeholder="Selecione membros" optionFilterProp="children">
                                {users?.map((u: any) => <Select.Option key={u.id} value={u.id}>{u.name} ({u.email})</Select.Option>)}
                            </Select>
                        </Form.Item>
                    )}
                </Form>
            </Modal>
        </div>
    );
}

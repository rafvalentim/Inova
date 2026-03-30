import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, Button, Modal, Form, Input, Tag, Space, message, Popconfirm, Checkbox } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../services/api';

const RESOURCES = [
    { key: 'users', label: 'Usuários' },
    { key: 'roles', label: 'Tipos de Usuário' },
    { key: 'projects', label: 'Projetos' },
    { key: 'project_members', label: 'Membros Projeto' },
    { key: 'sprints', label: 'Sprints' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'comments', label: 'Comentários' },
    { key: 'attachments', label: 'Anexos' },
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'reports', label: 'Relatórios' },
    { key: 'audit_logs', label: 'Audit Log' },
    { key: 'settings', label: 'Configurações' },
    { key: 'clockify', label: 'Clockify' },
];

const ACTIONS = ['create', 'read', 'update', 'delete'];

export default function RolesPage() {
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [permissions, setPermissions] = useState<Record<string, string[]>>({});
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    const { data: roles, isLoading } = useQuery({
        queryKey: ['roles'],
        queryFn: () => api.get('/roles').then((r) => r.data.data),
    });

    const createMutation = useMutation({
        mutationFn: (values: any) => api.post('/roles', { ...values, permissions }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['roles'] }); message.success('Tipo criado!'); closeModal(); },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...values }: any) => api.put(`/roles/${id}`, { ...values, permissions }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['roles'] }); message.success('Tipo atualizado!'); closeModal(); },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/roles/${id}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['roles'] }); message.success('Tipo excluído!'); },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro'),
    });

    const closeModal = () => { setModalOpen(false); setEditing(null); form.resetFields(); setPermissions({}); };

    const openCreate = () => { setEditing(null); form.resetFields(); setPermissions({}); setModalOpen(true); };

    const openEdit = (record: any) => {
        setEditing(record);
        form.setFieldsValue({ name: record.name, description: record.description });
        setPermissions(record.permissions || {});
        setModalOpen(true);
    };

    const togglePermission = (resource: string, action: string) => {
        setPermissions((prev) => {
            const current = prev[resource] || [];
            const has = current.includes(action);
            return {
                ...prev,
                [resource]: has ? current.filter((a) => a !== action) : [...current, action],
            };
        });
    };

    const onFinish = (values: any) => {
        if (editing) updateMutation.mutate({ id: editing.id, ...values });
        else createMutation.mutate(values);
    };

    const columns = [
        { title: 'Nome', dataIndex: 'name', key: 'name' },
        { title: 'Descrição', dataIndex: 'description', key: 'description' },
        {
            title: 'Sistema', key: 'isSystem',
            render: (_: any, r: any) => r.isSystem ? <Tag color="blue">Sistema</Tag> : <Tag>Customizado</Tag>,
        },
        { title: 'Usuários', key: 'users', render: (_: any, r: any) => r._count?.users ?? 0 },
        {
            title: 'Ações', key: 'actions', width: 120,
            render: (_: any, record: any) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
                    {!record.isSystem && (
                        <Popconfirm title="Excluir tipo?" onConfirm={() => deleteMutation.mutate(record.id)}>
                            <Button size="small" icon={<DeleteOutlined />} danger />
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    const filteredRoles = (roles || []).filter((r: any) =>
        !search || r.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2>Tipos de Usuário</h2>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Novo Tipo</Button>
            </div>

            <Input
                placeholder="Buscar por nome"
                prefix={<SearchOutlined />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                allowClear
                style={{ width: 260, marginBottom: 16 }}
            />

            <Table columns={columns} dataSource={filteredRoles} loading={isLoading} rowKey="id" pagination={false} />

            <Modal
                title={editing ? 'Editar Tipo de Usuário' : 'Novo Tipo de Usuário'}
                open={modalOpen}
                onCancel={closeModal}
                onOk={() => form.submit()}
                okText="Salvar"
                cancelText="Cancelar"
                width={700}
            >
                <Form form={form} layout="vertical" onFinish={onFinish}>
                    <Form.Item name="name" label="Nome" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="description" label="Descrição"><Input.TextArea rows={2} /></Form.Item>
                </Form>

                <h4 style={{ marginTop: 16, marginBottom: 12 }}>Permissões</h4>
                <table style={{ width: '100%', fontSize: 13 }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '8px 4px' }}>Recurso</th>
                            {ACTIONS.map((a) => <th key={a} style={{ padding: '8px 4px', textAlign: 'center' }}>{a === 'create' ? 'Criar' : a === 'read' ? 'Ler' : a === 'update' ? 'Editar' : 'Excluir'}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {RESOURCES.map((res) => (
                            <tr key={res.key}>
                                <td style={{ padding: '4px' }}>{res.label}</td>
                                {ACTIONS.map((action) => (
                                    <td key={action} style={{ textAlign: 'center', padding: '4px' }}>
                                        <Checkbox
                                            checked={(permissions[res.key] || []).includes(action)}
                                            onChange={() => togglePermission(res.key, action)}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Modal>
        </div>
    );
}

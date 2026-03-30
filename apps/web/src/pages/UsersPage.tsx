import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

const statusColors: Record<string, string> = { ACTIVE: 'green', INACTIVE: 'default', BLOCKED: 'red' };
const statusLabels: Record<string, string> = { ACTIVE: 'Ativo', INACTIVE: 'Inativo', BLOCKED: 'Bloqueado' };

export default function UsersPage() {
    const { user: currentUser } = useAuthStore();
    const [modalOpen, setModalOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState<string | undefined>();
    const [filterStatus, setFilterStatus] = useState<string | undefined>();
    const [editing, setEditing] = useState<any>(null);
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: () => api.get('/users?pageSize=100').then((r) => r.data.data),
    });

    const { data: roles } = useQuery({
        queryKey: ['roles'],
        queryFn: () => api.get('/roles').then((r) => r.data.data),
    });

    const createMutation = useMutation({
        mutationFn: (values: any) => api.post('/users', values),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); message.success('Usuário criado!'); closeModal(); },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...values }: any) => api.put(`/users/${id}`, values),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); message.success('Usuário atualizado!'); closeModal(); },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro'),
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/users/${id}/status`, { status }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); message.success('Status atualizado!'); },
    });

    const closeModal = () => { setModalOpen(false); setEditing(null); form.resetFields(); };

    const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };

    const openEdit = (record: any) => {
        setEditing(record);
        form.setFieldsValue({ name: record.name, email: record.email, roleId: record.role.id, clockifyId: record.clockifyId || '' });
        setModalOpen(true);
    };

    const onFinish = (values: any) => {
        if (editing) {
            updateMutation.mutate({ id: editing.id, ...values });
        } else {
            createMutation.mutate(values);
        }
    };

    const columns = [
        { title: 'Nome', dataIndex: 'name', key: 'name', sorter: (a: any, b: any) => a.name.localeCompare(b.name) },
        { title: 'Email', dataIndex: 'email', key: 'email' },
        { title: 'Tipo', key: 'role', render: (_: any, r: any) => <Tag>{r.role.name}</Tag> },
        {
            title: 'Clockify ID', key: 'clockifyId',
            render: (_: any, r: any) => r.clockifyId
                ? <Tag color="cyan" style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.clockifyId}</Tag>
                : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Não vinculado</span>,
        },
        {
            title: 'Status', key: 'status',
            render: (_: any, r: any) => <Tag color={statusColors[r.status]}>{statusLabels[r.status]}</Tag>,
        },
        {
            title: 'Ações', key: 'actions', width: 150,
            render: (_: any, record: any) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
                    {record.status === 'ACTIVE' ? (
                        <Popconfirm
                            title="Desativar usuário?"
                            disabled={record.id === currentUser?.id}
                            onConfirm={() => statusMutation.mutate({ id: record.id, status: 'INACTIVE' })}
                        >
                            <Button size="small" icon={<StopOutlined />} danger disabled={record.id === currentUser?.id} />
                        </Popconfirm>
                    ) : (
                        <Button size="small" icon={<CheckCircleOutlined />} onClick={() => statusMutation.mutate({ id: record.id, status: 'ACTIVE' })} />
                    )}
                </Space>
            ),
        },
    ];

    const filteredUsers = (data?.items || []).filter((u: any) => {
        const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
        const matchRole = !filterRole || u.role.id === filterRole;
        const matchStatus = !filterStatus || u.status === filterStatus;
        return matchSearch && matchRole && matchStatus;
    });

    return (
        <div className="fade-in">
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Novo Usuário</Button>
            </div>

            <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
                <Input
                    placeholder="Buscar por nome ou email"
                    prefix={<SearchOutlined />}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    allowClear
                    style={{ width: 260 }}
                />
                <Select
                    placeholder="Filtrar por tipo"
                    value={filterRole}
                    onChange={setFilterRole}
                    allowClear
                    style={{ width: 200 }}
                    options={(roles || []).map((r: any) => ({ value: r.id, label: r.name }))}
                />
                <Select
                    placeholder="Filtrar por status"
                    value={filterStatus}
                    onChange={setFilterStatus}
                    allowClear
                    style={{ width: 180 }}
                    options={[
                        { value: 'ACTIVE', label: 'Ativo' },
                        { value: 'INACTIVE', label: 'Inativo' },
                        { value: 'BLOCKED', label: 'Bloqueado' },
                    ]}
                />
            </Space>

            <Table columns={columns} dataSource={filteredUsers} loading={isLoading} rowKey="id" pagination={{ pageSize: 15 }} />

            <Modal title={editing ? 'Editar Usuário' : 'Novo Usuário'} open={modalOpen} onCancel={closeModal} onOk={() => form.submit()} okText="Salvar" cancelText="Cancelar">
                <Form form={form} layout="vertical" onFinish={onFinish}>
                    <Form.Item name="name" label="Nome" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}><Input /></Form.Item>
                    {!editing && (
                        <Form.Item name="password" label="Senha temporária" rules={[{ required: true }, { min: 8 }]}><Input.Password /></Form.Item>
                    )}
                    <Form.Item name="roleId" label="Tipo de Usuário" rules={[{ required: true }]}>
                        <Select placeholder="Selecione">
                            {roles?.map((r: any) => <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="clockifyId"
                        label="Clockify User ID"
                        tooltip="ID do usuário no Clockify para vinculação automática de horas. Encontre em: Clockify > Workspace > Members > copie o ID da URL do perfil."
                    >
                        <Input placeholder="Ex: 64a1b2c3d4e5f6a7b8c9d0e1" allowClear />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

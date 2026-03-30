import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Form, Input, Button, message, Tag, Descriptions, Space, Divider } from 'antd';
import { SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, SettingOutlined } from '@ant-design/icons';
import api from '../services/api';

export default function SettingsPage() {
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    const { data: clockifyConfig, isLoading } = useQuery({
        queryKey: ['clockify-config'],
        queryFn: () => api.get('/clockify/config').then((r) => r.data.data),
    });

    const { data: clockifyStatus } = useQuery({
        queryKey: ['clockify-status'],
        queryFn: () => api.get('/clockify/status').then((r) => r.data.data),
    });

    const saveConfig = useMutation({
        mutationFn: (values: any) => api.put('/clockify/config', values),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clockify-config'] }); message.success('Configuração salva!'); },
        onError: (e: any) => message.error(e.response?.data?.message || 'Erro'),
    });

    const syncNow = useMutation({
        mutationFn: () => api.post('/clockify/sync'),
        onSuccess: (res: any) => {
            queryClient.invalidateQueries({ queryKey: ['clockify-status'] });
            message.success(res.data.message || 'Sincronização concluída');
        },
        onError: () => message.warning('Clockify indisponível. Use registro manual de horas.'),
    });

    return (
        <div className="fade-in">
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
                {/* Clockify Integration */}
                <Card title={<><SettingOutlined /> Integração Clockify</>}>
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={(v) => saveConfig.mutate(v)}
                        initialValues={{
                            apiKey: '',
                            workspaceId: clockifyConfig?.workspaceId || '',
                        }}
                    >
                        <Form.Item name="apiKey" label="API Key" rules={[{ required: true }]}>
                            <Input.Password placeholder={clockifyConfig?.hasApiKey ? '••••••• (configurada)' : 'Cole sua API Key do Clockify'} />
                        </Form.Item>
                        <Form.Item name="workspaceId" label="Workspace ID" rules={[{ required: true }]}>
                            <Input placeholder="ID do workspace no Clockify" />
                        </Form.Item>
                        <Button type="primary" htmlType="submit" loading={saveConfig.isPending}>
                            Salvar Configuração
                        </Button>
                    </Form>

                    <Divider />

                    <Descriptions column={2} size="small">
                        <Descriptions.Item label="Status">
                            {clockifyStatus?.syncStatus === 'SUCCESS' ? (
                                <Tag icon={<CheckCircleOutlined />} color="success">Sincronizado</Tag>
                            ) : clockifyStatus?.syncStatus === 'ERROR' ? (
                                <Tag icon={<CloseCircleOutlined />} color="error">Erro</Tag>
                            ) : clockifyStatus?.syncStatus === 'SYNCING' ? (
                                <Tag icon={<SyncOutlined spin />} color="processing">Sincronizando</Tag>
                            ) : (
                                <Tag color="default">Não configurado</Tag>
                            )}
                        </Descriptions.Item>
                        <Descriptions.Item label="Última Sincronização">
                            {clockifyStatus?.lastSyncAt
                                ? new Date(clockifyStatus.lastSyncAt).toLocaleString('pt-BR')
                                : 'Nunca'}
                        </Descriptions.Item>
                    </Descriptions>

                    <Button
                        icon={<SyncOutlined />}
                        loading={syncNow.isPending}
                        onClick={() => syncNow.mutate()}
                        style={{ marginTop: 12 }}
                        disabled={!clockifyConfig?.hasApiKey}
                    >
                        Sincronizar Agora
                    </Button>
                </Card>

                {/* System Info */}
                <Card title="Informações do Sistema">
                    <Descriptions column={2} size="small">
                        <Descriptions.Item label="Versão">1.0.0</Descriptions.Item>
                        <Descriptions.Item label="Ambiente">Desenvolvimento</Descriptions.Item>
                        <Descriptions.Item label="API">http://localhost:3000</Descriptions.Item>
                        <Descriptions.Item label="Database">PostgreSQL 15</Descriptions.Item>
                    </Descriptions>
                </Card>
            </Space>
        </div>
    );
}

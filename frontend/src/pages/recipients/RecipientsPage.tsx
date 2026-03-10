import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  Button,
  Collapse,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography,
  Tour,
} from 'antd';
import type { TourProps } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { recipientsApi } from '@/api/recipients.api';
import type {
  Recipient,
  RecipientGroup,
  RecipientGroupType,
  RecipientGroupUser,
} from '@/api/recipients.api';
import { branchesApi } from '@/api/branches.api';
import { distributionsApi } from '@/api/distributions.api';
import { useAuthStore } from '@/store/auth.store';

export default function RecipientsPage() {
  const [form] = Form.useForm();
  const [groupForm] = Form.useForm();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [modalOpen, setModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [editingGroup, setEditingGroup] = useState<RecipientGroup | null>(null);
  const [selectedDistributionId, setSelectedDistributionId] = useState<string | null>(null);
  const userDistributionId = useAuthStore((s) => s.user?.distributionId);

  useEffect(() => {
    if (userDistributionId && !selectedDistributionId) {
      setSelectedDistributionId(userDistributionId);
    }
  }, [userDistributionId, selectedDistributionId]);

  const groupsQuery = useQuery({
    queryKey: ['recipient-groups'],
    queryFn: () => recipientsApi.listGroups(),
  });

  const distributionsQuery = useQuery({
    queryKey: ['distributions'],
    queryFn: () => distributionsApi.list(),
  });

  const branchesQuery = useQuery({
    queryKey: ['branches', selectedDistributionId ?? ''],
    queryFn: () => branchesApi.list(selectedDistributionId ?? undefined),
    enabled: !!selectedDistributionId,
  });

  const mappingsQuery = useQuery({
    queryKey: ['branch-approval-mappings', selectedDistributionId ?? ''],
    queryFn: () => recipientsApi.getBranchApprovalMappings(selectedDistributionId ?? undefined),
    enabled: !!selectedDistributionId,
  });

  const usersForPickerQuery = useQuery({
    queryKey: ['recipients', 'users-for-picker'],
    queryFn: () => recipientsApi.getUsersForPicker(),
  });

  const createGroupMutation = useMutation({
    mutationFn: recipientsApi.createGroup,
    onSuccess: () => {
      messageApi.success('Grupa je kreirana.');
      setGroupModalOpen(false);
      groupForm.resetFields();
      void queryClient.invalidateQueries({ queryKey: ['recipient-groups'] });
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Greška',
      );
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; description?: string; type?: RecipientGroupType; distributionId?: string };
    }) => recipientsApi.updateGroup(id, data),
    onSuccess: () => {
      messageApi.success('Grupa je ažurirana.');
      setGroupModalOpen(false);
      setEditingGroup(null);
      groupForm.resetFields();
      void queryClient.invalidateQueries({ queryKey: ['recipient-groups'] });
      void queryClient.invalidateQueries({ queryKey: ['branch-approval-mappings'] });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: recipientsApi.deleteGroup,
    onSuccess: () => {
      messageApi.success('Grupa je obrisana.');
      void queryClient.invalidateQueries({ queryKey: ['recipient-groups'] });
    },
  });

  const createRecipientMutation = useMutation({
    mutationFn: recipientsApi.createRecipient,
    onSuccess: () => {
      messageApi.success('Primalac je dodan.');
      setModalOpen(false);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ['recipient-groups'] });
    },
  });

  const updateRecipientMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Recipient>;
    }) => recipientsApi.updateRecipient(id, data),
    onSuccess: () => {
      messageApi.success('Primalac je ažuriran.');
      setModalOpen(false);
      setEditingRecipient(null);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ['recipient-groups'] });
    },
  });

  const deleteRecipientMutation = useMutation({
    mutationFn: recipientsApi.deleteRecipient,
    onSuccess: () => {
      messageApi.success('Primalac je obrisan.');
      void queryClient.invalidateQueries({ queryKey: ['recipient-groups'] });
    },
  });

  const setBranchApprovalMutation = useMutation({
    mutationFn: ({ branchId, recipientGroupId }: { branchId: string; recipientGroupId: string }) =>
      recipientsApi.setBranchApprovalGroup(branchId, recipientGroupId),
    onSuccess: () => {
      messageApi.success('Mapiranje je sačuvano.');
      void queryClient.invalidateQueries({ queryKey: ['branch-approval-mappings'] });
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Greška',
      );
    },
  });

  const removeBranchApprovalMutation = useMutation({
    mutationFn: (branchId: string) => recipientsApi.removeBranchApprovalGroup(branchId),
    onSuccess: () => {
      messageApi.success('Mapiranje je uklonjeno.');
      void queryClient.invalidateQueries({ queryKey: ['branch-approval-mappings'] });
    },
  });

  const addUserToGroupMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      recipientsApi.addUserToGroup(groupId, userId),
    onSuccess: () => {
      messageApi.success('Korisnik je dodan u grupu.');
      void queryClient.invalidateQueries({ queryKey: ['recipient-groups'] });
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Greška',
      );
    },
  });

  const removeUserFromGroupMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      recipientsApi.removeUserFromGroup(groupId, userId),
    onSuccess: () => {
      messageApi.success('Korisnik je uklonjen iz grupe.');
      void queryClient.invalidateQueries({ queryKey: ['recipient-groups'] });
    },
  });

  const handleGroupSubmit = (values: {
    name: string;
    description?: string;
    type?: RecipientGroupType;
    distributionId?: string;
  }) => {
    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id, data: values });
    } else {
      createGroupMutation.mutate(values);
    }
  };

  const handleRecipientSubmit = (values: {
    email: string;
    firstName: string;
    lastName: string;
    position?: string;
    groupId: string;
  }) => {
    if (editingRecipient) {
      updateRecipientMutation.mutate({
        id: editingRecipient.id,
        data: values,
      });
    } else {
      createRecipientMutation.mutate({ ...values, isActive: true });
    }
  };

  const groups = groupsQuery.data ?? [];
  const approvalGroups = groups.filter((g) => g.type === 'APPROVAL');
  const distributions = distributionsQuery.data ?? [];
  const branches = branchesQuery.data ?? [];
  const mappings = mappingsQuery.data ?? [];
  const mappingByBranch = Object.fromEntries(mappings.map((m) => [m.branchId, m.recipientGroupId]));
  const effectiveDistributionId = selectedDistributionId ?? userDistributionId ?? undefined;

  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = window.localStorage.getItem('sim-tracker-page-tour-recipients-v1');
    const globalActive = window.localStorage.getItem('sim-tracker-global-tour-active') === '1';
    if (!seen && !globalActive) {
      setTourOpen(true);
    }
  }, []);

  return (
    <div
      className="space-y-6"
      data-tour-id="admin-recipients"
      data-tour-role="SYSTEM_ADMIN MODERATOR"
    >
      {contextHolder}
      <div
        className="flex justify-between items-center"
        data-tour-id="recipients-header"
      >
        <Typography.Title level={3} className="!mb-0">
          Grupe primalaca
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingGroup(null);
            groupForm.resetFields();
            setGroupModalOpen(true);
          }}
        >
          Nova grupa
        </Button>
      </div>

      <Collapse
        data-tour-id="recipients-groups"
        items={groups.map((group) => ({
          key: group.id,
          label: (
            <div className="flex justify-between items-center w-full pr-4">
              <span>
                <Typography.Text strong>{group.name}</Typography.Text>
                <Typography.Text type="secondary" className="ml-2">
                  ({group.type === 'APPROVAL' ? 'Odobrenje' : 'PDF'})
                </Typography.Text>
                {group.description && (
                  <Typography.Text type="secondary" className="ml-2">
                    – {group.description}
                  </Typography.Text>
                )}
              </span>
              <Space onClick={(e) => e.stopPropagation()}>
                <Button
                  size="small"
                  onClick={() => {
                    setEditingGroup(group);
                    groupForm.setFieldsValue({
                      name: group.name,
                      description: group.description,
                      type: group.type ?? 'PDF',
                      distributionId: group.distributionId,
                    });
                    setGroupModalOpen(true);
                  }}
                >
                  Uredi
                </Button>
                <Popconfirm
                  title="Obriši grupu?"
                  description="Svi primaoci u grupi će biti obrisani."
                  onConfirm={() => deleteGroupMutation.mutate(group.id)}
                >
                  <Button size="small" danger>
                    Obriši
                  </Button>
                </Popconfirm>
                <Button
                  size="small"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEditingRecipient(null);
                    form.resetFields();
                    form.setFieldValue('groupId', group.id);
                    setModalOpen(true);
                  }}
                >
                  Dodaj primaoca
                </Button>
              </Space>
            </div>
          ),
          children: (
            <div className="space-y-4">
              <Table
                dataSource={group.recipients}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                { title: 'Email', dataIndex: 'email' },
                {
                  title: 'Ime',
                  render: (_: unknown, r: Recipient) =>
                    `${r.firstName} ${r.lastName}`,
                },
                { title: 'Pozicija', dataIndex: 'position' },
                {
                  title: 'Aktivan',
                  dataIndex: 'isActive',
                  render: (v: boolean) => (v ? 'Da' : 'Ne'),
                },
                {
                  title: 'Akcije',
                  render: (_: unknown, r: Recipient) => (
                    <Space>
                      <Button
                        size="small"
                        onClick={() => {
                          setEditingRecipient(r);
                          form.setFieldsValue({
                            email: r.email,
                            firstName: r.firstName,
                            lastName: r.lastName,
                            position: r.position,
                            groupId: r.groupId,
                          });
                          setModalOpen(true);
                        }}
                      >
                        Uredi
                      </Button>
                      <Popconfirm
                        title="Obriši primaoca?"
                        onConfirm={() =>
                          deleteRecipientMutation.mutate(r.id)
                        }
                      >
                        <Button size="small" danger>
                          Obriši
                        </Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
              {group.type === 'APPROVAL' && (
                <div>
                  <Typography.Text strong className="block mb-2">
                    Korisnici aplikacije u grupi (notifikacije + email)
                  </Typography.Text>
                  <div className="flex flex-col gap-2 mb-2">
                    <Select
                      key={`group-users-${group.id}-${(group.groupUsers?.length ?? 0)}`}
                      className="min-w-[200px]"
                      placeholder="Dodaj korisnika aplikacije"
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      onChange={(userId) => {
                        if (userId) {
                          addUserToGroupMutation.mutate({
                            groupId: group.id,
                            userId,
                          });
                        }
                      }}
                      loading={
                        addUserToGroupMutation.isPending ||
                        usersForPickerQuery.isLoading
                      }
                      notFoundContent={
                        usersForPickerQuery.isSuccess ? (
                          (usersForPickerQuery.data?.length ?? 0) === 0 ? (
                            <span className="text-gray-500">
                              Nema korisnika. Dodajte ih na stranici Korisnici.
                            </span>
                          ) : (
                            <span className="text-gray-500">
                              Svi korisnici su već u grupi.
                            </span>
                          )
                        ) : null
                      }
                      options={(usersForPickerQuery.data ?? [])
                        .filter(
                          (u) =>
                            !(group.groupUsers ?? []).some(
                              (gu) => gu.user.id === u.id,
                            ),
                        )
                        .map((u) => ({
                          value: u.id,
                          label: `${u.firstName} ${u.lastName} (${u.email})`,
                        }))}
                    />
                    {usersForPickerQuery.isSuccess &&
                      (usersForPickerQuery.data?.length ?? 0) === 0 && (
                        <Typography.Text type="secondary" className="text-sm">
                          Nema korisnika za dodavanje. Dodajte korisnike na
                          stranici Korisnici i dodijelite im distribuciju
                          (moderator vidi samo korisnike iz svoje distribucije).
                        </Typography.Text>
                      )}
                    {usersForPickerQuery.isError && (
                      <Typography.Text type="danger">
                        Ne mogu učitati korisnike. Pokušajte ponovo.
                      </Typography.Text>
                    )}
                  </div>
                  {(group.groupUsers?.length ?? 0) > 0 && (
                    <Table
                      dataSource={group.groupUsers ?? []}
                      rowKey={(r: RecipientGroupUser) => r.userId}
                      size="small"
                      pagination={false}
                      columns={[
                        {
                          title: 'Email',
                          dataIndex: ['user', 'email'],
                        },
                        {
                          title: 'Ime',
                          render: (_: unknown, r: RecipientGroupUser) =>
                            `${r.user.firstName} ${r.user.lastName}`,
                        },
                        {
                          title: 'Rola',
                          dataIndex: ['user', 'role'],
                        },
                        {
                          title: 'Akcije',
                          render: (_: unknown, r: RecipientGroupUser) => (
                            <Popconfirm
                              title="Ukloni korisnika iz grupe?"
                              onConfirm={() =>
                                removeUserFromGroupMutation.mutate({
                                  groupId: group.id,
                                  userId: r.userId,
                                })
                              }
                            >
                              <Button size="small" danger>
                                Ukloni
                              </Button>
                            </Popconfirm>
                          ),
                        },
                      ]}
                    />
                  )}
                </div>
              )}
            </div>
          ),
        }        ))}
      />

      <div
        className="mt-8"
        data-tour-id="recipients-branch-mapping"
      >
        <Typography.Title level={4} className="!mb-3">
          Mapiranje podružnica na grupe za odobrenje
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="!mb-4">
          Definišite koje podružnice šalju zapisnike kojoj grupi na odobrenje. Operator iz podružnice
          će slati zapisnike članovima odabrane grupe.
        </Typography.Paragraph>
        <Form.Item label="Distribucija">
          <Select
            className="w-64"
            placeholder="Odaberi distribuciju"
            allowClear
            value={effectiveDistributionId ?? undefined}
            onChange={(v) => setSelectedDistributionId(v ?? null)}
            options={distributions.map((d) => ({ value: d.id, label: d.name }))}
          />
        </Form.Item>
        {effectiveDistributionId && (
          <Table
            dataSource={branches}
            rowKey="id"
            size="small"
            pagination={false}
            loading={branchesQuery.isLoading}
            columns={[
              { title: 'Podružnica', dataIndex: 'name' },
              { title: 'Šifra', dataIndex: 'code' },
                {
                title: 'Grupa za odobrenje',
                render: (_: unknown, branch: { id: string; name: string; code: string }) => (
                  <Select
                    className="w-full"
                    placeholder="Odaberi grupu"
                    allowClear
                    value={mappingByBranch[branch.id] ?? undefined}
                    onChange={(groupId) => {
                      if (groupId) {
                        setBranchApprovalMutation.mutate({
                          branchId: branch.id,
                          recipientGroupId: groupId,
                        });
                      } else {
                        removeBranchApprovalMutation.mutate(branch.id);
                      }
                    }}
                    options={approvalGroups.map((g) => ({ value: g.id, label: g.name }))}
                    loading={setBranchApprovalMutation.isPending || removeBranchApprovalMutation.isPending}
                  />
                ),
              },
            ]}
          />
        )}
      </div>

      <Modal
        title={editingGroup ? 'Uredi grupu' : 'Nova grupa'}
        open={groupModalOpen}
        onCancel={() => {
          setGroupModalOpen(false);
          setEditingGroup(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={groupForm}
          layout="vertical"
          onFinish={handleGroupSubmit}
        >
          <Form.Item
            name="name"
            label="Naziv"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Opis">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="type" label="Tip grupe" initialValue="PDF">
            <Select
              options={[
                { value: 'PDF', label: 'PDF (za slanje zapisnika)' },
                { value: 'APPROVAL', label: 'Odobrenje (za pregled zapisnika)' },
              ]}
            />
          </Form.Item>
          <Form.Item name="distributionId" label="Distribucija (opciono)">
            <Select
              allowClear
              placeholder="Sve distribucije"
              options={distributions.map((d) => ({ value: d.id, label: d.name }))}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={
                  createGroupMutation.isPending ||
                  updateGroupMutation.isPending
                }
              >
                Sačuvaj
              </Button>
              <Button onClick={() => setGroupModalOpen(false)}>
                Odustani
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingRecipient ? 'Uredi primaoca' : 'Novi primalac'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingRecipient(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleRecipientSubmit}>
          <Form.Item name="groupId" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true }, { type: 'email' }]}
          >
            <Input disabled={!!editingRecipient} />
          </Form.Item>
          <Form.Item name="firstName" label="Ime" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="lastName" label="Prezime" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="position" label="Pozicija">
            <Input />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={
                  createRecipientMutation.isPending ||
                  updateRecipientMutation.isPending
                }
              >
                Sačuvaj
              </Button>
              <Button onClick={() => setModalOpen(false)}>Odustani</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      <Tour
        open={tourOpen}
        current={tourStep}
        onClose={() => {
          setTourOpen(false);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('sim-tracker-page-tour-recipients-v1', '1');
          }
        }}
        onChange={(next) => setTourStep(next)}
        steps={
          [
            {
              title: 'Grupe primalaca',
              description:
                'Ovdje definiraš grupe primalaca za slanje emailova i/ili odobravanje zapisnika.',
              target: () =>
                document.querySelector('[data-tour-id="recipients-header"]') as HTMLElement,
            },
            {
              title: 'Lista grupa i primaoci',
              description:
                'Svaki panel predstavlja jednu grupu; unutra vidiš email primaoce i možeš ih uređivati.',
              target: () =>
                document.querySelector('[data-tour-id="recipients-groups"]') as HTMLElement,
            },
            {
              title: 'Korisnici aplikacije u approval grupi',
              description:
                'Za APPROVAL grupe možeš dodati korisnike aplikacije koji će dobiti in-app notifikacije i imati pravo odobravanja.',
              target: () =>
                document.querySelector(
                  '.ant-collapse-content-box .ant-select',
                ) as HTMLElement,
            },
            {
              title: 'Mapiranje podružnica na approval grupe',
              description:
                'Ovdje spajaš podružnice sa odgovarajućim APPROVAL grupama koje će im odobravati zapisnike.',
              target: () =>
                document.querySelector(
                  '[data-tour-id="recipients-branch-mapping"]',
                ) as HTMLElement,
            },
          ].filter((step) => {
            try {
              return Boolean(step.target && step.target());
            } catch {
              return false;
            }
          }) as TourProps['steps']
        }
      />
    </div>
  );
}

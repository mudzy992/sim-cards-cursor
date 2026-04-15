import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Divider,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Select,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, EditOutlined, UserOutlined, ApartmentOutlined, BankOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { usersApi, type CreateUserInput, type UpdateUserInput } from '@/api/users.api';
import { distributionsApi, type Distribution } from '@/api/distributions.api';
import { branchesApi, type Branch } from '@/api/branches.api';
import { branchModeratorsApi } from '@/api/branch-moderators.api'
import { useAuthStore } from '@/store/auth.store';
import type { UserListItem } from '@/types/user.types';
import type { UserRole } from '@/types/auth.types';
import { getUserRoleLabel, getUserStatusLabel } from '@/utils/labels.utils'

const ROLE_OPTIONS: { label: string; value: UserRole }[] = [
  { label: 'Sistemski administrator', value: 'SYSTEM_ADMIN' },
  { label: 'Distribucijski admin', value: 'DIST_ADMIN' },
  { label: 'Operator', value: 'USER' },
];

const STATUS_OPTIONS = [
  { label: 'Aktivan', value: 'ACTIVE' },
  { label: 'Neaktivan', value: 'INACTIVE' },
  { label: 'Suspendovan', value: 'SUSPENDED' },
];

export default function UsersListPage() {
  const queryClient = useQueryClient();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState<string>('users');
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [form] = Form.useForm<CreateUserInput & { confirmPassword?: string }>();
  const [distDrawerOpen, setDistDrawerOpen] = useState(false);
  const [editingDist, setEditingDist] = useState<Distribution | null>(null);
  const [distForm] = Form.useForm<{ name: string; code: string }>();
  const [branchDrawerOpen, setBranchDrawerOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchForm] = Form.useForm<{ distributionId: string; name: string; code: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const currentUserRole = currentUser?.role;
  const [moderatorBranchIds, setModeratorBranchIds] = useState<string[]>([])
  const [pendingModeratorSync, setPendingModeratorSync] = useState<{
    userId: string
    desiredBranchIds: string[]
  } | null>(null)

  const usersQuery = useQuery({
    queryKey: ['users', 'list'],
    queryFn: () => usersApi.list(),
  });

  const distributionsQuery = useQuery({
    queryKey: ['distributions', 'list'],
    queryFn: () => distributionsApi.list(),
    enabled: currentUserRole === 'SYSTEM_ADMIN' || currentUserRole === 'DIST_ADMIN',
  });

  const branchesQuery = useQuery({
    queryKey: ['branches', 'list'],
    queryFn: () => branchesApi.list(),
    enabled: currentUserRole === 'SYSTEM_ADMIN' || currentUserRole === 'DIST_ADMIN',
  });

  const branchModeratorAssignmentsQuery = useQuery({
    queryKey: ['branch-moderators', 'list', 'user', editing?.id],
    queryFn: () => branchModeratorsApi.list({ userId: editing!.id }),
    enabled: currentUserRole === 'SYSTEM_ADMIN' && userDrawerOpen && Boolean(editing?.id),
  })

  const createDistMutation = useMutation({
    mutationFn: (data: { name: string; code: string }) => distributionsApi.create(data),
    onSuccess: () => {
      messageApi.success('Distribucija kreirana');
      queryClient.invalidateQueries({ queryKey: ['distributions'] });
      setDistDrawerOpen(false);
      distForm.resetFields();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      messageApi.error(err.response?.data?.message ?? 'Greška');
    },
  });

  const updateDistMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; code: string }> }) =>
      distributionsApi.update(id, data),
    onSuccess: () => {
      messageApi.success('Distribucija ažurirana');
      queryClient.invalidateQueries({ queryKey: ['distributions'] });
      setDistDrawerOpen(false);
      setEditingDist(null);
      distForm.resetFields();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      messageApi.error(err.response?.data?.message ?? 'Greška');
    },
  });

  const deleteDistMutation = useMutation({
    mutationFn: (id: string) => distributionsApi.delete(id),
    onSuccess: () => {
      messageApi.success('Distribucija obrisana');
      queryClient.invalidateQueries({ queryKey: ['distributions'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      messageApi.error(err.response?.data?.message ?? 'Greška');
    },
  });

  const createBranchMutation = useMutation({
    mutationFn: (data: { distributionId: string; name: string; code: string }) =>
      branchesApi.create(data),
    onSuccess: () => {
      messageApi.success('Podružnica kreirana');
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setBranchDrawerOpen(false);
      branchForm.resetFields();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      messageApi.error(err.response?.data?.message ?? 'Greška');
    },
  });

  const updateBranchMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; code: string }> }) =>
      branchesApi.update(id, data),
    onSuccess: () => {
      messageApi.success('Podružnica ažurirana');
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setBranchDrawerOpen(false);
      setEditingBranch(null);
      branchForm.resetFields();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      messageApi.error(err.response?.data?.message ?? 'Greška');
    },
  });

  const deleteBranchMutation = useMutation({
    mutationFn: (id: string) => branchesApi.delete(id),
    onSuccess: () => {
      messageApi.success('Podružnica obrisana');
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      messageApi.error(err.response?.data?.message ?? 'Greška');
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateUserInput) => usersApi.create(data),
    onSuccess: () => {
      messageApi.success('Korisnik kreiran');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setUserDrawerOpen(false);
      setEditing(null);
      form.resetFields();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      messageApi.error(err.response?.data?.message ?? 'Greška');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) =>
      usersApi.update(id, data),
    onSuccess: async () => {
      messageApi.success('Korisnik ažuriran');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (pendingModeratorSync?.userId) {
        const currentAssignments = branchModeratorAssignmentsQuery.data ?? []
        const desiredBranchIds = pendingModeratorSync.desiredBranchIds
        const currentBranchIds = currentAssignments.map((a) => a.branchId)
        const toAdd = desiredBranchIds.filter((b) => !currentBranchIds.includes(b))
        const toRemove = currentAssignments.filter((a) => !desiredBranchIds.includes(a.branchId))
        try {
          await Promise.all([
            ...toAdd.map((branchId) => branchModeratorsApi.assign({ userId: pendingModeratorSync.userId, branchId })),
            ...toRemove.map((a) => branchModeratorsApi.remove(a.id)),
          ])
          await queryClient.invalidateQueries({ queryKey: ['branch-moderators'] })
        } catch (e) {
          messageApi.error(
            (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              'Greška pri spremanju moderatora podružnica.',
          )
        } finally {
          setPendingModeratorSync(null)
        }
      }
      setUserDrawerOpen(false);
      setEditing(null);
      form.resetFields();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      messageApi.error(err.response?.data?.message ?? 'Greška');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      messageApi.success('Korisnik obrisan');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      messageApi.error(err.response?.data?.message ?? 'Greška');
    },
  });

  const distributions = (Array.isArray(distributionsQuery.data) ? distributionsQuery.data : []) as Distribution[];
  const branches = (Array.isArray(branchesQuery.data) ? branchesQuery.data : []) as Branch[];

  const handleOpenCreate = () => {
    setEditing(null);
    form.resetFields();
    setUserDrawerOpen(true);
  };

  const handleOpenDistCreate = () => {
    setEditingDist(null);
    distForm.resetFields();
    setDistDrawerOpen(true);
  };

  const handleOpenDistEdit = (row: Distribution) => {
    setEditingDist(row);
    distForm.setFieldsValue({ name: row.name, code: row.code });
    setDistDrawerOpen(true);
  };

  const handleDistSubmit = () => {
    distForm.validateFields().then((values) => {
      if (editingDist) {
        updateDistMutation.mutate({ id: editingDist.id, data: values });
      } else {
        createDistMutation.mutate(values);
      }
    });
  };

  const handleOpenBranchCreate = () => {
    setEditingBranch(null);
    branchForm.resetFields();
    setBranchDrawerOpen(true);
  };

  const handleOpenBranchEdit = (row: Branch) => {
    setEditingBranch(row);
    branchForm.setFieldsValue({
      distributionId: row.distributionId,
      name: row.name,
      code: row.code,
    });
    setBranchDrawerOpen(true);
  };

  const handleBranchSubmit = () => {
    branchForm.validateFields().then((values) => {
      if (editingBranch) {
        updateBranchMutation.mutate({ id: editingBranch.id, data: { name: values.name, code: values.code } });
      } else {
        createBranchMutation.mutate(values);
      }
    });
  };

  const handleOpenEdit = async (row: UserListItem) => {
    setEditing(row);
    setModeratorBranchIds([])
    form.setFieldsValue({
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone ?? undefined,
      role: row.role,
      status: row.status,
      distributionId: row.distributionId ?? undefined,
      branchId: row.branchId ?? undefined,
    });
    setUserDrawerOpen(true);
  };

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const { confirmPassword, ...rest } = values;
      if (!editing && rest.password && rest.password !== confirmPassword) {
        messageApi.error('Lozinke se ne podudaraju');
        return;
      }
      const payload: CreateUserInput & UpdateUserInput = {
        ...rest,
        distributionId: rest.role === 'DIST_ADMIN' ? rest.distributionId : undefined,
        branchId: rest.role === 'USER' ? rest.branchId : undefined,
      };
      if (editing) {
        if (currentUserRole === 'SYSTEM_ADMIN') {
          setPendingModeratorSync({ userId: editing.id, desiredBranchIds: moderatorBranchIds })
        }
        const updateData: UpdateUserInput = { ...payload };
        if (!updateData.password) delete updateData.password;
        updateMutation.mutate({ id: editing.id, data: updateData });
      } else {
        createMutation.mutate(payload as CreateUserInput);
      }
    });
  };

  useEffect(() => {
    if (!userDrawerOpen || currentUserRole !== 'SYSTEM_ADMIN' || !editing?.id) return
    const currentAssignments = branchModeratorAssignmentsQuery.data ?? []
    setModeratorBranchIds(currentAssignments.map((a) => a.branchId))
  }, [userDrawerOpen, currentUserRole, editing?.id, branchModeratorAssignmentsQuery.data])

  const rows = usersQuery.data?.items ?? [];
  const canManage = currentUserRole === 'SYSTEM_ADMIN';
  const canEdit = currentUserRole === 'SYSTEM_ADMIN' || currentUserRole === 'DIST_ADMIN';
  const showOrgTabs = currentUserRole === 'SYSTEM_ADMIN';

  const tabItems = [
    {
      key: 'users',
      label: (
        <span>
          <UserOutlined /> Korisnici
        </span>
      ),
      children: (
        <div className="space-y-4">
          <div
            className="flex justify-between items-center"
            data-tour-id="users-header"
          >
            <Typography.Text type="secondary">
              Upravljanje korisnicima, ulogama i statusima.
            </Typography.Text>
            {canManage && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                Novi korisnik
              </Button>
            )}
          </div>
          <Table<UserListItem>
        rowKey="id"
        loading={usersQuery.isLoading}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 900 }}
        columns={[
          {
            title: 'Ime i prezime',
            render: (_, row) => `${row.firstName} ${row.lastName}`,
          },
          { title: 'Email', dataIndex: 'email' },
          {
            title: 'Korisničko ime',
            dataIndex: 'username',
            render: (v: string | null) => v ?? '-',
          },
          {
            title: 'Role',
            dataIndex: 'role',
            render: (r: UserRole) => <Tag>{getUserRoleLabel(r)}</Tag>,
          },
          {
            title: 'Distribucija / Podružnica',
            render: (_, row) =>
              row.distributionId ? (
                <Tag color="blue">Distribucija</Tag>
              ) : row.branchId ? (
                <Tag color="green">Podružnica</Tag>
              ) : (
                '-'
              ),
          },
          {
            title: 'Status',
            dataIndex: 'status',
            render: (s) => (
              <Tag color={s === 'ACTIVE' ? 'green' : s === 'SUSPENDED' ? 'red' : 'orange'}>
                {getUserStatusLabel(s)}
              </Tag>
            ),
          },
          ...(canEdit
            ? [
                {
                  title: 'Akcije',
                  render: (_: unknown, row: UserListItem) => (
                    <div className="flex gap-2">
                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleOpenEdit(row)}
                      >
                        Uredi
                      </Button>
                      {canManage && (
                        <Popconfirm
                          title="Obrisati korisnika?"
                          onConfirm={() => deleteMutation.mutate(row.id)}
                        >
                          <Button size="small" danger>
                            Obriši
                          </Button>
                        </Popconfirm>
                      )}
                    </div>
                  ),
                },
              ]
            : []),
        ]}
            data-tour-id="users-table"
          />
        </div>
      ),
    },
    ...(showOrgTabs
      ? [
          {
            key: 'distributions',
            label: (
              <span>
                <ApartmentOutlined /> Distribucije
              </span>
            ),
            children: (
              <div className="space-y-4">
                <div
                  className="flex justify-between items-center"
                  data-tour-id="users-distributions-header"
                >
                  <Typography.Text type="secondary">
                    Organizacijske jedinice – distribucije (npr. ED Zenica).
                  </Typography.Text>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenDistCreate}>
                    Nova distribucija
                  </Button>
                </div>
                <Table<Distribution>
                  rowKey="id"
                  loading={distributionsQuery.isLoading}
                  dataSource={distributions}
                  pagination={false}
                  columns={[
                    { title: 'Naziv', dataIndex: 'name' },
                    { title: 'Kod', dataIndex: 'code' },
                    {
                      title: 'Akcije',
                      render: (_: unknown, row: Distribution) => (
                        <div className="flex gap-2">
                          <Button size="small" onClick={() => handleOpenDistEdit(row)}>
                            Uredi
                          </Button>
                          <Popconfirm
                            title="Obrisati distribuciju?"
                            onConfirm={() => deleteDistMutation.mutate(row.id)}
                          >
                            <Button size="small" danger>
                              Obriši
                            </Button>
                          </Popconfirm>
                        </div>
                      ),
                    },
                  ]}
                  data-tour-id="users-distributions-table"
                />
              </div>
            ),
          },
          {
            key: 'branches',
            label: (
              <span>
                <BankOutlined /> Podružnice
              </span>
            ),
            children: (
              <div className="space-y-4">
                <div
                  className="flex justify-between items-center"
                  data-tour-id="users-branches-header"
                >
                  <Typography.Text type="secondary">
                    Podružnice unutar distribucija (npr. Zenica, Travnik).
                  </Typography.Text>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenBranchCreate}>
                    Nova podružnica
                  </Button>
                </div>
                <Table<Branch>
                  rowKey="id"
                  loading={branchesQuery.isLoading}
                  dataSource={branches}
                  pagination={false}
                  columns={[
                    {
                      title: 'Distribucija',
                      render: (_: unknown, row: Branch) => row.distribution?.name ?? row.distributionId,
                    },
                    { title: 'Naziv', dataIndex: 'name' },
                    { title: 'Kod', dataIndex: 'code' },
                    {
                      title: 'Akcije',
                      render: (_: unknown, row: Branch) => (
                        <div className="flex gap-2">
                          <Button size="small" onClick={() => handleOpenBranchEdit(row)}>
                            Uredi
                          </Button>
                          <Popconfirm
                            title="Obrisati podružnicu?"
                            onConfirm={() => deleteBranchMutation.mutate(row.id)}
                          >
                            <Button size="small" danger>
                              Obriši
                            </Button>
                          </Popconfirm>
                        </div>
                      ),
                    },
                  ]}
                  data-tour-id="users-branches-table"
                />
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div
      className="space-y-4"
      data-tour-id="admin-users"
      data-tour-role="SYSTEM_ADMIN DIST_ADMIN"
    >
      {messageContextHolder}
      <div className="flex justify-between items-center">
        <Typography.Title level={3} className="!mb-0">
          Korisnici
        </Typography.Title>
      </div>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      <Drawer
        title={editing ? 'Uredi korisnika' : 'Novi korisnik'}
        open={userDrawerOpen}
        width={520}
        onClose={() => {
          setUserDrawerOpen(false)
          setEditing(null)
          form.resetFields()
        }}
        styles={{ body: { overflowY: 'auto', paddingBottom: 96 } }}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setUserDrawerOpen(false)
                setEditing(null)
                form.resetFields()
              }}
            >
              Odustani
            </Button>
            <Button
              type="primary"
              loading={createMutation.isPending || updateMutation.isPending}
              onClick={handleSubmit}
            >
              {editing ? 'Snimi' : 'Kreiraj'}
            </Button>
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(changedValues) => {
            if (!('role' in changedValues)) return
            const nextRole = changedValues.role as UserRole | undefined
            if (nextRole !== 'DIST_ADMIN') form.setFieldValue('distributionId', undefined)
            if (nextRole !== 'USER') form.setFieldValue('branchId', undefined)
          }}
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true }, { type: 'email' }]}
          >
            <Input placeholder="email@example.com" disabled={!!editing} />
          </Form.Item>
          {!editing && (
            <>
              <Form.Item
                name="password"
                label="Lozinka"
                rules={[{ required: true }, { min: 8 }]}
              >
                <Input.Password placeholder="Min. 8 znakova" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="Potvrdi lozinku"
                rules={[
                  { required: true },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Lozinke se ne podudaraju'));
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="Ponovi lozinku" />
              </Form.Item>
            </>
          )}
          {editing && (
            <Form.Item name="password" label="Nova lozinka (ostavite prazno za bez promjene)">
              <Input.Password placeholder="Opcionalno" />
            </Form.Item>
          )}
          <Form.Item name="firstName" label="Ime" rules={[{ required: true }]}>
            <Input placeholder="Ime" />
          </Form.Item>
          <Form.Item name="lastName" label="Prezime" rules={[{ required: true }]}>
            <Input placeholder="Prezime" />
          </Form.Item>
          <Form.Item name="phone" label="Telefon">
            <Input placeholder="+38761111222" />
          </Form.Item>
          <Form.Item name="role" label="Uloga" rules={[{ required: true }]}>
            <Select
              placeholder="Odaberi ulogu"
              options={ROLE_OPTIONS}
              disabled={editing?.id === currentUser?.id}
            />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Select placeholder="Odaberi status" options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, next) => prev.role !== next.role}
          >
            {({ getFieldValue }) => {
              const roleValue = getFieldValue('role') as UserRole | undefined
              const showDistribution = roleValue === 'DIST_ADMIN'
              const showBranch = roleValue === 'USER'
              return (
                <>
                  {showDistribution && (
                    <Form.Item name="distributionId" label="Distribucija">
                      <Select
                        placeholder="Odaberi distribuciju (za distribucijskog admina)"
                        allowClear
                        options={distributions.map((d) => ({
                          label: `${d.name} (${d.code})`,
                          value: d.id,
                        }))}
                      />
                    </Form.Item>
                  )}
                  {showBranch && (
                    <Form.Item name="branchId" label="Podružnica">
                      <Select
                        placeholder="Odaberi podružnicu (za operatora)"
                        allowClear
                        options={branches.map((b) => ({
                          label: `${b.name} (${b.code})${b.distribution ? ` – ${b.distribution.name}` : ''}`,
                          value: b.id,
                        }))}
                      />
                    </Form.Item>
                  )}
                </>
              )
            }}
          </Form.Item>
          {currentUserRole === 'SYSTEM_ADMIN' && editing?.id && (
            <>
              <Divider className="!my-3" />
              <Form.Item label="Moderator podružnica (opciono)">
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="Odaberi jednu ili više podružnica"
                  value={moderatorBranchIds}
                  onChange={(next) => setModeratorBranchIds(next)}
                  options={branches.map((b) => ({
                    label: `${b.name} (${b.code})${b.distribution ? ` – ${b.distribution.name}` : ''}`,
                    value: b.id,
                  }))}
                  loading={branchModeratorAssignmentsQuery.isLoading || branchesQuery.isLoading}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
              <Typography.Text type="secondary" className="block -mt-2">
                Korisnik ostaje USER/OPERATOR po roli, ali ima dodatnu moderatorsku ovlast za odabrane podružnice.
              </Typography.Text>
            </>
          )}
        </Form>
      </Drawer>
      <Drawer
        title={editingDist ? 'Uredi distribuciju' : 'Nova distribucija'}
        open={distDrawerOpen}
        width={520}
        onClose={() => {
          setDistDrawerOpen(false)
          setEditingDist(null)
          distForm.resetFields()
        }}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setDistDrawerOpen(false)
                setEditingDist(null)
                distForm.resetFields()
              }}
            >
              Odustani
            </Button>
            <Button
              type="primary"
              loading={createDistMutation.isPending || updateDistMutation.isPending}
              onClick={handleDistSubmit}
            >
              {editingDist ? 'Snimi' : 'Kreiraj'}
            </Button>
          </div>
        }
      >
        <Form form={distForm} layout="vertical">
          <Form.Item name="name" label="Naziv" rules={[{ required: true }]}>
            <Input placeholder="npr. ED Zenica" />
          </Form.Item>
          <Form.Item name="code" label="Kod" rules={[{ required: true }]}>
            <Input placeholder="npr. EDZ" disabled={!!editingDist} />
          </Form.Item>
        </Form>
      </Drawer>
      <Drawer
        title={editingBranch ? 'Uredi podružnicu' : 'Nova podružnica'}
        open={branchDrawerOpen}
        width={520}
        onClose={() => {
          setBranchDrawerOpen(false)
          setEditingBranch(null)
          branchForm.resetFields()
        }}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setBranchDrawerOpen(false)
                setEditingBranch(null)
                branchForm.resetFields()
              }}
            >
              Odustani
            </Button>
            <Button
              type="primary"
              loading={createBranchMutation.isPending || updateBranchMutation.isPending}
              onClick={handleBranchSubmit}
            >
              {editingBranch ? 'Snimi' : 'Kreiraj'}
            </Button>
          </div>
        }
      >
        <Form form={branchForm} layout="vertical">
          <Form.Item
            name="distributionId"
            label="Distribucija"
            rules={[{ required: true }]}
          >
            <Select
              placeholder="Odaberi distribuciju"
              options={distributions.map((d) => ({ label: `${d.name} (${d.code})`, value: d.id }))}
              disabled={!!editingBranch}
            />
          </Form.Item>
          <Form.Item name="name" label="Naziv" rules={[{ required: true }]}>
            <Input placeholder="npr. Zenica" />
          </Form.Item>
          <Form.Item name="code" label="Kod" rules={[{ required: true }]}>
            <Input placeholder="npr. ZEN" disabled={!!editingBranch} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}

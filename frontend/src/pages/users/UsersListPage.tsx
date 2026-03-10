import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
  Tour,
} from 'antd';
import type { TourProps } from 'antd';
import { PlusOutlined, EditOutlined, UserOutlined, ApartmentOutlined, BankOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { usersApi, type CreateUserInput, type UpdateUserInput } from '@/api/users.api';
import { distributionsApi, type Distribution } from '@/api/distributions.api';
import { branchesApi, type Branch } from '@/api/branches.api';
import { useAuthStore } from '@/store/auth.store';
import type { UserListItem } from '@/types/user.types';
import type { UserRole } from '@/types/auth.types';

const ROLE_OPTIONS: { label: string; value: UserRole }[] = [
  { label: 'Sistemski administrator', value: 'SYSTEM_ADMIN' },
  { label: 'Moderator', value: 'MODERATOR' },
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
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [form] = Form.useForm<CreateUserInput & { confirmPassword?: string }>();
  const [distModalOpen, setDistModalOpen] = useState(false);
  const [editingDist, setEditingDist] = useState<Distribution | null>(null);
  const [distForm] = Form.useForm<{ name: string; code: string }>();
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchForm] = Form.useForm<{ distributionId: string; name: string; code: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const currentUserRole = currentUser?.role;

  const usersQuery = useQuery({
    queryKey: ['users', 'list'],
    queryFn: () => usersApi.list(),
  });

  const distributionsQuery = useQuery({
    queryKey: ['distributions', 'list'],
    queryFn: () => distributionsApi.list(),
    enabled: currentUserRole === 'SYSTEM_ADMIN' || currentUserRole === 'MODERATOR',
  });

  const branchesQuery = useQuery({
    queryKey: ['branches', 'list'],
    queryFn: () => branchesApi.list(),
    enabled: currentUserRole === 'SYSTEM_ADMIN' || currentUserRole === 'MODERATOR',
  });

  const createDistMutation = useMutation({
    mutationFn: (data: { name: string; code: string }) => distributionsApi.create(data),
    onSuccess: () => {
      messageApi.success('Distribucija kreirana');
      queryClient.invalidateQueries({ queryKey: ['distributions'] });
      setDistModalOpen(false);
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
      setDistModalOpen(false);
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
      setBranchModalOpen(false);
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
      setBranchModalOpen(false);
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
      setModalOpen(false);
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
    onSuccess: () => {
      messageApi.success('Korisnik ažuriran');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setModalOpen(false);
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
    setModalOpen(true);
  };

  const handleOpenDistCreate = () => {
    setEditingDist(null);
    distForm.resetFields();
    setDistModalOpen(true);
  };

  const handleOpenDistEdit = (row: Distribution) => {
    setEditingDist(row);
    distForm.setFieldsValue({ name: row.name, code: row.code });
    setDistModalOpen(true);
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
    setBranchModalOpen(true);
  };

  const handleOpenBranchEdit = (row: Branch) => {
    setEditingBranch(row);
    branchForm.setFieldsValue({
      distributionId: row.distributionId,
      name: row.name,
      code: row.code,
    });
    setBranchModalOpen(true);
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
    setModalOpen(true);
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
        distributionId: rest.role === 'MODERATOR' ? rest.distributionId : undefined,
        branchId: rest.role === 'USER' ? rest.branchId : undefined,
      };
      if (editing) {
        const updateData: UpdateUserInput = { ...payload };
        if (!updateData.password) delete updateData.password;
        updateMutation.mutate({ id: editing.id, data: updateData });
      } else {
        createMutation.mutate(payload as CreateUserInput);
      }
    });
  };

  const role = Form.useWatch('role', form);
  const showDistribution = role === 'MODERATOR';
  const showBranch = role === 'USER';

  useEffect(() => {
    if (!showDistribution) form.setFieldValue('distributionId', undefined);
    if (!showBranch) form.setFieldValue('branchId', undefined);
  }, [showDistribution, showBranch, form]);

  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = window.localStorage.getItem('sim-tracker-page-tour-users-v1');
    const globalActive = window.localStorage.getItem('sim-tracker-global-tour-active') === '1';
    if (!seen && currentUserRole === 'SYSTEM_ADMIN' && !globalActive) {
      setTourOpen(true);
    }
  }, [currentUserRole]);

  const rows = usersQuery.data?.items ?? [];
  const canManage = currentUserRole === 'SYSTEM_ADMIN';
  const canEdit = currentUserRole === 'SYSTEM_ADMIN' || currentUserRole === 'MODERATOR';
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
            render: (r) => <Tag>{r}</Tag>,
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
              <Tag color={s === 'ACTIVE' ? 'green' : 'orange'}>{s}</Tag>
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
      data-tour-role="SYSTEM_ADMIN MODERATOR"
    >
      {messageContextHolder}
      <div className="flex justify-between items-center">
        <Typography.Title level={3} className="!mb-0">
          Korisnici
        </Typography.Title>
      </div>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      <Modal
        title={editing ? 'Uredi korisnika' : 'Novi korisnik'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={480}
      >
        <Form form={form} layout="vertical">
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
          {showDistribution && (
            <Form.Item name="distributionId" label="Distribucija">
              <Select
                placeholder="Odaberi distribuciju (za moderatora)"
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
        </Form>
      </Modal>
      <Modal
        title={editingDist ? 'Uredi distribuciju' : 'Nova distribucija'}
        open={distModalOpen}
        onOk={handleDistSubmit}
        onCancel={() => {
          setDistModalOpen(false);
          setEditingDist(null);
        }}
        confirmLoading={createDistMutation.isPending || updateDistMutation.isPending}
      >
        <Form form={distForm} layout="vertical">
          <Form.Item name="name" label="Naziv" rules={[{ required: true }]}>
            <Input placeholder="npr. ED Zenica" />
          </Form.Item>
          <Form.Item name="code" label="Kod" rules={[{ required: true }]}>
            <Input placeholder="npr. EDZ" disabled={!!editingDist} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={editingBranch ? 'Uredi podružnicu' : 'Nova podružnica'}
        open={branchModalOpen}
        onOk={handleBranchSubmit}
        onCancel={() => {
          setBranchModalOpen(false);
          setEditingBranch(null);
        }}
        confirmLoading={createBranchMutation.isPending || updateBranchMutation.isPending}
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
      </Modal>
      <Tour
        open={tourOpen}
        current={tourStep}
        onClose={() => {
          setTourOpen(false);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('sim-tracker-page-tour-users-v1', '1');
          }
        }}
        onChange={(next) => setTourStep(next)}
        steps={
          [
            {
              title: 'Lista korisnika',
              description:
                'Ovdje upravljaš svim korisnicima sistema, njihovim ulogama i statusima.',
              target: () =>
                document.querySelector('[data-tour-id="users-header"]') as HTMLElement,
            },
            {
              title: 'Tabela korisnika',
              description:
                'Tabela prikazuje osnovne podatke; kroz akcije možeš uređivati, deaktivirati ili brisati korisnike.',
              target: () =>
                document.querySelector('[data-tour-id="users-table"]') as HTMLElement,
            },
            {
              title: 'Distribucije',
              description:
                'Tab „Distribucije“ služi za održavanje distribucijskih jedinica (npr. ED Zenica).',
              target: () =>
                document.querySelector('[data-tour-id="users-distributions-header"]') as HTMLElement,
            },
            {
              title: 'Tabela distribucija',
              description:
                'Za svaku distribuciju vidiš naziv i kod; akcije služe za uređivanje i brisanje.',
              target: () =>
                document.querySelector('[data-tour-id="users-distributions-table"]') as HTMLElement,
            },
            {
              title: 'Podružnice',
              description:
                'Tab „Podružnice“ definira organizacione jedinice unutar distribucija (npr. Zenica, Travnik).',
              target: () =>
                document.querySelector('[data-tour-id="users-branches-header"]') as HTMLElement,
            },
            {
              title: 'Tabela podružnica',
              description:
                'Ovdje održavaš šifre i nazive podružnica; kasnije se koriste pri dodjeli korisnika i mapiranju approval grupa.',
              target: () =>
                document.querySelector('[data-tour-id="users-branches-table"]') as HTMLElement,
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

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
import { useTranslation } from '@/i18n';
import { getUserRoleLabel, getUserStatusLabel } from '@/utils/labels.utils'

function getRoleOptions(t: (key: string) => string): { label: string; value: UserRole }[] {
  return [
    { label: t('labels.userRole.systemAdmin'), value: 'SYSTEM_ADMIN' },
    { label: t('labels.userRole.distAdmin'), value: 'DIST_ADMIN' },
    { label: t('labels.userRole.operator'), value: 'USER' },
  ]
}

function getStatusOptions(t: (key: string) => string) {
  return [
    { label: t('labels.userStatus.active'), value: 'ACTIVE' },
    { label: t('labels.userStatus.inactive'), value: 'INACTIVE' },
    { label: t('labels.userStatus.suspended'), value: 'SUSPENDED' },
  ]
}

export default function UsersListPage() {
  const { t } = useTranslation();
  const ROLE_OPTIONS = getRoleOptions(t)
  const STATUS_OPTIONS = getStatusOptions(t)
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
      messageApi.success(t('users.distributions.created'));
      queryClient.invalidateQueries({ queryKey: ['distributions'] });
      setDistDrawerOpen(false);
      distForm.resetFields();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      messageApi.error(err.response?.data?.message ?? t('common.states.error'));
    },
  });

  const updateDistMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; code: string }> }) =>
      distributionsApi.update(id, data),
    onSuccess: () => {
      messageApi.success(t('users.distributions.updated'));
      queryClient.invalidateQueries({ queryKey: ['distributions'] });
      setDistDrawerOpen(false);
      setEditingDist(null);
      distForm.resetFields();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      messageApi.error(err.response?.data?.message ?? t('common.states.error'));
    },
  });

  const deleteDistMutation = useMutation({
    mutationFn: (id: string) => distributionsApi.delete(id),
    onSuccess: () => {
      messageApi.success(t('users.distributions.deleted'));
      queryClient.invalidateQueries({ queryKey: ['distributions'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      messageApi.error(err.response?.data?.message ?? t('common.states.error'));
    },
  });

  const createBranchMutation = useMutation({
    mutationFn: (data: { distributionId: string; name: string; code: string }) =>
      branchesApi.create(data),
    onSuccess: () => {
      messageApi.success(t('users.branches.created'));
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setBranchDrawerOpen(false);
      branchForm.resetFields();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      messageApi.error(err.response?.data?.message ?? t('common.states.error'));
    },
  });

  const updateBranchMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; code: string }> }) =>
      branchesApi.update(id, data),
    onSuccess: () => {
      messageApi.success(t('users.branches.updated'));
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setBranchDrawerOpen(false);
      setEditingBranch(null);
      branchForm.resetFields();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      messageApi.error(err.response?.data?.message ?? t('common.states.error'));
    },
  });

  const deleteBranchMutation = useMutation({
    mutationFn: (id: string) => branchesApi.delete(id),
    onSuccess: () => {
      messageApi.success(t('users.branches.deleted'));
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      messageApi.error(err.response?.data?.message ?? t('common.states.error'));
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateUserInput) => usersApi.create(data),
    onSuccess: () => {
      messageApi.success(t('users.userCreated'));
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setUserDrawerOpen(false);
      setEditing(null);
      form.resetFields();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      messageApi.error(err.response?.data?.message ?? t('common.states.error'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) =>
      usersApi.update(id, data),
    onSuccess: async () => {
      messageApi.success(t('users.userUpdated'));
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
              t('users.moderatorSyncFailed'),
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
      messageApi.error(err.response?.data?.message ?? t('common.states.error'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      messageApi.success(t('users.userDeleted'));
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      messageApi.error(err.response?.data?.message ?? t('common.states.error'));
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
        messageApi.error(t('validation.passwordsMustMatch'));
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
          <UserOutlined /> {t('layout.sidebar.users')}
        </span>
      ),
      children: (
        <div className="space-y-4">
          <div
            className="flex justify-between items-center"
            data-tour-id="users-header"
          >
            <Typography.Text type="secondary">
              {t('users.manageIntro')}
            </Typography.Text>
            {canManage && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                {t('users.newUser')}
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
            title: t('users.columns.fullName'),
            render: (_, row) => `${row.firstName} ${row.lastName}`,
          },
          { title: t('common.labels.email'), dataIndex: 'email' },
          {
            title: t('common.labels.username'),
            dataIndex: 'username',
            render: (v: string | null) => v ?? '-',
          },
          {
            title: t('common.labels.role'),
            dataIndex: 'role',
            render: (r: UserRole) => <Tag>{getUserRoleLabel(r, t)}</Tag>,
          },
          {
            title: t('users.columns.distributionOrBranch'),
            render: (_, row) =>
              row.distributionId ? (
                <Tag color="blue">{t('users.distributionTag')}</Tag>
              ) : row.branchId ? (
                <Tag color="green">{t('users.branchTag')}</Tag>
              ) : (
                '-'
              ),
          },
          {
            title: t('common.labels.status'),
            dataIndex: 'status',
            render: (s) => (
              <Tag color={s === 'ACTIVE' ? 'green' : s === 'SUSPENDED' ? 'red' : 'orange'}>
                {getUserStatusLabel(s, t)}
              </Tag>
            ),
          },
          ...(canEdit
            ? [
                {
                  title: t('common.actions.actions'),
                  render: (_: unknown, row: UserListItem) => (
                    <div className="flex gap-2">
                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleOpenEdit(row)}
                      >
                        {t('common.actions.edit')}
                      </Button>
                      {canManage && (
                        <Popconfirm
                          title={t('users.confirmDeleteUser')}
                          onConfirm={() => deleteMutation.mutate(row.id)}
                        >
                          <Button size="small" danger>
                            {t('common.actions.delete')}
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
                <ApartmentOutlined /> {t('users.tabs.distributions')}
              </span>
            ),
            children: (
              <div className="space-y-4">
                <div
                  className="flex justify-between items-center"
                  data-tour-id="users-distributions-header"
                >
                  <Typography.Text type="secondary">
                    {t('users.distributions.intro')}
                  </Typography.Text>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenDistCreate}>
                    {t('users.distributions.newDistribution')}
                  </Button>
                </div>
                <Table<Distribution>
                  rowKey="id"
                  loading={distributionsQuery.isLoading}
                  dataSource={distributions}
                  pagination={false}
                  columns={[
                    { title: t('common.labels.name'), dataIndex: 'name' },
                    { title: t('users.codeColumn'), dataIndex: 'code' },
                    {
                      title: t('common.actions.actions'),
                      render: (_: unknown, row: Distribution) => (
                        <div className="flex gap-2">
                          <Button size="small" onClick={() => handleOpenDistEdit(row)}>
                            {t('common.actions.edit')}
                          </Button>
                          <Popconfirm
                            title={t('users.distributions.confirmDelete')}
                            onConfirm={() => deleteDistMutation.mutate(row.id)}
                          >
                            <Button size="small" danger>
                              {t('common.actions.delete')}
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
                <BankOutlined /> {t('users.tabs.branches')}
              </span>
            ),
            children: (
              <div className="space-y-4">
                <div
                  className="flex justify-between items-center"
                  data-tour-id="users-branches-header"
                >
                  <Typography.Text type="secondary">
                    {t('users.branches.intro')}
                  </Typography.Text>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenBranchCreate}>
                    {t('users.branches.newBranch')}
                  </Button>
                </div>
                <Table<Branch>
                  rowKey="id"
                  loading={branchesQuery.isLoading}
                  dataSource={branches}
                  pagination={false}
                  columns={[
                    {
                      title: t('common.labels.branch'),
                      render: (_: unknown, row: Branch) => row.distribution?.name ?? row.distributionId,
                    },
                    { title: t('common.labels.name'), dataIndex: 'name' },
                    { title: t('users.codeColumn'), dataIndex: 'code' },
                    {
                      title: t('common.actions.actions'),
                      render: (_: unknown, row: Branch) => (
                        <div className="flex gap-2">
                          <Button size="small" onClick={() => handleOpenBranchEdit(row)}>
                            {t('common.actions.edit')}
                          </Button>
                          <Popconfirm
                            title={t('users.branches.confirmDelete')}
                            onConfirm={() => deleteBranchMutation.mutate(row.id)}
                          >
                            <Button size="small" danger>
                              {t('common.actions.delete')}
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
          {t('layout.sidebar.users')}
        </Typography.Title>
      </div>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      <Drawer
        title={editing ? t('users.editUser') : t('users.newUser')}
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
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="primary"
              loading={createMutation.isPending || updateMutation.isPending}
              onClick={handleSubmit}
            >
              {editing ? t('common.actions.save') : t('common.actions.create')}
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
            label={t('common.labels.email')}
            rules={[{ required: true }, { type: 'email' }]}
          >
            <Input placeholder="email@example.com" disabled={!!editing} />
          </Form.Item>
          {!editing && (
            <>
              <Form.Item
                name="password"
                label={t('users.form.passwordLabel')}
                rules={[{ required: true }, { min: 8 }]}
              >
                <Input.Password placeholder={t('users.form.minChars', { min: 8 })} />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label={t('users.form.confirmPasswordLabel')}
                rules={[
                  { required: true },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error(t('validation.passwordsMustMatch')));
                    },
                  }),
                ]}
              >
                <Input.Password placeholder={t('users.form.repeatPasswordPlaceholder')} />
              </Form.Item>
            </>
          )}
          {editing && (
            <Form.Item name="password" label={t('users.form.newPasswordLabel')}>
              <Input.Password placeholder={t('common.labels.optional')} />
            </Form.Item>
          )}
          <Form.Item name="firstName" label={t('users.form.firstNameLabel')} rules={[{ required: true }]}>
            <Input placeholder={t('users.form.firstNameLabel')} />
          </Form.Item>
          <Form.Item name="lastName" label={t('users.form.lastNameLabel')} rules={[{ required: true }]}>
            <Input placeholder={t('users.form.lastNameLabel')} />
          </Form.Item>
          <Form.Item name="phone" label={t('common.labels.phone')}>
            <Input placeholder="+38761111222" />
          </Form.Item>
          <Form.Item name="role" label={t('common.labels.role')} rules={[{ required: true }]}>
            <Select
              placeholder={t('users.form.selectRolePlaceholder')}
              options={ROLE_OPTIONS}
              disabled={editing?.id === currentUser?.id}
            />
          </Form.Item>
          <Form.Item name="status" label={t('common.labels.status')}>
            <Select placeholder={t('users.form.selectStatusPlaceholder')} options={STATUS_OPTIONS} />
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
                    <Form.Item name="distributionId" label={t('shipments.wizard.distributionLabel')}>
                      <Select
                        placeholder={t('users.form.selectDistributionForAdmin')}
                        allowClear
                        options={distributions.map((d) => ({
                          label: `${d.name} (${d.code})`,
                          value: d.id,
                        }))}
                      />
                    </Form.Item>
                  )}
                  {showBranch && (
                    <Form.Item name="branchId" label={t('common.labels.branch')}>
                      <Select
                        placeholder={t('users.form.selectBranchForOperator')}
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
              <Form.Item label={t('users.form.branchModeratorLabel')}>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder={t('users.form.selectOneOrMoreBranches')}
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
                {t('users.form.moderatorHint')}
              </Typography.Text>
            </>
          )}
        </Form>
      </Drawer>
      <Drawer
        title={editingDist ? t('users.distributions.editTitle') : t('users.distributions.newDistribution')}
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
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="primary"
              loading={createDistMutation.isPending || updateDistMutation.isPending}
              onClick={handleDistSubmit}
            >
              {editingDist ? t('common.actions.save') : t('common.actions.create')}
            </Button>
          </div>
        }
      >
        <Form form={distForm} layout="vertical">
          <Form.Item name="name" label={t('common.labels.name')} rules={[{ required: true }]}>
            <Input placeholder="npr. ED Zenica" />
          </Form.Item>
          <Form.Item name="code" label={t('users.codeColumn')} rules={[{ required: true }]}>
            <Input placeholder="npr. EDZ" disabled={!!editingDist} />
          </Form.Item>
        </Form>
      </Drawer>
      <Drawer
        title={editingBranch ? t('users.branches.editTitle') : t('users.branches.newBranch')}
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
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="primary"
              loading={createBranchMutation.isPending || updateBranchMutation.isPending}
              onClick={handleBranchSubmit}
            >
              {editingBranch ? t('common.actions.save') : t('common.actions.create')}
            </Button>
          </div>
        }
      >
        <Form form={branchForm} layout="vertical">
          <Form.Item
            name="distributionId"
            label={t('shipments.wizard.distributionLabel')}
            rules={[{ required: true }]}
          >
            <Select
              placeholder={t('shipments.wizard.selectDistributionPlaceholder')}
              options={distributions.map((d) => ({ label: `${d.name} (${d.code})`, value: d.id }))}
              disabled={!!editingBranch}
            />
          </Form.Item>
          <Form.Item name="name" label={t('common.labels.name')} rules={[{ required: true }]}>
            <Input placeholder="npr. Zenica" />
          </Form.Item>
          <Form.Item name="code" label={t('users.codeColumn')} rules={[{ required: true }]}>
            <Input placeholder="npr. ZEN" disabled={!!editingBranch} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}

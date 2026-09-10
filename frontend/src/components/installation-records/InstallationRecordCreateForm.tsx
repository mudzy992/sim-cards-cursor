import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Divider, Form, Input, InputNumber, Radio, Select, Switch, message } from 'antd';
import { installationRecordsApi } from '@/api/installation-records.api';
import { metersApi } from '@/api/meters.api';
import { meterTypeDefinitionsApi } from '@/api/meter-type-definitions.api';
import { simCardsApi } from '@/api/sim-cards.api';
import { branchesApi } from '@/api/branches.api';
import { useAuthStore } from '@/store/auth.store';
import type {
  InstallationRecordItem,
  InstallationRecordKind,
} from '@/types/installation-record.types';
import type { MeterTypeFieldItem } from '@/types/meter-type-field.types'
import { useTranslation } from '@/i18n'

type CreateMode = 'existing' | 'new';

type InstallationRecordCreateFormProps = {
  /** Kada je true, forma se renderuje u modalu (bez Card wrappera) */
  embedded?: boolean;
  /** Poziva se nakon uspješnog kreiranja – za modal: zatvori i osvježi */
  onSuccess?: (record: InstallationRecordItem) => void;
  /** Opcionalno – za prikaz dugmeta Odustani u embedded modu */
  onCancel?: () => void;
};

export default function InstallationRecordCreateForm({
  embedded = false,
  onSuccess,
  onCancel,
}: InstallationRecordCreateFormProps) {
  const { t } = useTranslation();
  const userId = useAuthStore((state) => state.user?.id);
  const userRole = useAuthStore((state) => state.user?.role);
  const userBranch = useAuthStore((state) => state.user?.branch);
  const userDistributionId = useAuthStore((state) => state.user?.distributionId);
  const [messageApi, messageContextHolder] = message.useMessage();
  const [form] = Form.useForm();
  const [createMode, setCreateMode] = useState<CreateMode>('new');

  const simCardsQuery = useQuery({
    queryKey: ['sim-cards', 'for-record'],
    queryFn: () =>
      userRole === 'USER'
        ? simCardsApi.myAssigned({ limit: 100 })
        : simCardsApi.list({ status: 'ASSIGNED', limit: 100 }),
    enabled: Boolean(userId),
  });

  const metersQuery = useQuery({
    queryKey: ['meters', 'available'],
    queryFn: () => metersApi.getAvailable(),
    enabled: Boolean(userId) && createMode === 'existing',
  });

  const meterTypesQuery = useQuery({
    queryKey: ['meter-type-definitions', 'list-all'],
    queryFn: () => meterTypeDefinitionsApi.listAll(),
    enabled: Boolean(userId) && createMode === 'new',
  });

  const selectedMeterTypeDefinitionId = Form.useWatch('meterTypeDefinitionId', form) as
    | string
    | undefined;

  const installRecordKind = (Form.useWatch('installRecordKind', form) ??
    'NEW_CONNECTION') as InstallationRecordKind;

  const demountedMeterTypeDefinitionId = Form.useWatch(
    ['demountedMeter', 'meterTypeDefinitionId'],
    form,
  ) as string | undefined;

  const meterTypeFieldsQuery = useQuery({
    queryKey: ['meter-type-definitions', 'fields', selectedMeterTypeDefinitionId],
    queryFn: () => meterTypeDefinitionsApi.listFields(selectedMeterTypeDefinitionId!),
    enabled: Boolean(userId) && createMode === 'new' && Boolean(selectedMeterTypeDefinitionId),
  });

  const demountedMeterTypeFieldsQuery = useQuery({
    queryKey: ['meter-type-definitions', 'fields-demounted', demountedMeterTypeDefinitionId],
    queryFn: () => meterTypeDefinitionsApi.listFields(demountedMeterTypeDefinitionId!),
    enabled:
      Boolean(userId) &&
      createMode === 'new' &&
      installRecordKind === 'METER_REPLACEMENT' &&
      Boolean(demountedMeterTypeDefinitionId),
  });

  const branchesQuery = useQuery({
    queryKey: ['branches', 'list', userDistributionId],
    queryFn: () => branchesApi.list(userDistributionId ?? undefined),
    enabled:
      Boolean(userId) &&
      createMode === 'new' &&
      (userRole === 'SYSTEM_ADMIN' || userRole === 'DIST_ADMIN'),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof installationRecordsApi.create>[0]) =>
      installationRecordsApi.create(payload),
    onSuccess: (data) => {
      messageApi.success(t('installationRecords.form.created'));
      onSuccess?.(data);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('installationRecords.form.createFailed');
      messageApi.error(msg);
    },
  });

  const simOptions =
    simCardsQuery.data?.items?.map((s) => ({
      label: `${s.iccid} (${s.status})${s.assignedTo ? ` – ${s.assignedTo.firstName} ${s.assignedTo.lastName}` : ''}`,
      value: s.id,
    })) ?? [];
  const meterOptions =
    metersQuery.data?.map((m) => ({
      label: `${m.serialNumber} – ${m.meterTypeDefinition?.name ?? '?'}`,
      value: m.id,
    })) ?? [];
  const meterTypeOptions =
    meterTypesQuery.data?.map((mtd) => ({
      label: mtd.name,
      value: mtd.id,
    })) ?? [];

  const branchOptions =
    (branchesQuery.data ?? []).map((b) => ({
      label: `${b.name} (${b.code})`,
      value: b.id,
    })) ?? [];

  const isOperator = userRole === 'USER';
  const municipalityValue = isOperator ? userBranch?.name ?? '' : undefined;

  useEffect(() => {
    if (isOperator && userBranch && createMode === 'new') {
      form.setFieldsValue({ municipality: userBranch.name, branchId: userBranch.id });
    }
  }, [isOperator, userBranch?.name, userBranch?.id, createMode, form]);

  const handleFinish = (values: Record<string, unknown>) => {
    if (!userId) return;
    if (createMode === 'existing') {
      createMutation.mutate({
        simCardId: values.simCardId as string,
        meterId: values.meterId as string,
        installedById: userId,
        notes: values.notes as string | undefined,
      });
    } else {
      const branchId = (values.branchId as string) || userBranch?.id;
      const selectedBranch = (branchesQuery.data ?? []).find((b) => b.id === branchId);
      const municipality =
        (values.municipality as string) || selectedBranch?.name || userBranch?.name;

      const kind = (values.installRecordKind as InstallationRecordKind) ?? 'NEW_CONNECTION';
      const dm = values.demountedMeter as
        | {
            meterTypeDefinitionId?: string;
            serialNumber?: string;
            year?: number;
            calibrationYear?: number;
            dynamicFieldValues?: Record<string, unknown>;
            notes?: string;
            hadIntegratedSim?: boolean;
            noSimNote?: string;
          }
        | undefined;
      const demountedMeter =
        kind === 'METER_REPLACEMENT' && dm?.meterTypeDefinitionId
          ? {
              meterTypeDefinitionId: dm.meterTypeDefinitionId,
              serialNumber: (dm.serialNumber ?? '').trim(),
              year: Number(dm.year),
              calibrationYear: Number(dm.calibrationYear),
              ...(dm.dynamicFieldValues && Object.keys(dm.dynamicFieldValues).length > 0
                ? { dynamicFieldValues: dm.dynamicFieldValues }
                : {}),
              ...(dm.notes?.trim() ? { notes: dm.notes.trim() } : {}),
              ...(dm.hadIntegratedSim !== undefined ? { hadIntegratedSim: dm.hadIntegratedSim } : {}),
              ...(dm.noSimNote?.trim() ? { noSimNote: dm.noSimNote.trim() } : {}),
            }
          : undefined;
      createMutation.mutate({
        simCardId: values.simCardId as string,
        installedById: userId,
        ...(kind === 'METER_REPLACEMENT' ? { kind, demountedMeter } : {}),
        meterTypeDefinitionId: values.meterTypeDefinitionId as string,
        serialNumber: (values.serialNumber as string)?.trim() ?? '',
        year: Number(values.year),
        calibrationYear: Number(values.calibrationYear),
        installationAddress: values.installationAddress as string | undefined,
        installationDate: values.installationDate as string | undefined,
        city: values.city as string | undefined,
        municipality,
        branchId,
        measuringPoint: values.measuringPoint as string | undefined,
        latitude: values.latitude != null ? Number(values.latitude) : undefined,
        longitude: values.longitude != null ? Number(values.longitude) : undefined,
        dynamicFieldValues: (values.dynamicFieldValues as Record<string, unknown> | undefined) ?? undefined,
        notes: values.notes as string | undefined,
      });
    }
  };

  const isFieldEditable = (field: MeterTypeFieldItem) => {
    if (!isOperator) return true
    return field.isOperatorFillable
  }

  const renderFieldInput = (field: MeterTypeFieldItem) => {
    const disabled = !isFieldEditable(field)
    if (field.fieldType === 'NUMBER') {
      return <InputNumber disabled={disabled} style={{ width: '100%' }} />
    }
    if (field.fieldType === 'BOOLEAN') {
      return <Switch disabled={disabled} />
    }
    if (field.fieldType === 'DATE') {
      return <Input type="date" disabled={disabled} />
    }
    return <Input disabled={disabled} />
  }

  const formContent = (
    <>
      {messageContextHolder}
      {!embedded && (
        <p className="text-slate-500 mb-4">
          {t('installationRecords.form.intro')}
        </p>
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{
          installationDate: new Date().toISOString().slice(0, 10),
          installRecordKind: 'NEW_CONNECTION',
        }}
      >
        <Form.Item label={t('installationRecords.form.creationModeLabel')}>
          <Radio.Group
            value={createMode}
            onChange={(e) => {
              setCreateMode(e.target.value);
              form.resetFields([
                'meterId',
                'meterTypeDefinitionId',
                'serialNumber',
                'installRecordKind',
                'demountedMeter',
              ]);
            }}
          >
            <Radio value="new">{t('installationRecords.form.modeNew')}</Radio>
            <Radio value="existing">{t('installationRecords.form.modeExisting')}</Radio>
          </Radio.Group>
        </Form.Item>

        {createMode === 'existing' ? (
          <Form.Item
            name="meterId"
            label={t('layout.sidebar.meters')}
            rules={[{ required: true, message: t('installationRecords.form.selectMeterRequired') }]}
          >
            <Select
              placeholder={t('installationRecords.form.selectMeterPlaceholder')}
              options={meterOptions}
              loading={metersQuery.isLoading}
              showSearch
              filterOption={(input, opt) =>
                (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
        ) : (
          <>
            <Form.Item name="installRecordKind" label={t('installationRecords.form.recordKindLabel')}>
              <Radio.Group>
                <Radio value="NEW_CONNECTION">{t('installationRecords.form.kindNewConnection')}</Radio>
                <Radio value="METER_REPLACEMENT">{t('installationRecords.form.kindMeterReplacement')}</Radio>
              </Radio.Group>
            </Form.Item>

            {installRecordKind === 'METER_REPLACEMENT' && (
              <>
                <Divider orientation="left">{t('installationRecords.form.demountedMeterDivider')}</Divider>
                <Form.Item
                  name={['demountedMeter', 'meterTypeDefinitionId']}
                  label={t('installationRecords.form.demountedTypeLabel')}
                  rules={[{ required: true, message: t('installationRecords.form.demountedTypeRequired') }]}
                >
                  <Select
                    placeholder={t('installationRecords.form.selectTypePlaceholder')}
                    options={meterTypeOptions}
                    loading={meterTypesQuery.isLoading}
                    showSearch
                    filterOption={(input, opt) =>
                      (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Form.Item>
                <Form.Item
                  name={['demountedMeter', 'serialNumber']}
                  label={t('installationRecords.form.demountedSerialLabel')}
                  rules={[{ required: true, message: t('installationRecords.form.demountedSerialRequired') }]}
                >
                  <Input placeholder={t('installationRecords.form.serialNumberPlaceholder')} />
                </Form.Item>
                {demountedMeterTypeDefinitionId && (
                  <div className="rounded-md border border-slate-200 p-3 mb-3">
                    <div className="font-medium mb-2">{t('installationRecords.form.extraFieldsDemounted')}</div>
                    {(demountedMeterTypeFieldsQuery.data ?? [])
                      .slice()
                      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                      .map((field) => (
                        <Form.Item
                          key={field.id}
                          name={['demountedMeter', 'dynamicFieldValues', field.name]}
                          label={field.label}
                          rules={
                            field.isRequired && isFieldEditable(field)
                              ? [{ required: true, message: t('installationRecords.form.fieldRequired', { label: field.label }) }]
                              : []
                          }
                          initialValue={field.defaultValue ?? undefined}
                          valuePropName={field.fieldType === 'BOOLEAN' ? 'checked' : 'value'}
                        >
                          {renderFieldInput(field)}
                        </Form.Item>
                      ))}
                    {demountedMeterTypeFieldsQuery.isLoading && (
                      <div className="text-sm text-slate-500">{t('installationRecords.form.loadingFields')}</div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <Form.Item
                    name={['demountedMeter', 'year']}
                    label={t('installationRecords.form.demountedYearLabel')}
                    rules={[{ required: true, message: t('installationRecords.form.requiredShort') }]}
                  >
                    <InputNumber min={1970} max={2100} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item
                    name={['demountedMeter', 'calibrationYear']}
                    label={t('installationRecords.form.demountedCalibrationYearLabel')}
                    rules={[{ required: true, message: t('installationRecords.form.requiredShort') }]}
                  >
                    <InputNumber min={1970} max={2100} style={{ width: '100%' }} />
                  </Form.Item>
                </div>
                <Form.Item name={['demountedMeter', 'notes']} label={t('installationRecords.form.demountedNotesLabel')}>
                  <Input.TextArea rows={2} placeholder={t('common.labels.optional')} />
                </Form.Item>
                <Form.Item
                  name={['demountedMeter', 'hadIntegratedSim']}
                  label={t('installationRecords.form.hadIntegratedSimLabel')}
                  valuePropName="checked"
                  initialValue={false}
                >
                  <Switch />
                </Form.Item>
                <Form.Item name={['demountedMeter', 'noSimNote']} label={t('installationRecords.form.noSimNoteLabel')}>
                  <Input placeholder={t('common.labels.optional')} />
                </Form.Item>
                <Divider orientation="left">{t('installationRecords.form.newMeterDivider')}</Divider>
              </>
            )}

            <Form.Item
              name="meterTypeDefinitionId"
              label={t('installationRecords.form.meterTypeLabel')}
              rules={[{ required: true, message: t('installationRecords.form.meterTypeRequired') }]}
            >
              <Select
                placeholder={t('meterTypeFields.selectTypePlaceholder')}
                options={meterTypeOptions}
                loading={meterTypesQuery.isLoading}
                showSearch
                filterOption={(input, opt) =>
                  (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
            <Form.Item
              name="serialNumber"
              label={t('installationRecords.form.meterSerialLabel')}
              rules={[{ required: true, message: t('installationRecords.form.serialNumberRequired') }]}
            >
              <Input placeholder={t('installationRecords.form.meterSerialPlaceholder')} />
            </Form.Item>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name="year"
                label={t('installationRecords.form.yearLabel')}
                rules={[{ required: true, message: t('installationRecords.form.requiredShort') }]}
              >
                <InputNumber min={1970} max={2100} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                name="calibrationYear"
                label={t('installationRecords.form.calibrationYearLabel')}
                rules={[{ required: true, message: t('installationRecords.form.requiredShort') }]}
              >
                <InputNumber min={1970} max={2100} style={{ width: '100%' }} />
              </Form.Item>
            </div>
            <Form.Item name="installationAddress" label={t('installationRecords.form.addressLabel')}>
              <Input placeholder={t('installationRecords.form.addressPlaceholder')} />
            </Form.Item>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="city" label={t('installationRecords.form.cityLabel')}>
                <Input placeholder={t('installationRecords.form.cityLabel')} />
              </Form.Item>
              <Form.Item
                name={isOperator ? 'municipality' : 'branchId'}
                label={t('installationRecords.form.municipalityLabel')}
                initialValue={isOperator ? municipalityValue : undefined}
              >
                {isOperator ? (
                  <Input placeholder={t('installationRecords.form.municipalityLabel')} disabled />
                ) : (
                  <Select
                    placeholder={t('installationRecords.form.selectMunicipalityPlaceholder')}
                    options={branchOptions}
                    loading={branchesQuery.isLoading}
                    allowClear
                    showSearch
                    filterOption={(input, opt) =>
                      (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                    }
                  />
                )}
              </Form.Item>
            </div>

            {selectedMeterTypeDefinitionId && (
              <div className="rounded-md border border-slate-200 p-3">
                <div className="font-medium mb-2">{t('installationRecords.form.extraFields')}</div>
                {(meterTypeFieldsQuery.data ?? [])
                  .slice()
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                  .map((field) => (
                    <Form.Item
                      key={field.id}
                      name={['dynamicFieldValues', field.name]}
                      label={field.label}
                      rules={
                        field.isRequired && isFieldEditable(field)
                          ? [{ required: true, message: t('installationRecords.form.fieldRequired', { label: field.label }) }]
                          : []
                      }
                      initialValue={field.defaultValue ?? undefined}
                      valuePropName={field.fieldType === 'BOOLEAN' ? 'checked' : 'value'}
                    >
                      {renderFieldInput(field)}
                    </Form.Item>
                  ))}
                {meterTypeFieldsQuery.isLoading && (
                  <div className="text-sm text-slate-500">{t('installationRecords.form.loadingFields')}</div>
                )}
              </div>
            )}
            <Form.Item name="measuringPoint" label={t('installationRecords.form.measuringPointLabel')}>
              <Input placeholder={t('common.labels.optional')} />
            </Form.Item>
            <Form.Item name="installationDate" label={t('installationRecords.list.columns.installationDate')}>
              <Input type="date" />
            </Form.Item>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="latitude" label={t('installationRecords.form.gpsLatLabel')}>
                <Input type="number" step="any" placeholder="npr. 43.85" />
              </Form.Item>
              <Form.Item name="longitude" label={t('installationRecords.form.gpsLngLabel')}>
                <Input type="number" step="any" placeholder="npr. 18.41" />
              </Form.Item>
            </div>
          </>
        )}

        <Form.Item
          name="simCardId"
          label={t('layout.sidebar.simCards')}
          rules={[{ required: true, message: t('installationRecords.form.simCardRequired') }]}
        >
          <Select
            placeholder={t('installationRecords.form.simCardPlaceholder')}
            options={simOptions}
            loading={simCardsQuery.isLoading}
            showSearch
            filterOption={(input, opt) =>
              (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item name="notes" label={t('common.labels.notes')}>
          <Input.TextArea rows={2} placeholder={t('common.labels.optional')} />
        </Form.Item>
        <Form.Item>
          <div className="flex gap-2">
            <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
              {t('installationRecords.form.submitButton')}
            </Button>
            {embedded && onCancel && (
              <Button onClick={onCancel}>{t('common.actions.cancel')}</Button>
            )}
          </div>
        </Form.Item>
      </Form>
    </>
  );

  if (embedded) {
    return formContent;
  }

  return (
    <div className="max-w-2xl">
      <Card title={t('installationRecords.form.cardTitle')}>{formContent}</Card>
    </div>
  );
}

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
      messageApi.success('Zapisnik je kreiran.');
      onSuccess?.(data);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Kreiranje zapisnika nije uspjelo.';
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
    meterTypesQuery.data?.map((t) => ({
      label: t.name,
      value: t.id,
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
        <p className="text-gray-500 mb-4">
          Zapisnik se kreira kada se SIM kartici pridružuje brojilo. Možete odabrati postojeće
          brojilo ili unijeti novo (kao na terenu – tip, serijski broj, lokacija).
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
        <Form.Item label="Način kreiranja">
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
            <Radio value="new">Novo brojilo na terenu (tip + serijski broj + lokacija)</Radio>
            <Radio value="existing">Postojeće brojilo</Radio>
          </Radio.Group>
        </Form.Item>

        {createMode === 'existing' ? (
          <Form.Item
            name="meterId"
            label="Brojilo"
            rules={[{ required: true, message: 'Odaberite brojilo.' }]}
          >
            <Select
              placeholder="Odaberi brojilo (serijski broj – tip)"
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
            <Form.Item name="installRecordKind" label="Vrsta zapisnika">
              <Radio.Group>
                <Radio value="NEW_CONNECTION">Novi priključak</Radio>
                <Radio value="METER_REPLACEMENT">Zamjena brojila</Radio>
              </Radio.Group>
            </Form.Item>

            {installRecordKind === 'METER_REPLACEMENT' && (
              <>
                <Divider orientation="left">Demontirano brojilo</Divider>
                <Form.Item
                  name={['demountedMeter', 'meterTypeDefinitionId']}
                  label="Tip demontiranog brojila"
                  rules={[{ required: true, message: 'Odaberite tip demontiranog brojila.' }]}
                >
                  <Select
                    placeholder="Odaberi tip"
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
                  label="Serijski broj demontiranog"
                  rules={[{ required: true, message: 'Unesite serijski broj demontiranog brojila.' }]}
                >
                  <Input placeholder="Serijski broj" />
                </Form.Item>
                {demountedMeterTypeDefinitionId && (
                  <div className="rounded-md border border-slate-200 p-3 mb-3">
                    <div className="font-medium mb-2">Dodatna polja (demontirano)</div>
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
                              ? [{ required: true, message: `Unesite: ${field.label}` }]
                              : []
                          }
                          initialValue={field.defaultValue ?? undefined}
                          valuePropName={field.fieldType === 'BOOLEAN' ? 'checked' : 'value'}
                        >
                          {renderFieldInput(field)}
                        </Form.Item>
                      ))}
                    {demountedMeterTypeFieldsQuery.isLoading && (
                      <div className="text-sm text-slate-500">Učitavanje polja…</div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <Form.Item
                    name={['demountedMeter', 'year']}
                    label="Godina proizvodnje (demontirano)"
                    rules={[{ required: true, message: 'Obavezno.' }]}
                  >
                    <InputNumber min={1970} max={2100} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item
                    name={['demountedMeter', 'calibrationYear']}
                    label="Godina baždarenja (demontirano)"
                    rules={[{ required: true, message: 'Obavezno.' }]}
                  >
                    <InputNumber min={1970} max={2100} style={{ width: '100%' }} />
                  </Form.Item>
                </div>
                <Form.Item name={['demountedMeter', 'notes']} label="Napomena (demontirano brojilo)">
                  <Input.TextArea rows={2} placeholder="Opcionalno" />
                </Form.Item>
                <Form.Item
                  name={['demountedMeter', 'hadIntegratedSim']}
                  label="Staro brojilo ima ugrađenu SIM karticu"
                  valuePropName="checked"
                  initialValue={false}
                >
                  <Switch />
                </Form.Item>
                <Form.Item name={['demountedMeter', 'noSimNote']} label="Napomena (SIM na starom brojilu)">
                  <Input placeholder="Opcionalno" />
                </Form.Item>
                <Divider orientation="left">Novo brojilo</Divider>
              </>
            )}

            <Form.Item
              name="meterTypeDefinitionId"
              label="Tip brojila"
              rules={[{ required: true, message: 'Odaberite tip brojila.' }]}
            >
              <Select
                placeholder="Odaberi tip brojila"
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
              label="Serijski broj brojila"
              rules={[{ required: true, message: 'Unesite serijski broj.' }]}
            >
              <Input placeholder="Serijski broj s brojila" />
            </Form.Item>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name="year"
                label="Godina proizvodnje"
                rules={[{ required: true, message: 'Obavezno.' }]}
              >
                <InputNumber min={1970} max={2100} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                name="calibrationYear"
                label="Godina baždarenja"
                rules={[{ required: true, message: 'Obavezno.' }]}
              >
                <InputNumber min={1970} max={2100} style={{ width: '100%' }} />
              </Form.Item>
            </div>
            <Form.Item name="installationAddress" label="Adresa instalacije">
              <Input placeholder="Ulica, broj, mjesto" />
            </Form.Item>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="city" label="Grad">
                <Input placeholder="Grad" />
              </Form.Item>
              <Form.Item
                name={isOperator ? 'municipality' : 'branchId'}
                label="Opština"
                initialValue={isOperator ? municipalityValue : undefined}
              >
                {isOperator ? (
                  <Input placeholder="Opština" disabled />
                ) : (
                  <Select
                    placeholder="Odaberi opštinu (podružnicu)"
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
                <div className="font-medium mb-2">Dodatna polja</div>
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
                          ? [{ required: true, message: `Unesite: ${field.label}` }]
                          : []
                      }
                      initialValue={field.defaultValue ?? undefined}
                      valuePropName={field.fieldType === 'BOOLEAN' ? 'checked' : 'value'}
                    >
                      {renderFieldInput(field)}
                    </Form.Item>
                  ))}
                {meterTypeFieldsQuery.isLoading && (
                  <div className="text-sm text-slate-500">Učitavanje polja…</div>
                )}
              </div>
            )}
            <Form.Item name="measuringPoint" label="Mjerno mjesto">
              <Input placeholder="Opcionalno" />
            </Form.Item>
            <Form.Item name="installationDate" label="Datum instalacije">
              <Input type="date" />
            </Form.Item>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="latitude" label="GPS širina">
                <Input type="number" step="any" placeholder="npr. 43.85" />
              </Form.Item>
              <Form.Item name="longitude" label="GPS dužina">
                <Input type="number" step="any" placeholder="npr. 18.41" />
              </Form.Item>
            </div>
          </>
        )}

        <Form.Item
          name="simCardId"
          label="SIM kartica"
          rules={[{ required: true, message: 'Odaberite SIM karticu.' }]}
        >
          <Select
            placeholder="Odaberi zaduženu SIM karticu"
            options={simOptions}
            loading={simCardsQuery.isLoading}
            showSearch
            filterOption={(input, opt) =>
              (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item name="notes" label="Napomena">
          <Input.TextArea rows={2} placeholder="Opcionalno" />
        </Form.Item>
        <Form.Item>
          <div className="flex gap-2">
            <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
              Kreiraj zapisnik
            </Button>
            {embedded && onCancel && (
              <Button onClick={onCancel}>Odustani</Button>
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
      <Card title="Novi zapisnik ugradnje">{formContent}</Card>
    </div>
  );
}

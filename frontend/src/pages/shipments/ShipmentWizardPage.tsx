import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Result,
  Select,
  Space,
  Steps,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined, CheckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { shipmentsApi } from '@/api/shipments.api';
import { distributionsApi } from '@/api/distributions.api';
import { useAuthStore } from '@/store/auth.store';
import type { CreateShipmentInput, ShipmentItem } from '@/types/shipment.types';
import { ShipmentImportPanel } from './import/ShipmentImportPanel';
import { useTranslation } from '@/i18n';

/**
 * Kreiranje isporuke kroz stepper:
 *  1) Podaci o isporuci  →  2) Import kartica (isporuka je već odabrana)  →  3) Gotovo
 * Import je opcion — isporuka se može ostaviti prazna i puniti kasnije.
 *
 * Logika distribucije naslijeđena sa ShipmentCreatePage:
 *  - DIST_ADMIN: distribucija je predpopunjena njegovom i Select je zaključan
 *  - SYSTEM_ADMIN: bira iz liste distribucija
 */
type FormValues = {
  name: string;
  provider: string;
  receivedDate: Dayjs;
  distributionId?: string;
  notes?: string;
};

export default function ShipmentWizardPage() {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const dateLocale = language === 'bs' ? 'bs-BA' : 'en-US';
  const [form] = Form.useForm<FormValues>();
  const [step, setStep] = useState(0);
  const [shipment, setShipment] = useState<ShipmentItem | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();

  const currentUser = useAuthStore((s) => s.user);
  const isDistAdmin = currentUser?.role === 'DIST_ADMIN';
  const distAdminDistributionId = currentUser?.distributionId ?? null;

  // DIST_ADMIN — fiksirana distribucija (ista logika kao na staroj create stranici)
  useEffect(() => {
    if (!isDistAdmin || !distAdminDistributionId) return;
    form.setFieldsValue({ distributionId: distAdminDistributionId });
  }, [form, distAdminDistributionId, isDistAdmin]);

  const distributionsQuery = useQuery({
    queryKey: ['distributions', 'list'],
    queryFn: () => distributionsApi.list(),
    enabled: !isDistAdmin,
  });
  const distributions = distributionsQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const distributionId = values.distributionId ?? distAdminDistributionId ?? '';

      // klijentska zaštita: odabrana distribucija mora postojati u listi sa servera
      // (blokira slučaj da zastarele/lačne vrijednosti stignu do backend-a)
      if (!isDistAdmin) {
        const known = distributions.some((d) => d.id === distributionId);
        if (!distributionId || !known) {
          throw new Error(t('shipments.wizard.invalidDistribution'));
        }
      }

      const payload: CreateShipmentInput = {
        name: values.name.trim(),
        provider: values.provider.trim(),
        receivedDate: values.receivedDate.toISOString(),
        notes: values.notes?.trim() || undefined,
        distributionId,
      };
      return shipmentsApi.create(payload);
    },
    onSuccess: async (created) => {
      setShipment(created);
      setStep(1);
      messageApi.success(t('shipments.wizard.createdContinueImport'));
      await queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
    onError: (error: unknown) => {
      // klijentska greška (lokalna validacija) nema `response` — prikaži nju
      const serverMessage = (error as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      const localMessage = error instanceof Error ? error.message : undefined;
      messageApi.error(
        typeof serverMessage === 'string'
          ? serverMessage
          : (localMessage ?? t('shipments.wizard.createFailed')),
      );
    },
  });

  return (
    <div className="mx-auto max-w-[1200px]">
      {contextHolder}

      <div className="mb-5 flex items-center gap-3">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/shipments')}>
          {t('common.actions.back')}
        </Button>
        <Typography.Title level={3} className="!mb-0">
          {t('shipments.list.newShipment')}
        </Typography.Title>
      </div>

      <Card className="mb-5 shadow-sm">
        <Steps
          current={step}
          items={[
            { title: t('shipments.wizard.step1Title'), description: t('shipments.wizard.step1Desc') },
            { title: t('shipments.wizard.step2Title'), description: t('shipments.wizard.step2Desc') },
            { title: t('shipments.wizard.step3Title'), description: t('shipments.wizard.step3Desc') },
          ]}
        />
      </Card>

      {/* ------------------------------- KORAK 1 ------------------------------- */}
      {step === 0 ? (
        <Card title={t('shipments.edit.metaTabLabel')} className="shadow-sm">
          <Form<FormValues>
            form={form}
            layout="vertical"
            requiredMark="optional"
            initialValues={{ receivedDate: dayjs() }}
            onFinish={(values) => createMutation.mutate(values)}
            className="max-w-2xl"
          >
            <Form.Item
              name="name"
              label={t('shipments.edit.nameLabel')}
              rules={[{ required: true, message: t('shipments.edit.nameRequired') }]}
            >
              <Input placeholder={t('shipments.wizard.namePlaceholder')} autoFocus />
            </Form.Item>

            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Form.Item
                name="provider"
                label={t('shipments.details.provider')}
                rules={[{ required: true, message: t('shipments.edit.providerRequired') }]}
              >
                <Input placeholder={t('shipments.wizard.providerPlaceholder')} />
              </Form.Item>

              <Form.Item
                name="receivedDate"
                label={t('shipments.details.receivedDate')}
                rules={[{ required: true, message: t('shipments.edit.dateRequired') }]}
              >
                <DatePicker className="w-full" format="DD.MM.YYYY" />
              </Form.Item>
            </div>

            <Form.Item
              name="distributionId"
              label={t('shipments.wizard.distributionLabel')}
              rules={[{ required: true, message: t('shipments.wizard.distributionRequired') }]}
            >
              <Select
                placeholder={isDistAdmin ? undefined : t('shipments.wizard.selectDistributionPlaceholder')}
                options={distributions.map((d) => ({
                  label: `${d.name} (${d.code})`,
                  value: d.id,
                }))}
                loading={distributionsQuery.isLoading}
                disabled={isDistAdmin}
              />
            </Form.Item>

            <Form.Item name="notes" label={t('common.labels.notes')}>
              <Input.TextArea rows={3} placeholder={t('shipments.wizard.notesPlaceholder')} />
            </Form.Item>

            <Space>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                {t('shipments.wizard.createAndContinue')}
              </Button>
              <Button onClick={() => navigate('/shipments')}>{t('common.actions.cancel')}</Button>
            </Space>
          </Form>
        </Card>
      ) : null}

      {/* ------------------------------- KORAK 2 ------------------------------- */}
      {step === 1 && shipment ? (
        <div className="space-y-4">
          <Alert
            type="success"
            showIcon
            message={
              <span>
                {t('shipments.wizard.createdSuccessPrefix')} <strong>{shipment.name}</strong> {t('shipments.wizard.createdSuccessSuffix')}
              </span>
            }
          />
          <ShipmentImportPanel
            shipmentId={shipment.id}
            shipmentName={shipment.name}
            onImported={(r) => {
              setImportedCount(r.insertedRows);
              setStep(2);
            }}
            footer={
              <Button onClick={() => setStep(2)}>{t('shipments.wizard.skipImport')}</Button>
            }
          />
        </div>
      ) : null}

      {/* ------------------------------- KORAK 3 ------------------------------- */}
      {step === 2 && shipment ? (
        <Card className="shadow-sm">
          <Result
            status="success"
            icon={<CheckOutlined className="text-emerald-600" />}
            title={t('shipments.wizard.readyTitle')}
            subTitle={
              importedCount !== null
                ? t('shipments.wizard.importedCount', { count: importedCount })
                : t('shipments.wizard.createdNoCards')
            }
          />
          <Descriptions bordered size="small" column={1} className="mx-auto max-w-2xl">
            <Descriptions.Item label={t('common.labels.name')}>{shipment.name}</Descriptions.Item>
            <Descriptions.Item label={t('shipments.details.provider')}>{shipment.provider}</Descriptions.Item>
            <Descriptions.Item label={t('shipments.details.receivedDate')}>
              {new Date(shipment.receivedDate).toLocaleDateString(dateLocale)}
            </Descriptions.Item>
            <Descriptions.Item label={t('common.labels.notes')}>{shipment.notes ?? '—'}</Descriptions.Item>
          </Descriptions>
          <div className="mt-5 flex justify-center gap-2">
            <Button type="primary" onClick={() => navigate('/shipments')}>
              {t('shipments.wizard.backToShipmentsList')}
            </Button>
            <Button onClick={() => navigate(`/shipments/${shipment.id}/print`)}>
              {t('shipments.wizard.goToPrintLabels')}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

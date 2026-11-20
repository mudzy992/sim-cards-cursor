import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  DatePicker,
  Form,
  Input,
  Result,
  Skeleton,
  Space,
  Tabs,
  message,
} from 'antd';
import { PrinterOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { shipmentsApi } from '@/api/shipments.api';
import { ShipmentImportPanel } from './import/ShipmentImportPanel';
import { useTranslation } from '@/i18n';
import { PageHeader, PageShell, SectionCard, StatusBadge } from '@/components/ui';
import { ROUTES } from '@/config/routes';

type FormValues = {
  name: string;
  provider: string;
  receivedDate: Dayjs;
  notes?: string;
};

export default function ShipmentEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [form] = Form.useForm<FormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();

  const shipmentQuery = useQuery({
    queryKey: ['shipments', 'details', id],
    queryFn: () => shipmentsApi.getById(id!),
    enabled: Boolean(id),
  });

  const shipment = shipmentQuery.data;

  useEffect(() => {
    if (shipment) {
      form.setFieldsValue({
        name: shipment.name,
        provider: shipment.provider,
        receivedDate: dayjs(shipment.receivedDate),
        notes: shipment.notes ?? undefined,
      });
    }
  }, [shipment, form]);

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      shipmentsApi.update(id!, {
        name: values.name.trim(),
        provider: values.provider.trim(),
        receivedDate: values.receivedDate.toISOString(),
        notes: values.notes?.trim() ?? null,
      }),
    onSuccess: async () => {
      messageApi.success(t('shipments.edit.saved'));
      await queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
    onError: (e: unknown) => {
      const serverMessage = (e as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      messageApi.error(serverMessage ?? t('shipments.edit.saveFailed'));
    },
  });

  if (shipmentQuery.isError) {
    return (
      <Result
        status="404"
        title={t('shipments.edit.notFound')}
        extra={
          <Button type="primary" onClick={() => navigate(ROUTES.shipments)}>
            {t('shipments.edit.backToShipments')}
          </Button>
        }
      />
    );
  }

  return (
    <PageShell className="mx-auto max-w-[1200px]">
      {contextHolder}

      <PageHeader
        title={t('shipments.edit.title', { name: shipment?.name ?? '…' })}
        backTo={ROUTES.shipments}
        badge={
          shipment ? (
            <Space size={8} wrap>
              <StatusBadge tone="accent" label={shipment.provider} />
              <StatusBadge
                tone="neutral"
                label={t('shipments.edit.cardsCount', { count: shipment._count?.simCards ?? 0 })}
              />
            </Space>
          ) : undefined
        }
        actions={
          shipment ? (
            <Button
              icon={<PrinterOutlined />}
              onClick={() => navigate(ROUTES.shipmentPrint(shipment.id))}
            >
              {t('shipments.details.printLabels')}
            </Button>
          ) : undefined
        }
      />

      {shipmentQuery.isLoading || !shipment ? (
        <SectionCard>
          <Skeleton active paragraph={{ rows: 6 }} />
        </SectionCard>
      ) : (
        <Tabs
          defaultActiveKey="meta"
          items={[
            {
              key: 'meta',
              label: t('shipments.edit.metaTabLabel'),
              children: (
                <SectionCard>
                  <Form<FormValues>
                    form={form}
                    layout="vertical"
                    requiredMark="optional"
                    onFinish={(values) => updateMutation.mutate(values)}
                    className="max-w-2xl"
                  >
                    <Form.Item
                      name="name"
                      label={t('shipments.edit.nameLabel')}
                      rules={[{ required: true, message: t('shipments.edit.nameRequired') }]}
                    >
                      <Input />
                    </Form.Item>

                    <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                      <Form.Item
                        name="provider"
                        label={t('shipments.details.provider')}
                        rules={[
                          { required: true, message: t('shipments.edit.providerRequired') },
                        ]}
                      >
                        <Input />
                      </Form.Item>
                      <Form.Item
                        name="receivedDate"
                        label={t('shipments.details.receivedDate')}
                        rules={[{ required: true, message: t('shipments.edit.dateRequired') }]}
                      >
                        <DatePicker className="w-full" format="DD.MM.YYYY" />
                      </Form.Item>
                    </div>

                    <Form.Item name="notes" label={t('common.labels.notes')}>
                      <Input.TextArea rows={3} />
                    </Form.Item>

                    <Space>
                      <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SaveOutlined />}
                        loading={updateMutation.isPending}
                      >
                        {t('shipments.edit.saveChanges')}
                      </Button>
                      <Button onClick={() => navigate(ROUTES.shipments)}>
                        {t('common.actions.cancel')}
                      </Button>
                    </Space>
                  </Form>
                </SectionCard>
              ),
            },
            {
              key: 'import',
              label: t('shipments.edit.importTabLabel'),
              children: (
                <ShipmentImportPanel
                  shipmentId={shipment.id}
                  shipmentName={shipment.name}
                  onImported={() => {
                    void queryClient.invalidateQueries({
                      queryKey: ['shipments', 'details', id],
                    });
                  }}
                />
              ),
            },
          ]}
        />
      )}
    </PageShell>
  );
}

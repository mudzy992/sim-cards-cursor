import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Result,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined, PrinterOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { shipmentsApi } from '@/api/shipments.api';
import { ShipmentImportPanel } from './import/ShipmentImportPanel';
import { useTranslation } from '@/i18n';

/**
 * Izmjena POSTOJEĆE isporuke:
 *  - tab "Podaci": izmjena meta podataka (naziv, dobavljač, datum, napomena)
 *  - tab "Import kartica": dodavanje novih kartica u istu isporuku (isti review tok)
 */
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
          <Button type="primary" onClick={() => navigate('/shipments')}>
            {t('shipments.edit.backToShipments')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      {contextHolder}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/shipments')}>
          {t('common.actions.back')}
        </Button>
        <div className="min-w-0">
          <Typography.Title level={3} className="!mb-0 truncate">
            {t('shipments.edit.title', { name: shipment?.name ?? '…' })}
          </Typography.Title>
          {shipment ? (
            <Space size={8} className="mt-1" wrap>
              <Tag color="geekblue">{shipment.provider}</Tag>
              <Tag>{t('shipments.edit.cardsCount', { count: shipment._count?.simCards ?? 0 })}</Tag>
            </Space>
          ) : null}
        </div>
        {shipment ? (
          <Button
            className="ms-auto"
            icon={<PrinterOutlined />}
            onClick={() => navigate(`/shipments/${shipment.id}/print`)}
          >
            {t('shipments.details.printLabels')}
          </Button>
        ) : null}
      </div>

      {shipmentQuery.isLoading || !shipment ? (
        <Card className="shadow-sm">
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      ) : (
        <Tabs
          defaultActiveKey="meta"
          items={[
            {
              key: 'meta',
              label: t('shipments.edit.metaTabLabel'),
              children: (
                <Card className="shadow-sm">
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
                        rules={[{ required: true, message: t('shipments.edit.providerRequired') }]}
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
                      <Button onClick={() => navigate('/shipments')}>{t('common.actions.cancel')}</Button>
                    </Space>
                  </Form>
                </Card>
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
                    void queryClient.invalidateQueries({ queryKey: ['shipments', 'details', id] });
                  }}
                />
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

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
      messageApi.success('Podaci o isporuci su sačuvani.');
      await queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
    onError: (e: unknown) => {
      const serverMessage = (e as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      messageApi.error(serverMessage ?? 'Spašavanje nije uspjelo.');
    },
  });

  if (shipmentQuery.isError) {
    return (
      <Result
        status="404"
        title="Isporuka nije pronađena"
        extra={
          <Button type="primary" onClick={() => navigate('/shipments')}>
            Nazad na isporuke
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
          Nazad
        </Button>
        <div className="min-w-0">
          <Typography.Title level={3} className="!mb-0 truncate">
            Izmjena isporuke — {shipment?.name ?? '…'}
          </Typography.Title>
          {shipment ? (
            <Space size={8} className="mt-1" wrap>
              <Tag color="geekblue">{shipment.provider}</Tag>
              <Tag>{(shipment._count?.simCards ?? 0).toLocaleString('bs-BA')} kartica</Tag>
            </Space>
          ) : null}
        </div>
        {shipment ? (
          <Button
            className="ms-auto"
            icon={<PrinterOutlined />}
            onClick={() => navigate(`/shipments/${shipment.id}/print`)}
          >
            Etikete za print
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
              label: 'Podaci o isporuci',
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
                      label="Naziv isporuke"
                      rules={[{ required: true, message: 'Naziv je obavezan' }]}
                    >
                      <Input />
                    </Form.Item>

                    <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                      <Form.Item
                        name="provider"
                        label="Dobavljač"
                        rules={[{ required: true, message: 'Dobavljač je obavezan' }]}
                      >
                        <Input />
                      </Form.Item>
                      <Form.Item
                        name="receivedDate"
                        label="Datum prijema"
                        rules={[{ required: true, message: 'Datum je obavezan' }]}
                      >
                        <DatePicker className="w-full" format="DD.MM.YYYY" />
                      </Form.Item>
                    </div>

                    <Form.Item name="notes" label="Napomena">
                      <Input.TextArea rows={3} />
                    </Form.Item>

                    <Space>
                      <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SaveOutlined />}
                        loading={updateMutation.isPending}
                      >
                        Sačuvaj izmjene
                      </Button>
                      <Button onClick={() => navigate('/shipments')}>Odustani</Button>
                    </Space>
                  </Form>
                </Card>
              ),
            },
            {
              key: 'import',
              label: 'Import kartica',
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

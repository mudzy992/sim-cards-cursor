import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { ShipmentImportPanel } from './import/ShipmentImportPanel';
import type { ShipmentItem } from '@/types/shipment.types';

/**
 * Kreiranje isporuke kroz stepper:
 *  1) Podaci o isporuci  →  2) Import kartica (isporuka je već odabrana)  →  3) Gotovo
 * Import je opcion — isporuka se može ostaviti prazna i puniti kasnije.
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
  const [form] = Form.useForm<FormValues>();
  const [step, setStep] = useState(0);
  const [shipment, setShipment] = useState<ShipmentItem | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      shipmentsApi.create({
        name: values.name.trim(),
        provider: values.provider.trim(),
        receivedDate: values.receivedDate.toISOString(),
        notes: values.notes?.trim() || undefined,
        distributionId: values.distributionId ?? '',
      }),
    onSuccess: async (created) => {
      setShipment(created);
      setStep(1);
      messageApi.success('Isporuka je kreirana — nastavite sa importom kartica.');
      await queryClient.invalidateQueries({ queryKey: ['shipments'] });
    },
    onError: (e: unknown) => {
      const serverMessage = (e as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      messageApi.error(serverMessage ?? 'Kreiranje isporuke nije uspjelo.');
    },
  });

  return (
    <div className="mx-auto max-w-[1200px]">
      {contextHolder}

      <div className="mb-5 flex items-center gap-3">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/shipments')}>
          Nazad
        </Button>
        <Typography.Title level={3} className="!mb-0">
          Nova isporuka
        </Typography.Title>
      </div>

      <Card className="mb-5 shadow-sm">
        <Steps
          current={step}
          items={[
            { title: 'Podaci o isporuci', description: 'Naziv, dobavljač, datum' },
            { title: 'Import kartica', description: 'Excel/CSV + review' },
            { title: 'Završeno', description: 'Pregled isporuke' },
          ]}
        />
      </Card>

      {/* ------------------------------- KORAK 1 ------------------------------- */}
      {step === 0 ? (
        <Card title="Podaci o isporuci" className="shadow-sm">
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
              label="Naziv isporuke"
              rules={[{ required: true, message: 'Naziv je obavezan' }]}
            >
              <Input placeholder="npr. Isporuka 06/2026 — M2M paket" autoFocus />
            </Form.Item>

            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Form.Item
                name="provider"
                label="Dobavljač"
                rules={[{ required: true, message: 'Dobavljač je obavezan' }]}
              >
                <Input placeholder="npr. BH Telecom" />
              </Form.Item>

              <Form.Item
                name="receivedDate"
                label="Datum prijema"
                rules={[{ required: true, message: 'Datum je obavezan' }]}
              >
                <DatePicker className="w-full" format="DD.MM.YYYY" />
              </Form.Item>
            </div>

            <Form.Item name="distributionId" label="Distribucija">
              <Select
                allowClear
                placeholder="Odaberite distribuciju (sistem admin)"
                options={[
                  { value: 'dist-sarajevo', label: 'ED Sarajevo' },
                  { value: 'dist-mostar', label: 'ED Mostar' },
                  { value: 'dist-tuzla', label: 'ED Tuzla' },
                  { value: 'dist-zenica', label: 'ED Zenica' },
                ]}
              />
            </Form.Item>

            <Form.Item name="notes" label="Napomena">
              <Input.TextArea rows={3} placeholder="Opcionalna napomena o isporuci" />
            </Form.Item>

            <Space>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                Kreiraj i nastavi na import
              </Button>
              <Button onClick={() => navigate('/shipments')}>Odustani</Button>
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
                Isporuka <strong>{shipment.name}</strong> je kreirana i automatski odabrana za import.
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
              <Button onClick={() => setStep(2)}>Preskoči import (dodaj kartice kasnije)</Button>
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
            title="Isporuka je spremna"
            subTitle={
              importedCount !== null
                ? `Uvezeno ${importedCount} SIM kartica.`
                : 'Isporuka je kreirana bez kartica — import možete uraditi kasnije kroz izmjenu isporuke.'
            }
          />
          <Descriptions bordered size="small" column={1} className="mx-auto max-w-2xl">
            <Descriptions.Item label="Naziv">{shipment.name}</Descriptions.Item>
            <Descriptions.Item label="Dobavljač">{shipment.provider}</Descriptions.Item>
            <Descriptions.Item label="Datum prijema">
              {new Date(shipment.receivedDate).toLocaleDateString('bs-BA')}
            </Descriptions.Item>
            <Descriptions.Item label="Napomena">{shipment.notes ?? '—'}</Descriptions.Item>
          </Descriptions>
          <div className="mt-5 flex justify-center gap-2">
            <Button type="primary" onClick={() => navigate('/shipments')}>
              Nazad na listu isporuka
            </Button>
            <Button onClick={() => navigate(`/shipments/${shipment.id}/print`)}>
              Idi na print etiketa
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

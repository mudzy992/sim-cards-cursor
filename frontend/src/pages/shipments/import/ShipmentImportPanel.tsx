import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Collapse, Result, Select, Space, Spin, Upload, message } from 'antd';
import { InboxOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { shipmentsApi } from '@/api/shipments.api';
import { ImportReviewTable } from './ImportReviewTable';
import type { ImportColumnMapping, ShipmentImportApply, ShipmentImportPreview } from '@/types/import.types';

export interface ShipmentImportPanelProps {
  shipmentId: string;
  shipmentName: string;
  onImported?: (result: ShipmentImportApply) => void;
  footer?: React.ReactNode;
}

const MAPPING_KEYS: Array<{ key: keyof ImportColumnMapping; label: string }> = [
  { key: 'iccid', label: 'ICCID' },
  { key: 'ipAddress', label: 'Interna (epbih) IP' },
  { key: 'publicIpAddress', label: 'Javna IP' },
  { key: 'phoneNumber', label: 'Broj telefona' },
  { key: 'apn', label: 'APN' },
];

export function ShipmentImportPanel(props: ShipmentImportPanelProps) {
  const { shipmentId, shipmentName, onImported, footer } = props;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ShipmentImportPreview | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [mappingDraft, setMappingDraft] = useState<ImportColumnMapping>({});
  const [result, setResult] = useState<ShipmentImportApply | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();

  const previewMutation = useMutation({
    mutationFn: (params: { file: File; columnMapping?: ImportColumnMapping }) =>
      shipmentsApi.importExcel({
        shipmentId,
        file: params.file,
        applyImport: false,
        columnMapping: params.columnMapping,
      }),
    onSuccess: (response, variables) => {
      if (response.mode !== 'preview') return;
      const { file } = variables;
      const previewWithFileName: ShipmentImportPreview = {
        ...response,
        fileName: response.fileName || file.name,
      };
      setPreview(previewWithFileName);
      setSelected(previewWithFileName.previewRows.filter((r) => r.importable).map((r) => r.rowNumber));
      setMappingDraft({
        iccid: previewWithFileName.resolvedMapping.iccid ?? undefined,
        ipAddress: previewWithFileName.resolvedMapping.ipAddress ?? undefined,
        publicIpAddress: previewWithFileName.resolvedMapping.publicIpAddress ?? undefined,
        phoneNumber: previewWithFileName.resolvedMapping.phoneNumber ?? undefined,
        apn: previewWithFileName.resolvedMapping.apn ?? undefined,
      });
    },
    onError: () => messageApi.error('Fajl nije moguće pročitati. Provjerite format (.xlsx, .xls, .csv).'),
  });

  const applyMutation = useMutation({
    mutationFn: () =>
      shipmentsApi.importExcel({ shipmentId, file: file!, applyImport: true, selectedRowNumbers: selected }),
    onSuccess: (data) => {
      if (data.mode !== 'import') return;
      setResult(data);
      messageApi.success(`Uvezeno ${data.insertedRows} kartica.`);
      void queryClient.invalidateQueries({ queryKey: ['shipments'] });
      onImported?.(data);
    },
    onError: () => messageApi.error('Import nije uspio.'),
  });

  const reset = () => {
    setFile(null);
    setPreview(null);
    setSelected([]);
    setMappingDraft({});
    setResult(null);
  };

  if (result) {
    return (
      <>
        {contextHolder}
        <Result status="success" title={`Uvezeno ${result.insertedRows} SIM kartica`}
          subTitle={<span>Isporuka <strong>{shipmentName}</strong> · fajl {result.fileName}
            {result.skippedRows > 0 ? ` · ${result.skippedRows} red(ova) preskočeno.` : ''}</span>}
          extra={<Space><Button icon={<ReloadOutlined />} onClick={reset}>Novi import</Button>{footer}</Space>}
        />
      </>
    );
  }

  if (!preview) {
    return (
      <>
        {contextHolder}
        <Card className="shadow-sm">
          <Spin spinning={previewMutation.isPending} tip="Analiziram fajl…">
            <Upload.Dragger accept=".xlsx,.xls,.csv" maxCount={1}
              fileList={file ? ([{ uid: '1', name: file.name, status: 'done' }] as UploadFile[]) : []}
              beforeUpload={(f) => { setFile(f); previewMutation.mutate({ file: f }); return false; }}
              onRemove={() => reset()}>
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">Prevucite fajl ovdje ili kliknite za odabir</p>
            </Upload.Dragger>
          </Spin>
          <Alert className="mt-4" type="info" showIcon message="Fajl se prvo analizira (preview)." />
          {footer ? <div className="mt-4">{footer}</div> : null}
        </Card>
      </>
    );
  }

  return (
    <>
      {contextHolder}
      <Card className="shadow-sm"
        title={<div className="flex justify-between"><span>Pregled importa: {preview.fileName}</span>
          <Button size="small" icon={<ReloadOutlined />} onClick={reset}>Drugi fajl</Button></div>}>
        <Collapse className="mb-4" ghost items={[{ key: 'mapping', label: 'Mapiranje kolona', children: (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {MAPPING_KEYS.map(({ key, label }) => (
                <div key={key}>
                  <div className="mb-1 text-xs text-slate-500">{label}</div>
                  <Select size="small" allowClear className="w-full" placeholder="— kolona —"
                    value={mappingDraft[key] ?? null}
                    options={(preview.headers ?? []).map((h) => ({ label: h, value: h }))}
                    onChange={(v) => setMappingDraft((prev) => ({ ...prev, [key]: v ?? undefined }))} />
                </div>
              ))}
            </div>
            <Button size="small" loading={previewMutation.isPending}
              onClick={() => file && previewMutation.mutate({ file, columnMapping: mappingDraft })}>
              Osvježi preview
            </Button>
          </div>)}]} />
        <ImportReviewTable preview={preview} shipmentName={shipmentName}
          selectedRowNumbers={selected} onChangeSelection={setSelected} />
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
          {footer}
          <Button type="primary" icon={<UploadOutlined />} disabled={selected.length === 0}
            loading={applyMutation.isPending} onClick={() => applyMutation.mutate()}>
            Uvezi odabrano ({selected.length})
          </Button>
        </div>
      </Card>
    </>
  );
}

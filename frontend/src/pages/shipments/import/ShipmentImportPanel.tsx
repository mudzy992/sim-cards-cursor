import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Collapse, Result, Select, Space, Spin, Upload, message } from 'antd';
import { InboxOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { shipmentsApi } from '@/api/shipments.api';
import { ImportReviewTable } from './ImportReviewTable';
import type { ImportColumnMapping, ShipmentImportApply, ShipmentImportPreview } from '@/types/import.types';
import { useTranslation } from '@/i18n';

export interface ShipmentImportPanelProps {
  shipmentId: string;
  shipmentName: string;
  onImported?: (result: ShipmentImportApply) => void;
  footer?: React.ReactNode;
}

function getMappingKeys(t: (key: string) => string): Array<{ key: keyof ImportColumnMapping; label: string }> {
  return [
    { key: 'iccid', label: 'ICCID' },
    { key: 'ipAddress', label: t('shipments.import.internalIpLabel') },
    { key: 'publicIpAddress', label: t('simCards.details.publicIp') },
    { key: 'phoneNumber', label: t('common.labels.phone') },
    { key: 'apn', label: 'APN' },
  ];
}

export function ShipmentImportPanel(props: ShipmentImportPanelProps) {
  const { shipmentId, shipmentName, onImported, footer } = props;
  const { t } = useTranslation();
  const MAPPING_KEYS = getMappingKeys(t);
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
    onError: () => messageApi.error(t('shipments.import.readFailed')),
  });

  const applyMutation = useMutation({
    mutationFn: () =>
      shipmentsApi.importExcel({
        shipmentId,
        file: file!,
        applyImport: true,
        selectedRowNumbers: selected,
        // Bez ovoga bi backend pri "apply" pozivu ponovo automatski predložio mapiranje kolona
        // (jer polje columnMapping ne bi bilo poslano), čime bi se ignorisalo mapiranje koje je
        // korisnik ručno odabrao/izmijenio u preview koraku.
        columnMapping: preview?.resolvedMapping
          ? {
              iccid: mappingDraft.iccid ?? preview.resolvedMapping.iccid ?? undefined,
              ipAddress: mappingDraft.ipAddress ?? preview.resolvedMapping.ipAddress ?? undefined,
              publicIpAddress: mappingDraft.publicIpAddress ?? preview.resolvedMapping.publicIpAddress ?? undefined,
              phoneNumber: mappingDraft.phoneNumber ?? preview.resolvedMapping.phoneNumber ?? undefined,
              apn: mappingDraft.apn ?? preview.resolvedMapping.apn ?? undefined,
            }
          : mappingDraft,
      }),
    onSuccess: (data) => {
      if (data.mode !== 'import') return;
      setResult(data);
      messageApi.success(t('shipments.import.importedCards', { count: data.insertedRows }));
      void queryClient.invalidateQueries({ queryKey: ['shipments'] });
      onImported?.(data);
    },
    onError: () => messageApi.error(t('shipments.import.importFailed')),
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
        <Result status="success" title={t('shipments.import.importedSimCards', { count: result.insertedRows })}
          subTitle={<span>{t('shipments.import.shipmentPrefix')} <strong>{shipmentName}</strong> · {t('shipments.import.filePrefix')} {result.fileName}
            {result.skippedRows > 0 ? ` · ${t('shipments.import.rowsSkipped', { count: result.skippedRows })}` : ''}</span>}
          extra={<Space><Button icon={<ReloadOutlined />} onClick={reset}>{t('shipments.import.newImport')}</Button>{footer}</Space>}
        />
      </>
    );
  }

  if (!preview) {
    return (
      <>
        {contextHolder}
        <Card className="shadow-sm">
          <Spin spinning={previewMutation.isPending} tip={t('shipments.import.analyzingFile')}>
            <Upload.Dragger accept=".xlsx,.xls,.csv" maxCount={1}
              fileList={file ? ([{ uid: '1', name: file.name, status: 'done' }] as UploadFile[]) : []}
              beforeUpload={(f) => { setFile(f); previewMutation.mutate({ file: f }); return false; }}
              onRemove={() => reset()}>
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">{t('shipments.import.dragDropText')}</p>
            </Upload.Dragger>
          </Spin>
          <Alert className="mt-4" type="info" showIcon message={t('shipments.import.previewFirstHint')} />
          {footer ? <div className="mt-4">{footer}</div> : null}
        </Card>
      </>
    );
  }

  return (
    <>
      {contextHolder}
      <Card className="shadow-sm"
        title={<div className="flex justify-between"><span>{t('shipments.import.reviewTitle')} {preview.fileName}</span>
          <Button size="small" icon={<ReloadOutlined />} onClick={reset}>{t('shipments.import.anotherFile')}</Button></div>}>
        <Collapse className="mb-4" ghost items={[{ key: 'mapping', label: t('shipments.import.columnMapping'), children: (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {MAPPING_KEYS.map(({ key, label }) => (
                <div key={key}>
                  <div className="mb-1 text-xs text-slate-500">{label}</div>
                  <Select size="small" allowClear className="w-full" placeholder={t('shipments.import.columnPlaceholder')}
                    value={mappingDraft[key] ?? null}
                    options={(preview.headers ?? []).map((h) => ({ label: h, value: h }))}
                    onChange={(v) => setMappingDraft((prev) => ({ ...prev, [key]: v ?? undefined }))} />
                </div>
              ))}
            </div>
            <Button size="small" loading={previewMutation.isPending}
              onClick={() => file && previewMutation.mutate({ file, columnMapping: mappingDraft })}>
              {t('shipments.import.refreshPreview')}
            </Button>
          </div>)}]} />
        <ImportReviewTable preview={preview} shipmentName={shipmentName}
          selectedRowNumbers={selected} onChangeSelection={setSelected} />
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
          {footer}
          <Button type="primary" icon={<UploadOutlined />} disabled={selected.length === 0}
            loading={applyMutation.isPending} onClick={() => applyMutation.mutate()}>
            {t('shipments.import.importSelected', { count: selected.length })}
          </Button>
        </div>
      </Card>
    </>
  );
}

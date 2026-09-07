import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Result, Space, Spin, Typography, Upload, message } from 'antd';
import { InboxOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { shipmentsApi } from '@/api/shipments.api';
import { ImportReviewTable } from './ImportReviewTable';
import type { ShipmentImportApply, ShipmentImportPreview } from '@/types/import.types';

/**
 * Panel za import kartica u ISPORUKU (bilo novu iz wizarda, bilo postojeću).
 * Tok: odabir fajla → preview (review) → čekiranje redova → uvoz odabranih.
 */
export interface ShipmentImportPanelProps {
  shipmentId: string;
  shipmentName: string;
  /** poziva se nakon uspješnog uvoza */
  onImported?: (result: ShipmentImportApply) => void;
  /** dodatni sadržaj u dnu (npr. wizard navigacija) */
  footer?: React.ReactNode;
}

export function ShipmentImportPanel(props: ShipmentImportPanelProps) {
  const { shipmentId, shipmentName, onImported, footer } = props;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ShipmentImportPreview | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [result, setResult] = useState<ShipmentImportApply | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();

  const previewMutation = useMutation({
    mutationFn: (f: File) =>
      shipmentsApi.importExcel({ shipmentId, file: f, applyImport: false }),
    onSuccess: (data) => {
      if (data.mode !== 'preview') return;
        setPreview(data);
      // podrazumijevano: svi ispravni redovi su čekirani
      setSelected(data.previewRows.filter((r) => r.importable).map((r) => r.rowNumber));
    },
    onError: () => messageApi.error('Fajl nije moguće pročitati. Provjerite format (.xlsx, .xls, .csv).'),
  });

  const applyMutation = useMutation({
    mutationFn: () =>
      shipmentsApi.importExcel({
        shipmentId,
        file: file!,
        applyImport: true,
        selectedRowNumbers: selected,
      }),
    onSuccess: async (data) => {
      const r = data as ShipmentImportApply;
      setResult(r);
      messageApi.success(`Uvezeno ${r.insertedRows} kartica.`);
      await queryClient.invalidateQueries({ queryKey: ['shipments'] });
      onImported?.(r);
    },
    onError: (e: unknown) => {
      const serverMessage = (e as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      messageApi.error(serverMessage ?? 'Import nije uspio.');
    },
  });

  const reset = () => {
    setFile(null);
    setPreview(null);
    setSelected([]);
    setResult(null);
  };

  /* ---------------------------- rezultat uvoza ---------------------------- */
  if (result) {
    return (
      <>
        {contextHolder}
        <Result
          status="success"
          title={`Uvezeno ${result.insertedRows} SIM kartica`}
          subTitle={
            <span>
              Isporuka <strong>{shipmentName}</strong> · fajl {result.fileName} ·{' '}
              {result.skippedRows > 0
                ? `${result.skippedRows} red(ova) preskočeno (greške ili neoznačeni).`
                : 'svi redovi su uvezeni.'}
            </span>
          }
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={reset}>
                Novi import u istu isporuku
              </Button>
              {footer}
            </Space>
          }
        />
      </>
    );
  }

  /* ------------------------------- upload -------------------------------- */
  if (!preview) {
    return (
      <>
        {contextHolder}
        <Card className="shadow-sm">
          <Spin spinning={previewMutation.isPending} tip="Analiziram fajl…">
            <Upload.Dragger
              accept=".xlsx,.xls,.csv"
              maxCount={1}
              fileList={file ? ([{ uid: '1', name: file.name, status: 'done' }] as UploadFile[]) : []}
              beforeUpload={(f) => {
                setFile(f);
                previewMutation.mutate(f);
                return false; // ne šalji automatski — mi kontrolišemo poziv
              }}
              onRemove={() => reset()}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Prevucite Excel/CSV fajl ovdje ili kliknite za odabir</p>
              <p className="ant-upload-hint">
                Podržano: .xlsx, .xls, .csv · Prvi red mora biti zaglavlje sa nazivima kolona
                (ICCID, IP adresa, Javna IP, Broj telefona, APN)
              </p>
            </Upload.Dragger>
          </Spin>

          <Alert
            className="mt-4"
            type="info"
            showIcon
            message="Fajl se prvo analizira (preview) — ništa se ne upisuje dok ne potvrdite odabrane redove."
          />

          {footer ? <div className="mt-4">{footer}</div> : null}
        </Card>
      </>
    );
  }

  /* -------------------------------- review -------------------------------- */
  return (
    <>
      {contextHolder}
      <Card
        className="shadow-sm"
        title={
          <div className="flex flex-wrap items-center gap-2">
            <Typography.Text strong>Pregled importa</Typography.Text>
            <Typography.Text className="text-xs text-slate-500">{preview.fileName}</Typography.Text>
            <Button size="small" className="ms-auto" icon={<ReloadOutlined />} onClick={reset}>
              Drugi fajl
            </Button>
          </div>
        }
      >
        <ImportReviewTable
          preview={preview}
          shipmentName={shipmentName}
          selectedRowNumbers={selected}
          onChangeSelection={setSelected}
        />

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <Typography.Text className="text-sm">
            U isporuku <strong>{shipmentName}</strong> uvozi se{' '}
            <strong className="text-blue-700">{selected.length}</strong> kartica.
          </Typography.Text>
          <div className="ms-auto flex items-center gap-2">
            {footer}
            <Button
              type="primary"
              icon={<UploadOutlined />}
              disabled={selected.length === 0}
              loading={applyMutation.isPending}
              onClick={() => applyMutation.mutate()}
            >
              Uvezi odabrano ({selected.length})
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}

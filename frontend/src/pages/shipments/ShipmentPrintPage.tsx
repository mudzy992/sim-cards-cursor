import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Collapse,
  Empty,
  InputNumber,
  Modal,
  Pagination,
  Progress,
  Result,
  Segmented,
  Slider,
  Space,
  Spin,
  Tooltip,
} from 'antd';
import {
  CompressOutlined,
  InfoCircleOutlined,
  PrinterOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { PageHeader, PageShell, SectionCard, StatusBadge } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { FALLBACK_DASH } from '@/constants/ui';
import { formatDate, formatNumber } from '@/utils/formatters';
import { shipmentsApi } from '@/api/shipments.api';
import {
  A4_WIDTH_MM,
  LABEL_FORMAT_PRESETS,
  LABEL_LINE_GAP_MM,
  MM_TO_PX,
  bottomMarginMm,
  buildLabelLines,
  buildSheets,
  cardsForSheets,
  centeredLayout,
  clamp,
  displayLength,
  fitFontMm,
  formatMm,
  labelsPerSheet,
  layoutOverflows,
  loadPersistedSettings,
  presetById,
  rightMarginMm,
  savePersistedSettings,
} from './print/label-formats';
import type {
  LabelFormatId,
  LabelLineFonts,
  LabelLineSpec,
  LabelSheetLayout,
  PersistedPrintSettings,
  PrintableSimCard,
} from './print/label-formats';
import { LabelSheetPreview } from './print/LabelSheetPreview';
import { PrintSheets } from './print/PrintSheets';
import { SimLabelContent } from './print/SimLabelContent';
import './print/print-labels.css';
import { useTranslation } from '@/i18n';

/** sentinel: opseg "do kraja" */
const RANGE_TO_END = -1;

/** Visina linije = fontMm × LINE_HEIGHT; koristi se za uklapanje u visinu etikete. */
const LINE_HEIGHT = 1.18;
const PAD_X_MM = 2.4; // 1.2mm lijevo + 1.2mm desno
const PAD_Y_MM = 1.6; // 0.8mm gore + 0.8mm dolje

export default function ShipmentPrintPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t, language } = useTranslation();
  const dateLocale = language === 'bs' ? 'bs-BA' : 'en-US';

  /* ------------------------------ perzistentne postavke ------------------------------ */
  const [persisted, setPersisted] = useState<PersistedPrintSettings>(() => loadPersistedSettings());
  useEffect(() => savePersistedSettings(persisted), [persisted]);

  const formatId = persisted.formatId;
  const layout: LabelSheetLayout = persisted.layouts[formatId] ?? presetById(formatId);

  const setFormat = (next: LabelFormatId) => setPersisted((p) => ({ ...p, formatId: next }));
  const updateLayout = (patch: Partial<LabelSheetLayout>) =>
    setPersisted((p) => ({
      ...p,
      layouts: { ...p.layouts, [formatId]: { ...(p.layouts[formatId] ?? presetById(formatId)), ...patch } },
    }));
  const resetLayout = () =>
    setPersisted((p) => {
      const layouts = { ...p.layouts };
      delete layouts[formatId];
      return { ...p, layouts };
    });

  /* --------------------------------- sesijske postavke -------------------------------- */
  const [rangeFrom, setRangeFrom] = useState(1);
  const [rangeTo, setRangeTo] = useState<number>(RANGE_TO_END);
  const [startOffset, setStartOffset] = useState(0);
  const [testSheetOnly, setTestSheetOnly] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [zoomMode, setZoomMode] = useState<'fit' | 'full'>('fit');
  const [previewPage, setPreviewPage] = useState(1);
  const PREVIEW_SHEETS_PER_PAGE = 6;

  /* ------------------------------------ podaci --------------------------------------- */
  const [loadProgress, setLoadProgress] = useState<{ fetched: number; total: number } | null>(null);

  const perSheet = labelsPerSheet(layout);
  const fetchLimit = clamp(perSheet, 20, 250);
  const overflowed = layoutOverflows(layout);
  const effectiveStartOffset = clamp(startOffset, 0, Math.max(0, perSheet - 1));

  const shipmentQuery = useQuery({
    queryKey: ['shipments', 'print', id],
    queryFn: () => shipmentsApi.getById(id!),
    enabled: Boolean(id),
  });

  const allCardsQuery = useQuery({
    queryKey: ['shipments', 'print', id, 'all-sim-cards'],
    queryFn: async () => {
      setLoadProgress({ fetched: 0, total: 0 });
      const cards = await shipmentsApi.listAllSimCards(
        id!,
        (fetched, total) => setLoadProgress({ fetched, total }),
        fetchLimit,
      );
      return cards;
    },
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  const cards = useMemo(() => allCardsQuery.data ?? [], [allCardsQuery.data]);
  const totalCards = cards.length;
  const shipment = shipmentQuery.data;

  const receivedDateText = useMemo(
    () => (shipment?.receivedDate ? new Date(shipment.receivedDate).toLocaleDateString(dateLocale) : '—'),
    [shipment?.receivedDate, dateLocale],
  );

  /* ---------------------------------- izvedene vrijednosti ---------------------------- */
  useEffect(() => {
    setStartOffset((s) => clamp(s, 0, Math.max(0, perSheet - 1)));
  }, [perSheet]);

  const effectiveFrom = clamp(rangeFrom, 1, Math.max(1, totalCards));
  const effectiveTo =
    rangeTo === RANGE_TO_END || rangeTo > totalCards ? totalCards : clamp(rangeTo, effectiveFrom, totalCards);

  const cardsInRange = useMemo(
    () => (totalCards === 0 ? [] : cards.slice(effectiveFrom - 1, effectiveTo)),
    [cards, effectiveFrom, effectiveTo, totalCards],
  );

  const copies = persisted.copies;
  const oneSheetCardCapacity = cardsForSheets(1, layout, effectiveStartOffset, copies);
  const sheets = useMemo(
    () => buildSheets(cardsInRange, layout, effectiveStartOffset, copies),
    [cardsInRange, layout, effectiveStartOffset, copies],
  );
  const previewTotalPages = Math.max(1, Math.ceil(sheets.length / PREVIEW_SHEETS_PER_PAGE));
  const effectivePreviewPage = clamp(previewPage, 1, previewTotalPages);
  const visiblePreviewSheets = useMemo(() => {
    const start = (effectivePreviewPage - 1) * PREVIEW_SHEETS_PER_PAGE;
    return sheets.slice(start, start + PREVIEW_SHEETS_PER_PAGE).map((cells, offset) => ({
      cells,
      sheetIndex: start + offset,
    }));
  }, [sheets, effectivePreviewPage]);
  const printSheets = testSheetOnly ? sheets.slice(0, 1) : sheets;

  const totalLabels = useMemo(
    () => sheets.flat().filter((c) => c.sim && !c.used).length,
    [sheets],
  );

  /* ------------------------- veličine fontova (širina + visina) ------------------------ */
  const lineFonts = useMemo<LabelLineFonts>(() => {
    const usableW = layout.labelWidthMm - PAD_X_MM;
    const usableH = layout.labelHeightMm - PAD_Y_MM;

    const lineCount =
      1 + (persisted.showIp ? 1 : 0) + (persisted.showPublicIp ? 1 : 0) + (persisted.showReceivedDate ? 1 : 0);

    // Najveći font koji dozvoljava visina etikete za zadani broj linija
    const heightFit = (usableH - (lineCount - 1) * LABEL_LINE_GAP_MM) / (lineCount * LINE_HEIGHT);

    let maxIccid = 10;
    let maxIp = 10;
    let maxPublicIp = 15; // ipv4 max
    for (const c of cardsInRange) {
      const l = displayLength(c.iccid, persisted.iccidGrouping);
      if (l > maxIccid) maxIccid = l;
      const ipLen = c.ipAddress?.length ?? 0;
      if (ipLen > maxIp) maxIp = ipLen;
      const pubLen = c.publicIpAddress?.length ?? 0;
      if (pubLen > maxPublicIp) maxPublicIp = pubLen;
    }

    const scale = persisted.fontScale / 100;
    const compute = (chars: number, capMm: number) =>
      Math.min(fitFontMm(chars, usableW, capMm, 1.1), heightFit) * scale;

    return {
      iccidMm: compute(maxIccid, 2.7),
      ipMm: compute(maxIp, 2.95),
      publicIpMm: compute(maxPublicIp, 2.5),
      dateMm: compute(10, 2.3),
    };
  }, [
    cardsInRange,
    layout.labelWidthMm,
    layout.labelHeightMm,
    persisted.iccidGrouping,
    persisted.fontScale,
    persisted.showIp,
    persisted.showPublicIp,
    persisted.showReceivedDate,
  ]);

  /** Zajednička gradnja linija za pregled, print i živi primjer. */
  const makeLines = useCallback(
    (sim: PrintableSimCard): LabelLineSpec[] =>
      buildLabelLines(
        sim,
        {
          showIp: persisted.showIp,
          showPublicIp: persisted.showPublicIp,
          showReceivedDate: persisted.showReceivedDate,
        },
        persisted.iccidGrouping,
        lineFonts,
        receivedDateText,
      ),
    [
      persisted.showIp,
      persisted.showPublicIp,
      persisted.showReceivedDate,
      persisted.iccidGrouping,
      lineFonts,
      receivedDateText,
    ],
  );

  /* ------------------------------------ zoom / skala ---------------------------------- */
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(900);

  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sheetWpx = A4_WIDTH_MM * MM_TO_PX;
  const fitScale = clamp((containerWidth - 16) / sheetWpx, 0.25, 1.1);
  const scale = zoomMode === 'fit' ? fitScale : 1;

  /* ------------------------------------- akcije -------------------------------------- */
  const loading = shipmentQuery.isLoading || allCardsQuery.isLoading;
  const canPrint = !loading && cardsInRange.length > 0 && !overflowed;

  const openPrintDialog = () => {
    setPrintModalOpen(false);
    // malo zakašnjenje da se modal zatvori prije print dijaloga (Chrome blokira duple dijaloge)
    setTimeout(() => window.print(), 50);
  };

  const exampleCard: PrintableSimCard = cardsInRange[0] ?? {
    id: 'example',
    iccid: '89387000000000000012',
    ipAddress: '10.148.32.2',
    publicIpAddress: '31.47.10.25',
  };

  /* -------------------------------------- render ------------------------------------- */
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
    <PageShell className="mx-auto max-w-[1500px]">
      <PageHeader
        title={t('shipments.printPage.headerTitle', { name: shipment?.name ?? '…' })}
        backTo={id ? ROUTES.shipmentDetail(id) : ROUTES.shipments}
        badge={
          shipment ? (
            <Space size={8} wrap>
              <StatusBadge tone="accent" label={shipment.provider} />
              <StatusBadge tone="neutral" label={formatDate(shipment.receivedDate, language)} />
              <StatusBadge
                tone="neutral"
                label={t('shipments.edit.cardsCount', { count: totalCards })}
              />
              {testSheetOnly ? (
                <StatusBadge tone="warning" label={t('shipments.printPage.testSheetTag')} />
              ) : null}
            </Space>
          ) : undefined
        }
        actions={
          <Tooltip title={!canPrint ? t('shipments.printPage.cannotPrintTooltip') : undefined}>
            <Button
              type="primary"
              size="large"
              icon={<PrinterOutlined />}
              disabled={!canPrint}
              onClick={() => setPrintModalOpen(true)}
            >
              {t('shipments.printPage.preparePrint')}
            </Button>
          </Tooltip>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[440px_minmax(0,1fr)]">
        {/* ------------------------------- lijevi panel ------------------------------- */}
        <div className="print-settings-scroll space-y-4 self-start xl:sticky xl:top-4 xl:max-h-[calc(100vh-110px)] xl:overflow-y-auto xl:pe-1">
          {/* format */}
          <SectionCard size="small" title={t('shipments.printPage.step1Title')}>
            <div className="grid grid-cols-2 gap-3">
              {LABEL_FORMAT_PRESETS.map((preset) => {
                const active = preset.id === formatId;
                const per = labelsPerSheet(persisted.layouts[preset.id] ?? preset);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setFormat(preset.id)}
                    className={[
                      'rounded-lg border p-3 text-left transition-all',
                      active
                        ? 'border-accent bg-accent-soft ring-2 ring-accent'
                        : 'border-subtle bg-surface hover:border-strong',
                    ].join(' ')}
                  >
                    <span
                      className="mb-2 block rounded border border-dashed border-default bg-surface-sunken"
                      style={{
                        width: '100%',
                        paddingBottom: `${(preset.labelHeightMm / preset.labelWidthMm) * 100}%`,
                        height: 0,
                      }}
                    />
                    <span className="block text-sm font-semibold text-fg-primary">{preset.name}</span>
                    <span className="block text-xs text-fg-secondary">
                      {t('shipments.printPage.presetDescription', {
                        columns: preset.columns,
                        rows: preset.rows,
                        count: preset.columns * preset.rows,
                      })}
                    </span>
                    <span className="mt-1 block text-xs font-medium text-accent-fg">
                      {t('shipments.printPage.labelsPerSheet', { count: per })}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* brzi razmaci — uvijek vidljivi */}
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-subtle pt-3">
              <LabeledNumber
                label={t('shipments.printPage.gapXLabel')}
                value={layout.gapXMm}
                step={0.1}
                min={0}
                max={30}
                onChange={(v) => updateLayout({ gapXMm: v })}
              />
              <LabeledNumber
                label={t('shipments.printPage.gapYLabel')}
                value={layout.gapYMm}
                step={0.1}
                min={0}
                max={30}
                onChange={(v) => updateLayout({ gapYMm: v })}
              />
            </div>
            <div className={`mt-2 text-[11px] ${overflowed ? 'text-status-danger-fg' : 'text-fg-muted'}`}>
              {overflowed
                ? t('shipments.printPage.gridOverflowWarning')
                : t('shipments.printPage.marginsSummary', { right: formatMm(rightMarginMm(layout)), bottom: formatMm(bottomMarginMm(layout)) })}
            </div>
          </SectionCard>

          {/* obuhvat + kopije */}
          <SectionCard size="small" title={t('shipments.printPage.step2Title')}>
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <div className="mb-1 text-xs text-fg-secondary">{t('shipments.printPage.cardsFromLabel')}</div>
                  <InputNumber
                    min={1}
                    max={Math.max(1, totalCards)}
                    value={effectiveFrom}
                    onChange={(v) => setRangeFrom(typeof v === 'number' ? v : 1)}
                    className="w-full"
                    disabled={totalCards === 0}
                  />
                </div>
                <div className="flex-1">
                  <div className="mb-1 text-xs text-fg-secondary">{t('shipments.printPage.toLabel')}</div>
                  <InputNumber
                    min={effectiveFrom}
                    max={Math.max(1, totalCards)}
                    value={rangeTo === RANGE_TO_END ? null : effectiveTo}
                    placeholder={totalCards > 0 ? t('shipments.printPage.allCount', { count: totalCards }) : FALLBACK_DASH}
                    onChange={(v) => setRangeTo(typeof v === 'number' ? v : RANGE_TO_END)}
                    className="w-full"
                    disabled={totalCards === 0}
                  />
                </div>
                <Button
                  onClick={() =>
                    setRangeTo(Math.min(totalCards, effectiveFrom + oneSheetCardCapacity - 1))
                  }
                  disabled={totalCards === 0}
                >
                  {t('shipments.printPage.fillOneSheet', { count: Math.min(oneSheetCardCapacity, Math.max(0, totalCards - effectiveFrom + 1)) })}
                </Button>
                <Button onClick={() => { setRangeFrom(1); setRangeTo(RANGE_TO_END); }} disabled={totalCards === 0}>
                  {t('common.labels.all')}
                </Button>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <div className="mb-1 text-xs text-fg-secondary">{t('shipments.printPage.copiesPerCardLabel')}</div>
                  <InputNumber
                    min={1}
                    max={10}
                    value={copies}
                    onChange={(v) => setPersisted((p) => ({ ...p, copies: typeof v === 'number' ? v : 1 }))}
                    className="w-full"
                  />
                </div>
                <div className="flex-1">
                  <div className="mb-1 text-xs text-fg-secondary">{t('shipments.printPage.startPositionLabel')}</div>
                  <InputNumber
                    min={1}
                    max={perSheet}
                    value={effectiveStartOffset + 1}
                    onChange={(v) => setStartOffset(typeof v === 'number' ? clamp(v - 1, 0, perSheet - 1) : 0)}
                    className="w-full"
                  />
                </div>
              </div>

              <Alert
                type="info"
                showIcon
                icon={<InfoCircleOutlined />}
                message={
                  <span className="text-xs">
                    {t('shipments.printPage.usedLabelHint1')} <strong>{t('shipments.printPage.usedLabelHint2')}</strong>{' '}
                    {t('shipments.printPage.usedLabelHint3')}
                  </span>
                }
              />
            </div>
          </SectionCard>

          {/* sadržaj etikete */}
          <SectionCard size="small" title={t('shipments.printPage.step3Title')}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <Checkbox checked disabled>
                  ICCID
                </Checkbox>
                <Checkbox
                  checked={persisted.showIp}
                  onChange={(e) => setPersisted((p) => ({ ...p, showIp: e.target.checked }))}
                >
                  {t('shipments.import.internalIpLabel')}
                </Checkbox>
                <Checkbox
                  checked={persisted.showPublicIp}
                  onChange={(e) => setPersisted((p) => ({ ...p, showPublicIp: e.target.checked }))}
                >
                  {t('simCards.details.publicIp')}
                </Checkbox>
                <Checkbox
                  checked={persisted.showReceivedDate}
                  onChange={(e) => setPersisted((p) => ({ ...p, showReceivedDate: e.target.checked }))}
                >
                  {t('shipments.details.receivedDate')}
                </Checkbox>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-fg-secondary">{t('shipments.printPage.iccidDisplayLabel')}</span>
                <Segmented
                  size="small"
                  value={persisted.iccidGrouping}
                  onChange={(v) =>
                    setPersisted((p) => ({ ...p, iccidGrouping: v as PersistedPrintSettings['iccidGrouping'] }))
                  }
                  options={[
                    { label: t('shipments.printPage.groupingPlain'), value: 'plain' },
                    { label: t('shipments.printPage.groupingBy4'), value: 'group4' },
                  ]}
                />
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs text-fg-secondary">
                  <span>{t('shipments.printPage.fontSizeLabel')}</span>
                  <span>{persisted.fontScale}%</span>
                </div>
                <Slider
                  min={70}
                  max={130}
                  value={persisted.fontScale}
                  onChange={(v) => setPersisted((p) => ({ ...p, fontScale: Array.isArray(v) ? v[0]! : v }))}
                />
              </div>

              {/* živi primjer etikete — ostaje A4 bijeli papir (.print-preview-scope) */}
              <div className="print-preview-scope rounded-md border border-subtle bg-surface-sunken p-3">
                <div className="mb-2 text-[11px] uppercase tracking-wide text-fg-muted">{t('shipments.printPage.labelPreview')}</div>
                <div className="flex justify-center overflow-hidden">
                  <div
                    className="lp-preview-sample relative rounded-[3px]"
                    style={{
                      width: `${layout.labelWidthMm * 2.4}mm`,
                      height: `${layout.labelHeightMm * 2.4}mm`,
                      maxWidth: '100%',
                      overflow: 'hidden',
                    }}
                  >
                    {/* render na stvarnoj mm veličini pa skalirano — vjeran prikaz */}
                    <div
                      style={{
                        transform: 'scale(2.4)',
                        transformOrigin: 'top left',
                        width: `${layout.labelWidthMm}mm`,
                        height: `${layout.labelHeightMm}mm`,
                      }}
                    >
                      <SimLabelContent lines={makeLines(exampleCard)} gapMm={LABEL_LINE_GAP_MM} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* napredna geometrija */}
          <SectionCard size="small">
            <Collapse
              ghost
              items={[
                {
                  key: 'advanced',
                  label: <span className="text-sm font-medium">{t('shipments.printPage.advancedTitle')}</span>,
                  children: (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <LabeledNumber label={t('shipments.printPage.labelWidthMm')} value={layout.labelWidthMm} step={0.1} min={10} max={A4_WIDTH_MM} onChange={(v) => updateLayout({ labelWidthMm: v })} />
                        <LabeledNumber label={t('shipments.printPage.labelHeightMm')} value={layout.labelHeightMm} step={0.1} min={5} max={80} onChange={(v) => updateLayout({ labelHeightMm: v })} />
                        <LabeledNumber label={t('shipments.printPage.columnsLabel')} value={layout.columns} step={1} min={1} max={12} precision={0} onChange={(v) => updateLayout({ columns: Math.round(v) })} />
                        <LabeledNumber label={t('shipments.printPage.rowsLabel')} value={layout.rows} step={1} min={1} max={60} precision={0} onChange={(v) => updateLayout({ rows: Math.round(v) })} />
                        <LabeledNumber label={t('shipments.printPage.marginLeftMm')} value={layout.marginLeftMm} step={0.1} min={0} max={100} onChange={(v) => updateLayout({ marginLeftMm: v })} />
                        <LabeledNumber label={t('shipments.printPage.marginTopMm')} value={layout.marginTopMm} step={0.1} min={0} max={200} onChange={(v) => updateLayout({ marginTopMm: v })} />
                        <LabeledNumber label={t('shipments.printPage.gapXLabel')} value={layout.gapXMm} step={0.1} min={0} max={30} onChange={(v) => updateLayout({ gapXMm: v })} />
                        <LabeledNumber label={t('shipments.printPage.gapYLabel')} value={layout.gapYMm} step={0.1} min={0} max={30} onChange={(v) => updateLayout({ gapYMm: v })} />
                      </div>

                      <div
                        className={`rounded-md border p-2 text-xs ${
                          overflowed
                            ? 'border-status-danger-border bg-status-danger-bg text-status-danger-fg'
                            : 'border-status-success-border bg-status-success-bg text-status-success-fg'
                        }`}
                      >
                        {overflowed ? (
                          <>
                            {t('shipments.printPage.overflowMessage1')} <strong>{t('shipments.printPage.overflowMessage2')}</strong>: {t('shipments.printPage.rightMarginLabel')} {formatMm(rightMarginMm(layout))} mm,
                            {t('shipments.printPage.bottomMarginLabel')} {formatMm(bottomMarginMm(layout))} mm. {t('shipments.printPage.overflowMessage3')}
                          </>
                        ) : (
                          <>
                            {t('shipments.printPage.rightMarginLabel')} <strong>{formatMm(rightMarginMm(layout))} mm</strong> · {t('shipments.printPage.bottomMarginLabel')}{' '}
                            <strong>{formatMm(bottomMarginMm(layout))} mm</strong> — {t('shipments.printPage.fitsA4')}
                          </>
                        )}
                      </div>

                      <Space wrap>
                        <Button size="small" icon={<CompressOutlined />} onClick={() => updateLayout(centeredLayout(layout))}>
                          {t('shipments.printPage.centerOnPaper')}
                        </Button>
                        <Button size="small" icon={<ReloadOutlined />} onClick={resetLayout}>
                          {t('shipments.printPage.restoreDefaults', { name: presetById(formatId).name })}
                        </Button>
                      </Space>

                      <div className="text-xs text-fg-muted">
                        {t('shipments.printPage.settingsPersistedHint')}
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </SectionCard>

          {/* priprema i print */}
          <SectionCard size="small" title={t('shipments.printPage.step4Title')}>
            <div className="space-y-3">
              <Checkbox
                checked={persisted.showOutlines}
                onChange={(e) => setPersisted((p) => ({ ...p, showOutlines: e.target.checked }))}
              >
                {t('shipments.printPage.showOutlinesLabel')}
              </Checkbox>
              <Checkbox checked={testSheetOnly} onChange={(e) => setTestSheetOnly(e.target.checked)}>
                {t('shipments.printPage.testSheetOnlyLabel')}
              </Checkbox>

              <div className="grid grid-cols-2 gap-2">
                <StatBox label={t('shipments.printPage.statCardsInRange')} value={formatNumber(cardsInRange.length, language)} />
                <StatBox label={t('shipments.printPage.statLabelsToPrint')} value={formatNumber(totalLabels, language)} />
                <StatBox label={t('shipments.printPage.statSheetsA4')} value={formatNumber(printSheets.length, language)} suffix={testSheetOnly ? `/ ${sheets.length}` : undefined} />
                <StatBox label={t('shipments.printPage.statStartAtLabel')} value={`#${effectiveStartOffset + 1}`} />
              </div>

              <Button
                type="primary"
                size="large"
                block
                icon={<PrinterOutlined />}
                disabled={!canPrint}
                onClick={() => setPrintModalOpen(true)}
              >
                {testSheetOnly ? t('shipments.printPage.printTestSheet') : t('shipments.printPage.printNSheets', { count: printSheets.length })}
              </Button>
            </div>
          </SectionCard>
        </div>

        {/* -------------------------------- desni pregled ------------------------------- */}
        <div ref={previewContainerRef} className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-subtle bg-surface-sunken px-3 py-2">
            <Segmented
              size="small"
              value={zoomMode}
              onChange={(v) => setZoomMode(v as 'fit' | 'full')}
              options={[
                { label: t('shipments.printPage.zoomFit'), value: 'fit' },
                { label: '100%', value: 'full' },
              ]}
            />
            <span className="ms-auto">
              <StatusBadge
                tone="neutral"
                label={t('shipments.printPage.sheetsSummary', { sheets: sheets.length, labels: totalLabels, perSheet })}
              />
            </span>
          </div>

          {/* vidljivo upozorenje o aktivnoj početnoj poziciji (izbjegava zabunu 79/80) */}
          {!loading && effectiveStartOffset > 0 ? (
            <Alert
              className="mb-3"
              type="warning"
              showIcon
              closable
              onClose={() => setStartOffset(0)}
              message={
                <span className="text-sm">
                  {t('shipments.printPage.printStartsFrom')} <strong>#{effectiveStartOffset + 1}</strong> {t('shipments.printPage.onFirstSheet')}{' '}
                  ({effectiveStartOffset} {effectiveStartOffset === 1 ? t('shipments.printPage.markedSingular') : t('shipments.printPage.markedPlural')} ·{' '}
                  {t('shipments.printPage.remainingOnFirstSheet', { count: perSheet - effectiveStartOffset })}).{' '}
                  <Button size="small" type="link" className="!p-0" onClick={() => setStartOffset(0)}>
                    {t('shipments.printPage.resetToLabel1')}
                  </Button>
                </span>
              }
            />
          ) : null}

          {loading ? (
            <Card className="flex min-h-[400px] items-center justify-center border-subtle bg-surface">
              <div className="flex flex-col items-center gap-4 py-16">
                <Spin size="large" />
                <div className="w-72">
                  <div className="mb-1 text-center text-sm text-fg-secondary">
                    {t('shipments.printPage.loadingCards')}{' '}
                    {loadProgress && loadProgress.total > 0
                      ? `${loadProgress.fetched}/${loadProgress.total}`
                      : ''}
                  </div>
                  <Progress
                    percent={
                      loadProgress && loadProgress.total > 0
                        ? Math.round((loadProgress.fetched / loadProgress.total) * 100)
                        : 0
                    }
                    size="small"
                    status="active"
                  />
                </div>
              </div>
            </Card>
          ) : cardsInRange.length === 0 ? (
            <SectionCard>
              <Empty
                description={
                  totalCards === 0
                    ? t('shipments.printPage.noCardsInShipment')
                    : t('shipments.printPage.noCardsInRange')
                }
              />
            </SectionCard>
          ) : (
            <div className="space-y-8 pb-16">
              {sheets.length > PREVIEW_SHEETS_PER_PAGE ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-subtle bg-surface px-4 py-2.5">
                  <span className="text-xs text-fg-secondary">
                    {t('shipments.printPage.previewPaginationInfo', {
                      from: (effectivePreviewPage - 1) * PREVIEW_SHEETS_PER_PAGE + 1,
                      to: Math.min(effectivePreviewPage * PREVIEW_SHEETS_PER_PAGE, sheets.length),
                      total: sheets.length,
                    })}
                  </span>
                  <Pagination
                    size="small"
                    current={effectivePreviewPage}
                    pageSize={PREVIEW_SHEETS_PER_PAGE}
                    total={sheets.length}
                    showSizeChanger={false}
                    onChange={(page) => setPreviewPage(page)}
                  />
                </div>
              ) : null}

              {visiblePreviewSheets.map(({ cells, sheetIndex }) => (
                <LabelSheetPreview
                  key={sheetIndex}
                  cells={cells}
                  layout={layout}
                  scale={scale}
                  sheetNumber={sheetIndex + 1}
                  totalSheets={sheets.length}
                  interactive={sheetIndex === 0}
                  showGuides
                  makeLines={makeLines}
                  lineGapMm={LABEL_LINE_GAP_MM}
                  onPickStart={(cellIndex) => setStartOffset(cellIndex)}
                />
              ))}

              {sheets.length > PREVIEW_SHEETS_PER_PAGE ? (
                <div className="flex justify-center pt-2">
                  <Pagination
                    size="small"
                    current={effectivePreviewPage}
                    pageSize={PREVIEW_SHEETS_PER_PAGE}
                    total={sheets.length}
                    showSizeChanger={false}
                    onChange={(page) => setPreviewPage(page)}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* print-only DOM */}
      {!loading && cardsInRange.length > 0 ? (
        <PrintSheets
          sheets={printSheets}
          layout={layout}
          showOutlines={persisted.showOutlines}
          makeLines={makeLines}
          lineGapMm={LABEL_LINE_GAP_MM}
        />
      ) : null}

      {/* kontrolna lista prije printa */}
      <Modal
        title={t('shipments.printPage.checklistTitle')}
        open={printModalOpen}
        okText={t('shipments.printPage.openPrintDialog')}
        cancelText={t('common.actions.cancel')}
        onOk={openPrintDialog}
        onCancel={() => setPrintModalOpen(false)}
      >
        <div className="space-y-2 text-sm text-fg-primary">
          <p className="text-fg-secondary">
            {t('shipments.printPage.checklistIntro')}
          </p>
          <ul className="list-disc space-y-1 ps-5">
            <li>
              {t('shipments.printPage.checklistMargins')} <strong>{t('shipments.printPage.checklistMarginsValue')}</strong> — {t('shipments.printPage.checklistMarginsHint')}
            </li>
            <li>
              {t('shipments.printPage.checklistScale')} <strong>100 %</strong> {t('shipments.printPage.checklistScaleHint')}
            </li>
            <li>
              {t('shipments.printPage.checklistOrientation')} <strong>{t('shipments.printPage.checklistOrientationValue')}</strong>, {t('shipments.printPage.checklistOrientationPaper')}
            </li>
            <li>{t('shipments.printPage.checklistHeaders')}</li>
            <li>
              {t('shipments.printPage.checklistFirstTime1')} <strong>{t('shipments.printPage.checklistFirstTime2')}</strong> {t('shipments.printPage.checklistFirstTime3')}
            </li>
          </ul>
          <Alert
            type="warning"
            showIcon
            message={t('shipments.printPage.checklistPaperWarning')}
          />
        </div>
      </Modal>
    </PageShell>
  );
}

/* ------------------------------ pomoćne komponente ------------------------------ */

function StatBox(props: { label: string; value: number | string; suffix?: string }) {
  return (
    <div className="rounded-md border border-subtle bg-surface-sunken px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-fg-muted">{props.label}</div>
      <div className="text-lg font-semibold tabular-nums text-fg-primary">
        {props.value}
        {props.suffix ? <span className="text-xs font-normal text-fg-muted"> {props.suffix}</span> : null}
      </div>
    </div>
  );
}

function LabeledNumber(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  precision?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-fg-secondary">{props.label}</div>
      <InputNumber
        size="small"
        className="w-full"
        min={props.min}
        max={props.max}
        step={props.step}
        precision={props.precision ?? 1}
        value={props.value}
        onChange={(v) => props.onChange(typeof v === 'number' ? v : props.min)}
      />
    </div>
  );
}

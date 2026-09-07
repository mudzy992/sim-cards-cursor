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
  Progress,
  Result,
  Segmented,
  Slider,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  CompressOutlined,
  InfoCircleOutlined,
  PrinterOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { shipmentsApi } from '@/api/shipments.api';
import {
  A4_WIDTH_MM,
  LABEL_FORMAT_PRESETS,
  LABEL_LINE_GAP_MM,
  MM_TO_PX,
  bottomMarginMm,
  buildLabelLines,
  buildSheets,
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

/** sentinel: opseg "do kraja" */
const RANGE_TO_END = -1;

/** Visina linije = fontMm × LINE_HEIGHT; koristi se za uklapanje u visinu etikete. */
const LINE_HEIGHT = 1.18;
const PAD_X_MM = 2.4; // 1.2mm lijevo + 1.2mm desno
const PAD_Y_MM = 1.6; // 0.8mm gore + 0.8mm dolje

export default function ShipmentPrintPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

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

  /* ------------------------------------ podaci --------------------------------------- */
  const [loadProgress, setLoadProgress] = useState<{ fetched: number; total: number } | null>(null);

  const shipmentQuery = useQuery({
    queryKey: ['shipments', 'print', id],
    queryFn: () => shipmentsApi.getById(id!),
    enabled: Boolean(id),
  });

  const allCardsQuery = useQuery({
    queryKey: ['shipments', 'print', id, 'all-sim-cards'],
    queryFn: async () => {
      setLoadProgress({ fetched: 0, total: 0 });
      const cards = await shipmentsApi.listAllSimCards(id!, (fetched, total) =>
        setLoadProgress({ fetched, total }),
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
    () => (shipment?.receivedDate ? new Date(shipment.receivedDate).toLocaleDateString('bs-BA') : '—'),
    [shipment?.receivedDate],
  );

  /* ---------------------------------- izvedene vrijednosti ---------------------------- */
  const perSheet = labelsPerSheet(layout);
  const overflowed = layoutOverflows(layout);

  useEffect(() => {
    setStartOffset((s) => clamp(s, 0, perSheet - 1));
  }, [perSheet]);

  const effectiveFrom = clamp(rangeFrom, 1, Math.max(1, totalCards));
  const effectiveTo =
    rangeTo === RANGE_TO_END || rangeTo > totalCards ? totalCards : clamp(rangeTo, effectiveFrom, totalCards);

  const cardsInRange = useMemo(
    () => (totalCards === 0 ? [] : cards.slice(effectiveFrom - 1, effectiveTo)),
    [cards, effectiveFrom, effectiveTo, totalCards],
  );

  const copies = persisted.copies;
  const sheets = useMemo(
    () => buildSheets(cardsInRange, layout, startOffset, copies),
    [cardsInRange, layout, startOffset, copies],
  );
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
    <div className="mx-auto max-w-[1500px]">
      {/* zaglavlje */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          Nazad
        </Button>
        <div className="min-w-0">
          <Typography.Title level={3} className="!mb-0 truncate">
            Print etiketa — {shipment?.name ?? '…'}
          </Typography.Title>
          {shipment ? (
            <Space size={8} className="mt-1" wrap>
              <Tag color="geekblue">{shipment.provider}</Tag>
              <Tag>{new Date(shipment.receivedDate).toLocaleDateString('bs-BA')}</Tag>
              <Tag color="default">{totalCards.toLocaleString('bs-BA')} kartica</Tag>
              {testSheetOnly ? <Tag color="orange">PROBNI LIST</Tag> : null}
            </Space>
          ) : null}
        </div>
        <div className="ms-auto">
          <Tooltip title={!canPrint ? 'Nema kartica u obuhvatu ili geometrija ne staje na A4' : undefined}>
            <Button
              type="primary"
              size="large"
              icon={<PrinterOutlined />}
              disabled={!canPrint}
              onClick={() => setPrintModalOpen(true)}
            >
              Pripremi print
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[440px_minmax(0,1fr)]">
        {/* ------------------------------- lijevi panel ------------------------------- */}
        <div className="print-settings-scroll space-y-4 self-start xl:sticky xl:top-4 xl:max-h-[calc(100vh-110px)] xl:overflow-y-auto xl:pe-1">
          {/* format */}
          <Card size="small" title="1. Format etikete" className="shadow-sm">
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
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/30'
                        : 'border-slate-200 bg-white hover:border-slate-400',
                    ].join(' ')}
                  >
                    <span
                      className="mb-2 block rounded border border-dashed border-slate-400 bg-slate-50"
                      style={{
                        width: '100%',
                        paddingBottom: `${(preset.labelHeightMm / preset.labelWidthMm) * 100}%`,
                        height: 0,
                      }}
                    />
                    <span className="block text-sm font-semibold text-slate-800">{preset.name}</span>
                    <span className="block text-xs text-slate-500">{preset.description}</span>
                    <span className="mt-1 block text-xs font-medium text-blue-700">
                      {per} etiketa / list
                    </span>
                  </button>
                );
              })}
            </div>

            {/* brzi razmaci — uvijek vidljivi */}
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
              <LabeledNumber
                label="Razmak X — između kolona (mm)"
                value={layout.gapXMm}
                step={0.1}
                min={0}
                max={30}
                onChange={(v) => updateLayout({ gapXMm: v })}
              />
              <LabeledNumber
                label="Razmak Y — između redova (mm)"
                value={layout.gapYMm}
                step={0.1}
                min={0}
                max={30}
                onChange={(v) => updateLayout({ gapYMm: v })}
              />
            </div>
            <div className={`mt-2 text-[11px] ${overflowed ? 'text-red-600' : 'text-slate-500'}`}>
              {overflowed
                ? 'Pažnja: sa ovim razmacima mreža više ne staje na A4 — provjerite napredna podešavanja.'
                : `Nakon razmaka: desna margina ${formatMm(rightMarginMm(layout))} mm · donja ${formatMm(bottomMarginMm(layout))} mm`}
            </div>
          </Card>

          {/* obuhvat + kopije */}
          <Card size="small" title="2. Šta se printa" className="shadow-sm">
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <div className="mb-1 text-xs text-slate-500">Kartice od (redni br.)</div>
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
                  <div className="mb-1 text-xs text-slate-500">do</div>
                  <InputNumber
                    min={effectiveFrom}
                    max={Math.max(1, totalCards)}
                    value={rangeTo === RANGE_TO_END ? null : effectiveTo}
                    placeholder={totalCards > 0 ? `Sve (${totalCards})` : '—'}
                    onChange={(v) => setRangeTo(typeof v === 'number' ? v : RANGE_TO_END)}
                    className="w-full"
                    disabled={totalCards === 0}
                  />
                </div>
                <Button onClick={() => { setRangeFrom(1); setRangeTo(RANGE_TO_END); }} disabled={totalCards === 0}>
                  Sve
                </Button>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <div className="mb-1 text-xs text-slate-500">Kopija po kartici</div>
                  <InputNumber
                    min={1}
                    max={10}
                    value={copies}
                    onChange={(v) => setPersisted((p) => ({ ...p, copies: typeof v === 'number' ? v : 1 }))}
                    className="w-full"
                  />
                </div>
                <div className="flex-1">
                  <div className="mb-1 text-xs text-slate-500">Početna pozicija na 1. listu</div>
                  <InputNumber
                    min={1}
                    max={perSheet}
                    value={startOffset + 1}
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
                    Dio etiketa na papiru već potrošen? <strong>Kliknite na prvu slobodnu etiketu</strong>{' '}
                    na prikazu prvog lista — korisno i za nastavak printa nakon zastoja printera.
                  </span>
                }
              />
            </div>
          </Card>

          {/* sadržaj etikete */}
          <Card size="small" title="3. Sadržaj etikete" className="shadow-sm">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <Checkbox checked disabled>
                  ICCID
                </Checkbox>
                <Checkbox
                  checked={persisted.showIp}
                  onChange={(e) => setPersisted((p) => ({ ...p, showIp: e.target.checked }))}
                >
                  Interna (epbih) IP
                </Checkbox>
                <Checkbox
                  checked={persisted.showPublicIp}
                  onChange={(e) => setPersisted((p) => ({ ...p, showPublicIp: e.target.checked }))}
                >
                  Javna IP
                </Checkbox>
                <Checkbox
                  checked={persisted.showReceivedDate}
                  onChange={(e) => setPersisted((p) => ({ ...p, showReceivedDate: e.target.checked }))}
                >
                  Datum prijema
                </Checkbox>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Prikaz ICCID-a:</span>
                <Segmented
                  size="small"
                  value={persisted.iccidGrouping}
                  onChange={(v) =>
                    setPersisted((p) => ({ ...p, iccidGrouping: v as PersistedPrintSettings['iccidGrouping'] }))
                  }
                  options={[
                    { label: 'Bez razmaka', value: 'plain' },
                    { label: 'Grupe od 4', value: 'group4' },
                  ]}
                />
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>Veličina fonta (uklapa se i u širinu i u visinu)</span>
                  <span>{persisted.fontScale}%</span>
                </div>
                <Slider
                  min={70}
                  max={130}
                  value={persisted.fontScale}
                  onChange={(v) => setPersisted((p) => ({ ...p, fontScale: Array.isArray(v) ? v[0]! : v }))}
                />
              </div>

              {/* živi primjer etikete */}
              <div className="rounded-md bg-slate-50 p-3">
                <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">Pregled etikete</div>
                <div className="flex justify-center overflow-hidden">
                  <div
                    className="relative rounded-[3px] bg-white shadow ring-1 ring-slate-300"
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
          </Card>

          {/* napredna geometrija */}
          <Card size="small" className="shadow-sm">
            <Collapse
              ghost
              items={[
                {
                  key: 'advanced',
                  label: <span className="text-sm font-medium">Napredna podešavanja papira (kalibracija)</span>,
                  children: (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <LabeledNumber label="Širina etikete (mm)" value={layout.labelWidthMm} step={0.1} min={10} max={A4_WIDTH_MM} onChange={(v) => updateLayout({ labelWidthMm: v })} />
                        <LabeledNumber label="Visina etikete (mm)" value={layout.labelHeightMm} step={0.1} min={5} max={80} onChange={(v) => updateLayout({ labelHeightMm: v })} />
                        <LabeledNumber label="Kolona" value={layout.columns} step={1} min={1} max={12} precision={0} onChange={(v) => updateLayout({ columns: Math.round(v) })} />
                        <LabeledNumber label="Redova" value={layout.rows} step={1} min={1} max={60} precision={0} onChange={(v) => updateLayout({ rows: Math.round(v) })} />
                        <LabeledNumber label="Margina lijevo (mm)" value={layout.marginLeftMm} step={0.1} min={0} max={100} onChange={(v) => updateLayout({ marginLeftMm: v })} />
                        <LabeledNumber label="Margina gore (mm)" value={layout.marginTopMm} step={0.1} min={0} max={200} onChange={(v) => updateLayout({ marginTopMm: v })} />
                        <LabeledNumber label="Razmak X (mm)" value={layout.gapXMm} step={0.1} min={0} max={30} onChange={(v) => updateLayout({ gapXMm: v })} />
                        <LabeledNumber label="Razmak Y (mm)" value={layout.gapYMm} step={0.1} min={0} max={30} onChange={(v) => updateLayout({ gapYMm: v })} />
                      </div>

                      <div className={`rounded-md p-2 text-xs ${overflowed ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {overflowed ? (
                          <>
                            Geometrija <strong>ne staje na A4</strong>: desna margina {formatMm(rightMarginMm(layout))} mm,
                            donja {formatMm(bottomMarginMm(layout))} mm. Smanjite dimenzije/margine ili ukloni kolone/redove.
                          </>
                        ) : (
                          <>
                            Desna margina: <strong>{formatMm(rightMarginMm(layout))} mm</strong> · Donja margina:{' '}
                            <strong>{formatMm(bottomMarginMm(layout))} mm</strong> — geometrija staje na A4.
                          </>
                        )}
                      </div>

                      <Space wrap>
                        <Button size="small" icon={<CompressOutlined />} onClick={() => updateLayout(centeredLayout(layout))}>
                          Centriraj na papir
                        </Button>
                        <Button size="small" icon={<ReloadOutlined />} onClick={resetLayout}>
                          Vrati fabričke ({presetById(formatId).name})
                        </Button>
                      </Space>

                      <div className="text-xs text-slate-500">
                        Postavke geometrije se pamte lokalno, posebno za svaki format — jednom kalibriran papir ostaje
                        kalibriran.
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </Card>

          {/* priprema i print */}
          <Card size="small" title="4. Printanje" className="shadow-sm">
            <div className="space-y-3">
              <Checkbox
                checked={persisted.showOutlines}
                onChange={(e) => setPersisted((p) => ({ ...p, showOutlines: e.target.checked }))}
              >
                Iscrtaj okvire etiketa (kalibracija — isključiti za finalni print)
              </Checkbox>
              <Checkbox checked={testSheetOnly} onChange={(e) => setTestSheetOnly(e.target.checked)}>
                Samo prvi list (probni print)
              </Checkbox>

              <div className="grid grid-cols-2 gap-2">
                <StatBox label="Kartica u obuhvatu" value={cardsInRange.length} />
                <StatBox label="Etiketa za print" value={totalLabels} />
                <StatBox label="Listova A4" value={printSheets.length} suffix={testSheetOnly ? `/ ${sheets.length}` : undefined} />
                <StatBox label="Početak na etiketi" value={`#${startOffset + 1}`} />
              </div>

              <Button
                type="primary"
                size="large"
                block
                icon={<PrinterOutlined />}
                disabled={!canPrint}
                onClick={() => setPrintModalOpen(true)}
              >
                {testSheetOnly ? 'Odštampaj probni list' : `Odštampaj ${printSheets.length} list(ov)a`}
              </Button>
            </div>
          </Card>
        </div>

        {/* -------------------------------- desni pregled ------------------------------- */}
        <div ref={previewContainerRef} className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-white/70 px-3 py-2 shadow-sm ring-1 ring-slate-200">
            <Segmented
              size="small"
              value={zoomMode}
              onChange={(v) => setZoomMode(v as 'fit' | 'full')}
              options={[
                { label: 'Uklopi u širinu', value: 'fit' },
                { label: '100%', value: 'full' },
              ]}
            />
            <Tag color="default" className="ms-auto">
              {sheets.length} list(ov)a A4 · {totalLabels} etiketa · {perSheet}/list
            </Tag>
          </div>

          {/* vidljivo upozorenje o aktivnoj početnoj poziciji (izbjegava zabunu 79/80) */}
          {!loading && startOffset > 0 ? (
            <Alert
              className="mb-3"
              type="warning"
              showIcon
              closable
              onClose={() => setStartOffset(0)}
              message={
                <span className="text-sm">
                  Print počinje od etikete <strong>#{startOffset + 1}</strong> na prvom listu
                  ({startOffset} {startOffset === 1 ? 'označena' : 'označenih'} kao iskorištene).{' '}
                  <Button size="small" type="link" className="!p-0" onClick={() => setStartOffset(0)}>
                    Poništi — kreni od etikete #1
                  </Button>
                </span>
              }
            />
          ) : null}

          {loading ? (
            <Card className="flex min-h-[400px] items-center justify-center shadow-sm">
              <div className="flex flex-col items-center gap-4 py-16">
                <Spin size="large" />
                <div className="w-72">
                  <div className="mb-1 text-center text-sm text-slate-600">
                    Učitavam kartice isporuke…{' '}
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
            <Card className="shadow-sm">
              <Empty
                description={
                  totalCards === 0
                    ? 'Ova isporuka nema uvezenih SIM kartica — nema šta printati.'
                    : 'Odabrani opseg ne sadrži nijednu karticu.'
                }
              />
            </Card>
          ) : (
            <div className="space-y-8 pb-16">
              {sheets.map((cells, i) => (
                <LabelSheetPreview
                  key={i}
                  cells={cells}
                  layout={layout}
                  scale={scale}
                  sheetNumber={i + 1}
                  totalSheets={sheets.length}
                  interactive={i === 0}
                  showGuides
                  makeLines={makeLines}
                  lineGapMm={LABEL_LINE_GAP_MM}
                  onPickStart={(cellIndex) => setStartOffset(cellIndex)}
                />
              ))}
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
        title="Kontrolna lista prije printanja"
        open={printModalOpen}
        okText="Otvori print dijalog"
        cancelText="Odustani"
        onOk={openPrintDialog}
        onCancel={() => setPrintModalOpen(false)}
      >
        <div className="space-y-2 text-sm">
          <p className="text-slate-600">
            Etikete se printaju u stvarnoj veličini (mm). U dijalogu za print obavezno:
          </p>
          <ul className="list-disc space-y-1 ps-5">
            <li>
              Margine: <strong>Bez (None)</strong> — margine su već ugrađene u geometriju papira
            </li>
            <li>
              Razmjer: <strong>100 %</strong> (isključiti „Prilagodi stranici“ / „Fit to page“)
            </li>
            <li>
              Orijentacija: <strong>Portret</strong>, papir A4
            </li>
            <li>Isključiti zaglavlja i podnožja (headers/footers)</li>
            <li>
              Prvi put: odštampati <strong>probni list na običnom papiru</strong>, preklopiti preko etiketnog papira
              prema svjetlu i po potrebi kalibrirati margine/razmake.
            </li>
          </ul>
          <Alert
            type="warning"
            showIcon
            message="Provjerite da je u printer ubacen ispravan etiketni papir za odabrani format."
          />
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------ pomoćne komponente ------------------------------ */

function StatBox(props: { label: string; value: number | string; suffix?: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{props.label}</div>
      <div className="text-lg font-semibold text-slate-800">
        {typeof props.value === 'number' ? props.value.toLocaleString('bs-BA') : props.value}
        {props.suffix ? <span className="text-xs font-normal text-slate-400"> {props.suffix}</span> : null}
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
      <div className="mb-1 text-[11px] text-slate-500">{props.label}</div>
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

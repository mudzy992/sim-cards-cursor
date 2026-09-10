import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Input, Modal, Typography, message } from 'antd';
import { DeleteOutlined, ExclamationCircleFilled } from '@ant-design/icons';
import { shipmentsApi } from '@/api/shipments.api';
import { useTranslation } from '@/i18n';

/**
 * Brisanje isporuke — reusable dugme + potvrdni dijalog.
 *
 * Pravila (usklađena sa backendom):
 *  - PRAZNA isporuka (0 kartica): SYSTEM_ADMIN i DIST_ADMIN — jednostavna potvrda
 *  - KOMPLETNA isporuka (sa karticama): samo SYSTEM_ADMIN — potvrda tipkanjem
 *    riječi za potvrdu; backend dodatno odbija ako su kartice u upotrebi
 *    (dodijeljene/ugrađene, povezane na brojila ili sa evidencijama ugradnje).
 *
 * Upotreba (lista i/ili detalji isporuke):
 *   <ShipmentDeleteButton
 *     shipment={{ id: row.id, name: row.name, simCardsCount: row._count?.simCards ?? 0 }}
 *     role={currentUserRole}
 *   />
 */

export type ShipmentDeleteResult = {
  deleted: boolean;
  deletedSimCards: number;
  deletedSimEvents: number;
};

export interface ShipmentDeleteButtonProps {
  shipment: { id: string; name: string; simCardsCount: number };
  /** uloga prijavljenog korisnika ('SYSTEM_ADMIN' | 'DIST_ADMIN' | 'USER' | …) */
  role?: string;
  size?: 'small' | 'middle' | 'large';
  /** opcioni tekst na dugmetu (default prevedeno "Obriši") */
  label?: string;
  onDeleted?: (result: ShipmentDeleteResult, shipmentId: string) => void;
}

export function ShipmentDeleteButton(props: ShipmentDeleteButtonProps) {
  const { t } = useTranslation();
  const { shipment, role, size = 'small', label = t('common.actions.delete'), onDeleted } = props;
  const CONFIRM_WORD = t('shipments.deleteButton.confirmWord');

  const isSystemAdmin = role === 'SYSTEM_ADMIN';
  const isDistAdmin = role === 'DIST_ADMIN';
  const hasCards = shipment.simCardsCount > 0;
  const canDelete = isSystemAdmin || (isDistAdmin && !hasCards);

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => shipmentsApi.remove(shipment.id),
    onSuccess: async (result) => {
      messageApi.success(
        result.deletedSimCards > 0
          ? t('shipments.deleteButton.successWithCards', { count: result.deletedSimCards })
          : t('shipments.deleteButton.success'),
      );
      setOpen(false);
      setConfirmText('');
      await queryClient.invalidateQueries({ queryKey: ['shipments'] });
      await queryClient.invalidateQueries({ queryKey: ['sim-cards'] });
      onDeleted?.(result, shipment.id);
    },
    onError: (e: unknown) => {
      const serverMessage = (e as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message;
      const text = Array.isArray(serverMessage) ? serverMessage.join(' ') : serverMessage;
      messageApi.error(typeof text === 'string' && text ? text : t('shipments.deleteButton.failed'));
    },
  });

  if (!canDelete) return null;

  const confirmed = !hasCards || confirmText.trim().toUpperCase() === CONFIRM_WORD;

  return (
    <>
      {contextHolder}
      <Button size={size} danger icon={<DeleteOutlined />} onClick={() => setOpen(true)}>
        {label}
      </Button>

      <Modal
        open={open}
        title={hasCards ? t('shipments.deleteButton.titleFull') : t('shipments.deleteButton.title')}
        okText={hasCards ? t('shipments.deleteButton.okTextFull') : t('common.actions.delete')}
        okButtonProps={{
          danger: true,
          disabled: !confirmed,
          loading: deleteMutation.isPending,
        }}
        cancelText={t('common.actions.cancel')}
        onOk={() => {
          if (confirmed) deleteMutation.mutate();
        }}
        onCancel={() => {
          setOpen(false);
          setConfirmText('');
        }}
      >
        {hasCards ? (
          <div className="space-y-3">
            <Alert
              type="error"
              showIcon
              icon={<ExclamationCircleFilled />}
              message={t('shipments.deleteButton.irreversible')}
              description={
                <>
                  {t('shipments.deleteButton.willDeleteIntro')}{' '}
                  <strong>{shipment.name}</strong>{' '}
                  {t('shipments.deleteButton.andAllCards', { count: shipment.simCardsCount })}{' '}
                  {t('shipments.deleteButton.rejectHint')}
                </>
              }
            />
            <div>
              <Typography.Text className="text-xs text-slate-500">
                {t('shipments.deleteButton.typeToConfirm')}{' '}
                <Typography.Text code strong>
                  {CONFIRM_WORD}
                </Typography.Text>
              </Typography.Text>
              <Input
                className="mt-1"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                autoComplete="off"
                onPressEnter={() => {
                  if (confirmed) deleteMutation.mutate();
                }}
              />
            </div>
          </div>
        ) : (
          <Typography.Text>
            {t('shipments.deleteButton.emptyConfirmIntro')} <strong>{shipment.name}</strong>{' '}
            {t('shipments.deleteButton.emptyConfirmOutro')}
          </Typography.Text>
        )}
      </Modal>
    </>
  );
}

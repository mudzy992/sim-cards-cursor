export type UserRole = 'SYSTEM_ADMIN' | 'DIST_ADMIN' | 'USER';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type SimCardStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'INSTALLED'
  | 'DEMOUNTED'
  | 'DEFECTIVE'
  | 'RETURNED'
  | 'DEACTIVATED';

export type MeterSimCardState = 'INSTALLED' | 'NO_SIM';

export type MeterStatus = 'ACTIVE' | 'DEFECTIVE' | 'IN_CALIBRATION' | 'INACTIVE';

export type MeterType = 'SINGLE_PHASE' | 'THREE_PHASE';

export type RecordStatus =
  | 'DRAFT'
  | 'SENT'
  | 'SEND_FAILED'
  | 'SEP_ACTIVATED'
  | 'LEGACY_COMPLETED';

export type InstallationRecordKind = 'NEW_CONNECTION' | 'METER_REPLACEMENT';

export type ShipmentStatus = 'RECEIVED' | 'PROCESSING' | 'COMPLETED';

export type InstallTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type DemountTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type DemountTaskType = 'DEMOUNT_METER' | 'DEMOUNT_SIM';

export type DemountCompletionResolution =
  | 'FULL_DEMOUNT'
  | 'REPLACE_SIM'
  | 'REMOVE_SIM_ONLY';

export type RemovedSimDisposition = 'MARK_DEFECTIVE' | 'RETURN_TO_STOCK';

export type MeterDemountCategory =
  | 'METER_FAULTY'
  | 'TEMPORARY_REMOVAL'
  | 'MAINTENANCE'
  | 'OTHER';

export type PushCampaignAudienceType = 'ALL' | 'FILTER' | 'USER';

export type PushCampaignStatus = 'DRAFT' | 'SENDING' | 'SENT' | 'PARTIAL' | 'FAILED';

export type PushDeliveryStatus =
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'INVALID_TOKEN';

export type MeterFieldType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE';

export type MobileAppPlatform = 'ANDROID';

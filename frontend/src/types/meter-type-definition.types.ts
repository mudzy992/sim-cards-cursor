export type MeterType = 'SINGLE_PHASE' | 'THREE_PHASE';

export type MeterTypeDefinitionItem = {
  id: string;
  name: string;
  manufacturer?: string | null;
  model?: string | null;
  type: MeterType;
  maxCurrent?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateMeterTypeDefinitionInput = {
  name: string;
  manufacturer?: string;
  model?: string;
  type?: MeterType;
  maxCurrent?: string;
  notes?: string;
};

export type UpdateMeterTypeDefinitionInput = Partial<CreateMeterTypeDefinitionInput>;

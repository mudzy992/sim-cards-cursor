export type MeterFieldType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE'

export type MeterTypeFieldItem = {
  id: string
  meterTypeDefinitionId: string
  name: string
  label: string
  fieldType: MeterFieldType
  isRequired: boolean
  isOperatorFillable: boolean
  defaultValue?: string | null
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export type CreateMeterTypeFieldInput = {
  name: string
  label: string
  fieldType: MeterFieldType
  isRequired?: boolean
  isOperatorFillable?: boolean
  defaultValue?: string
  sortOrder?: number
}

export type UpdateMeterTypeFieldInput = Partial<CreateMeterTypeFieldInput>

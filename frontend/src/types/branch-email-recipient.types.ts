export type BranchEmailRecipientItem = {
  id: string
  branchId: string
  email: string
  label?: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string
  branch?: {
    id: string
    name: string
    code: string
    distributionId?: string
  }
}

export type CreateBranchEmailRecipientInput = {
  branchId: string
  email: string
  label?: string
}

export type UpdateBranchEmailRecipientInput = Partial<{
  email: string
  label: string
  isActive: boolean
}>

export type BranchModeratorItem = {
  id: string
  userId: string
  branchId: string
  createdAt?: string
  user?: {
    id: string
    email: string
    firstName: string
    lastName: string
  }
  branch?: {
    id: string
    name: string
    code: string
    distributionId?: string
  }
}

export type AssignBranchModeratorInput = {
  userId: string
  branchId: string
}

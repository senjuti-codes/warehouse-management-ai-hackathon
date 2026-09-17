export type DispatchStatus = "At risk" | "In transit" | "On schedule" | "Delayed" | "Ready"
export type DispatchRisk = "Critical" | "High" | "Medium" | "Low"

export type DispatchRecord = {
  delivery: string
  material: string
  materialName: string
  warehouse: string
  quantity: string
  eta: string
  status: DispatchStatus
  risk: DispatchRisk
}

export type InventoryRisk = "Critical" | "High" | "Low"

export type MaterialRisk = {
  material: string
  name: string
  warehouse: string
  available: number
  required: number
  shortfall: number
  risk: InventoryRisk
}

export type WarehouseHealth = {
  id: string
  city: string
  stockHealth: number
  capacity: number
  status: "Healthy" | "At risk"
}

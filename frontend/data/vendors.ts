export type VendorStatus = "Healthy" | "At risk" | "Blocked"
export type VendorRisk = "Low" | "Medium" | "High" | "Critical"

export type VendorRecord = {
  id: string
  name: string
  region: string
  category: string
  openOrders: number
  onTimeRate: number
  leadTime: string
  status: VendorStatus
  risk: VendorRisk
  spend: string
  nextDelivery: string
}

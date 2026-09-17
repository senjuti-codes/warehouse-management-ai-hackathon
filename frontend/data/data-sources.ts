export type DataSourceStatus = "Healthy" | "Warning";

export type DataSourceRecord = {
  name: string;
  type: string;
  records: string;
  lastSync: string;
  status: DataSourceStatus;
  coverage: string;
};

export const dataSources: DataSourceRecord[] = [
  {
    name: "Inventory_Stock",
    type: "Warehouse inventory",
    records: "18,420",
    lastSync: "2 min ago",
    status: "Healthy",
    coverage: "100%",
  },
  {
    name: "Deliveries_Dispatch",
    type: "Outbound logistics",
    records: "8,615",
    lastSync: "4 min ago",
    status: "Healthy",
    coverage: "98.6%",
  },
  {
    name: "Material_Master",
    type: "Master data",
    records: "6,280",
    lastSync: "9 min ago",
    status: "Warning",
    coverage: "96.2%",
  },
  {
    name: "Vendor_Master",
    type: "Procurement master",
    records: "1,124",
    lastSync: "12 min ago",
    status: "Warning",
    coverage: "94.8%",
  },
  {
    name: "Warehouse_Bin",
    type: "Storage capacity",
    records: "9,842",
    lastSync: "3 min ago",
    status: "Healthy",
    coverage: "99.4%",
  },
  {
    name: "Purchase_Replenishment",
    type: "Purchase orders",
    records: "4,010",
    lastSync: "6 min ago",
    status: "Healthy",
    coverage: "97.9%",
  },
];

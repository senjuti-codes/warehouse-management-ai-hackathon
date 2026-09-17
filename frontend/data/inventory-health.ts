export type InventoryRisk = "Critical" | "High" | "Low";

export type MaterialRisk = {
  material: string;
  name: string;
  warehouse: string;
  available: number;
  required: number;
  shortfall: number;
  risk: InventoryRisk;
};

export type WarehouseHealth = {
  id: string;
  city: string;
  stockHealth: number;
  capacity: number;
  status: "Healthy" | "At risk";
};

export const warehouseHealth: WarehouseHealth[] = [
  {
    id: "WH-01",
    city: "Berlin",
    stockHealth: 94,
    capacity: 72,
    status: "Healthy",
  },
  {
    id: "WH-02",
    city: "Prague",
    stockHealth: 88,
    capacity: 81,
    status: "Healthy",
  },
  {
    id: "WH-03",
    city: "Wolfsburg",
    stockHealth: 76,
    capacity: 93,
    status: "At risk",
  },
  {
    id: "WH-04",
    city: "Bratislava",
    stockHealth: 91,
    capacity: 68,
    status: "Healthy",
  },
];

export const materialRisks: MaterialRisk[] = [
  {
    material: "M-8821",
    name: "Brake carrier",
    warehouse: "WH-03",
    available: 180,
    required: 240,
    shortfall: -60,
    risk: "Critical",
  },
  {
    material: "M-4420",
    name: "Gear housing",
    warehouse: "WH-01",
    available: 120,
    required: 120,
    shortfall: 0,
    risk: "Low",
  },
  {
    material: "M-7812",
    name: "Housing",
    warehouse: "WH-02",
    available: 80,
    required: 95,
    shortfall: -15,
    risk: "High",
  },
  {
    material: "M-2291",
    name: "Seal kit",
    warehouse: "WH-03",
    available: 300,
    required: 360,
    shortfall: -60,
    risk: "High",
  },
  {
    material: "M-5510",
    name: "Fastener",
    warehouse: "WH-04",
    available: 450,
    required: 400,
    shortfall: 50,
    risk: "Low",
  },
];

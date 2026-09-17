export type DispatchStatus =
  "At risk" | "In transit" | "On schedule" | "Delayed" | "Ready";
export type DispatchRisk = "Critical" | "High" | "Medium" | "Low";

export type DispatchRecord = {
  delivery: string;
  material: string;
  materialName: string;
  warehouse: string;
  quantity: string;
  eta: string;
  status: DispatchStatus;
  risk: DispatchRisk;
};

export const dispatchRecords: DispatchRecord[] = [
  {
    delivery: "D-10744",
    material: "M-8821",
    materialName: "Brake carrier",
    warehouse: "WH-03",
    quantity: "240 EA",
    eta: "Today 16:40",
    status: "At risk",
    risk: "Critical",
  },
  {
    delivery: "D-10821",
    material: "M-4420",
    materialName: "Gear housing",
    warehouse: "WH-01",
    quantity: "120 EA",
    eta: "Today 17:20",
    status: "In transit",
    risk: "Medium",
  },
  {
    delivery: "D-10835",
    material: "M-7812",
    materialName: "Housing",
    warehouse: "WH-02",
    quantity: "80 EA",
    eta: "Today 18:10",
    status: "On schedule",
    risk: "Low",
  },
  {
    delivery: "D-10842",
    material: "M-2291",
    materialName: "Seal kit",
    warehouse: "WH-03",
    quantity: "300 EA",
    eta: "Today 19:00",
    status: "Delayed",
    risk: "High",
  },
  {
    delivery: "D-10851",
    material: "M-5510",
    materialName: "Fastener",
    warehouse: "WH-04",
    quantity: "450 EA",
    eta: "Today 20:30",
    status: "Ready",
    risk: "Low",
  },
];

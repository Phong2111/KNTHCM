export interface Equipment {
  id: string;
  name: string;
  stock: number;
}

export interface Transaction {
  id: string;
  equipmentId: string;
  type: "IMPORT" | "EXPORT";
  quantity: number;
  timestamp: string;
}

export interface FailedTransaction {
  transactionId: string;
  reason: string;
}

export interface InventoryResult {
  inventory: Equipment[];
  successfulTransactions: string[];
  failedTransactions: FailedTransaction[];
}

export const initialInventory: Equipment[] = [
  { id: "LAPTOP", name: "Laptop", stock: 10 },
  { id: "MONITOR", name: "Monitor", stock: 15 },
  { id: "KEYBOARD", name: "Keyboard", stock: 20 },
];

export const sampleTransactions: Transaction[] = [
  {
    id: "T001",
    equipmentId: "LAPTOP",
    type: "EXPORT",
    quantity: 3,
    timestamp: "2026-11-01T09:00:00",
  },
  {
    id: "T002",
    equipmentId: "MONITOR",
    type: "IMPORT",
    quantity: 5,
    timestamp: "2026-11-01T10:00:00",
  },
  {
    id: "T003",
    equipmentId: "LAPTOP",
    type: "EXPORT",
    quantity: 10,
    timestamp: "2026-11-01T11:00:00",
  },
  {
    id: "T004",
    equipmentId: "KEYBOARD",
    type: "EXPORT",
    quantity: 5,
    timestamp: "2026-11-01T12:00:00",
  },
  {
    id: "T005",
    equipmentId: "UNKNOWN",
    type: "IMPORT",
    quantity: 5,
    timestamp: "2026-11-01T13:00:00",
  },
];


export const sampleTransactions: Transaction[] = [
  {
    id: "T001",
    equipmentId: "LAPTOP",
    type: "EXPORT",
    quantity: 3,
    timestamp: "2026-11-01T09:00:00",
  },
  {
    id: "T002",
    equipmentId: "MONITOR",
    type: "IMPORT",
    quantity: 5,
    timestamp: "2026-11-01T10:00:00",
  },
  {
    id: "T003",
    equipmentId: "LAPTOP",
    type: "EXPORT",
    quantity: 10,
    timestamp: "2026-11-01T11:00:00",
  },
  {
    id: "T004",
    equipmentId: "KEYBOARD",
    type: "EXPORT",
    quantity: 5,
    timestamp: "2026-11-01T12:00:00",
  },
  {
    id: "T005",
    equipmentId: "UNKNOWN",
    type: "IMPORT",
    quantity: 5,
    timestamp: "2026-11-01T13:00:00",
  },
];
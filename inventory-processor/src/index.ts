import {
  initialInventory,
  sampleTransactions,
} from "./types/inventory.types.ts";
import { processTransactions } from "./inventory.processor.ts";

console.log("=== HỆ THỐNG QUẢN LÝ KHO THIẾT BỊ ===");
console.log("\n--- Dữ liệu ban đầu ---");
console.log("Tồn kho ban đầu:", JSON.stringify(initialInventory, null, 2));
console.log("\nDanh sách giao dịch:", JSON.stringify(sampleTransactions, null, 2));

console.log("\n--- Tiến hành xử lý giao dịch ---");
const result = processTransactions(initialInventory, sampleTransactions);

console.log("\n--- Kết quả xử lý ---");
console.log("Tồn kho sau khi xử lý:", JSON.stringify(result.inventory, null, 2));
console.log("\nGiao dịch thành công:", result.successfulTransactions);
console.log("\nGiao dịch thất bại:", JSON.stringify(result.failedTransactions, null, 2));

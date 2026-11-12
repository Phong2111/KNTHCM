import type {
  Equipment,
  Transaction,
  InventoryResult,
  FailedTransaction,
} from "./types/inventory.types.ts";

interface IndexedTransaction {
  tx: Transaction;
  originalIndex: number;
  time: number;
  isValidTime: boolean;
}

/**
 * Xử lý các giao dịch nhập và xuất kho theo quy tắc nghiệp vụ:
 * 1. Giao dịch được xử lý theo thứ tự thời gian tăng dần, không phụ thuộc thứ tự đầu vào.
 * 2. Không cho phép xuất kho khi tồn kho không đủ (tránh stock âm).
 * 3. quantity phải là số nguyên dương (> 0).
 * 4. Không cho phép giao dịch tham chiếu thiết bị không tồn tại.
 * 5. Không xử lý giao dịch trùng id (idempotency: giao dịch đầu tiên theo thời gian được xử lý, giao dịch trùng lặp tiếp theo sẽ thất bại).
 * 6. Một giao dịch thất bại không được làm ảnh hưởng đến các giao dịch hợp lệ khác.
 * 7. Kết quả phải thể hiện đầy đủ giao dịch thành công và thất bại.
 *
 * Hàm là pure function: không làm thay đổi (mutate) mảng initialInventory truyền vào.
 */
export function processTransactions(
  initialInventory: Equipment[],
  transactions: Transaction[]
): InventoryResult {
  // 1. Tạo bản sao độc lập của kho hàng vào Map để tra cứu O(1) và tránh mutate input
  const inventoryMap = new Map<string, Equipment>();
  for (const item of initialInventory) {
    inventoryMap.set(item.id, { ...item });
  }

  // 2. Chuẩn bị danh sách giao dịch kèm thông tin thời gian và vị trí gốc
  const indexedTransactions: IndexedTransaction[] = transactions.map((tx, originalIndex) => {
    const time = Date.parse(tx.timestamp);
    const isValidTime = !Number.isNaN(time);
    return {
      tx,
      originalIndex,
      time,
      isValidTime,
    };
  });

  // 3. Sắp xếp các giao dịch theo thứ tự thời gian tăng dần (Rule 1).
  // - Nếu cùng timestamp: giữ nguyên thứ tự xuất hiện ban đầu (stable sort bằng originalIndex).
  // - Nếu timestamp không hợp lệ: đẩy về sau để ghi nhận lỗi mà không làm sai lệch thứ tự các giao dịch hợp lệ.
  indexedTransactions.sort((a, b) => {
    if (!a.isValidTime && !b.isValidTime) {
      return a.originalIndex - b.originalIndex;
    }
    if (!a.isValidTime) return 1;
    if (!b.isValidTime) return -1;

    if (a.time !== b.time) {
      return a.time - b.time;
    }
    return a.originalIndex - b.originalIndex;
  });

  const successfulTransactions: string[] = [];
  const failedTransactions: FailedTransaction[] = [];
  const seenTransactionIds = new Set<string>();

  // 4. Duyệt và xử lý từng giao dịch
  for (const item of indexedTransactions) {
    const { tx, isValidTime } = item;

    // Rule 5: Không xử lý giao dịch trùng id
    if (seenTransactionIds.has(tx.id)) {
      failedTransactions.push({
        transactionId: tx.id,
        reason: `Duplicate transaction ID: '${tx.id}'`,
      });
      continue;
    }
    seenTransactionIds.add(tx.id);

    // Kiểm tra tính hợp lệ của timestamp
    if (!isValidTime) {
      failedTransactions.push({
        transactionId: tx.id,
        reason: `Invalid timestamp: '${tx.timestamp}'`,
      });
      continue;
    }

    // Rule 3: quantity phải là số nguyên dương
    if (
      typeof tx.quantity !== "number" ||
      !Number.isInteger(tx.quantity) ||
      tx.quantity <= 0
    ) {
      failedTransactions.push({
        transactionId: tx.id,
        reason: `Invalid quantity: ${tx.quantity}. Quantity must be a positive integer`,
      });
      continue;
    }

    // Rule 4: Không cho phép giao dịch tham chiếu thiết bị không tồn tại
    const equipment = inventoryMap.get(tx.equipmentId);
    if (!equipment) {
      failedTransactions.push({
        transactionId: tx.id,
        reason: `Equipment not found: '${tx.equipmentId}'`,
      });
      continue;
    }

    // Xử lý loại giao dịch IMPORT / EXPORT
    if (tx.type === "EXPORT") {
      // Rule 2: Không cho phép xuất kho khi tồn kho không đủ (tránh stock âm)
      if (equipment.stock < tx.quantity) {
        failedTransactions.push({
          transactionId: tx.id,
          reason: `Insufficient stock for equipment '${tx.equipmentId}'. Available: ${equipment.stock}, requested: ${tx.quantity}`,
        });
        continue;
      }
      equipment.stock -= tx.quantity;
      successfulTransactions.push(tx.id);
    } else if (tx.type === "IMPORT") {
      equipment.stock += tx.quantity;
      successfulTransactions.push(tx.id);
    } else {
      failedTransactions.push({
        transactionId: tx.id,
        reason: `Invalid transaction type: '${(tx as any).type}'. Allowed types are 'IMPORT' or 'EXPORT'`,
      });
    }
  }

  return {
    inventory: Array.from(inventoryMap.values()),
    successfulTransactions,
    failedTransactions,
  };
}

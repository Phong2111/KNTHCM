import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { processTransactions } from "../src/inventory.processor.ts";
import type { Equipment, Transaction } from "../src/types/inventory.types.ts";

describe("Inventory Processor - processTransactions", () => {
    const getBaseInventory = (): Equipment[] => [
        { id: "LAPTOP", name: "Laptop", stock: 10 },
        { id: "MONITOR", name: "Monitor", stock: 15 },
        { id: "KEYBOARD", name: "Keyboard", stock: 20 },
    ];

    it("Sample Case: Xử lý chính xác bộ dữ liệu mẫu trong đề bài", () => {
        const inventory = getBaseInventory();
        const transactions: Transaction[] = [
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

        const result = processTransactions(inventory, transactions);

        // Tồn kho cuối cùng
        assert.deepEqual(result.inventory, [
            { id: "LAPTOP", name: "Laptop", stock: 7 },
            { id: "MONITOR", name: "Monitor", stock: 20 },
            { id: "KEYBOARD", name: "Keyboard", stock: 15 },
        ]);

        // Giao dịch thành công
        assert.deepEqual(result.successfulTransactions, ["T001", "T002", "T004"]);

        // Giao dịch thất bại
        assert.equal(result.failedTransactions.length, 2);
        assert.equal(result.failedTransactions[0].transactionId, "T003");
        assert.match(result.failedTransactions[0].reason, /Insufficient stock/i);
        assert.equal(result.failedTransactions[1].transactionId, "T005");
        assert.match(result.failedTransactions[1].reason, /Equipment not found/i);
    });

    it("Rule 1: Giao dịch được xử lý theo thứ tự thời gian tăng dần, không phụ thuộc thứ tự đầu vào", () => {
        const inventory: Equipment[] = [
            { id: "PHONE", name: "Smartphone", stock: 5 },
        ];

        // Giao dịch EXPORT 10 diễn ra LÚC 10:00, nhưng trước đó LÚC 09:00 có IMPORT 10
        // Trong mảng đầu vào, EXPORT đặt trước IMPORT.
        // Nếu xử lý theo thời gian (09:00 trước), stock từ 5 -> 15 -> export 10 -> còn 5 (Thành công cả hai).
        // Nếu xử lý theo thứ tự mảng, EXPORT 10 sẽ fail vì stock lúc đầu chỉ có 5.
        const transactions: Transaction[] = [
            {
                id: "TX_EXPORT",
                equipmentId: "PHONE",
                type: "EXPORT",
                quantity: 10,
                timestamp: "2026-11-01T10:00:00",
            },
            {
                id: "TX_IMPORT",
                equipmentId: "PHONE",
                type: "IMPORT",
                quantity: 10,
                timestamp: "2026-11-01T09:00:00",
            },
        ];

        const result = processTransactions(inventory, transactions);

        assert.deepEqual(result.successfulTransactions, ["TX_IMPORT", "TX_EXPORT"]);
        assert.equal(result.failedTransactions.length, 0);
        assert.equal(result.inventory[0].stock, 5);
    });

    it("Rule 2: Không cho phép xuất kho khi tồn kho không đủ (tránh stock âm)", () => {
        const inventory: Equipment[] = [
            { id: "LAPTOP", name: "Laptop", stock: 2 },
        ];
        const transactions: Transaction[] = [
            {
                id: "T1",
                equipmentId: "LAPTOP",
                type: "EXPORT",
                quantity: 5,
                timestamp: "2026-11-01T09:00:00",
            },
        ];

        const result = processTransactions(inventory, transactions);

        assert.equal(result.successfulTransactions.length, 0);
        assert.equal(result.failedTransactions.length, 1);
        assert.equal(result.failedTransactions[0].transactionId, "T1");
        assert.match(result.failedTransactions[0].reason, /Insufficient stock/i);
        // Tồn kho không bị trừ âm
        assert.equal(result.inventory[0].stock, 2);
    });

    it("Rule 3: quantity phải là số nguyên dương (từ chối 0, số âm, số thập phân)", () => {
        const inventory: Equipment[] = [
            { id: "LAPTOP", name: "Laptop", stock: 10 },
        ];
        const transactions: Transaction[] = [
            {
                id: "T_ZERO",
                equipmentId: "LAPTOP",
                type: "IMPORT",
                quantity: 0,
                timestamp: "2026-11-01T09:00:00",
            },
            {
                id: "T_NEG",
                equipmentId: "LAPTOP",
                type: "EXPORT",
                quantity: -5,
                timestamp: "2026-11-01T10:00:00",
            },
            {
                id: "T_FLOAT",
                equipmentId: "LAPTOP",
                type: "IMPORT",
                quantity: 2.5,
                timestamp: "2026-11-01T11:00:00",
            },
        ];

        const result = processTransactions(inventory, transactions);

        assert.equal(result.successfulTransactions.length, 0);
        assert.equal(result.failedTransactions.length, 3);
        assert.match(result.failedTransactions[0].reason, /positive integer/i);
        assert.match(result.failedTransactions[1].reason, /positive integer/i);
        assert.match(result.failedTransactions[2].reason, /positive integer/i);
        assert.equal(result.inventory[0].stock, 10);
    });

    it("Rule 4: Không cho phép giao dịch tham chiếu thiết bị không tồn tại", () => {
        const inventory: Equipment[] = [
            { id: "LAPTOP", name: "Laptop", stock: 10 },
        ];
        const transactions: Transaction[] = [
            {
                id: "T1",
                equipmentId: "NON_EXISTENT",
                type: "IMPORT",
                quantity: 5,
                timestamp: "2026-11-01T09:00:00",
            },
        ];

        const result = processTransactions(inventory, transactions);

        assert.equal(result.successfulTransactions.length, 0);
        assert.equal(result.failedTransactions.length, 1);
        assert.equal(result.failedTransactions[0].transactionId, "T1");
        assert.match(result.failedTransactions[0].reason, /Equipment not found/i);
    });

    it("Rule 5: Không xử lý giao dịch trùng id", () => {
        const inventory: Equipment[] = [
            { id: "LAPTOP", name: "Laptop", stock: 10 },
        ];
        const transactions: Transaction[] = [
            {
                id: "DUP_ID",
                equipmentId: "LAPTOP",
                type: "IMPORT",
                quantity: 5,
                timestamp: "2026-11-01T09:00:00",
            },
            {
                id: "DUP_ID",
                equipmentId: "LAPTOP",
                type: "IMPORT",
                quantity: 5,
                timestamp: "2026-11-01T10:00:00",
            },
        ];

        const result = processTransactions(inventory, transactions);

        // Giao dịch đầu tiên được xử lý thành công
        assert.deepEqual(result.successfulTransactions, ["DUP_ID"]);
        // Giao dịch thứ hai bị từ chối do trùng ID
        assert.equal(result.failedTransactions.length, 1);
        assert.equal(result.failedTransactions[0].transactionId, "DUP_ID");
        assert.match(result.failedTransactions[0].reason, /Duplicate transaction ID/i);
        // Tồn kho chỉ tăng 1 lần từ giao dịch hợp lệ
        assert.equal(result.inventory[0].stock, 15);
    });

    it("Rule 6 & 7: Giao dịch thất bại không làm ảnh hưởng đến các giao dịch khác và báo cáo đầy đủ", () => {
        const inventory: Equipment[] = [
            { id: "LAPTOP", name: "Laptop", stock: 5 },
            { id: "MOUSE", name: "Mouse", stock: 10 },
        ];
        const transactions: Transaction[] = [
            {
                id: "T1",
                equipmentId: "LAPTOP",
                type: "EXPORT",
                quantity: 100, // Thất bại do thiếu hàng
                timestamp: "2026-11-01T09:00:00",
            },
            {
                id: "T2",
                equipmentId: "MOUSE",
                type: "EXPORT",
                quantity: 3, // Thành công
                timestamp: "2026-11-01T10:00:00",
            },
        ];

        const result = processTransactions(inventory, transactions);

        assert.deepEqual(result.successfulTransactions, ["T2"]);
        assert.equal(result.failedTransactions.length, 1);
        assert.equal(result.failedTransactions[0].transactionId, "T1");
        assert.equal(result.inventory.find((e) => e.id === "MOUSE")?.stock, 7);
        assert.equal(result.inventory.find((e) => e.id === "LAPTOP")?.stock, 5);
    });

    it("Edge Case: Hai giao dịch có cùng timestamp (giữ tính ổn định FIFO)", () => {
        const inventory: Equipment[] = [
            { id: "LAPTOP", name: "Laptop", stock: 10 },
        ];
        const transactions: Transaction[] = [
            {
                id: "T_SAME_1",
                equipmentId: "LAPTOP",
                type: "EXPORT",
                quantity: 8,
                timestamp: "2026-11-01T09:00:00",
            },
            {
                id: "T_SAME_2",
                equipmentId: "LAPTOP",
                type: "EXPORT",
                quantity: 5,
                timestamp: "2026-11-01T09:00:00",
            },
        ];

        const result = processTransactions(inventory, transactions);

        // T_SAME_1 chạy trước (stock còn 2), T_SAME_2 chạy sau không đủ stock (cần 5, còn 2)
        assert.deepEqual(result.successfulTransactions, ["T_SAME_1"]);
        assert.equal(result.failedTransactions.length, 1);
        assert.equal(result.failedTransactions[0].transactionId, "T_SAME_2");
        assert.equal(result.inventory[0].stock, 2);
    });

    it("Edge Case: Giao dịch có timestamp không hợp lệ", () => {
        const inventory: Equipment[] = [
            { id: "LAPTOP", name: "Laptop", stock: 10 },
        ];
        const transactions: Transaction[] = [
            {
                id: "T_VALID",
                equipmentId: "LAPTOP",
                type: "EXPORT",
                quantity: 2,
                timestamp: "2026-11-01T09:00:00",
            },
            {
                id: "T_INVALID_TIME",
                equipmentId: "LAPTOP",
                type: "EXPORT",
                quantity: 2,
                timestamp: "invalid-date-string",
            },
        ];

        const result = processTransactions(inventory, transactions);

        assert.deepEqual(result.successfulTransactions, ["T_VALID"]);
        assert.equal(result.failedTransactions.length, 1);
        assert.equal(result.failedTransactions[0].transactionId, "T_INVALID_TIME");
        assert.match(result.failedTransactions[0].reason, /Invalid timestamp/i);
        assert.equal(result.inventory[0].stock, 8);
    });

    it("Code Quality: Không mutate mảng initialInventory và các object bên trong", () => {
        const originalInventory: Equipment[] = [
            { id: "LAPTOP", name: "Laptop", stock: 10 },
        ];
        const originalCopy = JSON.parse(JSON.stringify(originalInventory));

        const transactions: Transaction[] = [
            {
                id: "T1",
                equipmentId: "LAPTOP",
                type: "EXPORT",
                quantity: 3,
                timestamp: "2026-11-01T09:00:00",
            },
        ];

        const result = processTransactions(originalInventory, transactions);

        // Kết quả trả về đã được cập nhật
        assert.equal(result.inventory[0].stock, 7);
        // Mảng và object gốc KHÔNG bị thay đổi
        assert.deepEqual(originalInventory, originalCopy);
        assert.equal(originalInventory[0].stock, 10);
    });
});

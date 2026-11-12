
### Câu A — Algorithm Analysis

#### 1. Độ phức tạp thời gian (Time Complexity)

Gọi $N$ là số lượng giao dịch (`transactions.length`), $M$ là số lượng loại thiết bị (`initialInventory.length`):

- **Khởi tạo Map từ kho ban đầu**: Duyệt qua $M$ thiết bị và sao chép: $\mathcal{O}(M)$.
- **Tiền xử lý mảng giao dịch** (`map` tính thời gian `Date.parse`): $\mathcal{O}(N)$.
- **Sắp xếp giao dịch theo thời gian**: $\mathcal{O}(N \log N)$ (thuật toán Timsort mặc định của V8).
- **Vòng lặp xử lý giao dịch**: Duyệt qua $N$ phần tử; mỗi thao tác kiểm tra Set (`.has()`, `.add()`), tra cứu Map (`.get()`) và cập nhật số lượng đều diễn ra trong $\mathcal{O}(1)$: Tổng cộng $\mathcal{O}(N)$.
- **Chuyển đổi Map thành mảng kết quả**: $\mathcal{O}(M)$.

$$
\text{Tổng độ phức tạp thời gian: } \mathcal{O}(N \log N + M)
$$

#### 2. Độ phức tạp bộ nhớ (Space Complexity)

- `inventoryMap`: Lưu trữ $M$ thiết bị trong `Map`: $\mathcal{O}(M)$.
- `indexedTransactions`: Lưu mảng bọc phụ trợ cho $N$ giao dịch phục vụ sắp xếp ổn định: $\mathcal{O}(N)$.
- `seenTransactionIds`: `Set` lưu trữ tối đa $N$ ID để chống trùng lặp: $\mathcal{O}(N)$.
- Mảng kết quả (`inventory`, `successfulTransactions`, `failedTransactions`): $\mathcal{O}(M + N)$.

$$
\text{Tổng độ phức tạp không gian bộ nhớ: } \mathcal{O}(N + M)
$$

#### 3. Tối ưu khi có 1.000.000 giao dịch và 100.000 loại thiết bị

Với quy mô lớn, việc nạp toàn bộ vào RAM của một tiến trình Node.js đơn lẻ sẽ gây quá tải Heap và nghẽn CPU:

1. **Chia phân vùng song song theo `equipmentId` (Sharding / Partitioning)**:
   - Các giao dịch trên các thiết bị khác nhau hoàn toàn độc lập về mặt tồn kho. Ta có thể phân vùng dữ liệu theo `hash(equipmentId) % K` và xử lý song song trên nhiều Worker Threads hoặc Consumer Nodes.
2. **Xử lý luồng (Streaming & External Sort)**:
   - Thay vì nạp cả 1 triệu bản ghi vào mảng JS, sử dụng **Node.js Streams** hoặc **Async Iterators**. Nếu dữ liệu chưa sắp xếp và vượt quá bộ nhớ, dùng thuật toán **External Merge Sort** (chia thành các file tạm đã sắp xếp trên ổ đĩa rồi trộn k-đường).
3. **Loại bỏ sắp xếp ở tầng ứng dụng (Pre-sorted Ingestion)**:
   - Trong thực tế, dữ liệu giao dịch nên được ghi vào Message Broker (Kafka topic) hoặc Database table có sẵn chỉ mục thời gian (`B-Tree index` trên `timestamp`), từ đó đọc ra dưới dạng đã sắp xếp theo thứ tự thời gian sẵn ($\mathcal{O}(N)$ thay vì $\mathcal{O}(N \log N)$).
4. **Kiểm tra trùng lặp nhẹ hơn (Bloom Filter / Distributed Cache)**:
   - Lưu 1 triệu `string` ID trong JS Set chiếm ~60–80 MB bộ nhớ. Sử dụng **Bloom Filter** kết hợp với Redis (`SETNX` có TTL) hoặc Unique Constraint của DB để phát hiện giao dịch trùng lặp nhanh chóng với chi phí bộ nhớ tối thiểu.
5. **Tối ưu kiểu dữ liệu số nguyên (Epoch Timestamp)**:
   - Lưu trữ `timestamp` trực tiếp dưới dạng số nguyên epoch milliseconds (`number`/`bigint`) thay vì chuỗi ISO string để tránh chi phí gọi `Date.parse()` 1 triệu lần.

---

### Câu B — Edge Cases

- **Hai giao dịch có cùng `timestamp`**:
  Chương trình áp dụng cơ chế sắp xếp ổn định (Stable Sort): khi hiệu thời gian `a.time - b.time === 0`, chương trình so sánh chỉ số ban đầu `a.originalIndex - b.originalIndex`. Nhờ đó, giao dịch xuất hiện trước trong mảng đầu vào sẽ được xử lý trước một cách tiền định (FIFO), không bị xáo trộn ngẫu nhiên.
- **Hai giao dịch có cùng `id`**:
  Chương trình dùng `seenTransactionIds` (`Set<string>`) để ghi nhận các ID đã qua xử lý. Giao dịch đầu tiên xuất hiện theo trình tự thời gian sẽ được tiếp nhận và xử lý. Giao dịch thứ hai xuất hiện sau sẽ bị phát hiện trùng lặp ngay tại bước kiểm tra đầu tiên, bị từ chối với lý do `"Duplicate transaction ID: '...'"` và đưa vào `failedTransactions`, đảm bảo tính Idempotency và an toàn cho kho hàng.
- **Giao dịch có `quantity = -5`**:
  Quy tắc số 3 yêu cầu `quantity` phải là số nguyên dương. Khi gặp `-5`, điều kiện `tx.quantity <= 0` kích hoạt, giao dịch bị từ chối với lý do `"Invalid quantity: -5. Quantity must be a positive integer"`, tồn kho giữ nguyên.
- **Giao dịch có `quantity = 0`**:
  Số 0 không phải là số nguyên dương (`0 <= 0`). Giao dịch bị từ chối với lý do `"Invalid quantity: 0. Quantity must be a positive integer"`, không làm thay đổi tồn kho.
- **Giao dịch xuất kho khiến stock âm**:
  Trước khi trừ kho trong nhánh `EXPORT`, chương trình kiểm tra `equipment.stock < tx.quantity`. Nếu số lượng tồn kho hiện tại nhỏ hơn số lượng yêu cầu xuất, giao dịch lập tức bị từ chối với lý do `"Insufficient stock for equipment '...'. Available: ..., requested: ..."`. Kho hàng không bị trừ và không bao giờ bị âm.
- **Giao dịch có `timestamp` không hợp lệ**:
  Khi `Date.parse(tx.timestamp)` trả về `NaN`, hàm so sánh đẩy giao dịch này về cuối danh sách để không ảnh hưởng đến thứ tự của các giao dịch hợp lệ. Trong vòng lặp, điều kiện `!isValidTime` bắt lỗi và đưa giao dịch vào `failedTransactions` với lý do `"Invalid timestamp: '...'"` mà không gây crash chương trình.

---

### Câu C — Code Quality

- **Vì sao bạn chọn `Map` thay vì `Object` để quản lý tồn kho?**
  1. **Hiệu năng vượt trội $\mathcal{O}(1)$**: `Map` được tối ưu hóa đặc biệt cho các thao tác tra cứu, thêm mới và cập nhật liên tục với khối lượng khóa lớn ($100.000$ thiết bị).
  2. **An toàn trước Prototype Pollution**: Đối tượng JavaScript (`Object`) kế thừa các thuộc tính nguyên mẫu như `toString`, `valueOf`, `constructor`. Nếu mã thiết bị trùng với các từ khóa này (ví dụ `id: "constructor"`), `Object` thông thường sẽ bị lỗi logic nghiêm trọng. `Map` hoàn toàn độc lập và không chứa các khóa thừa kế này.
  3. **Bảo toàn thứ tự chèn**: `Map` luôn đảm bảo thứ tự duyệt trùng với thứ tự thêm vào ban đầu, giúp mảng kết quả `result.inventory` giữ nguyên thứ tự các thiết bị như `initialInventory`.
  4. **API chuyên dụng rõ ràng**: Cung cấp các phương thức tường minh (`.has()`, `.get()`, `.set()`, `.size`) giúp mã nguồn sạch và dễ bảo trì.
- **Tại sao nên tránh sửa trực tiếp `initialInventory`?**
  1. **Nguyên tắc hàm thuần khiết (Pure Function & Immutability)**: Không tạo ra tác dụng phụ (side-effects). Việc sửa đổi trực tiếp tham số đầu vào là nguyên nhân hàng đầu gây ra các lỗi tiềm ẩn (mutation bugs) khi nhiều module khác cùng tham chiếu tới đối tượng này.
  2. **Khả năng tái sử dụng dữ liệu & Audit Trail**: Bên gọi hàm (caller) có thể tiếp tục dùng mảng `initialInventory` để so sánh chênh lệch (diff), ghi nhật ký kiểm toán, hoặc thực hiện rollback khi cần.
  3. **Độ tin cậy trong kiểm thử và đa luồng**: Cho phép chạy nhiều lần hàm xử lý trên cùng một bộ dữ liệu ban đầu mà không làm biến dạng trạng thái của các lần chạy sau.
- **Bạn sẽ tổ chức unit test cho chức năng này như thế nào?**
  Bộ test được cấu trúc theo mô hình **Arrange - Act - Assert (AAA)** và phân nhóm rõ ràng theo từng khía cạnh:
  1. **Happy Path**: Kiểm tra luồng chuẩn với các giao dịch `IMPORT` và `EXPORT` hợp lệ xen kẽ trên nhiều thiết bị.
  2. **Kiểm thử từng quy tắc nghiệp vụ (Business Rules 1–7)**:
     - *Rule 1*: Đưa vào mảng giao dịch bị xáo trộn thứ tự thời gian; kiểm chứng kết quả chạy theo đúng timeline thời gian.
     - *Rule 2*: Xuất kho vượt quá tồn hiện có $\rightarrow$ thất bại, tồn kho không thay đổi.
     - *Rule 3*: Giá trị `quantity` bằng 0, số âm, số thập phân $\rightarrow$ từ chối.
     - *Rule 4*: `equipmentId` không tồn tại trong kho $\rightarrow$ từ chối.
     - *Rule 5*: Trùng lặp `id` giao dịch $\rightarrow$ chỉ xử lý giao dịch đầu tiên, từ chối giao dịch đến sau.
     - *Rule 6 & 7*: Giao dịch lỗi nằm xen giữa các giao dịch đúng $\rightarrow$ các giao dịch đúng vẫn thực thi bình thường và kết quả phân loại đầy đủ.
  3. **Edge Cases**: Kiểm thử hai giao dịch cùng timestamp (FIFO), timestamp bị sai định dạng chuỗi.
  4. **Tính bất biến (Immutability Check)**: So sánh sâu (`assert.deepEqual`) mảng `initialInventory` trước và sau khi gọi hàm để đảm bảo không bị mutate.

Toàn bộ 10 test case đã được viết tại [test/inventory.processor.spec.ts](file:///c:/Project/KNTHCM/inventory-processor/test/inventory.processor.spec.ts) và có thể chạy bất kỳ lúc nào bằng lệnh:

```bash
npm test
```

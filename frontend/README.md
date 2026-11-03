# Bảng thông minh AI (front end)

React + TypeScript + Vite + Tailwind + Zustand + tldraw 3.x + KaTeX + MathLive + three.js + jsPDF + i18next.

## Chạy
`npm install`, rồi `npm run dev` (http://localhost:5173), `npm run build` (có `tsc`), `npm test` (vitest).
Thử trên tablet: mở bằng địa chỉ IP máy cùng mạng wifi.

## Tính năng
- **Bảng vẽ:** tldraw, nền lưới (trơn, ô vuông, chấm, Oxy), dark/light, phím tắt, tự lưu cục bộ, nhiều trang, lưu/mở bài giảng bằng file JSON.
- **Nhận diện hình 2D** (`src/recognition`, chạy tại chỗ): thẳng, tròn, elip, tam giác, chữ nhật, đa giác tối đa 8 cạnh (`TUNING.maxCorners`), nhãn đỉnh, góc vuông, hoàn tác. Nét được làm mượt trước khi đo độ thẳng (`TUNING.lineSmooth`). Ngưỡng tự nắn `MIN_SNAP_CONFIDENCE` = 0,6. Hình nhiều cạnh hơn được giữ nguyên nét hoặc nắn thành hình tròn.
- **Đồ thị** (`src/graph`): y = f(x), x = c, phương trình hai vế, bất phương trình (y > f(x), x ≥ c, A > B theo x), hệ tối đa 6 dòng, tham số có thanh trượt, điểm đặc biệt, giao điểm, nghiệm dạng √ và phân số (nghiệm đúng cho bậc 2 hệ số hữu tỉ). Nhận LaTeX (`\frac`, `\dfrac`, `\sqrt[n]{}`, `\mathrm{e}`, `\operatorname{}`...), `|x|`.
- **Ô MathLive** (nạp khi mở tab Đồ thị), nút "Đọc chữ viết tay" rồi cho sửa; thả đồ thị lên bảng kèm công thức, chọn hình để "Sửa" hoặc "Cập nhật tại chỗ".
- **3D** (`src/solid`): hộp, cầu, trụ, nón, chóp; xoay/zoom, nét khuất là nét đứt, thể tích, diện tích.
- **Chat**, **xuất** PNG/SVG (trang hiện tại) và PDF (tất cả trang).

## Ghép back end
Sao `.env.example` thành `.env`, đặt `VITE_API_URL=http://localhost:8000`. Để trống (hoặc `VITE_DEMO=1`) thì dùng dữ liệu mẫu.
- `POST /api/recognize-math`: multipart, trường `image` (PNG các nét đang chọn, đã thu nhỏ) trả `{latex, confidence}`.
- `POST /api/assistant`: JSON `{message, context:{graph:string[], solid?:string, history?:{role,text}[]}}` trả `{reply}` (văn bản thuần, công thức trong `$...$`).
Front end kiểm tra dạng phản hồi (sai thì báo lỗi, cho thử lại), có `ErrorBoundary` theo panel, chỉ gửi ảnh khi người dùng đồng ý.
`generateGraph` và `build3DFromSketch` trong `src/api/contract.ts` là hàm chờ, chưa được gọi.

## Phần dành cho back end mở rộng
Nhận diện hình bằng mô hình học (đa giác nhiều cạnh, nét lạ), đọc chữ/công thức, giải toán ký hiệu và từng bước (SymPy), chat/streaming, nhận dạng 3D từ nét phác, thu nét có đồng ý để huấn luyện. Các số đo độ chính xác hiện có dựa trên nét sinh bằng code, chưa phải nét tay thật.

## Kiểm thử
`src/graph/*.test.ts` (công thức, tô miền, LaTeX, nghiệm đúng), `src/recognition/recognizer.test.ts` (hình ưu tiên theo đúng ngưỡng tin cậy, cung cong, nét nguệch ngoạc). Chưa chạy trên tablet thật.

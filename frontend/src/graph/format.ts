/** Định dạng số kiểu Việt Nam: dấu phẩy thập phân, tối đa 3 chữ số sau dấu phẩy. */
export function fmt(v: number): string {
  if (!Number.isFinite(v)) return '?'
  if (Math.abs(v) < 5e-4) return '0'
  if (Math.abs(v) >= 1e6) return v.toExponential(2).replace('.', ',')
  return String(Number(v.toFixed(3))).replace('.', ',').replace(/-/g, '−')
}

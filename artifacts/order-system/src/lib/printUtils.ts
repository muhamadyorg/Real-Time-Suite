// Fix 4 — XSS himoyasi: barcha order maydonlari HTML-escaped bo'lishi kerak
function escHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildLabelHtml(order: any, widthMm = 58): string {
  const dateStr = order.createdAt
    ? new Date(order.createdAt).toLocaleString("uz-UZ")
    : new Date().toLocaleString("uz-UZ");

  // Fix 4 — barcha maydonlarga escHtml qo'llaymiz
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { size: ${widthMm}mm auto; margin: 2mm 2mm 4mm 2mm; }
  html, body { width: ${widthMm - 4}mm; margin: 0; padding: 0; }
  * { box-sizing: border-box; font-family: 'Courier New', monospace; }
  body { font-size: 11px; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .big { font-size: 15px; font-weight: bold; }
  .hr { border: none; border-top: 1px dashed #000; margin: 3px 0; }
  .row { display: flex; justify-content: space-between; gap: 4px; margin: 1px 0; }
  .lbl { color: #555; white-space: nowrap; }
  .val { text-align: right; font-weight: 600; }
</style>
</head>
<body>
  <div class="center big">&#8470;${escHtml(order.id ?? "----")}</div>
  <hr class="hr"/>
  <div class="row"><span class="lbl">Xizmat:</span><span class="val">${escHtml(order.serviceTypeName)}</span></div>
  <div class="row"><span class="lbl">Mahsulot:</span><span class="val">${escHtml(order.product)}</span></div>
  <div class="row"><span class="lbl">Miqdor:</span><span class="val bold">${escHtml(order.quantity)} ${escHtml(order.unit)}</span></div>
  <div class="row"><span class="lbl">Javon:</span><span class="val bold">${escHtml(order.shelf)}</span></div>
  <hr class="hr"/>
  <div class="row"><span class="lbl">Mijoz:</span><span class="val">${escHtml(order.clientName)}</span></div>
  <div class="center" style="font-size:9px;margin-top:3px;color:#666">${escHtml(dateStr)}</div>
</body>
</html>`;
}

/**
 * Fix 5 — Blob URL usuli: document.write() o'rniga ishlatiladi.
 * iframe ichida ham ishlaydi, popup bloker muammosi yo'q.
 */
export function printOrderLabel(order: any, widthMm = 58): void {
  const html = buildLabelHtml(order, widthMm);

  // Fix 5 — Blob URL orqali iframe yuklash
  const blob = new Blob([html], { type: "text/html; charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:1px;height:1px;border:none;opacity:0;pointer-events:none;";

  iframe.onload = () => {
    try { iframe.contentWindow?.print(); } catch { /* ignore */ }
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch { /* ignore */ }
      URL.revokeObjectURL(url);
    }, 3000);
  };

  iframe.src = url;
  document.body.appendChild(iframe);
}

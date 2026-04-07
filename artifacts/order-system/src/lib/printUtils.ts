function escHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Toshkent vaqtiga o'tkazish (UTC+5) ───────────────────────────────────
function toTashkentParts(iso: string): { dateStr: string; timeStr: string } {
  const d = new Date(iso);
  const offset = 5 * 60 * 60 * 1000;
  const t = new Date(d.getTime() + offset);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${pad(t.getUTCDate())}.${pad(t.getUTCMonth() + 1)}.${t.getUTCFullYear()}`;
  const timeStr = `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
  return { dateStr, timeStr };
}

// ─── RawBT chek HTML ────────────────────────────────────────────────────────
export function buildReceiptHtml(order: any): string {
  const { dateStr, timeStr } = order.createdAt
    ? toTashkentParts(order.createdAt)
    : { dateStr: "--.--.----", timeStr: "--:--" };

  const ordNum = String(order.id).padStart(5, "0");
  const qrData = (typeof window !== "undefined" ? window.location.origin : "") + `/order/${order.id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(qrData)}`;

  const qty = [order.quantity, order.unit].filter(Boolean).join(" ");

  const rows = [
    `<tr><td style="padding:1px 0">${escHtml(order.serviceTypeName)}</td><td style="text-align:right;padding:1px 0">${escHtml(qty)}</td></tr>`,
    order.shelf
      ? `<tr><td style="padding:1px 0">Qolib</td><td style="text-align:right;padding:1px 0">${escHtml(order.shelf)}</td></tr>`
      : "",
    order.clientName
      ? `<tr><td style="padding:1px 0">Mijoz</td><td style="text-align:right;padding:1px 0">${escHtml(order.clientName)}</td></tr>`
      : "",
  ].join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @page { size: 58mm auto; margin: 2mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; width: 54mm; margin: 0; padding: 0; }
  .c { text-align: center; }
  .b { font-weight: bold; }
  .hr { border-top: 1px dashed #000; margin: 3px 0; }
  table { width: 100%; border-collapse: collapse; }
</style>
</head><body>
<div class="c b" style="font-size:13px">${escHtml(order.storeName || "DO'KON")}</div>
<div class="c">Buyurtma #${ordNum}</div>
<div class="c" style="font-size:10px">Sana: ${dateStr} &nbsp; Vaqt: ${timeStr}</div>
<div class="hr"></div>
<table>${rows}</table>
<div class="hr"></div>
<div class="c" style="margin-top:4px">
  <img src="${qrUrl}" style="width:70px;height:70px;display:block;margin:0 auto">
</div>
<div class="c" style="font-size:9px">/order/${order.id}</div>
<div class="c b" style="margin-top:5px">Rahmat!</div>
<br><br><br><br>
</body></html>`;
}

// ─── Brauzer orqali chop etish (sozlash talab qilmaydi) ──────────────────────
export function printReceiptRawBT(order: any): void {
  const html = buildReceiptHtml(order);

  // Yangi oynada faqat chek HTML ochiladi — asosiy sahifa chop etilmaydi
  const printWindow = window.open("", "_blank", "width=300,height=600");
  if (!printWindow) return;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  // Hujjat yuklangandan so'ng print dialog
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    // Chop bo'lgach oyna yopiladi
    printWindow.onafterprint = () => printWindow.close();
  };
}

// ─── Eski label HTML (saqlanadi) ─────────────────────────────────────────────
export function buildLabelHtml(order: any, widthMm = 58): string {
  const dateStr = order.createdAt
    ? new Date(order.createdAt).toLocaleString("uz-UZ")
    : new Date().toLocaleString("uz-UZ");

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
  <div class="row"><span class="lbl">Qolib:</span><span class="val bold">${escHtml(order.shelf)}</span></div>
  <hr class="hr"/>
  <div class="row"><span class="lbl">Mijoz:</span><span class="val">${escHtml(order.clientName)}</span></div>
  <div class="center" style="font-size:9px;margin-top:3px;color:#666">${escHtml(dateStr)}</div>
</body>
</html>`;
}

export function printOrderLabel(order: any, widthMm = 58): void {
  const html = buildLabelHtml(order, widthMm);

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

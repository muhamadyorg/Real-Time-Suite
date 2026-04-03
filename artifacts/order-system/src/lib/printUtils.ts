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
  <div class="center big">№${order.id ?? "----"}</div>
  <hr class="hr"/>
  <div class="row"><span class="lbl">Xizmat:</span><span class="val">${order.serviceTypeName ?? ""}</span></div>
  <div class="row"><span class="lbl">Mahsulot:</span><span class="val">${order.product ?? ""}</span></div>
  <div class="row"><span class="lbl">Miqdor:</span><span class="val bold">${order.quantity ?? ""} ${order.unit ?? ""}</span></div>
  <div class="row"><span class="lbl">Javon:</span><span class="val bold">${order.shelf ?? ""}</span></div>
  <hr class="hr"/>
  <div class="row"><span class="lbl">Mijoz:</span><span class="val">${order.clientName ?? ""}</span></div>
  <div class="center" style="font-size:9px;margin-top:3px;color:#666">${dateStr}</div>
</body>
</html>`;
}

/**
 * Prints via a hidden <iframe> — works inside Replit iframe, no popup blocker issues.
 */
export function printOrderLabel(order: any, widthMm = 58): void {
  const html = buildLabelHtml(order, widthMm);

  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:1px;height:1px;border:none;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    alert("Chop etish imkonsiz — brauzer iframe-ni qo'llab-quvvatlamaydi.");
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();

  // Small delay so the browser renders the iframe content before printing
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch { /* ignore */ }
      }, 3000);
    }
  }, 350);
}

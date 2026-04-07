import { useState, useCallback, useEffect, createContext, useContext, createElement, type ReactNode } from "react";

export const PRINTER_PROFILES = [
  { svc: "0000ff00-0000-1000-8000-00805f9b34fb", char: "0000ff01-0000-1000-8000-00805f9b34fb", name: "XPrinter-FF01" },
  { svc: "0000ff00-0000-1000-8000-00805f9b34fb", char: "0000ff02-0000-1000-8000-00805f9b34fb", name: "XPrinter-FF02" },
  { svc: "6e400001-b5a3-f393-e0a9-e50e24dcca9e", char: "6e400002-b5a3-f393-e0a9-e50e24dcca9e", name: "NUS (Nordic UART)" },
  { svc: "49535343-fe7d-4ae5-8fa9-9fafd205e455", char: "49535343-1e4d-4bd9-ba61-23c647249616", name: "Isotemp" },
  { svc: "000018f0-0000-1000-8000-00805f9b34fb", char: "000018f1-0000-1000-8000-00805f9b34fb", name: "Peripage" },
  { svc: "0000ae00-0000-1000-8000-00805f9b34fb", char: "0000ae01-0000-1000-8000-00805f9b34fb", name: "AE" },
];

const ALL_SVC_UUIDS = [...new Set(PRINTER_PROFILES.map(p => p.svc))];

// ─── Label config (ESC/POS, kept for backward compat) ────────────────────────
export interface LabelConfig {
  paperDots: number;
  feedLines: number;
  separatorLen: number;
  charsPerLine: number;
}
export const DEFAULT_LABEL_CONFIG: LabelConfig = {
  paperDots: 384, feedLines: 5, separatorLen: 32, charsPerLine: 32,
};

// ─── TSPL Layout (новый дизайнер) ────────────────────────────────────────────
export type HAlign = "left" | "center" | "right";

export interface TsplElementConfig {
  show: boolean;
  align: HAlign;
}

export interface TsplLayout {
  widthMm: number;
  heightMm: number;   // 0 = auto
  leftMarginMm: number;
  elements: {
    storeName:   TsplElementConfig;
    orderId:     TsplElementConfig;
    dateTime:    TsplElementConfig;
    sep1:        TsplElementConfig;
    serviceType: TsplElementConfig;
    quantity:    TsplElementConfig;
    shelf:       TsplElementConfig;
    clientName:  TsplElementConfig;
    sep2:        TsplElementConfig;
    qr:          TsplElementConfig;
    footer:      TsplElementConfig;
  };
}

export const DEFAULT_TSPL_LAYOUT: TsplLayout = {
  widthMm: 58,
  heightMm: 0,
  leftMarginMm: 3,
  elements: {
    storeName:   { show: true, align: "center" },
    orderId:     { show: true, align: "center" },
    dateTime:    { show: true, align: "center" },
    sep1:        { show: true, align: "left"   },
    serviceType: { show: true, align: "left"   },
    quantity:    { show: true, align: "left"   },
    shelf:       { show: true, align: "left"   },
    clientName:  { show: true, align: "left"   },
    sep2:        { show: true, align: "left"   },
    qr:          { show: true, align: "center" },
    footer:      { show: true, align: "center" },
  },
};

// ─── TSPL helpers ─────────────────────────────────────────────────────────────
const ALIGN_NUM: Record<HAlign, number> = { left: 0, right: 1, center: 2 };

function tsplEsc(s: unknown) { return String(s ?? "").replace(/"/g, "'"); }

/** Build a TSPL BLOCK command (supports left/center/right via alignment param) */
function block(x: number, y: number, w: number, h: number, font: string, align: HAlign, text: string) {
  return `BLOCK ${x},${y},${w},${h},"${font}",0,1,1,${ALIGN_NUM[align]},"${tsplEsc(text)}"`;
}

/** Build a TSPL BAR (horizontal line) command */
function bar(x: number, y: number, w: number) {
  return `BAR ${x},${y},${w},2`;
}

/** QR X position based on alignment */
function qrX(x: number, contentW: number, align: HAlign, qrSize = 80) {
  if (align === "center") return x + Math.round((contentW - qrSize) / 2);
  if (align === "right")  return x + contentW - qrSize;
  return x;
}

export interface TsplRow {
  kind: "block" | "bar" | "qr";
  key: string;
  label: string;         // human label for preview
  y: number;
  h: number;
  align: HAlign;
  text?: string;
}

/** Compute TSPL rows AND preview data from layout + order */
export function computeTsplRows(order: any, layout: TsplLayout = DEFAULT_TSPL_LAYOUT): TsplRow[] {
  const DPM    = 8; // dots per mm at 203 DPI
  const lx     = Math.round(layout.leftMarginMm * DPM);
  const wDots  = Math.round(layout.widthMm * DPM);
  const cw     = wDots - lx * 2;

  const now    = new Date(order.createdAt ?? Date.now());
  const utc5   = new Date(now.getTime() + 5 * 3600_000);
  const pad    = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${pad(utc5.getUTCDate())}.${pad(utc5.getUTCMonth()+1)}.${utc5.getUTCFullYear()}`;
  const timeStr = `${pad(utc5.getUTCHours())}:${pad(utc5.getUTCMinutes())}`;
  const ordNum  = String(order.id ?? 1).padStart(5, "0");
  const qty     = [order.quantity, order.unit].filter(Boolean).join(" ");

  const el = layout.elements;
  const rows: TsplRow[] = [];
  let y = 10;

  const push = (key: keyof typeof el, label: string, h: number, text: string) => {
    const cfg = el[key];
    if (!cfg.show) return;
    rows.push({ kind: "block", key, label, y, h, align: cfg.align, text });
    y += h + 4;
  };
  const pushBar = (key: keyof typeof el) => {
    const cfg = el[key];
    if (!cfg.show) return;
    rows.push({ kind: "bar", key, label: "—————", y, h: 2, align: cfg.align });
    y += 12;
  };
  const pushQr = (key: keyof typeof el, label: string) => {
    const cfg = el[key];
    if (!cfg.show) return;
    rows.push({ kind: "qr", key, label, y, h: 90, align: cfg.align });
    y += 100;
  };

  push("storeName",   "Do'kon",          42, order.storeName ?? "DO'KON");
  push("orderId",     "Buyurtma #",      30, `Buyurtma #${ordNum}`);
  push("dateTime",    "Sana/vaqt",       30, `${dateStr}  ${timeStr}`);
  pushBar("sep1");
  push("serviceType", "Xizmat",          28, order.serviceTypeName ?? "Xizmat");
  if (qty) push("quantity", "Miqdor",    26, `Miqdor: ${qty}`);
  if (order.shelf) push("shelf", "Javon",26, `Javon: ${order.shelf}`);
  if (order.clientName) push("clientName","Mijoz",26,`Mijoz: ${order.clientName}`);
  pushBar("sep2");
  pushQr("qr", "QR kod");
  push("footer", "Rahmat", 30, "Rahmat!");

  return rows;
}

/** Build TSPL bytes from layout + order */
export function buildTsplReceipt(order: any, layout: TsplLayout = DEFAULT_TSPL_LAYOUT): Uint8Array {
  const DPM   = 8;
  const lx    = Math.round(layout.leftMarginMm * DPM);
  const wDots = Math.round(layout.widthMm * DPM);
  const cw    = wDots - lx * 2;

  const rows  = computeTsplRows(order, layout);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrData = `${origin}/order/${order.id ?? 0}`;

  let maxY = 10;
  const cmds: string[] = [];

  for (const row of rows) {
    if (row.kind === "block") {
      const font = row.key === "storeName" ? "3" : "2";
      cmds.push(block(lx, row.y, cw, row.h, font, row.align, row.text ?? ""));
    } else if (row.kind === "bar") {
      cmds.push(bar(lx, row.y, cw));
    } else if (row.kind === "qr") {
      const x = qrX(lx, cw, row.align, 80);
      cmds.push(`QRCODE ${x},${row.y},L,4,A,0,"${tsplEsc(qrData)}"`);
    }
    maxY = row.y + row.h + 4;
  }

  const autoH = Math.ceil(maxY / DPM / 2) * 2 + 4;
  const heightMm = layout.heightMm > 0 ? layout.heightMm : autoH;

  const tspl = [
    `SIZE ${layout.widthMm} mm,${heightMm} mm`,
    "GAP 2 mm,0 mm",
    "DIRECTION 0",
    "REFERENCE 0,0",
    "CLS",
    ...cmds,
    "PRINT 1",
    "",
  ].join("\r\n");

  return new TextEncoder().encode(tspl);
}

// ─── Simple ESC/POS test ──────────────────────────────────────────────────────
export function buildSimpleTest(): Uint8Array {
  const bytes: number[] = [];
  const ESC = 0x1B; const LF = 0x0A;
  const push = (...b: number[]) => bytes.push(...b);
  const line = (s: string) => { for (const c of s) push(c.charCodeAt(0) < 128 ? c.charCodeAt(0) : 63); push(LF); };
  push(ESC, 0x40);
  line("================================");
  line("   BT PRINTER TEST - OK!");
  line("================================");
  line("XP-365B ulangan");
  line("FF01 kanal ishlayapti");
  line("--------------------------------");
  push(ESC, 0x64, 0x05);
  return new Uint8Array(bytes);
}

// ─── ESC/POS buildLabel (compat) ─────────────────────────────────────────────
function toCP1251(char: string): number {
  const code = char.charCodeAt(0);
  if (code < 0x80) return code;
  if (code >= 0x0410 && code <= 0x042F) return code - 0x0410 + 0xC0;
  if (code >= 0x0430 && code <= 0x044F) return code - 0x0430 + 0xE0;
  const map: Record<number,number> = {0x0401:0xA8,0x0451:0xB8,0x040E:0xA1,0x045E:0xA2};
  return map[code] ?? 0x3F;
}
function pushStr(bytes: number[], s: string) {
  for (let i = 0; i < s.length; i++) bytes.push(toCP1251(s[i]));
}
export function buildLabel(order: any, config: LabelConfig = DEFAULT_LABEL_CONFIG): Uint8Array {
  const bytes: number[] = [];
  const ESC = 0x1B; const GS = 0x1D; const LF = 0x0A;
  const push = (...b: number[]) => bytes.push(...b);
  const str  = (s: string) => pushStr(bytes, s);
  const line = (s: string) => { str(s); push(LF); };
  push(ESC, 0x40); push(ESC, 0x74, 0x11);
  push(ESC, 0x61, 0x01); push(ESC, 0x45, 0x01); push(GS, 0x21, 0x11);
  str(order.orderId ?? "00001"); push(LF);
  push(GS, 0x21, 0x00); push(ESC, 0x45, 0x00);
  line("-".repeat(config.separatorLen));
  push(GS, 0x21, 0x01); push(ESC, 0x45, 0x01);
  str((order.serviceTypeName ?? "Xizmat").slice(0, config.charsPerLine)); push(LF);
  push(GS, 0x21, 0x00); push(ESC, 0x45, 0x00);
  push(ESC, 0x61, 0x00);
  if (order.shelf)      line(`Javon: ${order.shelf}`);
  if (order.clientName) line(`Mijoz: ${(order.clientName ?? "").slice(0, 20)}`);
  push(ESC, 0x61, 0x01);
  const d = new Date(order.createdAt ?? Date.now());
  line(`${d.getDate().toString().padStart(2,"0")}.${(d.getMonth()+1).toString().padStart(2,"0")} ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`);
  push(ESC, 0x64, Math.max(1, config.feedLines));
  return new Uint8Array(bytes);
}

// ─── BLE helpers ─────────────────────────────────────────────────────────────
export interface ScannedChar    { uuid: string; props: string[]; isWritable: boolean; }
export interface ScannedService { uuid: string; chars: ScannedChar[]; }

let _device: BluetoothDevice | null = null;
let _char: BluetoothRemoteGATTCharacteristic | null = null;
let _lastProfileName = ""; let _lastServiceUuid = ""; let _lastCharUuid = "";
let _allServices: ScannedService[] = [];
let _onConnectionChange: (() => void) | null = null;

async function writeChunk(char: BluetoothRemoteGATTCharacteristic, chunk: Uint8Array) {
  const c = char as any;
  if (char.properties.writeWithoutResponse && typeof c.writeValueWithoutResponse === "function")
    await c.writeValueWithoutResponse(chunk);
  else if (char.properties.write && typeof c.writeValueWithResponse === "function")
    await c.writeValueWithResponse(chunk);
  else await char.writeValue(chunk);
}

async function sendChunked(char: BluetoothRemoteGATTCharacteristic, data: Uint8Array) {
  const chunkSize = 128;
  for (let i = 0; i < data.length; i += chunkSize) {
    await writeChunk(char, data.slice(i, i + chunkSize));
    await new Promise(r => setTimeout(r, 80));
  }
}

async function findPrinterChar(server: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTCharacteristic> {
  for (const profile of PRINTER_PROFILES) {
    try {
      const svc  = await server.getPrimaryService(profile.svc);
      const ch   = await svc.getCharacteristic(profile.char);
      if (ch.properties.write || ch.properties.writeWithoutResponse) {
        _lastProfileName = profile.name; _lastServiceUuid = profile.svc; _lastCharUuid = profile.char;
        console.log(`[BTPrinter] ✅ ${profile.name}`);
        return ch;
      }
    } catch {}
  }
  _allServices = [];
  let firstWritable: BluetoothRemoteGATTCharacteristic | null = null;
  try {
    const services = await server.getPrimaryServices();
    for (const svc of services) {
      const entry: ScannedService = { uuid: svc.uuid, chars: [] };
      try {
        const chars = await svc.getCharacteristics();
        for (const ch of chars) {
          const p = ch.properties;
          const props: string[] = [];
          if (p.write)               props.push("write");
          if (p.writeWithoutResponse) props.push("writeWithoutResponse");
          if (p.read)   props.push("read");
          if (p.notify) props.push("notify");
          const isWritable = p.write || p.writeWithoutResponse;
          entry.chars.push({ uuid: ch.uuid, props, isWritable: !!isWritable });
          if (isWritable && !firstWritable) {
            firstWritable = ch; _lastServiceUuid = svc.uuid; _lastCharUuid = ch.uuid;
            _lastProfileName = `SCAN(${svc.uuid.slice(4,8)}/${ch.uuid.slice(4,8)})`;
          }
        }
      } catch {}
      _allServices.push(entry);
    }
  } catch (e) {
    throw new Error(`GATT scan xatosi: ${(e as any)?.message ?? e}`);
  }
  if (firstWritable) return firstWritable;
  throw new Error("Yozish imkoniyatiga ega xususiyat topilmadi.");
}

async function connectDevice(): Promise<BluetoothRemoteGATTCharacteristic> {
  if (_device?.gatt?.connected && _char) return _char;
  _char = null; _allServices = [];
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true, optionalServices: ALL_SVC_UUIDS,
  });
  _device = device;
  device.addEventListener("gattserverdisconnected", () => {
    _char = null; _onConnectionChange?.();
  });
  const server = await device.gatt!.connect();
  const ch = await findPrinterChar(server);
  _char = ch; _onConnectionChange?.();
  return ch;
}

function isCancelled(err: unknown): boolean {
  const e = err as any;
  return e?.name === "NotFoundError" ||
    (e?.message ?? "").includes("cancelled") ||
    (e?.message ?? "").includes("chosen") ||
    (e?.message ?? "").includes("no device selected");
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type PrintStatus = "idle" | "connecting" | "printing" | "done" | "error";
export interface PrintLogEntry { time: string; status: "done"|"error"; msg: string; ms: number; }

export interface BTPrinterState {
  print:     (order: any, config?: LabelConfig) => Promise<void>;
  printTspl: (order: any, layout?: TsplLayout)  => Promise<void>;
  printRaw:  (data: Uint8Array, label?: string)  => Promise<void>;
  connect:   () => Promise<void>;
  disconnect: () => void;
  status:      PrintStatus;
  errorMsg:    string | null;
  printerName: string | null;
  profileName: string;
  serviceUuid: string;
  charUuid:    string;
  allServices: ScannedService[];
  isConnected: boolean;
  isSupported: boolean;
  printLog:    PrintLogEntry[];
  labelBytes:  number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useBTPrinter(): BTPrinterState {
  const [status,      setStatus]      = useState<PrintStatus>("idle");
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [serviceUuid, setServiceUuid] = useState("");
  const [charUuid,    setCharUuid]    = useState("");
  const [allServices, setAllServices] = useState<ScannedService[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [printLog,    setPrintLog]    = useState<PrintLogEntry[]>([]);
  const [labelBytes,  setLabelBytes]  = useState(0);

  const isSupported = typeof navigator !== "undefined" && "bluetooth" in navigator;

  useEffect(() => {
    _onConnectionChange = () => {
      const connected = !!(_device?.gatt?.connected && _char);
      setIsConnected(connected);
      setAllServices([..._allServices]);
      if (!connected) { setProfileName(""); setServiceUuid(""); setCharUuid(""); }
    };
    return () => { _onConnectionChange = null; };
  }, []);

  const addLog = (entry: PrintLogEntry) => setPrintLog(prev => [entry, ...prev].slice(0, 10));

  const syncState = () => {
    if (_device?.name) setPrinterName(_device.name);
    setProfileName(_lastProfileName); setServiceUuid(_lastServiceUuid);
    setCharUuid(_lastCharUuid); setAllServices([..._allServices]);
    setIsConnected(true);
  };

  const connect = useCallback(async () => {
    if (!isSupported) { setErrorMsg("Bu brauzer Web Bluetooth'ni qo'llab-quvvatlamaydi."); return; }
    try {
      setStatus("connecting"); setErrorMsg(null);
      await connectDevice(); syncState(); setStatus("idle");
    } catch (err: unknown) {
      const msg = (err as any)?.message ?? "Noma'lum xatolik";
      setStatus("error");
      setErrorMsg(isCancelled(err) ? "Qurilma tanlanmadi (bekor qilindi)" : msg);
      setTimeout(() => setStatus("idle"), 5000);
    }
  }, [isSupported]);

  const print = useCallback(async (order: any, config?: LabelConfig) => {
    if (!isSupported) { setStatus("error"); setErrorMsg("Chrome kerak (BLE)"); return; }
    const t0 = Date.now();
    try {
      setStatus("connecting"); setErrorMsg(null);
      const ch = await connectDevice(); syncState();
      setStatus("printing");
      const label = buildLabel(order, config ?? DEFAULT_LABEL_CONFIG);
      setLabelBytes(label.length);
      await sendChunked(ch, label);
      setStatus("done");
      addLog({ time: new Date().toLocaleTimeString("uz-UZ"), status:"done", msg:`${label.length}B|${_lastProfileName}`, ms:Date.now()-t0 });
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err: unknown) {
      const msg = (err as any)?.message ?? "Noma'lum xatolik";
      const dm  = isCancelled(err) ? "Qurilma tanlanmadi" : msg;
      setStatus("error"); setErrorMsg(dm); _char = null; setIsConnected(false);
      addLog({ time:new Date().toLocaleTimeString("uz-UZ"), status:"error", msg:dm, ms:Date.now()-t0 });
      setTimeout(() => setStatus("idle"), 8000);
    }
  }, [isSupported]);

  const printTspl = useCallback(async (order: any, layout?: TsplLayout) => {
    if (!isSupported) { setStatus("error"); setErrorMsg("Chrome kerak (BLE)"); return; }
    const t0 = Date.now();
    try {
      setStatus("connecting"); setErrorMsg(null);
      const ch = await connectDevice(); syncState();
      setStatus("printing");
      const data = buildTsplReceipt(order, layout);
      setLabelBytes(data.length);
      console.log(`[BTPrinter] TSPL ${data.length}B via ${_lastProfileName}`);
      await sendChunked(ch, data);
      setStatus("done");
      addLog({ time:new Date().toLocaleTimeString("uz-UZ"), status:"done", msg:`TSPL|${data.length}B|${_lastProfileName}`, ms:Date.now()-t0 });
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err: unknown) {
      const msg = (err as any)?.message ?? "Noma'lum xatolik";
      const dm  = isCancelled(err) ? "Qurilma tanlanmadi" : msg;
      setStatus("error"); setErrorMsg(dm); _char = null; setIsConnected(false);
      addLog({ time:new Date().toLocaleTimeString("uz-UZ"), status:"error", msg:dm, ms:Date.now()-t0 });
      setTimeout(() => setStatus("idle"), 8000);
    }
  }, [isSupported]);

  const printRaw = useCallback(async (data: Uint8Array, label = "Raw") => {
    if (!isSupported) return;
    const t0 = Date.now();
    try {
      setStatus("connecting"); setErrorMsg(null);
      const ch = await connectDevice(); syncState();
      setStatus("printing"); setLabelBytes(data.length);
      await sendChunked(ch, data);
      setStatus("done");
      addLog({ time:new Date().toLocaleTimeString("uz-UZ"), status:"done", msg:`${label}|${data.length}B|${_lastProfileName}`, ms:Date.now()-t0 });
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err: unknown) {
      const msg = (err as any)?.message ?? "Noma'lum xatolik";
      const dm  = isCancelled(err) ? "Qurilma tanlanmadi" : msg;
      setStatus("error"); setErrorMsg(dm); _char = null; setIsConnected(false);
      addLog({ time:new Date().toLocaleTimeString("uz-UZ"), status:"error", msg:dm, ms:Date.now()-t0 });
      setTimeout(() => setStatus("idle"), 8000);
    }
  }, [isSupported]);

  const disconnect = useCallback(() => {
    if (_device?.gatt?.connected) _device.gatt.disconnect();
    _device = null; _char = null; _allServices = [];
    _lastProfileName = ""; _lastServiceUuid = ""; _lastCharUuid = "";
    setPrinterName(null); setProfileName(""); setServiceUuid(""); setCharUuid("");
    setAllServices([]); setIsConnected(false); setStatus("idle"); setErrorMsg(null);
  }, []);

  return {
    print, printTspl, printRaw, connect, disconnect,
    status, errorMsg, printerName, profileName,
    serviceUuid, charUuid, allServices, isConnected,
    isSupported, printLog, labelBytes,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────
const BTPrinterContext = createContext<BTPrinterState | null>(null);

export function BTPrinterProvider({ children }: { children: ReactNode }) {
  const value = useBTPrinter();
  return createElement(BTPrinterContext.Provider, { value }, children);
}

export function useBTPrinterContext(): BTPrinterState {
  const ctx = useContext(BTPrinterContext);
  if (!ctx) throw new Error("useBTPrinterContext must be inside <BTPrinterProvider>");
  return ctx;
}

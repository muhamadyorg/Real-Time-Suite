import { useState, useCallback, useEffect, createContext, useContext, createElement, type ReactNode } from "react";

// Known XPrinter / thermal BLE printer service+characteristic pairs (priority order)
export const PRINTER_PROFILES = [
  // XPrinter: FF01 = TX (chop etish), FF02 = RX (status) — FF01 birinchi!
  { svc: "0000ff00-0000-1000-8000-00805f9b34fb", char: "0000ff01-0000-1000-8000-00805f9b34fb", name: "XPrinter-FF01" },
  { svc: "0000ff00-0000-1000-8000-00805f9b34fb", char: "0000ff02-0000-1000-8000-00805f9b34fb", name: "XPrinter-FF02" },
  { svc: "6e400001-b5a3-f393-e0a9-e50e24dcca9e", char: "6e400002-b5a3-f393-e0a9-e50e24dcca9e", name: "NUS (Nordic UART)" },
  { svc: "49535343-fe7d-4ae5-8fa9-9fafd205e455", char: "49535343-1e4d-4bd9-ba61-23c647249616", name: "Isotemp" },
  { svc: "000018f0-0000-1000-8000-00805f9b34fb", char: "000018f1-0000-1000-8000-00805f9b34fb", name: "Peripage" },
  { svc: "0000ae00-0000-1000-8000-00805f9b34fb", char: "0000ae01-0000-1000-8000-00805f9b34fb", name: "AE" },
];

const ALL_SVC_UUIDS = [...new Set(PRINTER_PROFILES.map(p => p.svc))];

export interface LabelConfig {
  paperDots: number;
  feedLines: number;
  separatorLen: number;
  charsPerLine: number;
}

export const DEFAULT_LABEL_CONFIG: LabelConfig = {
  paperDots: 384,
  feedLines: 5,
  separatorLen: 32,
  charsPerLine: 32,
};

export interface ScannedChar {
  uuid: string;
  props: string[];
  isWritable: boolean;
}

export interface ScannedService {
  uuid: string;
  chars: ScannedChar[];
}

export interface DiagInfo {
  deviceName: string;
  deviceId: string;
  profileName: string;
  serviceUuid: string;
  charUuid: string;
  allServices: ScannedService[];
  connectedAt: string;
}

let _device: BluetoothDevice | null = null;
let _char: BluetoothRemoteGATTCharacteristic | null = null;
let _lastProfileName = "";
let _lastServiceUuid = "";
let _lastCharUuid = "";
let _allServices: ScannedService[] = [];
let _onConnectionChange: (() => void) | null = null;

// Fix 3 — CP1251 encoding for Cyrillic / Uzbek characters
function toCP1251(char: string): number {
  const code = char.charCodeAt(0);
  // ASCII — pass through as-is
  if (code < 0x80) return code;
  // А–Я (U+0410–U+042F) → 0xC0–0xDF
  if (code >= 0x0410 && code <= 0x042F) return code - 0x0410 + 0xC0;
  // а–я (U+0430–U+044F) → 0xE0–0xFF
  if (code >= 0x0430 && code <= 0x044F) return code - 0x0430 + 0xE0;
  // Alohida belgilar
  const map: Record<number, number> = {
    0x0401: 0xA8, // Ё
    0x0451: 0xB8, // ё
    0x040E: 0xA1, // Ў
    0x045E: 0xA2, // ў
    0x0490: 0xA5, // Ґ
    0x0491: 0xB4, // ґ
    0x0404: 0xAA, // Є
    0x0454: 0xBA, // є
    0x0407: 0xAF, // Ї
    0x0457: 0xBF, // ї
    0x0406: 0xB2, // І
    0x0456: 0xB3, // і
    0x0402: 0x80, // Ђ
    0x0452: 0x90, // ђ
    0x0403: 0x81, // Ѓ
    0x0453: 0x83, // ѓ
    0x0409: 0x8A, // Љ
    0x0459: 0x9A, // љ
    0x040A: 0x8C, // Њ
    0x045A: 0x9C, // њ
    0x040B: 0x8D, // Ћ
    0x045B: 0x9D, // ћ
    0x040C: 0x8E, // Ќ
    0x045C: 0x9E, // ќ
    0x040F: 0x8F, // Џ
    0x045F: 0x9F, // џ
    0x0408: 0xA3, // Ј
    0x0458: 0xBC, // ј
    0x0405: 0xBD, // Ѕ
    0x0455: 0xBE, // ѕ
  };
  return map[code] ?? 0x3F; // '?' — noma'lum belgi
}

function pushStr(bytes: number[], s: string) {
  for (let i = 0; i < s.length; i++) {
    bytes.push(toCP1251(s[i]));
  }
}

// Minimal test: just plain text + line feeds (no ESC/POS styling)
export function buildSimpleTest(): Uint8Array {
  const bytes: number[] = [];
  const ESC = 0x1B;
  const LF  = 0x0A;
  const push = (...b: number[]) => bytes.push(...b);
  const line = (s: string) => { for (const c of s) push(c.charCodeAt(0) < 128 ? c.charCodeAt(0) : 63); push(LF); };

  push(ESC, 0x40);           // Initialize
  line("================================");
  line("   BT PRINTER TEST - OK!");
  line("================================");
  line("XP-365B ulangan");
  line("FF01 kanal ishlayapti");
  line("--------------------------------");
  push(ESC, 0x64, 0x05);    // Feed 5 lines
  return new Uint8Array(bytes);
}

export function buildLabel(order: any, config: LabelConfig = DEFAULT_LABEL_CONFIG): Uint8Array {
  const bytes: number[] = [];
  const ESC = 0x1B;
  const GS  = 0x1D;
  const LF  = 0x0A;

  const push = (...b: number[]) => bytes.push(...b);
  const str  = (s: string) => pushStr(bytes, s);
  const line = (s: string) => { str(s); push(LF); };

  // Initialize printer
  push(ESC, 0x40);
  // Fix 3 — CP1251 kod sahifasini tanlash (Kirill harflari to'g'ri chiqishi uchun)
  push(ESC, 0x74, 0x11);

  // Order ID — center, bold, double-width+height
  push(ESC, 0x61, 0x01);
  push(ESC, 0x45, 0x01);
  push(GS, 0x21, 0x11);
  str(order.orderId ?? "00001");
  push(LF);
  push(GS, 0x21, 0x00);
  push(ESC, 0x45, 0x00);

  // Separator
  line("-".repeat(config.separatorLen));

  // Service — center, bold, double-height
  push(GS, 0x21, 0x01);
  push(ESC, 0x45, 0x01);
  str((order.serviceTypeName ?? "Xizmat").slice(0, config.charsPerLine));
  push(LF);
  push(GS, 0x21, 0x00);
  push(ESC, 0x45, 0x00);

  // Quantity — center, bold, double-width
  push(GS, 0x21, 0x10);
  push(ESC, 0x45, 0x01);
  const qty = order.quantity ?? 1;
  const unit = order.unit ?? "";
  str(`${qty}${unit ? " " + unit : ""}`);
  push(LF);
  push(GS, 0x21, 0x00);
  push(ESC, 0x45, 0x00);

  // Details — left align
  push(ESC, 0x61, 0x00);
  if (order.shelf)      line(`Qolib: ${order.shelf}`);
  if (order.product)    line(`Mahsulot: ${(order.product ?? "").slice(0, 20)}`);
  if (order.clientName) line(`Mijoz: ${(order.clientName ?? "").slice(0, 20)}`);

  // Date — center
  push(ESC, 0x61, 0x01);
  const d  = new Date(order.createdAt ?? Date.now());
  const ts = `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1)
    .toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes().toString().padStart(2, "0")}`;
  line(ts);

  // Feed N lines (no FF — more compatible)
  push(ESC, 0x64, Math.max(1, config.feedLines));

  return new Uint8Array(bytes);
}

async function writeChunk(char: BluetoothRemoteGATTCharacteristic, chunk: Uint8Array) {
  const c = char as any;
  if (char.properties.writeWithoutResponse && typeof c.writeValueWithoutResponse === "function") {
    await c.writeValueWithoutResponse(chunk);
  } else if (char.properties.write && typeof c.writeValueWithResponse === "function") {
    await c.writeValueWithResponse(chunk);
  } else {
    await char.writeValue(chunk);
  }
}

async function sendChunked(char: BluetoothRemoteGATTCharacteristic, data: Uint8Array) {
  const chunkSize = 128;
  for (let i = 0; i < data.length; i += chunkSize) {
    await writeChunk(char, data.slice(i, i + chunkSize));
    await new Promise(r => setTimeout(r, 80));
  }
}

async function findPrinterChar(server: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTCharacteristic> {
  // 1. Try known printer profiles first
  for (const profile of PRINTER_PROFILES) {
    try {
      const service = await server.getPrimaryService(profile.svc);
      const char = await service.getCharacteristic(profile.char);
      if (char.properties.write || char.properties.writeWithoutResponse) {
        _lastProfileName = profile.name;
        _lastServiceUuid = profile.svc;
        _lastCharUuid = profile.char;
        console.log(`[BTPrinter] ✅ Profile: ${profile.name}`);
        return char;
      }
    } catch {}
  }

  // 2. Fallback: scan all services
  console.warn("[BTPrinter] No known profile matched. Full scan...");
  _allServices = [];
  let firstWritable: BluetoothRemoteGATTCharacteristic | null = null;

  try {
    const services = await server.getPrimaryServices();
    console.log(`[BTPrinter] ${services.length} services found`);
    for (const svc of services) {
      const svcEntry: ScannedService = { uuid: svc.uuid, chars: [] };
      try {
        const chars = await svc.getCharacteristics();
        for (const ch of chars) {
          const p = ch.properties;
          const props: string[] = [];
          if (p.write) props.push("write");
          if (p.writeWithoutResponse) props.push("writeWithoutResponse");
          if (p.read) props.push("read");
          if (p.notify) props.push("notify");
          if (p.indicate) props.push("indicate");
          const isWritable = p.write || p.writeWithoutResponse;
          svcEntry.chars.push({ uuid: ch.uuid, props, isWritable: !!isWritable });
          console.log(`[BTPrinter]   svc=${svc.uuid.slice(4,8)} char=${ch.uuid.slice(4,8)} [${props.join("|")}]`);
          if (isWritable && !firstWritable) {
            firstWritable = ch;
            _lastServiceUuid = svc.uuid;
            _lastCharUuid = ch.uuid;
            _lastProfileName = `SCAN(${svc.uuid.slice(4, 8)}/${ch.uuid.slice(4, 8)})`;
          }
        }
      } catch (e) {
        console.warn(`[BTPrinter] svc=${svc.uuid} chars error:`, e);
      }
      _allServices.push(svcEntry);
    }
  } catch (e) {
    console.warn("[BTPrinter] getPrimaryServices failed:", e);
    throw new Error(
      `Xizmatlarni o'qib bo'lmadi: ${(e as any)?.message ?? e}\n` +
      "GATT scan muvaffaqiyatsiz. Qurilmani qayta ulang."
    );
  }

  if (firstWritable) {
    console.log(`[BTPrinter] ⚠️ Fallback: ${_lastProfileName}`);
    return firstWritable;
  }

  throw new Error(
    "Yozish imkoniyatiga ega xususiyat topilmadi.\n" +
    `${_allServices.length} xizmat skanerlandi, hech birida 'write' yo'q.\n` +
    "Qurilma printer emas yoki BLE profili qo'llab-quvvatlanmaydi."
  );
}

async function connectDevice(): Promise<BluetoothRemoteGATTCharacteristic> {
  if (_device?.gatt?.connected && _char) {
    console.log(`[BTPrinter] Reusing (${_lastProfileName})`);
    return _char;
  }
  _char = null;
  _allServices = [];

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: ALL_SVC_UUIDS,
  });

  _device = device;
  console.log(`[BTPrinter] Selected: ${device.name ?? "unknown"} id=${device.id}`);

  device.addEventListener("gattserverdisconnected", () => {
    console.log("[BTPrinter] Disconnected");
    _char = null;
    _onConnectionChange?.();
  });

  const server = await device.gatt!.connect();
  console.log("[BTPrinter] GATT connected");
  const char = await findPrinterChar(server);
  _char = char;
  _onConnectionChange?.();
  return char;
}

export type PrintStatus = "idle" | "connecting" | "printing" | "done" | "error";

export interface PrintLogEntry {
  time: string;
  status: "done" | "error";
  msg: string;
  ms: number;
}

export interface BTPrinterState {
  print: (order: any, config?: LabelConfig) => Promise<void>;
  printRaw: (data: Uint8Array, label?: string) => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
  status: PrintStatus;
  errorMsg: string | null;
  printerName: string | null;
  profileName: string;
  serviceUuid: string;
  charUuid: string;
  allServices: ScannedService[];
  isConnected: boolean;
  isSupported: boolean;
  printLog: PrintLogEntry[];
  labelBytes: number;
}

// Fix 6 — ishonchli "bekor qilindi" aniqlash
function isCancelled(err: unknown): boolean {
  const e = err as any;
  return (
    e?.name === "NotFoundError" ||
    (e?.message ?? "").includes("cancelled") ||
    (e?.message ?? "").includes("chosen") ||
    (e?.message ?? "").includes("no device selected")
  );
}

export function useBTPrinter(): BTPrinterState {
  const [status, setStatus] = useState<PrintStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [serviceUuid, setServiceUuid] = useState("");
  const [charUuid, setCharUuid] = useState("");
  const [allServices, setAllServices] = useState<ScannedService[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [printLog, setPrintLog] = useState<PrintLogEntry[]>([]);
  const [labelBytes, setLabelBytes] = useState(0);

  const isSupported =
    typeof navigator !== "undefined" &&
    "bluetooth" in navigator;

  useEffect(() => {
    _onConnectionChange = () => {
      const connected = !!(_device?.gatt?.connected && _char);
      setIsConnected(connected);
      setAllServices([..._allServices]);
      if (!connected) {
        setProfileName("");
        setServiceUuid("");
        setCharUuid("");
      }
    };
    return () => { _onConnectionChange = null; };
  }, []);

  const addLog = (entry: PrintLogEntry) => {
    setPrintLog(prev => [entry, ...prev].slice(0, 10));
  };

  const connect = useCallback(async () => {
    if (!isSupported) {
      setErrorMsg("Bu brauzer Web Bluetooth'ni qo'llab-quvvatlamaydi. Chrome ishlating.");
      return;
    }
    try {
      setStatus("connecting");
      setErrorMsg(null);
      await connectDevice();
      if (_device?.name) setPrinterName(_device.name);
      setProfileName(_lastProfileName);
      setServiceUuid(_lastServiceUuid);
      setCharUuid(_lastCharUuid);
      setAllServices([..._allServices]);
      setIsConnected(true);
      setStatus("idle");
    } catch (err: unknown) {
      const msg: string = (err as any)?.message ?? "Noma'lum xatolik";
      // Fix 6
      setStatus("error");
      setErrorMsg(isCancelled(err) ? "Qurilma tanlanmadi (bekor qilindi)" : msg);
      setTimeout(() => { setStatus("idle"); }, 5000);
    }
  }, [isSupported]);

  const print = useCallback(async (order: any, config?: LabelConfig) => {
    if (!isSupported) {
      setStatus("error");
      setErrorMsg("Bu brauzer Web Bluetooth'ni qo'llab-quvvatlamaydi. Chrome ishlating.");
      return;
    }
    const t0 = Date.now();
    try {
      setStatus("connecting");
      setErrorMsg(null);

      const char = await connectDevice();
      if (_device?.name) setPrinterName(_device.name);
      setProfileName(_lastProfileName);
      setServiceUuid(_lastServiceUuid);
      setCharUuid(_lastCharUuid);
      setAllServices([..._allServices]);
      setIsConnected(true);

      setStatus("printing");
      const label = buildLabel(order, config ?? DEFAULT_LABEL_CONFIG);
      setLabelBytes(label.length);
      console.log(`[BTPrinter] Sending ${label.length} bytes via ${_lastProfileName}...`);
      await sendChunked(char, label);
      console.log("[BTPrinter] ✅ Done!");
      setStatus("done");
      addLog({
        time: new Date().toLocaleTimeString("uz-UZ"),
        status: "done",
        msg: `${label.length} bayt | ${_lastProfileName}`,
        ms: Date.now() - t0,
      });
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err: unknown) {
      const msg: string = (err as any)?.message ?? "Noma'lum xatolik";
      console.error("[BTPrinter] ❌", err);
      // Fix 6
      const displayMsg = isCancelled(err) ? "Qurilma tanlanmadi (bekor qilindi)" : msg;
      setStatus("error");
      setErrorMsg(displayMsg);
      _char = null;
      setIsConnected(false);
      addLog({
        time: new Date().toLocaleTimeString("uz-UZ"),
        status: "error",
        msg: displayMsg,
        ms: Date.now() - t0,
      });
      setTimeout(() => setStatus("idle"), 8000);
    }
  }, [isSupported]);

  const printRaw = useCallback(async (data: Uint8Array, label = "Raw") => {
    if (!isSupported) return;
    const t0 = Date.now();
    try {
      setStatus("connecting");
      setErrorMsg(null);
      const char = await connectDevice();
      if (_device?.name) setPrinterName(_device.name);
      setProfileName(_lastProfileName);
      setServiceUuid(_lastServiceUuid);
      setCharUuid(_lastCharUuid);
      setAllServices([..._allServices]);
      setIsConnected(true);
      setStatus("printing");
      setLabelBytes(data.length);
      console.log(`[BTPrinter] RAW ${data.length} bytes via ${_lastProfileName}...`);
      await sendChunked(char, data);
      console.log("[BTPrinter] ✅ Raw done!");
      setStatus("done");
      addLog({ time: new Date().toLocaleTimeString("uz-UZ"), status: "done", msg: `${label} | ${data.length} bayt | ${_lastProfileName}`, ms: Date.now() - t0 });
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err: unknown) {
      const msg: string = (err as any)?.message ?? "Noma'lum xatolik";
      // Fix 6
      const displayMsg = isCancelled(err) ? "Qurilma tanlanmadi (bekor qilindi)" : msg;
      setStatus("error");
      setErrorMsg(displayMsg);
      _char = null;
      setIsConnected(false);
      addLog({ time: new Date().toLocaleTimeString("uz-UZ"), status: "error", msg: displayMsg, ms: Date.now() - t0 });
      setTimeout(() => setStatus("idle"), 8000);
    }
  }, [isSupported]);

  const disconnect = useCallback(() => {
    if (_device?.gatt?.connected) _device.gatt.disconnect();
    _device = null;
    _char = null;
    _allServices = [];
    _lastProfileName = "";
    _lastServiceUuid = "";
    _lastCharUuid = "";
    setPrinterName(null);
    setProfileName("");
    setServiceUuid("");
    setCharUuid("");
    setAllServices([]);
    setIsConnected(false);
    setStatus("idle");
    setErrorMsg(null);
  }, []);

  return {
    print, printRaw, connect, disconnect,
    status, errorMsg,
    printerName, profileName,
    serviceUuid, charUuid,
    allServices, isConnected,
    isSupported, printLog, labelBytes,
  };
}

// ─── Fix 2 — BTPrinterContext: bitta instance, barcha komponentlar ushlarni ishlatadi ───

const BTPrinterContext = createContext<BTPrinterState | null>(null);

export function BTPrinterProvider({ children }: { children: ReactNode }) {
  const value = useBTPrinter();
  return createElement(BTPrinterContext.Provider, { value }, children);
}

export function useBTPrinterContext(): BTPrinterState {
  const ctx = useContext(BTPrinterContext);
  if (!ctx) throw new Error("useBTPrinterContext must be used inside <BTPrinterProvider>");
  return ctx;
}

import { useState, useCallback } from "react";

// Known XPrinter / thermal BLE printer service+characteristic pairs (priority order)
const PRINTER_PROFILES = [
  // Standard XPrinter protocol
  { svc: "0000ff00-0000-1000-8000-00805f9b34fb", char: "0000ff02-0000-1000-8000-00805f9b34fb", name: "XPrinter-FF" },
  { svc: "0000ff00-0000-1000-8000-00805f9b34fb", char: "0000ff01-0000-1000-8000-00805f9b34fb", name: "XPrinter-FF01" },
  // Nordic UART Service (NUS)
  { svc: "6e400001-b5a3-f393-e0a9-e50e24dcca9e", char: "6e400002-b5a3-f393-e0a9-e50e24dcca9e", name: "NUS" },
  // Isotemp
  { svc: "49535343-fe7d-4ae5-8fa9-9fafd205e455", char: "49535343-1e4d-4bd9-ba61-23c647249616", name: "Isotemp" },
  // Peripage
  { svc: "000018f0-0000-1000-8000-00805f9b34fb", char: "000018f1-0000-1000-8000-00805f9b34fb", name: "Peripage" },
  // AE
  { svc: "0000ae00-0000-1000-8000-00805f9b34fb", char: "0000ae01-0000-1000-8000-00805f9b34fb", name: "AE" },
];

const ALL_SVC_UUIDS = [...new Set(PRINTER_PROFILES.map(p => p.svc))];

let _device: BluetoothDevice | null = null;
let _char: BluetoothRemoteGATTCharacteristic | null = null;
let _lastProfileName = "";

function pushStr(bytes: number[], s: string) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    bytes.push(c < 128 ? c : 63);
  }
}

// 30x30mm: 240 dots wide, ~16 chars/line normal, ~8 double-width
function buildLabel(order: any): Uint8Array {
  const bytes: number[] = [];
  const ESC = 0x1B;
  const GS  = 0x1D;
  const LF  = 0x0A;
  const FF  = 0x0C;

  const push = (...b: number[]) => bytes.push(...b);
  const str  = (s: string) => pushStr(bytes, s);
  const line = (s: string) => { str(s); push(LF); };

  push(ESC, 0x40);

  // Set print width 240 dots (30mm)
  push(GS, 0x57, 0xF0, 0x00);

  // Order ID — center, bold, double-width
  push(ESC, 0x61, 0x01);
  push(ESC, 0x45, 0x01);
  push(GS, 0x21, 0x10);
  str(order.orderId);
  push(LF);
  push(GS, 0x21, 0x00);
  push(ESC, 0x45, 0x00);

  // Separator
  line("----------------");

  // Service — bold, double-height
  push(GS, 0x21, 0x01);
  push(ESC, 0x45, 0x01);
  str((order.serviceTypeName ?? "").slice(0, 14));
  push(LF);
  push(GS, 0x21, 0x00);
  push(ESC, 0x45, 0x00);

  // Quantity — bold, double-width
  push(GS, 0x21, 0x10);
  push(ESC, 0x45, 0x01);
  str(`${order.quantity}${order.unit ? " " + order.unit : ""}`);
  push(LF);
  push(GS, 0x21, 0x00);
  push(ESC, 0x45, 0x00);

  // Details — left
  push(ESC, 0x61, 0x00);
  if (order.shelf)      line(`Q:${order.shelf}`);
  if (order.product)    line(`M:${(order.product ?? "").slice(0, 15)}`);
  if (order.clientName) line(`C:${(order.clientName ?? "").slice(0, 15)}`);

  // Date — center
  push(ESC, 0x61, 0x01);
  const d  = new Date(order.createdAt);
  const ts = `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1)
    .toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes().toString().padStart(2, "0")}`;
  line(ts);

  push(ESC, 0x64, 0x02);
  push(FF);

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
        console.log(`[BTPrinter] ✅ Found via profile: ${profile.name}`);
        console.log(`[BTPrinter]   svc:  ${profile.svc}`);
        console.log(`[BTPrinter]   char: ${profile.char}`);
        return char;
      }
    } catch {}
  }

  // 2. Fallback: scan all available services
  console.warn("[BTPrinter] No known profile matched. Scanning all services...");
  let foundUuids = "";
  try {
    const services = await server.getPrimaryServices();
    console.log(`[BTPrinter] Found ${services.length} services`);
    for (const svc of services) {
      try {
        const chars = await svc.getCharacteristics();
        for (const ch of chars) {
          const props = ch.properties;
          const propStr = [
            props.write ? "write" : "",
            props.writeWithoutResponse ? "writeWithoutResponse" : "",
            props.read ? "read" : "",
            props.notify ? "notify" : "",
          ].filter(Boolean).join("|");
          console.log(`[BTPrinter]   svc=${svc.uuid} char=${ch.uuid} [${propStr}]`);
          if ((props.write || props.writeWithoutResponse) && !foundUuids) {
            foundUuids = `svc=${svc.uuid}\nchar=${ch.uuid}`;
            _lastProfileName = `SCAN(${svc.uuid.slice(4, 8)})`;
            console.log(`[BTPrinter] ⚠️ Using fallback char: ${ch.uuid}`);
            return ch;
          }
        }
      } catch (e) {
        console.warn(`[BTPrinter]   svc=${svc.uuid} → chars error:`, e);
      }
    }
  } catch (e) {
    console.warn("[BTPrinter] getPrimaryServices failed:", e);
  }

  throw new Error(
    "Printer topilmadi.\n" +
    "F12 → Console da [BTPrinter] qatorlarini ko'ring."
  );
}

async function connectAndGetChar(): Promise<BluetoothRemoteGATTCharacteristic> {
  if (_device?.gatt?.connected && _char) {
    console.log(`[BTPrinter] Reusing connection (${_lastProfileName})`);
    return _char;
  }
  _char = null;

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: ALL_SVC_UUIDS,
  });

  _device = device;
  console.log(`[BTPrinter] Device selected: ${device.name ?? "unknown"} (${device.id})`);

  device.addEventListener("gattserverdisconnected", () => {
    console.log("[BTPrinter] Disconnected");
    _char = null;
  });

  const server = await device.gatt!.connect();
  console.log("[BTPrinter] GATT connected, searching for print characteristic...");
  const char = await findPrinterChar(server);
  _char = char;
  return char;
}

export type PrintStatus = "idle" | "connecting" | "printing" | "done" | "error";

export interface BTPrinterState {
  print: (order: any) => Promise<void>;
  disconnect: () => void;
  status: PrintStatus;
  errorMsg: string | null;
  printerName: string | null;
  profileName: string;
  isSupported: boolean;
}

export function useBTPrinter(): BTPrinterState {
  const [status, setStatus] = useState<PrintStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");

  const isSupported =
    typeof navigator !== "undefined" &&
    "bluetooth" in navigator;

  const print = useCallback(async (order: any) => {
    if (!isSupported) {
      setStatus("error");
      setErrorMsg("Bu brauzer Bluetooth'ni qo'llab-quvvatlamaydi. Chrome ishlatng.");
      return;
    }

    try {
      setStatus("connecting");
      setErrorMsg(null);

      const char = await connectAndGetChar();
      if (_device?.name) setPrinterName(_device.name);
      setProfileName(_lastProfileName);

      setStatus("printing");
      const label = buildLabel(order);
      console.log(`[BTPrinter] Sending ${label.length} bytes...`);
      await sendChunked(char, label);
      console.log("[BTPrinter] ✅ Done!");

      setStatus("done");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err: any) {
      const msg: string = err?.message ?? "Noma'lum xatolik";
      console.error("[BTPrinter] ❌ Error:", err);
      setStatus("error");
      const cancelled = msg.includes("cancelled") || msg.includes("chosen") ||
        msg.includes("User cancelled") || err?.code === 8;
      setErrorMsg(cancelled ? null : msg);
      _char = null;
      setTimeout(() => setStatus("idle"), 5000);
    }
  }, [isSupported]);

  const disconnect = useCallback(() => {
    if (_device?.gatt?.connected) _device.gatt.disconnect();
    _device = null;
    _char = null;
    setPrinterName(null);
    setProfileName("");
    setStatus("idle");
  }, []);

  return { print, disconnect, status, errorMsg, printerName, profileName, isSupported };
}

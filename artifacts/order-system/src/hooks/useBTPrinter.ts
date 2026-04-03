import { useState, useCallback } from "react";

// Known XPrinter / thermal BLE printer service+characteristic pairs (priority order)
const PRINTER_PROFILES = [
  // Standard XPrinter protocol
  { svc: "0000ff00-0000-1000-8000-00805f9b34fb", char: "0000ff02-0000-1000-8000-00805f9b34fb" },
  // XPrinter alternative
  { svc: "0000ff00-0000-1000-8000-00805f9b34fb", char: "0000ff01-0000-1000-8000-00805f9b34fb" },
  // Nordic UART Service (NUS) — many BLE printers
  { svc: "6e400001-b5a3-f393-e0a9-e50e24dcca9e", char: "6e400002-b5a3-f393-e0a9-e50e24dcca9e" },
  // Isotemp / legacy
  { svc: "49535343-fe7d-4ae5-8fa9-9fafd205e455", char: "49535343-1e4d-4bd9-ba61-23c647249616" },
  // Peripage
  { svc: "000018f0-0000-1000-8000-00805f9b34fb", char: "000018f1-0000-1000-8000-00805f9b34fb" },
  // AE printer
  { svc: "0000ae00-0000-1000-8000-00805f9b34fb", char: "0000ae01-0000-1000-8000-00805f9b34fb" },
];

const ALL_SVC_UUIDS = [...new Set(PRINTER_PROFILES.map(p => p.svc))];

let _device: BluetoothDevice | null = null;
let _char: BluetoothRemoteGATTCharacteristic | null = null;

function pushStr(bytes: number[], s: string) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    bytes.push(c < 128 ? c : 63);
  }
}

function buildLabel(order: any): Uint8Array {
  const bytes: number[] = [];
  const ESC = 0x1B;
  const GS = 0x1D;
  const LF = 0x0A;
  const FF = 0x0C;

  const push = (...b: number[]) => bytes.push(...b);
  const str = (s: string) => pushStr(bytes, s);
  const line = (s: string) => { str(s); push(LF); };

  // Initialize
  push(ESC, 0x40);

  // Center align
  push(ESC, 0x61, 0x01);

  // Order ID — double width + height, bold
  push(ESC, 0x45, 0x01);
  push(GS, 0x21, 0x11);
  str(order.orderId);
  push(LF);
  push(GS, 0x21, 0x00);
  push(ESC, 0x45, 0x00);

  // Separator
  line("--------------------------------");

  // Service type — double height, bold
  push(GS, 0x21, 0x01);
  push(ESC, 0x45, 0x01);
  str((order.serviceTypeName ?? "").slice(0, 22));
  push(LF);
  push(GS, 0x21, 0x00);
  push(ESC, 0x45, 0x00);

  // Quantity — double width, bold
  push(GS, 0x21, 0x10);
  push(ESC, 0x45, 0x01);
  str(`${order.quantity}${order.unit ? " " + order.unit : ""}`);
  push(LF);
  push(GS, 0x21, 0x00);
  push(ESC, 0x45, 0x00);

  // Left-aligned details
  push(ESC, 0x61, 0x00);
  if (order.shelf) line(`Qolib: ${order.shelf}`);
  if (order.product) line(`Mahsulot: ${(order.product ?? "").slice(0, 20)}`);
  if (order.clientName) line(`Mijoz: ${(order.clientName ?? "").slice(0, 20)}`);

  // Date — centered
  push(ESC, 0x61, 0x01);
  const d = new Date(order.createdAt);
  const ts = `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1)
    .toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes().toString().padStart(2, "0")}`;
  line(ts);

  // Feed + form feed to next label
  push(ESC, 0x64, 0x05);
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
    await new Promise(r => setTimeout(r, 60));
  }
}

async function findPrinterChar(server: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTCharacteristic> {
  const errors: string[] = [];

  for (const profile of PRINTER_PROFILES) {
    try {
      const service = await server.getPrimaryService(profile.svc);
      const char = await service.getCharacteristic(profile.char);
      if (char.properties.write || char.properties.writeWithoutResponse) {
        console.log(`[BTPrinter] Using svc=${profile.svc.slice(0,8)} char=${profile.char.slice(0,8)}`);
        return char;
      }
    } catch (e: any) {
      errors.push(`${profile.svc.slice(4,8)}:${e?.message ?? "fail"}`);
    }
  }

  throw new Error(
    `Printer service topilmadi.\n` +
    `XPrinter X-365B uchun: avval printer ilovasida Bluetooth ulang.\n` +
    `(${errors.slice(0, 3).join(" | ")})`
  );
}

async function connectAndGetChar(): Promise<BluetoothRemoteGATTCharacteristic> {
  if (_device?.gatt?.connected && _char) {
    return _char;
  }

  _char = null;

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: ALL_SVC_UUIDS,
  });

  _device = device;

  device.addEventListener("gattserverdisconnected", () => {
    console.log("[BTPrinter] Disconnected");
    _char = null;
  });

  const server = await device.gatt!.connect();
  const char = await findPrinterChar(server);
  _char = char;
  return char;
}

export type PrintStatus = "idle" | "connecting" | "printing" | "done" | "error";

export function useBTPrinter() {
  const [status, setStatus] = useState<PrintStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [printerName, setPrinterName] = useState<string | null>(null);

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

      setStatus("printing");
      const label = buildLabel(order);
      await sendChunked(char, label);

      setStatus("done");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err: any) {
      const msg: string = err?.message ?? "Noma'lum xatolik";
      setStatus("error");
      if (msg.includes("cancelled") || msg.includes("chosen") || err?.code === 8) {
        setErrorMsg(null);
      } else {
        setErrorMsg(msg);
      }
      // Reset cached connection on error so next press reconnects
      _char = null;
      setTimeout(() => setStatus("idle"), 5000);
    }
  }, [isSupported]);

  const disconnect = useCallback(() => {
    if (_device?.gatt?.connected) _device.gatt.disconnect();
    _device = null;
    _char = null;
    setPrinterName(null);
    setStatus("idle");
  }, []);

  return { print, disconnect, status, errorMsg, printerName, isSupported };
}

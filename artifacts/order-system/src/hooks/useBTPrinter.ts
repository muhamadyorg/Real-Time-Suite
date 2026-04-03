import { useState, useCallback } from "react";

const XPRINTER_SERVICES = [
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ae00-0000-1000-8000-00805f9b34fb",
];

const XPRINTER_WRITE_CHARS = [
  "0000ff02-0000-1000-8000-00805f9b34fb",
  "49535343-1e4d-4bd9-ba61-23c647249616",
  "000018f1-0000-1000-8000-00805f9b34fb",
  "0000ae01-0000-1000-8000-00805f9b34fb",
  "0000ff01-0000-1000-8000-00805f9b34fb",
];

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

  push(ESC, 0x40);

  push(ESC, 0x61, 0x01);

  push(ESC, 0x45, 0x01);
  push(GS, 0x21, 0x11);
  str(order.orderId);
  push(LF);

  push(GS, 0x21, 0x00);
  push(ESC, 0x45, 0x00);

  line("--------------------------------");

  push(GS, 0x21, 0x01);
  push(ESC, 0x45, 0x01);
  const svcName = (order.serviceTypeName ?? "").slice(0, 22);
  str(svcName);
  push(LF);
  push(GS, 0x21, 0x00);
  push(ESC, 0x45, 0x00);

  push(GS, 0x21, 0x10);
  push(ESC, 0x45, 0x01);
  const qty = `${order.quantity}${order.unit ? " " + order.unit : ""}`;
  str(qty);
  push(LF);
  push(GS, 0x21, 0x00);
  push(ESC, 0x45, 0x00);

  push(ESC, 0x61, 0x00);

  if (order.shelf) {
    line(`Qolib: ${order.shelf}`);
  }
  if (order.product) {
    line(`Mahsulot: ${(order.product ?? "").slice(0, 20)}`);
  }
  if (order.clientName) {
    line(`Mijoz: ${(order.clientName ?? "").slice(0, 20)}`);
  }

  push(ESC, 0x61, 0x01);
  const d = new Date(order.createdAt);
  const ts = `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  line(ts);

  push(ESC, 0x64, 0x05);
  push(FF);

  return new Uint8Array(bytes);
}

async function sendChunked(char: BluetoothRemoteGATTCharacteristic, data: Uint8Array, chunkSize = 20) {
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    await char.writeValue(chunk);
    await new Promise(r => setTimeout(r, 40));
  }
}

async function getWriteCharacteristic(server: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTCharacteristic> {
  const services = await server.getPrimaryServices();

  for (const service of services) {
    try {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        const props = char.properties;
        if (props.write || props.writeWithoutResponse) {
          return char;
        }
      }
    } catch {}
  }

  for (const svcUuid of XPRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(svcUuid);
      for (const charUuid of XPRINTER_WRITE_CHARS) {
        try {
          const char = await service.getCharacteristic(charUuid);
          return char;
        } catch {}
      }
    } catch {}
  }

  throw new Error("Yozish xususiyati topilmadi. Printer modelini tekshiring.");
}

async function connectAndGetChar(): Promise<BluetoothRemoteGATTCharacteristic> {
  if (_device?.gatt?.connected && _char) {
    return _char;
  }

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: XPRINTER_SERVICES,
  });

  _device = device;
  device.addEventListener("gattserverdisconnected", () => {
    _char = null;
  });

  const server = await device.gatt!.connect();
  const char = await getWriteCharacteristic(server);
  _char = char;
  return char;
}

export type PrintStatus = "idle" | "connecting" | "printing" | "done" | "error";

export function useBTPrinter() {
  const [status, setStatus] = useState<PrintStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [printerName, setPrinterName] = useState<string | null>(null);

  const isSupported = typeof navigator !== "undefined" && "bluetooth" in navigator;

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
      setStatus("error");
      if (err?.code === 8 || err?.message?.includes("cancelled")) {
        setErrorMsg("Bekor qilindi");
      } else {
        setErrorMsg(err?.message ?? "Noma'lum xatolik");
      }
      setTimeout(() => setStatus("idle"), 4000);
    }
  }, [isSupported]);

  const disconnect = useCallback(() => {
    if (_device?.gatt?.connected) {
      _device.gatt.disconnect();
    }
    _device = null;
    _char = null;
    setPrinterName(null);
    setStatus("idle");
  }, []);

  return { print, disconnect, status, errorMsg, printerName, isSupported };
}

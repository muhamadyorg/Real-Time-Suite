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

// ─── LabelConfig ESC/POS compat ───────────────────────────────────────────────
export interface LabelConfig { paperDots:number; feedLines:number; separatorLen:number; charsPerLine:number; }
export const DEFAULT_LABEL_CONFIG: LabelConfig = { paperDots:384, feedLines:5, separatorLen:32, charsPerLine:32 };

// ─── Free-form TSPL Layout ───────────────────────────────────────────────────
export type HAlign = "left" | "center" | "right";
export type Rotation = 0 | 90 | 180 | 270;

/** Bitta element uchun to'liq sozlama — hech qanday cheklov yo'q */
export interface TsplElementConfig {
  show:     boolean;
  x:        number;     // dots — chap chegara
  y:        number;     // dots — yuqori chegara
  width:    number;     // dots — blok kengligi (matn/separator uchun)
  height:   number;     // dots — separator balandligi; matn uchun auto
  rotation: Rotation;   // 0 | 90 | 180 | 270
  font:     string;     // "1"–"8" TSPL built-in
  xScale:   number;     // 1–10 kenglik ko'paytiruvchi
  yScale:   number;     // 1–10 balandlik ko'paytiruvchi
  align:    HAlign;     // matn hizalashi (rotation=0 da BLOCK yordamida)
  qrSize:   number;     // 1–10 QR cell kenglik (QRCODE uchun)
}

/** Elementlar balandligi (dots) — font va scale asosida */
export const FONT_H: Record<string, number> = {
  "1": 8, "2": 12, "3": 16, "4": 24, "5": 32, "6": 14, "7": 21, "8": 14,
};
export function elHeight(el: TsplElementConfig): number {
  return (FONT_H[el.font] ?? 12) * el.yScale + 4;
}
/** QR kod o'lchamlari dots da (taxminiy) */
export function qrDots(qrSize: number): number {
  return qrSize * 21 + 3;  // version 1 = 21 cells, taxminiy
}

export interface TsplLayout {
  widthMm:  number;
  heightMm: number;   // 0 = auto
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

const DPM = 8;  // dots per mm at 203 DPI

/** 58mm da standart joylar */
function makeDefault(x58: number, y: number, extra: Partial<TsplElementConfig> = {}): TsplElementConfig {
  return {
    show: true, x: x58, y, width: 416, height: 2,
    rotation: 0, font: "2", xScale: 1, yScale: 1, align: "left", qrSize: 4,
    ...extra,
  };
}

export const DEFAULT_TSPL_LAYOUT: TsplLayout = {
  widthMm:  58,
  heightMm: 0,
  elements: {
    storeName:   makeDefault(24,  10,  { font:"3", yScale:1, align:"center", width:416 }),
    orderId:     makeDefault(24,  38,  { align:"center" }),
    dateTime:    makeDefault(24,  56,  { align:"center" }),
    sep1:        makeDefault(24,  76,  { height:2 }),
    serviceType: makeDefault(24,  86,  {}),
    quantity:    makeDefault(24, 104,  {}),
    shelf:       makeDefault(24, 120,  {}),
    clientName:  makeDefault(24, 136,  {}),
    sep2:        makeDefault(24, 154,  { height:2 }),
    qr:          makeDefault(190, 162, { qrSize:4, width:84, height:84 }),
    footer:      makeDefault(24, 260,  { align:"center" }),
  },
};

const LAYOUT_KEY = "tspl-layout-v3";

function loadLayout(): TsplLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return DEFAULT_TSPL_LAYOUT;
    const p = JSON.parse(raw) as TsplLayout;
    // merge — yangi fieldlar bo'lsa default dan to'ldirish
    const merged: TsplLayout = { ...DEFAULT_TSPL_LAYOUT, ...p };
    for (const k of Object.keys(DEFAULT_TSPL_LAYOUT.elements) as Array<keyof TsplLayout["elements"]>) {
      merged.elements[k] = { ...DEFAULT_TSPL_LAYOUT.elements[k], ...(p.elements?.[k] ?? {}) };
    }
    return merged;
  } catch { return DEFAULT_TSPL_LAYOUT; }
}
function saveLayout(l: TsplLayout) {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(l)); } catch {}
}

// ─── TSPL helpers ─────────────────────────────────────────────────────────────
const ALIGN_NUM: Record<HAlign, number> = { left: 0, right: 1, center: 2 };
function esc(s: unknown) { return String(s ?? "").replace(/"/g, "'"); }

export function getOrderNum(order: any): string {
  if (order.orderId) return String(order.orderId).replace(/^#/, "");
  return String(order.id ?? 1).padStart(5, "0");
}

/** TSPL baytlari — to'liq erkin joylashtirish */
export function buildTsplReceipt(order: any, layout: TsplLayout = DEFAULT_TSPL_LAYOUT): Uint8Array {
  const now    = new Date(order.createdAt ?? Date.now());
  const utc5   = new Date(now.getTime() + 5 * 3600_000);
  const pad    = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${pad(utc5.getUTCDate())}.${pad(utc5.getUTCMonth()+1)}.${utc5.getUTCFullYear()}`;
  const timeStr = `${pad(utc5.getUTCHours())}:${pad(utc5.getUTCMinutes())}`;
  const ordNum  = getOrderNum(order);
  const qty     = [order.quantity, order.unit].filter(Boolean).join(" ");
  const origin  = typeof window !== "undefined" ? window.location.origin : "";
  const qrData  = `${origin}/order/${ordNum}`;

  const textMap: Record<string, string> = {
    storeName:   order.storeName ?? "DO'KON",
    orderId:     `Buyurtma #${ordNum}`,
    dateTime:    `${dateStr}  ${timeStr}`,
    serviceType: order.serviceTypeName ?? "Xizmat",
    quantity:    qty ? `Miqdor: ${qty}` : "",
    shelf:       order.shelf ? `Qolib: ${order.shelf}` : "",
    clientName:  order.clientName ? `Mijoz: ${order.clientName}` : "",
    footer:      "Rahmat!",
  };

  const cmds: string[] = [];
  let maxY = 50;

  for (const [key, el] of Object.entries(layout.elements) as [keyof TsplLayout["elements"], TsplElementConfig][]) {
    if (!el.show) continue;
    const { x, y, width, height, rotation, font, xScale, yScale, align, qrSize } = el;

    if (key === "sep1" || key === "sep2") {
      cmds.push(`BAR ${x},${y},${width},${Math.max(1, height)}`);
      maxY = Math.max(maxY, y + height + 2);
    } else if (key === "qr") {
      const qtext = esc(qrData);
      cmds.push(`QRCODE ${x},${y},L,${qrSize},A,${rotation},"${qtext}"`);
      const sz = qrDots(qrSize);
      maxY = Math.max(maxY, y + sz + 8);
    } else {
      const text = textMap[key] ?? "";
      if (!text) continue;
      const h = elHeight(el);
      if (rotation === 0) {
        // BLOCK — hizalashni qo'llab-quvvatlaydi
        cmds.push(`BLOCK ${x},${y},${width},${h},"${font}",0,${xScale},${yScale},${ALIGN_NUM[align]},"${esc(text)}"`);
      } else {
        // TEXT — rotatsiya uchun
        cmds.push(`TEXT ${x},${y},"${font}",${rotation},${xScale},${yScale},"${esc(text)}"`);
      }
      maxY = Math.max(maxY, y + h + 2);
    }
  }

  const autoHmm  = Math.ceil(maxY / DPM / 2) * 2 + 4;
  const heightMm = layout.heightMm > 0 ? layout.heightMm : autoHmm;

  const tspl = [
    `SIZE ${layout.widthMm} mm,${heightMm} mm`,
    "GAP 2 mm,0 mm", "DIRECTION 0", "REFERENCE 0,0", "CLS",
    ...cmds,
    "PRINT 1", "",
  ].join("\r\n");

  return new TextEncoder().encode(tspl);
}

// ─── ESC/POS fallback ─────────────────────────────────────────────────────────
export function buildSimpleTest(): Uint8Array {
  const b: number[] = []; const ESC=0x1B; const LF=0x0A;
  const p=(...n:number[])=>b.push(...n); const l=(s:string)=>{for(const c of s)p(c.charCodeAt(0)<128?c.charCodeAt(0):63);p(LF);};
  p(ESC,0x40);l("================================");l("   BT TEST - OK!");l("================================");p(ESC,0x64,0x05);
  return new Uint8Array(b);
}
export function buildLabel(order: any, config: LabelConfig = DEFAULT_LABEL_CONFIG): Uint8Array {
  const b: number[] = []; const ESC=0x1B;const GS=0x1D;const LF=0x0A;
  const push=(...n:number[])=>b.push(...n);const str=(s:string)=>{for(const c of s)push(c.charCodeAt(0)<128?c.charCodeAt(0):63);};const line=(s:string)=>{str(s);push(LF);};
  push(ESC,0x40);push(ESC,0x61,0x01);push(ESC,0x45,0x01);push(GS,0x21,0x11);str(getOrderNum(order));push(LF);push(GS,0x21,0x00);push(ESC,0x45,0x00);
  line("-".repeat(config.separatorLen));push(ESC,0x61,0x00);if(order.shelf)line(`Qolib: ${order.shelf}`);if(order.clientName)line(`Mijoz: ${(order.clientName??"").slice(0,20)}`);
  push(ESC,0x64,Math.max(1,config.feedLines));return new Uint8Array(b);
}

// ─── BLE internals ────────────────────────────────────────────────────────────
export interface ScannedChar    { uuid:string; props:string[]; isWritable:boolean; }
export interface ScannedService { uuid:string; chars:ScannedChar[]; }

let _device: BluetoothDevice|null=null; let _char: BluetoothRemoteGATTCharacteristic|null=null;
let _lastProfileName=""; let _lastServiceUuid=""; let _lastCharUuid="";
let _allServices: ScannedService[]=[]; let _onConnectionChange:(()=>void)|null=null;

async function writeChunk(char: BluetoothRemoteGATTCharacteristic, chunk: Uint8Array) {
  const c = char as any;
  if (char.properties.writeWithoutResponse && typeof c.writeValueWithoutResponse==="function") await c.writeValueWithoutResponse(chunk);
  else if (char.properties.write && typeof c.writeValueWithResponse==="function") await c.writeValueWithResponse(chunk);
  else await char.writeValue(chunk);
}
async function sendChunked(char: BluetoothRemoteGATTCharacteristic, data: Uint8Array) {
  const sz=128;
  for (let i=0; i<data.length; i+=sz) { await writeChunk(char, data.slice(i,i+sz)); await new Promise(r=>setTimeout(r,80)); }
}

async function findPrinterChar(server: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTCharacteristic> {
  for (const p of PRINTER_PROFILES) {
    try {
      const svc = await server.getPrimaryService(p.svc);
      const ch  = await svc.getCharacteristic(p.char);
      if (ch.properties.write || ch.properties.writeWithoutResponse) {
        _lastProfileName=p.name; _lastServiceUuid=p.svc; _lastCharUuid=p.char; return ch;
      }
    } catch { /* next */ }
  }
  _allServices=[]; let fw: BluetoothRemoteGATTCharacteristic|null=null;
  try {
    const svcs = await server.getPrimaryServices();
    for (const svc of svcs) {
      const entry: ScannedService = { uuid:svc.uuid, chars:[] };
      try {
        const chars = await svc.getCharacteristics();
        for (const ch of chars) {
          const pr=ch.properties; const props:string[]=[];
          if (pr.write) props.push("write");
          if (pr.writeWithoutResponse) props.push("writeWithoutResponse");
          if (pr.read) props.push("read");
          if (pr.notify) props.push("notify");
          const w = pr.write||pr.writeWithoutResponse;
          entry.chars.push({uuid:ch.uuid,props,isWritable:!!w});
          if (w && !fw) { fw=ch; _lastServiceUuid=svc.uuid; _lastCharUuid=ch.uuid; _lastProfileName=`SCAN(${svc.uuid.slice(4,8)}/${ch.uuid.slice(4,8)})`; }
        }
      } catch { /* skip service */ }
      _allServices.push(entry);
    }
  } catch(e) { throw new Error(`GATT scan xatosi: ${(e as any)?.message??e}`); }
  if (fw) return fw;
  throw new Error("Yozish imkoniyatiga ega xususiyat topilmadi.");
}

async function connectDevice(): Promise<BluetoothRemoteGATTCharacteristic> {
  if (_device?.gatt?.connected && _char) return _char;
  _char=null; _allServices=[];
  const d = await navigator.bluetooth.requestDevice({ acceptAllDevices:true, optionalServices:ALL_SVC_UUIDS });
  _device=d;
  d.addEventListener("gattserverdisconnected", ()=>{ _char=null; _onConnectionChange?.(); });
  const server = await d.gatt!.connect();
  const ch = await findPrinterChar(server);
  _char=ch; _onConnectionChange?.(); return ch;
}

function isCancelled(err: unknown): boolean {
  const e=err as any;
  return e?.name==="NotFoundError"||(e?.message??"").includes("cancelled")||(e?.message??"").includes("chosen")||(e?.message??"").includes("no device selected");
}

// ─── State types ──────────────────────────────────────────────────────────────
export type PrintStatus="idle"|"connecting"|"printing"|"done"|"error";
export interface PrintLogEntry { time:string; status:"done"|"error"; msg:string; ms:number; }

export interface BTPrinterState {
  print:       (order:any, config?:LabelConfig)=>Promise<void>;
  printTspl:   (order:any)=>Promise<void>;
  printRaw:    (data:Uint8Array, label?:string)=>Promise<void>;
  connect:     ()=>Promise<void>;
  disconnect:  ()=>void;
  status:       PrintStatus;
  errorMsg:     string|null;
  printerName:  string|null;
  profileName:  string;
  serviceUuid:  string;
  charUuid:     string;
  allServices:  ScannedService[];
  isConnected:  boolean;
  isSupported:  boolean;
  printLog:     PrintLogEntry[];
  labelBytes:   number;
  layout:       TsplLayout;
  setLayout:    (l:TsplLayout)=>void;
  resetLayout:  ()=>void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useBTPrinter(): BTPrinterState {
  const [status,      setStatus]      = useState<PrintStatus>("idle");
  const [errorMsg,    setErrorMsg]    = useState<string|null>(null);
  const [printerName, setPrinterName] = useState<string|null>(null);
  const [profileName, setProfileName] = useState("");
  const [serviceUuid, setServiceUuid] = useState("");
  const [charUuid,    setCharUuid]    = useState("");
  const [allServices, setAllServices] = useState<ScannedService[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [printLog,    setPrintLog]    = useState<PrintLogEntry[]>([]);
  const [labelBytes,  setLabelBytes]  = useState(0);
  const [layout,     _setLayout]      = useState<TsplLayout>(loadLayout);

  const setLayout = useCallback((l: TsplLayout) => { _setLayout(l); saveLayout(l); }, []);
  const resetLayout = useCallback(() => { _setLayout(DEFAULT_TSPL_LAYOUT); saveLayout(DEFAULT_TSPL_LAYOUT); }, []);

  const isSupported = typeof navigator !== "undefined" && "bluetooth" in navigator;

  useEffect(() => {
    _onConnectionChange = () => {
      const c = !!(_device?.gatt?.connected && _char);
      setIsConnected(c); setAllServices([..._allServices]);
      if (!c) { setProfileName(""); setServiceUuid(""); setCharUuid(""); }
    };
    return () => { _onConnectionChange=null; };
  }, []);

  const addLog = (e: PrintLogEntry) => setPrintLog(prev=>[e,...prev].slice(0,10));
  const syncState = () => {
    if (_device?.name) setPrinterName(_device.name);
    setProfileName(_lastProfileName); setServiceUuid(_lastServiceUuid);
    setCharUuid(_lastCharUuid); setAllServices([..._allServices]); setIsConnected(true);
  };

  const connect = useCallback(async()=>{
    if (!isSupported) { setErrorMsg("Chrome kerak"); return; }
    try { setStatus("connecting"); setErrorMsg(null); await connectDevice(); syncState(); setStatus("idle"); }
    catch(err:unknown) { const m=(err as any)?.message??"Xatolik"; setStatus("error"); setErrorMsg(isCancelled(err)?"Qurilma tanlanmadi":m); setTimeout(()=>setStatus("idle"),5000); }
  },[isSupported]);

  const print = useCallback(async(order:any,config?:LabelConfig)=>{
    if (!isSupported) { setStatus("error"); setErrorMsg("Chrome kerak"); return; }
    const t0=Date.now();
    try { setStatus("connecting"); setErrorMsg(null); const ch=await connectDevice(); syncState(); setStatus("printing"); const label=buildLabel(order,config??DEFAULT_LABEL_CONFIG); setLabelBytes(label.length); await sendChunked(ch,label); setStatus("done"); addLog({time:new Date().toLocaleTimeString("uz-UZ"),status:"done",msg:`${label.length}B|${_lastProfileName}`,ms:Date.now()-t0}); setTimeout(()=>setStatus("idle"),3000); }
    catch(err:unknown) { const m=(err as any)?.message??"Xatolik"; const d=isCancelled(err)?"Qurilma tanlanmadi":m; setStatus("error"); setErrorMsg(d); _char=null; setIsConnected(false); addLog({time:new Date().toLocaleTimeString("uz-UZ"),status:"error",msg:d,ms:Date.now()-t0}); setTimeout(()=>setStatus("idle"),8000); }
  },[isSupported]);

  const printTspl = useCallback(async(order:any)=>{
    if (!isSupported) { setStatus("error"); setErrorMsg("Chrome kerak"); return; }
    const t0=Date.now();
    try {
      setStatus("connecting"); setErrorMsg(null);
      const ch = await connectDevice(); syncState();
      setStatus("printing");
      const data = buildTsplReceipt(order, layout);
      setLabelBytes(data.length);
      console.log(`[BTPrinter] TSPL ${data.length}B ordNum=${getOrderNum(order)} via ${_lastProfileName}`);
      await sendChunked(ch, data);
      setStatus("done");
      addLog({time:new Date().toLocaleTimeString("uz-UZ"),status:"done",msg:`TSPL|${data.length}B|${_lastProfileName}`,ms:Date.now()-t0});
      setTimeout(()=>setStatus("idle"),3000);
    } catch(err:unknown) {
      const m=(err as any)?.message??"Xatolik"; const d=isCancelled(err)?"Qurilma tanlanmadi":m;
      setStatus("error"); setErrorMsg(d); _char=null; setIsConnected(false);
      addLog({time:new Date().toLocaleTimeString("uz-UZ"),status:"error",msg:d,ms:Date.now()-t0});
      setTimeout(()=>setStatus("idle"),8000);
    }
  },[isSupported, layout]);

  const printRaw = useCallback(async(data:Uint8Array,label="Raw")=>{
    if (!isSupported) return;
    const t0=Date.now();
    try { setStatus("connecting"); setErrorMsg(null); const ch=await connectDevice(); syncState(); setStatus("printing"); setLabelBytes(data.length); await sendChunked(ch,data); setStatus("done"); addLog({time:new Date().toLocaleTimeString("uz-UZ"),status:"done",msg:`${label}|${data.length}B`,ms:Date.now()-t0}); setTimeout(()=>setStatus("idle"),3000); }
    catch(err:unknown) { const m=(err as any)?.message??"Xatolik"; const d=isCancelled(err)?"Qurilma tanlanmadi":m; setStatus("error"); setErrorMsg(d); _char=null; setIsConnected(false); addLog({time:new Date().toLocaleTimeString("uz-UZ"),status:"error",msg:d,ms:Date.now()-t0}); setTimeout(()=>setStatus("idle"),8000); }
  },[isSupported]);

  const disconnect = useCallback(()=>{
    if (_device?.gatt?.connected) _device.gatt.disconnect();
    _device=null;_char=null;_allServices=[];_lastProfileName="";_lastServiceUuid="";_lastCharUuid="";
    setPrinterName(null);setProfileName("");setServiceUuid("");setCharUuid("");setAllServices([]);setIsConnected(false);setStatus("idle");setErrorMsg(null);
  },[]);

  return { print,printTspl,printRaw,connect,disconnect, status,errorMsg,printerName,profileName,serviceUuid,charUuid,allServices,isConnected,isSupported,printLog,labelBytes, layout,setLayout,resetLayout };
}

// ─── Context ──────────────────────────────────────────────────────────────────
const BTPrinterContext = createContext<BTPrinterState|null>(null);
export function BTPrinterProvider({children}:{children:ReactNode}){
  const v=useBTPrinter(); return createElement(BTPrinterContext.Provider,{value:v},children);
}
export function useBTPrinterContext():BTPrinterState{
  const c=useContext(BTPrinterContext); if(!c)throw new Error("useBTPrinterContext inside <BTPrinterProvider> kerak"); return c;
}

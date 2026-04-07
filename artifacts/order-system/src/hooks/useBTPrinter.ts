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

// ─── LabelConfig (ESC/POS compat) ────────────────────────────────────────────
export interface LabelConfig {
  paperDots: number; feedLines: number; separatorLen: number; charsPerLine: number;
}
export const DEFAULT_LABEL_CONFIG: LabelConfig = { paperDots: 384, feedLines: 5, separatorLen: 32, charsPerLine: 32 };

// ─── TSPL Layout ──────────────────────────────────────────────────────────────
export type HAlign = "left" | "center" | "right";

export interface TsplElementConfig {
  show:    boolean;
  align:   HAlign;
  yOffset: number;   // dots — qo'shimcha vertikal siljish (drag orqali)
}

export interface TsplLayout {
  widthMm:      number;
  heightMm:     number;   // 0 = auto
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
  widthMm:      58,
  heightMm:     0,
  leftMarginMm: 3,
  elements: {
    storeName:   { show: true,  align: "center", yOffset: 0 },
    orderId:     { show: true,  align: "center", yOffset: 0 },
    dateTime:    { show: true,  align: "center", yOffset: 0 },
    sep1:        { show: true,  align: "left",   yOffset: 0 },
    serviceType: { show: true,  align: "left",   yOffset: 0 },
    quantity:    { show: true,  align: "left",   yOffset: 0 },
    shelf:       { show: true,  align: "left",   yOffset: 0 },
    clientName:  { show: true,  align: "left",   yOffset: 0 },
    sep2:        { show: true,  align: "left",   yOffset: 0 },
    qr:          { show: true,  align: "center", yOffset: 0 },
    footer:      { show: true,  align: "center", yOffset: 0 },
  },
};

const LAYOUT_LS_KEY = "tspl-layout-v2";

function loadLayout(): TsplLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_LS_KEY);
    if (!raw) return DEFAULT_TSPL_LAYOUT;
    const parsed = JSON.parse(raw) as TsplLayout;
    // migrate: ensure yOffset present on all elements
    const merged = { ...DEFAULT_TSPL_LAYOUT, ...parsed };
    for (const k of Object.keys(DEFAULT_TSPL_LAYOUT.elements) as Array<keyof TsplLayout["elements"]>) {
      merged.elements[k] = { yOffset: 0, ...DEFAULT_TSPL_LAYOUT.elements[k], ...(parsed.elements?.[k] ?? {}) };
    }
    return merged;
  } catch { return DEFAULT_TSPL_LAYOUT; }
}

function saveLayout(l: TsplLayout) {
  try { localStorage.setItem(LAYOUT_LS_KEY, JSON.stringify(l)); } catch {}
}

// ─── TSPL helpers ─────────────────────────────────────────────────────────────
const ALIGN_NUM: Record<HAlign, number> = { left: 0, right: 1, center: 2 };
function tsplEsc(s: unknown) { return String(s ?? "").replace(/"/g, "'"); }
function block(x: number, y: number, w: number, h: number, font: string, align: HAlign, text: string) {
  return `BLOCK ${x},${y},${w},${h},"${font}",0,1,1,${ALIGN_NUM[align]},"${tsplEsc(text)}"`;
}
function qrX(lx: number, cw: number, align: HAlign, sz = 80) {
  if (align === "center") return lx + Math.round((cw - sz) / 2);
  if (align === "right")  return lx + cw - sz;
  return lx;
}

/** Buyurtma display raqamini olish (orderId > id) */
function getOrderNum(order: any): string {
  if (order.orderId) return String(order.orderId).replace(/^#/, "");
  return String(order.id ?? 1).padStart(5, "0");
}

export interface TsplRow {
  kind:  "block" | "bar" | "qr";
  key:   string;
  label: string;
  y:     number;
  h:     number;
  align: HAlign;
  text?: string;
}

/** Preview va TSPL uchun qatorlar ro'yxatini hisoblash */
export function computeTsplRows(order: any, layout: TsplLayout = DEFAULT_TSPL_LAYOUT): TsplRow[] {
  const DPM   = 8;
  const lx    = Math.round(layout.leftMarginMm * DPM);
  const wDots = Math.round(layout.widthMm * DPM);
  const cw    = wDots - lx * 2;

  const now    = new Date(order.createdAt ?? Date.now());
  const utc5   = new Date(now.getTime() + 5 * 3600_000);
  const pad    = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${pad(utc5.getUTCDate())}.${pad(utc5.getUTCMonth()+1)}.${utc5.getUTCFullYear()}`;
  const timeStr = `${pad(utc5.getUTCHours())}:${pad(utc5.getUTCMinutes())}`;
  const ordNum  = getOrderNum(order);
  const qty     = [order.quantity, order.unit].filter(Boolean).join(" ");
  const el      = layout.elements;

  const rows: TsplRow[] = [];
  let y = 10;

  const push = (key: keyof typeof el, label: string, h: number, text: string) => {
    const cfg = el[key]; if (!cfg.show) return;
    rows.push({ kind: "block", key, label, y: y + cfg.yOffset, h, align: cfg.align, text });
    y += h + 4;
  };
  const pushBar = (key: keyof typeof el) => {
    const cfg = el[key]; if (!cfg.show) return;
    rows.push({ kind: "bar", key, label: "───────", y: y + cfg.yOffset, h: 2, align: cfg.align });
    y += 12;
  };
  const pushQr = (key: keyof typeof el, label: string) => {
    const cfg = el[key]; if (!cfg.show) return;
    rows.push({ kind: "qr", key, label, y: y + cfg.yOffset, h: 90, align: cfg.align });
    y += 100;
  };

  push("storeName",   "Do'kon",     42, order.storeName ?? "DO'KON");
  push("orderId",     "Buyurtma #", 30, `Buyurtma #${ordNum}`);
  push("dateTime",    "Sana/vaqt",  30, `${dateStr}  ${timeStr}`);
  pushBar("sep1");
  push("serviceType", "Xizmat",     28, order.serviceTypeName ?? "Xizmat");
  if (qty)               push("quantity",   "Miqdor", 26, `Miqdor: ${qty}`);
  if (order.shelf)       push("shelf",      "Javon",  26, `Javon: ${order.shelf}`);
  if (order.clientName)  push("clientName", "Mijoz",  26, `Mijoz: ${order.clientName}`);
  pushBar("sep2");
  pushQr("qr",    "QR kod");
  push("footer",  "Rahmat!", 30, "Rahmat!");

  return rows;
}

/** TSPL baytlari (buyurtma + layout) */
export function buildTsplReceipt(order: any, layout: TsplLayout = DEFAULT_TSPL_LAYOUT): Uint8Array {
  const DPM   = 8;
  const lx    = Math.round(layout.leftMarginMm * DPM);
  const wDots = Math.round(layout.widthMm * DPM);
  const cw    = wDots - lx * 2;

  const rows   = computeTsplRows(order, layout);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const ordNum = getOrderNum(order);
  const qrData = `${origin}/order/${ordNum}`;

  let maxY = 10;
  const cmds: string[] = [];

  for (const row of rows) {
    if (row.kind === "block") {
      cmds.push(block(lx, row.y, cw, row.h, row.key === "storeName" ? "3" : "2", row.align, row.text ?? ""));
    } else if (row.kind === "bar") {
      cmds.push(`BAR ${lx},${row.y},${cw},2`);
    } else if (row.kind === "qr") {
      const x = qrX(lx, cw, row.align, 80);
      cmds.push(`QRCODE ${x},${row.y},L,4,A,0,"${tsplEsc(qrData)}"`);
    }
    maxY = row.y + row.h + 4;
  }

  const autoH   = Math.ceil(maxY / DPM / 2) * 2 + 4;
  const heightMm = layout.heightMm > 0 ? layout.heightMm : autoH;

  const tspl = [
    `SIZE ${layout.widthMm} mm,${heightMm} mm`,
    "GAP 2 mm,0 mm", "DIRECTION 0", "REFERENCE 0,0", "CLS",
    ...cmds,
    "PRINT 1", "",
  ].join("\r\n");

  return new TextEncoder().encode(tspl);
}

// ─── Simple test ──────────────────────────────────────────────────────────────
export function buildSimpleTest(): Uint8Array {
  const b: number[] = []; const ESC=0x1B; const LF=0x0A;
  const push = (...n: number[]) => b.push(...n);
  const line = (s: string) => { for (const c of s) push(c.charCodeAt(0)<128?c.charCodeAt(0):63); push(LF); };
  push(ESC,0x40); line("================================"); line("   BT TEST - OK!"); line("================================");
  line("XP-365B ulangan"); push(ESC,0x64,0x05);
  return new Uint8Array(b);
}

export function buildLabel(order: any, config: LabelConfig = DEFAULT_LABEL_CONFIG): Uint8Array {
  const b: number[] = []; const ESC=0x1B; const GS=0x1D; const LF=0x0A;
  const push=(...n:number[])=>b.push(...n); const str=(s:string)=>{for(const c of s)push(c.charCodeAt(0)<128?c.charCodeAt(0):63);}; const line=(s:string)=>{str(s);push(LF);};
  push(ESC,0x40);push(ESC,0x61,0x01);push(ESC,0x45,0x01);push(GS,0x21,0x11);str(getOrderNum(order));push(LF);push(GS,0x21,0x00);push(ESC,0x45,0x00);
  line("-".repeat(config.separatorLen));push(GS,0x21,0x01);push(ESC,0x45,0x01);str((order.serviceTypeName??"Xizmat").slice(0,config.charsPerLine));push(LF);push(GS,0x21,0x00);push(ESC,0x45,0x00);
  push(ESC,0x61,0x00);if(order.shelf)line(`Javon: ${order.shelf}`);if(order.clientName)line(`Mijoz: ${(order.clientName??"").slice(0,20)}`);
  push(ESC,0x61,0x01);const d=new Date(order.createdAt??Date.now());line(`${d.getDate().toString().padStart(2,"0")}.${(d.getMonth()+1).toString().padStart(2,"0")} ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`);
  push(ESC,0x64,Math.max(1,config.feedLines));return new Uint8Array(b);
}

// ─── BLE ──────────────────────────────────────────────────────────────────────
export interface ScannedChar    { uuid:string; props:string[]; isWritable:boolean; }
export interface ScannedService { uuid:string; chars:ScannedChar[]; }

let _device:BluetoothDevice|null=null; let _char:BluetoothRemoteGATTCharacteristic|null=null;
let _lastProfileName=""; let _lastServiceUuid=""; let _lastCharUuid="";
let _allServices:ScannedService[]=[]; let _onConnectionChange:(()=>void)|null=null;

async function writeChunk(char:BluetoothRemoteGATTCharacteristic,chunk:Uint8Array){
  const c=char as any;
  if(char.properties.writeWithoutResponse&&typeof c.writeValueWithoutResponse==="function")await c.writeValueWithoutResponse(chunk);
  else if(char.properties.write&&typeof c.writeValueWithResponse==="function")await c.writeValueWithResponse(chunk);
  else await char.writeValue(chunk);
}
async function sendChunked(char:BluetoothRemoteGATTCharacteristic,data:Uint8Array){
  const sz=128; for(let i=0;i<data.length;i+=sz){await writeChunk(char,data.slice(i,i+sz));await new Promise(r=>setTimeout(r,80));}
}
async function findPrinterChar(server: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTCharacteristic> {
  for (const p of PRINTER_PROFILES) {
    try {
      const svc = await server.getPrimaryService(p.svc);
      const ch  = await svc.getCharacteristic(p.char);
      if (ch.properties.write || ch.properties.writeWithoutResponse) {
        _lastProfileName = p.name; _lastServiceUuid = p.svc; _lastCharUuid = p.char;
        return ch;
      }
    } catch { /* profile not found, try next */ }
  }

  _allServices = [];
  let fw: BluetoothRemoteGATTCharacteristic | null = null;
  try {
    const svcs = await server.getPrimaryServices();
    for (const svc of svcs) {
      const entry: ScannedService = { uuid: svc.uuid, chars: [] };
      try {
        const chars = await svc.getCharacteristics();
        for (const ch of chars) {
          const p = ch.properties;
          const props: string[] = [];
          if (p.write)                props.push("write");
          if (p.writeWithoutResponse) props.push("writeWithoutResponse");
          if (p.read)                 props.push("read");
          if (p.notify)               props.push("notify");
          const w = p.write || p.writeWithoutResponse;
          entry.chars.push({ uuid: ch.uuid, props, isWritable: !!w });
          if (w && !fw) {
            fw = ch;
            _lastServiceUuid  = svc.uuid;
            _lastCharUuid     = ch.uuid;
            _lastProfileName  = `SCAN(${svc.uuid.slice(4,8)}/${ch.uuid.slice(4,8)})`;
          }
        }
      } catch { /* skip service */ }
      _allServices.push(entry);
    }
  } catch (e) {
    throw new Error(`GATT scan xatosi: ${(e as any)?.message ?? e}`);
  }

  if (fw) return fw;
  throw new Error("Yozish imkoniyatiga ega xususiyat topilmadi.");
}
async function connectDevice():Promise<BluetoothRemoteGATTCharacteristic>{
  if(_device?.gatt?.connected&&_char)return _char;
  _char=null;_allServices=[];
  const d=await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:ALL_SVC_UUIDS});
  _device=d;d.addEventListener("gattserverdisconnected",()=>{_char=null;_onConnectionChange?.();});
  const server=await d.gatt!.connect();const ch=await findPrinterChar(server);_char=ch;_onConnectionChange?.();return ch;
}
function isCancelled(err:unknown):boolean{const e=err as any;return e?.name==="NotFoundError"||(e?.message??"").includes("cancelled")||(e?.message??"").includes("chosen")||(e?.message??"").includes("no device selected");}

// ─── Types ────────────────────────────────────────────────────────────────────
export type PrintStatus="idle"|"connecting"|"printing"|"done"|"error";
export interface PrintLogEntry{time:string;status:"done"|"error";msg:string;ms:number;}

export interface BTPrinterState {
  print:      (order:any,config?:LabelConfig)=>Promise<void>;
  printTspl:  (order:any)=>Promise<void>;
  printRaw:   (data:Uint8Array,label?:string)=>Promise<void>;
  connect:    ()=>Promise<void>;
  disconnect: ()=>void;
  status:      PrintStatus;
  errorMsg:    string|null;
  printerName: string|null;
  profileName: string;
  serviceUuid: string;
  charUuid:    string;
  allServices: ScannedService[];
  isConnected: boolean;
  isSupported: boolean;
  printLog:    PrintLogEntry[];
  labelBytes:  number;
  // ─── Global layout (barcha joylarda ishlatiladi) ───
  layout:    TsplLayout;
  setLayout: (l:TsplLayout)=>void;
  resetLayout: ()=>void;
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

  // Global layout — localStorage dan yuklanadi
  const [layout, _setLayout] = useState<TsplLayout>(loadLayout);

  const setLayout = useCallback((l: TsplLayout) => {
    _setLayout(l); saveLayout(l);
  }, []);

  const resetLayout = useCallback(() => {
    _setLayout(DEFAULT_TSPL_LAYOUT); saveLayout(DEFAULT_TSPL_LAYOUT);
  }, []);

  const isSupported = typeof navigator !== "undefined" && "bluetooth" in navigator;

  useEffect(() => {
    _onConnectionChange = () => {
      const connected = !!(_device?.gatt?.connected && _char);
      setIsConnected(connected); setAllServices([..._allServices]);
      if (!connected) { setProfileName(""); setServiceUuid(""); setCharUuid(""); }
    };
    return () => { _onConnectionChange = null; };
  }, []);

  const addLog = (entry: PrintLogEntry) => setPrintLog(prev => [entry,...prev].slice(0,10));
  const syncState = () => {
    if (_device?.name) setPrinterName(_device.name);
    setProfileName(_lastProfileName); setServiceUuid(_lastServiceUuid);
    setCharUuid(_lastCharUuid); setAllServices([..._allServices]); setIsConnected(true);
  };

  const connect = useCallback(async () => {
    if (!isSupported) { setErrorMsg("Chrome kerak (BLE)"); return; }
    try { setStatus("connecting"); setErrorMsg(null); await connectDevice(); syncState(); setStatus("idle"); }
    catch(err:unknown){ const msg=(err as any)?.message??"Xatolik"; setStatus("error"); setErrorMsg(isCancelled(err)?"Qurilma tanlanmadi":msg); setTimeout(()=>setStatus("idle"),5000); }
  }, [isSupported]);

  const print = useCallback(async (order:any,config?:LabelConfig)=>{
    if(!isSupported){setStatus("error");setErrorMsg("Chrome kerak");return;}
    const t0=Date.now();
    try{setStatus("connecting");setErrorMsg(null);const ch=await connectDevice();syncState();setStatus("printing");const label=buildLabel(order,config??DEFAULT_LABEL_CONFIG);setLabelBytes(label.length);await sendChunked(ch,label);setStatus("done");addLog({time:new Date().toLocaleTimeString("uz-UZ"),status:"done",msg:`${label.length}B|${_lastProfileName}`,ms:Date.now()-t0});setTimeout(()=>setStatus("idle"),3000);}
    catch(err:unknown){const msg=(err as any)?.message??"Xatolik";const dm=isCancelled(err)?"Qurilma tanlanmadi":msg;setStatus("error");setErrorMsg(dm);_char=null;setIsConnected(false);addLog({time:new Date().toLocaleTimeString("uz-UZ"),status:"error",msg:dm,ms:Date.now()-t0});setTimeout(()=>setStatus("idle"),8000);}
  },[isSupported]);

  // printTspl — global layoutdan foydalanadi
  const printTspl = useCallback(async (order: any) => {
    if (!isSupported) { setStatus("error"); setErrorMsg("Chrome kerak (BLE)"); return; }
    const t0 = Date.now();
    try {
      setStatus("connecting"); setErrorMsg(null);
      const ch = await connectDevice(); syncState();
      setStatus("printing");
      const data = buildTsplReceipt(order, layout);   // ← global layout
      setLabelBytes(data.length);
      console.log(`[BTPrinter] TSPL ${data.length}B (orderId=${getOrderNum(order)}) via ${_lastProfileName}`);
      await sendChunked(ch, data);
      setStatus("done");
      addLog({ time: new Date().toLocaleTimeString("uz-UZ"), status:"done", msg:`TSPL|${data.length}B|${_lastProfileName}`, ms:Date.now()-t0 });
      setTimeout(() => setStatus("idle"), 3000);
    } catch(err:unknown) {
      const msg=(err as any)?.message??"Xatolik";
      const dm=isCancelled(err)?"Qurilma tanlanmadi":msg;
      setStatus("error"); setErrorMsg(dm); _char=null; setIsConnected(false);
      addLog({ time:new Date().toLocaleTimeString("uz-UZ"), status:"error", msg:dm, ms:Date.now()-t0 });
      setTimeout(()=>setStatus("idle"),8000);
    }
  }, [isSupported, layout]);  // layout dependency — yangi layout saqlanishi bilan yangilanadi

  const printRaw = useCallback(async (data:Uint8Array,label="Raw")=>{
    if(!isSupported)return;
    const t0=Date.now();
    try{setStatus("connecting");setErrorMsg(null);const ch=await connectDevice();syncState();setStatus("printing");setLabelBytes(data.length);await sendChunked(ch,data);setStatus("done");addLog({time:new Date().toLocaleTimeString("uz-UZ"),status:"done",msg:`${label}|${data.length}B|${_lastProfileName}`,ms:Date.now()-t0});setTimeout(()=>setStatus("idle"),3000);}
    catch(err:unknown){const msg=(err as any)?.message??"Xatolik";const dm=isCancelled(err)?"Qurilma tanlanmadi":msg;setStatus("error");setErrorMsg(dm);_char=null;setIsConnected(false);addLog({time:new Date().toLocaleTimeString("uz-UZ"),status:"error",msg:dm,ms:Date.now()-t0});setTimeout(()=>setStatus("idle"),8000);}
  },[isSupported]);

  const disconnect = useCallback(()=>{
    if(_device?.gatt?.connected)_device.gatt.disconnect();
    _device=null;_char=null;_allServices=[];_lastProfileName="";_lastServiceUuid="";_lastCharUuid="";
    setPrinterName(null);setProfileName("");setServiceUuid("");setCharUuid("");setAllServices([]);setIsConnected(false);setStatus("idle");setErrorMsg(null);
  },[]);

  return {
    print,printTspl,printRaw,connect,disconnect,
    status,errorMsg,printerName,profileName,serviceUuid,charUuid,
    allServices,isConnected,isSupported,printLog,labelBytes,
    layout,setLayout,resetLayout,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────
const BTPrinterContext = createContext<BTPrinterState|null>(null);
export function BTPrinterProvider({children}:{children:ReactNode}){
  const value=useBTPrinter();
  return createElement(BTPrinterContext.Provider,{value},children);
}
export function useBTPrinterContext():BTPrinterState{
  const ctx=useContext(BTPrinterContext);
  if(!ctx)throw new Error("useBTPrinterContext must be inside <BTPrinterProvider>");
  return ctx;
}

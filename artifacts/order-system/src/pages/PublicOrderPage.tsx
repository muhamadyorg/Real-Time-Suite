import { useRoute } from "wouter";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, Package, CheckCircle, Clock, AlertCircle, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface PublicOrder {
  id: number;
  orderId: string;
  status: string;
  serviceTypeName: string;
  quantity: number;
  unit?: string | null;
  shelf?: string | null;
  notes?: string | null;
  storeName: string;
  clientName?: string | null;
  clientPhone?: string | null;
  createdByName: string;
  acceptedByName?: string | null;
  acceptedAt?: string | null;
  readyAt?: string | null;
  createdAt: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  new: { label: "Yangi", color: "text-blue-600 bg-blue-50 border-blue-200", icon: <Clock className="w-5 h-5" /> },
  accepted: { label: "Qabul qilindi", color: "text-amber-600 bg-amber-50 border-amber-200", icon: <Package className="w-5 h-5" /> },
  ready: { label: "Tayyor!", color: "text-green-600 bg-green-50 border-green-200", icon: <CheckCircle className="w-5 h-5" /> },
};

export default function PublicOrderPage() {
  const [, params] = useRoute("/order/:orderId");
  const orderId = params?.orderId ?? "";
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    const rawId = orderId.replace(/^#/, "");
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/orders/public/${rawId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setOrder(data);
      })
      .catch(() => setError("Serverga ulanishda xatolik"))
      .finally(() => setLoading(false));
  }, [orderId]);

  const statusInfo = order ? (STATUS_MAP[order.status] ?? { label: order.status, color: "text-gray-600 bg-gray-50 border-gray-200", icon: null }) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-3">
            <Package className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Buyurtma holati</h1>
          <p className="text-sm text-gray-500 mt-1">Buyurtmangiz haqida to'liq ma'lumot</p>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="text-red-700 font-medium">{error}</p>
            <p className="text-red-500 text-sm mt-1">Zakaz #{orderId} topilmadi</p>
          </div>
        )}

        {order && statusInfo && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Status banner */}
            <div className={`flex items-center gap-3 p-4 border-b ${statusInfo.color}`}>
              {statusInfo.icon}
              <div>
                <div className="font-bold text-lg">{statusInfo.label}</div>
                <div className="text-sm opacity-75">Buyurtma holati</div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Order ID */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Zakaz raqami</span>
                <span className="font-bold font-mono text-gray-900">{order.orderId}</span>
              </div>

              {/* Service */}
              <div className="flex justify-between items-center border-t pt-3">
                <span className="text-sm text-gray-500">Xizmat turi</span>
                <span className="font-semibold text-primary">{order.serviceTypeName}</span>
              </div>

              {/* Quantity */}
              <div className="flex justify-between items-center border-t pt-3">
                <span className="text-sm text-gray-500">Miqdor</span>
                <span className="font-bold text-gray-900">
                  {Number.isInteger(order.quantity) ? order.quantity : order.quantity} {order.unit ?? ""}
                </span>
              </div>

              {/* Output Quantity */}
              {order.outputQuantity != null && (
                <div className="flex justify-between items-center border-t pt-3">
                  <span className="text-sm text-gray-500">Chiqish miqdori</span>
                  <span className="font-bold text-green-600 text-lg">
                    {order.outputQuantity} {order.outputUnit ?? ""}
                  </span>
                </div>
              )}

              {/* Qolib */}
              {order.shelf && (
                <div className="flex justify-between items-center border-t pt-3">
                  <span className="text-sm text-gray-500">Qolib</span>
                  <span className="font-mono font-semibold text-gray-900">{order.shelf}</span>
                </div>
              )}

              {/* Client */}
              {order.clientName && (
                <div className="flex justify-between items-center border-t pt-3">
                  <span className="text-sm text-gray-500">Mijoz</span>
                  <span className="font-medium text-gray-900">{order.clientName}</span>
                </div>
              )}
              {order.clientPhone && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Telefon</span>
                  <span className="text-gray-700">{order.clientPhone}</span>
                </div>
              )}

              {/* Store */}
              <div className="flex justify-between items-center border-t pt-3">
                <span className="text-sm text-gray-500">Do'kon</span>
                <span className="font-medium text-gray-900">{order.storeName}</span>
              </div>

              {/* Notes */}
              {order.notes && (
                <div className="border-t pt-3">
                  <span className="text-sm text-gray-500 block mb-1">Izoh</span>
                  <p className="text-gray-700 italic text-sm bg-gray-50 p-2 rounded-lg">{order.notes}</p>
                </div>
              )}

              {/* Timeline */}
              <div className="border-t pt-3 space-y-1.5">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Yaratildi</span>
                  <span>{format(new Date(order.createdAt), "dd.MM.yyyy HH:mm")}</span>
                </div>
                {order.acceptedAt && (
                  <div className="flex justify-between text-xs text-amber-600">
                    <span>Qabul qilindi</span>
                    <span>{format(new Date(order.acceptedAt), "dd.MM.yyyy HH:mm")}</span>
                  </div>
                )}
                {order.readyAt && (
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Tayyor bo'ldi</span>
                    <span>{format(new Date(order.readyAt), "dd.MM.yyyy HH:mm")}</span>
                  </div>
                )}
              </div>

              {/* QR Code */}
              <div className="border-t pt-4 flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Zakaz QR kodi</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                  <QRCodeSVG value={window.location.href} size={150} level="M" />
                </div>
                <p className="text-[10px] text-gray-400 text-center break-all px-2">{window.location.href}</p>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">Buyurtma boshqaruv tizimi &copy; 2025</p>
      </div>
    </div>
  );
}

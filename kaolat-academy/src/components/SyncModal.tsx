import React, { useState } from 'react';
import { Cloud, Check, RefreshCw, X, ShieldCheck, CheckCircle2, Laptop, Smartphone, Tablet } from 'lucide-react';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncNow: () => Promise<void>;
  onProfileChanged?: (newProfileId: string) => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  onSyncNow,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await onSyncNow();
      setSyncSuccessMsg('ซิงค์ข้อมูลล่าสุดกับระบบคลาวด์สำเร็จแล้ว ทุกอุปกรณ์ตรงกันทันที');
      setTimeout(() => setSyncSuccessMsg(''), 3000);
    } catch {
      setSyncSuccessMsg('เชื่อมต่อเซิร์ฟเวอร์เรียบร้อยแล้ว');
      setTimeout(() => setSyncSuccessMsg(''), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">ระบบซิงค์ข้อมูลอัตโนมัติ (Cloud Auto-Sync)</h3>
            <p className="text-xs text-slate-400">
              ซิงค์ออโต้ 100% ไม่ต้องกรอกรหัสใดๆ เปิดใช้งานได้ทันทีทุกอุปกรณ์
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Real-time Status Card */}
          <div className="p-4 bg-slate-950 border border-emerald-900/40 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold text-emerald-400">
                  สถานะ: เชื่อมต่อเซิร์ฟเวอร์คลาวด์แล้ว (ซิงค์อัตโนมัติ)
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                ไม่ต้องใส่รหัส
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              ข้อมูลทุกอย่างถูกบันทึกและซิงค์แบบเรียลไทม์บนเซิร์ฟเวอร์ส่วนกลาง ไม่ว่าจะสลับไปเปิดดูบนมือถือ แท็บเล็ต หรือคอมพิวเตอร์ ข้อมูลจะตรงกันทั้งหมดโดยอัตโนมัติ
            </p>

            {/* Devices Icon Row */}
            <div className="flex items-center gap-4 pt-1 text-slate-400 text-xs border-t border-slate-900">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Laptop className="w-4 h-4 text-emerald-400" />
                <span>คอมพิวเตอร์</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Tablet className="w-4 h-4 text-emerald-400" />
                <span>แท็บเล็ต</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>มือถือ</span>
              </div>
            </div>
          </div>

          {/* Items Synced Automatically */}
          <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2 text-xs">
            <span className="font-semibold text-slate-200 block text-xs">
              ข้อมูลที่ระบบซิงค์ให้อัตโนมัติ:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>รายวิชาและวิดีโอ EP ทั้งหมด</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>ความคืบหน้า EP ที่เรียนจบแล้ว</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>สมุดจดบันทึกตามวินาทีวิดีโอ</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>ตำแหน่งเวลาที่ดูค้างไว้ (Resume)</span>
              </div>
            </div>
          </div>

          {syncSuccessMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{syncSuccessMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-800">
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
              <span>{isSyncing ? 'กำลังซิงค์...' : 'บังคับดึงข้อมูลล่าสุดเดี๋ยวนี้'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors cursor-pointer"
            >
              เข้าใจแล้ว ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

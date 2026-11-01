import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Check, X, ShieldAlert } from 'lucide-react';
import { verifyAdminPass, setAdminKey } from '../services/api';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember30Days, setRemember30Days] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('กรุณากรอกรหัสผ่านแอดมิน');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const isValid = await verifyAdminPass(password.trim());
      if (isValid) {
        setAdminKey(password.trim(), remember30Days);
        setPassword('');
        onSuccess();
        onClose();
      } else {
        setError('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการตรวจสอบรหัสผ่าน');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">เข้าสู่ระบบแอดมิน</h3>
            <p className="text-xs text-slate-400">
              สำหรับผู้สอน/แอดมินเพื่ออัปโหลดคลิปและเพิ่มบทเรียน
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              รหัสผ่านผู้ดูแลระบบ (Admin Passcode)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านผู้ดูแลระบบ"
                autoFocus
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-colors pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember 30 Days Option */}
          <div className="flex items-center gap-2.5 pt-1">
            <input
              type="checkbox"
              id="remember30Days"
              checked={remember30Days}
              onChange={(e) => setRemember30Days(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-950 accent-amber-400 focus:ring-amber-400 focus:ring-offset-slate-900 cursor-pointer"
            />
            <label
              htmlFor="remember30Days"
              className="text-xs text-slate-300 font-medium select-none cursor-pointer"
            >
              บันทึกการเป็นแอดมินบนอุปกรณ์เครื่องนี้ 30 วัน
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 p-2.5 rounded-lg">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 px-4 py-2.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-1/2 px-4 py-2.5 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-xl transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <span>กำลังตรวจสอบ...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>เข้าสู่ระบบ</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

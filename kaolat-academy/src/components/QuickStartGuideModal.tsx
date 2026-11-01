import React from 'react';
import { BookOpen, X, Upload, KeyRound, Play, CheckCircle2, ShieldCheck, Film } from 'lucide-react';

interface QuickStartGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdminLogin: () => void;
}

export const QuickStartGuideModal: React.FC<QuickStartGuideModalProps> = ({
  isOpen,
  onClose,
  onOpenAdminLogin,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-2xl">
            🌰
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">คู่มือการใช้งาน KaoLat Academy</h3>
            <p className="text-xs text-slate-400">
              แพลตฟอร์มเรียนออนไลน์ แยกรายวิชา จัดการ EP และอัปโหลดวิดีโอจากเครื่อง
            </p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-slate-300">
          {/* Step 1: Browse courses & EP */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center shrink-0 font-bold">
              1
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">เลือกรายวิชาและเปิดดู EP (ผู้เรียนทุกคน)</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                ในหน้าแรกมีรายการวิชาต่างๆ เช่น รายการแรกคือ <strong>"ฟิสิกส์ ม.ปลาย"</strong> เมื่อคลิกเข้าไป จะพบกับเพลย์ลิสต์บทเรียนแบ่งเป็น <strong>EP 1, EP 2, EP 3, ...</strong> พร้อมตัวเล่นวิดีโอที่สามารถปรับสปีด, ข้ามไปตามจุดคั่นเวลา (Chapters), จดบันทึกช่วยจำ และทำแบบทดสอบวัดผลได้ทันที
              </p>
            </div>
          </div>

          {/* Step 2: Admin Login */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center shrink-0 font-bold">
              2
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">
                เข้าสู่ระบบแอดมินสำหรับผู้สอน
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                ผู้ที่จะเพิ่มวิชาหรืออัปโหลดคลิปวิดีโอ ต้องกดปุ่ม <strong>"เข้าสู่ระบบแอดมิน"</strong> ที่มุมขวาบน แล้วใส่รหัสผ่านแอดมินที่ได้รับมอบหมาย เพื่อเปิดสิทธิ์การจัดการและอัปโหลดเนื้อหา
              </p>
            </div>
          </div>

          {/* Step 3: Uploading Video Files */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center shrink-0 font-bold">
              3
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">อัปโหลดคลิปจากเครื่องและเปิดดูได้ทุกคน</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                เมื่อเป็นแอดมินแล้ว สามารถกดปุ่ม <strong>"อัปโหลดคลิป EP"</strong> เพื่อเลือกไฟล์วิดีโอ (MP4, WebM, MOV) จากเครื่องคอมพิวเตอร์ของคุณ ระบบจะอัปโหลดขึ้นเซิร์ฟเวอร์แบบสตรีมมิ่ง (HTTP 206 Partial Content) และบันทึกลงฐานข้อมูล ทำให้เมื่อคนอื่นเปิดลิงก์เข้ามา ก็สามารถรับชมคลิปที่คุณอัปโหลดได้ทันที
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              onOpenAdminLogin();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>เข้าสู่ระบบแอดมินทันที</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            เข้าใจแล้ว ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};

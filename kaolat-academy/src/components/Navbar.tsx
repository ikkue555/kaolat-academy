import React from 'react';
import { Lock, Unlock, Plus, Video, Cloud } from 'lucide-react';

interface NavbarProps {
  isAdmin: boolean;
  profileId?: string;
  onOpenSyncModal: () => void;
  onOpenAdminLogin: () => void;
  onLogoutAdmin: () => void;
  onOpenUploadVideo: () => void;
  onOpenAddCourse: () => void;
  onSelectCourseById: (courseId: string) => void;
  onGoHome: () => void;
  onOpenGuide: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isAdmin,
  onOpenSyncModal,
  onOpenAdminLogin,
  onLogoutAdmin,
  onOpenUploadVideo,
  onOpenAddCourse,
  onSelectCourseById,
  onGoHome,
  onOpenGuide,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (Single text element) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onGoHome}
            className="group flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg p-1"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white font-bold text-lg">
              🌰
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-white group-hover:text-amber-400 transition-colors whitespace-nowrap">
                KaoLat Academy
              </span>
              <span className="text-[11px] text-slate-400 -mt-1 hidden sm:inline">
                แพลตฟอร์มเรียนออนไลน์
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: Navigation Links & Sync Status */}
        <nav className="flex items-center gap-4 text-sm font-medium text-slate-300">
          <button
            onClick={onGoHome}
            className="hover:text-amber-400 transition-colors whitespace-nowrap cursor-pointer text-amber-400 font-medium hidden sm:inline"
          >
            รายการวิชาทั้งหมด
          </button>

          <button
            onClick={onOpenSyncModal}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:text-white bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/60 rounded-lg transition-all cursor-pointer shadow-xs"
            title="ระบบซิงค์ข้อมูลอัตโนมัติ 100% ไม่ต้องกรอกรหัส"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Cloud className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline font-medium">ซิงค์ออโต้คลาวด์</span>
            <span className="sm:hidden font-medium">ซิงค์ออโต้</span>
          </button>
        </nav>

        {/* Zone 3: Primary Action / Admin Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenUploadVideo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer"
                title="อัปโหลดไฟล์วิดีโอจากเครื่อง"
              >
                <Video className="w-3.5 h-3.5" />
                <span>อัปโหลดคลิป EP</span>
              </button>
              <button
                onClick={onOpenAddCourse}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                title="สร้างรายวิชาใหม่"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">เพิ่มรายวิชา</span>
                <span className="sm:hidden">เพิ่มวิชา</span>
              </button>
              <button
                onClick={onLogoutAdmin}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/40 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                title="ออกจากระบบแอดมิน"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">แอดมิน (ออก)</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAdminLogin}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>เข้าสู่ระบบแอดมิน</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

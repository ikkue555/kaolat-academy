import React from 'react';
import { Play, Layers, Clock, User, Trash2, Edit2, Upload, ChevronRight } from 'lucide-react';
import { Course } from '../types';

interface CourseCardProps {
  course: Course;
  isAdmin: boolean;
  onSelect: (course: Course) => void;
  onEdit?: (course: Course) => void;
  onDelete?: (course: Course) => void;
  onUploadForCourse?: (courseId: string) => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  isAdmin,
  onSelect,
  onEdit,
  onDelete,
  onUploadForCourse,
}) => {
  return (
    <div className="group relative bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/5">
      {/* Thumbnail Area */}
      <div
        className="relative aspect-video w-full overflow-hidden bg-slate-950 cursor-pointer"
        onClick={() => onSelect(course)}
      >
        <img
          src={course.coverImage}
          alt={course.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Gradient Contrast Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />

        {/* EP count chip */}
        <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-lg text-[11px] font-medium text-amber-400 flex items-center gap-1.5 shadow">
          <Layers className="w-3 h-3" />
          <span>{course.episodes.length} ตอน (EP)</span>
        </div>

        {/* Play Icon Overlay on Hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-12 h-12 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-400/40 transform scale-75 group-hover:scale-100 transition-transform">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>

        {/* Level in bottom right */}
        <div className="absolute bottom-2.5 right-3 text-[11px] text-slate-300 drop-shadow">
          {course.level}
        </div>
      </div>

      {/* Course Info */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Metadata unboxed text with typographic separator */}
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
            <span className="text-amber-400 font-semibold">{course.category}</span>
            <span aria-hidden="true">·</span>
            <span>{course.instructor}</span>
          </div>

          {/* Title */}
          <h3
            onClick={() => onSelect(course)}
            className="text-base font-semibold text-white group-hover:text-amber-400 transition-colors cursor-pointer line-clamp-2"
          >
            {course.title}
          </h3>

          {/* Description */}
          <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
            {course.description || 'คลิกเพื่อเข้าสู่บทเรียนและรับชมคลิปวิดีโอ'}
          </p>

          {/* First 2 EP sneak peek */}
          {course.episodes.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1">
              {course.episodes.slice(0, 2).map((ep) => (
                <div
                  key={ep.id}
                  className="flex items-center justify-between text-[11px] text-slate-400"
                >
                  <span className="truncate flex items-center gap-1.5">
                    <span className="text-amber-400/80 font-mono">EP{ep.epNumber}</span>
                    <span className="text-slate-300 truncate">{ep.title.replace(/^EP\s*\d+:\s*/, '')}</span>
                  </span>
                  <span className="font-mono text-slate-500 shrink-0 ml-2">{ep.duration}</span>
                </div>
              ))}
              {course.episodes.length > 2 && (
                <div className="text-[10px] text-slate-500">
                  + อีก {course.episodes.length - 2} ตอน
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions Bottom Bar */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => onSelect(course)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 cursor-pointer"
          >
            <span>เข้าสู่ห้องเรียน</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {isAdmin && (
            <div className="flex items-center gap-1">
              {onUploadForCourse && (
                <button
                  onClick={() => onUploadForCourse(course.id)}
                  className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="อัปโหลดคลิป EP เพิ่ม"
                >
                  <Upload className="w-3.5 h-3.5" />
                </button>
              )}
              {onEdit && (
                <button
                  onClick={() => onEdit(course)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="แก้ไขรายวิชา"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(course)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="ลบรายวิชา"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

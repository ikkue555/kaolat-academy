import React, { useState, useRef } from 'react';
import { BookOpen, X, Check, AlertCircle, Upload, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Course } from '../types';
import { createCourse, updateCourse, uploadImageFile } from '../services/api';

interface AddCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (course: Course) => void;
  courseToEdit?: Course | null;
}

const PRESET_COVERS = [
  { label: 'ฟิสิกส์ (Physics)', url: '/src/assets/images/physics_course_cover_1793422048834.jpg' },
  { label: 'เคมี (Chemistry)', url: '/src/assets/images/chemistry_course_cover_1793422050100.jpg' },
  { label: 'คณิตศาสตร์ (Calculus & Math)', url: '/src/assets/images/math_course_cover_1793422051493.jpg' },
  { label: 'ชีววิทยา (Biology)', url: '/src/assets/images/biology_course_cover_1793422050490.jpg' },
  { label: 'ห้องเรียนรวม (Learning Hall)', url: '/src/assets/images/hero_learning_banner_1793422048822.jpg' },
];

export const AddCourseModal: React.FC<AddCourseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  courseToEdit,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('ฟิสิกส์');
  const [instructor, setInstructor] = useState('');
  const [level, setLevel] = useState('ม.ปลาย');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState(PRESET_COVERS[0].url);
  const [customImageFile, setCustomImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // Sync form state when modal opens or courseToEdit changes
  React.useEffect(() => {
    if (!isOpen) {
      setCustomImageFile(null);
      setImagePreview(null);
      setError('');
      setLoading(false);
      setIsUploadingImage(false);
      return;
    }

    if (courseToEdit) {
      setTitle(courseToEdit.title || '');
      setCategory(courseToEdit.category || 'ฟิสิกส์');
      setInstructor(courseToEdit.instructor || '');
      setLevel(courseToEdit.level || 'ม.ปลาย');
      setDescription(courseToEdit.description || '');
      setCoverImage(courseToEdit.coverImage || PRESET_COVERS[0].url);
      setImagePreview(courseToEdit.coverImage || null);
    } else {
      setTitle('');
      setCategory('ฟิสิกส์');
      setInstructor('');
      setLevel('ม.ปลาย');
      setDescription('');
      setCoverImage(PRESET_COVERS[0].url);
      setImagePreview(null);
    }
    setCustomImageFile(null);
    setError('');
  }, [isOpen, courseToEdit]);

  if (!isOpen) return null;

  const handleImageFileChange = (file: File) => {
    if (!file.type.startsWith('image/') && !/\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i.test(file.name)) {
      setError('กรุณาเลือกไฟล์รูปภาพ (.jpg, .png, .webp)');
      return;
    }
    setError('');
    setCustomImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('กรุณากรอกชื่อรายวิชา');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let finalCoverImage = coverImage;

      // If admin selected an image file from their machine, upload it first
      if (customImageFile) {
        setIsUploadingImage(true);
        try {
          const uploadRes = await uploadImageFile(customImageFile);
          if (uploadRes && uploadRes.imageUrl) {
            finalCoverImage = uploadRes.imageUrl;
          }
        } catch (imgErr: any) {
          console.warn('Image upload error:', imgErr);
          // If upload image fails, fallback to preset cover
          setError(imgErr.message || 'อัปโหลดรูปภาพไม่สำเร็จ');
          setLoading(false);
          setIsUploadingImage(false);
          return;
        }
        setIsUploadingImage(false);
      }

      let savedCourse: Course;
      if (courseToEdit) {
        savedCourse = await updateCourse(courseToEdit.id, {
          title: title.trim(),
          category: category.trim() || 'ทั่วไป',
          instructor: instructor.trim() || 'อาจารย์ผู้สอน',
          level,
          description: description.trim(),
          coverImage: finalCoverImage,
        });
      } else {
        savedCourse = await createCourse({
          title: title.trim(),
          category: category.trim() || 'ทั่วไป',
          instructor: instructor.trim() || 'อาจารย์ผู้สอน',
          level,
          description: description.trim(),
          coverImage: finalCoverImage,
        });
      }

      setLoading(false);
      // Reset form
      setTitle('');
      setInstructor('');
      setDescription('');
      setCustomImageFile(null);
      setImagePreview(null);
      onSuccess(savedCourse);
      onClose();
    } catch (err: any) {
      setLoading(false);
      setIsUploadingImage(false);
      setError(err.message || 'บันทึกรายวิชาไม่สำเร็จ');
    }
  };

  const isEditing = Boolean(courseToEdit);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              {isEditing ? 'แก้ไขข้อมูลรายวิชา' : 'เพิ่มรายวิชาใหม่'}
            </h3>
            <p className="text-xs text-slate-400">
              {isEditing
                ? 'แก้ไขชื่อวิชา หมวดหมู่ รายละเอียด หรือเปลี่ยนภาพหน้าปก'
                : 'สร้างหัวข้อวิชาและอัปโหลดภาพปกจากเครื่องของคุณเอง'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              ชื่อรายวิชา (Course Title) *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น ฟิสิกส์ ม.ปลาย: กลศาสตร์ หรือ เคมีพื้นฐาน"
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                หมวดหมู่วิชา
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="เช่น ฟิสิกส์, เคมี, วิทยาศาสตร์"
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                ระดับชั้น / กลุ่มเป้าหมาย
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
              >
                <option value="ม.ปลาย">มัธยมศึกษาตอนปลาย (ม.4-6)</option>
                <option value="ม.ต้น">มัธยมศึกษาตอนต้น (ม.1-3)</option>
                <option value="มหาวิทยาลัย">อุดมศึกษา / มหาวิทยาลัย</option>
                <option value="ทั่วไป">บุคคลทั่วไป / เพิ่มทักษะ</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              ชื่อผู้สอน / วิทยากร
            </label>
            <input
              type="text"
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              placeholder="เช่น อาจารย์ประจำวิชา"
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              คำอธิบายภาพรวมของวิชา
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="รายละเอียดเนื้อหา สิ่งที่ผู้เรียนจะได้รับในรายวิชานี้..."
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
            />
          </div>

          {/* Upload Cover Image From Local Computer */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                ภาพหน้าปกรายวิชา (อัปโหลดจากเครื่องได้) *
              </label>
              {customImageFile && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomImageFile(null);
                    setImagePreview(null);
                  }}
                  className="text-xs text-rose-400 hover:underline"
                >
                  ล้างภาพที่เลือก
                </button>
              )}
            </div>

            {/* Upload Zone */}
            <div
              onClick={() => imageInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                customImageFile
                  ? 'border-emerald-500/60 bg-emerald-500/5'
                  : 'border-slate-700 hover:border-amber-400/60 bg-slate-950'
              }`}
            >
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleImageFileChange(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {imagePreview ? (
                <div className="flex items-center gap-4">
                  <img
                    src={imagePreview}
                    alt="ภาพปกที่เลือก"
                    className="w-24 h-16 object-cover rounded-lg border border-slate-700 shadow"
                  />
                  <div className="text-left flex-1 min-w-0">
                    <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>เลือกภาพจากเครื่องสำเร็จ</span>
                    </div>
                    <div className="text-xs text-slate-300 truncate mt-0.5">
                      {customImageFile?.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      คลิกเพื่อเปลี่ยนภาพใหม่
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 py-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 text-amber-400 flex items-center justify-center">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-medium text-white">
                    คลิกเพื่ออัปโหลดภาพปกจากเครื่องของคุณ (.jpg, .png, .webp)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    หรือเลือกจากภาพตัวอย่างด้านล่าง
                  </div>
                </div>
              )}
            </div>

            {/* Presets Fallback Option */}
            {!customImageFile && (
              <div className="mt-3">
                <span className="text-[11px] text-slate-400 block mb-1.5">
                  หรือเลือกภาพปกแนะนำ:
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {PRESET_COVERS.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => setCoverImage(preset.url)}
                      className={`relative rounded-lg overflow-hidden border text-left transition-all cursor-pointer ${
                        coverImage === preset.url
                          ? 'border-amber-400 ring-2 ring-amber-400/40'
                          : 'border-slate-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={preset.label}
                        className="w-full h-12 object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="p-1 bg-slate-950/90 text-[9px] text-slate-300 truncate">
                        {preset.label.split(' ')[0]}
                      </div>
                      {coverImage === preset.url && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 p-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || isUploadingImage}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading || isUploadingImage}
              className="px-5 py-2 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-xl transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              {loading || isUploadingImage ? (
                <span>กำลังบันทึกข้อมูล...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'บันทึกการแก้ไขวิชา' : 'บันทึกรายวิชาทันที'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

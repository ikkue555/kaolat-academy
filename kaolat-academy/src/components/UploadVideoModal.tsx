import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  X,
  Film,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Trash2,
  RefreshCw,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Course, Episode, Chapter } from '../types';
import { uploadVideoFile, addEpisode, updateEpisode } from '../services/api';

interface UploadVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  initialCourseId?: string;
  editingEpisode?: Episode | null;
  onSuccess: (courseId: string) => void;
  onOpenAddCourse?: () => void;
}

export const UploadVideoModal: React.FC<UploadVideoModalProps> = ({
  isOpen,
  onClose,
  courses,
  initialCourseId,
  editingEpisode,
  onSuccess,
  onOpenAddCourse,
}) => {
  // Course selection & Episode metadata states
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [epNumber, setEpNumber] = useState<number>(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('15:00');
  const [summary, setSummary] = useState('');

  // Video file & preview states (Persistent - never wiped on re-renders)
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFileName, setVideoFileName] = useState('');
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  // Upload progress states
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Chapters list
  const [chapters, setChapters] = useState<Chapter[]>([
    { time: '00:00', title: 'เริ่มต้นบทเรียน' },
  ]);

  // Persistent refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeUploadPromiseRef = useRef<Promise<{ videoUrl: string; filename: string }> | null>(null);
  const wasOpenRef = useRef<boolean>(false);

  // Helper to safely revoke old object URLs without leaking RAM
  const revokeActiveBlob = () => {
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
  };

  // Synchronize form ONLY when modal opens (transition from closed to open)
  // NEVER wipes user's video or input while modal is currently open
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      // Abort upload if modal was explicitly closed
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      revokeActiveBlob();
      setLocalPreviewUrl(null);
      return;
    }

    // Modal just opened: initialize form once
    if (!wasOpenRef.current) {
      wasOpenRef.current = true;

      const fallbackCourseId = initialCourseId || (courses.length > 0 ? courses[0].id : '');
      setSelectedCourseId(fallbackCourseId);

      if (editingEpisode) {
        setEpNumber(editingEpisode.epNumber);
        setTitle(editingEpisode.title);
        setDescription(editingEpisode.description || '');
        setDuration(editingEpisode.duration || '15:00');
        setSummary(editingEpisode.summary || '');
        setVideoUrl(editingEpisode.videoUrl || '');
        setVideoFileName(editingEpisode.videoFileName || '');
        setUploadSuccess(Boolean(editingEpisode.videoUrl));
        setChapters(
          editingEpisode.chapters && editingEpisode.chapters.length > 0
            ? [...editingEpisode.chapters]
            : [{ time: '00:00', title: 'เริ่มต้นบทเรียน' }]
        );
        setVideoFile(null);
      } else {
        const targetCourse = courses.find((c) => c.id === fallbackCourseId);
        const nextNum = targetCourse ? targetCourse.episodes.length + 1 : 1;
        setEpNumber(nextNum);
        setTitle(`EP ${nextNum}: `);
        setDescription('');
        setDuration('15:00');
        setSummary('');
        setVideoUrl('');
        setVideoFileName('');
        setUploadSuccess(false);
        setChapters([{ time: '00:00', title: 'เริ่มต้นบทเรียน' }]);
        setVideoFile(null);
      }

      setUploadProgress(0);
      setIsUploading(false);
      setIsSaving(false);
      setError('');
    }
  }, [isOpen, initialCourseId, editingEpisode]);

  // Clean up object URLs on component unmount
  useEffect(() => {
    return () => {
      revokeActiveBlob();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Update next EP number if admin switches target course in dropdown
  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCourseId = e.target.value;
    setSelectedCourseId(newCourseId);
    if (!editingEpisode) {
      const targetCourse = courses.find((c) => c.id === newCourseId);
      const nextNum = targetCourse ? targetCourse.episodes.length + 1 : 1;
      setEpNumber(nextNum);
      if (!title || title.startsWith('EP ')) {
        setTitle(`EP ${nextNum}: `);
      }
    }
  };

  // Start background chunked upload for the selected file
  const startUpload = useCallback(async (file: File) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatusMsg('กำลังเตรียมความพร้อมของไฟล์วิดีโอ...');
    setUploadSuccess(false);
    setError('');

    const uploadPromise = uploadVideoFile(
      file,
      (percent, statusMsg) => {
        setUploadProgress(percent);
        if (statusMsg) {
          setUploadStatusMsg(statusMsg);
        }
      },
      abortController.signal
    );

    activeUploadPromiseRef.current = uploadPromise;

    try {
      const result = await uploadPromise;
      if (result) {
        setVideoUrl(result.videoUrl);
        setVideoFileName(result.filename);
        setUploadProgress(100);
        setUploadStatusMsg('อัปโหลดเสร็จสมบูรณ์');
        setIsUploading(false);
        setUploadSuccess(true);
      }
      return result;
    } catch (err: any) {
      if (abortController.signal.aborted) {
        setIsUploading(false);
        return null;
      }
      setIsUploading(false);
      setUploadStatusMsg('');
      // NOTE: We do NOT clear videoFile or previewUrl on network glitch.
      // The user still has their video attached and can click retry or submit.
      setError(err.message || 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์วิดีโอ');
      throw err;
    }
  }, []);

  // Handle file chosen from machine or drag-and-drop
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('video/') && !/\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(file.name)) {
      setError('กรุณาเลือกไฟล์วิดีโอเท่านั้น (เช่น .mp4, .webm, .mov, .mkv)');
      return;
    }

    setError('');
    setVideoFile(file);
    setVideoFileName(file.name);

    // Create persistent local preview object URL
    revokeActiveBlob();
    const objectUrl = URL.createObjectURL(file);
    activeBlobUrlRef.current = objectUrl;
    setLocalPreviewUrl(objectUrl);

    // Automatically inspect video metadata for accurate duration
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = objectUrl;
    tempVideo.onloadedmetadata = () => {
      const minutes = Math.floor(tempVideo.duration / 60);
      const seconds = Math.floor(tempVideo.duration % 60);
      const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      setDuration(formatted);
    };

    // Immediately trigger background chunked streaming upload (unlimited file size)
    startUpload(file).catch(() => {});
  };

  const handleRetryUpload = () => {
    if (videoFile) {
      startUpload(videoFile).catch(() => {});
    }
  };

  const handleRemoveFile = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    revokeActiveBlob();
    setLocalPreviewUrl(null);
    setVideoFile(null);
    if (!editingEpisode) {
      setVideoUrl('');
      setVideoFileName('');
      setUploadSuccess(false);
    }
    setIsUploading(false);
    setUploadProgress(0);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleAddChapter = () => {
    setChapters([...chapters, { time: '05:00', title: 'หัวข้อใหม่' }]);
  };

  const handleRemoveChapter = (index: number) => {
    setChapters(chapters.filter((_, idx) => idx !== index));
  };

  const handleChapterChange = (index: number, field: 'time' | 'title', val: string) => {
    const updated = [...chapters];
    updated[index][field] = val;
    setChapters(updated);
  };

  // Submit and save episode
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('กรุณากรอกชื่อบทเรียน EP');
      return;
    }

    if (!videoFile && !videoUrl && !editingEpisode?.videoUrl) {
      setError('กรุณาเลือกไฟล์วิดีโอจากเครื่องคอมพิวเตอร์');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      // Auto-resolve or create target course so uploads never fail
      let targetCourseId = selectedCourseId;
      if (!targetCourseId) {
        if (courses.length > 0) {
          targetCourseId = courses[0].id;
        }
      }

      let finalVideoUrl = videoUrl;
      let finalFileName = videoFileName;

      // If user selected a file and background upload is still completing, await it
      if (isUploading && activeUploadPromiseRef.current) {
        const uploadResult = await activeUploadPromiseRef.current;
        if (uploadResult) {
          finalVideoUrl = uploadResult.videoUrl;
          finalFileName = uploadResult.filename;
        }
      } else if (videoFile && !finalVideoUrl) {
        // In case it wasn't uploaded yet or errored earlier, run upload now
        const uploadResult = await startUpload(videoFile);
        if (uploadResult) {
          finalVideoUrl = uploadResult.videoUrl;
          finalFileName = uploadResult.filename;
        }
      }

      if (!finalVideoUrl && !editingEpisode?.videoUrl) {
        setIsSaving(false);
        setError('ไม่สามารถอัปโหลดไฟล์วิดีโอได้ กรุณาลองใหม่อีกครั้ง');
        return;
      }

      const validChapters = chapters.filter((c) => c.title.trim());

      if (editingEpisode) {
        await updateEpisode(targetCourseId || selectedCourseId, editingEpisode.id, {
          epNumber,
          title: title.trim(),
          description: description.trim(),
          duration: duration.trim() || '15:00',
          videoUrl: finalVideoUrl || editingEpisode.videoUrl,
          videoFileName: finalFileName || editingEpisode.videoFileName,
          summary: summary.trim(),
          chapters: validChapters,
        });
      } else {
        await addEpisode(targetCourseId, {
          epNumber,
          title: title.trim(),
          description: description.trim(),
          duration: duration.trim() || '15:00',
          videoUrl: finalVideoUrl,
          videoFileName: finalFileName,
          summary: summary.trim(),
          chapters: validChapters,
        });
      }

      setIsSaving(false);
      onSuccess(targetCourseId || selectedCourseId);
      onClose();
    } catch (err: any) {
      setIsSaving(false);
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกบทเรียน');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFileSelect(e.dataTransfer.files[0]);
        }
      }}
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSaving}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>{editingEpisode ? 'แก้ไขข้อมูล EP บทเรียน' : 'อัปโหลดคลิปวิดีโอ & เพิ่ม EP บทเรียน'}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ไม่จำกัดขนาดไฟล์
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              อัปโหลดคลิปไฟล์จริงจากเครื่อง ระบบรองรับไฟล์ขนาดใหญ่แบบไม่จำกัด ทุกคนสามารถเปิดดูได้ทันที
            </p>
          </div>
        </div>

        {/* Upload Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Course Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300">
                เลือกรายวิชาเป้าหมาย *
              </label>
              {onOpenAddCourse && !editingEpisode && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAddCourse();
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ สร้างวิชาใหม่</span>
                </button>
              )}
            </div>
            <select
              value={selectedCourseId}
              onChange={handleCourseChange}
              disabled={!!editingEpisode || isSaving}
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition-colors"
            >
              {courses.length === 0 ? (
                <option value="">-- ยังไม่มีรายวิชาในระบบ (กรุณาสร้างวิชาก่อน) --</option>
              ) : (
                courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title} ({course.category})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Episode Info (EP Number + Title) */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                ลำดับ EP
              </label>
              <input
                type="number"
                min={1}
                value={epNumber}
                onChange={(e) => setEpNumber(Number(e.target.value))}
                disabled={isSaving}
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                ชื่อตอนบทเรียน (EP Title) *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น EP 1: บทนำและการเคลื่อนที่แนวตรง"
                disabled={isSaving}
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Video File Upload Drag & Drop & Preview Zone */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                ไฟล์คลิปวิดีโอจากเครื่องคอมพิวเตอร์ (.mp4, .webm, .mov, .mkv) *
              </label>
              <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>รองรับทุกขนาด ไม่จำกัดความจุ</span>
              </span>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/*"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            {/* When a file is selected or already present */}
            {videoFile || videoUrl ? (
              <div className="border border-slate-700 bg-slate-950 rounded-xl p-4 space-y-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Film className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white break-all line-clamp-1">
                        {videoFile ? videoFile.name : videoFileName || 'คลิปวิดีโอบทเรียน'}
                      </div>
                      <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                        {videoFile && (
                          <span>
                            ขนาดไฟล์: {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                          </span>
                        )}
                        <span>· ความยาวประมาณ: {duration}</span>
                        {uploadSuccess && (
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>อัปโหลดขึ้นเซิร์ฟเวอร์เสร็จสมบูรณ์</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions for the attached clip */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSaving}
                      className="px-2.5 py-1.5 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 rounded-lg transition-colors cursor-pointer border border-amber-400/30 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>เปลี่ยนไฟล์</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      disabled={isSaving}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="ลบคลิปนี้"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Instant Video Preview - Firmly pinned */}
                {(localPreviewUrl || videoUrl) && (
                  <div className="relative rounded-lg overflow-hidden bg-black/60 border border-slate-800">
                    <video
                      key={localPreviewUrl || videoUrl}
                      src={localPreviewUrl || videoUrl}
                      controls
                      playsInline
                      preload="auto"
                      className="w-full max-h-48 object-contain bg-black"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] text-slate-300 flex items-center gap-1">
                      <Play className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                      <span>พรีวิววิดีโอ (เล่นได้ทันที)</span>
                    </div>
                  </div>
                )}

                {/* Background upload progress bar */}
                {isUploading && (
                  <div className="space-y-2 bg-slate-900/90 p-3 rounded-lg border border-amber-500/30">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-300 flex items-center gap-1.5 font-medium min-w-0">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                        <span className="truncate">{uploadStatusMsg || 'กำลังอัปโหลดขึ้นเซิร์ฟเวอร์...'}</span>
                      </span>
                      <span className="font-mono text-amber-400 font-bold ml-2 shrink-0">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>สตรีมชิ้นส่วนขนาด 2MB ปลอดภัย พร้อมระบบกู้คืนอัตโนมัติ</span>
                      <span>{uploadProgress}%</span>
                    </div>
                  </div>
                )}

                {/* Upload Success Badge */}
                {!isUploading && uploadSuccess && (
                  <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      ไฟล์วิดีโอพร้อมแล้ว! บันทึกลงเซิร์ฟเวอร์เรียบร้อย กด "บันทึก EP" ด้านล่างได้เลย
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* Dropzone when no file selected yet */
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-amber-400 bg-amber-500/10 scale-[0.99]'
                    : 'border-slate-700 hover:border-amber-400/60 hover:bg-slate-950/80 bg-slate-950'
                }`}
              >
                <div className="flex flex-col items-center gap-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      คลิกเพื่อเลือกไฟล์วิดีโอ หรือลากไฟล์มาวางที่นี่
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      รองรับ MP4, WebM, MOV, MKV <span className="text-amber-400 font-medium">ไม่จำกัดขนาดไฟล์</span>
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-400 mt-1">
                    <span>⚡ เลือกไฟล์แล้วดูพรีวิวได้ทันที ไม่หายก่อนบันทึกแน่นอน</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Description & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                คำอธิบายบทเรียนย่อ
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="อธิบายสิ่งที่จะได้เรียนรู้ใน EP นี้..."
                disabled={isSaving}
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>ความยาว</span>
              </label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="เช่น 18:45"
                disabled={isSaving}
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Key Formula / Summary */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              สรุปสูตรสำคัญ หรือ ไฮไลต์ประจำ EP
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="เช่น ∑F = ma, v = u + at, งาน W = Fs cos(θ)"
              disabled={isSaving}
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
            />
          </div>

          {/* Chapters / Timestamps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-300">
                จุดคั่นเวลาและหัวข้อย่อยในวิดีโอ (Chapters)
              </label>
              <button
                type="button"
                onClick={handleAddChapter}
                disabled={isSaving}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3 h-3" />
                <span>เพิ่มจุดคั่นเวลา</span>
              </button>
            </div>
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {chapters.map((chap, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chap.time}
                    onChange={(e) => handleChapterChange(idx, 'time', e.target.value)}
                    placeholder="00:00"
                    disabled={isSaving}
                    className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-center font-mono text-white focus:border-amber-400"
                  />
                  <input
                    type="text"
                    value={chap.title}
                    onChange={(e) => handleChapterChange(idx, 'title', e.target.value)}
                    placeholder="หัวข้อย่อย..."
                    disabled={isSaving}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-amber-400"
                  />
                  {chapters.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveChapter(idx)}
                      disabled={isSaving}
                      className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center justify-between gap-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 p-3 rounded-xl">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
              {videoFile && !uploadSuccess && (
                <button
                  type="button"
                  onClick={handleRetryUpload}
                  className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[11px] font-medium shrink-0 cursor-pointer"
                >
                  ลองใหม่อีกครั้ง
                </button>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSaving || (isUploading && !videoUrl)}
              className="px-6 py-2.5 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2"
            >
              {isSaving || isUploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    {isUploading
                      ? `กำลังอัปโหลดคลิป (${uploadProgress}%)...`
                      : 'กำลังบันทึกข้อมูลบทเรียน...'}
                  </span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>{editingEpisode ? 'บันทึกการแก้ไข EP' : 'อัปโหลดคลิป & บันทึก EP'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

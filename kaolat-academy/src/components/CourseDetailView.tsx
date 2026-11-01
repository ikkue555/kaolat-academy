import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Play,
  CheckCircle,
  Clock,
  BookOpen,
  Share2,
  Bookmark,
  Plus,
  Trash2,
  Edit3,
  Upload,
  MessageSquare,
  HelpCircle,
  FileText,
  Send,
  Layers,
  Sparkles,
  Award,
} from 'lucide-react';
import { Course, Episode, Chapter, UserNote } from '../types';
import { VideoPlayer, VideoPlayerRef } from './VideoPlayer';
import {
  deleteEpisode,
  postComment,
  fetchFullSyncState,
  syncProgressToServer,
  syncNoteToServer,
  syncDeleteNoteFromServer,
  syncPlaybackToServer,
} from '../services/api';

interface CourseDetailViewProps {
  course: Course;
  isAdmin: boolean;
  onBack: () => void;
  onOpenUploadVideoForCourse: (courseId: string) => void;
  onEditEpisode: (course: Course, episode: Episode) => void;
  onRefreshCourse: () => void;
  onEditCourse?: (course: Course) => void;
}

export const CourseDetailView: React.FC<CourseDetailViewProps> = ({
  course,
  isAdmin,
  onBack,
  onOpenUploadVideoForCourse,
  onEditEpisode,
  onRefreshCourse,
  onEditCourse,
}) => {
  const [selectedEpId, setSelectedEpId] = useState<string>(
    course.episodes.length > 0 ? course.episodes[0].id : ''
  );
  const [activeTab, setActiveTab] = useState<'overview' | 'summary' | 'chapters' | 'notes' | 'quiz' | 'qa'>('overview');
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(false);

  // User Notes state (stored per course/episode in localStorage)
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');

  // Course Progress tracking (completed episode IDs in localStorage)
  const [completedEpIds, setCompletedEpIds] = useState<string[]>([]);

  // Q&A Comment Form
  const [qaAuthor, setQaAuthor] = useState('');
  const [qaText, setQaText] = useState('');
  const [isSubmittingQa, setIsSubmittingQa] = useState(false);

  // Quiz selected answers
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const playerRef = useRef<VideoPlayerRef | null>(null);

  // Selected episode object
  const currentEpisode = course.episodes.find((ep) => ep.id === selectedEpId) || course.episodes[0];

  // Load progress and notes from server with continuous live cloud auto-sync
  useEffect(() => {
    const savedProgress = localStorage.getItem(`progress_${course.id}`);
    if (savedProgress) {
      try {
        setCompletedEpIds(JSON.parse(savedProgress));
      } catch (e) {}
    }

    const savedNotes = localStorage.getItem(`notes_${course.id}`);
    if (savedNotes) {
      try {
        setNotes(JSON.parse(savedNotes));
      } catch (e) {}
    }

    const loadSyncState = (isInitial = false) => {
      fetchFullSyncState()
        .then((state) => {
          if (state.progress && state.progress[course.id]) {
            setCompletedEpIds(state.progress[course.id]);
            localStorage.setItem(`progress_${course.id}`, JSON.stringify(state.progress[course.id]));
          }
          if (state.notes) {
            setNotes(state.notes);
            localStorage.setItem(`notes_${course.id}`, JSON.stringify(state.notes));
          }
          // If user watched this course on another device, restore episode & timestamp on initial load
          if (isInitial && state.history && state.history[course.id]) {
            const hist = state.history[course.id];
            if (hist.episodeId && course.episodes.some((e) => e.id === hist.episodeId)) {
              setSelectedEpId(hist.episodeId);
              if (hist.timestampSeconds > 5) {
                setTimeout(() => {
                  playerRef.current?.seekTo(hist.timestampSeconds);
                }, 600);
              }
            }
          }
        })
        .catch(() => {});
    };

    loadSyncState(true);

    // Continuous auto-sync interval every 4 seconds
    const interval = setInterval(() => {
      loadSyncState(false);
    }, 4000);

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        loadSyncState(false);
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [course.id]);

  // When episode changes, reset quiz state
  useEffect(() => {
    setQuizAnswers({});
    setQuizSubmitted(false);
  }, [selectedEpId]);

  // Toggle EP completion with immediate Cloud Server Sync
  const toggleEpCompleted = async (epId: string) => {
    const isCompleted = !completedEpIds.includes(epId);
    let updated: string[];
    if (isCompleted) {
      updated = [...completedEpIds, epId];
    } else {
      updated = completedEpIds.filter((id) => id !== epId);
    }
    setCompletedEpIds(updated);
    localStorage.setItem(`progress_${course.id}`, JSON.stringify(updated));

    // Sync to cloud server across all devices
    await syncProgressToServer(course.id, epId, isCompleted);
  };

  // Jump to specific time in video
  const handleJumpToTime = (timeStr: string) => {
    const parts = timeStr.split(':').map(Number);
    let seconds = 0;
    if (parts.length === 2) {
      seconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    playerRef.current?.seekTo(seconds);
  };

  // Add Note with current video timestamp & Cloud Sync
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !currentEpisode) return;

    const currentSeconds = playerRef.current ? Math.floor(playerRef.current.getCurrentTime()) : 0;
    const mins = Math.floor(currentSeconds / 60);
    const secs = currentSeconds % 60;
    const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const newNote: UserNote = {
      id: `note-${Date.now()}`,
      courseId: course.id,
      episodeId: currentEpisode.id,
      timestampSeconds: currentSeconds,
      timestampText: timeFormatted,
      content: newNoteText.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedNotes = [newNote, ...notes];
    setNotes(updatedNotes);
    localStorage.setItem(`notes_${course.id}`, JSON.stringify(updatedNotes));
    setNewNoteText('');

    // Sync note to cloud server
    await syncNoteToServer(newNote);
  };

  const handleDeleteNote = async (noteId: string) => {
    const updated = notes.filter((n) => n.id !== noteId);
    setNotes(updated);
    localStorage.setItem(`notes_${course.id}`, JSON.stringify(updated));

    // Sync note deletion to cloud server
    await syncDeleteNoteFromServer(noteId);
  };

  // Periodic playback sync (every 6 seconds so user can resume on mobile / other browser)
  const handleTimeUpdate = (currTime: number) => {
    const sec = Math.floor(currTime);
    if (sec > 0 && sec % 6 === 0 && currentEpisode) {
      syncPlaybackToServer(course.id, currentEpisode.id, sec);
    }
  };

  // Submit Q&A Comment
  const handleSubmitQa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaText.trim() || !currentEpisode) return;
    setIsSubmittingQa(true);

    try {
      await postComment(course.id, currentEpisode.id, qaAuthor, qaText);
      setQaText('');
      onRefreshCourse();
    } catch (err) {
      alert('ไม่สามารถส่งคำถามได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmittingQa(false);
    }
  };

  // Delete EP (Admin only)
  const handleDeleteEpisode = async (ep: Episode) => {
    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ ${ep.title}?`)) {
      try {
        await deleteEpisode(course.id, ep.id);
        onRefreshCourse();
      } catch (err: any) {
        alert(err.message || 'ลบไม่สำเร็จ');
      }
    }
  };

  const progressPercentage =
    course.episodes.length > 0
      ? Math.round((completedEpIds.length / course.episodes.length) * 100)
      : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-amber-400 transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>กลับหน้ารวมวิชา</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-200">{course.category}</span>
        </button>

        <div className="flex items-center gap-3">
          {/* Progress Pill Indicator */}
          <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            <span>ความคืบหน้า:</span>
            <div className="w-20 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="font-mono text-emerald-400 font-bold">{progressPercentage}%</span>
          </div>

          {/* Admin Edit Course & Add EP Buttons */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              {onEditCourse && (
                <button
                  onClick={() => onEditCourse(course)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="แก้ไขข้อมูลวิชาหรือภาพปก"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>แก้ไขวิชา</span>
                </button>
              )}
              <button
                onClick={() => onOpenUploadVideoForCourse(course.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>อัปโหลดคลิปเพิ่ม EP</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace Layout: Video on Left, EP Playlist on Right */}
      <div
        className={`grid gap-6 transition-all duration-300 ${
          isTheaterMode ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'
        }`}
      >
        {/* Left Column: Video Player & Tabs (lg:col-span-8 or full in theater) */}
        <div className={isTheaterMode ? 'w-full' : 'lg:col-span-8'}>
          {currentEpisode ? (
            <div className="space-y-4">
              {/* Video Player */}
              <VideoPlayer
                ref={playerRef}
                src={currentEpisode.videoUrl}
                title={currentEpisode.title}
                epNumber={currentEpisode.epNumber}
                durationString={currentEpisode.duration}
                isTheaterMode={isTheaterMode}
                onToggleTheaterMode={() => setIsTheaterMode(!isTheaterMode)}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => {
                  if (!completedEpIds.includes(currentEpisode.id)) {
                    toggleEpCompleted(currentEpisode.id);
                  }
                }}
              />

              {/* Title & Episode Meta Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                      <span>{course.title}</span>
                      <span>·</span>
                      <span>{course.category}</span>
                      <span>·</span>
                      <span>{course.level}</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      EP {currentEpisode.epNumber}: {currentEpisode.title}
                    </h2>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>ความยาว {currentEpisode.duration}</span>
                      </span>
                      <span>·</span>
                      <span>ผู้สอน: {course.instructor}</span>
                      {currentEpisode.videoFileName && (
                        <>
                          <span>·</span>
                          <span className="text-slate-500 font-mono text-[11px] truncate max-w-[180px]">
                            {currentEpisode.videoFileName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Complete Checkbox & Admin Action */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleEpCompleted(currentEpisode.id)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl transition-all cursor-pointer ${
                        completedEpIds.includes(currentEpisode.id)
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <CheckCircle
                        className={`w-4 h-4 ${
                          completedEpIds.includes(currentEpisode.id)
                            ? 'text-emerald-400 fill-emerald-400/20'
                            : 'text-slate-500'
                        }`}
                      />
                      <span>
                        {completedEpIds.includes(currentEpisode.id) ? 'เรียนจบแล้ว' : 'ทำเครื่องหมายว่าเรียนแล้ว'}
                      </span>
                    </button>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEditEpisode(course, currentEpisode)}
                          className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="แก้ไข EP นี้"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteEpisode(currentEpisode)}
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="ลบ EP นี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabs Bar */}
              <div className="border-b border-slate-800 flex items-center gap-1 overflow-x-auto pb-1 text-sm font-medium">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'overview'
                      ? 'bg-slate-800 text-amber-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>เนื้อหาบทเรียน</span>
                </button>
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'summary'
                      ? 'bg-slate-800 text-amber-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>สรุปสูตร & ไฮไลต์</span>
                </button>
                <button
                  onClick={() => setActiveTab('chapters')}
                  className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'chapters'
                      ? 'bg-slate-800 text-amber-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>ช่วงเวลา ({currentEpisode.chapters?.length || 0})</span>
                </button>
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'notes'
                      ? 'bg-slate-800 text-amber-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                  <span>สมุดจดบันทึก ({notes.filter((n) => n.episodeId === currentEpisode.id).length})</span>
                </button>
                {currentEpisode.quiz && currentEpisode.quiz.length > 0 && (
                  <button
                    onClick={() => setActiveTab('quiz')}
                    className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'quiz'
                        ? 'bg-slate-800 text-amber-400 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>แบบฝึกหัดทบทวน</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('qa')}
                  className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'qa'
                      ? 'bg-slate-800 text-amber-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>ถาม-ตอบ ({currentEpisode.comments?.length || 0})</span>
                </button>
              </div>

              {/* Tab Contents */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5">
                {/* 1. Overview */}
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-white">รายละเอียดของบทเรียนนี้</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {currentEpisode.description || 'ไม่มีคำอธิบายเพิ่มเติมสำหรับบทเรียนนี้'}
                    </p>

                    <div className="mt-4 pt-4 border-t border-slate-800/80">
                      <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                        คำแนะนำในการเรียน
                      </h4>
                      <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                        <li>สามารถปรับสปีดวิดีโอ (1.25x หรือ 1.5x) ได้ที่ปุ่มควบคุมด้านขวาล่างของตัวเล่น</li>
                        <li>กดที่แถบ <strong>"สมุดจดบันทึก"</strong> เพื่อพิมพ์โน้ตความเข้าใจที่ตรงกับวินาทีของวิดีโอ</li>
                        <li>หากมีข้อสงสัย สามารถพิมพ์ข้อความถามในแท็บ <strong>"ถาม-ตอบ"</strong> ได้เลย</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* 2. Summary & Formulas */}
                {activeTab === 'summary' && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>สรุปสูตรและสาระสำคัญ (Cheat Sheet)</span>
                    </h3>
                    {currentEpisode.summary ? (
                      <div className="p-4 bg-slate-950 border border-amber-500/20 rounded-xl text-sm font-mono text-amber-300/90 leading-relaxed">
                        {currentEpisode.summary}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">ยังไม่มีการบันทึกสรุปสูตรสำหรับ EP นี้</p>
                    )}
                  </div>
                )}

                {/* 3. Chapters / Timestamps */}
                {activeTab === 'chapters' && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-white">
                      คลิกเพื่อข้ามไปยังช่วงเวลาที่ต้องการในคลิป
                    </h3>
                    {currentEpisode.chapters && currentEpisode.chapters.length > 0 ? (
                      <div className="divide-y divide-slate-800">
                        {currentEpisode.chapters.map((chap, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleJumpToTime(chap.time)}
                            className="w-full py-2.5 px-3 flex items-center justify-between text-left hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer group"
                          >
                            <span className="text-sm text-slate-300 group-hover:text-amber-400 transition-colors">
                              {chap.title}
                            </span>
                            <span className="font-mono text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              {chap.time}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">ไม่มีจุดคั่นเวลาสำหรับบทเรียนนี้</p>
                    )}
                  </div>
                )}

                {/* 4. Notes */}
                {activeTab === 'notes' && (
                  <div className="space-y-4">
                    <form onSubmit={handleAddNote} className="space-y-2">
                      <label className="block text-xs font-medium text-slate-300">
                        จดบันทึกช่วยจำ (จะผูกกับเวลาปัจจุบันของวิดีโอโดยอัตโนมัติ)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newNoteText}
                          onChange={(e) => setNewNoteText(e.target.value)}
                          placeholder="พิมพ์ข้อความบันทึกที่นี่ เช่น 'จำสูตร ∑F = ma ให้แม่น'..."
                          className="flex-1 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>บันทึก</span>
                        </button>
                      </div>
                    </form>

                    <div className="space-y-2 pt-2">
                      {notes.filter((n) => n.episodeId === currentEpisode.id).length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4">
                          ยังไม่มีบันทึกสำหรับ EP นี้ ลองพิมพ์จดสิ่งสำคัญไว้ทบทวนได้เลย
                        </p>
                      ) : (
                        notes
                          .filter((n) => n.episodeId === currentEpisode.id)
                          .map((note) => (
                            <div
                              key={note.id}
                              className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-start justify-between gap-3 group"
                            >
                              <div className="flex items-start gap-2.5">
                                <button
                                  onClick={() => playerRef.current?.seekTo(note.timestampSeconds)}
                                  className="font-mono text-xs font-semibold text-amber-400 hover:underline bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shrink-0 cursor-pointer"
                                  title="คลิกเพื่อไปที่เวลานี้ในวิดีโอ"
                                >
                                  {note.timestampText}
                                </button>
                                <p className="text-xs text-slate-200 mt-0.5">{note.content}</p>
                              </div>
                              <button
                                onClick={() => handleDeleteNote(note.id)}
                                className="text-slate-500 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                )}

                {/* 5. Quiz */}
                {activeTab === 'quiz' && currentEpisode.quiz && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-amber-400" />
                        <span>แบบฝึกหัดวัดความเข้าใจประจำ EP</span>
                      </h3>
                      {quizSubmitted && (
                        <button
                          onClick={() => {
                            setQuizAnswers({});
                            setQuizSubmitted(false);
                          }}
                          className="text-xs text-amber-400 hover:underline cursor-pointer"
                        >
                          ทำใหม่อีกครั้ง
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {currentEpisode.quiz.map((q, qIdx) => {
                        const selectedChoice = quizAnswers[qIdx];
                        const isCorrect = selectedChoice === q.answerIndex;

                        return (
                          <div key={qIdx} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                            <p className="text-sm font-medium text-slate-200">
                              {qIdx + 1}. {q.question}
                            </p>
                            <div className="space-y-2">
                              {q.options.map((opt, optIdx) => {
                                const isSelected = selectedChoice === optIdx;
                                let btnStyle = 'border-slate-800 bg-slate-900/60 hover:border-slate-700 text-slate-300';
                                if (quizSubmitted) {
                                  if (optIdx === q.answerIndex) {
                                    btnStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-300 font-semibold';
                                  } else if (isSelected) {
                                    btnStyle = 'border-rose-500 bg-rose-500/10 text-rose-300';
                                  }
                                } else if (isSelected) {
                                  btnStyle = 'border-amber-400 bg-amber-400/10 text-amber-300';
                                }

                                return (
                                  <button
                                    key={optIdx}
                                    type="button"
                                    onClick={() => {
                                      if (!quizSubmitted) {
                                        setQuizAnswers({ ...quizAnswers, [qIdx]: optIdx });
                                      }
                                    }}
                                    className={`w-full text-left p-3 rounded-lg border text-xs transition-colors cursor-pointer flex items-center justify-between ${btnStyle}`}
                                  >
                                    <span>{opt}</span>
                                    {quizSubmitted && optIdx === q.answerIndex && (
                                      <span className="text-[10px] text-emerald-400 uppercase font-bold">คำตอบที่ถูกต้อง</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {!quizSubmitted ? (
                      <button
                        onClick={() => setQuizSubmitted(true)}
                        disabled={Object.keys(quizAnswers).length === 0}
                        className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        ตรวจคำตอบทันที
                      </button>
                    ) : (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300">
                        ยอดเยี่ยม! คุณได้ทบทวนเนื้อหาของ EP {currentEpisode.epNumber} เรียบร้อยแล้ว
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Q&A */}
                {activeTab === 'qa' && (
                  <div className="space-y-4">
                    <form onSubmit={handleSubmitQa} className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={qaAuthor}
                          onChange={(e) => setQaAuthor(e.target.value)}
                          placeholder="ชื่อของคุณ (เช่น น้องนที ม.5)..."
                          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                        />
                        <div className="sm:col-span-2 flex gap-2">
                          <input
                            type="text"
                            value={qaText}
                            onChange={(e) => setQaText(e.target.value)}
                            placeholder="พิมพ์คำถามหรือข้อสงสัยเกี่ยวกับเนื้อหานี้..."
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                          />
                          <button
                            type="submit"
                            disabled={isSubmittingQa}
                            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>ถาม</span>
                          </button>
                        </div>
                      </div>
                    </form>

                    <div className="space-y-2.5 pt-2">
                      {currentEpisode.comments && currentEpisode.comments.length > 0 ? (
                        currentEpisode.comments.map((comm) => (
                          <div
                            key={comm.id}
                            className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-amber-400">{comm.author}</span>
                              <span className="text-[11px] text-slate-500">
                                {new Date(comm.createdAt).toLocaleDateString('th-TH')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-200">{comm.text}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 text-center py-4">
                          ยังไม่มีคำถามสำหรับบทเรียนนี้ เป็นคนแรกที่ถามคำถามได้เลย!
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="aspect-video bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center p-8 text-center">
              <BookOpen className="w-12 h-12 text-slate-600 mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">ยังไม่มีตอนบทเรียน (EP) ในวิชานี้</h3>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                สำหรับผู้ดูแลระบบ/อาจารย์ สามารถกดปุ่มด้านล่างเพื่ออัปโหลดคลิปวิดีโอจากเครื่องและเริ่มสร้าง EP ได้ทันที
              </p>
              {isAdmin ? (
                <button
                  onClick={() => onOpenUploadVideoForCourse(course.id)}
                  className="px-4 py-2 bg-amber-400 text-slate-950 text-xs font-semibold rounded-xl hover:bg-amber-300 cursor-pointer"
                >
                  อัปโหลดคลิป EP แรก
                </button>
              ) : (
                <p className="text-xs text-amber-400">เข้าสู่ระบบแอดมินเพื่ออัปโหลดคลิป</p>
              )}
            </div>
          )}
        </div>

        {/* Right Column: EP Playlist (lg:col-span-4) */}
        <div className={isTheaterMode ? 'w-full mt-6' : 'lg:col-span-4'}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sticky top-20 shadow-xl">
            {/* Playlist Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>รายการตอนบทเรียน (EP Playlist)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  ทั้งหมด {course.episodes.length} ตอน · จบแล้ว {completedEpIds.length} ตอน
                </p>
              </div>

              {isAdmin && (
                <button
                  onClick={() => onOpenUploadVideoForCourse(course.id)}
                  className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 rounded-lg transition-colors cursor-pointer"
                  title="เพิ่ม EP ใหม่"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Episodes List */}
            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {course.episodes.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  ยังไม่มี EP ในวิชานี้
                </div>
              ) : (
                course.episodes.map((ep) => {
                  const isCurrent = ep.id === selectedEpId;
                  const isDone = completedEpIds.includes(ep.id);

                  return (
                    <div
                      key={ep.id}
                      onClick={() => setSelectedEpId(ep.id)}
                      className={`group relative p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isCurrent
                          ? 'bg-amber-500/10 border-amber-400/60 ring-1 ring-amber-400/20'
                          : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                      }`}
                    >
                      {/* Play / Status Icon */}
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isCurrent
                            ? 'bg-amber-400 text-slate-950 font-bold'
                            : isDone
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-800 text-slate-400 group-hover:text-amber-400'
                        }`}
                      >
                        {isCurrent ? (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        ) : isDone ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <span className="text-xs font-mono">{ep.epNumber}</span>
                        )}
                      </div>

                      {/* EP Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-semibold text-amber-400/90 uppercase tracking-wider">
                            EP {ep.epNumber}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {ep.duration}
                          </span>
                        </div>
                        <h4
                          className={`text-xs font-medium leading-snug line-clamp-2 mt-0.5 ${
                            isCurrent ? 'text-white font-semibold' : 'text-slate-300'
                          }`}
                        >
                          {ep.title}
                        </h4>

                        {ep.summary && (
                          <p className="text-[11px] text-slate-500 truncate mt-1">
                            {ep.summary}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Helper for Admin */}
            {isAdmin && (
              <div className="mt-4 pt-3 border-t border-slate-800 text-center">
                <button
                  onClick={() => onOpenUploadVideoForCourse(course.id)}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-medium rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>อัปโหลดคลิปไฟล์เข้าวิชานี้</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

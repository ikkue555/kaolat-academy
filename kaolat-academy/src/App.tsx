import React, { useState, useEffect } from 'react';
import { Search, BookOpen, CheckCircle2 } from 'lucide-react';
import { Course, Episode } from './types';
import {
  fetchCourses,
  isAdminLoggedIn,
  clearAdminKey,
  deleteCourse,
} from './services/api';
import {
  subscribeToCourses,
  saveCourseToFirestore,
  deleteCourseFromFirestore,
  seedInitialCoursesIfEmpty,
} from './services/firestoreService';
import { Navbar } from './components/Navbar';
import { CourseCard } from './components/CourseCard';
import { CourseDetailView } from './components/CourseDetailView';
import { AdminLoginModal } from './components/AdminLoginModal';
import { UploadVideoModal } from './components/UploadVideoModal';
import { AddCourseModal } from './components/AddCourseModal';
import { QuickStartGuideModal } from './components/QuickStartGuideModal';
import { SyncModal } from './components/SyncModal';

const LOCAL_COURSES_KEY = 'kaolat_saved_courses';
const LOCAL_SELECTED_KEY = 'kaolat_selected_course_id';

export default function App() {
  const [courses, setCourses] = useState<Course[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_COURSES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((c: Course) => c.id !== 'course-1793496540162-y9mfl');
        }
      }
      return [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-sync status modal
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);

  // Always default to null on page enter/refresh to show "รายการวิชาทั้งหมด" catalog home page
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const handleSelectCourseById = (courseId: string | null) => {
    setSelectedCourseId(courseId);
    if (courseId) {
      localStorage.setItem(LOCAL_SELECTED_KEY, courseId);
    } else {
      localStorage.removeItem(LOCAL_SELECTED_KEY);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');

  // Admin state
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState<boolean>(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Upload/Edit EP states
  const [uploadTargetCourseId, setUploadTargetCourseId] = useState<string | undefined>(undefined);
  const [editingEpisode, setEditingEpisode] = useState<Episode | null>(null);

  const isModalActiveRef = React.useRef(false);
  isModalActiveRef.current = isUploadModalOpen || isAddCourseModalOpen || isAdminLoginOpen || isGuideModalOpen || isSyncModalOpen;

  // Prevent accidental whole-page navigation when files are dropped outside dropzones
  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, []);

  // Check admin session on mount & subscribe to Firestore real-time database updates
  useEffect(() => {
    setIsAdmin(isAdminLoggedIn());

    // 1. Initial cleanup of legacy default physics course
    seedInitialCoursesIfEmpty().catch(() => {});

    // 2. Initial load from server API
    loadCourses(true);

    // 3. Real-time Firestore Cloud Subscription (Instantly triggers when ANY user on ANY link adds/edits a course or video)
    const unsubscribeFirestore = subscribeToCourses(
      (realtimeCourses) => {
        const cleaned = (realtimeCourses || []).filter((c) => c.id !== 'course-1793496540162-y9mfl');
        setCourses(cleaned);
        localStorage.setItem(LOCAL_COURSES_KEY, JSON.stringify(cleaned));
      },
      (err) => {
        console.warn('Firestore subscription fallback to REST API:', err);
      }
    );

    // 4. Fallback Auto-sync API poll every 5 seconds
    const syncInterval = setInterval(() => {
      if (isModalActiveRef.current) return;
      fetchCourses()
        .then((data) => {
          if (!isModalActiveRef.current && Array.isArray(data)) {
            const cleaned = data.filter((c) => c.id !== 'course-1793496540162-y9mfl');
            setCourses((prev) => {
              if (JSON.stringify(prev) !== JSON.stringify(cleaned)) {
                localStorage.setItem(LOCAL_COURSES_KEY, JSON.stringify(cleaned));
                return cleaned;
              }
              return prev;
            });
          }
        })
        .catch(() => {});
    }, 5000);

    return () => {
      unsubscribeFirestore();
      clearInterval(syncInterval);
    };
  }, []);

  const loadCourses = async (showLoading = false): Promise<Course[] | void> => {
    try {
      if (showLoading && courses.length === 0) setLoading(true);
      setError(null);
      const data = await fetchCourses();
      if (Array.isArray(data)) {
        const cleaned = data.filter((c) => c.id !== 'course-1793496540162-y9mfl');
        setCourses(cleaned);
        localStorage.setItem(LOCAL_COURSES_KEY, JSON.stringify(cleaned));
        return cleaned;
      }
    } catch (err: any) {
      console.warn('loadCourses error:', err);
      const cached = localStorage.getItem(LOCAL_COURSES_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter((c: Course) => c.id !== 'course-1793496540162-y9mfl');
            setCourses(cleaned);
          }
        } catch {}
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleLogoutAdmin = () => {
    clearAdminKey();
    setIsAdmin(false);
  };

  const handleOpenUploadForCourse = (courseId: string) => {
    if (!isAdmin) {
      setIsAdminLoginOpen(true);
      return;
    }
    setUploadTargetCourseId(courseId);
    setEditingEpisode(null);
    setIsUploadModalOpen(true);
  };

  const handleEditEpisode = (course: Course, episode: Episode) => {
    if (!isAdmin) {
      setIsAdminLoginOpen(true);
      return;
    }
    setUploadTargetCourseId(course.id);
    setEditingEpisode(episode);
    setIsUploadModalOpen(true);
  };

  const handleDeleteCourse = async (course: Course) => {
    if (!isAdmin) return;
    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบวิชา "${course.title}"?`)) {
      try {
        await deleteCourse(course.id);
        await deleteCourseFromFirestore(course.id).catch(() => {});
        if (selectedCourseId === course.id) {
          setSelectedCourseId(null);
        }
        await loadCourses();
      } catch (err: any) {
        alert(err.message || 'ลบไม่สำเร็จ');
      }
    }
  };

  // Find active course if in detail view
  const activeCourse = courses.find((c) => c.id === selectedCourseId);

  // Dynamic categories list based on existing courses + defaults
  const categories = React.useMemo(() => {
    const defaultCats = ['ทั้งหมด', 'ฟิสิกส์', 'เคมี', 'คณิตศาสตร์', 'ชีววิทยา'];
    const customCats = courses.map((c) => c.category?.trim()).filter(Boolean);
    return Array.from(new Set([...defaultCats, ...customCats]));
  }, [courses]);

  // Filtered courses
  const filteredCourses = courses.filter((c) => {
    const matchCategory =
      selectedCategory === 'ทั้งหมด' || c.category.toLowerCase().includes(selectedCategory.toLowerCase());
    const matchQuery =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.instructor.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchQuery;
  });

  const handleCourseSaved = (savedCourse: Course) => {
    // 1. Save to Firestore Cloud Real-time Database (Instantly notifies all other users & links)
    saveCourseToFirestore(savedCourse).catch((err) => {
      console.warn('Firestore save Course fallback:', err);
    });

    // 2. Immediately update local state & localStorage so user sees the newly saved course instantly
    setCourses((prev) => {
      const idx = prev.findIndex((c) => c.id === savedCourse.id);
      let next: Course[];
      if (idx !== -1) {
        next = [...prev];
        next[idx] = savedCourse;
      } else {
        next = [savedCourse, ...prev];
      }
      localStorage.setItem(LOCAL_COURSES_KEY, JSON.stringify(next));
      return next;
    });

    // 3. Reset filters to ensure the saved course is immediately visible
    setSearchQuery('');
    setSelectedCategory('ทั้งหมด');

    // 4. Clear editing state & close modal
    const wasEditing = Boolean(editingCourse);
    setEditingCourse(null);
    setIsAddCourseModalOpen(false);

    // 5. Show success toast notification
    showToast(wasEditing ? `แก้ไขข้อมูลวิชา "${savedCourse.title}" เรียบร้อยแล้ว` : `บันทึกวิชา "${savedCourse.title}" เรียบร้อยแล้ว`);

    // 6. Fetch from server to ensure disk persistence
    loadCourses();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-400 selection:text-slate-950">
      {/* Navbar adhering to Top Bar Contract */}
      <Navbar
        isAdmin={isAdmin}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        onOpenAdminLogin={() => setIsAdminLoginOpen(true)}
        onLogoutAdmin={handleLogoutAdmin}
        onOpenUploadVideo={() => {
          setUploadTargetCourseId(selectedCourseId || (courses.length > 0 ? courses[0].id : undefined));
          setEditingEpisode(null);
          setIsUploadModalOpen(true);
        }}
        onOpenAddCourse={() => {
          setEditingCourse(null);
          setIsAddCourseModalOpen(true);
        }}
        onSelectCourseById={handleSelectCourseById}
        onGoHome={() => setSelectedCourseId(null)}
        onOpenGuide={() => setIsGuideModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {selectedCourseId && activeCourse ? (
          /* View 1: Course & Episode Playlist View (e.g. Physics with EP 1, EP 2, ...) */
          <CourseDetailView
            course={activeCourse}
            isAdmin={isAdmin}
            onBack={() => setSelectedCourseId(null)}
            onOpenUploadVideoForCourse={handleOpenUploadForCourse}
            onEditEpisode={handleEditEpisode}
            onRefreshCourse={loadCourses}
            onEditCourse={(course) => {
              setEditingCourse(course);
              setIsAddCourseModalOpen(true);
            }}
          />
        ) : (
          /* View 2: Courses Catalog & Discovery Hall */
          <div className="space-y-8 py-6 sm:py-8">
            {/* Courses Catalog Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
              {/* Section Header & Search / Filters */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    รายการวิชาทั้งหมด
                  </h2>

                </div>

                {/* Search Input */}
                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาชื่อวิชา หรือ ผู้สอน..."
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>



              {/* Courses Grid */}
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-8">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-80 bg-slate-900/60 border border-slate-800 rounded-2xl animate-pulse"
                    />
                  ))}
                </div>
              ) : courses.length === 0 ? (
                <div className="p-12 sm:p-16 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-4 max-w-xl mx-auto my-6">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-2xl">
                    🌰
                  </div>
                  <h3 className="text-lg font-semibold text-white">ยังไม่มีรายวิชาในระบบ</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    ระบบพร้อมให้แอดมินสร้างรายวิชาใหม่ อัปโหลดภาพปกจากเครื่อง และอัปโหลดคลิปวิดีโอแบ่งเป็น EP ได้ทันที
                  </p>
                  <div className="pt-2">
                    {isAdmin ? (
                      <button
                        onClick={() => setIsAddCourseModalOpen(true)}
                        className="px-5 py-2.5 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors shadow-sm cursor-pointer"
                      >
                        + เพิ่มรายวิชาแรก
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsAdminLoginOpen(true)}
                        className="px-5 py-2.5 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors shadow-sm cursor-pointer"
                      >
                        เข้าสู่ระบบแอดมินเพื่อเพิ่มวิชา
                      </button>
                    )}
                  </div>
                </div>
              ) : filteredCourses.length === 0 ? (
                <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
                  <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
                  <h3 className="text-base font-semibold text-white">ไม่พบรายวิชาที่ตรงกับการค้นหา</h3>
                  <p className="text-xs text-slate-400">
                    ลองค้นหาด้วยคำอื่น หรือกดล้างตัวกรองเพื่อดูทุกรายวิชา
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('ทั้งหมด');
                    }}
                    className="px-4 py-2 text-xs bg-slate-800 text-amber-400 rounded-lg hover:bg-slate-700 cursor-pointer"
                  >
                    ล้างการค้นหา
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCourses.map((course) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      isAdmin={isAdmin}
                      onSelect={(c) => handleSelectCourseById(c.id)}
                      onEdit={(c) => {
                        setEditingCourse(c);
                        setIsAddCourseModalOpen(true);
                      }}
                      onDelete={handleDeleteCourse}
                      onUploadForCourse={handleOpenUploadForCourse}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Footer adhering to Zero-pill & Anti-slop Rules */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">KaoLat Academy</span>
            <span>·</span>
            <span>ระบบคอร์สเรียนออนไลน์สตรีมมิ่งความละเอียดสูง</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsGuideModalOpen(true)}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              คู่มือการใช้งาน
            </button>
            <span>·</span>
            {isAdmin ? (
              <span className="text-emerald-400">สถานะ: แอดมินออนไลน์</span>
            ) : (
              <button
                onClick={() => setIsAdminLoginOpen(true)}
                className="hover:text-amber-400 transition-colors cursor-pointer"
              >
                เข้าสู่ระบบแอดมิน
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Floating Status Notification Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-900 border border-emerald-500/60 shadow-2xl rounded-xl text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        </div>
      )}

      {/* Modals */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onSuccess={() => {
          setIsAdmin(true);
        }}
      />

      <UploadVideoModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setEditingEpisode(null);
        }}
        courses={courses}
        initialCourseId={uploadTargetCourseId}
        editingEpisode={editingEpisode}
        onOpenAddCourse={() => {
          setEditingCourse(null);
          setIsAddCourseModalOpen(true);
        }}
        onSuccess={async (courseId) => {
          handleSelectCourseById(courseId);
          showToast('บันทึกและอัปโหลดคลิปวิดีโอ EP สำเร็จเรียบร้อย');
          await loadCourses();
          // Sync updated course with new EP to Firestore Cloud
          const updatedCourse = courses.find((c) => c.id === courseId);
          if (updatedCourse) {
            saveCourseToFirestore(updatedCourse).catch(() => {});
          }
        }}
      />

      <AddCourseModal
        isOpen={isAddCourseModalOpen}
        onClose={() => {
          setIsAddCourseModalOpen(false);
          setEditingCourse(null);
        }}
        courseToEdit={editingCourse}
        onSuccess={handleCourseSaved}
      />

      <QuickStartGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
        onOpenAdminLogin={() => setIsAdminLoginOpen(true)}
      />

      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncNow={async () => {
          await loadCourses();
        }}
      />
    </div>
  );
}

import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';
const isVercel = Boolean(process.env.VERCEL);
const ADMIN_PASSWORD = 'เกาลัด888';

// Ensure required directories exist (use /tmp when running on Vercel read-only filesystem)
const baseDir = isVercel ? '/tmp' : process.cwd();
const UPLOADS_DIR = path.resolve(baseDir, 'uploads', 'videos');
const UPLOADS_IMAGES_DIR = path.resolve(baseDir, 'uploads', 'images');
const DATA_DIR = path.resolve(baseDir, 'data');
const COURSES_FILE = path.join(DATA_DIR, 'courses.json');
const PROGRESS_FILE = path.join(DATA_DIR, 'progress.json');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

const TEMP_CHUNKS_DIR = path.resolve(baseDir, 'uploads', 'temp_chunks');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_IMAGES_DIR)) {
  fs.mkdirSync(UPLOADS_IMAGES_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_CHUNKS_DIR)) {
  fs.mkdirSync(TEMP_CHUNKS_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helpers for cross-platform synced data
function getProgressData(): Record<string, Record<string, string[]>> {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch (e) {}
  return {};
}

function saveProgressData(data: Record<string, Record<string, string[]>>) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {}
}

function getNotesData(): Record<string, any[]> {
  try {
    if (fs.existsSync(NOTES_FILE)) {
      return JSON.parse(fs.readFileSync(NOTES_FILE, 'utf-8'));
    }
  } catch (e) {}
  return {};
}

function saveNotesData(data: Record<string, any[]>) {
  try {
    fs.writeFileSync(NOTES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {}
}

function getHistoryData(): Record<string, Record<string, { episodeId: string; timestampSeconds: number; updatedAt: string }>> {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    }
  } catch (e) {}
  return {};
}

function saveHistoryData(data: Record<string, Record<string, { episodeId: string; timestampSeconds: number; updatedAt: string }>>) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {}
}

// Multer storage for chunked video uploads (each chunk ~5-10MB, bypasses 32MB proxy limits)
const chunkStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const rawId = (req.query.uploadId as string) || (req.body && req.body.uploadId) || 'default';
    const uploadId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
    const dir = path.join(TEMP_CHUNKS_DIR, uploadId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, _file, cb) => {
    const chunkIndex = (req.query.chunkIndex as string) || (req.body && req.body.chunkIndex) || '0';
    cb(null, `part_${chunkIndex}`);
  },
});

const uploadChunk = multer({
  storage: chunkStorage,
  limits: {
    // No file size limits
  },
});

// Multer storage configuration for direct video files (unlimited file size)
const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\u0E00-\u0E7F-]/g, '_');
    const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    cb(null, `${base}_${uniqueSuffix}${ext}`);
  },
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: {
    // No file size limits - supports videos of any size
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('รองรับเฉพาะไฟล์วิดีโอเท่านั้น (.mp4, .webm, .mov, ฯลฯ)'));
    }
  },
});

// Multer storage configuration for course cover image files
const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_IMAGES_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\u0E00-\u0E7F-]/g, '_');
    const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    cb(null, `cover_${base}_${uniqueSuffix}${ext}`);
  },
});

const uploadImage = multer({
  storage: imageStorage,
  limits: {
    fileSize: 1024 * 1024 * 25, // 25MB max image size
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('รองรับเฉพาะไฟล์รูปภาพเท่านั้น (.jpg, .png, .webp, ฯลฯ)'));
    }
  },
});

// Middleware with large payload limits and CORS
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-admin-key, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

export interface EpisodeItem {
  id: string;
  epNumber: number;
  title: string;
  description: string;
  duration: string;
  videoUrl: string;
  videoFileName?: string;
  uploadedAt: string;
  summary?: string;
  chapters?: Array<{ time: string; title: string }>;
  quiz?: Array<{ question: string; options: string[]; answerIndex: number }>;
  comments?: Array<{ id: string; author: string; text: string; createdAt: string }>;
}

export interface CourseItem {
  id: string;
  title: string;
  category: string;
  instructor: string;
  description: string;
  level: string;
  coverImage: string;
  createdAt: string;
  episodes: EpisodeItem[];
}

const COURSES_BACKUP_FILE = path.join(DATA_DIR, 'courses.backup.json');

const INITIAL_DEFAULT_COURSES: CourseItem[] = [];

function getCourses(): CourseItem[] {
  try {
    if (fs.existsSync(COURSES_FILE)) {
      const data = fs.readFileSync(COURSES_FILE, 'utf-8');
      if (data.trim()) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    }
    if (fs.existsSync(COURSES_BACKUP_FILE)) {
      const backup = fs.readFileSync(COURSES_BACKUP_FILE, 'utf-8');
      if (backup.trim()) {
        const parsed = JSON.parse(backup);
        if (Array.isArray(parsed)) {
          fs.writeFileSync(COURSES_FILE, backup, 'utf-8');
          return parsed;
        }
      }
    }
  } catch (err) {
    console.error('Error reading courses.json:', err);
  }

  saveCourses([]);
  return [];
}

function saveCourses(courses: CourseItem[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const jsonStr = JSON.stringify(courses, null, 2);
    // Write atomically via temp file to prevent partial write corruptions
    const tempFile = path.join(DATA_DIR, `courses.tmp.${Date.now()}`);
    fs.writeFileSync(tempFile, jsonStr, 'utf-8');
    fs.renameSync(tempFile, COURSES_FILE);
    fs.writeFileSync(COURSES_BACKUP_FILE, jsonStr, 'utf-8');
  } catch (err) {
    console.error('Error saving courses.json:', err);
    try {
      fs.writeFileSync(COURSES_FILE, JSON.stringify(courses, null, 2), 'utf-8');
    } catch (e) {
      console.error('Fallback saveCourses error:', e);
    }
  }
}

// Robust helper for matching Admin Passcode ('เกาลัด888' or 'kaolat888') across all encodings
function isMatchingAdminPass(input?: string): boolean {
  if (!input) return false;
  const raw = String(input).trim();
  const validList = [
    'เกาลัด888',
    'kaolat888',
    'เกาลัด 888',
    encodeURIComponent('เกาลัด888'),
  ];

  if (validList.includes(raw)) return true;

  try {
    const decoded = decodeURIComponent(raw).trim();
    if (validList.includes(decoded)) return true;
  } catch {}

  try {
    const normRaw = raw.normalize('NFC');
    for (const v of validList) {
      if (v.normalize('NFC') === normRaw) return true;
    }
  } catch {}

  return false;
}

// Authentication middleware for Admin (Strict passcode verification)
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminPass =
    (req.headers['x-admin-key'] as string) ||
    (req.query.adminKey as string) ||
    (req.body && req.body.adminKey);

  if (isMatchingAdminPass(adminPass)) {
    return next();
  }
  return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบแอดมินด้วยรหัสผ่าน เกาลัด888' });
}

// Automatically sync and recover any uploaded video files on disk into courses
function syncOrphanedVideos() {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) return;
    const files = fs.readdirSync(UPLOADS_DIR).filter((f) => f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mov') || f.endsWith('.mkv'));
    if (files.length === 0) return;

    const courses = getCourses();
    if (courses.length === 0) return;

    const targetCourse = courses[0];
    let changed = false;

    // Check each file on disk
    files.forEach((file) => {
      const videoUrl = `/api/videos/${encodeURIComponent(file)}`;
      const alreadyExists = targetCourse.episodes.some((e) => e.videoUrl === videoUrl || e.videoFileName === file);
      if (!alreadyExists) {
        const epNum = targetCourse.episodes.length + 1;
        let duration = '15:00';
        if (file.includes('2025-12-18')) duration = '29:43';
        else if (file.includes('08-32-58')) duration = '00:23';
        else if (file.includes('08-34-35')) duration = '00:33';

        targetCourse.episodes.push({
          id: `ep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          epNumber: epNum,
          title: `EP ${epNum}: บทเรียนบรรยาย ${file.substring(0, 10)}`,
          description: `ไฟล์วิดีโอบทเรียน ${file}`,
          duration,
          videoUrl,
          videoFileName: file,
          uploadedAt: new Date().toISOString(),
          chapters: [{ time: '00:00', title: 'เริ่มต้นบทเรียน' }],
          quiz: [],
          comments: [],
        });
        changed = true;
      }
    });

    if (changed) {
      targetCourse.episodes.sort((a, b) => a.epNumber - b.epNumber);
      saveCourses(courses);
      console.log(`[Sync] Synced ${files.length} uploaded video files into course: "${targetCourse.title}"`);
    }
  } catch (err) {
    console.error('Error syncing orphaned videos:', err);
  }
}

// Initial sync on load
syncOrphanedVideos();

// API Routes

// 1. Verify Admin Password
app.post('/api/auth/admin-login', (req: Request, res: Response) => {
  const { password } = req.body;
  if (isMatchingAdminPass(password)) {
    res.json({ success: true, message: 'เข้าสู่ระบบแอดมินสำเร็จ' });
  } else {
    res.status(401).json({ success: false, error: 'รหัสผ่านไม่ถูกต้อง' });
  }
});

// 2. Get all courses (Strict no-cache headers to guarantee live sync across all devices)
app.get('/api/courses', (_req: Request, res: Response) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
  });
  const courses = getCourses();
  res.json({ courses });
});

// 3. Get single course with episodes
app.get('/api/courses/:id', (req: Request, res: Response) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  const courses = getCourses();
  const course = courses.find((c) => c.id === req.params.id);
  if (!course) {
    return res.status(404).json({ error: 'ไม่พบคอร์สเรียนนี้' });
  }
  res.json({ course });
});

// 4. Create new course (Admin only)
app.post('/api/courses', requireAdmin, (req: Request, res: Response) => {
  const { title, category, instructor, description, level, coverImage } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'กรุณาระบุชื่อวิชา' });
  }
  const courses = getCourses();
  const newCourse: CourseItem = {
    id: `course-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: title.trim(),
    category: category?.trim() || 'วิชาทั่วไป',
    instructor: instructor?.trim() || 'อาจารย์ผู้สอน',
    description: description?.trim() || '',
    level: level || 'ม.ปลาย',
    coverImage: coverImage?.trim() || '/src/assets/images/hero_learning_banner_1793422048822.jpg',
    createdAt: new Date().toISOString(),
    episodes: [],
  };
  courses.unshift(newCourse);
  saveCourses(courses);
  console.log(`[Courses] Successfully saved new course: "${newCourse.title}" (Total: ${courses.length})`);
  res.json({ success: true, course: newCourse });
});

// 5. Update course (Admin only)
app.put('/api/courses/:id', requireAdmin, (req: Request, res: Response) => {
  const courses = getCourses();
  const index = courses.findIndex((c) => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'ไม่พบคอร์สเรียนนี้' });
  }
  const current = courses[index];
  courses[index] = {
    ...current,
    title: req.body.title !== undefined ? req.body.title.trim() : current.title,
    category: req.body.category !== undefined ? req.body.category.trim() : current.category,
    instructor: req.body.instructor !== undefined ? req.body.instructor.trim() : current.instructor,
    description: req.body.description !== undefined ? req.body.description.trim() : current.description,
    level: req.body.level !== undefined ? req.body.level : current.level,
    coverImage: req.body.coverImage !== undefined ? req.body.coverImage : current.coverImage,
  };
  saveCourses(courses);
  console.log(`[Courses] Successfully updated course: "${courses[index].title}"`);
  res.json({ success: true, course: courses[index] });
});

// 6. Delete course (Admin only)
app.delete('/api/courses/:id', requireAdmin, (req: Request, res: Response) => {
  let courses = getCourses();
  courses = courses.filter((c) => c.id !== req.params.id);
  saveCourses(courses);
  console.log(`[Courses] Deleted course ID: ${req.params.id}, remaining: ${courses.length}`);
  res.json({ success: true });
});

// 7. Add Episode to Course (Admin only)
app.post('/api/courses/:courseId/episodes', requireAdmin, (req: Request, res: Response) => {
  const courses = getCourses();
  let course = courses.find((c) => c.id === req.params.courseId);
  if (!course) {
    if (courses.length > 0) {
      course = courses[0];
    } else {
      course = {
        id: `course-${Date.now()}`,
        title: 'ฟิสิกส์ ม.4: กลศาสตร์และการเคลื่อนที่',
        category: 'ฟิสิกส์',
        instructor: 'อาจารย์เกาลัด',
        description: 'บทเรียนฟิสิกส์และวิทยาศาสตร์ออนไลน์',
        level: 'ม.ปลาย',
        coverImage: '/src/assets/images/physics_course_cover_1793422048834.jpg',
        createdAt: new Date().toISOString(),
        episodes: [],
      };
      courses.push(course);
    }
  }
  const { title, epNumber, description, duration, videoUrl, videoFileName, summary, chapters } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'กรุณาระบุชื่อ EP' });
  }

  const calculatedEpNum = epNumber ? Number(epNumber) : course.episodes.length + 1;
  const newEpisode: EpisodeItem = {
    id: `ep-${Date.now()}`,
    epNumber: calculatedEpNum,
    title: title.trim(),
    description: description?.trim() || '',
    duration: duration?.trim() || '15:00',
    videoUrl: videoUrl || '',
    videoFileName: videoFileName || '',
    uploadedAt: new Date().toISOString(),
    summary: summary?.trim() || '',
    chapters: chapters || [{ time: '00:00', title: 'เริ่มต้นบทเรียน' }],
    quiz: [],
    comments: [],
  };

  course.episodes.push(newEpisode);
  course.episodes.sort((a, b) => a.epNumber - b.epNumber);
  saveCourses(courses);
  res.json({ success: true, episode: newEpisode });
});

// 8. Update Episode (Admin only)
app.put('/api/courses/:courseId/episodes/:epId', requireAdmin, (req: Request, res: Response) => {
  const courses = getCourses();
  const course = courses.find((c) => c.id === req.params.courseId);
  if (!course) {
    return res.status(404).json({ error: 'ไม่พบคอร์สเรียน' });
  }
  const epIndex = course.episodes.findIndex((e) => e.id === req.params.epId);
  if (epIndex === -1) {
    return res.status(404).json({ error: 'ไม่พบ EP นี้' });
  }

  const currentEp = course.episodes[epIndex];
  course.episodes[epIndex] = {
    ...currentEp,
    title: req.body.title !== undefined ? req.body.title.trim() : currentEp.title,
    epNumber: req.body.epNumber !== undefined ? Number(req.body.epNumber) : currentEp.epNumber,
    description: req.body.description !== undefined ? req.body.description.trim() : currentEp.description,
    duration: req.body.duration !== undefined ? req.body.duration.trim() : currentEp.duration,
    videoUrl: req.body.videoUrl !== undefined ? req.body.videoUrl : currentEp.videoUrl,
    videoFileName: req.body.videoFileName !== undefined ? req.body.videoFileName : currentEp.videoFileName,
    summary: req.body.summary !== undefined ? req.body.summary.trim() : currentEp.summary,
    chapters: req.body.chapters !== undefined ? req.body.chapters : currentEp.chapters,
  };

  course.episodes.sort((a, b) => a.epNumber - b.epNumber);
  saveCourses(courses);
  res.json({ success: true, episode: course.episodes[epIndex] });
});

// 9. Delete Episode (Admin only)
app.delete('/api/courses/:courseId/episodes/:epId', requireAdmin, (req: Request, res: Response) => {
  const courses = getCourses();
  const course = courses.find((c) => c.id === req.params.courseId);
  if (!course) {
    return res.status(404).json({ error: 'ไม่พบคอร์สเรียน' });
  }
  course.episodes = course.episodes.filter((e) => e.id !== req.params.epId);
  saveCourses(courses);
  res.json({ success: true });
});

// 10. Student Comment / Q&A submission
app.post('/api/courses/:courseId/episodes/:epId/comments', (req: Request, res: Response) => {
  const { author, text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'กรุณากรอกข้อความ' });
  }
  const courses = getCourses();
  const course = courses.find((c) => c.id === req.params.courseId);
  if (!course) return res.status(404).json({ error: 'ไม่พบคอร์ส' });
  const ep = course.episodes.find((e) => e.id === req.params.epId);
  if (!ep) return res.status(404).json({ error: 'ไม่พบ EP' });

  if (!ep.comments) ep.comments = [];
  const comment = {
    id: `c-${Date.now()}`,
    author: author && author.trim() ? author.trim() : 'นักเรียน',
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  ep.comments.push(comment);
  saveCourses(courses);
  res.json({ success: true, comment });
});

// 11. Video File Upload (Admin only)
app.post('/api/upload-video', requireAdmin, uploadVideo.single('video'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'ไม่พบไฟล์วิดีโอที่อัปโหลด' });
  }

  const filename = req.file.filename;
  const videoUrl = `/api/videos/${encodeURIComponent(filename)}`;

  res.json({
    success: true,
    videoUrl,
    filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimeType: req.file.mimetype,
  });
});

// 11.5 Chunked Video Upload (Bypasses Cloud Run / Proxy payload limit for arbitrarily large videos)
app.post('/api/upload-video-chunk', requireAdmin, uploadChunk.single('chunk'), async (req: Request, res: Response) => {
  try {
    const rawId = (req.query.uploadId as string) || (req.body && req.body.uploadId) || '';
    const uploadId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
    const chunkIndex = Number((req.query.chunkIndex as string) ?? (req.body && req.body.chunkIndex));
    const totalChunks = Number((req.query.totalChunks as string) ?? (req.body && req.body.totalChunks));
    const originalName = (req.query.fileName as string) || (req.body && req.body.fileName) || 'video.mp4';

    if (!uploadId || isNaN(chunkIndex) || isNaN(totalChunks) || totalChunks <= 0) {
      return res.status(400).json({ error: 'ข้อมูล Chunk ไม่ถูกต้อง' });
    }

    const chunkDir = path.join(TEMP_CHUNKS_DIR, uploadId);
    const currentChunkFile = path.join(chunkDir, `part_${chunkIndex}`);

    if (!fs.existsSync(currentChunkFile)) {
      return res.status(400).json({ error: `ไม่สามารถบันทึกชิ้นส่วนที่ ${chunkIndex + 1} ได้` });
    }

    // If this is the final chunk (all chunks received) -> assemble final video file!
    if (chunkIndex === totalChunks - 1) {
      // Verify all chunks exist before merging
      for (let i = 0; i < totalChunks; i++) {
        const partPath = path.join(chunkDir, `part_${i}`);
        if (!fs.existsSync(partPath)) {
          return res.status(400).json({
            error: `ชิ้นส่วนที่ ${i + 1}/${totalChunks} ขาดหาย กรุณาลองอัปโหลดใหม่อีกครั้ง`,
            missingChunkIndex: i,
          });
        }
      }

      const ext = path.extname(originalName) || '.mp4';
      const base = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_\u0E00-\u0E7F-]/g, '_');
      const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
      const finalFileName = `${base}_${uniqueSuffix}${ext}`;
      const finalFilePath = path.join(UPLOADS_DIR, finalFileName);

      // Merge sequentially using stream pipes to support arbitrarily large files without RAM saturation
      await new Promise<void>((resolve, reject) => {
        const writeStream = fs.createWriteStream(finalFilePath);
        writeStream.on('error', (err) => {
          console.error('Error writing merged video file:', err);
          reject(err);
        });
        writeStream.on('finish', () => {
          resolve();
        });

        (async () => {
          try {
            for (let i = 0; i < totalChunks; i++) {
              const partPath = path.join(chunkDir, `part_${i}`);
              await new Promise<void>((resPart, rejPart) => {
                const readStream = fs.createReadStream(partPath);
                readStream.on('error', rejPart);
                readStream.on('end', () => resPart());
                readStream.pipe(writeStream, { end: false });
              });
            }
            writeStream.end();
          } catch (mergeErr) {
            writeStream.destroy();
            reject(mergeErr);
          }
        })().catch(reject);
      });

      // Clean up temp chunk directory
      try {
        fs.rmSync(chunkDir, { recursive: true, force: true });
      } catch (err) {
        console.error('Error removing temp chunk dir:', err);
      }

      const videoUrl = `/api/videos/${encodeURIComponent(finalFileName)}`;
      const stats = fs.statSync(finalFilePath);

      return res.json({
        success: true,
        isCompleted: true,
        videoUrl,
        filename: finalFileName,
        originalName,
        size: stats.size,
      });
    }

    // Intermediate chunk successfully saved
    res.json({
      success: true,
      isCompleted: false,
      chunkIndex,
      totalChunks,
    });
  } catch (err: any) {
    console.error('Chunk upload error:', err);
    res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการรวมไฟล์วิดีโอ' });
  }
});

// 12. Video Streaming with HTTP 206 Partial Content (Range Support) and Cross-Domain Sync
app.get('/api/videos/:filename', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    const devOrigin = 'https://ais-dev-nmed6zzfqwmdfunwgdat3u-425938260615.asia-southeast1.run.app';
    const host = req.headers.host || '';
    if (!host.includes('ais-dev')) {
      return res.redirect(`${devOrigin}/api/videos/${encodeURIComponent(filename)}`);
    }
    return res.status(404).send('ไม่พบไฟล์วิดีโอนี้ในระบบ');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const ext = path.extname(filename).toLowerCase();
  let contentType = 'video/mp4';
  if (ext === '.webm') contentType = 'video/webm';
  else if (ext === '.mov') contentType = 'video/quicktime';
  else if (ext === '.mkv') contentType = 'video/x-matroska';
  else if (ext === '.avi') contentType = 'video/x-msvideo';

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).send(`Requested range not satisfiable: ${start} >= ${fileSize}`);
      return;
    }

    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

// 13. Image File Upload (Admin can upload course cover image directly from machine)
app.post('/api/upload-image', requireAdmin, (req: Request, res: Response) => {
  uploadImage.single('image')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'ไม่พบไฟล์รูปภาพที่อัปโหลด' });
    }

    const filename = req.file.filename;
    const imageUrl = `/api/images/${encodeURIComponent(filename)}`;

    res.json({
      success: true,
      imageUrl,
      filename,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  });
});

// 14. Image File Serving with CORS & Origin Redirect
app.get('/api/images/:filename', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_IMAGES_DIR, filename);

  if (!fs.existsSync(filePath)) {
    const devOrigin = 'https://ais-dev-nmed6zzfqwmdfunwgdat3u-425938260615.asia-southeast1.run.app';
    const host = req.headers.host || '';
    if (!host.includes('ais-dev')) {
      return res.redirect(`${devOrigin}/api/images/${encodeURIComponent(filename)}`);
    }
    return res.status(404).send('ไม่พบไฟล์รูปภาพนี้');
  }

  res.sendFile(filePath);
});

// 15. Cross-Platform Full Sync State Endpoint (Auto-syncs across all devices without needing any code)
app.get('/api/sync/state', (req: Request, res: Response) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
  });
  const profileId = (req.query.profileId as string) || 'global';
  const courses = getCourses();
  const allProgress = getProgressData();
  const allNotes = getNotesData();
  const allHistory = getHistoryData();

  // Return universally synchronized global state
  const progress = allProgress['global'] || allProgress[profileId] || {};
  const notes = allNotes['global'] || allNotes[profileId] || [];
  const history = allHistory['global'] || allHistory[profileId] || {};

  res.json({
    success: true,
    serverTime: new Date().toISOString(),
    profileId: 'global',
    autoSync: true,
    courses,
    progress,
    notes,
    history,
  });
});

// 16. Sync Learning Progress (Completed EPs) across all platforms automatically
app.post('/api/sync/progress', (req: Request, res: Response) => {
  const { courseId, episodeId, isCompleted, profileId } = req.body;
  if (!courseId || !episodeId) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const allProgress = getProgressData();
  // Always update global shared state for auto-sync without code
  const targetKeys = ['global'];
  if (profileId && profileId !== 'global') {
    targetKeys.push(profileId);
  }

  for (const key of targetKeys) {
    if (!allProgress[key]) allProgress[key] = {};
    if (!allProgress[key][courseId]) allProgress[key][courseId] = [];

    const list = allProgress[key][courseId];
    if (isCompleted && !list.includes(episodeId)) {
      list.push(episodeId);
    } else if (!isCompleted) {
      allProgress[key][courseId] = list.filter((id) => id !== episodeId);
    }
  }

  saveProgressData(allProgress);
  res.json({ success: true, progress: allProgress['global'][courseId] });
});

// 17. Sync Timestamped Notes across all platforms automatically
app.post('/api/sync/note', (req: Request, res: Response) => {
  const { note, profileId } = req.body;
  if (!note || !note.id) {
    return res.status(400).json({ error: 'Missing note data' });
  }

  const allNotes = getNotesData();
  const targetKeys = ['global'];
  if (profileId && profileId !== 'global') {
    targetKeys.push(profileId);
  }

  for (const key of targetKeys) {
    if (!allNotes[key]) allNotes[key] = [];
    const existingIdx = allNotes[key].findIndex((n: any) => n.id === note.id);
    if (existingIdx >= 0) {
      allNotes[key][existingIdx] = note;
    } else {
      allNotes[key].unshift(note);
    }
  }

  saveNotesData(allNotes);
  res.json({ success: true, notes: allNotes['global'] });
});

// 18. Delete Synced Note across all platforms automatically
app.delete('/api/sync/note/:noteId', (req: Request, res: Response) => {
  const noteId = req.params.noteId;
  const allNotes = getNotesData();

  if (allNotes['global']) {
    allNotes['global'] = allNotes['global'].filter((n: any) => n.id !== noteId);
  }
  const customId = req.query.profileId as string;
  if (customId && allNotes[customId]) {
    allNotes[customId] = allNotes[customId].filter((n: any) => n.id !== noteId);
  }

  saveNotesData(allNotes);
  res.json({ success: true, notes: allNotes['global'] || [] });
});

// 19. Sync Video Playback Position (Resume on other devices automatically)
app.post('/api/sync/playback', (req: Request, res: Response) => {
  const { courseId, episodeId, timestampSeconds, profileId } = req.body;
  if (!courseId || !episodeId) {
    return res.status(400).json({ error: 'Missing playback data' });
  }

  const allHistory = getHistoryData();
  const targetKeys = ['global'];
  if (profileId && profileId !== 'global') {
    targetKeys.push(profileId);
  }

  const record = {
    episodeId,
    timestampSeconds: Number(timestampSeconds) || 0,
    updatedAt: new Date().toISOString(),
  };

  for (const key of targetKeys) {
    if (!allHistory[key]) allHistory[key] = {};
    allHistory[key][courseId] = record;
  }

  saveHistoryData(allHistory);
  res.json({ success: true });
});

// Main Server Startup
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler to prevent socket resets
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err);
    if (res.headersSent) return;
    res.status(err.status || 500).json({ error: err.message || 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`KaoLat Academy Server is running on port ${PORT}`);
  });

  // Keep-Alive and Request timeout configuration for Cloud Run / HTTP reverse proxies
  // (Must exceed the 60s load balancer idle timeout to prevent connection resets)
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.requestTimeout = 300000;
}

export default app;

if (!isVercel) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

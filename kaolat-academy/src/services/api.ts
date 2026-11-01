import { Course, Episode } from '../types';

export const ADMIN_KEY_STORAGE = 'kaolat_admin_key';
export const ADMIN_EXPIRY_STORAGE = 'kaolat_admin_expiry';

export function getAdminKey(): string | null {
  let key = localStorage.getItem(ADMIN_KEY_STORAGE);
  let expiryStr = localStorage.getItem(ADMIN_EXPIRY_STORAGE);

  if (!key) {
    key = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    expiryStr = sessionStorage.getItem(ADMIN_EXPIRY_STORAGE);
  }

  if (!key || key === '__LOGGED_OUT__') {
    return null;
  }

  if (expiryStr) {
    const expiryTime = Number(expiryStr);
    if (expiryTime > 0 && Date.now() > expiryTime) {
      clearAdminKey();
      return null;
    }
  }

  return key;
}

export function setAdminKey(key: string, remember30Days = false) {
  clearAdminKey();
  if (!key) return;

  if (remember30Days) {
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days in ms
    localStorage.setItem(ADMIN_KEY_STORAGE, key);
    localStorage.setItem(ADMIN_EXPIRY_STORAGE, String(expiry));
  } else {
    sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
    sessionStorage.setItem(ADMIN_EXPIRY_STORAGE, '0');
  }
}

export function clearAdminKey() {
  localStorage.removeItem(ADMIN_KEY_STORAGE);
  localStorage.removeItem(ADMIN_EXPIRY_STORAGE);
  sessionStorage.removeItem(ADMIN_KEY_STORAGE);
  sessionStorage.removeItem(ADMIN_EXPIRY_STORAGE);
  localStorage.setItem(ADMIN_KEY_STORAGE, '__LOGGED_OUT__');
}

export function isAdminLoggedIn(): boolean {
  const key = getAdminKey();
  return typeof key === 'string' && key.length > 0;
}

export const PROFILE_ID_STORAGE = 'kaolat_profile_id';

// Always 'global' - 100% automatic sync without requiring any code or manual setup
export function getProfileId(): string {
  return 'global';
}

export function setProfileId(_id?: string): string {
  return 'global';
}

export interface SyncStateResponse {
  success: boolean;
  serverTime: string;
  profileId: string;
  autoSync?: boolean;
  courses: Course[];
  progress: Record<string, string[]>;
  notes: any[];
  history: Record<string, { episodeId: string; timestampSeconds: number; updatedAt: string }>;
}

export async function fetchFullSyncState(_profileId?: string): Promise<SyncStateResponse> {
  const res = await fetch('/api/sync/state?profileId=global');
  if (!res.ok) {
    throw new Error('ไม่สามารถเชื่อมต่อระบบซิงค์ได้');
  }
  return await res.json();
}

export async function syncProgressToServer(
  courseId: string,
  episodeId: string,
  isCompleted: boolean,
  _profileId?: string
) {
  const res = await fetch('/api/sync/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId: 'global', courseId, episodeId, isCompleted }),
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function syncNoteToServer(note: any, _profileId?: string) {
  const res = await fetch('/api/sync/note', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId: 'global', note }),
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function syncDeleteNoteFromServer(noteId: string, _profileId?: string) {
  const res = await fetch(`/api/sync/note/${encodeURIComponent(noteId)}?profileId=global`, {
    method: 'DELETE',
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function syncPlaybackToServer(
  courseId: string,
  episodeId: string,
  timestampSeconds: number,
  _profileId?: string
) {
  await fetch('/api/sync/playback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId: 'global', courseId, episodeId, timestampSeconds }),
  }).catch(() => {});
}

function getHeaders(extraHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    ...extraHeaders,
  };
  const key = getAdminKey();
  if (key) {
    headers['x-admin-key'] = encodeURIComponent(key);
  }
  return headers;
}

export async function fetchCourses(): Promise<Course[]> {
  const res = await fetch(`/api/courses?_t=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    },
  });
  if (!res.ok) {
    throw new Error('ไม่สามารถดึงข้อมูลคอร์สเรียนได้');
  }
  const data = await res.json();
  return Array.isArray(data.courses) ? data.courses : [];
}

export async function fetchCourseById(id: string): Promise<Course> {
  const res = await fetch(`/api/courses/${encodeURIComponent(id)}?_t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('ไม่พบคอร์สเรียนนี้');
  }
  const data = await res.json();
  return data.course;
}

export async function verifyAdminPass(password: string): Promise<boolean> {
  const res = await fetch('/api/auth/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    return false;
  }
  const data = await res.json();
  return data.success === true;
}

export async function createCourse(courseData: Partial<Course>): Promise<Course> {
  const adminKey = getAdminKey();
  const payload = {
    ...courseData,
    adminKey: adminKey || undefined,
  };
  const res = await fetch('/api/courses', {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `สร้างคอร์สไม่สำเร็จ (${res.status})`);
  }
  const data = await res.json();
  return data.course;
}

export async function updateCourse(id: string, courseData: Partial<Course>): Promise<Course> {
  const adminKey = getAdminKey();
  const payload = {
    ...courseData,
    adminKey: adminKey || undefined,
  };
  const res = await fetch(`/api/courses/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `แก้ไขคอร์สไม่สำเร็จ (${res.status})`);
  }
  const data = await res.json();
  return data.course;
}

export async function deleteCourse(id: string): Promise<void> {
  const res = await fetch(`/api/courses/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'ลบคอร์สไม่สำเร็จ');
  }
}

export async function addEpisode(
  courseId: string,
  episodeData: Partial<Episode>
): Promise<Episode> {
  const adminKey = getAdminKey();
  const payload = {
    ...episodeData,
    adminKey: adminKey || undefined,
  };
  const targetId = courseId || 'first';
  const res = await fetch(`/api/courses/${encodeURIComponent(targetId)}/episodes?adminKey=${encodeURIComponent(adminKey || '')}`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `เพิ่ม EP ไม่สำเร็จ (${res.status})`);
  }
  const data = await res.json();
  return data.episode;
}

export async function updateEpisode(
  courseId: string,
  epId: string,
  episodeData: Partial<Episode>
): Promise<Episode> {
  const adminKey = getAdminKey();
  const payload = {
    ...episodeData,
    adminKey: adminKey || undefined,
  };
  const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}/episodes/${encodeURIComponent(epId)}?adminKey=${encodeURIComponent(adminKey || '')}`, {
    method: 'PUT',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `แก้ไข EP ไม่สำเร็จ (${res.status})`);
  }
  const data = await res.json();
  return data.episode;
}

export async function deleteEpisode(courseId: string, epId: string): Promise<void> {
  const adminKey = getAdminKey();
  const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}/episodes/${encodeURIComponent(epId)}?adminKey=${encodeURIComponent(adminKey || '')}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `ลบ EP ไม่สำเร็จ (${res.status})`);
  }
}

export async function postComment(
  courseId: string,
  epId: string,
  author: string,
  text: string
) {
  const res = await fetch(`/api/courses/${courseId}/episodes/${epId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ author, text }),
  });
  if (!res.ok) {
    throw new Error('ไม่สามารถส่งคำถามได้');
  }
  return await res.json();
}

export async function uploadVideoFile(
  file: File,
  onProgress?: (percent: number, statusMsg?: string) => void,
  abortSignal?: AbortSignal
): Promise<{ videoUrl: string; filename: string; size: number }> {
  // Use 2MB chunks for maximum resilience across slow or jittery networks and Cloud Run proxies
  const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = `up_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const key = getAdminKey();

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    if (abortSignal?.aborted) {
      throw new Error('การอัปโหลดถูกยกเลิก');
    }

    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunkBlob = file.slice(start, end);

    const queryParams = new URLSearchParams({
      uploadId,
      chunkIndex: String(chunkIndex),
      totalChunks: String(totalChunks),
      fileName: file.name,
      ...(key ? { adminKey: key } : {}),
    });

    const isLast = chunkIndex === totalChunks - 1;

    // Retry up to 4 times per chunk with fresh FormData & exponential backoff
    const maxRetries = 4;
    let attempt = 0;
    let chunkSuccess = false;
    let lastError: any = null;
    let result: any = null;

    while (attempt < maxRetries && !chunkSuccess) {
      if (abortSignal?.aborted) {
        throw new Error('การอัปโหลดถูกยกเลิก');
      }

      attempt++;

      if (attempt > 1 && onProgress) {
        const currentPercent = Math.min(99, Math.round((start / file.size) * 100));
        onProgress(
          currentPercent,
          `สัญญาณเครือข่ายสะดุด กำลังเชื่อมต่อใหม่และส่งต่อชิ้นส่วน ${chunkIndex + 1}/${totalChunks} (รอบที่ ${attempt}/${maxRetries})...`
        );
      }

      try {
        result = await new Promise<any>((resolve, reject) => {
          // CRITICAL: Construct new FormData per attempt so browser stream is fresh
          const formData = new FormData();
          formData.append('uploadId', uploadId);
          formData.append('chunkIndex', String(chunkIndex));
          formData.append('totalChunks', String(totalChunks));
          formData.append('fileName', file.name);
          formData.append('chunk', chunkBlob, `part_${chunkIndex}`);

          const xhr = new XMLHttpRequest();
          xhr.open('POST', `/api/upload-video-chunk?${queryParams.toString()}`);
          xhr.timeout = 75000; // 75s per 2MB chunk

          if (key) {
            xhr.setRequestHeader('x-admin-key', encodeURIComponent(key));
          }

          if (abortSignal) {
            const onAbort = () => {
              xhr.abort();
              reject(new Error('การอัปโหลดถูกยกเลิก'));
            };
            abortSignal.addEventListener('abort', onAbort, { once: true });
          }

          if (xhr.upload && onProgress) {
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const currentChunkLoaded = event.loaded;
                const totalLoadedSoFar = start + currentChunkLoaded;
                const overallPercent = Math.min(99, Math.round((totalLoadedSoFar / file.size) * 100));
                onProgress(
                  overallPercent,
                  isLast
                    ? 'กำลังรวบรวมไฟล์วิดีโอบนเซิร์ฟเวอร์...'
                    : `กำลังอัปโหลดชิ้นส่วนที่ ${chunkIndex + 1}/${totalChunks}...`
                );
              }
            };
          }

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const resp = JSON.parse(xhr.responseText);
                resolve(resp);
              } catch {
                reject(new Error('เกิดข้อผิดพลาดในการประมวลผลข้อมูล'));
              }
            } else if (xhr.status >= 500) {
              // Server or Cloud Run proxy transient glitch (502, 503, 504) -> trigger retry
              reject(new Error(`เซิร์ฟเวอร์ตอบกลับไม่สำเร็จ (Status ${xhr.status})`));
            } else {
              try {
                const err = JSON.parse(xhr.responseText);
                reject(new Error(err.error || `อัปโหลดไม่สำเร็จ (Status ${xhr.status})`));
              } catch {
                reject(new Error(`อัปโหลดไม่สำเร็จ (Status ${xhr.status})`));
              }
            }
          };

          xhr.ontimeout = () => {
            reject(new Error('การเชื่อมต่อเครือข่ายหมดเวลา'));
          };

          xhr.onerror = () => {
            reject(new Error('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่ายขณะอัปโหลด'));
          };

          xhr.send(formData);
        });

        chunkSuccess = true;
      } catch (err: any) {
        lastError = err;
        if (abortSignal?.aborted) {
          throw err;
        }

        // Wait with backoff before retrying chunk
        if (attempt < maxRetries) {
          const delay = Math.min(800 * Math.pow(1.5, attempt - 1), 3000);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    if (!chunkSuccess) {
      throw lastError || new Error(`อัปโหลดไฟล์วิดีโอล้มเหลวที่ชิ้นส่วน ${chunkIndex + 1}/${totalChunks}`);
    }

    if (isLast && result?.isCompleted) {
      if (onProgress) onProgress(100, 'อัปโหลดวิดีโอสำเร็จเรียบร้อย');
      return result;
    }
  }

  throw new Error('อัปโหลดไฟล์วิดีโอล้มเหลว');
}

export function uploadImageFile(file: File): Promise<{ imageUrl: string; filename: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('image', file);

    const key = getAdminKey();
    const query = key ? `?adminKey=${encodeURIComponent(key)}` : '';
    xhr.open('POST', `/api/upload-image${query}`);
    xhr.timeout = 45000;

    if (key) {
      xhr.setRequestHeader('x-admin-key', encodeURIComponent(key));
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resp = JSON.parse(xhr.responseText);
          resolve(resp);
        } catch {
          reject(new Error('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ'));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || 'อัปโหลดรูปภาพไม่สำเร็จ'));
        } catch {
          reject(new Error(`อัปโหลดรูปภาพไม่สำเร็จ (${xhr.status})`));
        }
      }
    };

    xhr.ontimeout = () => {
      reject(new Error('การอัปโหลดรูปภาพหมดเวลา กรุณาลองใหม่อีกครั้ง'));
    };

    xhr.onerror = () => {
      reject(new Error('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย'));
    };

    xhr.send(formData);
  });
}

import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocs,
  query,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Course } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.warn(`Firestore Error during ${operationType} on ${path}:`, error);
}

/**
 * Subscribe to real-time course updates from Firestore.
 * Fires instantly (< 500ms) whenever ANY user on ANY link/device adds, edits, or deletes a course or clip.
 */
export function subscribeToCourses(
  onUpdate: (courses: Course[]) => void,
  onError?: (err: any) => void
): () => void {
  const collectionRef = collection(db, 'courses');

  const unsubscribe = onSnapshot(
    collectionRef,
    (snapshot) => {
      const coursesList: Course[] = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.exists()) {
          coursesList.push(docSnap.data() as Course);
        }
      });

      // Sort by creation date descending (newest courses first)
      coursesList.sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      onUpdate(coursesList);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'courses');
      if (onError) onError(error);
    }
  );

  return unsubscribe;
}

/**
 * Save or update a course in Firestore (persisted globally across all users & links)
 */
export async function saveCourseToFirestore(course: Course): Promise<void> {
  const path = `courses/${course.id}`;
  try {
    const docRef = doc(db, 'courses', course.id);
    // Sanitize data before writing
    const cleanPayload = JSON.parse(JSON.stringify(course));
    await setDoc(docRef, cleanPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Delete a course from Firestore
 */
export async function deleteCourseFromFirestore(courseId: string): Promise<void> {
  const path = `courses/${courseId}`;
  try {
    const docRef = doc(db, 'courses', courseId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

/**
 * Clean up legacy default physics course if present in Firestore
 */
export async function seedInitialCoursesIfEmpty(_initialCourses?: Course[]): Promise<void> {
  try {
    // Delete legacy default physics course from Firestore if exists
    const physicsDocRef = doc(db, 'courses', 'course-1793496540162-y9mfl');
    await deleteDoc(physicsDocRef).catch(() => {});
  } catch (err) {
    console.warn('Error cleaning legacy physics course:', err);
  }
}

export interface Chapter {
  time: string;
  title: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface Episode {
  id: string;
  epNumber: number;
  title: string;
  description: string;
  duration: string;
  videoUrl: string;
  videoFileName?: string;
  uploadedAt: string;
  summary?: string;
  chapters?: Chapter[];
  quiz?: QuizQuestion[];
  comments?: Comment[];
}

export interface Course {
  id: string;
  title: string;
  category: string;
  instructor: string;
  description: string;
  level: string;
  coverImage: string;
  createdAt: string;
  episodes: Episode[];
}

export interface UserNote {
  id: string;
  courseId: string;
  episodeId: string;
  timestampSeconds: number;
  timestampText: string;
  content: string;
  createdAt: string;
}

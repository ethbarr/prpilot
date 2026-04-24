export type ApiProvider = 'openai' | 'anthropic';

export type ReviewStyle = 'general' | 'security' | 'performance' | 'concise';

export type CommentType = 'issue' | 'suggestion' | 'praise';

export type Severity = 'high' | 'medium' | 'low' | 'info';

export type FileStatus = 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';

export interface Settings {
  apiKey: string;
  apiProvider: ApiProvider;
  model: string;
  reviewStyle: ReviewStyle;
  githubToken?: string;
  maxFilesPerReview: number;
  maxPatchCharsPerFile: number;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  apiProvider: 'anthropic',
  model: 'claude-sonnet-4-6',
  reviewStyle: 'general',
  githubToken: '',
  maxFilesPerReview: 20,
  maxPatchCharsPerFile: 3000,
};

export interface DiffFile {
  filename: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface PRInfo {
  owner: string;
  repo: string;
  prNumber: number;
}

export interface ReviewComment {
  type: CommentType;
  severity: Severity;
  file?: string;
  message: string;
}

export interface ReviewResult {
  summary: string;
  comments: ReviewComment[];
  overallScore: number;
}

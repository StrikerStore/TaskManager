export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  isPersonal: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  projectId: string | null;
  projectName: string | null;
  projectColor: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeImage: string | null;
};

export type Project = {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  createdAt: string;
  openCount: number;
};

export type TeamMember = {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string; username: string | null; image?: string | null };
};

/** Someone asking to join the current team, as an owner or admin sees it. */
export type JoinRequest = {
  id: string;
  createdAt: string;
  user: { id: string; name: string; username: string | null };
};

/** One of your own requests to join a team. */
export type MyJoinRequest = {
  id: string;
  teamId: string;
  teamName: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
};

export type Team = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
};

/** The filter state that drives the task list; mirrored into the URL. */
export type TaskFilters = {
  q: string;
  projectIds: string[];
  assigneeIds: string[];
  status: TaskStatus[];
  priority: TaskPriority[];
  due: "overdue" | "today" | "week" | "none" | null;
  scope: "all" | "mine" | "personal" | "created";
  showCompleted: boolean;
  sort: "due" | "priority" | "created" | "updated";
  groupBy: "none" | "project" | "assignee" | "status";
};

export const DEFAULT_FILTERS: TaskFilters = {
  q: "",
  projectIds: [],
  assigneeIds: [],
  status: [],
  priority: [],
  due: null,
  scope: "all",
  showCompleted: false,
  sort: "created",
  groupBy: "none",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const RECURRENCE_FREQUENCIES = ["daily", "weekly", "biweekly", "monthly"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const FREQUENCY_LABEL: Record<RecurrenceFrequency, string> = {
  daily: "Every day",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
};

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Single letters for the day chips; index matches getDay(). */
export const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"] as const;
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const DAY_PRESETS: Array<{ label: string; days: number[] }> = [
  { label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { label: "Mon/Wed/Fri", days: [1, 3, 5] },
  { label: "Weekends", days: [0, 6] },
];

export type RecurringRule = {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  isPersonal: boolean;
  frequency: RecurrenceFrequency;
  /** 0-6, Sunday-Saturday. Two entries is "twice a week". */
  weekdays: number[];
  /** 1-31; 29-31 fall back to the last day in shorter months. */
  monthDays: number[];
  /** Wording built by the API so it cannot drift from the scheduler. */
  summary: string;
  /** "HH:MM", server local time. */
  triggerTime: string;
  dueOffsetDays: number;
  active: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  createdById: string;
  projectId: string | null;
  projectName: string | null;
  projectColor: string | null;
  assigneeId: string;
  assigneeName: string | null;
  assigneeImage: string | null;
};

/** The Project dropdown puts "Personal" first, as if it were a project. */
export const PERSONAL_PROJECT_ID = "personal";

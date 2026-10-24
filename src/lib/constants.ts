export type Role = "student" | "teacher" | "counselor" | "admin" | "parent";

export const ROLE_LABELS: Record<Role, string> = {
  student: "Student",
  teacher: "Teacher",
  counselor: "School counselor",
  admin: "School administrator",
  parent: "Parent / guardian",
};

export const ROLE_HOME: Record<Role, string> = {
  student: "/student",
  teacher: "/teacher",
  counselor: "/counselor",
  admin: "/admin",
  parent: "/parent",
};

export const INTEREST_CATALOG: Array<{ slug: string; label: string; category: string }> = [
  { slug: "programming", label: "Programming", category: "Tech" },
  { slug: "robotics", label: "Robotics", category: "Tech" },
  { slug: "gaming", label: "Gaming", category: "Tech" },
  { slug: "design", label: "Digital design", category: "Tech" },
  { slug: "art", label: "Art & drawing", category: "Creative" },
  { slug: "music", label: "Music", category: "Creative" },
  { slug: "photography", label: "Photography", category: "Creative" },
  { slug: "theatre", label: "Theatre & drama", category: "Creative" },
  { slug: "writing", label: "Creative writing", category: "Creative" },
  { slug: "football", label: "Football", category: "Sports" },
  { slug: "basketball", label: "Basketball", category: "Sports" },
  { slug: "running", label: "Running", category: "Sports" },
  { slug: "dance", label: "Dance", category: "Sports" },
  { slug: "chess", label: "Chess", category: "Sports" },
  { slug: "science", label: "Science experiments", category: "Academic" },
  { slug: "math", label: "Maths challenges", category: "Academic" },
  { slug: "history", label: "History", category: "Academic" },
  { slug: "languages", label: "Foreign languages", category: "Academic" },
  { slug: "debate", label: "Debate", category: "Academic" },
  { slug: "reading", label: "Reading", category: "Academic" },
  { slug: "volunteering", label: "Volunteering", category: "Community" },
  { slug: "environment", label: "Environment & nature", category: "Community" },
  { slug: "entrepreneurship", label: "Entrepreneurship", category: "Community" },
  { slug: "film", label: "Film & series", category: "Culture" },
];

export const GOAL_OPTIONS: Record<string, string> = {
  improve_math: "Get better at maths",
  exam_prep: "Prepare for national exams",
  learn_coding: "Learn to code",
  public_speaking: "Speak with more confidence",
  creative_projects: "Build creative projects",
  science_fair: "Enter a science competition",
  language_skills: "Improve a foreign language",
  reading_more: "Read more books",
  time_management: "Manage my time better",
  make_friends: "Meet new people",
};

export const LEARNING_STYLES: Record<string, string> = {
  visual: "Visual — diagrams, colours, mind maps",
  auditory: "Auditory — talking it through, listening",
  reading: "Reading & writing — notes and summaries",
  hands_on: "Hands-on — examples, practice, doing",
  mixed: "A mix of everything",
};

export const OPEN_TO: Record<string, string> = {
  study_partner: "Study partners",
  project: "Project teammates",
  club: "Clubs & activities",
};

export const CHECKIN_FACTORS: Record<string, string> = {
  tests: "Tests or exams",
  workload: "Homework / workload",
  breaks: "Breaks & free time",
  friendships: "Friendships",
  teachers: "Interactions with teachers",
  sleep: "Sleep",
  family: "Home & family",
  activities: "Sports / activities",
  online: "Online life",
};

export const EXPERIENCE_OPTIONS: Record<string, { label: string; emoji: string }> = {
  great: { label: "Great", emoji: "🌟" },
  good: { label: "Good", emoji: "🙂" },
  mixed: { label: "Mixed", emoji: "😐" },
  hard: { label: "Hard", emoji: "😕" },
  very_hard: { label: "Really hard", emoji: "😣" },
};

export const SEVERITY_LABELS: Record<string, string> = {
  info: "Informational",
  attention: "Attention needed",
  urgent: "Urgent review",
};

export const ALERT_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  in_progress: "Support in progress",
  resolved: "Resolved",
};

export const AVATAR_COLORS = ["coral", "pink", "rose", "amber", "teal", "sky", "violet", "slate"] as const;

export const WEEKDAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const PERMISSION_LABELS: Record<string, string> = {
  "wellbeing.alerts": "Review wellbeing alerts (safeguarding)",
  "wellbeing.rules": "Configure wellbeing alert rules",
  "wellbeing.aggregate": "View school-wide aggregate wellbeing",
  "safeguarding.reports": "Review bullying & harassment reports",
};

export const CONSENT_LABELS: Record<string, string> = {
  platform: "Use of EduConnect AI",
  wellbeing_checkins: "Daily wellbeing check-ins",
  matchmaking: "Peer matchmaking & connections",
  ai_features: "AI tutor & wellbeing assistant",
  guardian_access: "Guardian access to academic records",
};

/** Romania's age of digital consent (GDPR Art. 8, Law 190/2018). */
export const DIGITAL_CONSENT_AGE = 16;

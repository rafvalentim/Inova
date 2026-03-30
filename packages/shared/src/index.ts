// ===== ENUMS =====
export enum UserStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    BLOCKED = 'BLOCKED',
}

export enum ProjectStatus {
    PLANNING = 'PLANNING',
    IN_PROGRESS = 'IN_PROGRESS',
    PAUSED = 'PAUSED',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

export enum SprintStatus {
    PLANNING = 'PLANNING',
    ACTIVE = 'ACTIVE',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

export enum TaskStatus {
    BACKLOG = 'BACKLOG',
    TODO = 'TODO',
    IN_PROGRESS = 'IN_PROGRESS',
    IN_REVIEW = 'IN_REVIEW',
    DONE = 'DONE',
}

export enum Priority {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
}

export enum TimeEntrySource {
    MANUAL = 'MANUAL',
    CLOCKIFY = 'CLOCKIFY',
}

export enum ProjectInfoCategory {
    CONTACT = 'CONTACT',
    LINK_STAGING = 'LINK_STAGING',
    LINK_PRODUCTION = 'LINK_PRODUCTION',
    LINK_DATABASE = 'LINK_DATABASE',
    CREDENTIAL = 'CREDENTIAL',
    OTHER = 'OTHER',
}

// ===== PERMISSION TYPES =====
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'read_sensitive';

export type PermissionResource =
    | 'users'
    | 'roles'
    | 'projects'
    | 'project_members'
    | 'project_info'
    | 'sprints'
    | 'tasks'
    | 'comments'
    | 'attachments'
    | 'dashboard'
    | 'reports'
    | 'audit_logs'
    | 'settings'
    | 'clockify';

export type Permissions = Partial<Record<PermissionResource, PermissionAction[]>>;

// ===== API RESPONSE TYPES =====
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

// ===== AUTH TYPES =====
export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    user: UserProfile;
}

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    status: UserStatus;
    firstLogin: boolean;
    role: {
        id: string;
        name: string;
        permissions: Permissions;
    };
}

export interface ForgotPasswordRequest {
    email: string;
}

export interface ResetPasswordRequest {
    token: string;
    password: string;
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

// ===== USER TYPES =====
export interface CreateUserRequest {
    name: string;
    email: string;
    password: string;
    roleId: string;
}

export interface UpdateUserRequest {
    name?: string;
    email?: string;
    roleId?: string;
    clockifyId?: string;
}

export interface UserListItem {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    status: UserStatus;
    firstLogin: boolean;
    role: { id: string; name: string };
    createdAt: string;
}

// ===== ROLE TYPES =====
export interface CreateRoleRequest {
    name: string;
    description?: string;
    permissions: Permissions;
}

export interface UpdateRoleRequest {
    name?: string;
    description?: string;
    permissions?: Permissions;
}

export interface RoleListItem {
    id: string;
    name: string;
    description: string | null;
    permissions: Permissions;
    isSystem: boolean;
    _count: { users: number };
    createdAt: string;
}

// ===== PROJECT TYPES =====
export interface CreateProjectRequest {
    name: string;
    description?: string;
    startDate?: string;
    targetDate?: string;
    memberIds?: string[];
}

export interface UpdateProjectRequest {
    name?: string;
    description?: string;
    startDate?: string;
    targetDate?: string;
    status?: ProjectStatus;
}

export interface ProjectListItem {
    id: string;
    code: string;
    name: string;
    description: string | null;
    status: ProjectStatus;
    startDate: string | null;
    targetDate: string | null;
    createdAt: string;
    _count: { members: number; sprints: number; tasks: number };
}

export interface ProjectDetail extends ProjectListItem {
    createdBy: { id: string; name: string };
    members: ProjectMemberItem[];
}

export interface ProjectMemberItem {
    id: string;
    roleInProject: string;
    joinedAt: string;
    user: { id: string; name: string; email: string; avatarUrl: string | null };
}

// ===== SPRINT TYPES =====
export interface CreateSprintRequest {
    name: string;
    goal?: string;
    startDate: string;
    endDate: string;
    capacityPts?: number;
}

export interface UpdateSprintRequest {
    name?: string;
    goal?: string;
    startDate?: string;
    endDate?: string;
    capacityPts?: number;
}

export interface SprintListItem {
    id: string;
    name: string;
    goal: string | null;
    startDate: string;
    endDate: string;
    status: SprintStatus;
    capacityPts: number | null;
    _count: { tasks: number };
}

// ===== TASK TYPES =====
export interface CreateTaskRequest {
    title: string;
    description?: string;
    priority?: Priority;
    sprintId?: string;
    parentId?: string;
    dueDate?: string;
    storyPoints?: number;
    tags?: string[];
    assigneeIds?: string[];
}

export interface UpdateTaskRequest {
    title?: string;
    description?: string;
    priority?: Priority;
    sprintId?: string | null;
    dueDate?: string | null;
    storyPoints?: number | null;
    tags?: string[];
    assigneeIds?: string[];
}

export interface TaskListItem {
    id: string;
    title: string;
    status: TaskStatus;
    priority: Priority;
    storyPoints: number | null;
    dueDate: string | null;
    position: number;
    tags: string[];
    sprintId: string | null;
    parentId: string | null;
    assignees: { user: { id: string; name: string; avatarUrl: string | null } }[];
    _count: { comments: number; attachments: number; subtasks: number };
    createdAt: string;
}

export interface TaskDetail extends TaskListItem {
    description: string | null;
    project: { id: string; code: string; name: string };
    sprint: { id: string; name: string } | null;
    createdBy: { id: string; name: string };
    comments: CommentItem[];
    attachments: AttachmentItem[];
    timeEntries: TimeEntryItem[];
}

// ===== COMMENT TYPES =====
export interface CreateCommentRequest {
    content: string;
}

export interface CommentItem {
    id: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    user: { id: string; name: string; avatarUrl: string | null };
}

// ===== ATTACHMENT TYPES =====
export interface AttachmentItem {
    id: string;
    filename: string;
    filepath: string;
    sizeBytes: number;
    mimeType: string;
    createdAt: string;
    uploadedBy: { id: string; name: string };
}

// ===== TIME ENTRY TYPES =====
export interface CreateTimeEntryRequest {
    durationMin: number;
    description?: string;
    date: string;
}

export interface TimeEntryItem {
    id: string;
    durationMin: number;
    description: string | null;
    source: TimeEntrySource;
    date: string;
    clockifyId: string | null;
    createdAt: string;
    user: { id: string; name: string };
}

// ===== DASHBOARD TYPES =====
export interface DashboardSummary {
    activeProjects: number;
    tasksInProgress: number;
    overdueTasks: number;
    hoursThisWeek: number;
    hoursCapacity: number;
}

export interface ProjectProgress {
    id: string;
    name: string;
    code: string;
    totalTasks: number;
    doneTasks: number;
    percentage: number;
}

export interface TaskDistribution {
    status: TaskStatus;
    count: number;
}

export interface MemberWorkload {
    userId: string;
    name: string;
    avatarUrl: string | null;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
}

// ===== PROJECT INFO TYPES =====
export interface ProjectInfoItem {
    id: string;
    projectId: string;
    category: ProjectInfoCategory;
    label: string;
    value: string;
    username: string | null;
    isSensitive: boolean;
    notes: string | null;
    order: number;
    createdAt: string;
    updatedAt: string;
    createdBy: { id: string; name: string };
}

export interface CreateProjectInfoRequest {
    category: ProjectInfoCategory;
    label: string;
    value: string;
    username?: string;
    isSensitive?: boolean;
    notes?: string;
    order?: number;
}

export interface UpdateProjectInfoRequest {
    category?: ProjectInfoCategory;
    label?: string;
    value?: string;
    username?: string | null;
    isSensitive?: boolean;
    notes?: string | null;
    order?: number;
}

// ===== AUDIT LOG TYPES =====
export interface AuditLogItem {
    id: string;
    action: string;
    resource: string;
    resourceId: string | null;
    oldValue: unknown;
    newValue: unknown;
    ipAddress: string | null;
    createdAt: string;
    user: { id: string; name: string };
}

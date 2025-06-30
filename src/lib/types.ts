
export enum DynamicFieldType {
  TEXT_INPUT = "Text Input",
  TEXT_AREA = "Text Area",
  NUMBER = "Number",
  DATE = "Date",
  TIME = "Time",
  DATETIME = "Date/Time",
  DOCUMENT_UPLOAD = "Document Upload",
  DROPDOWN_LIST = "Dropdown List",
  CHECKBOX_GROUP = "Checkbox Group",
  RADIO_BUTTON_GROUP = "Radio Button Group",
  BOOLEAN_TOGGLE = "Boolean/Toggle",
}

export interface DynamicFieldOption {
  value: string;
  label: string;
}

export interface DynamicFieldValidationRules {
  regex?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  email?: boolean;
  url?: boolean;
  phoneNumber?: boolean;
}

export interface DynamicField {
  id: string;
  name: string; // Unique identifier, e.g., "CustomerName"
  label: string; // User-friendly label, e.g., "Customer Name"
  type: DynamicFieldType;
  category?: string; // Optional category for organization
  validationRules?: DynamicFieldValidationRules;
  isRequired: boolean;
  defaultValue?: string | number | boolean | string[];
  options?: DynamicFieldOption[]; // For Dropdown, Checkbox, Radio
  createdAt: string;
  updatedAt?: string;
  isArchived?: boolean;
}

export interface DynamicTable {
  id: string;
  name: string; // Unique table name, e.g., "customer_profile"
  label: string; // Display label, e.g., "Customer Profile"
  description?: string;
  fieldIds: string[]; // Ordered list of DynamicField IDs
  createdAt: string;
  updatedAt?: string; // Added for consistency
  isArchived?: boolean;
}

export interface DynamicTableRowData {
  id: string;
  data: Record<string, any>; // The actual row data { fieldName: value }
  createdAt: string;
  updatedAt?: string;
  isArchived?: boolean;
}

export interface TaskTemplate {
  id: string;
  name: string; // Unique name, e.g., "Verify Customer ID"
  description?: string;
  category?: string; // Optional category for organization
  assignedRoleType?: string; // e.g., "Administrator", "Task Executor"
  dueDateOffsetDays?: number; // Relative to workflow start or previous task
  dynamicTableId?: string; // Optional: ID of DynamicTable to be filled/reviewed
  notificationsConfig?: Record<string, any>; // e.g., { onAssignment: true, onOverdue: true }
  dependencies?: string[]; // List of TaskTemplate IDs
  createdAt: string;
  updatedAt?: string;
  isArchived?: boolean; // Added for archiving
}

export interface WorkflowTemplate {
  id: string;
  name: string; // Unique name, e.g., "New Customer Onboarding"
  description?: string;
  taskTemplateIds: string[]; // Ordered sequence of TaskTemplate IDs
  createdAt: string;
  updatedAt?: string; // Added for consistency
  isArchived?: boolean;
}

export enum WorkflowInstanceStatus {
  ACTIVE = "Active",
  COMPLETED = "Completed",
  CANCELLED = "Cancelled",
}

export interface WorkflowInstance {
  id: string;
  workflowTemplateId: string;
  status: WorkflowInstanceStatus;
  startedByUserId?: string; // User who initiated
  startDatetime: string;
  finishDatetime?: string;
  name?: string; // Usually derived from template name + instance identifier
  associatedData?: Record<string, string>; // Maps dynamicTableId to dynamicTableRowId
  isArchived?: boolean;
  createdAt: string; // Added for consistency
  updatedAt?: string; // Added for consistency
}

export enum TaskStatus {
  PENDING = "Pending",
  IN_PROGRESS = "In Progress",
  COMPLETED = "Completed",
  OVERDUE = "Overdue",
  SKIPPED = "Skipped",
}

export interface Task {
  id: string;
  taskTemplateId: string;
  workflowInstanceId: string;
  assignedToUserId?: string;
  status: TaskStatus;
  dueDate?: string;
  startDatetime?: string;
  finishDatetime?: string;
  notes?: string;
  dynamicTableId?: string; // ID of the DynamicTable schema associated via TaskTemplate
  dynamicTableData?: Record<string, any>; // Actual data entered for this task's dynamic table
  createdAt: string;
  updatedAt?: string;
  // Tasks themselves are part of an instance; archiving instance handles tasks.
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: "Administrator" | "TaskExecutor" | "StandardUser";
  createdAt: string;
  updatedAt?: string; // Added for consistency
  isArchived?: boolean; // For disabling/archiving user accounts
}

// For dashboard summary
export interface WorkflowSummary {
  totalActive: number;
  totalCompleted: number;
  byTemplate: Array<{ templateName: string; count: number }>;
}

export interface TaskSummary {
  totalTasks: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

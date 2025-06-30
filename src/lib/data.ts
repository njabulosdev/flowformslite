
import { db, storage as firebaseSdkStorage } from './firebase';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  Timestamp,
  writeBatch,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
  runTransaction,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL as getStorageDownloadURL,
  deleteObject,
} from 'firebase/storage';

import type { DynamicTable, DynamicField, TaskTemplate, WorkflowTemplate, WorkflowInstance, Task, User, WorkflowSummary, TaskSummary, DynamicTableRowData } from './types';
import { DynamicFieldType, WorkflowInstanceStatus, TaskStatus } from './types';
import { auth as firebaseAuthInstance } from './firebase';

// --- Firestore Collection Names ---
const COLLECTIONS = {
  USERS: 'users',
  DYNAMIC_FIELDS: 'dynamicFields',
  DYNAMIC_TABLES: 'dynamicTables',
  TASK_TEMPLATES: 'taskTemplates',
  WORKFLOW_TEMPLATES: 'workflowTemplates',
  WORKFLOW_INSTANCES: 'workflowInstances',
  TASKS: 'tasks',
};

// --- Helper function to convert Firestore Timestamps to ISO strings ---
const fromFirestore = <T extends { id: string; createdAt?: any; updatedAt?: any; startDatetime?: any; finishDatetime?: any; dueDate?: any }>(docSnap: any): T => {
  const data = docSnap.data() as any;
  const result: any = { id: docSnap.id };

  for (const key in data) {
    if (data[key] instanceof Timestamp) {
      result[key] = data[key].toDate().toISOString();
    } else {
      result[key] = data[key];
    }
  }
  if (!result.createdAt && data.createdAt === undefined && result.id) {
     result.createdAt = new Date(0).toISOString();
  }
  return result as T;
};

// Helper to prepare data for Firestore (convert ISO strings to Timestamps)
const toFirestore = (data: Record<string, any>): Record<string, any> => {
  const firestoreData: Record<string, any> = { ...data };
  for (const key in firestoreData) {
    if (firestoreData[key] === undefined) { // Remove undefined fields before processing
        delete firestoreData[key];
        continue;
    }
    if (typeof firestoreData[key] === 'string') {
      const dateFields = ['createdAt', 'updatedAt', 'startDatetime', 'finishDatetime', 'dueDate'];
      if (dateFields.includes(key) && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(firestoreData[key])) {
        const dateValue = new Date(firestoreData[key]);
        if (!isNaN(dateValue.getTime())) {
            firestoreData[key] = Timestamp.fromDate(dateValue);
        }
      }
    }
  }
  return firestoreData;
};


// --- Firebase Storage SDK Helper Functions ---

export const uploadFileToStorage = async (file: File, path: string): Promise<string> => {
  if (typeof window !== 'undefined') {
    console.log(`[uploadFileToStorage] Upload attempt from origin: ${window.location.origin}`);
    console.log(`[uploadFileToStorage] Full HREf of uploading page: ${window.location.href}`);
  }
  console.log(`[uploadFileToStorage] Uploading ${file.name} to path: ${path} using Firebase SDK.`);

  try {
    const fileRef = storageRef(firebaseSdkStorage, path);
    const snapshot = await uploadBytes(fileRef, file);
    console.log(`[uploadFileToStorage] Successfully uploaded ${file.name}. Snapshot:`, snapshot);
    // Return the full path, as this is what we store in Firestore
    return snapshot.ref.fullPath;
  } catch (error) {
    console.error(`[uploadFileToStorage] Error during file upload to ${path} using Firebase SDK:`, error);
    throw error;
  }
};

export const getFileDownloadURL = async (storagePath: string): Promise<string> => {
   console.log(`[getFileDownloadURL] Getting download URL for path: ${storagePath} using Firebase SDK.`);
   try {
     const fileRef = storageRef(firebaseSdkStorage, storagePath);
     const url = await getStorageDownloadURL(fileRef);
     console.log(`[getFileDownloadURL] Successfully got download URL: ${url}`);
     return url;
   } catch (error: any) {
     console.error(`[getFileDownloadURL] Error getting download URL for ${storagePath} using Firebase SDK:`, error);
     // Handle specific errors, e.g., object not found
     if (error.code === 'storage/object-not-found') {
       throw new Error(`File not found at path: ${storagePath}`);
     }
     throw error;
   }
};

export const deleteFileFromStorage = async (storagePath: string): Promise<void> => {
  if (!storagePath || typeof storagePath !== 'string' || storagePath.trim() === '') {
    console.warn('[deleteFileFromStorage] Attempted to delete file with invalid or empty storage path.');
    return;
  }
  console.log(`[deleteFileFromStorage] Deleting file at path: ${storagePath} using Firebase SDK.`);
  try {
    const fileRef = storageRef(firebaseSdkStorage, storagePath);
    await deleteObject(fileRef);
    console.log(`[deleteFileFromStorage] File ${storagePath} deleted successfully using Firebase SDK.`);
  } catch (error: any) {
    console.error(`[deleteFileFromStorage] Error deleting file ${storagePath} using Firebase SDK:`, error);
    // It's common to not throw an error if the file wasn't found, as the desired state (file doesn't exist) is achieved.
    if (error.code === 'storage/object-not-found') {
      console.log(`[deleteFileFromStorage] File ${storagePath} not found, considered deleted.`);
      return;
    }
    throw error;
  }
};


// --- User Management ---
export const getUsers = async (): Promise<User[]> => {
  const q = query(collection(db, COLLECTIONS.USERS), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => fromFirestore<User>(docSnap));
};

export const addUser = async (userData: Partial<User> & Pick<User, 'email'> & { role: User['role'], username?: string }): Promise<User> => {
  const dataToSave: any = {
    email: userData.email,
    role: userData.role || 'StandardUser',
    username: userData.username || userData.email.split('@')[0] || `user_${Date.now()}`,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  let docRef;
  if (userData.id) {
    docRef = doc(db, COLLECTIONS.USERS, userData.id);
    await setDoc(docRef, toFirestore(dataToSave));
  } else {
    const authUser = firebaseAuthInstance.currentUser;
    if (!authUser) throw new Error("User must be authenticated to create a profile without an ID.");
    docRef = doc(db, COLLECTIONS.USERS, authUser.uid);
    await setDoc(docRef, toFirestore(dataToSave));
  }

  const newDocSnap = await getDoc(docRef);
  if (!newDocSnap.exists()) {
    throw new Error("Failed to create or retrieve user document.");
  }
  return fromFirestore<User>(newDocSnap);
};


export const updateUser = async (userId: string, userData: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User> => {
  const docRef = doc(db, COLLECTIONS.USERS, userId);
  await updateDoc(docRef, toFirestore({
    ...userData,
    updatedAt: serverTimestamp(),
  }));
  const updatedDocSnap = await getDoc(docRef);
  if (!updatedDocSnap.exists()) throw new Error("User not found after update");
  return fromFirestore<User>(updatedDocSnap);
};

export const archiveUser = async (userId: string, archive: boolean): Promise<User> => {
  const docRef = doc(db, COLLECTIONS.USERS, userId);
  await updateDoc(docRef, {
    isArchived: archive,
    updatedAt: serverTimestamp(),
  });
  const updatedDocSnap = await getDoc(docRef);
  if (!updatedDocSnap.exists()) throw new Error("User not found after archive/unarchive");
  return fromFirestore<User>(updatedDocSnap);
};


// --- DynamicField Functions ---
export const getDynamicFields = async (): Promise<DynamicField[]> => {
  const q = query(collection(db, COLLECTIONS.DYNAMIC_FIELDS), orderBy("label", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => fromFirestore<DynamicField>(docSnap));
};

export const addDynamicField = async (field: Omit<DynamicField, 'id' | 'createdAt' | 'updatedAt'>): Promise<DynamicField> => {
  const docRef = await addDoc(collection(db, COLLECTIONS.DYNAMIC_FIELDS), toFirestore({
    ...field,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  const newDocSnap = await getDoc(docRef);
  if (!newDocSnap.exists()) throw new Error("Failed to create dynamic field.");
  return fromFirestore<DynamicField>(newDocSnap);
};

export const updateDynamicField = async (
  id: string,
  data: Partial<Omit<DynamicField, 'id' | 'createdAt'>>
): Promise<DynamicField> => {
  const docRef = doc(db, COLLECTIONS.DYNAMIC_FIELDS, id);
  const updateData = {
    ...data,
    updatedAt: serverTimestamp(),
  };
  await updateDoc(docRef, toFirestore(updateData));
  const updatedDocSnap = await getDoc(docRef);
  if (!updatedDocSnap.exists()) {
    throw new Error("Dynamic field not found after update");
  }
  return fromFirestore<DynamicField>(updatedDocSnap);
};

export const archiveDynamicField = async (id: string, archive: boolean): Promise<DynamicField> => {
  const docRef = doc(db, COLLECTIONS.DYNAMIC_FIELDS, id);
  await updateDoc(docRef, {
    isArchived: archive,
    updatedAt: serverTimestamp(),
  });
  const updatedDocSnap = await getDoc(docRef);
  if (!updatedDocSnap.exists()) throw new Error("Dynamic field not found after archive/unarchive");
  return fromFirestore<DynamicField>(updatedDocSnap);
};

export const getDynamicFieldById = async (id: string): Promise<DynamicField | undefined> => {
  const docRef = doc(db, COLLECTIONS.DYNAMIC_FIELDS, id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? fromFirestore<DynamicField>(docSnap) : undefined;
};

// --- DynamicTable Functions ---
export const getDynamicTables = async (): Promise<DynamicTable[]> => {
  const q = query(collection(db, COLLECTIONS.DYNAMIC_TABLES), orderBy("label", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => fromFirestore<DynamicTable>(docSnap));
};

export const subscribeToDynamicTables = (
  onUpdate: (tables: DynamicTable[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  const q = query(collection(db, COLLECTIONS.DYNAMIC_TABLES), orderBy("label", "asc"));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const tables = querySnapshot.docs.map(docSnap => fromFirestore<DynamicTable>(docSnap));
    onUpdate(tables);
  }, (error) => {
    console.error("Error listening to dynamic tables collection:", error);
    onError(error);
  });

  return unsubscribe;
};


export const addDynamicTable = async (table: Omit<DynamicTable, 'id' | 'createdAt' | 'updatedAt'>): Promise<DynamicTable> => {
  try {
    console.log("[addDynamicTable] Attempting to add table:", JSON.stringify(table));
    const dataToSave = {
      ...table,
      isArchived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, COLLECTIONS.DYNAMIC_TABLES), toFirestore(dataToSave));
    console.log("[addDynamicTable] Document added with ID:", docRef.id);
    const newDocSnap = await getDoc(docRef);
    if (!newDocSnap.exists()) {
      console.error("[addDynamicTable] Failed to retrieve document after creation. ID:", docRef.id);
      throw new Error("Failed to create dynamic table document after saving.");
    }
    const result = fromFirestore<DynamicTable>(newDocSnap);
    console.log("[addDynamicTable] Successfully created and retrieved table:", JSON.stringify(result));
    return result;
  } catch (error) {
    console.error("[addDynamicTable] Error during table creation:", error);
    throw error; // Re-throw to be caught by UI
  }
};

export const updateDynamicTable = async (id: string, data: Partial<Omit<DynamicTable, 'id' | 'createdAt' | 'isArchived'>>): Promise<DynamicTable> => {
  try {
    console.log(`[updateDynamicTable] Attempting to update table ID ${id} with data:`, JSON.stringify(data));
    const docRef = doc(db, COLLECTIONS.DYNAMIC_TABLES, id);
    await updateDoc(docRef, toFirestore({
        ...data,
        updatedAt: serverTimestamp()
      }));
    console.log(`[updateDynamicTable] Document ID ${id} updated.`);
    const updatedDocSnap = await getDoc(docRef);
    if (!updatedDocSnap.exists()) {
      console.error(`[updateDynamicTable] Failed to retrieve document after update. ID: ${id}`);
      throw new Error("Dynamic table not found after update");
    }
    const result = fromFirestore<DynamicTable>(updatedDocSnap);
    console.log(`[updateDynamicTable] Successfully updated and retrieved table:`, JSON.stringify(result));
    return result;
  } catch (error) {
    console.error(`[updateDynamicTable] Error during table update for ID ${id}:`, error);
    throw error; // Re-throw
  }
};

export const archiveDynamicTable = async (tableId: string, archive: boolean): Promise<DynamicTable> => {
  // Archiving/unarchiving a table definition only affects the definition itself,
  // not its entries or their files.
  const docRef = doc(db, COLLECTIONS.DYNAMIC_TABLES, tableId);
  await updateDoc(docRef, {
    isArchived: archive,
    updatedAt: serverTimestamp(),
  });
  const updatedDocSnap = await getDoc(docRef);
  if (!updatedDocSnap.exists()) throw new Error("Dynamic table definition not found after archive/unarchive");
  return fromFirestore<DynamicTable>(updatedDocSnap);
};


export const getDynamicTableById = async (id: string): Promise<DynamicTable | undefined> => {
  const docRef = doc(db, COLLECTIONS.DYNAMIC_TABLES, id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? fromFirestore<DynamicTable>(docSnap) : undefined;
};


// --- DynamicTableEntry Functions ---
export const getDynamicTableEntries = async (tableId: string): Promise<DynamicTableRowData[]> => {
  const entriesCollectionRef = collection(db, COLLECTIONS.DYNAMIC_TABLES, tableId, 'entries');
  const q = query(entriesCollectionRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return [];
  }
  return snapshot.docs.map(docSnap => fromFirestore<DynamicTableRowData>(docSnap));
};

async function processFileUploads(
  data: Record<string, any>,
  fields: DynamicField[],
  pathPrefixParts: string[] 
): Promise<Record<string, any>> {
  const processedData = { ...data };
  const loggableData = Object.keys(data).reduce((acc, key) => {
    acc[key] = data[key] instanceof File ? `File: ${data[key].name} (size: ${data[key].size})` : data[key];
    return acc;
  }, {} as Record<string, any>);
  console.log('[processFileUploads] Starting. Initial data snapshot:', JSON.stringify(loggableData).substring(0,1000));

  for (const field of fields) {
    if (field.type === DynamicFieldType.DOCUMENT_UPLOAD) {
      const fileOrPath = processedData[field.name];
      console.log(`[processFileUploads] Field: ${field.name}, Value:`, fileOrPath instanceof File ? `File: ${fileOrPath.name}` : fileOrPath);
      if (fileOrPath instanceof File) {
        const filePath = [...pathPrefixParts, field.name, fileOrPath.name].join('/');
        console.log(`[processFileUploads] Uploading ${fileOrPath.name} to ${filePath}`);
        try {
          processedData[field.name] = await uploadFileToStorage(fileOrPath, filePath); // Returns storage path
          console.log(`[processFileUploads] Uploaded ${fileOrPath.name}, stored storage path: ${processedData[field.name]}`);
        } catch (uploadError) {
          console.error(`[processFileUploads] Error uploading file ${fileOrPath.name} for field ${field.name}:`, uploadError);
          throw uploadError;
        }
      }
    }
  }
  console.log('[processFileUploads] Finished. Processed data snapshot:', JSON.stringify(processedData).substring(0,1000));
  return processedData;
}


export const addDynamicTableEntry = async (tableId: string, data: Record<string, any>): Promise<DynamicTableRowData> => {
  const loggableInitialData = Object.keys(data).reduce((acc, key) => {
    acc[key] = data[key] instanceof File ? `File: ${data[key].name} (size: ${data[key].size})` : data[key];
    return acc;
  }, {} as Record<string, any>);
  console.log('[addDynamicTableEntry] Starting. tableId:', tableId, 'Initial data snapshot:', JSON.stringify(loggableInitialData).substring(0,1000));
  try {
    const tableDef = await getDynamicTableById(tableId);
    if (!tableDef) {
      console.error('[addDynamicTableEntry] Table definition not found for id:', tableId);
      throw new Error(`Table definition for ${tableId} not found.`);
    }
    const allFieldsSnap = await getDocs(query(collection(db, COLLECTIONS.DYNAMIC_FIELDS)));
    const allFields = allFieldsSnap.docs.map(df => fromFirestore<DynamicField>(df));
    const tableFields = allFields.filter(f => tableDef.fieldIds.includes(f.id));
    console.log('[addDynamicTableEntry] Table fields resolved:', tableFields.map(f=>f.name));

    const newEntryRef = doc(collection(db, COLLECTIONS.DYNAMIC_TABLES, tableId, 'entries'));
    console.log('[addDynamicTableEntry] Generated new entry ID:', newEntryRef.id);

    const finalProcessedData = await processFileUploads(data, tableFields, ['dynamicTableEntries', tableId, newEntryRef.id]);
    console.log('[addDynamicTableEntry] Data after processing uploads:', JSON.stringify(finalProcessedData).substring(0,500));

    await setDoc(newEntryRef, toFirestore({
      data: finalProcessedData,
      isArchived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    console.log('[addDynamicTableEntry] Document set in Firestore.');

    const newDocSnap = await getDoc(newEntryRef);
    if (!newDocSnap.exists()) {
      console.error('[addDynamicTableEntry] New document does not exist after setDoc.');
      throw new Error("Failed to create dynamic table entry after saving.");
    }
    const result = fromFirestore<DynamicTableRowData>(newDocSnap);
    console.log('[addDynamicTableEntry] Successfully created entry:', result.id);
    return result;
  } catch (error) {
    console.error('[addDynamicTableEntry] Error in addDynamicTableEntry:', error);
    if (error instanceof Error) {
        throw error;
    }
    throw new Error('An unknown error occurred in addDynamicTableEntry.');
  }
};


export const updateDynamicTableEntry = async (
  tableId: string,
  entryId: string,
  newData: Record<string, any>,
  currentData: Record<string, any> // Represents current data values, including storage paths for files
): Promise<DynamicTableRowData> => {
  const tableDef = await getDynamicTableById(tableId);
  if (!tableDef) throw new Error(`Table definition for ${tableId} not found.`);

  const allFieldsSnap = await getDocs(query(collection(db, COLLECTIONS.DYNAMIC_FIELDS)));
  const allFields = allFieldsSnap.docs.map(df => fromFirestore<DynamicField>(df));
  const tableFields = allFields.filter(f => tableDef.fieldIds.includes(f.id));

  const processedDataForUpdate = { ...newData }; // Start with new data

  for (const field of tableFields) {
    if (field.type === DynamicFieldType.DOCUMENT_UPLOAD) {
      const newFileOrPath = newData[field.name]; // This could be a File object (new upload) or a string (existing path) or null (delete)
      const oldStoragePath = currentData[field.name]; // This is the existing storage path string, if any

      if (newFileOrPath instanceof File) {
        // New file is being uploaded
        if (typeof oldStoragePath === 'string' && oldStoragePath) {
          await deleteFileFromStorage(oldStoragePath); // Delete old file if it exists
        }
        const filePath = ['dynamicTableEntries', tableId, entryId, field.name, newFileOrPath.name].join('/');
        processedDataForUpdate[field.name] = await uploadFileToStorage(newFileOrPath, filePath); // Store new path
      } else if (newFileOrPath === null || newFileOrPath === undefined || newFileOrPath === '') {
        // File is explicitly being removed or cleared
        if (typeof oldStoragePath === 'string' && oldStoragePath) {
          await deleteFileFromStorage(oldStoragePath);
        }
        processedDataForUpdate[field.name] = null; // Set to null in Firestore
      } else if (typeof newFileOrPath === 'string') {
        // Path is provided, means no change or it's an existing path (already handled by spread)
         processedDataForUpdate[field.name] = newFileOrPath;
      } else {
        // No new file, no explicit removal, keep existing path if any
        processedDataForUpdate[field.name] = oldStoragePath || null;
      }
    }
  }

  const entryDocRef = doc(db, COLLECTIONS.DYNAMIC_TABLES, tableId, 'entries', entryId);
  await updateDoc(entryDocRef, toFirestore({
    data: processedDataForUpdate,
    updatedAt: serverTimestamp(),
  }));
  const updatedDocSnap = await getDoc(entryDocRef);
  if (!updatedDocSnap.exists()) throw new Error("Dynamic table entry not found after update");
  return fromFirestore<DynamicTableRowData>(updatedDocSnap);
};

export const archiveDynamicTableEntry = async (tableId: string, entryId: string, archive: boolean): Promise<DynamicTableRowData> => {
  // Archiving/unarchiving an entry does NOT delete associated files.
  const entryDocRef = doc(db, COLLECTIONS.DYNAMIC_TABLES, tableId, 'entries', entryId);
  await updateDoc(entryDocRef, {
    isArchived: archive,
    updatedAt: serverTimestamp(),
  });
  const updatedDocSnap = await getDoc(entryDocRef);
  if (!updatedDocSnap.exists()) throw new Error("Dynamic table entry not found after archive/unarchive");
  return fromFirestore<DynamicTableRowData>(updatedDocSnap);
};


// --- TaskTemplate Functions ---
export const getTaskTemplates = async (): Promise<TaskTemplate[]> => {
  const q = query(collection(db, COLLECTIONS.TASK_TEMPLATES), orderBy("name", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => fromFirestore<TaskTemplate>(docSnap));
};

export const addTaskTemplate = async (template: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>): Promise<TaskTemplate> => {
  const docRef = await addDoc(collection(db, COLLECTIONS.TASK_TEMPLATES), toFirestore({
    ...template,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  const newDocSnap = await getDoc(docRef);
  if (!newDocSnap.exists()) throw new Error("Failed to create task template.");
  return fromFirestore<TaskTemplate>(newDocSnap);
};

export const updateTaskTemplate = async (id: string, data: Partial<Omit<TaskTemplate, 'id' | 'createdAt' | 'isArchived'>>): Promise<TaskTemplate> => {
  const docRef = doc(db, COLLECTIONS.TASK_TEMPLATES, id);
  await updateDoc(docRef, toFirestore({
    ...data,
    updatedAt: serverTimestamp(),
  }));
  const updatedDocSnap = await getDoc(docRef);
  if (!updatedDocSnap.exists()) throw new Error("Task template not found after update");
  return fromFirestore<TaskTemplate>(updatedDocSnap);
};

export const archiveTaskTemplate = async (id: string, archive: boolean): Promise<TaskTemplate> => {
  const docRef = doc(db, COLLECTIONS.TASK_TEMPLATES, id);
  await updateDoc(docRef, {
    isArchived: archive,
    updatedAt: serverTimestamp(),
  });
  const updatedDocSnap = await getDoc(docRef);
  if (!updatedDocSnap.exists()) throw new Error("Task template not found after archive/unarchive");
  return fromFirestore<TaskTemplate>(updatedDocSnap);
};

export const getTaskTemplateById = async (id: string): Promise<TaskTemplate | undefined> => {
  const docRef = doc(db, COLLECTIONS.TASK_TEMPLATES, id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? fromFirestore<TaskTemplate>(docSnap) : undefined;
};

// --- WorkflowTemplate Functions ---
export const getWorkflowTemplates = async (): Promise<WorkflowTemplate[]> => {
  const q = query(collection(db, COLLECTIONS.WORKFLOW_TEMPLATES), orderBy("name", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => fromFirestore<WorkflowTemplate>(docSnap));
};

export const addWorkflowTemplate = async (template: Omit<WorkflowTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>): Promise<WorkflowTemplate> => {
  const docRef = await addDoc(collection(db, COLLECTIONS.WORKFLOW_TEMPLATES), toFirestore({
    ...template,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  const newDocSnap = await getDoc(docRef);
  if (!newDocSnap.exists()) throw new Error("Failed to create workflow template.");
  return fromFirestore<WorkflowTemplate>(newDocSnap);
};

export const updateWorkflowTemplate = async (id: string, data: Partial<Omit<WorkflowTemplate, 'id' | 'createdAt' | 'isArchived'>>): Promise<WorkflowTemplate> => {
  const docRef = doc(db, COLLECTIONS.WORKFLOW_TEMPLATES, id);
  await updateDoc(docRef, toFirestore({
    ...data,
    updatedAt: serverTimestamp(),
  }));
  const updatedDocSnap = await getDoc(docRef);
  if (!updatedDocSnap.exists()) throw new Error("Workflow template not found after update");
  return fromFirestore<WorkflowTemplate>(updatedDocSnap);
};

export const archiveWorkflowTemplate = async (id: string, archive: boolean): Promise<WorkflowTemplate> => {
  const docRef = doc(db, COLLECTIONS.WORKFLOW_TEMPLATES, id);
  await updateDoc(docRef, {
    isArchived: archive,
    updatedAt: serverTimestamp(),
  });
  const updatedDocSnap = await getDoc(docRef);
  if (!updatedDocSnap.exists()) throw new Error("Workflow template not found after archive/unarchive");
  return fromFirestore<WorkflowTemplate>(updatedDocSnap);
};


export const getWorkflowTemplateById = async (id: string): Promise<WorkflowTemplate | undefined> => {
  const docRef = doc(db, COLLECTIONS.WORKFLOW_TEMPLATES, id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? fromFirestore<WorkflowTemplate>(docSnap) : undefined;
};

// --- WorkflowInstance Functions ---
interface AddWorkflowInstancePayload {
  workflowTemplateId: string;
  name: string;
  associatedData?: Record<string, string>;
  taskAssignments: Record<string, string>;
  startedByUserId?: string;
}

export const addWorkflowInstance = async (instanceData: AddWorkflowInstancePayload): Promise<WorkflowInstance> => {
  const { workflowTemplateId, name, associatedData, taskAssignments, startedByUserId } = instanceData;

  const batch = writeBatch(db);
  const newInstanceRef = doc(collection(db, COLLECTIONS.WORKFLOW_INSTANCES));

  batch.set(newInstanceRef, toFirestore({
    workflowTemplateId,
    name,
    status: WorkflowInstanceStatus.ACTIVE,
    startedByUserId: startedByUserId || firebaseAuthInstance.currentUser?.uid || null,
    startDatetime: serverTimestamp(),
    associatedData: associatedData || {},
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));

  const template = await getWorkflowTemplateById(workflowTemplateId);
  if (template) {
    const allTaskTemplates = await getTaskTemplates(); // Fetches non-archived by default, adjust if needed for template creation
    for (const taskTemplateId of template.taskTemplateIds) {
      const taskTemplate = allTaskTemplates.find(tt => tt.id === taskTemplateId && !tt.isArchived); // Ensure task template isn't archived
      if (taskTemplate) {
        let initialTaskData = {};
        if (associatedData && taskTemplate.dynamicTableId && associatedData[taskTemplate.dynamicTableId]) {
          const rowId = associatedData[taskTemplate.dynamicTableId];
          // Ensure the linked table entry isn't archived
          const tableEntryDocRef = doc(db, COLLECTIONS.DYNAMIC_TABLES, taskTemplate.dynamicTableId, 'entries', rowId);
          const tableEntrySnap = await getDoc(tableEntryDocRef);
          if (tableEntrySnap.exists() && !tableEntrySnap.data()?.isArchived) {
            initialTaskData = tableEntrySnap.data()?.data || {};
          }
        }

        const newTaskRef = doc(collection(db, COLLECTIONS.TASKS));
        batch.set(newTaskRef, toFirestore({
          taskTemplateId: taskTemplate.id,
          workflowInstanceId: newInstanceRef.id,
          assignedToUserId: taskAssignments[taskTemplate.id] || null,
          status: TaskStatus.PENDING,
          dueDate: taskTemplate.dueDateOffsetDays ? Timestamp.fromDate(new Date(Date.now() + taskTemplate.dueDateOffsetDays * 24 * 60 * 60 * 1000)) : null,
          dynamicTableId: taskTemplate.dynamicTableId || null,
          dynamicTableData: initialTaskData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }));
      }
    }
  }
  await batch.commit();
  const newInstanceSnap = await getDoc(newInstanceRef);
  if (!newInstanceSnap.exists()) throw new Error("Workflow instance not found after creation");
  return fromFirestore<WorkflowInstance>(newInstanceSnap);
};

export const getWorkflowInstances = async (): Promise<WorkflowInstance[]> => {
  const q = query(collection(db, COLLECTIONS.WORKFLOW_INSTANCES), orderBy("startDatetime", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => fromFirestore<WorkflowInstance>(docSnap));
};

export const updateWorkflowInstanceStatus = async (instanceId: string, status: WorkflowInstanceStatus, finishDatetime?: string): Promise<WorkflowInstance | undefined> => {
  const docRef = doc(db, COLLECTIONS.WORKFLOW_INSTANCES, instanceId);
  const updateData: any = { status, updatedAt: serverTimestamp() };
  if (finishDatetime && status === WorkflowInstanceStatus.COMPLETED) {
    updateData.finishDatetime = Timestamp.fromDate(new Date(finishDatetime));
  }
  await updateDoc(docRef, toFirestore(updateData));
  const updatedSnap = await getDoc(docRef);
  return updatedSnap.exists() ? fromFirestore<WorkflowInstance>(updatedSnap) : undefined;
};

export const archiveWorkflowInstance = async (instanceId: string): Promise<WorkflowInstance | undefined> => {
  const docRef = doc(db, COLLECTIONS.WORKFLOW_INSTANCES, instanceId);
  await updateDoc(docRef, { isArchived: true, updatedAt: serverTimestamp() });
  const updatedSnap = await getDoc(docRef);
  return updatedSnap.exists() ? fromFirestore<WorkflowInstance>(updatedSnap) : undefined;
};

export const unarchiveWorkflowInstance = async (instanceId: string): Promise<WorkflowInstance | undefined> => {
  const docRef = doc(db, COLLECTIONS.WORKFLOW_INSTANCES, instanceId);
  await updateDoc(docRef, { isArchived: false, updatedAt: serverTimestamp() });
  const updatedSnap = await getDoc(docRef);
  return updatedSnap.exists() ? fromFirestore<WorkflowInstance>(updatedSnap) : undefined;
};

// --- Task Functions ---
export const getTasks = async (): Promise<Task[]> => {
  const q = query(collection(db, COLLECTIONS.TASKS), orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => fromFirestore<Task>(docSnap));
};

export const updateTaskDynamicData = async (
  taskId: string,
  newData: Record<string, any>, // Can contain File objects for new uploads, or storage paths for existing
  currentTaskData: Record<string, any> // Contains existing storage paths
): Promise<Task> => {
  const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
  const taskSnap = await getDoc(taskRef);
  if (!taskSnap.exists()) throw new Error("Task not found");
  const taskDefinition = taskSnap.data() as Omit<Task, 'id'>;

  let fieldsForTable: DynamicField[] = [];
  if (taskDefinition.dynamicTableId) {
    const tableDef = await getDynamicTableById(taskDefinition.dynamicTableId);
    // Ensure table definition is not archived
    if (tableDef && !tableDef.isArchived) {
        const allFieldsSnap = await getDocs(query(collection(db, COLLECTIONS.DYNAMIC_FIELDS)));
        const allFields = allFieldsSnap.docs.map(df => fromFirestore<DynamicField>(df));
        fieldsForTable = allFields.filter(f => tableDef.fieldIds.includes(f.id) && !f.isArchived); // Ensure fields are not archived
    }
  }

  const processedDataForUpdate = { ...newData };
  if (fieldsForTable.length > 0) {
      for (const field of fieldsForTable) {
        if (field.type === DynamicFieldType.DOCUMENT_UPLOAD) {
          const newFileOrPath = newData[field.name];
          const oldStoragePath = currentTaskData[field.name]; 

          if (newFileOrPath instanceof File) {
            if (typeof oldStoragePath === 'string' && oldStoragePath) {
              await deleteFileFromStorage(oldStoragePath);
            }
            const filePath = ['taskAttachments', taskDefinition.workflowInstanceId, taskId, field.name, newFileOrPath.name].join('/');
            processedDataForUpdate[field.name] = await uploadFileToStorage(newFileOrPath, filePath);
          } else if ((newFileOrPath === null || newFileOrPath === undefined || newFileOrPath === '') && (typeof oldStoragePath === 'string' && oldStoragePath)) {
            await deleteFileFromStorage(oldStoragePath);
            processedDataForUpdate[field.name] = null;
          } else if (typeof newFileOrPath === 'string') {
             processedDataForUpdate[field.name] = newFileOrPath;
          } else {
             processedDataForUpdate[field.name] = oldStoragePath || null;
          }
        }
      }
  }

  const currentStatus = taskDefinition.status;
  const updatePayload: Record<string, any> = {
    dynamicTableData: processedDataForUpdate,
    updatedAt: serverTimestamp()
  };
  if (currentStatus === TaskStatus.PENDING) {
    updatePayload.status = TaskStatus.IN_PROGRESS;
    if (!taskDefinition.startDatetime) {
        updatePayload.startDatetime = serverTimestamp();
    }
  }

  await updateDoc(taskRef, toFirestore(updatePayload));
  const updatedSnap = await getDoc(taskRef);
  if (!updatedSnap.exists()) throw new Error("Task not found after update");
  return fromFirestore<Task>(updatedSnap);
};

export const completeTask = async (taskId: string, notes?: string): Promise<Task> => {
  const docRef = doc(db, COLLECTIONS.TASKS, taskId);
  const taskSnap = await getDoc(docRef);
  if (!taskSnap.exists()) throw new Error("Task not found");
  const taskData = taskSnap.data();

  const updatePayload: Record<string, any> = {
    status: TaskStatus.COMPLETED,
    finishDatetime: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (notes) {
    updatePayload.notes = notes;
  }
  if (!taskData?.startDatetime && taskData?.status === TaskStatus.PENDING) {
    updatePayload.startDatetime = serverTimestamp();
  }

  await updateDoc(docRef, toFirestore(updatePayload));
  const updatedSnap = await getDoc(docRef);
  if (!updatedSnap.exists()) throw new Error("Task not found after completion update");
  return fromFirestore<Task>(updatedSnap);
};


// --- Summary Functions ---
export const getWorkflowSummary = async (): Promise<WorkflowSummary> => {
  const instances = await getWorkflowInstances();
  const nonArchived = instances.filter(wf => !wf.isArchived);
  const templates = await getWorkflowTemplates(); // Fetches non-archived by default

  return {
    totalActive: nonArchived.filter(wf => wf.status === WorkflowInstanceStatus.ACTIVE).length,
    totalCompleted: nonArchived.filter(wf => wf.status === WorkflowInstanceStatus.COMPLETED).length,
    byTemplate: templates.filter(t => !t.isArchived).map(wt => ({ // Filter out archived templates
      templateName: wt.name,
      count: nonArchived.filter(wf => wf.workflowTemplateId === wt.id).length,
    })),
  };
};

export const getTaskSummary = async (): Promise<TaskSummary> => {
  const allTasks = await getTasks();
  const allInstances = await getWorkflowInstances();
  const nonArchivedInstanceIds = allInstances.filter(inst => !inst.isArchived).map(inst => inst.id);
  const relevantTasks = allTasks.filter(task => nonArchivedInstanceIds.includes(task.workflowInstanceId));

  return {
    totalTasks: relevantTasks.length,
    pending: relevantTasks.filter(t => t.status === TaskStatus.PENDING).length,
    inProgress: relevantTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
    completed: relevantTasks.filter(t => t.status === TaskStatus.COMPLETED).length,
    overdue: relevantTasks.filter(t => t.status === TaskStatus.OVERDUE).length,
  };
};

export const getDisplayValueForRow = (rowData: Record<string, any>, fields: DynamicField[], rowId?: string): string => {
  if (!rowData || !fields || fields.length === 0) return rowId ? `Entry ID: ...${rowId.slice(-4)}` : 'N/A';
  // Consider only non-archived fields for display value
  const activeFields = fields.filter(f => !f.isArchived);
  if (activeFields.length === 0) return rowId ? `Entry ID: ...${rowId.slice(-4)}` : 'N/A (No active fields)';


  const firstOrderedField = activeFields[0];
  if (firstOrderedField && rowData[firstOrderedField.name] !== undefined && rowData[firstOrderedField.name] !== null && String(rowData[firstOrderedField.name]).trim() !== '') {
    let value = String(rowData[firstOrderedField.name]);
    if (typeof rowData[firstOrderedField.name] === 'object' && !Array.isArray(rowData[firstOrderedField.name])) return `${firstOrderedField.label}: [Object]`;
    if (Array.isArray(rowData[firstOrderedField.name])) return `${firstOrderedField.label}: [Array]`;
    if (value.length > 30) value = value.substring(0,27) + '...';
    return value;
  }

  const priorityFieldNames = ['name', 'label', 'title', 'customername', 'productname', 'aircraftmodel', 'registrationnumber'];
  for (const name of priorityFieldNames) {
    const field = activeFields.find(f => f.name.toLowerCase() === name.toLowerCase());
    if (field && rowData[field.name] !== undefined && rowData[field.name] !== null && String(rowData[field.name]).trim() !== '') {
      let value = String(rowData[field.name]);
      if (typeof rowData[field.name] === 'object' && !Array.isArray(rowData[field.name])) return `${field.label}: [Object]`;
      if (Array.isArray(rowData[field.name])) return `${field.label}: [Array]`;
      if (value.length > 30) value = value.substring(0,27) + '...';
      return value;
    }
  }

  const firstFieldWithValue = activeFields.find(f => rowData[f.name] !== undefined && rowData[f.name] !== null && String(rowData[f.name]).trim() !== '');
  if (firstFieldWithValue && rowData[firstFieldWithValue.name]) {
     let value = String(rowData[firstFieldWithValue.name]);
     if (typeof rowData[firstFieldWithValue.name] === 'object' && !Array.isArray(rowData[firstFieldWithValue.name])) return `${firstFieldWithValue.label}: [Object]`;
     if (Array.isArray(rowData[firstFieldWithValue.name])) return `${firstFieldWithValue.label}: [Array]`;
     if (value.length > 30) value = value.substring(0,27) + '...';
     return value;
  }

  return `Entry (ID: ...${(rowId || 'Unknown').slice(-4)})`;
};

const auth = firebaseAuthInstance;

// Delete functions are replaced by archive functions.
// If permanent deletion is needed later, new specific functions should be created.
// For example, deleteDynamicTable, deleteUser, etc. are removed.
// The old deleteTaskTemplate is now handled by archiveTaskTemplate.
// The old deleteWorkflowTemplate is now handled by archiveWorkflowTemplate.

// For deleteDynamicTable, its complex logic of deleting sub-collections and files is removed.
// Archiving a table definition will just mark it as archived.
// Individual entries must be archived/deleted separately if desired.
// Old deleteDynamicTableEntry which also deleted files from storage is replaced by archiveDynamicTableEntry which does not delete files.
    

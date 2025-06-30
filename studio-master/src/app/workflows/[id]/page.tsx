
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowLeft, CheckCircle, Edit3, FileText, Loader2, Users, Workflow as WorkflowIcon, Archive, ArchiveRestore, Download } from 'lucide-react';
import type { WorkflowInstance, Task, WorkflowTemplate, DynamicTable, DynamicField, User } from '@/lib/types';
import { TaskStatus, DynamicFieldType, WorkflowInstanceStatus } from '@/lib/types';
import { 
  getWorkflowInstances, 
  getTasks, 
  getUsers,
  getWorkflowTemplates,
  getTaskTemplates,
  getDynamicTables,
  getDynamicFields,
  updateTaskDynamicData,
  completeTask,
  updateWorkflowInstanceStatus,
  archiveWorkflowInstance,
  unarchiveWorkflowInstance,
  getFileDownloadURL // Added
} from '@/lib/data';
import { format, parseISO } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm, Controller, FormProvider, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Define a generic schema for dynamic data - actual validation should be more dynamic
const dynamicDataSchema = z.record(z.any()); // Will be made more specific in TaskForm
type DynamicDataFormData = z.infer<typeof dynamicDataSchema>;

interface TaskFormProps {
  task: Task;
  taskTemplateName: string;
  dynamicTable: DynamicTable | null;
  tableFields: DynamicField[];
  isCompleted: boolean;
  isWorkflowArchived?: boolean;
  onDataSaved: (updatedTask: Task) => void;
  onTaskCompleted: (completedTask: Task) => void;
}

function TaskForm({ task, taskTemplateName, dynamicTable, tableFields, isCompleted, isWorkflowArchived, onDataSaved, onTaskCompleted }: TaskFormProps) {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});

  const createDynamicTaskDataSchema = (fields: DynamicField[]) => {
    const schemaShape: Record<string, z.ZodTypeAny> = {};
    fields.forEach(field => {
      let fieldSchema: z.ZodTypeAny;
      switch (field.type) {
        case DynamicFieldType.TEXT_INPUT:
        case DynamicFieldType.TEXT_AREA:
        case DynamicFieldType.DROPDOWN_LIST: 
        case DynamicFieldType.RADIO_BUTTON_GROUP: 
          fieldSchema = z.string();
          if (field.validationRules?.email) fieldSchema = fieldSchema.email("Invalid email address");
          break;
        case DynamicFieldType.DOCUMENT_UPLOAD: 
          fieldSchema = z.any().nullable();
          break;
        case DynamicFieldType.NUMBER:
          fieldSchema = z.coerce.number().nullable();
          if (field.validationRules?.min !== undefined) fieldSchema = fieldSchema.min(field.validationRules.min);
          if (field.validationRules?.max !== undefined) fieldSchema = fieldSchema.max(field.validationRules.max);
          break;
        case DynamicFieldType.DATE:
        case DynamicFieldType.TIME:
        case DynamicFieldType.DATETIME:
          fieldSchema = z.string(); 
          break;
        case DynamicFieldType.CHECKBOX_GROUP:
          fieldSchema = z.array(z.string());
          break;
        case DynamicFieldType.BOOLEAN_TOGGLE:
          fieldSchema = z.boolean();
          break;
        default:
          fieldSchema = z.any();
      }
      if (field.isRequired) {
        if ([DynamicFieldType.TEXT_INPUT, DynamicFieldType.TEXT_AREA, DynamicFieldType.DROPDOWN_LIST, DynamicFieldType.RADIO_BUTTON_GROUP, DynamicFieldType.DATE, DynamicFieldType.TIME, DynamicFieldType.DATETIME].includes(field.type)) {
           fieldSchema = (fieldSchema as z.ZodString).min(1, `${field.label} is required`);
        } else if (field.type === DynamicFieldType.CHECKBOX_GROUP) {
           fieldSchema = (fieldSchema as z.ZodArray<z.ZodString>).nonempty(`${field.label} requires at least one selection`);
        } else if (field.type === DynamicFieldType.DOCUMENT_UPLOAD) {
          fieldSchema = fieldSchema.refine(value => value !== null && value !== undefined && value !== '', {
              message: `${field.label} is required.`,
          });
        } else if (field.type === DynamicFieldType.NUMBER) {
          fieldSchema = fieldSchema.refine(val => val !== null && val !== undefined, `${field.label} is required.`);
        }
      } else {
        fieldSchema = fieldSchema.optional().nullable();
      }
      schemaShape[field.name] = fieldSchema;
    });
    return z.object(schemaShape);
  };

  const taskSpecificSchema = useMemo(() => createDynamicTaskDataSchema(tableFields), [tableFields]);

  const methods = useForm<DynamicDataFormData>({
    resolver: zodResolver(taskSpecificSchema), 
    defaultValues: useMemo(() => {
      const defaults: Record<string, any> = { ...task.dynamicTableData };
      tableFields.forEach(field => {
        if (defaults[field.name] === undefined && field.defaultValue !== undefined) {
          if (field.type === DynamicFieldType.BOOLEAN_TOGGLE) {
             defaults[field.name] = field.defaultValue ?? false;
          } else if (field.type === DynamicFieldType.CHECKBOX_GROUP) {
             defaults[field.name] = (field.defaultValue as string[]) ?? [];
          } else if (field.type === DynamicFieldType.DOCUMENT_UPLOAD) {
             defaults[field.name] = null;
          } else {
             defaults[field.name] = field.defaultValue ?? (field.type === DynamicFieldType.NUMBER ? null : '');
          }
        } else if (defaults[field.name] === undefined && field.type === DynamicFieldType.DOCUMENT_UPLOAD) {
            defaults[field.name] = null; // Ensure document uploads default to null if no initial data
        }
      });
      return defaults;
    }, [task.dynamicTableData, tableFields]),
  });

  useEffect(() => {
    const defaults: Record<string, any> = { ...task.dynamicTableData };
     tableFields.forEach(field => {
        if (defaults[field.name] === undefined && field.defaultValue !== undefined) {
            if (field.type === DynamicFieldType.BOOLEAN_TOGGLE) {
                defaults[field.name] = field.defaultValue ?? false;
            } else if (field.type === DynamicFieldType.CHECKBOX_GROUP) {
                defaults[field.name] = (field.defaultValue as string[]) ?? [];
            } else if (field.type === DynamicFieldType.DOCUMENT_UPLOAD) {
                defaults[field.name] = null;
            }
             else {
                defaults[field.name] = field.defaultValue ?? (field.type === DynamicFieldType.NUMBER ? null : '');
            }
        } else if (defaults[field.name] === undefined && field.type === DynamicFieldType.DOCUMENT_UPLOAD) {
            defaults[field.name] = null;
        }
    });
    methods.reset(defaults);
  }, [task.dynamicTableData, tableFields, methods, task.id]);


  const onSubmit = async (formData: DynamicDataFormData) => {
    if (isWorkflowArchived) {
      toast({ title: "Action Denied", description: "Cannot save data for an archived workflow.", variant: "destructive"});
      return;
    }
    try {
      // Pass original task.dynamicTableData for comparison in updateTaskDynamicData
      const updatedTask = await updateTaskDynamicData(task.id, formData, task.dynamicTableData || {});
      onDataSaved(updatedTask);
      toast({ title: "Data Saved", description: `Data for task "${taskTemplateName}" updated.` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not save task data.", variant: "destructive" });
    }
  };

  const handleMarkComplete = async () => {
     if (isWorkflowArchived) {
      toast({ title: "Action Denied", description: "Cannot complete tasks for an archived workflow.", variant: "destructive"});
      return;
    }
    try {
      const completedTask = await completeTask(task.id);
      onTaskCompleted(completedTask);
      toast({ title: "Task Completed", description: `Task "${taskTemplateName}" marked as complete.` });
    } catch (error: any) {
       toast({ title: "Error", description: error.message || "Could not mark task as complete.", variant: "destructive" });
    }
  };

  const handleTaskDownload = async (storagePath: string, fieldName: string) => {
    if (!storagePath) {
      toast({ title: "Download Error", description: "No file path specified.", variant: "destructive" });
      return;
    }
    setIsDownloading(prev => ({ ...prev, [fieldName]: true }));
    try {
      const downloadURL = await getFileDownloadURL(storagePath);
      const link = document.createElement('a');
      link.href = downloadURL;
      const filename = storagePath.split('/').pop();
      if (filename) link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Download Started", description: `Downloading ${filename || 'file'}...` });
    } catch (error: any) {
      toast({ title: "Download Failed", description: error.message || "Could not get download URL.", variant: "destructive" });
    } finally {
      setIsDownloading(prev => ({ ...prev, [fieldName]: false }));
    }
  };

  const renderFormFieldController = (field: DynamicField) => {
    const fieldKey = `${task.id}-${field.id}`;
    const isDisabled = isCompleted || isWorkflowArchived;
    const currentFieldValueForDisplay = methods.watch(field.name as any);

    return (
      <Controller
        key={fieldKey}
        name={field.name}
        control={methods.control}
        render={({ field: controlledField, fieldState: { error } }) => {
          return (
            <div className="mb-4">
              <Label htmlFor={fieldKey} className="mb-1 block">{field.label}{field.isRequired && <span className="text-destructive ml-1">*</span>}</Label>
              {(() => {
                switch (field.type) {
                  case DynamicFieldType.TEXT_INPUT:
                    return <Input {...controlledField} id={fieldKey} type="text" placeholder={field.label} disabled={isDisabled} value={controlledField.value ?? ''} />;
                  case DynamicFieldType.TEXT_AREA:
                    return <Textarea {...controlledField} id={fieldKey} placeholder={field.label} disabled={isDisabled} value={controlledField.value ?? ''} />;
                  case DynamicFieldType.NUMBER:
                    return <Input {...controlledField} id={fieldKey} type="number" placeholder={field.label} disabled={isDisabled} value={controlledField.value ?? ''} onChange={e => controlledField.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} />;
                  case DynamicFieldType.DATE:
                    return <Input {...controlledField} id={fieldKey} type="date" disabled={isDisabled} value={controlledField.value ?? ''}/>;
                  case DynamicFieldType.TIME:
                    return <Input {...controlledField} id={fieldKey} type="time" disabled={isDisabled} value={controlledField.value ?? ''}/>;
                  case DynamicFieldType.DATETIME:
                    return <Input {...controlledField} id={fieldKey} type="datetime-local" disabled={isDisabled} value={controlledField.value ?? ''}/>;
                  case DynamicFieldType.DOCUMENT_UPLOAD: {
                    const { value: RHFValueDoNotUseForFile, ...rhfRest } = controlledField;
                    return (
                      <div className="space-y-2">
                        <Input
                          id={fieldKey}
                          type="file"
                          name={rhfRest.name}
                          onBlur={rhfRest.onBlur}
                          ref={rhfRest.ref}
                          onChange={e => {
                            const files = (e.target as HTMLInputElement).files;
                            controlledField.onChange(files && files.length > 0 ? files[0] : null);
                          }}
                          disabled={isDisabled}
                        />
                        {currentFieldValueForDisplay && (
                          <div className="flex items-center justify-between p-2 border rounded-md bg-muted/50 text-sm">
                             <p className="text-muted-foreground truncate">
                              {typeof currentFieldValueForDisplay === 'string'
                                ? `Current: ${currentFieldValueForDisplay.split(/[\\/]/).pop()}`
                                : currentFieldValueForDisplay instanceof File
                                  ? `Selected: ${currentFieldValueForDisplay.name}`
                                  : 'No file selected/uploaded.'}
                            </p>
                            {typeof currentFieldValueForDisplay === 'string' && currentFieldValueForDisplay && (
                               <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleTaskDownload(currentFieldValueForDisplay, field.name)}
                                disabled={isDownloading[field.name] || isDisabled}
                              >
                                {isDownloading[field.name] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                Download
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }
                  case DynamicFieldType.DROPDOWN_LIST:
                    return (
                      <Select onValueChange={controlledField.onChange} value={String(controlledField.value ?? '')} disabled={isDisabled}>
                        <SelectTrigger id={fieldKey}><SelectValue placeholder={`Select ${field.label}...`} /></SelectTrigger>
                        <SelectContent>
                          {field.options?.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    );
                  case DynamicFieldType.CHECKBOX_GROUP:
                    return (
                      <div className="space-y-2">
                        {field.options?.map(opt => (
                          <div key={opt.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${fieldKey}-${opt.value}`}
                              disabled={isDisabled}
                              checked={(controlledField.value as string[] || []).includes(opt.value)}
                              onCheckedChange={(checked) => {
                                const currentValues = (controlledField.value as string[] || []);
                                if (checked) {
                                  controlledField.onChange([...currentValues, opt.value]);
                                } else {
                                  controlledField.onChange(currentValues.filter(v => v !== opt.value));
                                }
                              }}
                            />
                            <Label htmlFor={`${fieldKey}-${opt.value}`} className="font-normal">{opt.label}</Label>
                          </div>
                        ))}
                      </div>
                    );
                  case DynamicFieldType.RADIO_BUTTON_GROUP:
                    return (
                      <RadioGroup onValueChange={controlledField.onChange} value={String(controlledField.value ?? '')} disabled={isDisabled}>
                        {field.options?.map(opt => (
                          <div key={opt.value} className="flex items-center space-x-2">
                            <RadioGroupItem value={opt.value} id={`${fieldKey}-${opt.value}`} />
                            <Label htmlFor={`${fieldKey}-${opt.value}`} className="font-normal">{opt.label}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    );
                  case DynamicFieldType.BOOLEAN_TOGGLE:
                    return (
                      <div className="flex items-center space-x-2 pt-2">
                        <Checkbox id={fieldKey} checked={Boolean(controlledField.value)} onCheckedChange={controlledField.onChange} disabled={isDisabled}/>
                      </div>
                    );
                  default:
                    return <Input placeholder={`Unsupported type: ${field.type}`} disabled />;
                }
              })()}
              {error && <p className="text-sm text-destructive mt-1">{error.message}</p>}
            </div>
          );
        }}
      />
    );
  };


  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        {task.notes && (
          <div className="mb-4 p-3 bg-muted/50 rounded-md">
            <p className="font-semibold text-sm mb-1">Notes:</p>
            <p className="text-sm whitespace-pre-wrap">{task.notes}</p>
          </div>
        )}
        {dynamicTable && tableFields.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <h4 className="font-semibold text-md mb-3 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-primary"/> 
              {dynamicTable.label} Data
            </h4>
            {tableFields.map(field => renderFormFieldController(field))}
            {!isCompleted && !isWorkflowArchived && (
              <Button type="submit" className="mt-2" disabled={methods.formState.isSubmitting}>
                {methods.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Data
              </Button>
            )}
             {(isCompleted || isWorkflowArchived) && <p className="text-sm text-green-600 mt-2">{isCompleted ? "Data submitted and task completed." : "Workflow is archived, data cannot be modified."}</p>}
          </div>
        )}
        {!isCompleted && !isWorkflowArchived && (
           <Button type="button" onClick={handleMarkComplete} variant="outline" className="mt-4 ml-2" disabled={methods.formState.isSubmitting}>
             Mark as Complete
           </Button>
        )}
      </form>
    </FormProvider>
  );
}


export default function WorkflowInstanceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const [instance, setInstance] = useState<WorkflowInstance | null | undefined>(undefined);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  const [allWorkflowTemplates, setAllWorkflowTemplates] = useState<WorkflowTemplate[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allTaskTemplates, setAllTaskTemplates] = useState<TaskTemplate[]>([]);
  const [allDynamicTables, setAllDynamicTables] = useState<DynamicTable[]>([]);
  const [allDynamicFields, setAllDynamicFields] = useState<DynamicField[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showUnarchiveConfirm, setShowUnarchiveConfirm] = useState(false);

  useEffect(() => {
    if (id) {
      setIsLoading(true);
      Promise.all([
        getWorkflowInstances(), 
        getTasks(),
        getWorkflowTemplates(),
        getUsers(),
        getTaskTemplates(),
        getDynamicTables(),
        getDynamicFields(),
      ]).then(([
          instancesData, 
          tasksData, 
          workflowTemplatesData,
          usersData,
          taskTemplatesData,
          dynamicTablesData,
          dynamicFieldsData,
        ]) => {
        setAllWorkflowTemplates(workflowTemplatesData);
        setAllUsers(usersData);
        setAllTaskTemplates(taskTemplatesData);
        setAllDynamicTables(dynamicTablesData);
        setAllDynamicFields(dynamicFieldsData);

        const foundInstance = instancesData.find(inst => inst.id === id);
        setInstance(foundInstance);

        if (foundInstance) {
          const instanceTasksRaw = tasksData
            .filter(task => task.workflowInstanceId === id)
            .map(task => { 
                const taskTpl = taskTemplatesData.find(tt => tt.id === task.taskTemplateId);
                return {
                    ...task,
                    dynamicTableId: task.dynamicTableId || taskTpl?.dynamicTableId
                };
            });
          
          const currentTemplate = workflowTemplatesData.find(t => t.id === foundInstance.workflowTemplateId);
          if (currentTemplate) {
            const sortedInstanceTasks = instanceTasksRaw.sort((a, b) => {
              const indexA = currentTemplate.taskTemplateIds.indexOf(a.taskTemplateId);
              const indexB = currentTemplate.taskTemplateIds.indexOf(b.taskTemplateId);
              // Handle cases where a taskTemplateId might not be in the template (should ideally not happen)
              if (indexA === -1) return 1; // Put items not found at the end
              if (indexB === -1) return -1;
              return indexA - indexB;
            });
            setTasks(sortedInstanceTasks);
          } else {
            // Fallback if template not found, sort by createdAt or another sensible default
            setTasks(instanceTasksRaw.sort((a,b) => parseISO(a.createdAt).getTime() - parseISO(b.createdAt).getTime()));
          }
        } else {
          setInstance(null); 
        }
      }).catch(err => {
        console.error("Error fetching workflow details:", err);
        toast({ title: "Error", description: "Could not load workflow details.", variant: "destructive" });
        setInstance(null); 
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, [id, toast]);

  const getTaskTemplateName = (templateId: string) => {
    return allTaskTemplates.find(t => t.id === templateId)?.name || 'Unknown Task';
  };

  const getAssignedUserName = (userId?: string) => {
    return userId ? allUsers.find(u => u.id === userId)?.username || 'Unassigned' : 'Unassigned';
  };
  
  const getDynamicTableForTask = (task: Task): DynamicTable | null => {
    let tableIdToFind = task.dynamicTableId;
    if (!tableIdToFind) { 
        const taskTemplate = allTaskTemplates.find(tt => tt.id === task.taskTemplateId);
        if (!taskTemplate || !taskTemplate.dynamicTableId) return null;
        tableIdToFind = taskTemplate.dynamicTableId;
    }
    return allDynamicTables.find(dt => dt.id === tableIdToFind) || null;
  };

  const getFieldsForTable = (table: DynamicTable | null): DynamicField[] => {
    if (!table) return [];
    return table.fieldIds
      .map(fieldId => allDynamicFields.find(df => df.id === fieldId))
      .filter(Boolean) as DynamicField[];
  };

  const handleTaskDataSaved = (updatedTask: Task) => {
    setTasks(currentTasks => currentTasks.map(t => t.id === updatedTask.id ? updatedTask : t));
  };
  
 const handleTaskCompleted = (completedTask: Task) => {
    let allTasksAreNowComplete = false;
    let updatedTasksState: Task[] = [];
    
    setTasks(currentTasks => {
      const newTasks = currentTasks.map(t => 
        t.id === completedTask.id ? { ...completedTask, status: TaskStatus.COMPLETED, finishDatetime: new Date().toISOString() } : t
      );
      updatedTasksState = newTasks; 
      allTasksAreNowComplete = newTasks.every(t => t.status === TaskStatus.COMPLETED);
      return newTasks; 
    });

    if (allTasksAreNowComplete && instance && instance.status !== WorkflowInstanceStatus.COMPLETED) {
        const finishTime = new Date().toISOString();
        const newInstanceStatus = WorkflowInstanceStatus.COMPLETED;
        
        const updatedInstanceData = { ...instance, status: newInstanceStatus, finishDatetime: finishTime };
        
        updateWorkflowInstanceStatus(instance.id, newInstanceStatus, finishTime)
          .then((savedInstance) => {
             if(savedInstance) {
                setInstance(savedInstance); // Update local state with data from DB (includes server timestamps)
                toast({ title: "Workflow Completed", description: `Workflow "${instance.name || 'Instance'}" is now complete.` });
             }
          })
          .catch(error => {
            console.error("Failed to update workflow instance status:", error);
            toast({ title: "Error", description: "Failed to update workflow status in the backend.", variant: "destructive"});
             // Potentially revert optimistic UI update for instance status if needed, though tasks state is already updated
          });
    }
  };

  const handleArchive = async () => {
    if (!instance) return;
    try {
      const updatedInstance = await archiveWorkflowInstance(instance.id);
      if (updatedInstance) {
        setInstance(updatedInstance);
        toast({ title: "Workflow Archived", description: `Workflow "${updatedInstance.name}" has been archived.` });
      }
      setShowArchiveConfirm(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not archive workflow.", variant: "destructive" });
    }
  };

  const handleUnarchive = async () => {
    if (!instance) return;
    try {
      const updatedInstance = await unarchiveWorkflowInstance(instance.id);
      if (updatedInstance) {
        setInstance(updatedInstance);
        toast({ title: "Workflow Restored", description: `Workflow "${updatedInstance.name}" has been unarchived.` });
      }
      setShowUnarchiveConfirm(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not unarchive workflow.", variant: "destructive" });
    }
  };


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading workflow details...</p>
      </div>
    );
  }

  if (instance === null || !instance) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Workflow Not Found</h2>
        <p className="text-muted-foreground mb-6">The workflow instance you are looking for does not exist or could not be loaded.</p>
        <Button onClick={() => router.push('/')} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }
  
  const currentWorkflowTemplate = allWorkflowTemplates.find(t => t.id === instance.workflowTemplateId) || null;
  const startedByUser = instance.startedByUserId ? allUsers.find(u => u.id === instance.startedByUserId) : null;
  const archiveButton = instance.isArchived ? (
    <Button variant="outline" onClick={() => setShowUnarchiveConfirm(true)}>
      <ArchiveRestore className="mr-2 h-4 w-4" /> Unarchive Workflow
    </Button>
  ) : (
    <Button variant="outline" onClick={() => setShowArchiveConfirm(true)} className="text-orange-600 border-orange-600 hover:bg-orange-500/10 hover:text-orange-700">
      <Archive className="mr-2 h-4 w-4" /> Archive Workflow
    </Button>
  );


  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        {archiveButton}
      </div>
      <PageHeader
        title={instance.name || `Workflow Instance ${instance.id.substring(0,6)}`}
        description={currentWorkflowTemplate?.name || 'Workflow Details'}
      />
      

      <Card className="mb-6 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Instance Overview</span>
            <div>
            {instance.isArchived && <Badge variant="outline" className="mr-2 border-orange-500 text-orange-600">Archived</Badge>}
            <Badge variant={instance.status === 'Active' ? 'default' : instance.status === 'Completed' ? 'outline' : 'destructive'}
                    className={instance.status === WorkflowInstanceStatus.ACTIVE ? 'bg-sky-500/20 text-sky-700 border-sky-500/30 dark:bg-sky-500/30 dark:text-sky-300 dark:border-sky-500/40' : 
                               instance.status === WorkflowInstanceStatus.COMPLETED ? 'bg-green-500/20 text-green-700 border-green-500/30 dark:bg-green-500/30 dark:text-green-300 dark:border-green-500/40' : 
                               'bg-red-500/20 text-red-700 border-red-500/30 dark:bg-red-500/30 dark:text-red-300 dark:border-red-500/40'}>
              {instance.status}
            </Badge>
            </div>
          </CardTitle>
          <CardDescription>
            {currentWorkflowTemplate?.description || 'General information about this workflow instance.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><strong>Template:</strong> {currentWorkflowTemplate?.name || 'N/A'}</div>
          <div><strong>Started:</strong> {format(parseISO(instance.startDatetime), "MMM d, yyyy HH:mm")}</div>
          {startedByUser && <div><strong>Started By:</strong> {startedByUser.username} ({startedByUser.email})</div>}
          {instance.finishDatetime && <div><strong>Finished:</strong> {format(parseISO(instance.finishDatetime), "MMM d, yyyy HH:mm")}</div>}
        </CardContent>
      </Card>

      <h2 className="text-2xl font-semibold mb-4 mt-8">Tasks</h2>
      {tasks.length > 0 ? (
        <Accordion type="single" collapsible className="w-full" defaultValue={`task-${tasks.find(t => t.status !== TaskStatus.COMPLETED)?.id || tasks[0]?.id}`}>
          {tasks.map((task) => {
            const taskDynamicTable = getDynamicTableForTask(task);
            const taskTableFields = getFieldsForTable(taskDynamicTable);
            const isCompleted = task.status === TaskStatus.COMPLETED;
            const IconComponent = isCompleted ? CheckCircle : (task.status === TaskStatus.OVERDUE ? AlertTriangle : Edit3);
            const currentTaskTemplateName = getTaskTemplateName(task.taskTemplateId);
            
            return (
              <AccordionItem value={`task-${task.id}`} key={task.id} className="mb-2 border bg-card rounded-lg shadow-sm group">
                <AccordionTrigger className="hover:no-underline px-4 py-3 text-base">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                       <IconComponent className={`h-5 w-5 ${isCompleted ? 'text-green-500' : task.status === TaskStatus.OVERDUE ? 'text-destructive' : 'text-primary'}`} />
                      <span className="font-medium">{currentTaskTemplateName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={
                        task.status === TaskStatus.COMPLETED ? 'outline' : 
                        task.status === TaskStatus.OVERDUE ? 'destructive' : 
                        task.status === TaskStatus.IN_PROGRESS ? 'default' :
                        'secondary'
                      }
                      className={
                        task.status === TaskStatus.COMPLETED ? 'bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-400 dark:border-green-500/50' :
                        task.status === TaskStatus.OVERDUE ? '' :
                        task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400 dark:border-blue-500/50' :
                        'bg-slate-500/15 text-slate-700 border-slate-500/30 dark:text-slate-400 dark:border-slate-500/50'
                      }
                      >
                        {task.status}
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 py-3 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mb-4 text-sm">
                    <div><Users className="inline h-4 w-4 mr-1 text-muted-foreground" /><strong>Assigned To:</strong> {getAssignedUserName(task.assignedToUserId)}</div>
                    {task.dueDate && <div><strong>Due Date:</strong> {format(parseISO(task.dueDate), "MMM d, yyyy")}</div>}
                    {task.startDatetime && <div><strong>Started:</strong> {format(parseISO(task.startDatetime), "MMM d, yyyy HH:mm")}</div>}
                    {task.finishDatetime && <div><strong>Finished:</strong> {format(parseISO(task.finishDatetime), "MMM d, yyyy HH:mm")}</div>}
                  </div>
                  <TaskForm 
                    task={task} 
                    taskTemplateName={currentTaskTemplateName}
                    dynamicTable={taskDynamicTable} 
                    tableFields={taskTableFields}
                    isCompleted={isCompleted}
                    isWorkflowArchived={instance?.isArchived}
                    onDataSaved={handleTaskDataSaved}
                    onTaskCompleted={handleTaskCompleted}
                  />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <WorkflowIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No tasks associated with this workflow instance.</p>
            <p className="text-xs text-muted-foreground mt-2">Tasks may be generated once the workflow starts or previous dependencies are met.</p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the workflow to the archive. You can unarchive it later.
              Tasks within an archived workflow cannot be modified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} className="bg-orange-600 hover:bg-orange-700 text-white">Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showUnarchiveConfirm} onOpenChange={setShowUnarchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unarchive Workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the workflow to your current workflows list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnarchive}>Unarchive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}


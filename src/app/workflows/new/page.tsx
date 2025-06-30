
"use client";

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { WorkflowTemplate, DynamicTable, DynamicField, DynamicTableRowData, TaskTemplate, User } from '@/lib/types';
import {
  getWorkflowTemplates,
  getDynamicTables,
  getDynamicFields,
  getDynamicTableEntries,
  addWorkflowInstance,
  getDisplayValueForRow,
  getTaskTemplates,
  getUsers,
} from '@/lib/data';
import { useForm, Controller, SubmitHandler, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Loader2, Workflow as WorkflowIcon, LinkIcon, Users, ClipboardList } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface TableWithDetails extends DynamicTable {
  fields: DynamicField[];
}

const workflowInstanceSchema = z.object({
  workflowTemplateId: z.string().min(1, "Please select a workflow template"),
  instanceName: z.string().min(1, "Instance name is required"),
  tableSelections: z.record(
    z.string(), // tableId
    z.object({
      isSelected: z.boolean(),
      rowId: z.string().optional(),
    })
  ).optional(),
  taskAssignments: z.record(
    z.string() // Defines that values in the record are strings (user IDs). Keys are implicitly strings (taskTemplateId).
  ),
}).superRefine((data, ctx) => {
  if (data.tableSelections) {
    for (const tableId in data.tableSelections) {
      const selection = data.tableSelections[tableId];
      const currentTable = allDynamicTablesForValidation.find(t => t.id === tableId);
      if (selection.isSelected && (!selection.rowId || selection.rowId === '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `A row must be selected for table: ${currentTable?.label || tableId}.`,
          path: [`tableSelections.${tableId}.rowId`],
        });
      }
    }
  }
});

type WorkflowInstanceFormData = z.infer<typeof workflowInstanceSchema>;

let allDynamicTablesForValidation: TableWithDetails[] = [];


export default function NewWorkflowInstancePage() {
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([]);
  const [allTaskTemplatesInternal, setAllTaskTemplatesInternal] = useState<TaskTemplate[]>([]);
  const [allDynamicTablesInternal, setAllDynamicTablesInternal] = useState<TableWithDetails[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedTemplateTasks, setSelectedTemplateTasks] = useState<TaskTemplate[]>([]);

  const [tableEntriesMap, setTableEntriesMap] = useState<Record<string, DynamicTableRowData[]>>({});
  const [loadingStates, setLoadingStates] = useState<{
    templates: boolean,
    tables: boolean,
    taskTemplates: boolean,
    users: boolean,
    entries: Record<string, boolean>
  }>({
    templates: true,
    tables: true,
    taskTemplates: true,
    users: true,
    entries: {},
  });

  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<WorkflowInstanceFormData>({
    resolver: zodResolver(workflowInstanceSchema),
    defaultValues: {
      tableSelections: {},
      taskAssignments: {},
    }
  });

  const watchedWorkflowTemplateId = useWatch({
    control: form.control,
    name: "workflowTemplateId",
  });

  const watchedTableSelections = useWatch({
    control: form.control,
    name: "tableSelections",
  });

  useEffect(() => {
    async function loadInitialData() {
      setLoadingStates(prev => ({ ...prev, templates: true, tables: true, taskTemplates: true, users: true }));
      try {
        const [templatesData, tablesDataRaw, allFieldsData, taskTemplatesData, usersData] = await Promise.all([
          getWorkflowTemplates(),
          getDynamicTables(),
          getDynamicFields(),
          getTaskTemplates(),
          getUsers(),
        ]);
        
        setWorkflowTemplates(templatesData.filter(t => !t.isArchived));
        setAllTaskTemplatesInternal(taskTemplatesData.filter(tt => !tt.isArchived));
        setAllUsers(usersData.filter(u => !u.isArchived));

        const activeTablesDataRaw = tablesDataRaw.filter(t => !t.isArchived);
        const activeFieldsData = allFieldsData.filter(f => !f.isArchived);

        const tablesWithFields = activeTablesDataRaw.map(table => ({
          ...table,
          fields: activeFieldsData.filter(f => table.fieldIds.includes(f.id))
            .sort((a, b) => table.fieldIds.indexOf(a.id) - table.fieldIds.indexOf(b.id))
        }));
        setAllDynamicTablesInternal(tablesWithFields);
        allDynamicTablesForValidation = tablesWithFields; 

        const initialTableSelections: Record<string, { isSelected: boolean, rowId?: string }> = {};
        tablesWithFields.forEach(table => {
          initialTableSelections[table.id] = { isSelected: false, rowId: '' };
        });
        
        form.reset({
          workflowTemplateId: form.getValues('workflowTemplateId') || '',
          instanceName: form.getValues('instanceName') || '',
          tableSelections: initialTableSelections,
          taskAssignments: {},
        });

      } catch (error) {
        toast({ title: "Error", description: "Could not fetch initial data.", variant: "destructive" });
      } finally {
        setLoadingStates(prev => ({ ...prev, templates: false, tables: false, taskTemplates: false, users: false }));
      }
    }
    loadInitialData();
  }, [toast, form]);


  useEffect(() => {
    if (watchedWorkflowTemplateId && workflowTemplates.length > 0 && allTaskTemplatesInternal.length > 0) {
      const selectedTemplate = workflowTemplates.find(t => t.id === watchedWorkflowTemplateId);
      if (selectedTemplate) {
        const tasks = selectedTemplate.taskTemplateIds
          .map(id => allTaskTemplatesInternal.find(tt => tt.id === id))
          .filter(Boolean) as TaskTemplate[]; // Relies on allTaskTemplatesInternal already being filtered
        setSelectedTemplateTasks(tasks);

        const newTaskAssignments: Record<string, string> = {};
        tasks.forEach(task => {
          newTaskAssignments[task.id] = ''; 
        });
        form.setValue('taskAssignments', newTaskAssignments);
        tasks.forEach(task => form.clearErrors(`taskAssignments.${task.id}`));

      } else {
        setSelectedTemplateTasks([]);
        form.setValue('taskAssignments', {});
      }
    } else {
      setSelectedTemplateTasks([]);
      form.setValue('taskAssignments', {});
    }
  }, [watchedWorkflowTemplateId, workflowTemplates, allTaskTemplatesInternal, form]);


  useEffect(() => {
    if (!watchedTableSelections) return;

    Object.entries(watchedTableSelections).forEach(async ([tableId, selection]) => {
      if (selection.isSelected && !tableEntriesMap[tableId] && !loadingStates.entries[tableId]) {
        setLoadingStates(prev => ({ ...prev, entries: { ...prev.entries, [tableId]: true } }));
        try {
          const entries = await getDynamicTableEntries(tableId);
          // Filter out archived entries from the selection dropdown
          setTableEntriesMap(prevMap => ({ ...prevMap, [tableId]: entries.filter(e => !e.isArchived) }));
        } catch (error) {
          toast({ title: "Error", description: `Could not load entries for table ${allDynamicTablesInternal.find(t => t.id === tableId)?.label || tableId}.`, variant: "destructive" });
          form.setValue(`tableSelections.${tableId}.isSelected`, false);
        } finally {
          setLoadingStates(prev => ({ ...prev, entries: { ...prev.entries, [tableId]: false } }));
        }
      }
    });
  }, [watchedTableSelections, tableEntriesMap, loadingStates.entries, toast, form, allDynamicTablesInternal]);


  const onSubmit: SubmitHandler<WorkflowInstanceFormData> = async (data) => {
    let hasValidationErrors = false;
    const selectedTemplate = workflowTemplates.find(t => t.id === data.workflowTemplateId);
    if (selectedTemplate) {
        for (const taskTemplateId of selectedTemplate.taskTemplateIds) {
            if (!data.taskAssignments[taskTemplateId] || data.taskAssignments[taskTemplateId] === '') {
                form.setError(`taskAssignments.${taskTemplateId}`, { type: 'manual', message: 'User assignment is required.' });
                hasValidationErrors = true;
            }
        }
    }

    if (hasValidationErrors) {
        toast({title: "Validation Error", description: "Please assign users to all tasks and complete required selections.", variant: "destructive"})
        return;
    }

    try {
      const finalAssociatedData: Record<string, string> = {};
      if (data.tableSelections) {
        for (const tableId in data.tableSelections) {
          const selection = data.tableSelections[tableId];
          if (selection.isSelected && selection.rowId && selection.rowId !== '') {
            finalAssociatedData[tableId] = selection.rowId;
          }
        }
      }

      const newInstancePayload = {
        workflowTemplateId: data.workflowTemplateId,
        name: data.instanceName,
        associatedData: Object.keys(finalAssociatedData).length > 0 ? finalAssociatedData : undefined,
        taskAssignments: data.taskAssignments,
      };

      const newInstance = await addWorkflowInstance(newInstancePayload);
      toast({ title: "Workflow Instance Created", description: `Instance "${newInstance.name}" has been started.` });
      router.push(`/workflows/${newInstance.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not create workflow instance.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const isInitialLoading = loadingStates.templates || loadingStates.tables || loadingStates.taskTemplates || loadingStates.users;

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading data...</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Create New Workflow Instance"
        description="Select a template, name your instance, link data, and assign tasks to users."
      />
      {workflowTemplates.length === 0 && !isInitialLoading ? (
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader className="items-center text-center">
            <WorkflowIcon className="w-16 h-16 text-muted-foreground mb-4" />
            <CardTitle>No Active Workflow Templates Available</CardTitle>
            <CardDescription>
              An administrator needs to create and ensure workflow templates are not archived.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" onClick={() => router.push('/')}>Back to Dashboard</Button>
          </CardFooter>
        </Card>
      ) : (
        <Card className="w-full max-w-2xl mx-auto shadow-lg">
          <CardHeader>
            <CardTitle>Start a Workflow</CardTitle>
            <CardDescription>Fill in the details below to initiate a new workflow process.</CardDescription>
          </CardHeader>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="workflowTemplateId">Workflow Template <span className="text-destructive">*</span></Label>
                <Controller
                  name="workflowTemplateId"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        setSelectedTemplateTasks([]); 
                        form.setValue('taskAssignments', {}); 
                      }}
                      value={field.value || ''}
                    >
                      <SelectTrigger id="workflowTemplateId" aria-label="Select Workflow Template">
                        <SelectValue placeholder="Choose a workflow template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {workflowTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.workflowTemplateId && <p className="text-sm text-destructive">{form.formState.errors.workflowTemplateId.message}</p>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="instanceName">Instance Name <span className="text-destructive">*</span></Label>
                <Input
                  id="instanceName"
                  placeholder="e.g., Onboarding John Doe, Q3 Audit"
                  {...form.register("instanceName")}
                />
                {form.formState.errors.instanceName && <p className="text-sm text-destructive">{form.formState.errors.instanceName.message}</p>}
              </div>

              {watchedWorkflowTemplateId && selectedTemplateTasks.length > 0 && (
                <>
                  <Separator className="my-2" />
                  <div>
                    <h3 className="text-md font-semibold text-muted-foreground flex items-center mb-3">
                      <ClipboardList className="mr-2 h-5 w-5" /> Assign Tasks to Users
                    </h3>
                    <div className="grid gap-4">
                      {selectedTemplateTasks.map((taskTemplate) => (
                        <div key={taskTemplate.id} className="grid gap-2 p-3 border rounded-md bg-muted/20">
                          <Label htmlFor={`taskAssignments.${taskTemplate.id}`}>
                            Task: <span className="font-medium">{taskTemplate.name}</span> <span className="text-destructive">*</span>
                          </Label>
                          <Controller
                            name={`taskAssignments.${taskTemplate.id}`}
                            control={form.control}
                            defaultValue=""
                            render={({ field }) => (
                              <Select
                                onValueChange={field.onChange}
                                value={field.value || ''}
                              >
                                <SelectTrigger id={`taskAssignments.${taskTemplate.id}`}>
                                  <SelectValue placeholder="Select a user..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {allUsers.length === 0 ? (
                                    <SelectItem value="no-users-disabled" disabled>No active users available</SelectItem>
                                  ) : (
                                    allUsers.map(user => (
                                      <SelectItem key={user.id} value={user.id}>
                                        {user.username} ({user.role})
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {form.formState.errors.taskAssignments?.[taskTemplate.id] && (
                            <p className="text-sm text-destructive">{form.formState.errors.taskAssignments[taskTemplate.id]?.message}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {allDynamicTablesInternal.length > 0 && (
                <>
                  <Separator className="my-2" />
                  <div>
                    <h3 className="text-md font-semibold text-muted-foreground flex items-center mb-3">
                      <LinkIcon className="mr-2 h-5 w-5" /> Link Data from Dynamic Tables (Optional)
                    </h3>
                    <div className="grid gap-4">
                      {allDynamicTablesInternal.map((table) => (
                        <div key={table.id} className="p-4 border rounded-md space-y-3 bg-muted/20">
                          <Controller
                            name={`tableSelections.${table.id}.isSelected`}
                            control={form.control}
                            render={({ field }) => (
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`select-table-${table.id}`}
                                  checked={!!field.value}
                                  onCheckedChange={(checked) => {
                                    field.onChange(checked);
                                    if (!checked) {
                                      form.setValue(`tableSelections.${table.id}.rowId`, '');
                                      form.clearErrors(`tableSelections.${table.id}.rowId`);
                                    }
                                  }}
                                />
                                <Label htmlFor={`select-table-${table.id}`} className="font-medium text-base">
                                  Associate data from: {table.label}
                                </Label>
                              </div>
                            )}
                          />

                          {watchedTableSelections?.[table.id]?.isSelected && (
                            <div className="grid gap-2 pl-6">
                              <Label htmlFor={`row-select-${table.id}`}>Select Row for {table.label} <span className="text-destructive">*</span></Label>
                              {loadingStates.entries[table.id] && (
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading entries...
                                </div>
                              )}
                              {!loadingStates.entries[table.id] && tableEntriesMap[table.id] && (
                                <Controller
                                  name={`tableSelections.${table.id}.rowId`}
                                  control={form.control}
                                  render={({ field }) => (
                                    <Select
                                      onValueChange={field.onChange}
                                      value={field.value || ''}
                                    >
                                      <SelectTrigger id={`row-select-${table.id}`}>
                                        <SelectValue placeholder={`Select a row from ${table.label}...`} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(tableEntriesMap[table.id]?.length ?? 0) === 0 ? (
                                          <SelectItem value="no-entries-disabled" disabled>No active entries available in {table.label}</SelectItem>
                                        ) : (
                                          tableEntriesMap[table.id]?.map(entry => (
                                            <SelectItem key={entry.id} value={entry.id}>
                                              {getDisplayValueForRow(entry.data, table.fields)}
                                            </SelectItem>
                                          ))
                                        )}
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                              )}
                              {form.formState.errors.tableSelections?.[table.id]?.rowId && (
                                <p className="text-sm text-destructive">{form.formState.errors.tableSelections[table.id]?.rowId?.message}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button type="submit" disabled={form.formState.isSubmitting || Object.values(loadingStates.entries).some(Boolean) || !watchedWorkflowTemplateId}>
                {(form.formState.isSubmitting || Object.values(loadingStates.entries).some(Boolean)) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Start Workflow
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}
    </>
  );
}

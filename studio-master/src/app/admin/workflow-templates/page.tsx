
"use client";

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, CheckSquare, AlertTriangle, AppWindow, ArrowUp, ArrowDown, XCircle, Filter, Archive } from 'lucide-react'; 
import type { WorkflowTemplate, TaskTemplate } from '@/lib/types';
import { getWorkflowTemplates, getTaskTemplates, addWorkflowTemplate, updateWorkflowTemplate, archiveWorkflowTemplate } from '@/lib/data';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { DataTable } from '@/components/common/data-table';
import { getWorkflowTemplateColumns } from './components/columns';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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


const workflowTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  taskTemplateIds: z.array(z.string()).min(1, "At least one task template must be selected"),
});

type WorkflowTemplateFormData = z.infer<typeof workflowTemplateSchema>;
const ALL_CATEGORIES_VALUE = "__ALL_TASK_CATEGORIES__";

export default function WorkflowTemplatesPage() {
  const [allWorkflowTemplates, setAllWorkflowTemplates] = useState<WorkflowTemplate[]>([]);
  const [allTaskTemplates, setAllTaskTemplates] = useState<TaskTemplate[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [archivingTemplate, setArchivingTemplate] = useState<{id: string, archive: boolean, name: string} | null>(null);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"current" | "archived">("current");

  const [selectedTaskCategoryFilter, setSelectedTaskCategoryFilter] = useState<string>(ALL_CATEGORIES_VALUE);

  const form = useForm<WorkflowTemplateFormData>({
    resolver: zodResolver(workflowTemplateSchema),
    defaultValues: {
      taskTemplateIds: [],
    },
  });
  
  const watchedTaskTemplateIds = form.watch("taskTemplateIds");

  const availableTaskCategories = useMemo(() => {
    const categories = new Set<string>();
    allTaskTemplates.forEach(tt => {
      if (tt.category && tt.category.trim() !== '') {
        categories.add(tt.category.trim());
      }
    });
    return Array.from(categories).sort();
  }, [allTaskTemplates]);

  const filteredAvailableTaskTemplates = useMemo(() => {
    if (selectedTaskCategoryFilter === ALL_CATEGORIES_VALUE) {
      return allTaskTemplates.filter(tt => !tt.isArchived); // Only show non-archived task templates
    }
    return allTaskTemplates.filter(tt => !tt.isArchived && tt.category === selectedTaskCategoryFilter);
  }, [allTaskTemplates, selectedTaskCategoryFilter]);


  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [wfTemplatesData, taskTemplatesData] = await Promise.all([getWorkflowTemplates(), getTaskTemplates()]);
        setAllWorkflowTemplates(wfTemplatesData);
        setAllTaskTemplates(taskTemplatesData); // No filter here, filter for active ones in dialog
      } catch (error) {
        toast({ title: "Error loading data", description: "Could not fetch workflow or task templates.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [toast]);

  const currentTemplates = useMemo(() => allWorkflowTemplates.filter(t => !t.isArchived), [allWorkflowTemplates]);
  const archivedTemplates = useMemo(() => allWorkflowTemplates.filter(t => t.isArchived), [allWorkflowTemplates]);

  const handleAddNew = () => {
    setEditingTemplate(null);
    form.reset({ name: '', description: '', taskTemplateIds: [] });
    setSelectedTaskCategoryFilter(ALL_CATEGORIES_VALUE);
    setIsDialogOpen(true);
  };

  const handleEdit = (template: WorkflowTemplate) => {
    setEditingTemplate(template);
    form.reset({
      name: template.name,
      description: template.description || '',
      taskTemplateIds: [...template.taskTemplateIds], 
    });
    setSelectedTaskCategoryFilter(ALL_CATEGORIES_VALUE);
    setIsDialogOpen(true);
  };

  const confirmArchiveToggle = (templateId: string, shouldArchive: boolean) => {
    const template = allWorkflowTemplates.find(t => t.id === templateId);
    if (template) {
        setArchivingTemplate({ id: templateId, archive: shouldArchive, name: template.name });
    }
  };

  const handleArchiveToggleAction = async () => {
    if (!archivingTemplate) return;
    const { id, archive } = archivingTemplate;
    try {
      const updatedTemplate = await archiveWorkflowTemplate(id, archive); // Use the boolean flag
      setAllWorkflowTemplates(allWorkflowTemplates.map(t => t.id === id ? updatedTemplate : t));
      toast({ title: `Workflow Template ${archive ? 'Archived' : 'Restored'}`, description: `The template "${updatedTemplate.name}" has been ${archive ? 'archived' : 'restored'}.` });
    } catch (error) {
      toast({ title: "Error", description: `Could not ${archive ? 'archive' : 'restore'} workflow template.`, variant: "destructive" });
    } finally {
      setArchivingTemplate(null);
    }
  };

  const onSubmit: SubmitHandler<WorkflowTemplateFormData> = async (data) => {
    try {
      const workflowDataToSave = {
        name: data.name,
        description: data.description,
        taskTemplateIds: data.taskTemplateIds
      };

      if (editingTemplate) {
        const updatedTemplate = await updateWorkflowTemplate(editingTemplate.id, workflowDataToSave);
        setAllWorkflowTemplates(allWorkflowTemplates.map(t => t.id === editingTemplate.id ? updatedTemplate : t));
        toast({ title: "Workflow Template Updated", description: "The workflow template has been updated." });
      } else {
        const newTemplate = await addWorkflowTemplate(workflowDataToSave as Omit<WorkflowTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>);
        setAllWorkflowTemplates(prev => [...prev, newTemplate].sort((a,b) => a.name.localeCompare(b.name)));
        toast({ title: "Workflow Template Created", description: "New workflow template has been created." });
      }
      setIsDialogOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not save workflow template.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const handleToggleTaskTemplateSelection = (taskTemplateId: string, isSelected: boolean) => {
    const currentTaskTemplateIds = form.getValues("taskTemplateIds") || [];
    if (isSelected) {
      if (!currentTaskTemplateIds.includes(taskTemplateId)) {
        form.setValue("taskTemplateIds", [...currentTaskTemplateIds, taskTemplateId], { shouldValidate: true, shouldDirty: true });
      }
    } else {
      form.setValue("taskTemplateIds", currentTaskTemplateIds.filter(id => id !== taskTemplateId), { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleMoveTaskTemplate = (index: number, direction: 'up' | 'down') => {
    const currentTaskTemplateIds = [...(form.getValues("taskTemplateIds") || [])];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= currentTaskTemplateIds.length) return;

    const temp = currentTaskTemplateIds[index];
    currentTaskTemplateIds[index] = currentTaskTemplateIds[newIndex];
    currentTaskTemplateIds[newIndex] = temp;
    form.setValue("taskTemplateIds", currentTaskTemplateIds, { shouldValidate: true, shouldDirty: true });
  };

  const handleRemoveSelectedTaskTemplate = (taskTemplateIdToRemove: string) => {
    const currentTaskTemplateIds = form.getValues("taskTemplateIds") || [];
    form.setValue("taskTemplateIds", currentTaskTemplateIds.filter(id => id !== taskTemplateIdToRemove), { shouldValidate: true, shouldDirty: true });
  };


  const columnsCurrent = useMemo(() => getWorkflowTemplateColumns(handleEdit, confirmArchiveToggle, "current"), [allWorkflowTemplates]);
  const columnsArchived = useMemo(() => getWorkflowTemplateColumns(handleEdit, confirmArchiveToggle, "archived"), [allWorkflowTemplates]);


  if (isLoading && allWorkflowTemplates.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading workflow templates...</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Workflow Templates"
        description="Define reusable sequences of task templates for your processes."
        actionButtonText="Add New Template"
        onActionButtonClick={handleAddNew}
      />
      
       <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "current" | "archived")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px] mb-4">
          <TabsTrigger value="current">Current</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
        <TabsContent value="current">
           {isLoading && currentTemplates.length === 0 && allWorkflowTemplates.length > 0 ? (
             <div className="text-center h-24 flex items-center justify-center">Loading current templates...</div>
           ) : (
            <DataTable columns={columnsCurrent} data={currentTemplates} searchPlaceholder="Search current templates..." />
           )}
        </TabsContent>
        <TabsContent value="archived">
           {isLoading && archivedTemplates.length === 0 && allWorkflowTemplates.length > 0 ? (
             <div className="text-center h-24 flex items-center justify-center">Loading archived templates...</div>
           ) : (
            <DataTable columns={columnsArchived} data={archivedTemplates} searchPlaceholder="Search archived templates..." />
           )}
        </TabsContent>
      </Tabs>


      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit' : 'Create'} Workflow Template</DialogTitle>
            <DialogDescription>
              {editingTemplate ? 'Update details for this workflow template.' : 'Define a new workflow template and associate task templates in order.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4 flex-grow overflow-hidden">
            <ScrollArea className="flex-grow pr-6">
                <div className="grid gap-4">
                    <div className="grid gap-2">
                    <Label htmlFor="name">Template Name</Label>
                    <Input id="name" {...form.register("name")} placeholder="e.g., New Customer Onboarding" />
                    {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
                    </div>
                    <div className="grid gap-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea id="description" {...form.register("description")} placeholder="Overview of the workflow"/>
                    </div>

                    <Separator className="my-2" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                            <Label className="flex items-center"><AppWindow className="mr-2 h-4 w-4 text-muted-foreground" /> Available Task Templates</Label>
                            {availableTaskCategories.length > 0 && (
                                <div className="flex items-center gap-2 mb-2">
                                    <Filter className="h-4 w-4 text-muted-foreground" />
                                    <Label htmlFor="task-category-filter" className="text-xs font-medium">Filter by Category:</Label>
                                    <Select value={selectedTaskCategoryFilter} onValueChange={setSelectedTaskCategoryFilter}>
                                        <SelectTrigger id="task-category-filter" className="w-auto h-8 text-xs">
                                            <SelectValue placeholder="Select category..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_CATEGORIES_VALUE}>All Categories</SelectItem>
                                            {availableTaskCategories.map(category => (
                                                <SelectItem key={category} value={category}>{category}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <ScrollArea className="h-60 rounded-md border p-2 bg-muted/30">
                            {filteredAvailableTaskTemplates.length === 0 && <p className="text-sm text-muted-foreground p-2">No task templates match the filter, or none available. Create active task templates first or adjust filter.</p>}
                            {filteredAvailableTaskTemplates.map((tt) => (
                                <div key={tt.id} className="flex items-center space-x-2 mb-1 p-1.5 rounded hover:bg-accent/50 transition-colors">
                                <Checkbox
                                    id={`available-task-template-${tt.id}`}
                                    checked={watchedTaskTemplateIds?.includes(tt.id)}
                                    onCheckedChange={(checked) => handleToggleTaskTemplateSelection(tt.id, !!checked)}
                                />
                                <Label htmlFor={`available-task-template-${tt.id}`} className="font-normal text-sm cursor-pointer w-full">
                                    {tt.name} {tt.category && <span className="text-xs text-muted-foreground">({tt.category})</span>}
                                </Label>
                                </div>
                            ))}
                            </ScrollArea>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label className="flex items-center"><CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" />Selected Task Templates (Order for Sequence)</Label>
                            <ScrollArea className="h-60 rounded-md border p-2">
                            {watchedTaskTemplateIds && watchedTaskTemplateIds.length > 0 ? (
                                watchedTaskTemplateIds.map((taskTemplateId, index) => {
                                const taskTemplate = allTaskTemplates.find(tt => tt.id === taskTemplateId);
                                if (!taskTemplate) return null;
                                return (
                                    <div key={taskTemplate.id} className="flex items-center justify-between space-x-2 p-1.5 mb-1 rounded bg-accent/20 hover:bg-accent/30 transition-colors">
                                    <span className="text-sm flex-grow truncate" title={taskTemplate.name}>
                                        {index + 1}. {taskTemplate.name}
                                    </span>
                                    <div className="flex items-center shrink-0">
                                        <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleMoveTaskTemplate(index, 'up')}
                                        disabled={index === 0}
                                        title="Move Up"
                                        >
                                        <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleMoveTaskTemplate(index, 'down')}
                                        disabled={index === watchedTaskTemplateIds.length - 1}
                                        title="Move Down"
                                        >
                                        <ArrowDown className="h-4 w-4" />
                                        </Button>
                                        <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive/80"
                                        onClick={() => handleRemoveSelectedTaskTemplate(taskTemplate.id)}
                                        title="Remove Task Template"
                                        >
                                        <XCircle className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    </div>
                                );
                                })
                            ) : (
                                <p className="text-sm text-muted-foreground p-2 text-center">No task templates selected. Check templates from the "Available Task Templates" list.</p>
                            )}
                            </ScrollArea>
                        </div>
                    </div>
                </div>
            </ScrollArea>
            
            {form.formState.errors.taskTemplateIds && (
                <Alert variant="destructive" className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                    {form.formState.errors.taskTemplateIds.message}
                </AlertDescription>
                </Alert>
            )}

            <DialogFooter className="mt-auto pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                 {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Save Template'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

       <AlertDialog open={!!archivingTemplate} onOpenChange={(open) => !open && setArchivingTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{archivingTemplate?.archive ? 'Archive' : 'Restore'} Workflow Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will {archivingTemplate?.archive ? 'archive' : 'restore'} the workflow template "{archivingTemplate?.name}".
              {archivingTemplate?.archive ? ' Archived templates cannot be used to create new workflow instances.' : ' Restored templates can be used again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setArchivingTemplate(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleArchiveToggleAction} 
              className={archivingTemplate?.archive ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
              disabled={form.formState.isSubmitting}
            >
               {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (archivingTemplate?.archive ? 'Archive' : 'Restore')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


    
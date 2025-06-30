
"use client";

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Archive } from 'lucide-react';
import type { TaskTemplate, DynamicTable } from '@/lib/types';
import { getTaskTemplates, getDynamicTables, addTaskTemplate, updateTaskTemplate, archiveTaskTemplate } from '@/lib/data';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { DataTable } from '@/components/common/data-table';
import { getTaskTemplateColumns } from './components/columns';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const taskTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  assignedRoleType: z.string().optional(),
  dueDateOffsetDays: z.coerce.number().int().optional().nullable(),
  dynamicTableId: z.string().optional().nullable(),
});

type TaskTemplateFormData = z.infer<typeof taskTemplateSchema>;

const NONE_VALUE = "__NONE__"; 

export default function TaskTemplatesPage() {
  const [allTaskTemplates, setAllTaskTemplates] = useState<TaskTemplate[]>([]);
  const [dynamicTables, setDynamicTables] = useState<DynamicTable[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [archivingTemplate, setArchivingTemplate] = useState<{id: string, archive: boolean} | null>(null);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"current" | "archived">("current");

  const form = useForm<TaskTemplateFormData>({
    resolver: zodResolver(taskTemplateSchema),
    defaultValues: {
        dueDateOffsetDays: null,
        dynamicTableId: null,
        category: '',
    }
  });

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [templatesData, tablesData] = await Promise.all([getTaskTemplates(), getDynamicTables()]);
        setAllTaskTemplates(templatesData);
        setDynamicTables(tablesData.filter(t => !t.isArchived)); // Only show non-archived tables in dropdown
      } catch (error) {
        toast({ title: "Error loading data", description: "Could not fetch task templates or dynamic tables.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [toast]);

  const currentTemplates = useMemo(() => allTaskTemplates.filter(t => !t.isArchived), [allTaskTemplates]);
  const archivedTemplates = useMemo(() => allTaskTemplates.filter(t => t.isArchived), [allTaskTemplates]);

  const handleAddNew = () => {
    setEditingTemplate(null);
    form.reset({ name: '', description: '', category: '', assignedRoleType: '', dueDateOffsetDays: null, dynamicTableId: null });
    setIsDialogOpen(true);
  };

  const handleEdit = (template: TaskTemplate) => {
    setEditingTemplate(template);
    form.reset({
      name: template.name,
      description: template.description || '',
      category: template.category || '',
      assignedRoleType: template.assignedRoleType || '',
      dueDateOffsetDays: template.dueDateOffsetDays || null,
      dynamicTableId: template.dynamicTableId || null,
    });
    setIsDialogOpen(true);
  };

  const confirmArchiveToggle = (templateId: string, shouldArchive: boolean) => {
    setArchivingTemplate({ id: templateId, archive: shouldArchive });
  };

  const handleArchiveToggle = async () => {
    if (!archivingTemplate) return;
    const { id, archive } = archivingTemplate;
    try {
      const updatedTemplate = await archiveTaskTemplate(id, archive);
      setAllTaskTemplates(current => current.map(t => t.id === id ? updatedTemplate : t));
      toast({ title: `Task Template ${archive ? 'Archived' : 'Restored'}`, description: `The task template has been ${archive ? 'archived' : 'restored'}.` });
    } catch (error) {
      toast({ title: "Error", description: `Could not ${archive ? 'archive' : 'restore'} task template.`, variant: "destructive" });
    } finally {
      setArchivingTemplate(null);
    }
  };

  const onSubmit: SubmitHandler<TaskTemplateFormData> = async (data) => {
    try {
      const processedData = {
        ...data,
        category: data.category || undefined, 
        dynamicTableId: data.dynamicTableId === NONE_VALUE ? undefined : data.dynamicTableId,
        dueDateOffsetDays: data.dueDateOffsetDays === null ? undefined : data.dueDateOffsetDays,
      };

      if (editingTemplate) {
        const updatedTemplate = await updateTaskTemplate(editingTemplate.id, processedData);
        setAllTaskTemplates(allTaskTemplates.map(t => t.id === editingTemplate.id ? updatedTemplate : t));
        toast({ title: "Task Template Updated", description: "The task template has been updated." });
      } else {
        const newTemplate = await addTaskTemplate(processedData as Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>);
        setAllTaskTemplates(prev => [...prev, newTemplate].sort((a,b) => a.name.localeCompare(b.name)));
        toast({ title: "Task Template Created", description: "New task template has been created." });
      }
      setIsDialogOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not save task template.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const getDynamicTableName = (id?: string) => id ? dynamicTables.find(dt => dt.id === id)?.label || 'N/A' : 'N/A';
  
  const columnsCurrent = useMemo(() => getTaskTemplateColumns(handleEdit, confirmArchiveToggle, getDynamicTableName, "current"), [dynamicTables, allTaskTemplates]);
  const columnsArchived = useMemo(() => getTaskTemplateColumns(handleEdit, confirmArchiveToggle, getDynamicTableName, "archived"), [dynamicTables, allTaskTemplates]);


  if (isLoading && allTaskTemplates.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading task templates...</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Task Templates"
        description="Define reusable units of work for your workflows."
        actionButtonText="Add New Template"
        onActionButtonClick={handleAddNew}
      />
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "current" | "archived")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px] mb-4">
          <TabsTrigger value="current">Current</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
        <TabsContent value="current">
          {isLoading && currentTemplates.length === 0 && allTaskTemplates.length > 0 ? (
            <div className="text-center h-24 flex items-center justify-center">Loading current templates...</div>
          ) : (
            <DataTable columns={columnsCurrent} data={currentTemplates} searchPlaceholder="Search current task templates..." />
          )}
        </TabsContent>
        <TabsContent value="archived">
          {isLoading && archivedTemplates.length === 0 && allTaskTemplates.length > 0 ? (
             <div className="text-center h-24 flex items-center justify-center">Loading archived templates...</div>
          ) : (
            <DataTable columns={columnsArchived} data={archivedTemplates} searchPlaceholder="Search archived task templates..." />
          )}
        </TabsContent>
      </Tabs>


      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit' : 'Create'} Task Template</DialogTitle>
            <DialogDescription>
              {editingTemplate ? 'Update details for this task template.' : 'Define a new task template.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Template Name</Label>
              <Input id="name" {...form.register("name")} placeholder="e.g., Verify Customer ID" />
              {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea id="description" {...form.register("description")} placeholder="Detailed explanation of the task"/>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category (Optional)</Label>
              <Input id="category" {...form.register("category")} placeholder="e.g., Verification, Approval"/>
            </div>
             <div className="grid gap-2">
              <Label htmlFor="assignedRoleType">Assigned Role/User Type (Optional)</Label>
              <Input id="assignedRoleType" {...form.register("assignedRoleType")} placeholder="e.g., Administrator"/>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dueDateOffsetDays">Due Date Offset (Days, Optional)</Label>
              <Input id="dueDateOffsetDays" type="number" {...form.register("dueDateOffsetDays")} placeholder="e.g., 3 (days after previous task)"/>
              {form.formState.errors.dueDateOffsetDays && <p className="text-sm text-destructive">{form.formState.errors.dueDateOffsetDays.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dynamicTableId">Associated Dynamic Table (Optional)</Label>
              <Controller
                name="dynamicTableId"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || NONE_VALUE} defaultValue={field.value || NONE_VALUE}>
                    <SelectTrigger id="dynamicTableId">
                      <SelectValue placeholder="Select a dynamic table" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {dynamicTables.map((table) => (
                        <SelectItem key={table.id} value={table.id}>{table.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Template'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!archivingTemplate} onOpenChange={(open) => !open && setArchivingTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will {archivingTemplate?.archive ? 'archive' : 'restore'} the task template. 
              {archivingTemplate?.archive ? ' Archived templates cannot be used in new workflows but existing workflows will retain them.' : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setArchivingTemplate(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleArchiveToggle} 
              className={archivingTemplate?.archive ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
            >
              {archivingTemplate?.archive ? 'Archive' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

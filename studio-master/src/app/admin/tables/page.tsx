
"use client";

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, ArrowUp, ArrowDown, XCircle, CheckSquare, AppWindow, AlertTriangle, Filter, Archive } from 'lucide-react';
import type { DynamicTable, DynamicField } from '@/lib/types';
import { getDynamicTables, getDynamicFields, addDynamicTable, updateDynamicTable, archiveDynamicTable } from '@/lib/data';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DataTable } from '@/components/common/data-table';
import { getDynamicTableColumns } from './components/columns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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


const dynamicTableSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_]+$/, "Name can only contain letters, numbers, and underscores (no spaces)."),
  label: z.string().min(1, "Label is required"),
  description: z.string().optional(),
  fieldIds: z.array(z.string()).min(1, "At least one field must be selected for the table definition."),
});

type DynamicTableFormData = z.infer<typeof dynamicTableSchema>;
const ALL_CATEGORIES_VALUE = "__ALL_FIELD_CATEGORIES__";

export default function DynamicTablesPage() {
  const [allDbTables, setAllDbTables] = useState<DynamicTable[]>([]);
  const [allFields, setAllFields] = useState<DynamicField[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<DynamicTable | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [archivingTable, setArchivingTable] = useState<{table: DynamicTable, archive: boolean} | null>(null);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"current" | "archived">("current");

  const [selectedFieldCategoryFilter, setSelectedFieldCategoryFilter] = useState<string>(ALL_CATEGORIES_VALUE);

  const form = useForm<DynamicTableFormData>({
    resolver: zodResolver(dynamicTableSchema),
    defaultValues: {
      fieldIds: [],
    },
  });

  const selectedFieldIds = form.watch("fieldIds");

  const availableFieldCategories = useMemo(() => {
    const categories = new Set<string>();
    allFields.forEach(field => {
      if (field.category && field.category.trim() !== '' && !field.isArchived) {
        categories.add(field.category.trim());
      }
    });
    return Array.from(categories).sort();
  }, [allFields]);

  const filteredAvailableFields = useMemo(() => {
    const activeFields = allFields.filter(field => !field.isArchived);
    if (selectedFieldCategoryFilter === ALL_CATEGORIES_VALUE) {
      return activeFields;
    }
    return activeFields.filter(field => field.category === selectedFieldCategoryFilter);
  }, [allFields, selectedFieldCategoryFilter]);
  
  const currentTables = useMemo(() => allDbTables.filter(t => !t.isArchived), [allDbTables]);
  const archivedTables = useMemo(() => allDbTables.filter(t => t.isArchived), [allDbTables]);


  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [tablesData, fieldsData] = await Promise.all([getDynamicTables(), getDynamicFields()]);
        setAllDbTables(tablesData);
        setAllFields(fieldsData);
      } catch (error) {
        toast({ title: "Error loading data", description: "Could not fetch tables or fields.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [toast]);

  const handleAddNew = () => {
    setEditingTable(null);
    form.reset({ name: '', label: '', description: '', fieldIds: [] });
    setSelectedFieldCategoryFilter(ALL_CATEGORIES_VALUE);
    setIsDialogOpen(true);
  };

  const handleEdit = (table: DynamicTable) => {
    setEditingTable(table);
    form.reset({
      name: table.name,
      label: table.label,
      description: table.description || '',
      fieldIds: [...table.fieldIds],
    });
    setSelectedFieldCategoryFilter(ALL_CATEGORIES_VALUE);
    setIsDialogOpen(true);
  };

  const confirmArchiveToggle = (table: DynamicTable, shouldArchive: boolean) => {
    setArchivingTable({ table, archive: shouldArchive });
  };

  const handleArchiveToggleAction = async () => {
    if (!archivingTable) return;
    const { table, archive } = archivingTable;
    try {
      const updatedTable = await archiveDynamicTable(table.id, archive);
      setAllDbTables(currentTables => currentTables.map(t => t.id === table.id ? updatedTable : t));
      toast({ title: `Table Definition ${archive ? 'Archived' : 'Restored'}`, description: `The table definition "${table.label}" has been ${archive ? 'archived' : 'restored'}.` });
    } catch (error) {
      toast({ title: "Error", description: `Could not ${archive ? 'archive' : 'restore'} table definition.`, variant: "destructive" });
    } finally {
      setArchivingTable(null);
    }
  };

  const onSubmit: SubmitHandler<DynamicTableFormData> = async (data) => {
    if (Object.keys(form.formState.errors).length > 0) {
      toast({
        title: "Validation Error",
        description: "Please correct the errors indicated in the form. At least one field must be selected.",
        variant: "destructive",
      });
      return; 
    }

    try {
      const tableDataToSave = {
        name: data.name,
        label: data.label,
        description: data.description,
        fieldIds: data.fieldIds, 
      };

      if (editingTable) {
        const updatedTable = await updateDynamicTable(editingTable.id, tableDataToSave);
        setAllDbTables(currentTables => currentTables.map(t => t.id === editingTable.id ? updatedTable : t));
        toast({ title: "Table Updated", description: "The dynamic table definition has been updated." });
      } else {
        const newTable = await addDynamicTable(tableDataToSave);
        setAllDbTables(prevTables => [newTable, ...prevTables].sort((a,b) => a.label.localeCompare(b.label)));
        toast({ title: "Table Created", description: "New dynamic table definition has been created." });
      }
      setIsDialogOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not save table definition.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };
  
  const handleToggleFieldSelection = (fieldId: string, isSelected: boolean) => {
    const currentFieldIds = form.getValues("fieldIds") || [];
    if (isSelected) {
      if (!currentFieldIds.includes(fieldId)) {
        form.setValue("fieldIds", [...currentFieldIds, fieldId], { shouldValidate: true, shouldDirty: true });
      }
    } else {
      form.setValue("fieldIds", currentFieldIds.filter(id => id !== fieldId), { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const currentFieldIds = [...(form.getValues("fieldIds") || [])];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= currentFieldIds.length) return;

    const temp = currentFieldIds[index];
    currentFieldIds[index] = currentFieldIds[newIndex];
    currentFieldIds[newIndex] = temp;
    form.setValue("fieldIds", currentFieldIds, { shouldValidate: true, shouldDirty: true });
  };

  const handleRemoveSelectedField = (fieldIdToRemove: string) => {
    const currentFieldIds = form.getValues("fieldIds") || [];
    form.setValue("fieldIds", currentFieldIds.filter(id => id !== fieldIdToRemove), { shouldValidate: true, shouldDirty: true });
  };
  
  const columnsCurrent = useMemo(() => getDynamicTableColumns(handleEdit, confirmArchiveToggle, "current"), [allDbTables]);
  const columnsArchived = useMemo(() => getDynamicTableColumns(handleEdit, confirmArchiveToggle, "archived"), [allDbTables]);


  if (isLoading && allDbTables.length === 0) { 
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading dynamic table definitions...</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Dynamic Table Definitions"
        description="Manage custom data structures composed of dynamic fields."
        actionButtonText={activeTab === "current" ? "Add New Table Definition" : undefined}
        onActionButtonClick={activeTab === "current" ? handleAddNew : undefined}
      />
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "current" | "archived")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px] mb-4">
          <TabsTrigger value="current">Current Definitions</TabsTrigger>
          <TabsTrigger value="archived">Archived Definitions</TabsTrigger>
        </TabsList>
        <TabsContent value="current">
           {isLoading && currentTables.length === 0 && allDbTables.length > 0 ? (
             <div className="text-center h-24 flex items-center justify-center">Loading current definitions...</div>
           ) : (
            <DataTable columns={columnsCurrent} data={currentTables} searchPlaceholder="Search current definitions..." />
           )}
        </TabsContent>
        <TabsContent value="archived">
           {isLoading && archivedTables.length === 0 && allDbTables.length > 0 ? (
             <div className="text-center h-24 flex items-center justify-center">Loading archived definitions...</div>
           ) : (
            <DataTable columns={columnsArchived} data={archivedTables} searchPlaceholder="Search archived definitions..." />
           )}
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingTable ? 'Edit' : 'Create'} Dynamic Table Definition</DialogTitle>
            <DialogDescription>
              {editingTable ? 'Update the details of your dynamic table definition.' : 'Define a new dynamic table and associate fields in a specific order.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4 flex-grow overflow-hidden">
            <ScrollArea className="flex-grow pr-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="label">Table Label</Label>
                  <Input id="label" {...form.register("label")} placeholder="e.g., Customer Profile" />
                  {form.formState.errors.label && <p className="text-sm text-destructive">{form.formState.errors.label.message}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Table Name (ID)</Label>
                  <Input id="name" {...form.register("name")} placeholder="e.g., customerProfile" />
                  <p className="text-xs text-muted-foreground">No spaces or special characters, use underscores if needed.</p>
                  {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea id="description" {...form.register("description")} placeholder="Briefly describe this table"/>
                </div>

                <Separator className="my-2" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <Label className="flex items-center"><AppWindow className="mr-2 h-4 w-4 text-muted-foreground" /> Available Fields (Current only)</Label>
                     {availableFieldCategories.length > 0 && (
                        <div className="flex items-center gap-2 mb-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <Label htmlFor="field-category-filter" className="text-xs font-medium">Filter by Category:</Label>
                            <Select value={selectedFieldCategoryFilter} onValueChange={setSelectedFieldCategoryFilter}>
                                <SelectTrigger id="field-category-filter" className="w-auto h-8 text-xs">
                                    <SelectValue placeholder="Select category..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL_CATEGORIES_VALUE}>All Categories</SelectItem>
                                    {availableFieldCategories.map(category => (
                                        <SelectItem key={category} value={category}>{category}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <ScrollArea className="h-60 rounded-md border p-2 bg-muted/30">
                      {filteredAvailableFields.length === 0 && <p className="text-sm text-muted-foreground p-2">No current dynamic fields match the filter, or none available. Create dynamic fields first or adjust filter.</p>}
                      {filteredAvailableFields.map((f) => (
                        <div key={f.id} className="flex items-center space-x-2 mb-1 p-1.5 rounded hover:bg-accent/50 transition-colors">
                          <Checkbox
                            id={`available-field-${f.id}`}
                            checked={selectedFieldIds?.includes(f.id)}
                            onCheckedChange={(checked) => handleToggleFieldSelection(f.id, !!checked)}
                          />
                          <Label htmlFor={`available-field-${f.id}`} className="font-normal text-sm cursor-pointer w-full">
                            {f.label} <span className="text-xs text-muted-foreground">({f.name}) - {f.type} {f.category && `- ${f.category}`}</span>
                          </Label>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="flex items-center"><CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" />Selected Fields (Order for Display)</Label>
                    <ScrollArea className="h-60 rounded-md border p-2">
                      {selectedFieldIds && selectedFieldIds.length > 0 ? (
                        selectedFieldIds.map((fieldId, index) => {
                          const field = allFields.find(f => f.id === fieldId);
                          if (!field) return null;
                          return (
                            <div key={field.id} className="flex items-center justify-between space-x-2 p-1.5 mb-1 rounded bg-accent/20 hover:bg-accent/30 transition-colors">
                              <span className="text-sm flex-grow truncate" title={`${field.label} (${field.name})`}>
                                {index + 1}. {field.label}
                              </span>
                              <div className="flex items-center shrink-0">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleMoveField(index, 'up')}
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
                                  onClick={() => handleMoveField(index, 'down')}
                                  disabled={index === selectedFieldIds.length - 1}
                                  title="Move Down"
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive/80"
                                  onClick={() => handleRemoveSelectedField(field.id)}
                                  title="Remove Field"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-muted-foreground p-2 text-center">No fields selected. Check fields from the "Available Fields" list.</p>
                      )}
                    </ScrollArea>
                  </div>
                </div>
              </div>
            </ScrollArea>
            
            {form.formState.errors.fieldIds && (
              <Alert variant="destructive" className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {form.formState.errors.fieldIds.message}
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="mt-auto pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                 {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Save Table Definition'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {archivingTable && (
         <AlertDialog open={!!archivingTable} onOpenChange={(open) => !open && setArchivingTable(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm {archivingTable.archive ? 'Archive' : 'Restore'} Definition</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to {archivingTable.archive ? 'archive' : 'restore'} the table definition "{archivingTable.table.label}"?
                        {archivingTable.archive ? ' Archived definitions cannot be used to create new tables, but existing table data will remain.' : ' Restored definitions can be used again.'}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setArchivingTable(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleArchiveToggleAction}
                        disabled={form.formState.isSubmitting}
                        className={archivingTable.archive ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
                    >
                        {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (archivingTable.archive ? 'Archive' : 'Restore')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

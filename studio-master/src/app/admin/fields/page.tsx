
"use client";

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PlusCircle, XCircle, Filter, Archive, Loader2 } from 'lucide-react';
import type { DynamicField, DynamicFieldOption } from '@/lib/types';
import { DynamicFieldType } from '@/lib/types';
import { getDynamicFields, addDynamicField, updateDynamicField, archiveDynamicField } from '@/lib/data';
import { useForm, Controller, SubmitHandler, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { DataTable } from '@/components/common/data-table';
import { getDynamicFieldColumns } from './components/columns';
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

const dynamicFieldSchema = z.object({
  name: z.string().min(1, "Name is required").regex(/^[a-zA-Z0-9_]+$/, "Name can only contain letters, numbers, and underscores (no spaces)."),
  label: z.string().min(1, "Label is required"),
  type: z.nativeEnum(DynamicFieldType),
  category: z.string().optional(),
  isRequired: z.boolean().default(false),
  defaultValue: z.string().optional(),
  options: z.array(z.object({
    value: z.string().min(1, "Option value is required"),
    label: z.string().min(1, "Option label is required"),
  })).optional(),
}).superRefine((data, ctx) => {
  if (
    (data.type === DynamicFieldType.DROPDOWN_LIST || data.type === DynamicFieldType.CHECKBOX_GROUP || data.type === DynamicFieldType.RADIO_BUTTON_GROUP) &&
    (!data.options || data.options.length === 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one option is required for this field type.",
      path: ["options"],
    });
  }
});

type DynamicFieldFormData = z.infer<typeof dynamicFieldSchema>;

const ALL_CATEGORIES_VALUE = "__ALL_CATEGORIES__";

export default function DynamicFieldsPage() {
  const [allDbFields, setAllDbFields] = useState<DynamicField[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<DynamicField | null>(null);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"current" | "archived">("current");
  const [archivingField, setArchivingField] = useState<{id: string, archive: boolean, name: string} | null>(null);

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>(ALL_CATEGORIES_VALUE);

  const form = useForm<DynamicFieldFormData>({
    resolver: zodResolver(dynamicFieldSchema),
    defaultValues: {
      isRequired: false,
      options: [],
      category: '',
    },
  });

  const { fields: optionFields, append: appendOption, remove: removeOption } = useFieldArray({
    control: form.control,
    name: "options",
  });

  const selectedFieldType = form.watch("type");

  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    allDbFields.forEach(field => {
      if (field.category && field.category.trim() !== '') {
        categories.add(field.category.trim());
      }
    });
    return Array.from(categories).sort();
  }, [allDbFields]);

  const currentFields = useMemo(() => {
    const filtered = allDbFields.filter(field => !field.isArchived);
    if (selectedCategoryFilter === ALL_CATEGORIES_VALUE) return filtered;
    return filtered.filter(field => field.category === selectedCategoryFilter);
  }, [allDbFields, selectedCategoryFilter]);

  const archivedFields = useMemo(() => {
    const filtered = allDbFields.filter(field => field.isArchived);
     if (selectedCategoryFilter === ALL_CATEGORIES_VALUE) return filtered;
    return filtered.filter(field => field.category === selectedCategoryFilter);
  }, [allDbFields, selectedCategoryFilter]);


  useEffect(() => {
    async function loadFields() {
      setIsLoading(true);
      try {
        const data = await getDynamicFields();
        setAllDbFields([...data]);
      } catch (error) {
        toast({ title: "Error", description: "Could not load dynamic fields.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
    loadFields();
  }, [toast]);

  const handleAddNew = () => {
    setEditingField(null);
    form.reset({ name: '', label: '', type: DynamicFieldType.TEXT_INPUT, category: '', isRequired: false, defaultValue: '', options: [] });
    while (optionFields.length > 0) {
      removeOption(0);
    }
    setIsDialogOpen(true);
  };

  const handleEdit = (field: DynamicField) => {
    setEditingField(field);
    form.reset({
      name: field.name,
      label: field.label,
      type: field.type,
      category: field.category || '',
      isRequired: field.isRequired,
      defaultValue: String(field.defaultValue || ''),
      options: field.options || [],
    });
    while (optionFields.length > 0) {
        removeOption(0);
    }
    (field.options || []).forEach(opt => appendOption(opt));
    setIsDialogOpen(true);
  };

  const confirmArchiveToggle = (fieldId: string, shouldArchive: boolean) => {
    const field = allDbFields.find(f => f.id === fieldId);
    if (field) {
        setArchivingField({id: fieldId, archive: shouldArchive, name: field.label});
    }
  };

  const handleArchiveToggleAction = async () => {
    if (!archivingField) return;
    const { id, archive, name } = archivingField;
    try {
      const updatedField = await archiveDynamicField(id, archive);
      setAllDbFields(prevFields => prevFields.map(f => f.id === id ? updatedField : f));
      toast({ title: `Field ${archive ? 'Archived' : 'Restored'}`, description: `The dynamic field "${name}" has been ${archive ? 'archived' : 'restored'}.` });
    } catch (error) {
      toast({ title: "Error", description: `Could not ${archive ? 'archive' : 'restore'} dynamic field.`, variant: "destructive" });
    } finally {
      setArchivingField(null);
    }
  };

  const columnsCurrent = useMemo(() => getDynamicFieldColumns(handleEdit, confirmArchiveToggle, "current"), [allDbFields]);
  const columnsArchived = useMemo(() => getDynamicFieldColumns(handleEdit, confirmArchiveToggle, "archived"), [allDbFields]);


  const onSubmit: SubmitHandler<DynamicFieldFormData> = async (data) => {
    try {
      const fieldDataToSave: Partial<Omit<DynamicField, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>> = {
        name: data.name,
        label: data.label,
        type: data.type,
        category: data.category,
        isRequired: data.isRequired,
        defaultValue: data.defaultValue,
        options: data.options,
      };

      if (data.type !== DynamicFieldType.DROPDOWN_LIST &&
          data.type !== DynamicFieldType.CHECKBOX_GROUP &&
          data.type !== DynamicFieldType.RADIO_BUTTON_GROUP) {
        fieldDataToSave.options = undefined;
      }

      if (editingField) {
        const updatedFieldFromDb = await updateDynamicField(editingField.id, fieldDataToSave);
        setAllDbFields(prevFields => prevFields.map(f => f.id === editingField.id ? updatedFieldFromDb : f));
        toast({ title: "Field Updated", description: "The dynamic field has been updated." });
      } else {
        const newField = await addDynamicField(fieldDataToSave as Omit<DynamicField, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>);
        setAllDbFields(prevFields => [...prevFields, newField].sort((a,b) => a.label.localeCompare(b.label)));
        toast({ title: "Field Created", description: "New dynamic field has been created." });
      }
      setIsDialogOpen(false);
      form.reset();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not save field.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const showOptionsManagement = selectedFieldType === DynamicFieldType.DROPDOWN_LIST ||
                                selectedFieldType === DynamicFieldType.CHECKBOX_GROUP ||
                                selectedFieldType === DynamicFieldType.RADIO_BUTTON_GROUP;

  return (
    <>
      <PageHeader
        title="Dynamic Fields"
        description="Manage custom fields for your dynamic tables."
        actionButtonText={activeTab === "current" ? "Add New Field" : undefined}
        onActionButtonClick={activeTab === "current" ? handleAddNew : undefined}
      />

        <div className="flex items-center justify-between mb-4">
          {availableCategories.length > 0 && (
              <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <Label htmlFor="category-filter" className="text-sm font-medium">Filter by Category:</Label>
              <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                  <SelectTrigger id="category-filter" className="w-auto min-w-[200px] h-10">
                  <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                  <SelectItem value={ALL_CATEGORIES_VALUE}>All Categories</SelectItem>
                  {availableCategories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                  </SelectContent>
              </Select>
              </div>
          )}
           <div className={availableCategories.length === 0 ? "w-full" : ""}> {/* Placeholder or other controls */}
          </div>
        </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "current" | "archived")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px] mb-4">
          <TabsTrigger value="current">Current Fields</TabsTrigger>
          <TabsTrigger value="archived">Archived Fields</TabsTrigger>
        </TabsList>
        <TabsContent value="current">
          {isLoading && currentFields.length === 0 && allDbFields.length > 0 ? (
            <div className="text-center h-24 flex items-center justify-center">Loading current fields...</div>
          ) : (
            <DataTable columns={columnsCurrent} data={currentFields} searchPlaceholder="Search current fields..." />
          )}
        </TabsContent>
        <TabsContent value="archived">
           {isLoading && archivedFields.length === 0 && allDbFields.length > 0 ? (
            <div className="text-center h-24 flex items-center justify-center">Loading archived fields...</div>
           ) : (
            <DataTable columns={columnsArchived} data={archivedFields} searchPlaceholder="Search archived fields..." />
           )}
        </TabsContent>
      </Tabs>


      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingField ? 'Edit' : 'Create'} Dynamic Field</DialogTitle>
            <DialogDescription>
              {editingField ? 'Update the details of your dynamic field.' : 'Define a new dynamic field for your forms.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="label">Field Label</Label>
              <Input id="label" {...form.register("label")} placeholder="e.g., Customer Name" />
              {form.formState.errors.label && <p className="text-sm text-destructive">{form.formState.errors.label.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Field Name (ID)</Label>
              <Input id="name" {...form.register("name")} placeholder="e.g., customerName" />
              <p className="text-xs text-muted-foreground">No spaces or special characters, use underscores if needed.</p>
              {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category (Optional)</Label>
              <Input id="category" {...form.register("category")} placeholder="e.g., Customer Details, Product Info" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Field Type</Label>
              <Controller
                name="type"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={(value) => {
                        field.onChange(value);
                        if (value !== DynamicFieldType.DROPDOWN_LIST && value !== DynamicFieldType.CHECKBOX_GROUP && value !== DynamicFieldType.RADIO_BUTTON_GROUP) {
                            form.setValue('options', []);
                            while(optionFields.length > 0) {
                                removeOption(0);
                            }
                        } else if (form.getValues('options')?.length === 0) {
                            appendOption({ value: '', label: '' });
                        }
                    }} defaultValue={field.value}>
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select field type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(DynamicFieldType).map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
               {form.formState.errors.type && <p className="text-sm text-destructive">{form.formState.errors.type.message}</p>}
            </div>

            {showOptionsManagement && (
              <div className="grid gap-3 p-3 border rounded-md">
                <div className="flex justify-between items-center">
                    <Label>Options</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => appendOption({ value: '', label: '' })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Option
                    </Button>
                </div>
                {optionFields.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center p-2 border rounded">
                    <div className="grid gap-1">
                        <Label htmlFor={`options.${index}.value`} className="text-xs">Value</Label>
                        <Input
                        id={`options.${index}.value`}
                        placeholder="Option Value"
                        {...form.register(`options.${index}.value`)}
                        />
                        {form.formState.errors.options?.[index]?.value && (
                        <p className="text-xs text-destructive">{form.formState.errors.options[index]?.value?.message}</p>
                        )}
                    </div>
                    <div className="grid gap-1">
                        <Label htmlFor={`options.${index}.label`} className="text-xs">Label</Label>
                        <Input
                        id={`options.${index}.label`}
                        placeholder="Option Label"
                        {...form.register(`options.${index}.label`)}
                        />
                        {form.formState.errors.options?.[index]?.label && (
                        <p className="text-xs text-destructive">{form.formState.errors.options[index]?.label?.message}</p>
                        )}
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(index)} className="self-end text-destructive hover:text-destructive/80">
                        <XCircle className="h-5 w-5" />
                        <span className="sr-only">Remove option</span>
                    </Button>
                  </div>
                ))}
                {optionFields.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No options added yet. Click "Add Option" to begin.</p>}
                {form.formState.errors.options && typeof form.formState.errors.options === 'object' && !Array.isArray(form.formState.errors.options) && (
                    <p className="text-sm text-destructive">{ (form.formState.errors.options as any as {message: string})?.message}</p>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="defaultValue">Default Value (Optional)</Label>
              <Input id="defaultValue" {...form.register("defaultValue")} />
              <p className="text-xs text-muted-foreground">For Checkbox Group, use comma-separated values if pre-selecting multiple. For Boolean/Toggle, use 'true' or 'false'.</p>
            </div>

            <div className="flex items-center space-x-2">
              <Controller
                name="isRequired"
                control={form.control}
                render={({ field }) => (
                    <Checkbox id="isRequired" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="isRequired" className="text-sm font-normal">
                This field is required
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Field'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!archivingField} onOpenChange={(open) => !open && setArchivingField(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will {archivingField?.archive ? 'archive' : 'restore'} the field "{archivingField?.name}".
              {archivingField?.archive ? ' Archived fields cannot be used in new table definitions but will remain in existing ones.' : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setArchivingField(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveToggleAction}
              className={archivingField?.archive ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
            >
              {archivingField?.archive ? 'Archive' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


"use client";

import { useMemo, useEffect, useState } from 'react';
import { useForm, Controller, FormProvider, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DynamicTable, DynamicField, DynamicFieldOption } from '@/lib/types';
import { DynamicFieldType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2 } from 'lucide-react';
import { getFileDownloadURL } from '@/lib/data';

// Define a generic schema builder for dynamic data
const createDynamicDataSchema = (fields: DynamicField[]) => {
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
        fieldSchema = z.any().nullable(); // Can be File, string (storage path), or null
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


type DynamicDataFormData = z.infer<ReturnType<typeof createDynamicDataSchema>>;

interface DynamicTableEntryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  table: DynamicTable | null;
  fields: DynamicField[];
  initialData?: Record<string, any> | null; // This will contain storage paths for files
  onSubmit: SubmitHandler<DynamicDataFormData>;
  isEditing: boolean;
}

export function DynamicTableEntryDialog({
  isOpen,
  onOpenChange,
  table,
  fields,
  initialData,
  onSubmit,
  isEditing,
}: DynamicTableEntryDialogProps) {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});
  
  const dynamicSchema = useMemo(() => createDynamicDataSchema(fields), [fields]);

  const methods = useForm<DynamicDataFormData>({
    resolver: zodResolver(dynamicSchema),
  });

  useEffect(() => {
    if (table && fields.length > 0) {
      const defaultValues: Record<string, any> = { ...initialData }; // initialData has storage paths
      fields.forEach(field => {
        if (defaultValues[field.name] === undefined) {
          if (field.type === DynamicFieldType.BOOLEAN_TOGGLE) {
             defaultValues[field.name] = field.defaultValue ?? false;
          } else if (field.type === DynamicFieldType.CHECKBOX_GROUP) {
             defaultValues[field.name] = field.defaultValue ?? [];
          } else if (field.type === DynamicFieldType.DOCUMENT_UPLOAD) {
            defaultValues[field.name] = null; // Start with null for file inputs
          } else {
             defaultValues[field.name] = field.defaultValue ?? (field.type === DynamicFieldType.NUMBER ? null : '');
          }
        }
        // If initialData has a value (e.g. storage path for file), it will be used.
        // The form input for file will not display this path directly.
      });
      methods.reset(defaultValues);
    }
  }, [isOpen, table, fields, initialData, methods]);

  const handleDownload = async (storagePath: string, fieldName: string) => {
    if (!storagePath) {
      toast({ title: "Download Error", description: "No file path specified.", variant: "destructive" });
      return;
    }
    setIsDownloading(prev => ({ ...prev, [fieldName]: true }));
    try {
      const downloadURL = await getFileDownloadURL(storagePath);
      // Create a temporary link and click it to trigger download
      const link = document.createElement('a');
      link.href = downloadURL;
      const filename = storagePath.split('/').pop();
      if (filename) link.setAttribute('download', filename);
      // For some browsers, link needs to be added to DOM
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link); // Clean up
      toast({ title: "Download Started", description: `Downloading ${filename || 'file'}...` });
    } catch (error: any) {
      toast({ title: "Download Failed", description: error.message || "Could not get download URL.", variant: "destructive" });
    } finally {
      setIsDownloading(prev => ({ ...prev, [fieldName]: false }));
    }
  };


  const renderFormFieldController = (field: DynamicField) => {
    const fieldKey = `${table?.id || 'new'}-${field.id}`;
    const currentFieldValue = methods.watch(field.name as any); // storage path or File object

    return (
      <Controller
        key={fieldKey}
        name={field.name as any}
        control={methods.control}
        render={({ field: controlledField, fieldState: { error } }) => {
          return (
            <div className="mb-4">
              <Label htmlFor={fieldKey} className="mb-1 block">{field.label}{field.isRequired && <span className="text-destructive ml-1">*</span>}</Label>
              {(() => {
                switch (field.type) {
                  case DynamicFieldType.TEXT_INPUT:
                    return <Input {...controlledField} id={fieldKey} type="text" placeholder={field.label} value={controlledField.value ?? ''} />;
                  case DynamicFieldType.TEXT_AREA:
                    return <Textarea {...controlledField} id={fieldKey} placeholder={field.label} value={controlledField.value ?? ''} />;
                  case DynamicFieldType.NUMBER:
                    return <Input {...controlledField} id={fieldKey} type="number" placeholder={field.label} value={controlledField.value ?? ''} onChange={e => controlledField.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} />;
                  case DynamicFieldType.DATE:
                    return <Input {...controlledField} id={fieldKey} type="date" value={controlledField.value ?? ''}/>;
                  case DynamicFieldType.TIME:
                    return <Input {...controlledField} id={fieldKey} type="time" value={controlledField.value ?? ''}/>;
                  case DynamicFieldType.DATETIME:
                    return <Input {...controlledField} id={fieldKey} type="datetime-local" value={controlledField.value ?? ''}/>;
                  case DynamicFieldType.DOCUMENT_UPLOAD: {
                    // Do not pass controlledField.value to Input type="file"
                    const { value: RHFValueDoNotUseForFile, ...rhfRest } = controlledField; 
                    return (
                      <div className="space-y-2">
                        <Input
                          // Do NOT pass `value` prop to file input
                          id={fieldKey}
                          type="file"
                          name={rhfRest.name}
                          onBlur={rhfRest.onBlur}
                          ref={rhfRest.ref}
                          onChange={e => {
                            const files = (e.target as HTMLInputElement).files;
                            controlledField.onChange(files && files.length > 0 ? files[0] : null);
                          }}
                        />
                        {/* Display current file info based on `currentFieldValue` from watch() */}
                        {currentFieldValue && (
                          <div className="flex items-center justify-between p-2 border rounded-md bg-muted/50 text-sm">
                            <p className="text-muted-foreground truncate">
                              {typeof currentFieldValue === 'string'
                                ? `Current: ${currentFieldValue.split(/[\\/]/).pop()}` // Existing file path
                                : currentFieldValue instanceof File
                                  ? `Selected: ${currentFieldValue.name}` // New file selected
                                  : 'No file selected/uploaded.'}
                            </p>
                            {typeof currentFieldValue === 'string' && currentFieldValue && (
                               <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(currentFieldValue, field.name)}
                                disabled={isDownloading[field.name]}
                                className="flex-shrink-0"
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
                      <Select onValueChange={controlledField.onChange} value={String(controlledField.value ?? '')} disabled={controlledField.disabled}>
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
                              disabled={controlledField.disabled}
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
                      <RadioGroup onValueChange={controlledField.onChange} value={String(controlledField.value ?? '')} disabled={controlledField.disabled}>
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
                        <Checkbox id={fieldKey} checked={Boolean(controlledField.value)} onCheckedChange={controlledField.onChange} disabled={controlledField.disabled}/>
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

  const handleDialogSubmit: SubmitHandler<DynamicDataFormData> = (data) => {
    // The `data` here will have File objects for new uploads, or storage paths for existing files not changed.
    // The actual file upload and path replacement will happen in the data.ts functions.
    onSubmit(data);
  };


  if (!table) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh]">
        <ScrollArea className="max-h-[80vh] p-1">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>{isEditing ? 'Edit' : 'Add New'} Entry in {table.label}</DialogTitle>
            <DialogDescription>
              {isEditing ? `Update the details for this entry.` : `Fill in the data for a new entry.`}
            </DialogDescription>
          </DialogHeader>
          <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(handleDialogSubmit)} className="grid gap-4 py-4 px-6">
              {fields.map(field => renderFormFieldController(field))}
              <DialogFooter className="mt-4 sticky bottom-0 bg-background py-4 px-6 border-t -mx-6">
                <Button type="button" variant="outline" onClick={() => { methods.reset(); onOpenChange(false); }}>Cancel</Button>
                <Button type="submit" disabled={methods.formState.isSubmitting}>
                  {methods.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isEditing ? 'Save Changes' : 'Add Entry')}
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}


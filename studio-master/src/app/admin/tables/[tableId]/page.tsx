
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/common/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Loader2, ArrowLeft, Database, Info, Download, ArrowUpDown, Archive, ArchiveRestore } from 'lucide-react';
import type { DynamicTable, DynamicField, DynamicTableRowData } from '@/lib/types';
import { DynamicFieldType } from '@/lib/types';
import { 
  getDynamicTableById, 
  getDynamicFields, 
  getDynamicTableEntries,
  addDynamicTableEntry, 
  updateDynamicTableEntry, 
  archiveDynamicTableEntry,
  getFileDownloadURL,
  getDisplayValueForRow
} from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { DynamicTableEntryDialog } from './components/dynamic-table-entry-dialog';
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


export default function DynamicTableDataPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const tableId = params.tableId as string;

  const [dynamicTable, setDynamicTable] = useState<DynamicTable | null>(null);
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [allEntries, setAllEntries] = useState<DynamicTableRowData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DynamicTableRowData | null>(null);
  const [entryActionTarget, setEntryActionTarget] = useState<{id: string, archive: boolean, name: string} | null>(null);
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"current" | "archived">("current");

  useEffect(() => {
    if (tableId) {
      async function loadData() {
        setIsLoading(true);
        try {
          const [tableData, allFieldsData, entriesData] = await Promise.all([
            getDynamicTableById(tableId),
            getDynamicFields(),
            getDynamicTableEntries(tableId), // Fetches all entries, including archived
          ]);

          if (!tableData) {
            toast({ title: "Error", description: "Dynamic table definition not found.", variant: "destructive" });
            setDynamicTable(null);
            setFields([]);
            setAllEntries([]);
            setIsLoading(false);
            return;
          }
          
          setDynamicTable(tableData);
          // Filter out archived fields from being used in the table, but keep their data if already present.
          const activeFields = allFieldsData.filter(f => tableData.fieldIds.includes(f.id) && !f.isArchived);
          const sortedActiveFields = tableData.fieldIds.map(id => activeFields.find(f => f.id === id)).filter(Boolean) as DynamicField[];
          setFields(sortedActiveFields);
          setAllEntries(entriesData.sort((a,b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()));

        } catch (error) {
          console.error("Failed to load table data:", error);
          toast({ title: "Error", description: "Could not load table data.", variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      }
      loadData();
    }
  }, [tableId, toast]);

  const currentEntries = useMemo(() => allEntries.filter(entry => !entry.isArchived), [allEntries]);
  const archivedEntries = useMemo(() => allEntries.filter(entry => entry.isArchived), [allEntries]);

  const handleDownload = async (storagePath: string, entryId: string, fieldName: string) => {
    if (!storagePath) {
      toast({ title: "Download Error", description: "No file path specified.", variant: "destructive" });
      return;
    }
    const downloadKey = `${entryId}-${fieldName}`;
    setIsDownloading(prev => ({ ...prev, [downloadKey]: true }));
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
      setIsDownloading(prev => ({ ...prev, [downloadKey]: false }));
    }
  };

  const renderCellContent = (entry: DynamicTableRowData, field: DynamicField) => {
    const value = entry.data[field.name];

    if (value === undefined || value === null || value === '') {
      return <span className="text-muted-foreground italic">N/A</span>;
    }

    switch (field.type) {
      case DynamicFieldType.BOOLEAN_TOGGLE:
        return <Checkbox checked={Boolean(value)} disabled className="ml-2" />;
      case DynamicFieldType.DATE:
      case DynamicFieldType.DATETIME:
        try {
          return format(parseISO(String(value)), field.type === DynamicFieldType.DATE ? 'MMM d, yyyy' : 'MMM d, yyyy HH:mm');
        } catch {
          return String(value); 
        }
      case DynamicFieldType.DROPDOWN_LIST:
      case DynamicFieldType.RADIO_BUTTON_GROUP:
        const selectedOption = field.options?.find(opt => opt.value === String(value));
        return selectedOption ? selectedOption.label : String(value);
      case DynamicFieldType.CHECKBOX_GROUP:
        if (Array.isArray(value)) {
          return value.map(val => {
            const option = field.options?.find(opt => opt.value === String(val));
            return <Badge key={val} variant="outline" className="mr-1 mb-1">{option ? option.label : val}</Badge>;
          }).filter(Boolean);
        }
        return String(value);
      case DynamicFieldType.DOCUMENT_UPLOAD:
        const storagePath = String(value);
        const filename = storagePath.split(/[\\/]/).pop() || 'Document';
        const downloadKey = `${entry.id}-${field.name}`;
        return (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground italic truncate" title={filename}>{filename}</span>
             <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => handleDownload(storagePath, entry.id, field.name)}
                title={`Download ${filename}`}
                disabled={isDownloading[downloadKey]}
              >
                {isDownloading[downloadKey] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
          </div>
        );
      default:
        const cellValue = String(value);
        return <span title={cellValue}>{cellValue.length > 50 ? cellValue.substring(0, 47) + '...' : cellValue}</span>;
    }
  };

  const handleAddNewEntry = () => {
    setEditingEntry(null);
    setIsDialogOpen(true);
  };

  const handleEditEntry = (entry: DynamicTableRowData) => {
    setEditingEntry(entry);
    setIsDialogOpen(true);
  };

  const confirmToggleArchiveEntry = (entry: DynamicTableRowData, shouldArchive: boolean) => {
    const displayName = getDisplayValueForRow(entry.data, fields, entry.id);
    setEntryActionTarget({ id: entry.id, archive: shouldArchive, name: displayName });
  };

  const handleToggleArchiveEntryAction = async () => {
    if (!dynamicTable || !entryActionTarget) return;
    const { id, archive, name } = entryActionTarget;
    try {
      const updatedEntry = await archiveDynamicTableEntry(dynamicTable.id, id, archive); 
      setAllEntries(prev => prev.map(e => e.id === id ? updatedEntry : e));
      toast({ title: `Entry ${archive ? 'Archived' : 'Restored'}`, description: `The entry "${name}" has been ${archive ? 'archived' : 'restored'}.` });
    } catch (error) {
      toast({ title: "Error", description: `Could not ${archive ? 'archive' : 'restore'} entry.`, variant: "destructive" });
    } finally {
      setEntryActionTarget(null);
    }
  };

  const handleDialogSubmit = async (formData: Record<string, any>) => {
    if (!dynamicTable) return;
    try {
      if (editingEntry) {
        const updatedEntry = await updateDynamicTableEntry(dynamicTable.id, editingEntry.id, formData, editingEntry.data);
        setAllEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));
        toast({ title: "Entry Updated", description: "The table entry has been updated." });
      } else {
        const newEntry = await addDynamicTableEntry(dynamicTable.id, formData);
        setAllEntries(prev => [newEntry, ...prev].sort((a,b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()));
        toast({ title: "Entry Created", description: "New table entry has been created." });
      }
      setIsDialogOpen(false);
      setEditingEntry(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not save entry.", variant: "destructive" });
    }
  };

  const columns = useMemo((): ColumnDef<DynamicTableRowData>[] => {
    if (!fields || fields.length === 0) return [];

    const dataColumns: ColumnDef<DynamicTableRowData>[] = fields.map(field => ({
      accessorFn: (row) => row.data[field.name],
      id: field.name, 
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {field.label}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => renderCellContent(row.original, field),
      enableSorting: true,
    }));

    const actionColumn: ColumnDef<DynamicTableRowData> = {
      id: "actions",
      header: () => <div className="text-right w-[100px] pr-4">Actions</div>,
      cell: ({ row }) => {
        const entry = row.original;
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEditEntry(entry)} disabled={activeTab === "archived"}>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                {activeTab === "current" ? (
                  <DropdownMenuItem onClick={() => confirmToggleArchiveEntry(entry, true)} className="text-orange-600 focus:text-orange-600 focus:bg-orange-500/10">
                    <Archive className="mr-2 h-4 w-4" /> Archive
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => confirmToggleArchiveEntry(entry, false)} className="text-green-600 focus:text-green-600 focus:bg-green-500/10">
                    <ArchiveRestore className="mr-2 h-4 w-4" /> Restore
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableSorting: false,
    };

    return [...dataColumns, actionColumn];
  }, [fields, isDownloading, activeTab, allEntries]); // Added activeTab and allEntries to deps


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading table data...</p>
      </div>
    );
  }

  if (!dynamicTable) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center">
        <Database className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Table Not Found</h2>
        <p className="text-muted-foreground mb-6">The dynamic table you are looking for does not exist or could not be loaded.</p>
        <Button onClick={() => router.push('/admin/tables')} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Table Definitions
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={dynamicTable.label}
        description={dynamicTable.description || `View and manage data for ${dynamicTable.label}.`}
        actionButtonText={activeTab === "current" ? "Add New Entry" : undefined}
        onActionButtonClick={activeTab === "current" ? handleAddNewEntry : undefined}
      />
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "current" | "archived")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px] mb-4">
          <TabsTrigger value="current">Current Entries</TabsTrigger>
          <TabsTrigger value="archived">Archived Entries</TabsTrigger>
        </TabsList>
        <TabsContent value="current">
          {isLoading && currentEntries.length === 0 && allEntries.length > 0 ? (
            <div className="text-center h-24 flex items-center justify-center">Loading current entries...</div>
          ) : (
            currentEntries.length === 0 && fields.length > 0 ? (
              <div className="text-center p-8 mt-4 text-muted-foreground flex flex-col items-center">
                <Info className="w-10 h-10 mb-2" />
                No current data entries yet for {dynamicTable.label}.
              </div>
            ) : (
              <DataTable 
                columns={columns} 
                data={currentEntries} 
                searchPlaceholder="Search current entries..." 
                enableColumnToggle={true} 
              />
            )
          )}
        </TabsContent>
        <TabsContent value="archived">
           {isLoading && archivedEntries.length === 0 && allEntries.length > 0 ? (
            <div className="text-center h-24 flex items-center justify-center">Loading archived entries...</div>
           ) : (
             archivedEntries.length === 0 && fields.length > 0 ? (
                <div className="text-center p-8 mt-4 text-muted-foreground flex flex-col items-center">
                    <Info className="w-10 h-10 mb-2" />
                    No archived data entries for {dynamicTable.label}.
                </div>
                ) : (
                <DataTable 
                    columns={columns} 
                    data={archivedEntries} 
                    searchPlaceholder="Search archived entries..." 
                    enableColumnToggle={true} 
                />
                )
           )}
        </TabsContent>
      </Tabs>

      {dynamicTable && fields.length > 0 && (
        <DynamicTableEntryDialog
          isOpen={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setEditingEntry(null); 
          }}
          table={dynamicTable}
          fields={fields} // Pass only active fields to the dialog
          initialData={editingEntry?.data}
          onSubmit={handleDialogSubmit}
          isEditing={!!editingEntry}
        />
      )}
      
      <AlertDialog open={!!entryActionTarget} onOpenChange={(open) => !open && setEntryActionTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to {entryActionTarget?.archive ? 'archive' : 'restore'} this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will {entryActionTarget?.archive ? 'archive' : 'restore'} the entry "{entryActionTarget?.name}".
              {entryActionTarget?.archive ? ' It will not delete any associated uploaded files.' : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEntryActionTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleToggleArchiveEntryAction} 
                className={entryActionTarget?.archive ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
            >
                {entryActionTarget?.archive ? 'Archive Entry' : 'Restore Entry'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
    

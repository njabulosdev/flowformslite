
"use client";

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Loader2, ServerOff } from 'lucide-react';
import type { WorkflowInstance, WorkflowTemplate } from '@/lib/types';
import { getWorkflowInstances, getWorkflowTemplates, archiveWorkflowInstance, unarchiveWorkflowInstance } from '@/lib/data';
import { parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from '@/components/common/data-table';
import { getWorkflowInstanceColumns } from './components/columns';

export default function MyWorkflowsPage() {
  const [allWorkflowInstances, setAllWorkflowInstances] = useState<WorkflowInstance[]>([]);
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"current" | "archived">("current");
  const { toast } = useToast();

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [instances, templates] = await Promise.all([
          getWorkflowInstances(),
          getWorkflowTemplates()
        ]);
        setAllWorkflowInstances(instances.sort((a, b) => parseISO(b.startDatetime).getTime() - parseISO(a.startDatetime).getTime()));
        setWorkflowTemplates(templates);
      } catch (error) {
        toast({ title: "Error", description: "Could not fetch workflow data.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [toast]);

  const handleArchiveToggle = async (instanceId: string, shouldArchive: boolean) => {
    try {
      const action = shouldArchive ? archiveWorkflowInstance : unarchiveWorkflowInstance;
      const updatedInstance = await action(instanceId);
      if (updatedInstance) {
        setAllWorkflowInstances(prevInstances =>
          prevInstances.map(inst => inst.id === instanceId ? updatedInstance : inst)
        );
        toast({ title: `Workflow ${shouldArchive ? 'Archived' : 'Restored'}`, description: `Workflow "${updatedInstance.name}" has been ${shouldArchive ? 'archived' : 'restored'}.` });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `Could not ${shouldArchive ? 'archive' : 'unarchive'} workflow.`;
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const getWorkflowTemplateName = (templateId: string): string => {
    if (isLoading) return 'Loading...'; // Or check a specific loading flag for templates if needed
    return workflowTemplates.find(t => t.id === templateId)?.name || 'Unknown Template';
  };

  const currentInstances = useMemo(() => {
    return allWorkflowInstances.filter(inst => !inst.isArchived);
  }, [allWorkflowInstances]);

  const archivedInstances = useMemo(() => {
    return allWorkflowInstances.filter(inst => inst.isArchived);
  }, [allWorkflowInstances]);
  
  const columnsCurrent = useMemo(() => getWorkflowInstanceColumns(getWorkflowTemplateName, handleArchiveToggle, "current"), [workflowTemplates, isLoading]);
  const columnsArchived = useMemo(() => getWorkflowInstanceColumns(getWorkflowTemplateName, handleArchiveToggle, "archived"), [workflowTemplates, isLoading]);

  if (isLoading && allWorkflowInstances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading your workflows...</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="My Workflows"
        description="View and manage your ongoing, completed, and archived workflow instances."
        actionButtonText="Create New Workflow"
        onActionButtonClick={() => router.push('/workflows/new')}
      />
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "current" | "archived")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px] mb-4">
          <TabsTrigger value="current">Current Workflows</TabsTrigger>
          <TabsTrigger value="archived">Archived Workflows</TabsTrigger>
        </TabsList>
        <TabsContent value="current">
          {isLoading && currentInstances.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border shadow-sm p-12 text-center">
              <Loader2 className="text-muted-foreground mb-6 h-16 w-16 animate-spin" />
              <p className="text-muted-foreground">Loading current workflows...</p>
            </div>
          ) : currentInstances.length === 0 ? (
             <div className="flex flex-col items-center justify-center rounded-lg border shadow-sm p-12 text-center">
                <ServerOff className="text-muted-foreground mb-6 h-16 w-16" />
                <h3 className="text-xl font-semibold mb-2">No Current Workflows</h3>
                <p className="text-muted-foreground">You have no active or completed workflows.</p>
             </div>
          ) : (
            <DataTable columns={columnsCurrent} data={currentInstances} searchPlaceholder="Search current workflows..." />
          )}
        </TabsContent>
        <TabsContent value="archived">
           {isLoading && archivedInstances.length === 0 ? (
             <div className="flex flex-col items-center justify-center rounded-lg border shadow-sm p-12 text-center">
                <Loader2 className="text-muted-foreground mb-6 h-16 w-16 animate-spin" />
                <p className="text-muted-foreground">Loading archived workflows...</p>
             </div>
          ) : archivedInstances.length === 0 ? (
             <div className="flex flex-col items-center justify-center rounded-lg border shadow-sm p-12 text-center">
                <ServerOff className="text-muted-foreground mb-6 h-16 w-16" />
                <h3 className="text-xl font-semibold mb-2">No Archived Workflows</h3>
                <p className="text-muted-foreground">There are no archived workflows.</p>
             </div>
          ) : (
            <DataTable columns={columnsArchived} data={archivedInstances} searchPlaceholder="Search archived workflows..." />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

// Add router import if not already present
import { useRouter } from 'next/navigation';

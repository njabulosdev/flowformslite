
"use client";

import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FileText, Table2, ClipboardList, Workflow, Settings, Database, ListChecks, Users, Palette } from 'lucide-react';

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Help & Documentation"
        description="Understand how FlowForm works and how to use its features."
      />

      <Card className="mb-6 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Palette className="mr-3 h-7 w-7 text-primary" />
            Welcome to FlowForm!
          </CardTitle>
          <CardDescription>
            FlowForm is a dynamic workflow management system designed to help you automate and streamline your processes.
            This guide provides an overview of its core components and functionalities.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            The system is built around creating flexible data structures (Dynamic Fields and Tables) and defining sequences of work (Task and Workflow Templates).
            You can then launch instances of these workflows, assign tasks, and manage data effectively.
          </p>
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="w-full space-y-4">
        <AccordionItem value="core-concepts" className="border bg-card rounded-lg shadow-sm">
          <AccordionTrigger className="hover:no-underline px-4 py-3 text-lg font-medium">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-primary" />
              Core Concepts
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 py-3 border-t">
            <ul className="list-disc space-y-3 pl-5 text-muted-foreground">
              <li>
                <strong>Dynamic Fields:</strong> These are the basic building blocks for your data forms. You can define various types of fields like text inputs, number inputs, date pickers, document uploads, dropdowns, etc. Each field has a label, a unique name (ID), a type, and can be marked as required. You can also assign categories to fields for better organization.
              </li>
              <li>
                <strong>Dynamic Table Definitions:</strong> These define the structure for custom data tables. You create a table definition by selecting an ordered list of Dynamic Fields. This allows you to create schemas for collecting specific sets of information, like "Customer Profiles" or "Product Details".
              </li>
              <li>
                <strong>Task Templates:</strong> These represent reusable units of work. A task template defines what needs to be done (e.g., "Verify Customer ID"), who might do it (Assigned Role Type), an optional category, an optional due date offset, and can be linked to a Dynamic Table for data entry or review.
              </li>
              <li>
                <strong>Workflow Templates:</strong> These define a sequence of Task Templates to create a complete process. For example, a "New Customer Onboarding" workflow might consist of tasks like "Collect Customer Information", "Verify ID", and "Send Welcome Email".
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="using-the-system" className="border bg-card rounded-lg shadow-sm">
          <AccordionTrigger className="hover:no-underline px-4 py-3 text-lg font-medium">
             <div className="flex items-center gap-3">
                <Workflow className="h-5 w-5 text-primary" />
                Using the System
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 py-3 border-t">
             <dl className="space-y-4 text-muted-foreground">
                <div>
                    <dt className="font-semibold text-card-foreground flex items-center"><Workflow className="mr-2 h-4 w-4"/>Creating Workflow Instances:</dt>
                    <dd className="pl-6">Navigate to "Create Workflow". Select a Workflow Template, give your instance a name. If the template's tasks are associated with Dynamic Tables, you can link specific data entries from those tables. You'll also assign users to each task defined in the template.</dd>
                </div>
                <div>
                    <dt className="font-semibold text-card-foreground flex items-center"><ListChecks className="mr-2 h-4 w-4"/>Managing Your Tasks ("My Tasks"):</dt>
                    <dd className="pl-6">The "My Tasks" page lists all tasks assigned to you. You can view task details, fill in required data if a Dynamic Table is associated, and mark tasks as complete. The system tracks start, due, and completion dates.</dd>
                </div>
                <div>
                    <dt className="font-semibold text-card-foreground flex items-center"><Database className="mr-2 h-4 w-4"/>Managing Dynamic Table Data:</dt>
                    <dd className="pl-6">Under Admin Configuration {'>'} Dynamic Tables {'>'} Definitions, you can create and manage your table structures. Clicking on a table definition's name in the list will take you to a view where you can add, edit, or delete data entries for that table.</dd>
                </div>
             </dl>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="admin-configuration" className="border bg-card rounded-lg shadow-sm">
          <AccordionTrigger className="hover:no-underline px-4 py-3 text-lg font-medium">
             <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-primary" />
                Admin Configuration
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 py-3 border-t">
            <p className="mb-3 text-muted-foreground">Administrators have access to additional sections to configure the system:</p>
            <ul className="list-disc space-y-3 pl-5 text-muted-foreground">
                <li>
                    <strong className="text-card-foreground flex items-center"><FileText className="mr-2 h-4 w-4"/>Dynamic Fields:</strong> Manage individual field types, validation rules, categories, and options (for dropdowns, etc.). Use categories to organize fields, which helps when creating Table Definitions or Task Templates.
                </li>
                <li>
                    <strong className="text-card-foreground flex items-center"><ClipboardList className="mr-2 h-4 w-4"/>Task Templates:</strong> Create and manage reusable task definitions. Assign categories for easier filtering when building Workflow Templates.
                </li>
                <li>
                    <strong className="text-card-foreground flex items-center"><Workflow className="mr-2 h-4 w-4"/>Workflow Templates:</strong> Define standard processes by sequencing Task Templates.
                </li>
                <li>
                    <strong className="text-card-foreground flex items-center"><Users className="mr-2 h-4 w-4"/>User Management:</strong> Manage user accounts and their roles (Administrator, Task Executor, Standard User).
                </li>
                 <li>
                    <strong className="text-card-foreground flex items-center"><Table2 className="mr-2 h-4 w-4"/>Dynamic Table Definitions:</strong> Define custom data structures by selecting and ordering Dynamic Fields. Use categories on fields to filter them when adding to a table.
                </li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

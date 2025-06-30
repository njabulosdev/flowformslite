
"use client";
import React, { useEffect, useState } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import {
  LayoutDashboard,
  FileText,
  Table2,
  ClipboardList,
  Workflow,
  PlusCircle,
  Settings,
  Users,
  Palette,
  Database,
  ListChecks, 
  ClipboardCheck,
  HelpCircle, // Added HelpCircle icon
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DynamicTable } from '@/lib/types';
import { subscribeToDynamicTables } from '@/lib/data';
import { useAuth } from '@/context/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { FullPageLoader } from '@/components/common/full-page-loader';
import { useToast } from '@/hooks/use-toast';


interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLogo = () => (
  <div className="flex items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center">
    <Palette className="h-7 w-7 text-primary group-data-[collapsible=icon]:h-6 group-data-[collapsible=icon]:w-6 transition-all" />
    <h1 className="text-xl font-bold text-primary group-data-[collapsible=icon]:hidden">
      FlowForm
    </h1>
  </div>
);

export default function AppLayout({ children }: AppLayoutProps) {
  const [dynamicTablesForMenu, setDynamicTablesForMenu] = useState<DynamicTable[]>([]);
  const [isLoadingMenuTables, setIsLoadingMenuTables] = useState(true);
  
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading) {
      if (!user && pathname !== '/login') {
        router.replace('/login');
      } else if (user && pathname === '/login') {
        router.replace('/');
      }
    }
  }, [user, authLoading, router, pathname]);
  
  useEffect(() => {
    let unsubscribe = () => {};
    if (user && !authLoading) {
      setIsLoadingMenuTables(true);
      unsubscribe = subscribeToDynamicTables(
        (tables) => {
          setDynamicTablesForMenu(tables);
          setIsLoadingMenuTables(false);
        },
        (error) => {
          console.error("Failed to subscribe to dynamic tables for menu:", error);
          toast({
            title: "Error",
            description: "Could not load dynamic tables for the menu.",
            variant: "destructive",
          });
          setIsLoadingMenuTables(false);
        }
      );
    } else if (!user && !authLoading) {
      setDynamicTablesForMenu([]);
      setIsLoadingMenuTables(false);
    }
    return () => unsubscribe();
  }, [user, authLoading, toast]);


  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      toast({ title: "Logout Failed", description: "Could not log out. Please try again.", variant: "destructive" });
    }
  };

  if (authLoading) {
    return <FullPageLoader />;
  }

  if (!user && pathname === '/login') {
      return <>{children}</>;
  }
  
  if (!user && pathname !== '/login') {
    return <FullPageLoader />; 
  }
  
  const isAdmin = userProfile?.role === 'Administrator';

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" variant="sidebar" className="border-r">
        <SidebarHeader className="p-2 flex justify-between items-center h-14">
          <AppLogo />
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/" legacyBehavior passHref>
                <SidebarMenuButton tooltip="Dashboard">
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
              <Link href="/tasks" legacyBehavior passHref>
                <SidebarMenuButton tooltip="My Tasks">
                  <ListChecks />
                  <span>My Tasks</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/workflows/new" legacyBehavior passHref>
                <SidebarMenuButton tooltip="Create Workflow">
                  <PlusCircle />
                  <span>Create Workflow</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
              <Link href="/workflows" legacyBehavior passHref>
                <SidebarMenuButton tooltip="My Workflows">
                  <Workflow />
                  <span>My Workflows</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
              <Link href="/help" legacyBehavior passHref>
                <SidebarMenuButton tooltip="Help">
                  <HelpCircle />
                  <span>Help</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>

          {isAdmin && (
            <>
              <SidebarSeparator className="my-4" />
              <SidebarGroup>
                <SidebarGroupLabel className="flex items-center gap-2">
                  <Settings size={16} />
                  Admin Configuration
                </SidebarGroupLabel>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <Link href="/admin/fields" legacyBehavior passHref>
                      <SidebarMenuButton tooltip="Dynamic Fields">
                        <FileText />
                        <span>Dynamic Fields</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <Link href="/admin/task-templates" legacyBehavior passHref>
                      <SidebarMenuButton tooltip="Task Templates">
                        <ClipboardList />
                        <span>Task Templates</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <Link href="/admin/workflow-templates" legacyBehavior passHref>
                      <SidebarMenuButton tooltip="Workflow Templates">
                        <Workflow />
                        <span>Workflow Templates</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <Link href="/admin/users" legacyBehavior passHref>
                      <SidebarMenuButton tooltip="User Management">
                        <Users />
                        <span>Users</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
              
              <SidebarGroup>
                <SidebarGroupLabel className="px-2 pt-2">Dynamic Tables</SidebarGroupLabel>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <Link href="/admin/tables" legacyBehavior passHref>
                      <SidebarMenuButton tooltip="Manage Table Definitions">
                        <ClipboardCheck /> 
                        <span>Definitions</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                  {isLoadingMenuTables && (
                    <SidebarMenuItem>
                      <SidebarMenuButton disabled tooltip="Loading tables...">
                        <Loader2 className="animate-spin" />
                        <span>Loading tables...</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {!isLoadingMenuTables && dynamicTablesForMenu.map(table => (
                    <SidebarMenuItem key={table.id}>
                      <Link href={`/admin/tables/${table.id}`} legacyBehavior passHref>
                        <SidebarMenuButton tooltip={`View data for ${table.label}`}>
                          <Database /> 
                          <span>{table.label}</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            </>
          )}

        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter className="p-2 flex items-center justify-between">
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden flex-shrink min-w-0">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.photoURL || "https://placehold.co/40x40.png"} alt={userProfile?.username || user?.email || "User"} data-ai-hint="user avatar"/>
                    <AvatarFallback>{userProfile?.username ? userProfile.username.substring(0,1).toUpperCase() : user?.email ? user.email.substring(0, 1).toUpperCase() : 'U'}</AvatarFallback>
                </Avatar>
                <div className="text-sm overflow-hidden">
                    <p className="font-semibold truncate">{userProfile?.username || user?.displayName || user?.email}</p>
                    {(userProfile?.username || user?.displayName) && user?.email && <p className="text-xs text-sidebar-foreground/70 truncate">{user.email}</p>}
                </div>
            </div>
             <div className="flex-shrink-0">
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:rounded-md">
                          <Settings />
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="end" className="w-56">
                      <DropdownMenuLabel>My Account</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled>Profile (soon)</DropdownMenuItem>
                      <DropdownMenuItem disabled>Settings (soon)</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
                  </DropdownMenuContent>
              </DropdownMenu>
            </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6 justify-between">
            <SidebarTrigger className="md:hidden" />
            <div className="flex items-center gap-2 md:hidden">
                <Palette className="h-6 w-6 text-primary" />
                <h1 className="text-lg font-bold text-primary">FlowForm</h1>
            </div>
            <div className="ml-auto">
              {/* Add any header actions here, e.g. notifications, search */}
            </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
            {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

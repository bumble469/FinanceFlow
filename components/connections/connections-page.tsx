"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UsersRound, UserPlus } from "lucide-react";

import { OneToOneTab } from "./components/OneToOneTab";
import { GroupsTab } from "./components/GroupsTab";
import { RequestsTab } from "./components/RequestsTab";

export function ConnectionsPage() {
  return (
    <div className="w-full h-full bg-background p-4 md:p-6 lg:p-8">
      <Tabs defaultValue="1-to-1" className="w-full space-y-6">
        {/* Segmented controls taking full width of the container */}
        <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-xl h-auto">
          <TabsTrigger value="1-to-1" className="cursor-pointer gap-2 py-2.5 rounded-lg data-[state=active]:shadow-sm">
            <Users className="h-4 w-4" /> 
            <span className="hidden sm:inline">1-to-1</span>
          </TabsTrigger>
          <TabsTrigger value="groups" className="cursor-pointer gap-2 py-2.5 rounded-lg data-[state=active]:shadow-sm">
            <UsersRound className="h-4 w-4" /> 
            <span className="hidden sm:inline">Groups</span>
          </TabsTrigger>
          <TabsTrigger value="requests" className="cursor-pointer gap-2 py-2.5 rounded-lg data-[state=active]:shadow-sm">
            <UserPlus className="h-4 w-4" /> 
            <span className="hidden sm:inline">Requests</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="1-to-1" className="m-0 border-none outline-none">
          <OneToOneTab />
        </TabsContent>

        <TabsContent value="groups" className="m-0 border-none outline-none">
          <GroupsTab />
        </TabsContent>

        <TabsContent value="requests" className="m-0 border-none outline-none">
          <RequestsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
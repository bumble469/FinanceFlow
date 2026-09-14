import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";

export function OneToOneTab() {
  return (
    <Card className="border border-border/50 bg-card p-6 md:p-10 rounded-2xl shadow-sm flex flex-col min-h-[400px]">
      <div className="flex flex-col items-center justify-center flex-1 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-5">
          <Users className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-medium text-foreground mb-2">
          Your Network
        </h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm leading-relaxed">
          Connect directly with team members, freelancers, and clients. People you collaborate with will appear here.
        </p>
      </div>
      
      {/* Empty container ready for dynamic list mapping later */}
      <div className="w-full flex flex-col gap-2">
        {/* Dynamic connection items will be rendered here */}
      </div>
    </Card>
  );
}
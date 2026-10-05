import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getPlanAccess } from "@/lib/get-plan-access";
import { groupExists } from "@/lib/group-access";
import { getGroupMembers } from "@/lib/group";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ workItemId: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { workItemId } = await params;
    if (!(await groupExists(workItemId))) {
      return NextResponse.json({ error: "No group for this work item" }, { status: 404 });
    }

    const access = await getPlanAccess(workItemId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const workItem = await prisma.workItem.findUnique({
      where: { id: workItemId },
      select: { id: true, name: true, type: true, status: true },
    });
    if (!workItem) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const members = await getGroupMembers(workItemId);

    return NextResponse.json({ success: true, data: { workItem, members } });
  } catch (err) {
    console.error("[GET /api/groups/[workItemId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
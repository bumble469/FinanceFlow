import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { autoConnectWithPlanMembers } from "@/lib/auto-connect";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: planId } = await params;

    const body = await req.json();
    const { invitationId, action } = body;

    if (!invitationId || !action) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const invitation =
      await prisma.workItemMemberInvitation.findUnique({
        where: {
          id: invitationId,
        },
      });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Invitation already handled" },
        { status: 400 }
      );
    }

    if (invitation.email !== user.email) {
      return NextResponse.json(
        { error: "This invitation does not belong to you" },
        { status: 403 }
      );
    }

    if (action === "REJECT") {
      await prisma.workItemMemberInvitation.update({
        where: {
          id: invitationId,
        },
        data: {
          status: "REJECTED",
          respondedAt: new Date(),
        },
      });

      const planForNotify = await prisma.workItem.findUnique({
        where: { id: planId },
        select: { name: true },
      });

      await notify({
        workItemId: planId,
        userIds: [invitation.invitedById],
        scope: "PERSONAL",
        type: "INVITATION",
        title: "Invitation declined",
        message: `${user.name ?? "Someone"} declined your invitation to join ${planForNotify?.name ?? "your plan"}.`,
        entityType: "invitation",
        entityId: invitationId,
      });

      return NextResponse.json({
        success: true,
        message: "Invitation rejected successfully",
      });
    }


    if (action === "ACCEPT") {
      await prisma.$transaction(async (tx) => {
        const existingMember = await tx.workItemMember.findFirst({
          where: {
            workItemId: planId,
            userId: user.sub,
          },
        });

        if (existingMember) {
          throw new Error("User is already a member");
        }

        await tx.workItemMember.create({
          data: {
            workItemId: planId,
            userId: user.sub,
            role: invitation.role,
          },
        });

        await tx.workItemMemberInvitation.update({
          where: {
            id: invitationId,
          },
          data: {
            status: "ACCEPTED",
            respondedAt: new Date(),
          },
        });
      });

      // Auto-connect the new member with the plan's other members.
      // Runs AFTER the member row exists, so the new member is picked up as a
      // counterpart by any later auto-connect too.
      await autoConnectWithPlanMembers({ workItemId: planId, userId: user.sub });

      const planForNotify = await prisma.workItem.findUnique({
        where: { id: planId },
        select: { name: true },
      });

      await notify({
        workItemId: planId,
        userIds: [invitation.invitedById],
        scope: "PERSONAL",
        type: "INVITATION",
        title: "Invitation accepted",
        message: `${user.name ?? "Someone"} accepted your invitation to join ${planForNotify?.name ?? "your plan"}.`,
        entityType: "invitation",
        entityId: invitationId,
      });

      return NextResponse.json({
        success: true,
        message: "Invitation accepted successfully",
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[INVITATION_RESPONSE_ERROR]", error);

    return NextResponse.json(
      {
        error:
          error.message || "Failed to process invitation",
      },
      { status: 500 }
    );
  }
}
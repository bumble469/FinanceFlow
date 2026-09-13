import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getPlanAccess } from "@/lib/get-plan-access";
import { canAssignRole } from "@/lib/permissions";

// GET: list all members of a plan
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: planId } = await params;
    const { searchParams } = req.nextUrl;

    const search = searchParams.get("search")?.trim() || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize")) || 10));

    const where = {
      workItemId: planId,
      ...(search
        ? {
          user: {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          },
        }
        : {}),
    };

    const [total, members, allMembersForStats] = await Promise.all([
      prisma.workItemMember.count({ where }),
      prisma.workItemMember.findMany({
        where,
        include: { user: true, departmentMembers: { include: { department: true } } },
        orderBy: { user: { name: "asc" } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      // Stats always reflect the WHOLE team, not just the current search/page
      prisma.workItemMember.findMany({
        where: { workItemId: planId },
        include: { user: true, departmentMembers: { include: { department: true } } },
      }),
    ]);

    const departments = await prisma.department.findMany({ where: { workItemId: planId } });

    const toNum = (m: any) => Number(m.monthlyCost ?? 0);

    const totalMonthlyCost = allMembersForStats.reduce((sum, m) => sum + toNum(m), 0);

    const byDepartment = departments.map((d) => {
      const inDept = allMembersForStats.filter((m) =>
        m.departmentMembers.some((dm) => dm.departmentId === d.id)
      );
      return {
        id: d.id,
        name: d.name,
        count: inDept.length,
        cost: inDept.reduce((sum, m) => {
          const dm = m.departmentMembers.find((x) => x.departmentId === d.id);
          const share = dm?.costShare != null
            ? Number(dm.costShare)
            : (m.departmentMembers.length === 1 ? Number(m.monthlyCost ?? 0) : 0);
          return sum + share;
        }, 0),

      };
    });

    const ROLE_ORDER = ["ADMIN", "CO_ADMIN", "MANAGER", "CO_MANAGER", "MEMBER"];
    const byRole = ROLE_ORDER.map((role) => {
      const inRole = allMembersForStats.filter((m) => m.role === role);
      return {
        role,
        count: inRole.length,
        cost: inRole.reduce((sum, m) => sum + toNum(m), 0),
      };
    }).filter((r) => r.count > 0);

    const formattedMembers = members.map((m) => ({
      ...m,
      monthlyCost: toNum(m),
    }));

    return NextResponse.json({
      data: formattedMembers,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      stats: {
        totalMembers: allMembersForStats.length,
        totalMonthlyCost,
        byDepartment,
        byRole,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}

// POST: add member to plan + optional departments
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: planId } = await params;

    const access = await getPlanAccess(planId, user.sub);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!access.permissions.canInviteMember) {
      return NextResponse.json({ error: "You don't have permission to add members to this plan" }, { status: 403 });
    }

    const body = await req.json();

    const { userId, role, departmentIds = [], monthlyCost } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (!canAssignRole(access.role, role || "MEMBER")) {
      return NextResponse.json(
        { error: "Only the plan owner or an admin can assign the Admin or Co-Admin role" },
        { status: 403 }
      );
    }

    // 1. Create WorkItemMember
    const workItemMember = await prisma.workItemMember.create({
      data: {
        workItemId: planId,
        userId,
        role: role || "MEMBER",
        monthlyCost
      },
    });

    // 2. Create DepartmentMember entries (if any)
    if (departmentIds.length > 0) {
      await prisma.departmentMember.createMany({
        data: departmentIds.map((deptId: string) => ({
          departmentId: deptId,
          userId,
          workItemMemberId: workItemMember.id,
        })),
        skipDuplicates: true,
      });
    }

    // 3. Return full member data
    const fullMember = await prisma.workItemMember.findUnique({
      where: {
        id: workItemMember.id,
      },
      include: {
        user: true,
        departmentMembers: {
          include: {
            department: true,
          },
        },
      },
    });

    return NextResponse.json(fullMember, { status: 201 });
  } catch (error: any) {
    console.error(error);

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "User already added to this plan" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to add member" },
      { status: 500 }
    );
  }
}
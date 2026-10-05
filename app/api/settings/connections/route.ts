import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
    try {
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { autoConnectWithCoworkers } = body as { autoConnectWithCoworkers: boolean };

        await prisma.user.update({
            where: { id: user.sub },
            data: { autoConnectWithCoworkers },
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[PATCH /api/settings/connections]", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

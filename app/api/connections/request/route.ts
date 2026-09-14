import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { notify } from "@/lib/notify";

// POST — send or accept a connection request
export async function POST(req: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { targetUserId } = body;

        if (!targetUserId) {
            return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
        }

        const sender = await prisma.user.findUnique({
            where: { id: authUser.sub },
            select: { name: true }
        });
        const senderName = sender?.name || "Someone";

        const [u1, u2] = [authUser.sub, targetUserId].sort();

        const existing = await prisma.connection.findUnique({
            where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } }
        });

        if (existing) {
            // If the OTHER person sent a request to us, clicking Connect = accept it
            if (existing.status === "PENDING" && existing.requesterId !== authUser.sub) {
                const updatedConnection = await prisma.connection.update({
                    where: { id: existing.id },
                    data: { status: "ACCEPTED" }
                });

                if (existing.requesterId) {
                    await notify({
                        userIds: [existing.requesterId], 
                        scope: "PERSONAL",
                        type: "CONNECTION_REQUEST_ACCEPTED",
                        title: "Connection Accepted",
                        message: `${senderName} accepted your connection request.`,
                        entityType: "CONNECTION",
                        entityId: updatedConnection.id
                    });
                }
                return NextResponse.json({ success: true, status: "ACCEPTED" });
            }
            return NextResponse.json({ error: "Connection already exists" }, { status: 400 });
        }

        // Create a PENDING request — the other person must accept
        const newConnection = await prisma.connection.create({
            data: {
                user1Id: u1,
                user2Id: u2,
                status: "PENDING",
                requesterId: authUser.sub,
            }
        });

        // Trigger Notification: New Connection Request using the notify helper
        await notify({
            userIds: [targetUserId], 
            scope: "PERSONAL",
            type: "CONNECTION_REQUEST",
            title: "New Connection Request",
            message: `${senderName} wants to connect with you.`,
            entityType: "CONNECTION",
            entityId: newConnection.id
        });

        return NextResponse.json({ success: true, status: "PENDING" });
    } catch (err) {
        console.error("[POST /api/connections]", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// DELETE — reject (or withdraw) a connection request
export async function DELETE(req: NextRequest) {
    try {
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { targetUserId } = body;

        if (!targetUserId) {
            return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
        }

        const [u1, u2] = [user.sub, targetUserId].sort();

        const existing = await prisma.connection.findUnique({
            where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } }
        });

        if (!existing || existing.status !== "PENDING") {
            return NextResponse.json({ error: "No pending request found" }, { status: 404 });
        }

        // Only the recipient or the sender can delete the request
        if (existing.requesterId !== user.sub && existing.requesterId !== targetUserId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await prisma.connection.delete({ where: { id: existing.id } });

        return NextResponse.json({ success: true, status: "NONE" });
    } catch (err) {
        console.error("[DELETE /api/connections/request]", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// GET — fetch pending connection requests (incoming & outgoing)
export async function GET(req: NextRequest) {
    try {
        const user = await getAuthUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Fetch all pending connections involving the current user
        const pendingConnections = await prisma.connection.findMany({
            where: {
                status: "PENDING",
                OR: [
                    { user1Id: user.sub },
                    { user2Id: user.sub }
                ]
            },
            include: {
                // Adjust relation fields based on your Prisma schema (e.g., user1, user2)
                user1: { select: { id: true, name: true, email: true, image: true } },
                user2: { select: { id: true, name: true, email: true, image: true } }
            }
        });

        // Separate incoming vs outgoing requests
        const incoming = [];
        const outgoing = [];

        for (const conn of pendingConnections) {
            const isRequester = conn.requesterId === user.sub;

            // The target user is whichever user object isn't the current user
            const otherUser = conn.user1Id === user.sub ? conn.user2 : conn.user1;

            const requestData = {
                connectionId: conn.id,
                user: otherUser,
                createdAt: conn.createdAt
            };

            if (isRequester) {
                outgoing.push(requestData);
            } else {
                incoming.push(requestData);
            }
        }

        return NextResponse.json({ incoming, outgoing });
    } catch (err) {
        console.error("[GET /api/connections]", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
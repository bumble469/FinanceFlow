import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  getConnectionPrefs,
  setConnectionPrefs,
  type ConnectionPrefs,
} from "@/lib/user-preferences";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const prefs = await getConnectionPrefs(user.sub);
    return NextResponse.json({ success: true, data: prefs });
  } catch (err) {
    console.error("[GET /api/settings/connections]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const patch: Partial<ConnectionPrefs> = {};

    if (typeof body.autoConnectWithCoworkers === "boolean") {
      patch.autoConnectWithCoworkers = body.autoConnectWithCoworkers;
    }
    if (typeof body.messageSnackbarEnabled === "boolean") {
      patch.messageSnackbarEnabled = body.messageSnackbarEnabled;
    }
    if (typeof body.emailNotificationsEnabled === "boolean") {
      patch.emailNotificationsEnabled = body.emailNotificationsEnabled;
    }
    if (typeof body.unreadBadgeEnabled === "boolean") {
      patch.unreadBadgeEnabled = body.unreadBadgeEnabled;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No valid settings provided" }, { status: 400 });
    }

    const prefs = await setConnectionPrefs(user.sub, patch);
    return NextResponse.json({ success: true, data: prefs });
  } catch (err) {
    console.error("[PATCH /api/settings/connections]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

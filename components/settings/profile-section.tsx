"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Camera, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { useFinancialStore } from "@/lib/store";
import { useSnackbar } from "@/lib/useSnackbar";

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface Profile {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  headline: string | null;
  emailVerified: string | null;
  createdAt: string;
  hasPassword: boolean;
  provider: string | null;
}

export function ProfileSection() {
  const { show } = useSnackbar();
  const currentUser = useFinancialStore((s) => s.currentUser);
  const setCurrentUser = useFinancialStore((s) => s.setCurrentUser);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    authClient
      .request("/api/settings/profile")
      .then((res) => {
        const p: Profile = res.data.data;
        setProfile(p);
        setName(p.name ?? "");
        setHeadline(p.headline ?? "");
      })
      .catch((err) => console.error("Failed to load profile:", err))
      .finally(() => setLoading(false));
  }, []);

  // keeps the sidebar avatar and name in sync without a reload
  const syncStore = (patch: { name?: string; image?: string | null; headline?: string | null }) => {
    if (currentUser) setCurrentUser({ ...currentUser, ...patch });
  };

  const dirty =
    name.trim() !== (profile?.name ?? "") || headline.trim() !== (profile?.headline ?? "");

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await authClient.request("/api/settings/profile", {
        method: "PATCH",
        data: { name: name.trim(), headline: headline.trim() },
      });
      const updated = res.data.data;
      setProfile((p) => (p ? { ...p, name: updated.name, headline: updated.headline } : p));
      syncStore({ name: updated.name ?? undefined, headline: updated.headline });
      show("Profile saved", "success");
    } catch (err: any) {
      show(err?.response?.data?.error || "Failed to save profile", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      show("Only JPG, PNG or WEBP images are allowed", "error");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      show("Image must be under 2 MB", "error");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await authClient.request("/api/settings/profile/avatar", {
        method: "POST",
        data: formData,
      });
      const image = res.data.data.image as string;
      setProfile((p) => (p ? { ...p, image } : p));
      syncStore({ image });
      show("Profile photo updated", "success");
    } catch (err: any) {
      show(err?.response?.data?.error || "Failed to upload photo", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      await authClient.request("/api/settings/profile/avatar", { method: "DELETE" });
      setProfile((p) => (p ? { ...p, image: null } : p));
      syncStore({ image: null });
      setConfirmRemoveOpen(false);
      show("Profile photo removed", "success");
    } catch (err: any) {
      show(err?.response?.data?.error || "Failed to remove photo", "error");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card className="border border-border bg-card p-6">
        <p className="text-sm text-destructive">Could not load your profile.</p>
      </Card>
    );
  }

  const initials =
    (profile.name || profile.email)
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  const joined = new Date(profile.createdAt).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <Card className="border border-border bg-card p-6">
        <h2 className="text-xl font-semibold text-foreground">Profile</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          This is how you appear to other people in Connections and plans.
        </p>

        {/* photo */}
        <div className="mb-6 flex items-center gap-5">
          <div className="relative">
            <Avatar className="h-20 w-20 border border-border">
              <AvatarImage src={profile.image ?? undefined} alt={profile.name ?? "Profile photo"} className="object-cover" />
              <AvatarFallback className="bg-primary/20 text-xl font-medium text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer hover:text-gray-600"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="mr-2 h-4 w-4" />
                {profile.image ? "Change photo" : "Upload photo"}
              </Button>
              {profile.image && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="cursor-pointer text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmRemoveOpen(true)}
                  disabled={uploading}
                >
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">JPG, PNG or WEBP, up to 2 MB.</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        </div>

        {/* details */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Headline</Label>
              <span className="text-xs text-muted-foreground">{headline.length}/160</span>
            </div>
            <Textarea
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={160}
              rows={2}
              className="resize-none"
              placeholder="e.g. Final-year CS student · Event lead"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <div className="flex items-center gap-2">
              <Input value={profile.email} disabled />
              {profile.emailVerified && (
                <Badge variant="secondary" className="shrink-0 gap-1">
                  <BadgeCheck className="h-3 w-3" />
                  Verified
                </Badge>
              )}
              {profile.provider === "google" && (
                <Badge variant="outline" className="shrink-0">Google</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Member since {joined}</p>
          </div>

          <div className="flex justify-end">
            <Button
              className="cursor-pointer"
              onClick={handleSave}
              disabled={!dirty || !name.trim() || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Confirmation Dialog for Removing Profile Photo */}
      <Dialog open={confirmRemoveOpen} onOpenChange={(open) => !uploading && setConfirmRemoveOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove profile photo?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove your profile photo? Your avatar will revert to your initials.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmRemoveOpen(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemove}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove photo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PreferencesSection() {
  return (
    <Card className="border border-border bg-card p-6">
      <h2 className="text-xl font-semibold text-foreground">Preferences</h2>
      <p className="mb-6 text-sm text-muted-foreground">Regional and application preferences.</p>

      <div className="space-y-4">
        {[
          { title: "Default currency", hint: "Pre-selected when you create a plan." },
          { title: "Date format", hint: "How dates appear across the app." },
        ].map((row) => (
          <div
            key={row.title}
            className="flex items-center justify-between gap-6 rounded-lg border border-border px-4 py-3.5 opacity-60"
          >
            <div>
              <div className="flex items-center gap-2">
                <Label>{row.title}</Label>
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  Coming soon
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{row.hint}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
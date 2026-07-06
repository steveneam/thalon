import { asJson } from "@/lib/approve-queue/client";
import type { ProfilesPayload, ProfileWire, SaveProfileRequest } from "./types";

export async function fetchProfiles(): Promise<ProfilesPayload> {
  return asJson<ProfilesPayload>(await fetch("/api/profiles"));
}

export async function saveProfile(request: SaveProfileRequest): Promise<ProfileWire> {
  const res = await fetch("/api/profiles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  return (await asJson<{ profile: ProfileWire }>(res)).profile;
}

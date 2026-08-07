import { getChatGPTUser, isOwnerUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const user = await getChatGPTUser();
  return Response.json({
    authenticated: Boolean(user),
    canEdit: isOwnerUser(user),
    displayName: isOwnerUser(user) ? user?.displayName ?? null : null,
  });
}

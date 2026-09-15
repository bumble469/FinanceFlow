import { prisma } from "@/lib/prisma";

export async function getConversationForUser(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { connection: true },
  });

  if (!conversation) return null;
  const { user1Id, user2Id } = conversation.connection;
  if (userId !== user1Id && userId !== user2Id) return null;

  return conversation;
}
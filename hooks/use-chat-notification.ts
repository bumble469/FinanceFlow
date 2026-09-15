"use client";

import { useEffect } from "react";
import { getSocket } from "@/lib/socket-client";
import { toast } from "sonner";

interface MessagePayload {
    senderId: string;
    senderName: string;
    content: string;
    chatId: string;
}

export function useChatNotifications(currentActiveChatId?: string | null, notificationsEnabled: boolean = true) {
    useEffect(() => {
        if (!notificationsEnabled) return;

        const socket = getSocket();

        function handleIncomingMessage(payload: MessagePayload) {
            if (currentActiveChatId === payload.chatId) return;

            toast(payload.senderName, {
                description: payload.content,
                duration: 2000,
                position: "top-right",
            });
        }

        socket.on("chat:message", handleIncomingMessage);

        return () => {
            socket.off("chat:message", handleIncomingMessage);
        };
    }, [currentActiveChatId, notificationsEnabled]);
}
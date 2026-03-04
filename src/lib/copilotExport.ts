import type { CopilotConversation, CopilotFeedbackEntry } from "@/store";

export interface ExportData {
  version: string;
  exportedAt: string;
  conversations: CopilotConversation[];
  feedback: CopilotFeedbackEntry[];
}

export function exportConversations(
  conversations: CopilotConversation[],
  feedback: CopilotFeedbackEntry[]
): string {
  const exportData: ExportData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    conversations,
    feedback,
  };

  return JSON.stringify(exportData, null, 2);
}

export function downloadExport(
  conversations: CopilotConversation[],
  feedback: CopilotFeedbackEntry[]
): void {
  const json = exportConversations(conversations, feedback);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = `copilot-backup-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  success: boolean;
  conversationsImported: number;
  feedbackImported: number;
  errors: string[];
}

export function importConversations(jsonString: string): ImportResult {
  const result: ImportResult = {
    success: false,
    conversationsImported: 0,
    feedbackImported: 0,
    errors: [],
  };

  try {
    const data: Partial<ExportData> = JSON.parse(jsonString);

    // Validate version
    if (!data.version) {
      result.errors.push("Invalid export file: missing version");
      return result;
    }

    // Import conversations
    if (Array.isArray(data.conversations)) {
      for (const conv of data.conversations) {
        if (
          conv.id &&
          conv.title &&
          Array.isArray(conv.messages) &&
          conv.createdAt &&
          conv.updatedAt
        ) {
          result.conversationsImported++;
        } else {
          result.errors.push(`Invalid conversation: ${conv.id || "unknown"}`);
        }
      }
    }

    // Import feedback
    if (Array.isArray(data.feedback)) {
      for (const entry of data.feedback) {
        if (
          entry.id &&
          entry.conversationId &&
          entry.messageId &&
          entry.intent &&
          entry.action &&
          entry.timestamp
        ) {
          result.feedbackImported++;
        } else {
          result.errors.push(`Invalid feedback entry: ${entry.id || "unknown"}`);
        }
      }
    }

    result.success = result.errors.length === 0;
  } catch (error) {
    result.errors.push(
      error instanceof Error ? error.message : "Failed to parse JSON"
    );
  }

  return result;
}

export function parseImportedConversations(
  jsonString: string
): { conversations: CopilotConversation[]; feedback: CopilotFeedbackEntry[] } | null {
  try {
    const data: ExportData = JSON.parse(jsonString);
    
    return {
      conversations: data.conversations || [],
      feedback: data.feedback || [],
    };
  } catch {
    return null;
  }
}

// Export statistics
export function getConversationStats(conversations: CopilotConversation[]) {
  const totalMessages = conversations.reduce(
    (sum, conv) => sum + conv.messages.length,
    0
  );
  
  const userMessages = conversations.reduce(
    (sum, conv) => sum + conv.messages.filter((m) => m.role === "user").length,
    0
  );
  
  const assistantMessages = conversations.reduce(
    (sum, conv) => sum + conv.messages.filter((m) => m.role === "assistant").length,
    0
  );

  const oldestConversation = conversations.length > 0
    ? conversations.reduce((oldest, conv) =>
        new Date(conv.createdAt) < new Date(oldest.createdAt) ? conv : oldest
      )
    : null;

  const mostRecentConversation = conversations.length > 0
    ? conversations.reduce((recent, conv) =>
        new Date(conv.updatedAt) > new Date(recent.updatedAt) ? conv : recent
      )
    : null;

  return {
    totalConversations: conversations.length,
    totalMessages,
    userMessages,
    assistantMessages,
    averageMessagesPerConversation: conversations.length > 0
      ? Math.round(totalMessages / conversations.length)
      : 0,
    oldestConversation: oldestConversation?.createdAt,
    mostRecentConversation: mostRecentConversation?.updatedAt,
  };
}

// Export specific conversation as text
export function exportConversationAsText(
  conversation: CopilotConversation
): string {
  const lines: string[] = [
    `# ${conversation.title}`,
    `Created: ${new Date(conversation.createdAt).toLocaleString()}`,
    `Updated: ${new Date(conversation.updatedAt).toLocaleString()}`,
    "",
    "---",
    "",
  ];

  for (const message of conversation.messages) {
    const role = message.role === "user" ? "You" : "AI Assistant";
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    lines.push(`**${role}** (${timestamp}):`);
    lines.push(message.content);
    lines.push("");
  }

  return lines.join("\n");
}

export function downloadConversationAsText(conversation: CopilotConversation): void {
  const text = exportConversationAsText(conversation);
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `conversation-${conversation.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

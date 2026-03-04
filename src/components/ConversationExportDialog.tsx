import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useScheduleStore } from "@/store";
import { 
  X, 
  Download, 
  Upload, 
  FileJson, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Trash2,
  BarChart3
} from "lucide-react";
import { 
  downloadExport, 
  importConversations, 
  parseImportedConversations,
  getConversationStats,
  downloadConversationAsText
} from "@/lib/copilotExport";

interface ConversationExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConversationExportDialog({ isOpen, onClose }: ConversationExportDialogProps) {
  const store = useScheduleStore();
  const [activeTab, setActiveTab] = useState<"export" | "import" | "stats">("export");
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = getConversationStats(store.copilotConversations);

  const handleExportJSON = () => {
    downloadExport(store.copilotConversations, store.copilotFeedback);
    store.showToast({
      type: "success",
      title: "Export Complete",
      message: "Your conversations have been downloaded",
    });
  };

  const handleExportCurrentText = () => {
    const currentConv = store.copilotConversations.find(
      (c) => c.id === store.currentConversationId
    );
    if (currentConv) {
      downloadConversationAsText(currentConv);
      store.showToast({
        type: "success",
        title: "Export Complete",
        message: "Conversation saved as text file",
      });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = importConversations(text);

      if (result.success) {
        const data = parseImportedConversations(text);
        if (data) {
          // Merge imported conversations with existing
          const existingIds = new Set(store.copilotConversations.map((c) => c.id));
          const newConversations = data.conversations.filter(
            (c) => !existingIds.has(c.id)
          );

          // Add to store
          for (const conv of newConversations) {
            store.copilotConversations.push(conv);
          }

          setImportResult({
            success: true,
            message: `Successfully imported ${newConversations.length} conversations`,
          });

          store.showToast({
            type: "success",
            title: "Import Complete",
            message: `Imported ${newConversations.length} conversations`,
          });
        }
      } else {
        setImportResult({
          success: false,
          message: result.errors.join(", "),
        });
      }
    } catch {
      setImportResult({
        success: false,
        message: "Failed to read file",
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClearAll = () => {
    if (
      confirm(
        "Are you sure you want to delete all conversations? This cannot be undone."
      )
    ) {
      // Clear all conversations
      for (const conv of [...store.copilotConversations]) {
        store.deleteConversation(conv.id);
      }
      store.showToast({
        type: "info",
        title: "Conversations Cleared",
        message: "All conversations have been deleted",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <FileJson className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Conversation Data</h2>
                <p className="text-blue-100 text-sm">Export, import, or manage your chats</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            {(["export", "import", "stats"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setImportResult(null);
                }}
                className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === "export" && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <FileJson className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-900">Export as JSON</h3>
                      <p className="text-sm text-slate-500 mt-1">
                        Download all conversations and feedback data for backup or transfer
                      </p>
                      <button
                        onClick={handleExportJSON}
                        className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download JSON
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-900">Export as Text</h3>
                      <p className="text-sm text-slate-500 mt-1">
                        Save current conversation as a readable text file
                      </p>
                      <button
                        onClick={handleExportCurrentText}
                        disabled={!store.currentConversationId}
                        className="mt-3 flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        <Download className="w-4 h-4" />
                        Download Text
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-red-900">Clear All Data</h3>
                      <p className="text-sm text-red-600 mt-1">
                        Permanently delete all conversations and feedback
                      </p>
                      <button
                        onClick={handleClearAll}
                        className="mt-3 flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Clear Everything
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "import" && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
                  <div className="text-center">
                    <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                    <h3 className="font-medium text-slate-900">Import Conversations</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Upload a JSON file from a previous export
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
                    >
                      Select File
                    </button>
                  </div>
                </div>

                {importResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-xl flex items-start gap-3 ${
                      importResult.success
                        ? "bg-emerald-50 border border-emerald-100"
                        : "bg-red-50 border border-red-100"
                    }`}
                  >
                    {importResult.success ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    )}
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          importResult.success ? "text-emerald-800" : "text-red-800"
                        }`}
                      >
                        {importResult.success ? "Success" : "Error"}
                      </p>
                      <p
                        className={`text-sm ${
                          importResult.success ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {importResult.message}
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {activeTab === "stats" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="Total Conversations"
                    value={stats.totalConversations}
                    icon={FileJson}
                  />
                  <StatCard
                    label="Total Messages"
                    value={stats.totalMessages}
                    icon={BarChart3}
                  />
                  <StatCard
                    label="Your Messages"
                    value={stats.userMessages}
                    icon={FileText}
                  />
                  <StatCard
                    label="AI Responses"
                    value={stats.assistantMessages}
                    icon={FileText}
                  />
                </div>

                <div className="p-4 bg-slate-50 rounded-xl">
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Avg. messages per chat</span>
                      <span className="font-medium">{stats.averageMessagesPerConversation}</span>
                    </div>
                    {stats.oldestConversation && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">First conversation</span>
                        <span className="font-medium">
                          {new Date(stats.oldestConversation).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {stats.mostRecentConversation && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Last activity</span>
                        <span className="font-medium">
                          {new Date(stats.mostRecentConversation).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <div className="p-4 bg-slate-50 rounded-xl">
      <div className="flex items-center gap-2 text-slate-400 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

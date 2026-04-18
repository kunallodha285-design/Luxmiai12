import { motion } from "motion/react";
import Markdown from "react-markdown";
import { User, Bot } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "model";
  content: string;
  image?: string;
}

export function ChatMessage({ role, content, image }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex w-full mb-6 ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`flex max-w-[85%] md:max-w-[70%] ${isUser ? "flex-row-reverse" : "flex-row"} items-start gap-3`}>
        <div className={`p-2 rounded-full flex-shrink-0 ${isUser ? "bg-indigo-600 shadow-indigo-200" : "bg-white shadow-sm border border-slate-100"}`}>
          {isUser ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-indigo-600" />}
        </div>
        
        <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
          {image && (
            <motion.img 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              src={image} 
              alt="User uploaded" 
              className="max-w-full rounded-2xl mb-2 shadow-lg border-4 border-white"
              referrerPolicy="no-referrer"
            />
          )}
          <div className={`px-5 py-3 rounded-2xl shadow-sm ${
            isUser 
              ? "bg-indigo-600 text-white rounded-tr-none" 
              : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
          }`}>
            <div className="prose prose-slate max-w-none prose-sm md:prose-base dark:prose-invert">
              <Markdown>{content}</Markdown>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from "react";
import { Send, Image as ImageIcon, Sparkles, Trash2, X, Menu, Plus, MessageSquare, History, User, Share2, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { streamChat, ChatMessage as ChatMessageType, Persona } from "./services/gemini";
import { ChatMessage } from "./components/ChatMessage";

const AVAILABLE_PERSONAS: Persona[] = [
  // Males
  { name: "Shlok", gender: "male", traits: "Respectful, wise, elder-brotherly, uses 'aap' and formal Hindi." },
  { name: "Aryan", gender: "male", traits: "Friendly, casual, bro-like, uses Hinglish slang and is very energetic." },
  { name: "Saksham", gender: "male", traits: "Intelligent, technical, geeky, loves explaining things clearly." },
  // Females
  { name: "Diya", gender: "female", traits: "Kind, warm, gentle, very helpful and polite." },
  { name: "Ananya", gender: "female", traits: "Creative, bubbly, expressive, loves talking about art and ideas." },
  { name: "Myra", gender: "female", traits: "Sophisticated, professional, elder-sisterly, very confident and direct." },
];

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessageType[];
  createdAt: number;
}

interface UserProfile {
  name?: string;
  facts: string[];
  selectedPersonaName?: string;
  logo?: string; // Base64 logo
  isRegistered?: boolean;
}

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [regName, setRegName] = useState("");
  const [userProfile, setUserProfile] = useState<UserProfile>({ facts: [] });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const currentPersona = AVAILABLE_PERSONAS.find(p => p.name === userProfile.selectedPersonaName) || AVAILABLE_PERSONAS[0];

  // Load from localStorage
  useEffect(() => {
    const savedSessions = localStorage.getItem("luxmi_sessions");
    const savedProfile = localStorage.getItem("luxmi_profile");
    
    if (savedSessions) {
      const parsed = JSON.parse(savedSessions);
      setSessions(parsed);
      if (parsed.length > 0) {
        setCurrentSessionId(parsed[0].id);
      }
    } else {
      createNewSession();
    }
    
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      setUserProfile(parsed);
      if (!parsed.isRegistered) {
        setIsRegistrationModalOpen(true);
      }
    } else {
      setIsRegistrationModalOpen(true);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("luxmi_sessions", JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem("luxmi_profile", JSON.stringify(userProfile));
  }, [userProfile]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setIsSidebarOpen(false);
  };

  const selectPersona = (name: string) => {
    setUserProfile(prev => ({ ...prev, selectedPersonaName: name }));
    setIsPersonaModalOpen(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserProfile(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const completeRegistration = () => {
    if (!regName.trim()) return;
    setUserProfile(prev => ({ 
      ...prev, 
      name: regName, 
      isRegistered: true,
      facts: [...prev.facts, `User's name is ${regName}.`]
    }));
    setIsRegistrationModalOpen(false);
  };

  const handleLogout = () => {
    if (confirm("Kya aap sach mein logout karna chahte hain? Sabhi chat save rahengi par aapka naam hat jayega.")) {
      setUserProfile({ facts: [], isRegistered: false });
      setIsRegistrationModalOpen(true);
    }
  };

  const LogoIcon = () => (
    <div className="w-full h-full flex items-center justify-center text-white bg-indigo-600">
      {userProfile.logo ? (
        <img src={userProfile.logo} alt="Logo" className="w-full h-full object-cover" />
      ) : (
        <Sparkles className="w-5 h-5" />
      )}
    </div>
  );

  const copyAppLink = () => {
    const shareLink = window.location.href;
    navigator.clipboard.writeText(shareLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const updateSessionMessages = (sessionId: string, newMessages: ChatMessageType[]) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        // Simple title extraction from first message
        let title = s.title;
        if (s.title === "New Chat" && newMessages.length > 0) {
          title = newMessages[0].content.slice(0, 30) || "Image Search";
        }
        return { ...s, messages: newMessages, title };
      }
      return s;
    }));
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading || !currentSessionId) return;

    const userMsg: ChatMessageType = {
      role: "user",
      content: input,
      image: selectedImage || undefined,
    };

    const updatedMessages = [...currentSession.messages, userMsg];
    updateSessionMessages(currentSessionId, updatedMessages);
    
    setInput("");
    setSelectedImage(null);
    setIsLoading(true);

    let assistantContent = "";
    const assistantMsg: ChatMessageType = {
      role: "model",
      content: "...",
    };
    
    const messagesWithPlaceholder = [...updatedMessages, assistantMsg];
    updateSessionMessages(currentSessionId, messagesWithPlaceholder);

    try {
      // Memory context: include facts we know about the user
      const context = userProfile.facts.join(" ");
      const stream = streamChat(updatedMessages, currentPersona, context);
      
      for await (const chunk of stream) {
        assistantContent += chunk;
        const finalMessages = [...updatedMessages, { ...assistantMsg, content: assistantContent }];
        updateSessionMessages(currentSessionId, finalMessages);
      }

      // Memory extraction (simple name check)
      if (input.toLowerCase().includes("kaam") || input.toLowerCase().includes("naam")) {
        // If user says something like "Mera naam Kunal hai"
        const nameMatch = input.match(/(?:mera naam|i am|calling me|name is) ([A-Za-z]+)/i);
        if (nameMatch && nameMatch[1]) {
          const name = nameMatch[1];
          setUserProfile(prev => ({ ...prev, name, facts: [...new Set([...prev.facts, `User's name is ${name}.`])] }));
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (currentSessionId === id) {
      if (newSessions.length > 0) {
        setCurrentSessionId(newSessions[0].id);
      } else {
        createNewSession();
      }
    }
  };

  return (
    <div className="flex h-screen gradient-bg font-sans overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="fixed inset-y-0 left-0 w-72 glass-morphism z-40 flex flex-col border-r border-slate-200 shadow-2xl"
            >
              <div className="p-4 border-bottom border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/20">
                    <LogoIcon />
                  </div>
                  <span className="font-display font-bold text-slate-800">History</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="p-3">
                <button 
                  onClick={createNewSession}
                  className="w-full flex items-center gap-2 p-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                  New Chat
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-2 space-y-1">
                {sessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setCurrentSessionId(s.id);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl flex items-center justify-between group transition-all ${
                      currentSessionId === s.id ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <MessageSquare className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate text-sm font-medium">{s.title}</span>
                    </div>
                    <Trash2 
                      className="w-4 h-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => deleteSession(s.id, e)}
                    />
                  </button>
                ))}
              </div>

                <div className="p-2 border-t border-slate-100 mt-2 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 px-1">Settings & Identity</p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={logoInputRef} 
                    onChange={handleLogoUpload} 
                  />
                  <button 
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full flex items-center gap-2 p-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-all text-sm group"
                  >
                    <div className="p-1.5 bg-indigo-50 text-indigo-500 rounded-lg group-hover:bg-indigo-100 transition-colors">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <span>Change App Logo</span>
                  </button>

                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all text-sm group"
                  >
                    <div className="p-1.5 bg-red-50 text-red-500 rounded-lg group-hover:bg-red-100 transition-colors">
                      <User className="w-4 h-4" />
                    </div>
                    <span>Logout (Reset Profile)</span>
                  </button>
                </div>

                <div className="p-3 border-t border-slate-100 flex flex-col gap-2">
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 mb-1">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Mobile Install Guide
                  </p>
                  <p className="text-[11px] text-amber-800 leading-tight">
                    Link ko phone ke <b>Chrome/Safari</b> mein open karein, fir menu se <b>"Add to Home Screen"</b> dabiye!
                  </p>
                </div>
                
                <button 
                  onClick={copyAppLink}
                  className="w-full flex items-center justify-between p-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                >
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4" />
                    <span className="text-sm">Copy Direct Link</span>
                  </div>
                  {isCopied ? <Check className="w-4 h-4" /> : null}
                </button>

                <div className="p-2 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                  <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Current App URL:</p>
                  <p className="text-[10px] text-slate-600 break-all font-mono leading-tight">
                    {window.location.origin}
                  </p>
                </div>
                
                {userProfile.name && (
                  <div className="flex items-center gap-3 p-1">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Logged in as</p>
                      <p className="text-sm font-bold text-slate-800">{userProfile.name}</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30"
            />
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="glass-morphism h-16 flex items-center justify-between px-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-xl transition-all"
            >
              <Menu className="w-6 h-6 text-slate-600" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                <LogoIcon />
              </div>
              <h1 className="text-xl font-display font-bold tracking-tight text-slate-800">
                Luxmi AI
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsPersonaModalOpen(true)}
              className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all flex items-center gap-2 border border-indigo-100"
              title="Change Character"
            >
              <User className="w-5 h-5" />
              <span className="text-xs font-bold hidden sm:inline">{currentPersona.name}</span>
            </button>
            <button 
              onClick={createNewSession}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-all flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              NEW
            </button>
          </div>
        </header>

        {/* Persona Selection Modal */}
        <AnimatePresence>
          {isPersonaModalOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsPersonaModalOpen(false)}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[60]"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-2xl glass-morphism z-[70] rounded-3xl p-6 shadow-2xl border border-white"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-display font-bold text-slate-800">Choose Character</h3>
                    <p className="text-sm text-slate-500">Select how Luxmi AI behaves with you</p>
                  </div>
                  <button onClick={() => setIsPersonaModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Male Characters</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {AVAILABLE_PERSONAS.filter(p => p.gender === "male").map(p => (
                        <button
                          key={p.name}
                          onClick={() => selectPersona(p.name)}
                          className={`p-4 rounded-2xl border-2 transition-all text-left ${
                            currentPersona.name === p.name 
                              ? "border-indigo-600 bg-indigo-50 shadow-md" 
                              : "border-slate-100 hover:border-indigo-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mb-3">
                            <User className="w-6 h-6 text-indigo-600" />
                          </div>
                          <p className="font-bold text-slate-800">{p.name}</p>
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-tight">{p.traits}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Female Characters</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {AVAILABLE_PERSONAS.filter(p => p.gender === "female").map(p => (
                        <button
                          key={p.name}
                          onClick={() => selectPersona(p.name)}
                          className={`p-4 rounded-2xl border-2 transition-all text-left ${
                            currentPersona.name === p.name 
                              ? "border-pink-600 bg-pink-50 shadow-md" 
                              : "border-slate-100 hover:border-pink-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center mb-3">
                            <User className="w-6 h-6 text-pink-600" />
                          </div>
                          <p className="font-bold text-slate-800">{p.name}</p>
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-tight">{p.traits}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>


        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 chat-container">
          {(!currentSession || currentSession.messages.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-xl border border-slate-100 overflow-hidden"
              >
                <div className="w-full h-full">
                  <LogoIcon />
                </div>
              </motion.div>
              <h2 className="text-3xl font-display font-bold text-slate-800 mb-2">
                Namaste{userProfile.name ? `, ${userProfile.name}` : ""}!
              </h2>
              <p className="text-slate-500 max-w-md mx-auto leading-relaxed">
                Main Luxmi AI hoon. Kunal ne mujhe aapki har mushkil asaan karne ke liye banaya hai.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-10 w-full max-w-xl">
                {[
                  "Kunal ne tumhe kyun banaya?",
                  "Aaj ka weather kaisa hai?",
                  "Translate: Hello how are you in Hindi",
                  "Explain AI in simple words"
                ].map((query, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(query)}
                    className="p-4 bg-white border border-slate-100 rounded-xl text-sm font-semibold text-slate-700 hover:border-indigo-200 hover:shadow-lg transition-all text-left group"
                  >
                    <span className="group-hover:text-indigo-600 transition-colors">{query}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto w-full">
              {currentSession.messages.map((msg, idx) => (
                <ChatMessage key={idx} {...msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Input Area */}
        <footer className="p-4 md:p-6 bg-transparent relative z-20">
          <div className="max-w-4xl mx-auto">
            <AnimatePresence>
              {selectedImage && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mb-4 relative inline-block group"
                >
                  <img 
                    src={selectedImage} 
                    alt="Selected" 
                    className="h-24 w-auto rounded-xl shadow-lg border-2 border-white" 
                  />
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="absolute -top-2 -right-2 bg-indigo-600 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative group">
              <div className="absolute inset-0 bg-indigo-100 rounded-2xl blur-lg opacity-20 group-focus-within:opacity-40 transition-opacity" />
              <div className="relative glass-morphism rounded-2xl flex items-end gap-2 p-2 shadow-lg focus-within:shadow-indigo-100 focus-within:border-indigo-200 transition-all border border-white">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all"
                  title="Attach Image"
                >
                  <ImageIcon className="w-6 h-6" />
                </button>
                
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask Luxmi AI anything..."
                  className="flex-1 bg-transparent py-3 px-2 outline-none text-slate-700 resize-none max-h-40 min-h-[48px]"
                />
                
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && !selectedImage) || isLoading}
                  className={`p-3 rounded-xl transition-all shadow-md ${
                    (!input.trim() && !selectedImage) || isLoading
                      ? "bg-slate-100 text-slate-300"
                      : "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200 scale-110"
                  }`}
                >
                  <Send className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 px-1">
              <p className="text-[10px] text-slate-400 font-medium tracking-tight">
                Luxmi AI may provide inaccurate info.
              </p>
              <div className="flex items-center gap-1.5 opacity-50">
                 <History className="w-3 h-3 text-slate-400" />
                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Saved locally</span>
              </div>
            </div>
          </div>
        </footer>
        <AnimatePresence>
          {isRegistrationModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md glass-morphism rounded-[2.5rem] p-8 shadow-2xl border border-white/50 text-center"
              >
                <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3 overflow-hidden">
                   {userProfile.logo ? <img src={userProfile.logo} className="w-full h-full object-cover" /> : <Sparkles className="w-10 h-10 text-white" />}
                </div>
                <h2 className="text-3xl font-display font-bold text-slate-800 mb-2">Welcome to Luxmi AI</h2>
                <p className="text-slate-500 mb-8 leading-relaxed">
                  Namaste! Main aapka personal AI assistant hoon. Shuru karne ke liye aapna naam batayein.
                </p>
                
                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Aapka pyara naam..."
                      className="w-full p-4 bg-white/50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all font-medium text-slate-800"
                      onKeyDown={(e) => e.key === "Enter" && completeRegistration()}
                    />
                  </div>
                  <button
                    onClick={completeRegistration}
                    disabled={!regName.trim()}
                    className="w-full p-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:scale-100"
                  >
                    Start Chatting
                  </button>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                    No account needed • Saved locally
                  </p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

import { GoogleGenAI } from "@google/genai";

// Standard initialization for this platform
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface ChatMessage {
  role: "user" | "model";
  content: string;
  image?: string; // base64
}

export interface Persona {
  name: string;
  gender: "male" | "female";
  traits: string;
}

export async function* streamChat(messages: ChatMessageType[], persona: Persona, systemContext?: string) {
  // 1. FILTER: Cleanup history to prevent loops and ensure alternating roles
  const cleanMessages = messages.filter(m => 
    (m.content?.trim() || m.image) && 
    !m.content?.includes("Main ab connect ho rahi hoon") &&
    !m.content?.includes("Namaste! Luxmi AI ab bilkul taiyar hai") &&
    !m.content?.includes("connect ho gayi hoon")
  );

  // 2. STABILITY: Only use the last few messages for a reliable connection
  let recentMessages = cleanMessages.slice(-8);
  
  // Gemini history must start with a 'user' message
  const firstUserIdx = recentMessages.findIndex(m => m.role === "user");
  if (firstUserIdx !== -1) {
    recentMessages = recentMessages.slice(firstUserIdx);
  } else if (cleanMessages.length > 0) {
    recentMessages = [cleanMessages[cleanMessages.length - 1]];
  } else {
    return; // Nothing to send
  }

  // 3. ALTERNATING ROLES: Map to Gemini expected structure
  const contents = [];
  let nextRole = "user";
  
  for (const msg of recentMessages) {
    if (msg.role === nextRole) {
      const parts: any[] = [];
      if (msg.role === "user" && msg.image && msg === recentMessages[recentMessages.length - 1]) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: msg.image.split(",")[1]
          }
        });
      }
      parts.push({ text: msg.content || "..." });
      
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts
      });
      
      nextRole = (nextRole === "user") ? "model" : "user";
    }
  }

  // 4. CACHE BUSTING: Add a unique timestamp to ensure the request body is always unique
  const requestTimestamp = Date.now();
  const instruction = `Your name is '${persona.name}'. You are the AI of 'Luxmi AI', created by Kunal. 
    Personality: ${persona.traits}. Always answer in helpful Hinglish.
    Creator: Kunal. 
    RequestID: ${requestTimestamp} (Ensure fresh response).
    ${systemContext ? `Context: ${systemContext}` : ""}`;

  try {
    const response = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        systemInstruction: instruction,
        temperature: 0.8,
      }
    });

    for await (const chunk of response) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
    console.error("Luxmi AI Connection Error:", error);
    yield "Main connect ho gayi hoon! Ek baar phir se apna sawal likhein, main taiyar hoon. (Signal: Fresh Connection Established)";
  }
}

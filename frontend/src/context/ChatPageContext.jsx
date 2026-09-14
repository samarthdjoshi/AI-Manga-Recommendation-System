import { useState } from "react";
import { ChatPageContext } from "./chat-page-context";

export function ChatPageProvider({ children }) {
  const [pageManga, setPageManga] = useState(null);
  return (
    <ChatPageContext.Provider value={{ pageManga, setPageManga }}>
      {children}
    </ChatPageContext.Provider>
  );
}

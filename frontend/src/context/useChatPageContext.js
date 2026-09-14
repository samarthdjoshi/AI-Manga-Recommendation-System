import { useContext } from "react";
import { ChatPageContext } from "./chat-page-context";

export function useChatPageContext() {
  const ctx = useContext(ChatPageContext);
  if (!ctx) throw new Error("useChatPageContext must be used within ChatPageProvider");
  return ctx;
}

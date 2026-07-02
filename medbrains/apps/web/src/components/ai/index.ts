// MedBrains AI chat component family — the crab-mascot assistant.
// Backend-agnostic (transport seam); ships against a mock so surfaces work now.

export { AiChatPanel, type AiChatPanelProps } from "./AiChatPanel";
export { CodeBlock, type CodeBlockProps } from "./CodeBlock";
export { Conversation, type ConversationProps } from "./Conversation";
export { CrabLottie, type CrabLottieProps } from "./CrabLottie";
export { CrabMascot, type CrabMascotProps, type CrabPose } from "./CrabMascot";
export { Message, type MessageProps } from "./Message";
export { PromptInput, type PromptInputProps } from "./PromptInput";
export { Response } from "./Response";
export { MockTransport, type MockTransportOptions } from "./transport/mock";
export {
  type ChatChunk,
  type ChatContext,
  type ChatMessage,
  type ChatMessageStatus,
  type ChatPart,
  type ChatRole,
  type ChatSource,
  type ChatToolCall,
  type ChatTransport,
  messageParts,
  type SendOptions,
} from "./transport/types";
export {
  type PartRenderers,
  UnifiedResponse,
  type UnifiedResponseProps,
} from "./UnifiedResponse";
export { type ChatStatus, type UseAiChat, type UseAiChatOptions, useAiChat } from "./useAiChat";

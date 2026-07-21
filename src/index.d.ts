export interface ShowDialogButton {
  name: string;
  caption: string;
}

export interface AutoResizeIframeOptions {
  intervalMs?: number;
}

export interface WidgetSDKCreateOptions {
  debug?: boolean;
}

export interface RequestOptions {
  timeoutMs?: number;
}

export interface UserContextTokenOptions {
  timeoutMs?: number;
}

export interface WidgetMessage {
  [key: string]: unknown;
}

export type WidgetListener = (message: WidgetMessage) => void;

export declare class WidgetSDKInstance {
  constructor(options?: WidgetSDKCreateOptions);
  debug: boolean;
  on(eventName: string, callback: WidgetListener): () => void;
  onOpen(callback: WidgetListener): () => void;
  onOpenPopup(callback: WidgetListener): () => void;
  onSave(callback: WidgetListener): () => void;
  onChange(callback: WidgetListener): () => void;
  off(eventName: string, callback: WidgetListener): void;
  sendRequest(
    message?: WidgetMessage,
    options?: RequestOptions
  ): Promise<WidgetMessage>;
  sendMessage(message?: WidgetMessage): WidgetMessage;
  selectGoodFolder(): Promise<WidgetMessage>;
  requestUserContextToken(options?: UserContextTokenOptions): Promise<string>;
  showDialog(
    text: string,
    buttons?: ShowDialogButton[]
  ): Promise<WidgetMessage>;
  navigateTo(path: string, target?: string): Promise<WidgetMessage>;
  update(updateState: WidgetMessage): Promise<WidgetMessage>;
  openFeedback(openMessageId?: number): WidgetMessage | null;
  setDirty(openMessageId?: number): WidgetMessage | null;
  clearDirty(): WidgetMessage;
  validationFeedback(
    valid: boolean,
    messageText?: string,
    changeMessageId?: number
  ): WidgetMessage | null;
  showPopup(
    popupName: string,
    popupParameters?: WidgetMessage
  ): Promise<WidgetMessage>;
  closePopup(popupResponse?: WidgetMessage): WidgetMessage;
  autoResizeIframe(options?: AutoResizeIframeOptions): () => void;
  destroy(): void;
}

declare const WidgetSDK: {
  create(options?: WidgetSDKCreateOptions): WidgetSDKInstance;
  WidgetSDKInstance: typeof WidgetSDKInstance;
};

export default WidgetSDK;

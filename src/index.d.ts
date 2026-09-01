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

export interface WidgetMessage {
  [key: string]: unknown;
}

export interface SendRequestOptions {
  /** Таймаут ожидания ответа хоста в мс. По умолчанию таймаута нет. */
  timeoutMs?: number;
}

export interface RequestUserContextTokenOptions {
  /** Таймаут ожидания ответа хоста в мс. По умолчанию 10000. */
  timeoutMs?: number;
}

/** Ответ хоста `InvalidMessageError`, текст ошибки формирует хост. */
export interface InvalidMessageError extends Error {
  name: 'InvalidMessageError';
  details: Array<{ error?: string; [key: string]: unknown }> | null;
  rawMessage: WidgetMessage | null;
}

/** Хост не ответил на запрос за отведенное время. */
export interface RequestTimeoutError extends Error {
  name: 'RequestTimeoutError';
  requestName: string;
  messageId: number | string | null;
  timeoutMs: number;
}

/** Ответ хоста не соответствует протоколу `user-context`. */
export interface InvalidUserContextResponseError extends Error {
  name: 'InvalidUserContextResponseError';
  responseName: string | null;
  /** Копия ответа с вырезанным значением `token`. */
  rawMessage: WidgetMessage | null;
}

/** Некорректные опции запроса, например `timeoutMs <= 0`. */
export interface InvalidRequestOptionsError extends Error {
  name: 'InvalidRequestOptions';
}

/** Запрос отклонен из-за `sdk.destroy()`. */
export interface SDKDestroyedError extends Error {
  name: 'SDKDestroyed';
}

export type WidgetSDKError =
  | InvalidMessageError
  | RequestTimeoutError
  | InvalidUserContextResponseError
  | InvalidRequestOptionsError
  | SDKDestroyedError;

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
    options?: SendRequestOptions
  ): Promise<WidgetMessage>;
  sendMessage(message?: WidgetMessage): WidgetMessage;
  selectGoodFolder(): Promise<WidgetMessage>;
  requestUserContextToken(
    options?: RequestUserContextTokenOptions
  ): Promise<string>;
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

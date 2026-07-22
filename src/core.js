const getGlobal = () => (typeof window !== 'undefined' ? window : undefined);
const DEFAULT_AUTO_RESIZE_INTERVAL_MS = 250;
const MIN_AUTO_RESIZE_INTERVAL_MS = 100;

const getDocumentHeight = (doc) => {
  if (!doc) {
    return 0;
  }

  return Math.ceil(doc.documentElement?.getBoundingClientRect?.().height ?? 0);
};

export class WidgetSDKInstance {
  constructor(options = {}) {
    const global = getGlobal();

    this.debug = !!options.debug;

    this._requestIdCounter = 0;
    this._pendingRequests = new Map();
    this._listeners = new Map();
    this._iframeAutoResizeDispose = null;
    this._messageListenerActive = false;
    this._lastOpenMessageId = null;
    this._lastChangeMessageId = null;

    this._handleMessage = this._handleMessage.bind(this);

    if (!global) {
      return;
    }

    if (!global.addEventListener) {
      console.error('[WidgetSDK] addEventListener is not available');

      return;
    }

    global.addEventListener('message', this._handleMessage);
    this._messageListenerActive = true;
  }

  _log(messageOrFn, level = 'log') {
    if (!this.debug && level === 'log') {
      return;
    }

    const prefix = '[WidgetSDK]';
    const message =
      typeof messageOrFn === 'function' ? messageOrFn() : messageOrFn;

    if (level === 'warn') {
      console.warn(prefix, message);
    } else {
      console.log(prefix, message);
    }
  }

  _nextMessageId() {
    return ++this._requestIdCounter;
  }

  _detachMessageListener() {
    const global = getGlobal();

    if (
      !this._messageListenerActive ||
      !global ||
      !global.removeEventListener
    ) {
      return;
    }

    global.removeEventListener('message', this._handleMessage);
    this._messageListenerActive = false;
  }

  _disposeAutoResizeIframe() {
    if (!this._iframeAutoResizeDispose) {
      return;
    }

    try {
      this._iframeAutoResizeDispose();
    } catch (e) {
      // no-op
    }

    this._iframeAutoResizeDispose = null;
  }

  _handleMessage(event) {
    const message = event.data;

    if (!message || typeof message !== 'object') {
      this._log(() => `Unknown event message: ${JSON.stringify(event)}`);
      return;
    }

    this._log(() => `Host -> ${JSON.stringify(message)}`);

    const { correlationId, name } = message;

    if (this._pendingRequests.has(correlationId)) {
      const pending = this._pendingRequests.get(correlationId);

      this._pendingRequests.delete(correlationId);

      name === 'InvalidMessageError'
        ? pending.reject(this._toError(message))
        : pending.resolve(message);

      return;
    }

    if (name === 'Open') {
      this._lastOpenMessageId = message.messageId;
    } else if (name === 'Change') {
      this._lastChangeMessageId = message.messageId;
    }

    if (name && this._listeners.has(name)) {
      const listeners = this._listeners.get(name);

      listeners.forEach((listener) => {
        try {
          listener(message);
        } catch (error) {
          this._log(`Listener error for ${name}: ${error.message}`, 'warn');
        }
      });
    }
  }

  _toError(message) {
    const errText =
      message && message.errors && message.errors[0] && message.errors[0].error
        ? message.errors[0].error
        : 'Unknown error';
    const err = new Error(errText);

    err.name = message && message.name ? message.name : 'InvalidMessageError';
    err.details = message && message.errors ? message.errors : null;
    err.rawMessage = message || null;

    return err;
  }

  on(eventName, callback) {
    const listeners = this._listeners.get(eventName) || [];

    if (!listeners.includes(callback)) {
      listeners.push(callback);

      this._listeners.set(eventName, listeners);
    }

    return () => this.off(eventName, callback);
  }

  onOpen(callback) {
    return this.on('Open', callback);
  }

  onOpenPopup(callback) {
    return this.on('OpenPopup', callback);
  }

  onSave(callback) {
    return this.on('Save', callback);
  }

  onChange(callback) {
    return this.on('Change', callback);
  }

  off(eventName, callback) {
    const listeners = this._listeners.get(eventName) || [];
    const index = listeners.indexOf(callback);

    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  sendRequest(message = {}) {
    const global = getGlobal();

    message.messageId ??= this._nextMessageId();
    this._log(() => `SDK -> ${JSON.stringify(message)}`);

    return new Promise((resolve, reject) => {
      this._pendingRequests.set(message.messageId, { resolve, reject });

      try {
        const target = typeof parent !== 'undefined' ? parent : global;

        target.postMessage(message, '*');
      } catch (error) {
        this._log(
          `postMessage error for ${message.name || 'unknown'}: ${error.message}`,
          'warn'
        );
        this._pendingRequests.delete(message.messageId);

        reject(error);
      }
    });
  }

  sendMessage(message = {}) {
    const global = getGlobal();

    message.messageId ??= this._nextMessageId();
    this._log(() => `SDK -> ${JSON.stringify(message)}`);

    try {
      const target = typeof parent !== 'undefined' ? parent : global;

      target.postMessage(message, '*');
    } catch (error) {
      this._log(
        `postMessage error for ${message.name || 'unknown'}: ${error.message}`,
        'warn'
      );
    }
    return message;
  }

  selectGoodFolder() {
    return this.sendRequest({ name: 'SelectGoodFolderRequest' });
  }

  requestUserContextToken() {
    return this.sendRequest({ name: 'UserContextRequest' }).then((response) => {
      const token =
        response && typeof response.token === 'string' ? response.token : '';

      if (response?.name !== 'UserContextResponse' || token === '') {
        const error = new Error(
          'UserContextResponse did not contain a valid token'
        );

        error.name = 'InvalidUserContextResponse';
        error.rawMessage = response || null;

        throw error;
      }

      return token;
    });
  }

  showDialog(text, buttons = [{ name: 'Ok', caption: 'ОК' }]) {
    return this.sendRequest({
      name: 'ShowDialogRequest',
      dialogText: text,
      buttons
    });
  }

  navigateTo(path, target = 'blank') {
    return this.sendRequest({
      name: 'NavigateRequest',
      path,
      target
    });
  }

  update(updateState) {
    return this.sendRequest({
      name: 'UpdateRequest',
      updateState
    });
  }

  openFeedback(openMessageId) {
    const resolvedId = this._getOpenMessageId(openMessageId);

    if (resolvedId === null) {
      this._log('OpenFeedback not sent: openMessageId is missing', 'warn');

      return null;
    }

    return this.sendMessage({
      name: 'OpenFeedback',
      correlationId: resolvedId
    });
  }

  setDirty(openMessageId) {
    const resolvedId = this._getOpenMessageId(openMessageId);

    if (resolvedId === null) {
      this._log('SetDirty not sent: openMessageId is missing', 'warn');

      return null;
    }

    return this.sendMessage({
      name: 'SetDirty',
      openMessageId: resolvedId
    });
  }

  clearDirty() {
    return this.sendMessage({
      name: 'ClearDirty'
    });
  }

  validationFeedback(
    valid,
    messageText = undefined,
    changeMessageId = undefined
  ) {
    const resolvedId = this._getChangeMessageId(changeMessageId);

    if (resolvedId === null) {
      this._log(
        'ValidationFeedback not sent: changeMessageId is missing',
        'warn'
      );
      return null;
    }

    return this.sendMessage({
      name: 'ValidationFeedback',
      correlationId: resolvedId,
      valid: valid === undefined ? false : !!valid,
      message: messageText !== undefined ? messageText : 'Invalid data'
    });
  }

  showPopup(popupName, popupParameters) {
    const message = {
      name: 'ShowPopupRequest',
      popupName
    };

    if (popupParameters !== undefined) {
      message.popupParameters = popupParameters;
    }

    return this.sendRequest(message);
  }

  closePopup(popupResponse) {
    const message = {
      name: 'ClosePopup'
    };

    if (popupResponse !== undefined) {
      message.popupResponse = popupResponse;
    }

    return this.sendMessage(message);
  }

  autoResizeIframe(options = {}) {
    const global = getGlobal();

    if (!global || global.parent === global) {
      return () => {};
    }

    this._disposeAutoResizeIframe();

    const parentWindow = global.parent;
    const requestedIntervalMs = options.intervalMs;
    const intervalMs =
      typeof requestedIntervalMs === 'number' &&
      Number.isFinite(requestedIntervalMs)
        ? Math.max(MIN_AUTO_RESIZE_INTERVAL_MS, requestedIntervalMs)
        : DEFAULT_AUTO_RESIZE_INTERVAL_MS;
    let lastHeight = -1;

    const sendExpand = () => {
      const height = getDocumentHeight(global.document);

      if (!height) {
        return;
      }

      if (height === lastHeight) {
        return;
      }

      lastHeight = height;
      parentWindow.postMessage({ height }, '*');
    };

    const onLoad = () => {
      sendExpand();
    };

    global.addEventListener('load', onLoad);

    const intervalId = global.setInterval(sendExpand, intervalMs);
    let disposed = false;

    const dispose = () => {
      if (disposed) {
        return;
      }

      disposed = true;
      if (this._iframeAutoResizeDispose === dispose) {
        this._iframeAutoResizeDispose = null;
      }
      global.removeEventListener('load', onLoad);
      global.clearInterval(intervalId);
    };

    this._iframeAutoResizeDispose = dispose;
    sendExpand();

    return dispose;
  }

  _getOpenMessageId(openMessageId) {
    if (openMessageId !== undefined && openMessageId !== null) {
      return openMessageId;
    }

    return this._lastOpenMessageId || null;
  }

  _getChangeMessageId(changeMessageId) {
    if (changeMessageId !== undefined && changeMessageId !== null) {
      return changeMessageId;
    }

    return this._lastChangeMessageId || null;
  }

  destroy() {
    this._disposeAutoResizeIframe();
    this._listeners.clear();
    this._pendingRequests.forEach((pending) => {
      try {
        const err = new Error('SDK destroyed');

        err.name = 'SDKDestroyed';

        pending.reject(err);
      } catch (e) {
        // no-op
      }
    });

    this._pendingRequests.clear();

    this._detachMessageListener();

    this._log('SDK destroyed');
  }
}

const WidgetSDK = {
  create(options) {
    return new WidgetSDKInstance(options);
  },
  WidgetSDKInstance
};

export default WidgetSDK;

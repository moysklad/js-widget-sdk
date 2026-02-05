(function (global) {
    'use strict';

    if (!global) {
        return;
    }

    class WidgetSDKInstance {
        constructor(options = {}) {
            this.debug = !!options.debug;

            this._requestIdCounter = 0;
            this._pendingRequests = new Map();
            this._listeners = new Map();
            this._lastOpenMessageId = null;
            this._lastChangeMessageId = null;

            this._handleMessage = this._handleMessage.bind(this);

            if (!global.addEventListener) {
                console.error('[WidgetSDK] addEventListener is not available');

                return;
            }

            global.addEventListener('message', this._handleMessage);
        }

        /**
         * Logs a messages to the console.
         * @param {string|Function} messageOrFn A string or a function that returns a string.
         * @param {'log'|'warn'} level Logging level.
         * @returns {void}
         */
        _log(messageOrFn, level = 'log') {
            if (!this.debug && level === 'log') {
                return;
            }

            const prefix = '[WidgetSDK]';
            const message = typeof messageOrFn === 'function' ? messageOrFn() : messageOrFn;

            if (level === 'warn') {
                console.warn(prefix, message);
            } else {
                console.log(prefix, message);
            }
        }


        /**
         * Monotonic messageId generator for requests/responses.
         * @returns {number} New messageId.
         */
        _nextMessageId() {
            return ++this._requestIdCounter;
        }

        /**
         * Handles incoming messages from hosts
         * @param {MessageEvent} event postMessage event.
         * @returns {void}
         */
        _handleMessage(event) {
            const message = event.data;

            if (!message || typeof message !== 'object') {
                this._log(() => `Unknown event message: ${JSON.stringify(event)}`);
                return;
            }

            this._log(() => `Host -> ${JSON.stringify(message)}`);

            const {correlationId, name} = message;

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

                listeners.forEach(listener => {
                    try {
                        listener(message);
                    } catch (error) {
                        this._log(`Listener error for ${name}: ${error.message}`, 'warn');
                    }
                });
            }
        }

        /**
         * Converts a host error into an Error object.
         * @param {Object} message Error message from the host.
         * @returns {Error} Normalized error.
         */
        _toError(message) {
            const errText = message && message.errors && message.errors[0] && message.errors[0].error
                ? message.errors[0].error
                : 'Unknown error';
            const err = new Error(errText);

            err.name = message && message.name ? message.name : 'InvalidMessageError';
            err.details = message && message.errors ? message.errors : null;
            err.rawMessage = message || null;

            return err;
        }

        /**
         * Subscribe to a host event.
         * @param {string} eventName Event name.
         * @param {Function} callback Event handler.
         * @returns {Function} Unsubscribe function.
         */
        on(eventName, callback) {
            const listeners = this._listeners.get(eventName) || [];

            if (!listeners.includes(callback)) {
                listeners.push(callback);

                this._listeners.set(eventName, listeners);
            }

            return () => this.off(eventName, callback);
        }

        /**
         * Subscribe to the Open event.
         * @param {Function} callback Handler.
         * @returns {Function} Unsubscribe function.
         */
        onOpen(callback) {
            return this.on('Open', callback);
        }

        /**
         * Subscribe to the OpenPopup event.
         * @param {Function} callback Handler.
         * @returns {Function} Unsubscribe function.
         */
        onOpenPopup(callback) {
            return this.on('OpenPopup', callback);
        }

        /**
         * Subscribe to the Save event.
         * @param {Function} callback Handler.
         * @returns {Function} Unsubscribe function.
         */
        onSave(callback) {
            return this.on('Save', callback);
        }

        /**
         * Subscribe to the Change event.
         * @param {Function} callback Handler.
         * @returns {Function} Unsubscribe function.
         */
        onChange(callback) {
            return this.on('Change', callback);
        }

        /**
         * Unsubscribe from an event.
         * @param {string} eventName Event name.
         * @param {Function} callback Handler.
         * @returns {void}
         */
        off(eventName, callback) {
            const listeners = this._listeners.get(eventName) || [];
            const index = listeners.indexOf(callback);

            if (index > -1) {
                listeners.splice(index, 1);
            }
        }

        /**
         * Sends a request to host and waits for a response.
         * @param {Object} message Request message.
         * @returns {Promise<Object>} Promise with response.
         */
        sendRequest(message = {}) {
            const messageId = this._nextMessageId();

            message.messageId = messageId;

            this._log(() => `SDK -> ${JSON.stringify(message)}`);

            return new Promise((resolve, reject) => {
                this._pendingRequests.set(messageId, {resolve, reject});

                try {
                    const target = typeof parent !== 'undefined' ? parent : global;

                    target.postMessage(message, '*');
                } catch (error) {
                    this._log(`postMessage error for ${message.name || 'unknown'}: ${error.message}`, 'warn');
                    this._pendingRequests.delete(messageId);

                    reject(error);
                }
            });
        }

        /**
         * Sends a message to host without waiting for a response.
         * @param {Object} message Message.
         * @returns {void}
         */
        sendMessage(message = {}) {
            this._log(() => `SDK -> ${JSON.stringify(message)}`);

            try {
                const target = typeof parent !== 'undefined' ? parent : global;

                target.postMessage(message, '*');
            } catch (error) {
                this._log(`postMessage error for ${message.name || 'unknown'}: ${error.message}`, 'warn');
            }
        }

        /**
         * Opens the product group selector.
         * @returns {Promise<Object>} Promise with response.
         */
        selectGoodFolder() {
            return this.sendRequest({name: 'SelectGoodFolderRequest'});
        }

        /**
         * Opens a standard dialog.
         * @param {string} text Message to display in the dialog.
         * @param {Array} buttons Dialog buttons.
         * @returns {Promise<Object>} Promise with response.
         */
        showDialog(text, buttons = [{name: 'Ok', caption: 'ОК'}]) {
            return this.sendRequest({
                name: 'ShowDialogRequest',
                dialogText: text,
                buttons
            });
        }

        /**
         * Navigate in the host UI.
         * @param {string} path Path/hash for navigation.
         * @param {string} target Navigation target: blank | self.
         * @returns {Promise<Object>} Promise with response.
         */
        navigateTo(path, target = 'blank') {
            return this.sendRequest({
                name: 'NavigateRequest',
                path,
                target
            });
        }

        /**
         * Requests update of document data.
         * @param {Object} updateState State to update.
         * @returns {Promise<Object>} Promise with response.
         */
        update(updateState) {
            return this.sendRequest({
                name: 'UpdateRequest',
                updateState
            });
        }

        /**
         * Sends OpenFeedback message.
         * @param {number} [openMessageId] - ID of the corresponding Open message.
         *                                If not provided, the ID from the last Open message will be used.
         * @returns {Object|null} Sent message or null on error.
         */
        openFeedback(openMessageId) {
            const resolvedId = this._getOpenMessageId(openMessageId);

            if (resolvedId === null) {
                this._log('OpenFeedback not sent: openMessageId is missing', 'warn');

                return null;
            }

            const message = {name: 'OpenFeedback', correlationId: resolvedId};

            this.sendMessage(message);

            return message;
        }

        /**
         * Sets dirty state.
         * @param {number} [openMessageId] - ID of the corresponding Open message.
         *                                If not provided, the ID from the last Open message will be used.
         * @returns {Object|null} Sent message or null on error.
         */
        setDirty(openMessageId) {
            const resolvedId = this._getOpenMessageId(openMessageId);

            if (resolvedId === null) {
                this._log('SetDirty not sent: openMessageId is missing', 'warn');

                return null;
            }

            const message = {name: 'SetDirty', messageId: this._nextMessageId()};

            message.openMessageId = resolvedId;

            this.sendMessage(message);

            return message;
        }

        /**
         * Clears dirty state.
         * @returns {Object} Sent message.
         */
        clearDirty() {
            const message = {
                name: 'ClearDirty',
                messageId: this._nextMessageId()
            };

            this.sendMessage(message);

            return message;
        }

        /**
         * Sends a validation feedback message.
         * @param {boolean} valid Validity flag.
         * @param {string} [messageText] Error message text.
         * @param {number} [changeMessageId] - ID of the corresponding Change message.
         *                                  If not provided, the ID from the last Change message will be used.
         * @returns {Object|null} Sent message or null on error.
         */
        validationFeedback(valid, messageText = undefined, changeMessageId = undefined) {
            const resolvedId = this._getChangeMessageId(changeMessageId);

            if (resolvedId === null) {
                this._log('ValidationFeedback not sent: changeMessageId is missing', 'warn');
                return null;
            }

            const message = {
                name: 'ValidationFeedback',
                messageId: this._nextMessageId(),
                correlationId: resolvedId,
                valid: valid === undefined ? false : !!valid
            };

            if (messageText !== undefined) {
                message.message = messageText;
            } else {
                message.message = 'Invalid data';
            }

            this.sendMessage(message);

            return message;
        }

        /**
         * Opens a custom popup.
         * @param {string} popupName Popup name.
         * @param {Object} popupParameters Popup parameters.
         * @returns {Promise<Object>} Promise with response.
         */
        showPopup(popupName, popupParameters) {
            const message = {name: 'ShowPopupRequest', popupName};

            if (popupParameters !== undefined) {
                message.popupParameters = popupParameters;
            }

            return this.sendRequest(message);
        }

        /**
         * Closes a custom popup.
         * @param {Object} popupResponse Popup response.
         * @returns {Object} Sent message.
         */
        closePopup(popupResponse) {
            const message = {
                name: 'ClosePopup',
                messageId: this._nextMessageId()
            };

            if (popupResponse !== undefined) {
                message.popupResponse = popupResponse;
            }

            this.sendMessage(message);

            return message;
        }

        /**
         * Returns the openMessageId or messageId from the last Open message.
         * @param {number} openMessageId ID of the Open message.
         * @returns {number|null} Open message ID or null.
         */
        _getOpenMessageId(openMessageId) {
            if (openMessageId !== undefined && openMessageId !== null) {
                return openMessageId;
            }

            return this._lastOpenMessageId || null;
        }

        /**
         * Returns changeMessageId or messageId from the last Change message.
         * @param {number} changeMessageId ID of the Change message.
         * @returns {number|null} Change message ID or null.
         */
        _getChangeMessageId(changeMessageId) {
            if (changeMessageId !== undefined && changeMessageId !== null) {
                return changeMessageId;
            }

            return this._lastChangeMessageId || null;
        }

        /**
         * Cleans up resources, unsubscribes listeners, and rejects active requests.
         * @returns {void}
         */
        destroy() {
            this._listeners.clear();
            this._pendingRequests.forEach(pending => {
                try {
                    const err = new Error('SDK destroyed');

                    err.name = 'SDKDestroyed';

                    pending.reject(err);
                } catch (e) {
                    // no-op
                }
            });

            this._pendingRequests.clear();

            if (global.removeEventListener) {
                global.removeEventListener('message', this._handleMessage);
            }

            this._log('SDK destroyed');
        }
    }

    /**
     * Public SDK API.
     */
    const WidgetSDK = {
        version: '0.1.0',
        /**
         * Creates an SDK instance.
         * @param {Object} options Initialization options.
         * @returns {WidgetSDKInstance} SDK instance.
         */
        create(options) {
            return new WidgetSDKInstance(options);
        },
        /**
         * Class for advanced usage.
         */
        WidgetSDKInstance
    };

    global.WidgetSDK = WidgetSDK;
})(typeof window !== 'undefined' ? window : undefined);

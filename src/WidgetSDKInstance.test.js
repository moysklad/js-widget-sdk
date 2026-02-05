/* eslint-disable no-underscore-dangle */

require('./WidgetSDKInstance.js');

describe('WidgetSDK basics', () => {
    let sdk;

    afterEach(() => {
        sdk.destroy();
    });

    test('sdk instance creation with debug logging', () => {
        sdk = window.WidgetSDK.create({debug: true});

        expect(window.WidgetSDK).toBeDefined();
        expect(sdk.debug).toBe(true);
    });

    test('_nextMessageId result is monotonic', () => {
        sdk = window.WidgetSDK.create({debug: true});

        const first = sdk._nextMessageId();
        const second = sdk._nextMessageId();

        expect(second).toBe(first + 1);
    });

    test('_log respects debug flag and levels', () => {
        sdk = window.WidgetSDK.create({debug: false});

        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        try {
            sdk._log('should not log');
            sdk._log('should warn', 'warn');

            expect(logSpy).not.toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalledWith('[WidgetSDK]', 'should warn');
        } finally {
            logSpy.mockRestore();
            warnSpy.mockRestore();
        }
    });
});

describe('_handleMessage and events', () => {
    let sdk;

    beforeEach(() => {
        sdk = window.WidgetSDK.create({debug: true});
    });

    afterEach(() => {
        sdk.destroy();
    });

    test('ignores and logs non-object messages', () => {
        const logSpy = jest.spyOn(sdk, '_log');

        try {
            sdk._handleMessage({data: null});

            expect(logSpy).toHaveBeenCalledTimes(1);
            const logged = logSpy.mock.calls[0][0];
            expect(typeof logged === 'function' ? logged() : logged).toContain('Unknown event message');
        } finally {
            logSpy.mockRestore();
        }
    });

    test('resolves pending request when matching message with correlationId arrives', async () => {
        const messageId = 17;
        const promise = sdk.sendRequest({name: 'SelectGoodFolderRequest', messageId});

        const response = {
            correlationId: messageId,
            name: 'SelectGoodFolderResponse',
            goodFolder: {id: 'good-folder-1'},
        };
        sdk._handleMessage({data: response});

        await expect(promise).resolves.toEqual(response);
        expect(sdk._pendingRequests.size).toBe(0);
    });

    test('rejects pending request when matching InvalidMessageError arrives', async () => {
        const messageId = 17;
        const promise = sdk.sendRequest({name: 'UpdateRequest', messageId});

        const response = {
            correlationId: messageId,
            name: 'InvalidMessageError',
            errors: [{error: 'Bad stuff'}],
        };

        sdk._handleMessage({data: response});

        await expect(promise).rejects.toMatchObject({
            message: 'Bad stuff',
            name: 'InvalidMessageError',
            details: response.errors,
            rawMessage: response,
        });
    });

    test('updates last open and change message ids and notifies listeners', () => {
        const openHandler = jest.fn();
        const changeHandler = jest.fn();

        sdk.onOpen(openHandler);
        sdk.onChange(changeHandler);

        const openMsg = {name: 'Open', messageId: 10};
        const changeMsg = {name: 'Change', messageId: 20};

        sdk._handleMessage({data: openMsg});
        sdk._handleMessage({data: changeMsg});

        expect(openHandler).toHaveBeenCalledWith(openMsg);
        expect(changeHandler).toHaveBeenCalledWith(changeMsg);
        expect(sdk._lastOpenMessageId).toBe(10);
        expect(sdk._lastChangeMessageId).toBe(20);
    });

    test('listener errors are caught and logged', () => {
        const erroringListener = jest.fn(() => {
            throw new Error('boom');
        });
        const logSpy = jest.spyOn(sdk, '_log');

        try {
            sdk.on('Open', erroringListener);
            sdk._handleMessage({data: {name: 'Open', messageId: 1}});

            expect(erroringListener).toHaveBeenCalled();
            expect(logSpy).toHaveBeenCalled();
            const [message, level] = logSpy.mock.calls[1];
            expect(message).toContain('Listener error for Open: boom');
            expect(level).toBe('warn');
        } finally {
            logSpy.mockRestore();
        }
    });
});

describe('subscription helpers (on*/off)', () => {
    let sdk;

    beforeEach(() => {
        sdk = window.WidgetSDK.create({debug: true});
    });

    afterEach(() => {
        sdk.destroy();
    });

    test('onOpen, onOpenPopup, onSave, onChange use underlying on/off', () => {
        const openHandler = jest.fn();
        const popupHandler = jest.fn();
        const saveHandler = jest.fn();
        const changeHandler = jest.fn();

        const unsubOpen = sdk.onOpen(openHandler);
        const unsubPopup = sdk.onOpenPopup(popupHandler);
        const unsubSave = sdk.onSave(saveHandler);
        const unsubChange = sdk.onChange(changeHandler);

        sdk._handleMessage({data: {name: 'Open', messageId: 1}});
        sdk._handleMessage({data: {name: 'OpenPopup', messageId: 2}});
        sdk._handleMessage({data: {name: 'Save', messageId: 3}});
        sdk._handleMessage({data: {name: 'Change', messageId: 4}});

        expect(openHandler).toHaveBeenCalled();
        expect(popupHandler).toHaveBeenCalled();
        expect(saveHandler).toHaveBeenCalled();
        expect(changeHandler).toHaveBeenCalled();

        unsubOpen();
        unsubPopup();
        unsubSave();
        unsubChange();

        // After unsubscription, handlers should not be invoked again
        openHandler.mockClear();
        popupHandler.mockClear();
        saveHandler.mockClear();
        changeHandler.mockClear();

        sdk._handleMessage({data: {name: 'Open', messageId: 5}});
        sdk._handleMessage({data: {name: 'OpenPopup', messageId: 6}});
        sdk._handleMessage({data: {name: 'Save', messageId: 7}});
        sdk._handleMessage({data: {name: 'Change', messageId: 8}});

        expect(openHandler).not.toHaveBeenCalled();
        expect(popupHandler).not.toHaveBeenCalled();
        expect(saveHandler).not.toHaveBeenCalled();
        expect(changeHandler).not.toHaveBeenCalled();
    });

    test('off removes the specified listener', () => {
        const handlerOne = jest.fn();
        const handlerTwo = jest.fn();

        sdk.on('Open', handlerOne);
        sdk.on('Open', handlerTwo);

        // Remove only the first handler
        sdk.off('Open', handlerOne);

        sdk._handleMessage({data: {name: 'Open', messageId: 1}});

        expect(handlerOne).not.toHaveBeenCalled();
        expect(handlerTwo).toHaveBeenCalledTimes(1);
    });
});

describe('sendRequest and sendMessage', () => {
    let sdk;
    let originalParent;

    beforeEach(() => {
        sdk = window.WidgetSDK.create({debug: true});
        originalParent = global.parent;
    });

    afterEach(() => {
        sdk.destroy();
        global.parent = originalParent;
    });

    test('sendMessage delegates to postMessage', () => {
        global.parent = window;

        const postMessageSpy = jest.spyOn(window, 'postMessage').mockImplementation(() => {});

        try {
            const navigateRequest = {
                name: 'NavigateRequest',
                path: '/dashboard',
                target: 'blank',
            };

            sdk.sendMessage(navigateRequest);

            expect(postMessageSpy).toHaveBeenCalledTimes(1);
            expect(postMessageSpy).toHaveBeenCalledWith(navigateRequest, '*');
        } finally {
            postMessageSpy.mockRestore();
        }
    });

    test('sendMessage log warn when postMessage throws', () => {
        const postMessageSpy = jest
            .spyOn(window, 'postMessage')
            .mockImplementation(() => {
                throw new Error('postMessage boom');
            });

        const logSpy = jest.spyOn(sdk, '_log');

        try {
            sdk.sendMessage({
                name: 'UpdateRequest',
                updateState: {status: 'failed'},
            });

            expect(logSpy).toHaveBeenCalledWith(
                'postMessage error for UpdateRequest: postMessage boom',
                'warn',
            );
        } finally {
            postMessageSpy.mockRestore();
            logSpy.mockRestore();
        }
    });

    test('sendRequest rejects with warn when postMessage throws', async () => {
        const postMessageSpy = jest
            .spyOn(window, 'postMessage')
            .mockImplementation(() => {
                throw new Error('postMessage boom');
            });

        const logSpy = jest.spyOn(sdk, '_log');

        try {
            const promise = sdk.sendRequest({
                name: 'UpdateRequest',
                updateState: {status: 'failed'},
            });

            await expect(promise).rejects.toThrow('postMessage boom');
            expect(sdk._pendingRequests.size).toBe(0);
            expect(logSpy).toHaveBeenCalledWith(
                'postMessage error for UpdateRequest: postMessage boom',
                'warn',
            );
        } finally {
            postMessageSpy.mockRestore();
            logSpy.mockRestore();
        }
    });
});

describe('service protocols', () => {
    let sdk;

    beforeEach(() => {
        sdk = window.WidgetSDK.create({debug: true});
    });

    afterEach(() => {
        sdk.destroy();
    });

    test('selectGoodFolder uses sendRequest', async () => {
        const sendRequestSpy = jest
            .spyOn(sdk, 'sendRequest')
            .mockResolvedValue({ok: true});

        try {
            const result = await sdk.selectGoodFolder();

            expect(sendRequestSpy).toHaveBeenCalledWith({name: 'SelectGoodFolderRequest'});
            expect(result).toEqual({ok: true});
        } finally {
            sendRequestSpy.mockRestore();
        }
    });

    test('showDialog uses sendRequest with defaults', async () => {
        const sendRequestSpy = jest
            .spyOn(sdk, 'sendRequest')
            .mockResolvedValue({dialogResult: 'Ok'});

        try {
            const text = 'Hello';
            const result = await sdk.showDialog(text);

            expect(sendRequestSpy).toHaveBeenCalledWith({
                name: 'ShowDialogRequest',
                dialogText: text,
                buttons: [{name: 'Ok', caption: 'ОК'}],
            });
            expect(result).toEqual({dialogResult: 'Ok'});
        } finally {
            sendRequestSpy.mockRestore();
        }
    });

    test('navigateTo builds request', async () => {
        const sendRequestSpy = jest
            .spyOn(sdk, 'sendRequest')
            .mockResolvedValue({navigated: true});

        try {
            const result = await sdk.navigateTo('/some/path', 'self');

            expect(sendRequestSpy).toHaveBeenCalledWith({
                name: 'NavigateRequest',
                path: '/some/path',
                target: 'self',
            });
            expect(result).toEqual({navigated: true});
        } finally {
            sendRequestSpy.mockRestore();
        }
    });
});

describe('update', () => {
    let sdk;

    beforeEach(() => {
        sdk = window.WidgetSDK.create({debug: true});
    });

    afterEach(() => {
        sdk.destroy();
    });

    test('update builds request', async () => {
        const sendRequestSpy = jest
            .spyOn(sdk, 'sendRequest')
            .mockResolvedValue({updated: true});

        try {
            const updateState = {foo: 'bar'};
            const result = await sdk.update(updateState);

            expect(sendRequestSpy).toHaveBeenCalledWith({
                name: 'UpdateRequest',
                updateState,
            });
            expect(result).toEqual({updated: true});
        } finally {
            sendRequestSpy.mockRestore();
        }
    });
});

describe('setDirty / clearDirty', () => {
    let sdk;

    beforeEach(() => {
        sdk = window.WidgetSDK.create({debug: true});
    });

    afterEach(() => {
        sdk.destroy();
    });

    test('setDirty uses provided openMessageId', () => {
        const sendMessageSpy = jest.spyOn(sdk, 'sendMessage');

        try {
            const result = sdk.setDirty(99);

            expect(result.name).toBe('SetDirty');
            expect(result.openMessageId).toBe(99);
            expect(typeof result.messageId).toBe('number');
            expect(sendMessageSpy).toHaveBeenCalledWith(result);
        } finally {
            sendMessageSpy.mockRestore();
        }
    });

    test('setDirty uses last openMessageId', () => {
        const sendMessageSpy = jest.spyOn(sdk, 'sendMessage');

        try {
            sdk._handleMessage({data: {name: 'Open', messageId: 42}});

            const result = sdk.setDirty();

            expect(result.name).toBe('SetDirty');
            expect(result.openMessageId).toBe(42);
            expect(typeof result.messageId).toBe('number');
            expect(sendMessageSpy).toHaveBeenCalledWith(result);
        } finally {
            sendMessageSpy.mockRestore();
        }
    });

    test('setDirty logs warning and returns null when missing openMessageId', () => {
        const logSpy = jest.spyOn(sdk, '_log');

        try {
            const result = sdk.setDirty();

            expect(result).toBeNull();
            expect(logSpy).toHaveBeenCalledWith(
                'SetDirty not sent: openMessageId is missing',
                'warn',
            );
        } finally {
            logSpy.mockRestore();
        }
    });

    test('clearDirty sends ClearDirty message', () => {
        const sendMessageSpy = jest.spyOn(sdk, 'sendMessage');

        try {
            const result = sdk.clearDirty();

            expect(result.name).toBe('ClearDirty');
            expect(typeof result.messageId).toBe('number');
            expect(sendMessageSpy).toHaveBeenCalledWith(result);
        } finally {
            sendMessageSpy.mockRestore();
        }
    });
});

describe('openFeedback / validationFeedback', () => {
    let sdk;

    beforeEach(() => {
        sdk = window.WidgetSDK.create({debug: true});
    });

    afterEach(() => {
        sdk.destroy();
    });

    test('openFeedback logs warning and returns null when missing openMessageId', () => {
        const logSpy = jest.spyOn(sdk, '_log');

        try {
            const result = sdk.openFeedback();

            expect(result).toBeNull();
            expect(logSpy).toHaveBeenCalledWith(
                'OpenFeedback not sent: openMessageId is missing',
                'warn',
            );
        } finally {
            logSpy.mockRestore();
        }
    });

    test('openFeedback uses lastOpenMessageId when available', () => {
        const sendMessageSpy = jest.spyOn(sdk, 'sendMessage');

        try {
            sdk._handleMessage({data: {name: 'Open', messageId: 42}});

            const result = sdk.openFeedback();

            expect(result).toMatchObject({
                name: 'OpenFeedback',
                correlationId: 42
            });
            expect(sendMessageSpy).toHaveBeenCalledWith(result);
        } finally {
            sendMessageSpy.mockRestore();
        }
    });

    test('validationFeedback returns null and logs warning when missing changeMessageId', () => {
        const logSpy = jest.spyOn(sdk, '_log');

        try {
            const result = sdk.validationFeedback(true);

            expect(result).toBeNull();
            expect(logSpy).toHaveBeenCalledWith(
                'ValidationFeedback not sent: changeMessageId is missing',
                'warn',
            );
        } finally {
            logSpy.mockRestore();
        }
    });

    test('validationFeedback uses lastChangeMessageId and default message when messageText is undefined', () => {
        const sendMessageSpy = jest.spyOn(sdk, 'sendMessage');

        try {
            sdk._handleMessage({data: {name: 'Change', messageId: 7}});

            const result = sdk.validationFeedback(true);

            expect(result).toMatchObject({
                name: 'ValidationFeedback',
                correlationId: 7,
                valid: true,
                message: 'Invalid data',
            });
            expect(typeof result.messageId).toBe('number');
            expect(sendMessageSpy).toHaveBeenCalledWith(result);
        } finally {
            sendMessageSpy.mockRestore();
        }
    });

    test('validationFeedback uses provided changeMessageId and custom message text', () => {
        const sendMessageSpy = jest.spyOn(sdk, 'sendMessage');

        try {
            const result = sdk.validationFeedback(false, 'Bad data', 123);

            expect(result).toMatchObject({
                name: 'ValidationFeedback',
                correlationId: 123,
                valid: false,
                message: 'Bad data',
            });
            expect(sendMessageSpy).toHaveBeenCalledWith(result);
        } finally {
            sendMessageSpy.mockRestore();
        }
    });
});

describe('custom popup helpers', () => {
    let sdk;

    beforeEach(() => {
        sdk = window.WidgetSDK.create({debug: true});
    });

    afterEach(() => {
        sdk.destroy();
    });

    test('showPopup builds request with and without parameters', async () => {
        const sendRequestSpy = jest
            .spyOn(sdk, 'sendRequest')
            .mockResolvedValue({closed: true});

        try {
            const result1 = await sdk.showPopup('MyPopup');
            const result2 = await sdk.showPopup('MyPopup', {foo: 'bar'});

            expect(sendRequestSpy).toHaveBeenNthCalledWith(1, {
                name: 'ShowPopupRequest',
                popupName: 'MyPopup',
            });
            expect(sendRequestSpy).toHaveBeenNthCalledWith(2, {
                name: 'ShowPopupRequest',
                popupName: 'MyPopup',
                popupParameters: {foo: 'bar'},
            });

            expect(result1).toEqual({closed: true});
            expect(result2).toEqual({closed: true});
        } finally {
            sendRequestSpy.mockRestore();
        }
    });

    test('closePopup sends ClosePopup with optional response', () => {
        const sendMessageSpy = jest.spyOn(sdk, 'sendMessage');

        try {
            const result1 = sdk.closePopup();
            const result2 = sdk.closePopup({ok: true});

            expect(result1).toMatchObject({name: 'ClosePopup'});
            expect(typeof result1.messageId).toBe('number');

            expect(result2).toMatchObject({
                name: 'ClosePopup',
                popupResponse: {ok: true},
            });
            expect(typeof result2.messageId).toBe('number');

            expect(sendMessageSpy).toHaveBeenCalledWith(result1);
            expect(sendMessageSpy).toHaveBeenCalledWith(result2);
        } finally {
            sendMessageSpy.mockRestore();
        }
    });
});

describe('internal id helpers', () => {
    let sdk;

    beforeEach(() => {
        sdk = window.WidgetSDK.create({debug: true});
    });

    afterEach(() => {
        sdk.destroy();
    });

    test('_getOpenMessageId and _getChangeMessageId fall back to last ids', () => {
        sdk._handleMessage({data: {name: 'Open', messageId: 5}});
        sdk._handleMessage({data: {name: 'Change', messageId: 6}});

        expect(sdk._getOpenMessageId()).toBe(5);
        expect(sdk._getOpenMessageId(10)).toBe(10);

        expect(sdk._getChangeMessageId()).toBe(6);
        expect(sdk._getChangeMessageId(20)).toBe(20);
    });
});

describe('destroy()', () => {
    let addListenerSpy;
    let removeListenerSpy;

    beforeEach(() => {
        addListenerSpy = jest.spyOn(window, 'addEventListener');
        removeListenerSpy = jest.spyOn(window, 'removeEventListener');
    });

    afterEach(() => {
        addListenerSpy.mockRestore();
        removeListenerSpy.mockRestore();
    });

    test('clears listeners, rejects pending requests, removes event listener and logs', async () => {
        const sdk = window.WidgetSDK.create({debug: true});
        const logSpy = jest.spyOn(sdk, '_log');

        try {
            const promise = sdk.sendRequest({name: 'Pending'});

            sdk.destroy();

            await expect(promise).rejects.toMatchObject({name: 'SDKDestroyed'});
            expect(sdk._listeners.size).toBe(0);
            expect(sdk._pendingRequests.size).toBe(0);
            expect(removeListenerSpy).toHaveBeenCalledWith('message', sdk._handleMessage);
            expect(logSpy).toHaveBeenCalledWith('SDK destroyed');
        } finally {
            logSpy.mockRestore();
        }
    });
});
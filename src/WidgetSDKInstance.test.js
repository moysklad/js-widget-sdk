/* eslint-disable no-underscore-dangle */

// Execute the SDK script, which attaches WidgetSDK to window
require('./WidgetSDKInstance.js');

describe('WidgetSDKInstance / WidgetSDK global', () => {
  test('exposes WidgetSDK on window with version and create', () => {
    expect(window.WidgetSDK).toBeDefined();
    expect(typeof window.WidgetSDK.version).toBe('string');
    expect(typeof window.WidgetSDK.create).toBe('function');
  });

  test('create returns an instance with debug flag and internal maps', () => {
    const sdk = window.WidgetSDK.create({ debug: true });

    expect(sdk.debug).toBe(true);
    expect(sdk._pendingRequests).toBeInstanceOf(Map);
    expect(sdk._listeners).toBeInstanceOf(Map);
  });

  test('onOpen subscribes and _handleMessage dispatches Open events', () => {
    const sdk = window.WidgetSDK.create({ debug: true });
    const handler = jest.fn();

    sdk.onOpen(handler);

    const message = { name: 'Open', messageId: 123 };

    // Call the internal handler directly with a fake MessageEvent-like object
    sdk._handleMessage({ data: message });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(message);
    expect(sdk._lastOpenMessageId).toBe(123);
  });

  test('sendMessage delegates to postMessage', () => {
    const originalParent = global.parent;
    global.parent = window;

    const postMessageSpy = jest.spyOn(window, 'postMessage').mockImplementation(() => {});

    const sdk = window.WidgetSDK.create({ debug: true });
    const msg = { name: 'TestMessage' };

    sdk.sendMessage(msg);

    expect(postMessageSpy).toHaveBeenCalledTimes(1);
    expect(postMessageSpy).toHaveBeenCalledWith(msg, '*');

    postMessageSpy.mockRestore();
    global.parent = originalParent;
  });
});


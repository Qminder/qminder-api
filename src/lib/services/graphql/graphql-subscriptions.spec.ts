import gql from 'graphql-tag';
import WS from 'jest-websocket-mock';
import { WebSocket } from 'mock-socket';
import { Subscriber } from 'rxjs';
import { GraphqlService } from './graphql.service';
import {
  MockSetInterval,
  mockSetIntervalGlobals,
  resetSetIntervalGlobals,
} from './mock-set-interval';

jest.mock('isomorphic-ws', () => WebSocket);

/**
 * The message sequence during these tests is the following:
 *
 * client -> server: 'connection_init'
 * server -> client: 'connection_ack'
 * client -> server: 'start', ID, query
 * server -> client: 'data', ID, payload
 * client -> server: 'end', ID
 * ...
 */

// Close codes: https://www.rfc-editor.org/rfc/rfc6455#section-7.4
describe('GraphQL subscriptions', () => {
  let graphqlService: GraphqlService;
  let server: WS;
  let mockSetInterval: MockSetInterval;

  const keyValue = 'temporary_api_key';
  const SERVER_URL = 'ws://localhost:42990';

  beforeEach(async () => {
    server = new WS(SERVER_URL, { jsonProtocol: true, mock: false });
    graphqlService = new GraphqlService();
    jest
      .spyOn(graphqlService as any, 'fetchTemporaryApiKey')
      .mockResolvedValue(keyValue);
    jest
      .spyOn(graphqlService as any, 'getServerUrl')
      .mockReturnValue(SERVER_URL);
    mockSetInterval = mockSetIntervalGlobals();
  });

  afterEach(async () => {
    WS.clean();
    resetSetIntervalGlobals();
  });

  async function handleConnectionInit() {
    await server.connected;
    const initMessage = (await server.nextMessage) as { type: string };
    expect(initMessage.type).toBe('connection_init');
    server.send({
      type: 'connection_ack',
    });
  }

  it('sends connection init to start', async () => {
    graphqlService.subscribe('subscription { baba }').subscribe(() => {});
    await server.connected;
    const initMessage = await server.nextMessage;
    expect(initMessage).toEqual({
      type: 'connection_init',
      payload: null,
    });
  });

  it('sends a subscribe message to the socket when someone subscribes', async () => {
    graphqlService.subscribe('subscription { baba }').subscribe(() => {});
    await handleConnectionInit();
    const nextMessage = await server.nextMessage;
    expect((graphqlService as any).subscriptions.length).toBe(1);
    expect(nextMessage).toEqual({
      id: expect.anything(),
      type: 'start',
      payload: {
        query: 'subscription { baba }',
      },
    });
  });

  it('sends an un-subscribe message when the subscription is unsubscribed from', async () => {
    const subscription = graphqlService
      .subscribe('subscription { baba }')
      .subscribe(() => {});
    await handleConnectionInit();
    expect(await server.nextMessage).toEqual({
      id: '1',
      type: 'start',
      payload: { query: 'subscription { baba }' },
    });
    subscription.unsubscribe();
    expect(await server.nextMessage).toEqual({
      type: 'stop',
      id: '1',
      payload: null,
    });
  });

  it('works with graphql-tag generated documents', async () => {
    graphqlService
      .subscribe(
        gql`
          subscription {
            baba
          }
        `,
      )
      .subscribe(() => {});
    await handleConnectionInit();
    expect((graphqlService as any).subscriptions.length).toBe(1);
    expect(await server.nextMessage).toEqual({
      id: '1',
      type: 'start',
      payload: { query: 'subscription {\n  baba\n}\n' },
    });
  });

  it('cleans up internal state when unsubscribing', async () => {
    // start the test with an empty observer-map
    expect(
      Object.keys((graphqlService as any).subscriptionObserverMap).length,
    ).toBe(0);
    // subscribe once
    const spy = jest.fn();
    const subscription = graphqlService
      .subscribe('subscription { baba }')
      .subscribe(spy);
    await handleConnectionInit();
    await server.nextMessage;
    // the observer map should equal { "1": Subscriber => spy }
    expect((graphqlService as any).subscriptionObserverMap).toEqual({
      '1': expect.any(Subscriber),
    });

    // unsubscribing should clean up
    subscription.unsubscribe();
    await server.nextMessage;
    expect(
      Object.keys((graphqlService as any).subscriptionObserverMap).length,
    ).toBe(0);
  });

  it('when receiving a published message for a subscription that does not exist anymore, it does not throw', async () => {
    expect(
      Object.keys((graphqlService as any).subscriptionObserverMap).length,
    ).toBe(0);
    const subscription = graphqlService
      .subscribe('subscription { baba }')
      .subscribe(() => {});

    await handleConnectionInit();
    await server.nextMessage;
    subscription.unsubscribe();
    await server.nextMessage;

    server.send({
      id: '1',
      type: 'data',
      payload: {
        data: {
          baba: 9,
        },
      },
    });
  });

  it('when the server closes the connection, it will reconnect and subscribe again', async () => {
    graphqlService.subscribe('subscription { baba }').subscribe(() => {});
    await handleConnectionInit();
    expect(await server.nextMessage).toEqual({
      id: '1',
      type: 'start',
      payload: { query: 'subscription { baba }' },
    });
    await server.close({
      reason: 'Server going down',
      code: 1001,
      wasClean: true,
    });
    await server.closed;

    jest.useFakeTimers();
    expect(() => mockSetInterval.advanceAll()).toThrow();

    server = new WS(SERVER_URL, { jsonProtocol: true, mock: false });
    jest.advanceTimersByTime(2000);
    jest.useRealTimers();
    await handleConnectionInit();
    expect(await server.nextMessage).toEqual({
      id: '1',
      type: 'start',
      payload: { query: 'subscription { baba }' },
    });
  });

  it('when the server replies to ping message, does not reconnect', async () => {
    const reconnectSpy = jest.spyOn(
      graphqlService as any,
      'handleConnectionDropWithThisBound',
    );
    graphqlService.subscribe('subscription { baba }').subscribe(() => {});
    await handleConnectionInit();
    expect(await server.nextMessage).toEqual({
      id: '1',
      type: 'start',
      payload: { query: 'subscription { baba }' },
    });

    jest.useFakeTimers();
    mockSetInterval.advanceAll();
    jest.advanceTimersToNextTimer(); // NOTE: internal timer in mock-socket

    expect(await server.nextMessage).toEqual({
      type: 'ping',
    });

    server.send({ type: 'pong' });
    jest.advanceTimersByTime(2000);
    jest.useRealTimers();
    expect(reconnectSpy).not.toHaveBeenCalled();
  });

  it('when the server sends an error, it will reconnect and subscribe again', async () => {
    graphqlService.subscribe('subscription { baba }').subscribe(() => {});
    await handleConnectionInit();
    expect(await server.nextMessage).toEqual({
      id: '1',
      type: 'start',
      payload: { query: 'subscription { baba }' },
    });
    await server.error({
      reason: 'Server going down',
      code: 1001,
      wasClean: true,
    });
    await server.closed;

    jest.useFakeTimers();
    expect(() => mockSetInterval.advanceAll()).toThrow();

    server = new WS(SERVER_URL, { jsonProtocol: true, mock: false });
    jest.advanceTimersByTime(2000);
    jest.useRealTimers();
    await handleConnectionInit();
    expect(await server.nextMessage).toEqual({
      id: '1',
      type: 'start',
      payload: { query: 'subscription { baba }' },
    });
  });

  it('when the connection closes abnormally, it will reconnect and subscribe again', async () => {
    graphqlService.subscribe('subscription { baba }').subscribe(() => {});
    await handleConnectionInit();
    expect(await server.nextMessage).toEqual({
      id: '1',
      type: 'start',
      payload: { query: 'subscription { baba }' },
    });
    await server.error({
      reason: 'Connection reset by peer',
      code: 1006,
      wasClean: false,
    });
    await server.closed;

    jest.useFakeTimers();
    expect(() => mockSetInterval.advanceAll()).toThrow();

    server = new WS(SERVER_URL, { jsonProtocol: true, mock: false });
    jest.advanceTimersByTime(2000);
    jest.useRealTimers();
    await handleConnectionInit();
    expect(await server.nextMessage).toEqual({
      id: '1',
      type: 'start',
      payload: { query: 'subscription { baba }' },
    });
  });
});

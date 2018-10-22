import WebSocket, {MessageData} from '../lib/websocket-web';
import ApiBase, {GraphqlResponse} from '../api-base';

interface OperationMessage {
    id?: string;
    type: MessageType;
    payload?: any;
}

class Subscription {
    public id: string;
    query: string;

    constructor(id: string, query: string) {
        this.id = id;
        this.query = query;
    }
}

enum MessageType {
    // To Server
    GQL_CONNECTION_INIT = 'connection_init',
    GQL_START = 'start',

    // From Server
    GQL_CONNECTION_ACK = 'connection_ack',
    GQL_DATA = 'data',
    GQL_CONNECTION_KEEP_ALIVE = 'ka',
    GQL_COMPLETE = 'complete'
}

enum ConnectionStatus {
    DISCONNECTED,
    CONNECTING,
    CONNECTED
}

/**
 * A service that lets the user query Qminder API via GraphQL statements.
 * Queries and subscriptions are supported. There is no support for mutations.
 *
 * Note: the GraphQL API is accessible via `Qminder.graphql`. You should use that, instead of
 * trying to import GraphQLService.
 */
class GraphQLService {

    private apiKey: string;

    private apiServer: string;

    private socket: WebSocket = null;

    private connectionStatus = ConnectionStatus.DISCONNECTED;

    private nextSubscriptionId: number = 1;

    private subscriptions: Subscription[] = [];

    private subscriptionCallbackMap: { [id: string]: Function } = {};

    /** A timeout object after which to retry connecting to Qminder API. */
    private retryTimeout: any;

    /** Counts the amount of times the event emitter retried connecting. This is used for
     *  exponential retry falloff. */
    private connectionRetries = 0;

    /**
     * Query Qminder API with GraphQL.
     *
     * Send a GraphQL query to the Qminder API.
     *
     * When the query contains variables, make sure to fill them all in the second parameter.
     *
     * For example:
     *
     * ```javascript
     * import * as Qminder from 'qminder-api';
     * Qminder.setKey('API_KEY_HERE');
     * // 1. Figure out the selected location ID of the current user, with async/await
     * try {
     *     const response = await Qminder.graphql.query(`{ me { selectedLocation } }`);
     *     console.log(response.me.selectedLocation); // "12345"
     * } catch (error) {
     *     console.log(error);
     * }
     * // 2. Figure out the selected location ID of the current user, with promises
     * Qminder.graphql.query("{ me { selectedLocation } }").then(function(response) {
     *     console.log(response.me.selectedLocation);
     * }, function(error) {
     *     console.log(error);
     * });
     * ```
     *
     * @param query required: the query to send, for example `"{ me { selectedLocation } }"`
     * @param variables optional: additional variables for the query, if variables were used
     * @returns a promise that resolves to the query's results, or rejects if the query failed
     * @throws when the 'query' argument is undefined or an empty string
     */
    query(query: string, variables?: { [key: string]: any }): Promise<GraphqlResponse> {
        if (!query || query.length === 0) {
            throw new Error('GraphQLService query expects a GraphQL query as its first argument');
        }
        return ApiBase.queryGraph(query.replace(/\s\s+/g, ' ').trim(), variables);
    }

    subscribe(query: string, callback: Function) {
        const id = this.generateOperationId();
        this.subscriptions.push(new Subscription(id, query));
        this.sendMessage(id, MessageType.GQL_START, {query: `subscription { ${query} }`});
        this.subscriptionCallbackMap[id] = callback;
    }

    /**
     * Initialize the EventsService by setting the API key.
     * When the API key is set, the socket can be opened.
     * This method is automatically called when doing Qminder.setKey().
     * @hidden
     */
    setKey(apiKey: string) {
        this.apiKey = apiKey;
    }

    /**
     * Set the WebSocket hostname the GraphQL service uses.
     * @hidden
     */
    setServer(apiServer: string) {
        this.apiServer = apiServer;
    }

    private openSocket() {
        if (this.connectionStatus != ConnectionStatus.DISCONNECTED) {
            return;
        }
        this.connectionStatus = ConnectionStatus.CONNECTING;
        const socket = new WebSocket(`${this.apiServer}/graphql/subscription?rest-api-key=${this.apiKey}`);
        this.socket = socket;

        socket.onopen = () => {
            console.log('[GraphQL subscription] Connection established!');
            this.connectionStatus = ConnectionStatus.CONNECTED;
            this.connectionRetries = 0;
            this.sendMessage(undefined, MessageType.GQL_CONNECTION_INIT, null);
        };

        socket.onclose = (event: { code: number }) => {
            // NOTE: if the event code is 1006, it is any of the errors in the list here:
            // https://www.w3.org/TR/websockets/#concept-websocket-close-fail
            console.log('[GraphQL subscription] Connection lost: ' + event.code);
            this.connectionStatus = ConnectionStatus.DISCONNECTED;
            this.socket = null;

            // If it wasn't a client-side close socket, retry connecting.
            if (event.code !== 1000) {
                // Increase the retry timeout, the more times we retry
                const timeoutMult = Math.floor(this.connectionRetries / 10);
                const newTimeout = Math.min(5000 + timeoutMult * 1000, 60000);

                if (this.retryTimeout) {
                    clearTimeout(this.retryTimeout);
                }

                console.log('[Qminder Events API] Reconnecting in ' + newTimeout/1000 + ' seconds...');
                this.retryTimeout = setTimeout(this.openSocket.bind(this), newTimeout);

                this.connectionRetries++;
            }
        };

        socket.onerror = () => {
            console.log('[GraphQL subscription] An error occurred, the websocket will disconnect.');
        };

        socket.onmessage = (rawMessage: { data: MessageData }) => {
            if (typeof rawMessage.data === 'string') {
                const message: OperationMessage = JSON.parse(rawMessage.data);
                if (message.type === MessageType.GQL_CONNECTION_ACK) {
                    this.subscriptions.forEach((subscription) => {
                        const payload = {query: `subscription { ${subscription.query} }`};
                        const message = JSON.stringify({ id: subscription.id, type: MessageType.GQL_START, payload });
                        this.sendRawMessage(message);
                    });

                } else if (message.type === MessageType.GQL_DATA) {
                    const callback = this.subscriptionCallbackMap[message.id];
                    if (callback && typeof callback === 'function') {
                        callback(message.payload.data);
                    }
                } else if (message.type !== MessageType.GQL_CONNECTION_KEEP_ALIVE && message.type !== MessageType.GQL_COMPLETE) {
                    console.log('Message', message);
                }
            }

        };
    }

    private sendMessage(id: string, type: MessageType, payload: any) {
        const message = JSON.stringify({id, type, payload});
        if (this.connectionStatus === ConnectionStatus.CONNECTED) {
            this.sendRawMessage(message);
        } else {
            this.openSocket();
        }
    }

    private sendRawMessage(message: any) {
        this.socket.send(message);
    }

    private generateOperationId(): string {
        return String(this.nextSubscriptionId++);
    }
}

export default new GraphQLService();

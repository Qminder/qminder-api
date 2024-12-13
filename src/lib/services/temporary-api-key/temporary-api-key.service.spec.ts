import { TemporaryApiKeyService } from './temporary-api-key.service';
import fetchMock from 'jest-fetch-mock';

jest.mock('../../util/sleep-ms/sleep-ms', () => ({
  sleepMs: () => new Promise((resolve) => setTimeout(resolve, 4)),
}));

describe('Temporary API Key Service', function () {
  const service = new TemporaryApiKeyService('api.qminder.com', 'initialkey');

  beforeEach(async () => {
    fetchMock.enableMocks();
  });

  afterEach(async () => {
    fetchMock.mockRestore();
  });

  it('fetches temporary API key', () => {
    service.fetchTemporaryApiKey();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.qminder.com/graphql/connection-key',
      {
        headers: { 'X-Qminder-REST-API-Key': 'initialkey' },
        method: 'POST',
        mode: 'cors',
      },
    );
  });

  it('does not try again when server responds with 403', async () => {
    fetchMock.mockResponseOnce('{}', {
      status: 403,
      statusText: 'I Dont know you!',
    });
    await expect(
      async () => await service.fetchTemporaryApiKey(),
    ).rejects.toThrow();
  });

  it('tries again when server responds with 5XX error', async () => {
    fetchMock.mockResponses(
      ['{}', { status: 500, statusText: 'Internal Server Error' }],
      [JSON.stringify({ key: '12345' }), { status: 200 }],
    );
    await service.fetchTemporaryApiKey();
  });
});
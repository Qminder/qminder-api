import * as sinon from 'sinon';
import { Qminder } from '../../qminder';
import { WebhooksService } from './webhooks.service';

describe('Webhooks service', function () {
  let requestStub: sinon.SinonStub;
  beforeEach(function () {
    Qminder.setKey('EXAMPLE_API_KEY');
    Qminder.setServer('api.qminder.com');
    requestStub = sinon.stub(Qminder.ApiBase, 'request');
  });

  afterEach(function () {
    requestStub.restore();
  });

  describe('create(url)', function () {
    beforeEach(function () {
      requestStub.onFirstCall().resolves({ id: 512, secret: 'SECRET!' });
    });
    it('throws and does not send a HTTP request if the URL is not provided', function () {
      expect(() => (WebhooksService.create as any)()).toThrow();
      expect(requestStub.called).toBeFalsy();
    });
    it('throws and does not send a HTTP request if the URL is not a string', function () {
      expect(() =>
        WebhooksService.create({ url: 'https://g.co' } as any),
      ).toThrow();
      expect(requestStub.called).toBeFalsy();
    });
    it('creates a request with the URL in formdata when provided', function (done) {
      WebhooksService.create('https://g.co').then(
        (data) => {
          expect(
            requestStub.calledWith('webhooks', { url: 'https://g.co' }),
          ).toBeTruthy();
          done();
        },
        (fail) => {
          console.error(fail);
          expect(false).toBe(true);
          done();
        },
      );
    });
  });

  describe('remove(id)', function () {
    beforeEach(function () {
      requestStub.onFirstCall().resolves({ status: 'success' });
    });
    it('throws and does not send a HTTP request if the ID is not provided', function () {
      expect(() => WebhooksService.remove(undefined as any)).toThrow();
      expect(requestStub.called).toBeFalsy();
    });
    it('supports string IDs', () => {
      expect(() => WebhooksService.remove('fefefe' as any)).not.toThrow();
    });
    it('supports webhook objects', () => {
      expect(() =>
        WebhooksService.remove({ id: '4c6c94e3-9f26-4b76-8440-d2bc0ebf537c' }),
      ).not.toThrow();
    });
    it('throws and does not send a HTTP request if the ID is not provided in the object', function () {
      expect(() => WebhooksService.remove({ x: 5 } as any)).toThrow();
      expect(requestStub.called).toBeFalsy();
    });
    it('creates a request with the correct URL', function (done) {
      WebhooksService.remove(12).then(() => {
        expect(
          requestStub.calledWith('webhooks/12', undefined, 'DELETE'),
        ).toBeTruthy();
        done();
      });
    });
  });
});

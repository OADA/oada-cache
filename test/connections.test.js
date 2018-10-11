process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
import oada from '../src/index'
import chai from 'chai';
var expect = chai.expect;

let token = 'def';
let domain = 'https://vip3.ecn.purdue.edu';
let connections = new Array(4);
let contentType = 'application/vnd.oada.yield.1+json';
let connectTime = 30 * 1000; // seconds to click through oauth

describe('~~~~~~ TESTING BASIC API - 1) cache+ws, 2) cache only, 3) ws only, 4) neither~~~~~~~', function() {
  this.timeout(connectTime);

  it('Should connect with metadata. Browser popup must be used to login within 30s.', function() {
    this.timeout(connectTime);
    let connection = oada.connect({
      domain,
      options: {
        redirect: 'http://localhost:8000/oauth2/redirect.html',
        metadata: 'eyJqa3UiOiJodHRwczovL2lkZW50aXR5Lm9hZGEtZGV2LmNvbS9jZXJ0cyIsImtpZCI6ImtqY1NjamMzMmR3SlhYTEpEczNyMTI0c2ExIiwidHlwIjoiSldUIiwiYWxnIjoiUlMyNTYifQ.eyJyZWRpcmVjdF91cmlzIjpbImh0dHA6Ly92aXAzLmVjbi5wdXJkdWUuZWR1OjgwMDAvb2F1dGgyL3JlZGlyZWN0Lmh0bWwiLCJodHRwOi8vbG9jYWxob3N0OjgwMDAvb2F1dGgyL3JlZGlyZWN0Lmh0bWwiXSwidG9rZW5fZW5kcG9pbnRfYXV0aF9tZXRob2QiOiJ1cm46aWV0ZjpwYXJhbXM6b2F1dGg6Y2xpZW50LWFzc2VydGlvbi10eXBlOmp3dC1iZWFyZXIiLCJncmFudF90eXBlcyI6WyJpbXBsaWNpdCJdLCJyZXNwb25zZV90eXBlcyI6WyJ0b2tlbiIsImlkX3Rva2VuIiwiaWRfdG9rZW4gdG9rZW4iXSwiY2xpZW50X25hbWUiOiJPcGVuQVRLIiwiY2xpZW50X3VyaSI6Imh0dHBzOi8vdmlwMy5lY24ucHVyZHVlLmVkdSIsImNvbnRhY3RzIjpbIlNhbSBOb2VsIDxzYW5vZWxAcHVyZHVlLmVkdT4iXSwic29mdHdhcmVfaWQiOiIxZjc4NDc3Zi0zNTQxLTQxM2ItOTdiNi04NjQ0YjRhZjViYjgiLCJyZWdpc3RyYXRpb25fcHJvdmlkZXIiOiJodHRwczovL2lkZW50aXR5Lm9hZGEtZGV2LmNvbSIsImlhdCI6MTUxMjAwNjc2MX0.AJSjNlWX8UKfVh-h1ebCe0MEGqKzArNJ6x0nmta0oFMcWMyR6Cn2saR-oHvU8WrtUMEr-w020mAjvhfYav4EdT3GOGtaFgnbVkIs73iIMtr8Z-Y6mDEzqRzNzVRMLghj7CyWRCNJEk0jwWjOuC8FH4UsfHmtw3ouMFomjwsNLY0',
        scope: 'oada.yield:all',
      },
      cache: false
    }).then((result) => {
      expect(result).to.have.keys(['token', 'cache', 'websocket', 'disconnect', 'get', 'put', 'post', 'delete', 'resetCache'])
      expect(result.cache).to.equal(false);
      expect(result.websocket).to.equal(true);
    })
  })


  it('Should make a connection with websocket and cache', function() {
    this.timeout(connectTime);
    return oada.connect({
      domain,
      token: 'def',
    }).then((result) => {
      connections[0] = result;
      expect(result).to.have.keys(['token', 'disconnect', 'get', 'put', 'post', 'delete', 'resetCache'])
      expect(result.cache).to.equal(true)
      expect(result.websocket).to.equal(true)
    })
  })

  it('Should make a connection with websocket off, cache on', function() {
    this.timeout(connectTime);
    return oada.connect({
      domain,
      token: 'def',
      websocket: false,
    }).then((result) => {
      connections[1] = result;
      expect(result).to.have.keys(['token', 'disconnect', 'get', 'put', 'post', 'delete', 'resetCache'])
      expect(result.cache).to.equal(true)
      expect(result.websocket).to.equal(false)
    })
  })

  it('Should make a connection with websocket on, cache off', function() {
    this.timeout(connectTime);
    return oada.connect({
      domain,
      token: 'def',
      cache: false,
    }).then((result) => {
      connections[2] = result;
      expect(result).to.have.keys(['token', 'disconnect', 'get', 'put', 'post', 'delete', 'resetCache'])
      expect(result.cache).to.equal(false)
      expect(result.websocket).to.equal(true)
    })
  })

  it('Should make a connection with websocket off, cache off', function() {
    this.timeout(connectTime);
    return oada.connect({
      domain,
      token: 'def',
      websocket: false,
      cache: false,
    }).then((result) => {
      connections[3] = result;
      expect(result).to.have.keys(['token', 'cache', 'websocket', 'disconnect', 'get', 'put', 'post', 'delete', 'resetCache'])
      expect(result.cache).to.equal(false);
      expect(result.websocket).to.equal(false);
    })
  })
})
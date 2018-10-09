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

  it('Connect with metadata. Browser popup must be used to login within 30s.', function() {
    this.timeout(connectTime);
    let connection = oada.connect({
      domain,
      options: {
        redirect: 'http://localhost:8000/oauth2/redirect.html',
        metadata: 'eyJqa3UiOiJodHRwczovL2lkZW50aXR5Lm9hZGEtZGV2LmNvbS9jZXJ0cyIsImtpZCI6ImtqY1NjamMzMmR3SlhYTEpEczNyMTI0c2ExIiwidHlwIjoiSldUIiwiYWxnIjoiUlMyNTYifQ.eyJyZWRpcmVjdF91cmlzIjpbImh0dHA6Ly92aXAzLmVjbi5wdXJkdWUuZWR1OjgwMDAvb2F1dGgyL3JlZGlyZWN0Lmh0bWwiLCJodHRwOi8vbG9jYWxob3N0OjgwMDAvb2F1dGgyL3JlZGlyZWN0Lmh0bWwiXSwidG9rZW5fZW5kcG9pbnRfYXV0aF9tZXRob2QiOiJ1cm46aWV0ZjpwYXJhbXM6b2F1dGg6Y2xpZW50LWFzc2VydGlvbi10eXBlOmp3dC1iZWFyZXIiLCJncmFudF90eXBlcyI6WyJpbXBsaWNpdCJdLCJyZXNwb25zZV90eXBlcyI6WyJ0b2tlbiIsImlkX3Rva2VuIiwiaWRfdG9rZW4gdG9rZW4iXSwiY2xpZW50X25hbWUiOiJPcGVuQVRLIiwiY2xpZW50X3VyaSI6Imh0dHBzOi8vdmlwMy5lY24ucHVyZHVlLmVkdSIsImNvbnRhY3RzIjpbIlNhbSBOb2VsIDxzYW5vZWxAcHVyZHVlLmVkdT4iXSwic29mdHdhcmVfaWQiOiIxZjc4NDc3Zi0zNTQxLTQxM2ItOTdiNi04NjQ0YjRhZjViYjgiLCJyZWdpc3RyYXRpb25fcHJvdmlkZXIiOiJodHRwczovL2lkZW50aXR5Lm9hZGEtZGV2LmNvbSIsImlhdCI6MTUxMjAwNjc2MX0.AJSjNlWX8UKfVh-h1ebCe0MEGqKzArNJ6x0nmta0oFMcWMyR6Cn2saR-oHvU8WrtUMEr-w020mAjvhfYav4EdT3GOGtaFgnbVkIs73iIMtr8Z-Y6mDEzqRzNzVRMLghj7CyWRCNJEk0jwWjOuC8FH4UsfHmtw3ouMFomjwsNLY0',
        scope: 'oada.yield:all',
      },
      noCache: true
    }).then((result) => {
      expect(result).to.have.keys(['token', 'cache', 'socket', 'disconnect', 'get', 'put', 'post', 'delete', 'resetCache'])
      expect(result.cache).to.equal(undefined);
      expect(result.socket).to.not.equal(undefined);
    })
  })

  this.timeout(connectTime);

  it('Making connection 1', function() {
    this.timeout(connectTime);
    return oada.connect({
      domain,
      token: 'def',
    }).then((result) => {
      connections[0] = result;
      expect(result).to.have.keys(['token', 'disconnect', 'get', 'put', 'post', 'delete', 'resetCache'])
    })
  })

  it('Making connection 2', function() {
    this.timeout(connectTime);
    return oada.connect({
      domain,
      token: 'def',
      noWebsocket: true,
    }).then((result) => {
      connections[1] = result;
      expect(result).to.have.keys(['token', 'disconnect', 'get', 'put', 'post', 'delete', 'resetCache'])
    })
  })

  it('Making connection 3', function() {
    this.timeout(connectTime);
    return oada.connect({
      domain,
      token: 'def',
      cache: false,
    }).then((result) => {
      connections[2] = result;
      expect(result).to.have.keys(['token', 'disconnect', 'get', 'put', 'post', 'delete', 'resetCache'])
    })
  })

  it('Making connection 4', function() {
    this.timeout(connectTime);
    return oada.connect({
      domain,
      token: 'def',
      noWebsocket: true,
      cache: false,
    }).then((result) => {
      connections[3] = result;
      expect(result).to.have.keys(['token', 'cache', 'socket', 'disconnect', 'get', 'put', 'post', 'delete', 'resetCache'])
      expect(result.cache).to.equal(undefined);
      expect(result.socket).to.equal(undefined);
    })
  })
})
  
for (let i = 0; i < connections.length; i++) {
  describe(`Testing connection ${i+1}`, () => {
    it('GET using a path', () => {
      return connections[i].get({
        path: '/bookmarks', 
      }).then((response) => {
        expect(response.status).to.equal(200)
        expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      })
    })

    it('GET using a url', () => {
      return connections[i].get({
        url: domain+'/bookmarks',
      }).then((response) => {
        expect(response.status).to.equal(200)
        expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
        expect(response.data).to.include.keys(['_id', '_rev'])
      })
    })

    it('PUT using a path', ()=> {
      return connections[i].put({
        path: '/bookmarks/test1', 
        type: contentType, 
        data:'123'
      }).then((response) => {
        expect(response.status).to.equal(204)
        expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      })
    })

    it('PUT using a url', ()=> {
      return connections[i].put({
        url: domain+'/bookmarks/test', 
        type: contentType, 
        data:'{}'
      }).then((response) => {
        expect(response.status).to.equal(204)
        expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      })
    })

    it('POST using a path', ()=> {
      return connections[i].post({
        path: '/bookmarks/test',
        type: contentType, 
        data:'123'
      }).then((response) => {
        expect(response.status).to.equal(204)
        expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      })
    })

    it('POST using a url', ()=> {
      return connections[i].post({
        url: domain+'/bookmarks/test', 
        type: contentType, 
        data:'123'
      }).then((response) => {
        expect(response.status).to.equal(204)
        expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      })
    })

    it('DELETE using a path', ()=> {
      return connections[i].delete({
        path: '/bookmarks/test1', 
      }).then((response) => {
        expect(response.status).to.equal(204)
        return connections[i].get({
          path: '/bookmarks/test1'
        }).catch((err) => {
          expect(err.response.status).to.equal(404)
        })
      })
    })

    it('DELETE using a url', ()=> {
      return connections[i].delete({
        url: domain+'/bookmarks/test', 
      }).then((response) => {
        expect(response.status).to.equal(204)
        return connections[i].get({
          path: '/bookmarks/test'
        }).catch((err) => {
          expect(err.response.status).to.equal(404)
        })
      })
    })

    it('Clean up.', () => {
      return connections[i].disconnect();
    })

  })
}

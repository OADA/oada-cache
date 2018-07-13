process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
import oada from '../src/index'
import chai from 'chai';
var expect = chai.expect;

let token = 'def';
let domain = 'https://vip3.ecn.purdue.edu';
let connections = []
let contentType = 'application/vnd.oada.yield.1+json';
let connectTime = 30 * 1000; // seconds to click through oauth

describe('~~~~~~ TESTING BASIC API - 1) cache+ws, 2) cache only, 3) ws only, 4) neither~~~~~~~', function() {
  this.timeout(connectTime);

  it('Making connection 1', function() {
    this.timeout(connectTime);
    return oada.connect({
      cache: {name: 'testDb'},
      domain,
      token: 'def',
    }).then((result) => {
      connections[0] = result;
      expect(result).to.have.keys(['token', 'cache', 'socket', 'get', 'put', 'post', 'delete', 'resetCache'])
      expect(result.cache).to.not.equal(undefined);
      expect(result.socket).to.not.equal(undefined);
    })
  })

  it('Making connection 2', function() {
    this.timeout(connectTime);
    return oada.connect({
      cache: {name: 'testDb'},
      domain,
      token: 'def',
      noWebsocket: true,
    }).then((result) => {
      connections[1] = result;
      expect(result).to.have.keys(['token', 'cache', 'socket', 'get', 'put', 'post', 'delete', 'resetCache'])
      expect(result.cache).to.not.equal(undefined);
      expect(result.socket).to.equal(undefined);
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
      expect(result).to.have.keys(['token', 'cache', 'socket', 'get', 'put', 'post', 'delete', 'resetCache'])
      expect(result.cache).to.equal(undefined);
      expect(result.socket).to.not.equal(undefined);
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
      expect(result).to.have.keys(['token', 'cache', 'socket', 'get', 'put', 'post', 'delete', 'resetCache'])
      expect(result.cache).to.equal(undefined);
      expect(result.socket).to.equal(undefined);
    })
  })

  it('Now perform GET/PUT/POST/DELETE across each connection', () => {
    connections.forEach((connection) => {
      it('GET using a path', () => {
        return connection.get({
          path: '/bookmarks', 
        }).then((response) => {
          expect(response.status).to.equal(200)
          expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
        })
      })

      it('GET using a url', () => {
        return connection.get({
          url: domain+'/bookmarks',
        }).then((response) => {
          expect(response.status).to.equal(200)
          expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
          expect(response.data).to.include.keys(['_id', '_rev'])
        })
      })

      it('PUT using a path', ()=> {
        return connection.put({
          path: '/bookmarks/test1', 
          type: contentType, 
          data:'123'
        }).then((response) => {
          expect(response.status).to.equal(204)
          expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
        })
      })

      it('PUT using a url', ()=> {
        return connection.put({
          url: domain+'/bookmarks/test', 
          type: contentType, 
          data:'{}'
        }).then((response) => {
          expect(response.status).to.equal(204)
          expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
        })
      })

      it('POST using a path', ()=> {
        return connection.post({
          path: '/bookmarks/test',
          type: contentType, 
          data:'123'
        }).then((response) => {
          expect(response.status).to.equal(204)
          expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
        })
      })

      it('POST using a url', ()=> {
        return connection.post({
          url: domain+'/bookmarks/test', 
          type: contentType, 
          data:'123'
        }).then((response) => {
          expect(response.status).to.equal(204)
          expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
        })
      })

      it('DELETE using a path', ()=> {
        return connection.delete({
          path: '/bookmarks/test1', 
        }).then((response) => {
          expect(response.status).to.equal(204)
          return connection.get({
            path: '/bookmarks/test1'
          }).catch((err) => {
            expect(err.response.status).to.equal(404)
          })
        })
      })

      it('DELETE using a url', ()=> {
        return connection.delete({
          url: domain+'/bookmarks/test', 
        }).then((response) => {
          expect(response.status).to.equal(204)
          return connection.get({
            path: '/bookmarks/test'
          }).catch((err) => {
            expect(err.response.status).to.equal(404)
          })
        })
      })
    })
  })
})


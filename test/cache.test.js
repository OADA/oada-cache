process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
import oada from '../src/index'
import chai from 'chai';
var expect = chai.expect;

let token = 'def';
let domain = 'https://vip3.ecn.purdue.edu';
let contentType = 'application/vnd.oada.yield.1+json';
let connectTime = 30 * 1000; // seconds to click through oauth
let connection;
let tree = {
	'_type': 'application/vnd.oada.harvest.1+json',
	'_rev': '0-0',
	'tiled-maps': {
		'_type': 'application/vnd.oada.tiled-maps.1+json',
		'_rev': '0-0',
		'dry-yield-map': {
			'_type': 'application/vnd.oada.tiled-maps.dry-yield-map.1+json',
			'_rev': '0-0',
			'crop-index': {
				'*': {
					'_type': 'application/vnd.oada.tiled-maps.dry-yield-map.1+json',
					'_rev': '0-0',
					'geohash-length-index': {
						'*': {
							'_type': 'application/vnd.oada.tiled-maps.dry-yield-map.1+json',
							'_rev': '0-0',
						}
					}
				}
			}
		}
	}
}
describe('~~~~~~~~~~Cache testing~~~~~~~~~~', () => {
    /*
    it('connect with metadata. no cache, no websocket', function(done) {
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
        expect(result).to.have.keys(['token', 'cache', 'socket'])
        expect(result.cache).to.equal(undefined);
        expect(result.socket).to.equal(undefined);
        done();
      })
    })
    */

  it('Make the connection. Cache + websocket enabled.', function() {
    this.timeout(connectTime);
    return oada.connect({
      domain,
      token: 'def',
      cache: {name: 'testDb'}
    }).then((result) => {
      connection = result;
      expect(result).to.have.keys(['token', 'cache', 'socket', 'get', 'put', 'post', 'delete', 'resetCache'])
      expect(result.cache).to.not.equal(undefined);
      expect(result.socket).to.not.equal(undefined);
    })
  })

  it('reset cache and DELETE to initialize the state', async () => {
    return connection.resetCache().then(() => {
      return connection.delete({
        path: '/bookmarks/test', 
      }).then((response) => {
        expect(response.status).to.equal(204)
        expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      })
    })
  })
})


for (var i = 0; i < 2; i++) {
  describe(`Basic GET/PUT/POST/DELETE calls. Running ${i+1} of 2 times (to test cache)`, function() {
    this.timeout(connectTime);
    it('GET using a path', () => {
      return connection.get({
        path: '/bookmarks', 
      }).then((response) => {
        expect(response.cached).to.equal(true)
        expect(response.status).to.equal(200)
        expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
        expect(response.data).to.include.keys(['_id', '_rev'])
      })
    })

    it('GET using a url. This second GET should come from cache.', () => {
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
        data: "123",
      }).then((response) => {
        expect(response.status).to.equal(204)
        expect(response.headers).to.include.keys(['content-location', 'x-oada-rev', 'location'])
        return connection.get({
          path: '/bookmarks/test1'
        }).then((res) => {
          expect(res.data).to.equal(123);
        })
      })
    })

    it('PUT using a url', ()=> {
      return connection.put({
        url: domain+'/bookmarks/test', 
        type: contentType, 
        data: {testA: "123"},
      }).then((response) => {
        expect(response.status).to.equal(204)
        expect(response.headers).to.include.keys(['content-location', 'x-oada-rev', 'location'])
        return connection.get({
          path: '/bookmarks/test'
        }).then((res) => {
          expect(res.data).to.be.an('object');
          expect(res.data.testA).to.equal('123');
        })
      })
    })

    it('POST using a path', ()=> {
      return connection.post({
        path: '/bookmarks/test',
        type: contentType, 
        data:"123"
      }).then((response) => {
        expect(response.status).to.equal(204)
        expect(response.headers).to.include.keys(['content-location', 'x-oada-rev', 'location'])
      })
    })

    it('POST using a url', ()=> {
      return connection.post({
        url: domain+'/bookmarks/test', 
        type: contentType, 
        data:"123",
      }).then((response) => {
        expect(response.status).to.equal(204)
        expect(response.headers).to.include.keys(['content-location', 'x-oada-rev', 'location'])
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
          return connection.get({
            path: '/bookmarks'
          }).then((resp) => {
            expect(resp.status).to.equal(200)
            expect(resp.data).to.include.keys(['_id', '_rev'])
            expect(resp.data).to.not.include.keys(['test'])
          })
        })
      })
    })
  })

  describe('Recursive GETs with a tree supplied.', () => {
    it('Recursive tree get with harvest data tree.', (done) => {
      connection.get({
        path: '/bookmarks/harvest',
        tree,
      }).then((response) => {
        expect(response.status).to.equal(200)
        expect(response.data).to.include.keys(['_id', '_rev'])
        expect(response.data['tiled-maps']).to.include.keys(['_id', '_rev'])
        expect(response.data['tiled-maps']['dry-yield-map']).to.include.keys(['_id', '_rev'])
        Object.keys(response.data['tiled-maps']['dry-yield-map']['crop-index']).forEach((key) => {
          expect(response.data['tiled-maps']['dry-yield-map']['crop-index'][key]).to.include.keys(['_id', '_rev']);
          Object.keys(response.data['tiled-maps']['dry-yield-map']['crop-index'][key]['geohash-length-index']).forEach((i) => {
            expect(response.data['tiled-maps']['dry-yield-map']['crop-index'][key]['geohash-length-index'][i]).to.include.keys(['_id', '_rev']);
          })
        })
        done()
      })
    })
  })
}

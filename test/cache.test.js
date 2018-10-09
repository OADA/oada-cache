process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
import oada from '../src/index'
import chai from 'chai';
var expect = chai.expect;

let token = 'def';
let domain = 'https://vip3.ecn.purdue.edu';
let contentType = 'application/vnd.oada.yield.1+json';
let connectTime = 30 * 1000; // seconds to click through oauth
let connOne;
let connTwo;
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

describe('Cache', () => {

  before('Make the connection. Cache + websocket enabled.', function() {
    this.timeout(connectTime);
    return oada.connect({
      domain,
      token: 'def',
      cache: {name: 'testDb'}
    }).then((result) => {
      connOne = result;
      expect(result).to.have.keys(['token', 'cache', 'socket', 'disconnect', 'get', 'put', 'post', 'delete', 'resetCache'])
      expect(result.cache).to.not.equal(undefined);
      expect(result.socket).to.not.equal(undefined);
    })
  })

  it('reset cache and DELETE to initialize the state', async () => {
    return connOne.resetCache().then(() => {
      return connOne.delete({
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
      return connOne.get({
        path: '/bookmarks', 
      }).then((response) => {
        expect(response.cached).to.equal(true)
        expect(response.status).to.equal(200)
        expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
        expect(response.data).to.include.keys(['_id', '_rev'])
      })
    })

    it('GET using a url. This second GET should come from cache.', () => {
      return connOne.get({
        url: domain+'/bookmarks',
      }).then((response) => {
        expect(response.status).to.equal(200)
        expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
        expect(response.data).to.include.keys(['_id', '_rev'])
      })
    })

    it('PUT using a path', ()=> {
      return connOne.put({
        path: '/bookmarks/test1', 
        type: contentType, 
        data: "123",
      }).then((response) => {
        expect(response.status).to.equal(204)
        expect(response.headers).to.include.keys(['content-location', 'x-oada-rev', 'location'])
        return connOne.get({
          path: '/bookmarks/test1'
        }).then((res) => {
          expect(res.data).to.equal(123);
        })
      })
    })

    it('PUT using a url', ()=> {
      return connOne.put({
        url: domain+'/bookmarks/test', 
        type: contentType, 
        data: {testA: "123"},
      }).then((response) => {
        expect(response.status).to.equal(204)
        expect(response.headers).to.include.keys(['content-location', 'x-oada-rev', 'location'])
        return connOne.get({
          path: '/bookmarks/test'
        }).then((res) => {
          expect(res.data).to.be.an('object');
          expect(res.data.testA).to.equal('123');
        })
      })
    })

    it('POST using a path', ()=> {
      return connOne.post({
        path: '/bookmarks/test',
        type: contentType, 
        data:"123"
      }).then((response) => {
        expect(response.status).to.equal(204)
        expect(response.headers).to.include.keys(['content-location', 'x-oada-rev', 'location'])
      })
    })

    it('POST using a url', ()=> {
      return connOne.post({
        url: domain+'/bookmarks/test', 
        type: contentType, 
        data:"123",
      }).then((response) => {
        expect(response.status).to.equal(204)
        expect(response.headers).to.include.keys(['content-location', 'x-oada-rev', 'location'])
      })
    })

    it('DELETE using a path', ()=> {
      return connOne.delete({
        path: '/bookmarks/test1', 
      }).then((response) => {
        expect(response.status).to.equal(204)
        return connOne.get({
          path: '/bookmarks/test1'
        }).catch((err) => {
          expect(err.response.status).to.equal(404)
        })
      })
    })

    it('DELETE using a url', ()=> {
      return connOne.delete({
        url: domain+'/bookmarks/test', 
      }).then((response) => {
        expect(response.status).to.equal(204)
        return connOne.get({
          path: '/bookmarks/test'
        }).catch((err) => {
          expect(err.response.status).to.equal(404)
          return connOne.get({
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
      connOne.get({
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

    it('Recursive tree get with harvest data tree.', (done) => {
      connOne.get({
        path: '/bookmarks',
        tree: {
          _type: 'application/vnd.oada.bookmarks.1+json',
          _rev: '0-0',
          harvest: tree,
        },
      }).then((response) => {
        console.log(response);
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

describe('make a second connection, put over that connection, and check first cache', () => {
  it('Make second connection.', () => {
    return oada.connect({
      domain,
      token: 'def',
      cache: {name: 'testDbTwo'}
    }).then((result) => {
      connTwo = result;
      return connTwo.resetCache()
    })
  })

  it('PUT over second connection to a new endpoint.', () => {
    return connTwo.put({
      path: '/bookmarks/test2', 
      type: contentType, 
      data: "123",
    })
  })

  it('PUT over second connection to an old endpoint.', () => {
    return connTwo.put({
      path: '/bookmarks/test1', 
      type: contentType, 
      data: "765",
    })
  })

  it('PUT over first connection to a new endpoint.', () => {
    return connOne.put({
      path: '/bookmarks/test3', 
      type: contentType, 
      data: "999",
    })
  })

  it('GET new endpoint on first connection.', () => {
    return connOne.get({
      path: '/bookmarks/test2'
    }).then((response) => {
      expect(response.cached).is.equal(true)
    })
  })

  it('GET old endpoint on first connection.', () => {
    return connOne.get({
      path: '/bookmarks/test1'
    }).then((response) => {
      expect(response.cached).is.equal(true)
    })
  })

  it('GET new endpoint on second connection.', () => {
    return connTwo.get({
      path: '/bookmarks/test3'
    }).then((response) => {
      expect(response.cached).is.equal(false)
    })
  })

  it('Should return undefined when the cache returns a resource that no longer exists', () => {

  })

  it('Clean up the server.', () => {
    return connOne.delete({
      path: '/bookmarks/test1'
    }).then((response) => {
      return connOne.delete({
        path: '/bookmarks/test2'
      }).then((response) => {
        return connOne.delete({
          path: '/bookmarks/test3'
        }).then(() =>{
          connOne.disconnect();
        }).then(() => {
          connTwo.disconnect();
        })
      })
    })
  })
})

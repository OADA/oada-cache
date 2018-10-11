process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
import oada from '../src/index'
import chai from 'chai';
import { cleanUp, makeConnections, tree } from './utils'
import { token, domain } from './config'
var expect = chai.expect;

let domain = 'https://vip3.ecn.purdue.edu';
let contentType = 'application/vnd.oada.yield.1+json';
let connectTime = 30 * 1000; // seconds to click through oauth
let connOne;
let connTwo;

describe('Cache', () => {

  before('Make the connection. Cache + websocket enabled.', async function() {
    this.timeout(connectTime);
    var result = await oada.connect({
      domain,
      token,
    })
    connOne = result;
    expect(result).to.have.keys(['token', 'cache', 'websocket', 'disconnect', 'get', 'put', 'post', 'delete', 'resetCache'])
    expect(result.cache).to.equal(true);
    expect(result.websocket).to.equal(true);
  })

  it('reset cache and DELETE to initialize the state', async function() {
    await connOne.resetCache()
    var response = await connOne.delete({
        path: '/bookmarks/test', 
      })
    expect(response.status).to.equal(204)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
  })
})

for (var i = 0; i < 2; i++) {
  describe(`Test GET 2x to ensure its in the cache. Running ${i+1} of 2 times`, function() {
    it('GET using a path', () => {
      return connOne.get({
        path: '/bookmarks', 
      }).then((response) => {
        expect(response.cached).to.equal(i === 1)
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

  it('Recursive tree get with harvest data tree', async function() {
      try {
      var response = await connOne.get({
        path: '/bookmarks/test',
        tree,
      })
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
      } catch(err) {
        console.log(err)
      }
    })

    it('Recursive tree get with harvest data tree.', async function() {
      var response = await connOne.get({
        path: '/bookmarks',
        tree
      })
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
    })
  })
}

describe(``, async function() {
  it('PUT using a path', ()=> {
    return connOne.put({
      path: '/bookmarks/test1', 
      type: contentType, 
      data: "123",
    }).then((response) => {
      expect(response.status).to.equal(204)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev', 'location'])
      return connOne.get({
        path: '/bookmarks/test1',
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

})

describe(`TEST DELETES`, async function() {
  it('DELETE using a path', async function() {
    var response = await connOne.delete({
      path: '/bookmarks/test1', 
    })
    expect(response.status).to.equal(204)

    try {
      var resp = await connOne.get({
        path: '/bookmarks/test1'
      })
      expect(resp.status).to.equal(404)
    } catch (err) {
      expect(err.response.status).to.equal(404)
    }
  })

  it('DELETE using a url', async function() {
    var response = await connOne.delete({
      url: domain+'/bookmarks/test', 
    })
    expect(response.status).to.equal(204)

    try {
      var resp = await connOne.get({
        path: '/bookmarks/test'
      })
      expect(resp.status).to.equal(404)
    } catch(err) {
      expect(err.response.status).to.equal(404)
    }
    
    var res = await connOne.get({
        path: '/bookmarks'
    })
    expect(response.cached).to.equal(true)
    expect(res.status).to.equal(200)
    expect(res.data).to.include.keys(['_id', '_rev'])
    expect(res.data).to.not.include.keys(['test'])
  })
})

describe('make a second connection, put over that connection, and check first cache', () => {
  before('Make second connection and PUT data to each connection.', async function() {
    var result = await oada.connect({
      domain,
      token,
    })
    connTwo = result;
    await connTwo.resetCache()

    await connTwo.put({
      path: '/bookmarks/test2', 
      type: contentType, 
      data: `"123"`,
    })

    await connTwo.put({
      path: '/bookmarks/test1', 
      type: contentType, 
      data: `"765"`,
    })

    await connOne.put({
      path: '/bookmarks/test3', 
      type: contentType, 
      data: `"999"`,
    })

    var newTree = _.clone(tree);
    newTree.bookmarks.testFour = newTree.bookmarks.test;
    await connOne.put({
      path: '/bookmarks/testFour/aaa/bbb/index-one/testabc/sometest',
      type: contentType, 
      data: `"999"`,
      tree: newTree
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

  it('GET endpoint on second connection.', () => {
    return connTwo.get({
      path: '/bookmarks/testFour/aaa/bbb/index-one/testabc/sometest',
    }).then((response) => {
      expect(response.cached).is.equal(false)
      expect(response.cached).is.equal()
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

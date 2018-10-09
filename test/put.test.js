process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
const oada = require('../src/index')
const {expect} = require('chai');
const config = require('./config.js');
const {cleanUp, getConnections} = require('./utils.js');
var token = config.token;
var domain = config.domain;

let connection;
var resources = [];
let contentType = 'application/vnd.oada.yield.1+json';
let connectTime = 30 * 1000; // seconds to click through oauth
let tree = {
  'bookmarks': {
    '_type': 'application/vnd.oada.bookmarks.1+json',
    '_rev': '0-0',
    'test': {
      '_type': 'application/vnd.oada.harvest.1+json',
      '_rev': '0-0',
      'aaa': {
        '_type': 'application/vnd.oada.as-harvested.1+json',
        '_rev': '0-0',
        'bbb': {
          '_type': 'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json',
          '_rev': '0-0',
          'index-one': {
            '*': {
              '_type': 'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json',
              '_rev': '0-0',
              'index-two': {
                '*': {
                  '_type': 'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json',
                  '_rev': '0-0',
                  'index-three': {
                    '*': {
                      '_type': 'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json',
                      'test': {}
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

describe('~~~~IMPORT SCRIPT TEST - ENSURE TREE METHOD~~~~~~~', () => {
  var connections;
  var conn;
  before('First, make the connection. Cache + websockets enabled.', async function() {
    connections = await getConnections({
      domain,
      token: 'def',
    })
    conn = connections[0]
  })
    
  it('Should provide expected response status and headers', async function() {
    var response = await conn.put({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee/test/123',
      type: 'application/vnd.oada.as-harvested.yield-moisture.dataset.1+json',
      data: "some test",
      tree,
    })
    expect(response.status).to.equal(204)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev', 'location'])
  })

  it('Should provide expected response status and headers', async function() {
    var response = await conn.put({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee/test/123',
      type: 'application/vnd.oada.as-harvested.yield-moisture.dataset.1+json',
      data: "some test",
    })
    expect(response.status).to.equal(204)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev', 'location'])
  })

  it(`Should've create the data PUT in the previous test.`, async function() {
    var response = await conn.get({
      path: '/bookmarks/test',
    })
    expect(response.cached).to.equal(true)
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.include.keys(['_id', '_rev', 'aaa'])
    expect(response.data.aaa).to.have.keys(['_id', '_rev'])
    expect(response.data.aaa).to.not.include.keys(['bbb'])
  })

  it('Now test what weve created: aaa', async function() {
    var response = await conn.get({
      path: '/bookmarks/test/aaa',
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.include.keys(['_id', '_rev', 'bbb'])
    expect(response.data.bbb).to.have.keys(['_id', '_rev'])
    expect(response.data.bbb).to.not.include.keys(['index-one'])
  })

  it('Now test what weve created: bbb', async function() {
    var response = await conn.get({
      path: '/bookmarks/test/aaa/bbb',
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.include.keys(['_id', '_rev', 'index-one'])
    expect(response.data['index-one']).to.not.include.keys(['_id', '_rev'])
    expect(response.data['index-one']).to.include.keys(['ccc'])
  })

  it('Now test what weve created: index-one', async function() {
    var response = await conn.get({
      path: '/bookmarks/test/aaa/bbb/index-one',
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.not.include.keys(['_id', '_rev'])
    expect(response.data).to.include.keys(['ccc'])
    expect(response.data.ccc).to.have.keys(['_id', '_rev'])
  })

  it('Now test what weve created: ccc', async function() {
    var response = await conn.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc',
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.include.keys(['_id', '_rev', 'index-two'])
    expect(response.data['index-two']).to.not.include.keys(['_id', '_rev'])
  })

  it('Now test what weve created: index-two', async function() {
    var response = await conn.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two',
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.not.include.keys(['_id', '_rev'])
    expect(response.data).to.include.keys(['ddd'])
    expect(response.data['ddd']).to.have.keys(['_id', '_rev'])
  })

  it('Now test what weve created: ddd', async function() {
    var response = await conn.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd',
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.include.keys(['_id', '_rev', 'index-three'])
    expect(response.data['index-three']).to.not.include.keys(['_id', '_rev'])
    expect(response.data['index-three']).to.include.keys(['eee'])
  })

  it('Now test what weve created: index-three', async function() {
    var response = await conn.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three',
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.not.include.keys(['_id', '_rev'])
    expect(response.data).to.include.keys(['eee'])
    expect(response.data['eee']).to.have.keys(['_id'])
    expect(response.data['eee']).to.not.have.keys(['_rev'])
  })

  it('Now test what weve created: eee', async function() {
    var response = await conn.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee',
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.include.keys(['_id', '_rev', 'test'])
    expect(response.data['test']).to.not.include.keys(['_id', '_rev'])
    expect(response.data['test']).to.include.keys(['123'])
  })

  it('PUT to a different path using the same tree.', async function() {
    var response = await conn.put({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ggg/index-three/hhh/test/123',
      type: 'application/vnd.oada.as-harvested.yield-moisture.dataset.1+json',
      data: `"some test"`,
      tree,
    })
    expect(response.status).to.equal(204)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev', 'location'])
  })

  it('Now test what weve created: test', async function() {
    var response = await conn.get({
      path: '/bookmarks/test',
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.include.keys(['_id', '_rev', 'aaa'])
    expect(response.data.aaa).to.have.keys(['_id', '_rev'])
    expect(response.data.aaa).to.not.include.keys(['bbb'])
  })

  it('Now test what weve created: aaa', async function() {
    var response = await conn.get({
      path: '/bookmarks/test/aaa',
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.include.keys(['_id', '_rev', 'bbb'])
    expect(response.data.bbb).to.have.keys(['_id', '_rev'])
    expect(response.data.bbb).to.not.include.keys(['index-one'])
  })

  it('Now test what weve created: bbb', async function() {
    var response = await conn.get({
      path: '/bookmarks/test/aaa/bbb',
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.include.keys(['_id', '_rev', 'index-one'])
    expect(response.data['index-one']).to.not.include.keys(['_id', '_rev'])
    expect(response.data['index-one']).to.include.keys(['ccc'])
  })

  it('Now test what weve created: index-one', async function() {
    var response = await conn.get({
      path: '/bookmarks/test/aaa/bbb/index-one',
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.not.include.keys(['_id', '_rev'])
    expect(response.data).to.include.keys(['ccc'])
    expect(response.data.ccc).to.have.keys(['_id', '_rev'])
  })

  it('Now test what weve created: ccc', async function() {
    var response = await conn.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc',
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.include.keys(['_id', '_rev', 'index-two'])
    expect(response.data['index-two']).to.not.include.keys(['_id', '_rev'])
  })

  it('Now test what weve created: index-two', async function() {
    var response = await conn.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two',
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.not.include.keys(['_id', '_rev'])
    expect(response.data).to.include.keys(['ggg'])
    expect(response.data['ggg']).to.have.keys(['_id', '_rev'])
  })

  it('Now test what weve created: ggg', async function() {
    var response = await conn.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ggg',
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.include.keys(['_id', '_rev', 'index-three'])
    expect(response.data['index-three']).to.not.include.keys(['_id', '_rev'])
    expect(response.data['index-three']).to.include.keys(['hhh'])
  })

  it('Now test what weve created: index-three', async function() {
    var response = await conn.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ggg/index-three',
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.not.include.keys(['_id', '_rev'])
    expect(response.data).to.include.keys(['hhh'])
    expect(response.data['hhh']).to.have.keys(['_id'])
    expect(response.data['hhh']).to.not.have.keys(['_rev'])
  })

  it('Now test what weve created: hhh', async function() {
    var response = await conn.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ggg/index-three/hhh',
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.include.keys(['_id', '_rev', 'test'])
    expect(response.data['test']).to.not.include.keys(['_id', '_rev'])
    expect(response.data['test']).to.include.keys(['123'])
  })

  it('Now clean up', () => {
    var conn = connections[0];
    conn.resetCache();
    return cleanUp(resources, domain, token);
  })
})

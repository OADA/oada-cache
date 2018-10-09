process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
const oada = require('../src/index')
const _ = require('lodash');
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

  it(`Should error when neither 'url' nor 'path' are supplied`, async function() {
    try {
      var response = await conn.put({
        data: `"123"`,
        tree,
        type: 'application/json'
      })
    } catch (error) {
      expect(error.message).to.equal('Either path or url must be specified.')
    }
  })

  it(`Shouldn't error when 'data' contains a _type key.`, async function() {
    var response = await conn.put({
      path: '/bookmarks/testA/sometest',
      data: { _type: 'application/json'},
    })
    expect(response.status).to.equal(204)
  })   

  it(`Shouldn't error when 'type' is specified.`, async function() {
    var response = await conn.put({
      path: '/bookmarks/testA/somethingnew',
      data: `"abc123"`,
      type: 'application/json'
    })
    expect(response.status).to.equal(204)
  })

  it(`Shouldn't error when 'Content-Type' header is specified.`, async function() {
    var response = await conn.put({
      path: '/bookmarks/testA/somethingnew',
      data: `"abc123"`,
      headers: {'Content-Type': 'application/json'}
    })
    expect(response.status).to.equal(204)
  })

  it(`Shouldn't error when 'Content-Type' header (_type) can be derived from the 'tree'`, async function() {
    var response = await conn.put({
      path: '/bookmarks/test/aaa/bbb/sometest',
      tree,
      data: `"123"`
    })
    expect(response.status).to.equal(204)
  })

  it(`Should error when _type cannot be derived from the above tested sources`, async function() {
    try {
      var response = await conn.put({
        path: '/bookmarks/test/sometest',
        data: `"abc123"`,
      })
    } catch (error) {
      expect(error.message).to.equal(`'content-type' header must be specified.`)
    }
  })

  it('Should provide the expected response status and headers when a tree is supplied.', async function() {
    var response = await conn.put({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee/test/123',
      type: 'application/vnd.oada.as-harvested.yield-moisture.dataset.1+json',
      data: `"some test"`,
      tree,
    })
    expect(response.status).to.equal(204)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev', 'location'])
  })

  it('Should provide expected response status and headers when no tree is supplied.', async function() {
    var response = await conn.put({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee/test/123',
      type: 'application/vnd.oada.as-harvested.yield-moisture.dataset.1+json',
      data: `"some test"`,
    })
    expect(response.status).to.equal(204)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev', 'location'])
  })

  it(`Should create the data PUT in the previous test.`, async function() {
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

    /*
  it('Should fix resource structure when a tree is supplied and resource breaks are missing', async function() {
    var putOneResponse = await conn.put({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ggg/index-three/hhh/something',
      tree,
      data: 123
    })
    var newTree = _.cloneDeep(tree)
    newTree.bookmarks.test.aaa.bbb['index-one']._type = 'application/vnd.oada.yield.1+json'
    newTree.bookmarks.test.aaa.bbb['index-one']._rev = '0-0'
    var putResponse = await conn.put({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ggg/index-three/hhh',
      tree: newTree
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.include.keys(['_id', '_rev', 'test'])
    expect(response.data['test']).to.not.include.keys(['_id', '_rev'])
    expect(response.data['test']).to.include.keys(['123'])
  })
  */

  it(`Should use an _id specified via the 'tree'`, async function() {
    var newTree = _.cloneDeep(tree)
    newTree.bookmarks.test.aaa.sss = {
      _id: 'resources/sssssssss',
      _type: 'application/vnd.oada.yield.1+json',
      _rev: '0-0'
    }
    var putResponse = await conn.put({
      path: '/bookmarks/test/aaa/sss',
      tree: newTree,
      data: {anothertest: 123},
    })
    var response = await conn.get({
      path: '/bookmarks/test/aaa/sss',
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.include.keys(['_id', '_rev', 'anothertest'])
    expect(response.data._id).to.equal('resources/sssssssss')
  })

  it(`Should use an _id specified via the 'data'`, async function() {
    var putResponse = await conn.put({
      path: '/bookmarks/test/aaa/bbb',
      tree: tree,
      data: {_id: 'resources/foobar_foobar', sometest: 123},
    })
    var response = await conn.get({
      path: '/bookmarks/test/aaa/bbb',
    })
    expect(response.status).to.equal(200)
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.include.keys(['_id', '_rev', 'sometest'])
    expect(response.data._id).to.equal('resources/foobar_foobar')
    expect(response.data.sometest).to.equal(123)
  })

  it('Should make unversioned links where _rev is not specified on resources', async function() {

  })
  it('Now clean up', () => {
    var conn = connections[0];
    conn.resetCache();
    return cleanUp(resources, domain, token);
  })
})

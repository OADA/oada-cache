process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
import oada from '../src/index'
import chai from 'chai';
var expect = chai.expect;

let token = 'def';
let domain = 'https://vip3.ecn.purdue.edu';
let connection;
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

  it('First, make the connection. Cache + websockets enabled.', function() {
    return oada.connect({
      domain,
      token: 'def',
      cache: {name: 'testDb'}
    }).then((result) => {
      connection = result;
      expect(result).to.have.keys(['token', 'cache', 'socket', 'disconnect', 'get', 'put', 'post', 'delete', 'resetCache'])
      expect(result.cache).to.not.equal(undefined);
      expect(result.socket).to.not.equal(undefined);
      return connection.resetCache();
    })
  })

  it('PUT using a path', ()=> {
    return connection.put({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee/test/123',
      type: 'application/vnd.oada.as-harvested.yield-moisture.dataset.1+json',
      data: `"some test"`,
      tree,
    }).then((response) => {
      expect(response.status).to.equal(204)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev', 'location'])
    })
  })

  it('Now test what weve created: test', () => {
    return connection.get({
      path: '/bookmarks/test',
    }).then((response) => {
      expect(response.cached).to.equal(true)
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.include.keys(['_id', '_rev', 'aaa'])
      expect(response.data.aaa).to.have.keys(['_id', '_rev'])
      expect(response.data.aaa).to.not.include.keys(['bbb'])
    })
  })

  it('Now test what weve created: aaa', () => {
    return connection.get({
      path: '/bookmarks/test/aaa',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.include.keys(['_id', '_rev', 'bbb'])
      expect(response.data.bbb).to.have.keys(['_id', '_rev'])
      expect(response.data.bbb).to.not.include.keys(['index-one'])
    })
  })

  it('Now test what weve created: bbb', () => {
    return connection.get({
      path: '/bookmarks/test/aaa/bbb',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.include.keys(['_id', '_rev', 'index-one'])
      expect(response.data['index-one']).to.not.include.keys(['_id', '_rev'])
      expect(response.data['index-one']).to.include.keys(['ccc'])
    })
  })

  it('Now test what weve created: index-one', () => {
    return connection.get({
      path: '/bookmarks/test/aaa/bbb/index-one',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.not.include.keys(['_id', '_rev'])
      expect(response.data).to.include.keys(['ccc'])
      expect(response.data.ccc).to.have.keys(['_id', '_rev'])
    })
  })

  it('Now test what weve created: ccc', () => {
    return connection.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.include.keys(['_id', '_rev', 'index-two'])
      expect(response.data['index-two']).to.not.include.keys(['_id', '_rev'])
    })
  })

  it('Now test what weve created: index-two', () => {
    return connection.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.not.include.keys(['_id', '_rev'])
      expect(response.data).to.include.keys(['ddd'])
      expect(response.data['ddd']).to.have.keys(['_id', '_rev'])
    })
  })

  it('Now test what weve created: ddd', () => {
    return connection.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.include.keys(['_id', '_rev', 'index-three'])
      expect(response.data['index-three']).to.not.include.keys(['_id', '_rev'])
      expect(response.data['index-three']).to.include.keys(['eee'])
    })
  })

  it('Now test what weve created: index-three', () => {
    return connection.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.not.include.keys(['_id', '_rev'])
      expect(response.data).to.include.keys(['eee'])
      expect(response.data['eee']).to.have.keys(['_id'])
      expect(response.data['eee']).to.not.have.keys(['_rev'])
    })
  })

  it('Now test what weve created: eee', () => {
    return connection.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.include.keys(['_id', '_rev', 'test'])
      expect(response.data['test']).to.not.include.keys(['_id', '_rev'])
      expect(response.data['test']).to.include.keys(['123'])
    })
  })

  it('PUT to a different path using the same tree.', ()=> {
    return connection.put({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ggg/index-three/hhh/test/123',
      type: 'application/vnd.oada.as-harvested.yield-moisture.dataset.1+json',
      data: `"some test"`,
      tree,
    }).then((response) => {
      expect(response.status).to.equal(204)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev', 'location'])
    })
  })

  it('Now test what weve created: test', () => {
    return connection.get({
      path: '/bookmarks/test',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.include.keys(['_id', '_rev', 'aaa'])
      expect(response.data.aaa).to.have.keys(['_id', '_rev'])
      expect(response.data.aaa).to.not.include.keys(['bbb'])
    })
  })

  it('Now test what weve created: aaa', () => {
    return connection.get({
      path: '/bookmarks/test/aaa',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.include.keys(['_id', '_rev', 'bbb'])
      expect(response.data.bbb).to.have.keys(['_id', '_rev'])
      expect(response.data.bbb).to.not.include.keys(['index-one'])
    })
  })

  it('Now test what weve created: bbb', () => {
    return connection.get({
      path: '/bookmarks/test/aaa/bbb',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.include.keys(['_id', '_rev', 'index-one'])
      expect(response.data['index-one']).to.not.include.keys(['_id', '_rev'])
      expect(response.data['index-one']).to.include.keys(['ccc'])
    })
  })

  it('Now test what weve created: index-one', () => {
    return connection.get({
      path: '/bookmarks/test/aaa/bbb/index-one',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.not.include.keys(['_id', '_rev'])
      expect(response.data).to.include.keys(['ccc'])
      expect(response.data.ccc).to.have.keys(['_id', '_rev'])
    })
  })

  it('Now test what weve created: ccc', () => {
    return connection.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.include.keys(['_id', '_rev', 'index-two'])
      expect(response.data['index-two']).to.not.include.keys(['_id', '_rev'])
    })
  })

  it('Now test what weve created: index-two', () => {
    return connection.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.not.include.keys(['_id', '_rev'])
      expect(response.data).to.include.keys(['ggg'])
      expect(response.data['ggg']).to.have.keys(['_id', '_rev'])
    })
  })

  it('Now test what weve created: ggg', () => {
    return connection.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ggg',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.include.keys(['_id', '_rev', 'index-three'])
      expect(response.data['index-three']).to.not.include.keys(['_id', '_rev'])
      expect(response.data['index-three']).to.include.keys(['hhh'])
    })
  })

  it('Now test what weve created: index-three', () => {
    return connection.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ggg/index-three',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.not.include.keys(['_id', '_rev'])
      expect(response.data).to.include.keys(['hhh'])
      expect(response.data['hhh']).to.have.keys(['_id'])
      expect(response.data['hhh']).to.not.have.keys(['_rev'])
    })
  })

  it('Now test what weve created: hhh', () => {
    return connection.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ggg/index-three/hhh',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.include.keys(['_id', '_rev', 'test'])
      expect(response.data['test']).to.not.include.keys(['_id', '_rev'])
      expect(response.data['test']).to.include.keys(['123'])
    })
  })

  it('Now clean up', () => {
    return connection.delete({
      path: '/bookmarks/test',
    }).then(() => {
      return connection.disconnect();
    })
  })
})

process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
import oada from '../src/index'
import chai from 'chai';
var expect = chai.expect;

let token = 'def';
let domain = 'https://vip3.ecn.purdue.edu';
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

describe('make a connection', () => {

    it('connect with token. cache + websocket', function() {
      this.timeout(connectTime);
      return oada.connect({
        domain,
        token: 'def',
        name: 'testDb'
      }).then((result) => {
        expect(result).to.have.keys(['token', 'cache', 'socket'])
        expect(result.cache).to.not.equal(undefined);
        expect(result.socket).to.not.equal(undefined);
        return oada.clearCache({name: 'testDb'});
      })
    })
})

describe(`PUT with tree parameter supplied`, function() {
  this.timeout(connectTime);

  it('PUT using a path', ()=> {
    return oada.put({
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
    return oada.get({
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
    return oada.get({
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
    return oada.get({
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
    return oada.get({
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
    return oada.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.include.keys(['_id', '_rev', 'index-two'])
      expect(response.data['index-two']).to.not.include.keys(['_id', '_rev'])
    })
  })

  it('Now test what weve created: index-two', () => {
    return oada.get({
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
    return oada.get({
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
    return oada.get({
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
    return oada.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.include.keys(['_id', '_rev', 'test'])
      expect(response.data['test']).to.not.include.keys(['_id', '_rev'])
      expect(response.data['test']).to.include.keys(['123'])
    })
  })

})

describe(`Now a second PUT the same tree parameter supplied`, function() {
  this.timeout(connectTime);

  it('PUT using a path', ()=> {
    return oada.put({
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
    return oada.get({
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
    return oada.get({
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
    return oada.get({
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
    return oada.get({
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
    return oada.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.include.keys(['_id', '_rev', 'index-two'])
      expect(response.data['index-two']).to.not.include.keys(['_id', '_rev'])
    })
  })

  it('Now test what weve created: index-two', () => {
    return oada.get({
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
    return oada.get({
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
    return oada.get({
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
    return oada.get({
      path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ggg/index-three/hhh',
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
      expect(response.data).to.include.keys(['_id', '_rev', 'test'])
      expect(response.data['test']).to.not.include.keys(['_id', '_rev'])
      expect(response.data['test']).to.include.keys(['123'])
    })
  })

})

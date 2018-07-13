process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
import Promise from 'bluebird'
import oada from '../src/index'
import chai from 'chai';
var expect = chai.expect;

let token = 'def';
let domain = 'https://vip3.ecn.purdue.edu';
let connOne;
let connTwo;
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
        'index-one': {
          '*': {
            '_type': 'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json',
            '_rev': 'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json',
          }
        }
      }
    }
  }
}

describe('~~~~~~~~~~~WATCH TESTING~~~~~~~~~~~~~~', function() {
  this.timeout(9000);
  it('Make the first connection.', function() {
    this.timeout(connectTime);
    return oada.connect({
      domain,
      token: 'def',
      cache: {name: 'testOne'},
    }).then((result) => {
      connOne = result;
      expect(result).to.have.keys(['token', 'cache', 'socket', 'get', 'put', 'post', 'delete', 'resetCache'])
      expect(result.cache).to.not.equal(undefined);
      expect(result.socket).to.not.equal(undefined);
      return connOne.resetCache().then(() => {
        return connOne.delete({path:'/bookmarks/test'})
      })
    })
  })

  it('PUT some initial state onto the server + first cache.', () => {
    return connOne.put({
      path: '/bookmarks/test/aaa/index-one/ccc/happy',
      type: 'application/vnd.oada.yield.1+json',
      data: `"456"`,
      tree,
    }).then((response) => {
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev', 'location'])
    })
  })

  it(`GET and commence a watch on the first connection.`, function() {
    this.timeout(5000);
    let payload = { pay: 'load' };
    return connOne.get({
      path: '/bookmarks/test',
      watch: {
        func: (payload) => {
          /*
          expect(payload).to.include.keys(['pay', 'response', 'request'])
          expect(payload.pay).to.equal('load')
          expect(payload.response).to.include.keys(['change'])
          expect(payload.response.change.type).to.equal('merge');
          expect(payload.response.change.body).to.include.keys(['_rev', 'aaa'])
          expect(payload.response.change.body.aaa).to.include.keys(['_rev', 'index-one'])
          expect(payload.response.change.body.aaa['index-one']).to.include.keys(['eee'])
          expect(payload.response.change.body.aaa['index-one'].eee).to.include.keys(['_rev'])
          */
        },
        payload
      }
    }).then((response) => {
      expect(response.status).to.equal(200)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    })
  })

  it('Make a second connection.', function() {
    this.timeout(connectTime);
    return oada.connect({
      domain,
      token: 'def',
      cache: {name: 'testTwo'}
    }).then((result) => {
      connTwo = result;
      expect(result).to.have.keys(['token', 'cache', 'socket', 'get', 'put', 'post', 'delete', 'resetCache'])
      expect(result.cache).to.not.equal(undefined);
      expect(result.socket).to.not.equal(undefined);
      return connTwo.resetCache();
    })
  })

  it(`PUT over the second connection and check that the first received it.`, ()=> {
    return connTwo.put({
      path: '/bookmarks/test/aaa/index-one/eee',
      type: 'application/vnd.oada.as-harvested.yield-moisture.dataset.1+json',
      tree,
      data: {some: 'test'},
    }).then((response) => {
      expect(response.status).to.equal(204)
      expect(response.headers).to.include.keys(['content-location', 'x-oada-rev', 'location'])
      return connOne.get({
        path: '/bookmarks/test/aaa/index-one/eee',
      }).then((res) => {
        expect(res.data).to.include.key('some')
        expect(res.data.some).to.equal('test')
        expect(res.cached).to.equal(true);
        return connOne.get({
          path: '/bookmarks/test',
        }).then((res) => {
          expect(res.cached).to.equal(true)
          return connOne.get({
            path: '/bookmarks/test/aaa',
          }).then((res) => {
            expect(res.cached).to.equal(true)
            return connOne.get({
              path: '/bookmarks/test/aaa/index-one',
            }).then((res) => {
              expect(res.cached).to.equal(true)
            })
          })
        })
      })
    })
  })
})

//TODO: 
/*
describe('Now clean up', () => {
  it('delete /bookmarks/test', () => {
    return connOne.delete({path:'/bookmarks/test'})
  })
})

describe('some sort of test with unversioned links', () => {
  it('delete /bookmarks/test', () => {
    return connOne.delete({path:'/bookmarks/test'})
  })
})


describe('test confirming that we cannot watch non-resource paths', () => {
  console.log('it should throw some reasonable error on the server perhaps');
})
*/

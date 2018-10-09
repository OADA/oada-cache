process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
const Promise = require('bluebird')
const oada = require('../src/index')
const {expect} = require('chai');

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

describe('GET', function() {

  describe(`Simple GETs should work`, async function() {
    var connOne;
    var data;
    var resource;
    var link;

    before('Make a connection and put some content', async function() {
      connOne = await oada.connect({domain, token})
      expect(connOne).to.have.keys(['token', 'disconnect', 'get', 'put', 'post', 'delete', 'resetCache'])
      await connOne.resetCache()
      await connOne.delete({path:'/bookmarks/test'})
      data = {
        _type: 'application/vnd.oada.notes.1+json',
        sometest: 'abc'
      }
      resource = await connOne.post({
        path: '/resources',
        data
      })

      link = await connOne.post({
        path: '/bookmarks/test',
        data: {_id: resource.headers.location.replace(/^\//, ''), _rev: '0-0'}
      })
    })

    it(`Get the resource`, async function() {
      var response = await connOne.get({
        path: '/bookmarks/test',
      })
      expect(response.data).to.include.keys(['_id', '_rev', '_meta', '_type'])
      response = await connOne.get({
        path: '/bookmarks/test/sometest',
      })
      expect(response.data).to.equal('abc')
    })

    after(``, async function() {
      await axios({
        method: 'delete',
        headers: { Authorization: 'Bearer def'},
        url: 'https://vip3.ecn.purdue.edu/bookmarks/test'
      })
      await axios({
        method: 'delete',
        headers: { Authorization: 'Bearer def'},
        url: 'https://vip3.ecn.purdue.edu/bookmarks/test'
      })
      await axios({
        method: 'delete',
        headers: { Authorization: 'Bearer def'},
        url: 'https://vip3.ecn.purdue.edu/bookmarks/test'
      })
    })
  })
})

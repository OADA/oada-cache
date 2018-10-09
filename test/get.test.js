process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
const oada = require('../build/index').default
const uuid = require('uuid');
const chai = require('chai');
const axios = require('axios');
const config = require('./config')
const expect = chai.expect;
const {cleanUp, getConnections} = require('./utils.js');

var token = config.token;
let domain = config.domain;
var resource;
var link;
var data;
var connections;
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



describe('GET', async function() {
  var a, b, c , d;

  before(`Make connections`, async function() {
    connections = await getConnections({
      domain,
      token
    })
    data = {
      _type: 'application/vnd.oada.notes.1+json',
      sometest: 'abc'
    }
    
    a = await axios({
      method: 'put',
      url: domain+'/resources/'+uuid(),
      headers: {
        Authorization: 'Bearer '+token,
        'Content-Type': 'application/vnd.oada.notes.1+json',
      },
      data
    })
    resources.push(a.headers.location)

    var aLink = await axios({
      method: 'put',
      url: domain+'/bookmarks/test',
      headers: {
        Authorization: 'Bearer '+token,
        'Content-Type': 'application/vnd.oada.notes.1+json',
      },
      data: {_id: a.headers.location.replace(/^\//, ''), _rev: '0-0'}
    })

    b = await axios({
      method: 'put',
      url: domain+'/resources/'+uuid(),
      headers: {
        Authorization: 'Bearer '+token,
        'Content-Type': 'application/vnd.oada.notes.1+json',
      },
      data: {'somethingelse': 'okay'}
    })
    resources.push(b.headers.location)

    var bLink = await axios({
      method: 'put',
      url: domain+'/bookmarks/test/aaa',
      headers: {
        Authorization: 'Bearer '+token,
        'Content-Type': 'application/vnd.oada.notes.1+json',
      },
      data: {_id: b.headers.location.replace(/^\//, ''), _rev: '0-0'}
    })

    c = await axios({
      method: 'put',
      url: domain+'/resources/'+uuid(),
      headers: {
        Authorization: 'Bearer '+token,
        'Content-Type': 'application/vnd.oada.notes.1+json',
      },
      data: {'b': 'b'}
    })
    resources.push(c.headers.location)

    var cLink = await axios({
      method: 'put',
      url: domain+'/bookmarks/test/aaa/bbb',
      headers: {
        Authorization: 'Bearer '+token,
        'Content-Type': 'application/vnd.oada.notes.1+json',
      },
      data: {_id: c.headers.location.replace(/^\//, ''), _rev: '0-0'}
    })

    d = await axios({
      method: 'put',
      url: domain+'/resources/'+uuid(),
      headers: {
        Authorization: 'Bearer '+token,
        'Content-Type': 'application/vnd.oada.notes.1+json',
      },
      data: {'c': 'c'}
    })
    resources.push(d.headers.location)

    var dLink = await axios({
      method: 'put',
      url: domain+'/bookmarks/test/aaa/bbb/index-one/ccc',
      headers: {
        Authorization: 'Bearer '+token,
        'Content-Type': 'application/vnd.oada.notes.1+json',
      },
      data: {_id: d.headers.location.replace(/^\//, ''), _rev: '0-0'}
    })
  })

  it(`Should allow for a basic GET request without tree parameter`, async function() {
    var conn = connections[0];
    var test = await conn.get({
      path: '/bookmarks/test'
    })
    expect(test.data).to.include.key('aaa')
    expect(test.data).to.include.keys(['_id', '_meta', '_type', '_rev'])
  })

  //connections.forEach((conn, i) => {
  //  describe(`Testing connection ${i+1}`, async function() {
  it(`Should perform a recursive GET when a 'tree' is supplied. Should not error when the root path exists`, async function() {
    var conn = connections[0];
    var test = await conn.get({
      path: '/bookmarks/test',
      tree
    })
    expect(test.data).to.include.key('aaa')
    expect(test.data['aaa']).to.include.key('bbb')
    expect(test.data['aaa']).to.include.keys(['_id', '_meta', '_type', '_rev'])
    expect(test.data['aaa']['bbb']).to.include.key('index-one')
    expect(test.data['aaa']['bbb']).to.include.keys(['_id', '_meta', '_type', '_rev'])
    expect(test.data['aaa']['bbb']['index-one']).to.not.include.keys(['_id', '_meta', '_type', '_rev'])
    expect(test.data['aaa']['bbb']['index-one']).to.include.key('ccc')
    expect(test.data['aaa']['bbb']['index-one']['ccc']).to.include.keys(['_id', '_meta', '_type', '_rev'])
  })

  it(`GETs with a 'tree' supplied should error when the root path doesn't exist`, async function() {
    var conn = connections[0];
    try {
      var test = await conn.get({
        path: '/bookmarks/test/testTwo',
        tree
      })
    } catch (error) {
      expect(error.response.status).to.equal(404)
      expect(error.response.message).to.contain.string('Not Found')
    }
  })

  after('clean up', () => {
    var conn = connections[0];
    conn.resetCache();
    return cleanUp(resources, domain, token);
  })
})

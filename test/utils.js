const oada = require('../src/index')
const axios = require('axios')
const uuid = require('uuid')
oada.setDbPrefix('./test/test-data/')
var { token, domain } = require('./config')

const connections = [
  { cache: false, websocket: false, name: 'cNoWNo' },
  { cache: true, websocket: false, name: 'cYesWNo' },
  { cache: false, /*websocket: true,*/ name: 'cNoWYes' },
  { cache: true, /*websocket: true,*/ name: 'cYesWYes' }
]
function getConnections ({ domain, options, token }) {
  return connections.map(({ cache, websocket, name }) => {
    const conn = oada.connect({
      domain,
      options,
      token,
      websocket,
      name,
      cache: cache && { name }
    })

    conn.cache = cache
    conn.websocket = typeof websocket === 'undefined'

    return conn
  })
}

async function putResource (data, path) {
  var pieces = path.split('/bookmarks')[1].split('/')
  var newPath = '/bookmarks' + pieces.splice(0, pieces.length - 1).join('/')
  var _id = 'resources/' + uuid()
  var newData = {}
  newData[pieces[0]] = { _id, _rev: 0 }
  var resource = await axios({
    method: 'put',
    url: domain + '/' + _id,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    data
  })
  var link = await axios({
    method: 'put',
    url: domain + newPath,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    data: newData
  })

  return { resource, link }
}

var tree = {
  bookmarks: {
    _type: 'application/vnd.oada.bookmarks.1+json',
    _rev: 0,
    test: {
      _type: 'application/vnd.oada.harvest.1+json',
      _rev: 0,
      aaa: {
        _type: 'application/vnd.oada.as-harvested.1+json',
        _rev: 0,
        bbb: {
          _type:
            'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json',
          _rev: 0,
          'index-one': {
            '*': {
              _type:
                'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json',
              _rev: 0,
              'index-two': {
                '*': {
                  _type:
                    'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json',
                  _rev: 0,
                  'index-three': {
                    '*': {
                      _type:
                        'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json',
                      test: {}
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

module.exports = {
  getConnections,
  tree,
  putResource
}

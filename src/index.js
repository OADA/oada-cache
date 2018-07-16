import setupCache from './cache'
import uuid from 'uuid'
import _ from 'lodash'
var urlLib = require('url');
var pointer = require('json-pointer');
var websocket = require('./websocket');
const Promise = require('bluebird');
var axios = require('axios');
let oadaIdClient = require('oada-id-client');

var connect = function connect({domain, options, cache, token, noWebsocket}) {
  let CACHE = undefined;
  let REQUEST = axios;
  let SOCKET = undefined;
  let TOKEN = undefined;
  let DOMAIN = domain;
  let NAME = cache ? cache.name : undefined;
  let EXP = cache ? cache.exp : undefined;

  function post({url, path, data, type, headers, tree}) {
    url = url || DOMAIN+path;
    url = url[url.length-1] === '/' ? url+uuid() : url+'/'+uuid();
    return put({
      url,
      data,
      type,
      headers,
      tree
    })
  }

  function del({url, path, headers}) {
    let req = {
      method: 'delete',
      url: url || DOMAIN+path,
      headers: _.merge({'Authorization': 'Bearer '+TOKEN}, headers),
    }
    return REQUEST(req)
  }

  function _configureCache({name, req, exp}) {
    let res = setupCache({name, req, exp})
    REQUEST = res.api;
    CACHE = res;
    return
  }

  function _configureWs({domain}) {
    return websocket(domain).then((socketApi) => {
      REQUEST = socketApi.http;
      return SOCKET = socketApi;
    })
  }

  function _watch({headers, path, func, payload}) {
    if (SOCKET) {
      return SOCKET.watch({
        path,
        headers: {Authorization: 'Bearer '+TOKEN},
      }, async function watchResponse(response) {
        if (!payload) payload = {};
        payload.response = response;
        payload.request = {
          url: DOMAIN+path,
          headers,
          method: payload.response.change.type,
        }
        if (CACHE) await CACHE.handleWatchChange(payload)
        return func(payload)
      })
    } else {
      // Ping a normal GET every 5 seconds in the absense of a websocket
      return setInterval(() => {
        this.get({url}).then((result) => {
          func(payload)
        })
      }, 5000)
    }
  }

  function get({url, path, headers, watch, tree}) {
    let req = {
      method: 'get',
      url: url || DOMAIN+path,
      headers: _.merge({'Authorization': 'Bearer '+TOKEN}, headers),
    }

    let prom;

    if (tree) {
      prom = _recursiveGet(req.url, tree, {}).then((res) => {
        return {
          data: res,
          status: 200,
        }
      })
    } else {
      prom = REQUEST(req);
    }

    return prom.then(async (response) => {
      if (watch) {
        await _watch({
          headers: req.headers,
          path,
          func: watch.func,
          payload: watch.payload
        })
      }
      return response
    })
  }

  function _replaceLinks(obj) {
    let ret = (Array.isArray(obj)) ? [] : {};
    if (!obj) return obj;  // no defined objriptors for this level
    return Promise.map(Object.keys(obj || {}), (key)  => {
      if (key === '*') { // Don't put *s into oada. Ignore them
        return;
      }
      let val = obj[key];
      if (typeof val !== 'object' || !val) {
        ret[key] = val; // keep it asntType: 'application/vnd.oada.harvest.1+json'
        return;
      }
      if (val._type) { // If it has a '_type' key, don't worry about it.
        //It'll get created in future iterations of ensureTreeExists
        return;
      }
      if (val._id) { // If it's an object, and has an '_id', make it a link from descriptor
        ret[key] = { _id: obj[key]._id};
        if (val._rev) ret[key]._rev = '0-0'
        return;
      }
      // otherwise, recurse into the object looking for more links
      return _replaceLinks(val).then((result) => {
        ret[key] = result;
        return;
      })
    }).then(() => {
      return ret;
    })
  }

  function _recursiveGet(url, tree, returnData) {
    return Promise.try(() => {
      // Perform a GET if we have reached the next resource break.
      if (tree._type) { // its a resource
        return get({
          url
        }).then((response) => {
          returnData = response.data;
          return
        })
      }
      return
    }).then(() => {
      // Walk down the data at this url and continue recursion.
      return Promise.map(Object.keys(tree), (key) => {
        // If tree contains a *, this means we should get ALL content on the server
        // at this level and continue recursion for each returned key.
        if (key === '*') {
          return Promise.map(Object.keys(returnData), (resKey) => {
            if (resKey.charAt(0) === '_') return
            return _recursiveGet(url+'/'+resKey, tree[key] || {}, returnData[key]).then((res) => {
              return returnData[resKey] = res;
            })
          })
        } else if (typeof tree[key] === 'object') {
          return _recursiveGet(url+'/'+key, tree[key] || {}, returnData[key]).then((res) => {
            return returnData[key] = res;
          })
        } else return returnData[key]
      }).then(() => {
        return returnData
      })
    }).catch((err) => {
      if (err.response.status === 404) {
        return
      }
      throw err
    })
  }

  function _findDeepestResources(pieces, tree, cachedTree) {
    let cached = 0;
    let setup;
    // Walk down the url in reverse order
    return Promise.mapSeries(pieces, (piece, i) => {
      let z = pieces.length - 1 - i; //
      let urlPath = '/'+pieces.slice(0, z+1).join('/');
      let treePath = _convertSetupTreePath(pieces.slice(0, z+1), tree);
      // Check that its in the cached tree then look for deepest _resource_.
      // If successful, break from the loop by throwing
      if (pointer.has(tree, treePath+'/_type')) {
        setup = setup || z;
        if (pointer.has(cachedTree, urlPath)) {
          cached = z;
          throw z;
        }
        return get({
          path: urlPath
        }).then((response) => {
          pointer.set(cachedTree, urlPath, {})
          cached = z;
          throw z;
        }).catch((err) => {
          if (typeof err === 'number') throw z;
          return
        })
      }
      return
    }).catch((err) => {
      //console.log(err);
      // Throwing with a number error only should occur on success.
      if (typeof err === 'number') return { cached, setup }
    }).then(() => {
      return { 
        cached: cached, 
        setup: setup || 0
      }
    })
  }

  // Loop over the keys of the path and determine whether the object at that level
  // contains a * key. The path must be updated along the way, replacing *s as 
  // necessary.
  function _convertSetupTreePath(pathPieces, tree) {
    let newPieces = _.clone(pathPieces);
    newPieces =	pathPieces.map((piece, i) => {
      if (pointer.has(tree, '/'+newPieces.slice(0, i).join('/')+'/*')) {
        newPieces[i] = '*';
        return '*';
      } else {
        return piece
      }
    })
    return '/'+newPieces.join('/')
  }

  function _makeResourceAndLink({path, data}) {
    let req = {
      path: data._id ? data._id : '/resources',
      contentType: data._type,
      data,
    }
    let resource = data._id ? put(req) : post(req);
    return resource.then((response) => {
      data._id = response.headers['content-location'].replace(/^\//, '');
      let link = {
        path,
        'Content-Type': data._type,
        data: {_id:data._id},
      }
      if (data._rev) link.data._rev = '0-0'
      return put(link)
    })
  }

  // Ensure all resources down to the deepest resource are created before
  // performing a PUT.
  function _ensureTree({url, tree}) {
    //If /resources
    
    //If /bookmarks
    let path = urlLib.parse(url).path;
    path = path.replace(/^\//, '');
    let pieces = path.replace(/\/$/, '').split('/');
    let cachedTree = {};
    // Find the deepest part of the path that exists. Once found, work back down.
    return _findDeepestResources(pieces, tree, cachedTree).then((ret) => {
      // Create all the resources on the way down. ret.cached is an index. Subtract
      // one from pieces.length so its in terms of an index as well.
      return Promise.mapSeries(pieces.slice(0, pieces.length - 1 - ret.cached), (piece, j) => {
        let i = ret.cached+1 + j; // ret.cached exists; add one to continue beyond.
        let urlPath = '/'+pieces.slice(0, i+1).join('/');
        let treePath = _convertSetupTreePath(pieces.slice(0, i+1), tree);
        if (pointer.has(tree, treePath+'/_type') && i <= ret.setup) { // its a resource
          return _replaceLinks(pointer.get(tree, treePath)).then((content) => {
            return _makeResourceAndLink({
              path: urlPath,
              data: content
            }).then(() => {
              pointer.set(cachedTree, urlPath, content)
              return
            })
          })
        } else return
      })
    }).catch((err) => {
      //console.log(err);
      return err
    })
  }

  async function put({url, path, data, type, headers, tree}) {
    let req = {
      method: 'put',
      url: url || DOMAIN+path,
      headers: _.merge({'Authorization': 'Bearer '+TOKEN}, headers),
      data,
    }
    if (type) req.headers['Content-Type'] = type;
    if (tree) {
      let ret = await _ensureTree({
        url: req.url,
        tree,
      })
    }

    return REQUEST(req)
  }

  async function resetCache(name, exp) {
    if (!CACHE) return
    await CACHE.resetCache();
    return _configureCache({
      name: name || NAME,
      req: SOCKET.http || axios,
      exp: exp || EXP, 
    })
  }

  function disconnect() {
    if (CACHE) CACHE.db.destroy();
    if (CACHE) CACHE.db.close();
    if (SOCKET) SOCKET.close();
  }


  // Now actually make the connection

  let urlObj = urlLib.parse(domain);
  let prom;
  if (token) {
    prom = Promise.resolve({access_token: token})
  } else {
    prom = oadaIdClient.node(urlObj.host, options)
  }
  return prom.then(async (result) => {
    TOKEN = result.access_token;
    let wsProm;
    if (!noWebsocket) {
      wsProm = websocket(domain).then((socketApi) => {
        REQUEST = socketApi.http;
		    return SOCKET = socketApi;
      })
    } else wsProm = Promise.resolve();
    return wsProm.then(() => {
      let cacheProm;
      if (cache) {
        return _configureCache({
          name: NAME || uuid(),
          req: REQUEST,
          exp: EXP,
        })
      } else return
    })
  }).then((f) => {
    return {
      token: TOKEN,
      cache: CACHE,
      socket: SOCKET,
      get,
      put,
      post,
      delete: del,
      resetCache,
      disconnect,
    }
  })

}

export default {
  connect,
}

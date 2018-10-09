"use strict"
var Promise = require('bluebird');
import PouchDB from 'pouchdb';
var url = require('url');
var _ = require('lodash');
var pointer = require('json-pointer');

//TODO: Should getLookup throw an error or return undefined?
// This needs to be handled by all that call getLookup!!!


export default function setupCache({name, req, exp}) {

// name should be made unique across domains and users
	let db = db || new PouchDB(name);
	let request = req;
	let expiration = exp || 1000*60*60*24*2;//(ms/s)*(s/min)*(min/hr)*(hr/days)*days

// Get the resource and merge data if its already in the db.
  function getUpsertDoc(req, res) {
    let urlObj = url.parse(req.url)
    let pieces = urlObj.path.split('/')
    let resourceId = pieces.slice(1,3).join('/'); //returns resources/abc
    let pathLeftover = (pieces.length > 3) ? '/'+pieces.slice(3, pieces.length).join('/') : '';
    let dbPut = {
      _id: resourceId,
      doc: {
        _valid: (res._valid === undefined) ? true : res._valid,
        _accessed: Date.now(),
      }
    }
    // ALL updates to existing docs (upserts) need to supply the current _rev.
    return db.get(resourceId).then((result) => {
    //If theres a path leftover, create an empty object, add a key to warn users
    //that the data is incomplete, and put the data at that path Leftover
      if (result.doc._NOT_COMPLETE_RESOURCE) dbPut.doc._NOT_COMPLETE_RESOURCE = true;
      dbPut._rev = result._rev
      // If a falsey _valid value is given, return the invalidated resource.
      if (dbPut.doc._valid !== undefined && !dbPut.doc._valid) {
        return Promise.resolve(dbPut)
      }
      if (req.method && req.method.toLowerCase() === 'delete') {
        dbPut.doc.doc =	(dbPut.doc.doc || {});
        req.url = urlObj.protocol+'//'+urlObj.host+'/'+resourceId;
      } else {
        if (pathLeftover) {
          // merge the new data into the old at the path leftover, then return old
          let curData = {}
          try { // If the path doesn't exist in the db doc, make an empty object.
            curData = pointer.get(result.doc.doc, pathLeftover);
          } catch(err) {}
          let newData = _.merge(curData, res.data || {})
          pointer.set(result.doc.doc, pathLeftover, newData);
          dbPut.doc.doc = result.doc.doc;
        } else dbPut.doc.doc = _.merge(result.doc.doc, res.data || {});
      }
      return dbPut
    }).catch((e) => { // Else, resource was not in the db. 
      //console.log(e)
      if (req.method && req.method.toLowerCase() === 'delete') {
        // Deleting a resource that doesn't exist: do nothing.
      } else {
        if (pathLeftover) {
          //Execute the PUT and Warn users that the data is incomplete
          let doc = {};
          dbPut.doc._NOT_COMPLETE_RESOURCE = true;
          pointer.set(doc, pathLeftover, _.clone(res.data));
          dbPut.doc.doc = doc;
        } else dbPut.doc.doc = res.data;
      }
      return dbPut
    })
  }

  function dbUpsert(req, res) {
    return getUpsertDoc(req, res).then((dbPut) => {
      return db.put(dbPut) /*.then((result) => {
        req.method = 'get';
        console.log('regetting', req, res)
        return getResFromDb(req, res)
      })*/.catch((err) => {
        if (err.name === 'conflict') {
          //TODO: avoid infinite loops with this type of call
          // If there is a conflict in the lookup, repeat the lookup (the HEAD
          // request likely took too long and the lookup was already created by
          // another simultaneous request
          return dbUpsert(req, res)
        }
        throw err
      })
    })
  }

  function getResFromServer(req) {
    return request({
      method: 'GET',
      url: req.url,
      headers: req.headers
    }).then((res) => {
      res.cached = false;
      return dbUpsert(req, res).then(() => {
        return res
      })
    }).catch((err) => {
      throw err
    })
  }

  function getResFromDb(req, res) {
    let urlObj = url.parse(req.url)
    let pieces = urlObj.path.split('/')
    let resourceId = pieces.slice(1,3).join('/'); //returns resources/abc
    let pathLeftover = (pieces.length > 3) ? '/'+pieces.slice(3, pieces.length).join('/') : '';
    return db.get(resourceId).then((resource) => {
      if ((resource.doc._accessed+expiration) <= Date.now() || !resource.doc._valid) {
        return getResFromServer(req)
      }
      //If no pathLeftover, it'll just return resource!
      return Promise.try(() => {
        let data = pointer.get(resource.doc.doc, pathLeftover)
        return {
          data,
          headers: {
            'x-oada-rev': data._rev,
            'content-location': resourceId+pathLeftover
          },
          status: 200,
          cached: res ? res.cached : true,
        }
      })
    }).catch((err) => {
      //console.log(err);
      return getResFromServer(req)
    })
  }

  // Accepts an axios-style request. Returns:
  // {
  //
  //   data: the data requested,
  //
  //   _rev: the rev of the parent resource requested
  //
  //   location: e.g.: /resources/abc123/some/path/leftover
  //   
  // }
  async function get(req) {
    let urlObj = url.parse(req.url)
    if (!/^\/resources/.test(urlObj.path)) {
      // First lookup the resourceId in the cache
      try {
        let lookup = await getLookup(req)
        req.url = urlObj.protocol+'//'+urlObj.host+'/'+lookup.doc.resourceId+lookup.doc.pathLeftover;
      } catch(err) {
        throw err
      }
    }
    return getResFromDb(req)
  }

  // Perform lookup from bookmarks to resource id (and path leftover) mapping.
  // If the lookup fails, use a HEAD request to get it from the server and put
  // it in the cache. An optional _id can be passed into req to force creation
  // of a particular lookup in the even that the resource doesn't yet exist but _will_.
  // This is primarily for when links are created before the resource itself has been.
  function getLookup(req) {
    let urlObj = url.parse(req.url)
    let lookup = urlObj.host+urlObj.path;
    return db.get(lookup).catch(() => {
    //Not found. Go to the oada server, get the associated resource and path 
    //leftover, and save the lookup.
      return request({
        method: 'HEAD',
        url: req.url,
        headers: req.headers
      }).then((response) => {
        //Save the url lookup for future use
        let pieces = response.headers['content-location'].split('/')
        let resourceId = pieces.slice(1,3).join('/'); //returns resources/abc
        let pathLeftover = (pieces.length > 3) ? '/'+pieces.slice(3, pieces.length).join('/') : '';
        if (req._id) {
          resourceId = req._id;
          pathLeftover = '';
        }
        return db.put({
          _id: urlObj.host+urlObj.path,
          doc: {
            resourceId,
            pathLeftover
          }
        }).then(() => {
          return getLookup(req)
        }).catch((err) => {
          //TODO: avoid an infinite loop
          if (err.name === 'conflict') {
            // If there is a conflict in the lookup, repeat the lookup (the HEAD
            // request likely took too long and the lookup was already created by
            // another simultaneous request
            return getLookup(req)
          }
          console.log('ERR')
        })
      })
    })
  }

  // Ping for _rev update
  function checkChanges(req) {
    return request({
      method: 'HEAD',
      url: req.url,
      headers: req.headers
    }).then(() => {
      //compare to rev on hand
    })
  }

  // Create a queue of actual PUTs to make when online.
  // Resource breaks are known via setupTree. 
  // Do the puts, save out the resource IDs, and return to client
  // Create an index on the data to find those that need synced

  // Create a service that other apps can run which starts up and periodically 
  // checks if a connections has yet been made. A periodic service may also 
  // concievably check for updates to cached things.
  //
  // The cache should go "stale" after some period of time; However, if it cannot
  // establish a connection, it should remain valid, usable data.



  //TODO: First, get the _rev of the document to check against when the new rev
  // is determined.  Also, this function should compensate for a slow return time
  // from the PUT operation; it should repeat the GET process until it finds a new
  // _rev.
  

  // TODO: Need to update the cache for both the parent resource and child new
  // resource if one is created
  function put(req) {
    let urlObj = url.parse(req.url)
    return request(req).then((response) => {
      let _rev = response.headers['x-oada-rev'];
      let pieces = response.headers['content-location'].split('/')
      let resourceId = pieces.slice(1,3).join('/'); //returns resources/abc
      let pathLeftover = (pieces.length > 3) ? '/'+pieces.slice(3, pieces.length).join('/') : '';
      // Invalidate the resource in the cache (if it is cached)
      return dbUpsert({
        url: urlObj.protocol+'//'+urlObj.host+'/'+resourceId,
        headers: req.headers
      }, {
        data: undefined,
        _valid: false,
        headers: { 'x-oada-rev': _rev},
      }).then(() => {
        // Now get the data to bring it back into the cache. While dbUpsert does 
        // much of this, the lookup has not necessarily been created yet.
        return get({
          headers: req.headers, 
          url: urlObj.protocol+'//'+urlObj.host+'/'+resourceId,
          //url: urlObj.protocol+'//'+urlObj.host+'/'+resourceId+pathLeftover,
          method: 'get'
        }).then(() => {
          return response
        })
      })
    })
  }

    /*  async function _recursivePut(req) {
    let urlObj = url.parse(req.url);
    return Promise.map(Object.keys(req.data || {}), (data) => {
      var newData = replaceLinks(data, req)
    })
    if (body._rev) {
      let lookup = await getLookup({
        url: req.url,
        headers: req.headers,
        _id: body._id
      })
      let newBody = replaceLinks(body, {
        url: req.url,
        headers: req.headers
      });
      await dbUpsert({
        url: urlObj.protocol+'//'+urlObj.host+'/'+(body._id || lookup.doc.resourceId),
        headers: req.headers
      }, {
        data: newBody,
        headers: { 'x-oada-rev': newBody._rev },
      })
    }
    if (typeof body === 'object') {
      return Promise.map(Object.keys(body || {}), (key) => {
        if (key.charAt(0) === '_') return
        if (!body[key]) return
        return _recursiveUpsert({
          url: req.url+'/'+key,
          headers: req.headers
        }, body[key])
      })
    } else return
  }*/

  async function deleteCheckParent(req, res) {
    let urlObj = url.parse(req.url)
    let _rev = res.headers['x-oada-rev'];
    let lookup;
    // Try to get the parent document
    try {
      let reqPieces = urlObj.path.split('/')
      lookup = await getLookup({
        url: urlObj.protocol+'//'+urlObj.host+reqPieces.slice(0, reqPieces.length-1).join('/'),
        headers: req.headers
      })
      // if the parent document has a known resourceId, invalidate the link to the deleted child
      if (lookup && lookup.doc.resourceId) {
        let parentUrl = urlObj.protocol+'//'+urlObj.host+'/'+lookup.doc.resourceId+lookup.doc.pathLeftover;
        return dbUpsert({
          url: parentUrl,
          headers: req.headers,
          method: req.method,
        }, {
          data: undefined,
          _valid: false,
          headers: { 'x-oada-rev': _rev},
        })
      } return
    } catch(e) {
      throw e
    }
  }

  // ALTERNATIVELY, using db.remove:
  // 1. Delete at server
  // If no pathLeftover
  // 2a. Invalidate parent
  // 3a. Invalidate child
  // 4a. GET parent from server to cache the new, unlinked data
  // If pathleftover
  // 2b. GET the child to confirm and cache the new state
  async function dbDelete(req, res) {
    let urlObj = url.parse(req.url)
    let _rev = res.headers['x-oada-rev'];
    let pieces = res.headers['content-location'].split('/')
    let resourceId = pieces.slice(1,3).join('/'); //returns resources/abc
    let pathLeftover = (pieces.length > 3) ? '/'+pieces.slice(3, pieces.length).join('/') : '';
    // If it is itself a resource, we only need to invalidate the cache entry for
    // the parent (which links to the child)
    try {
      let lookup = await getLookup({
        url: req.url,
        headers: req.headers
      })
      await db.remove(lookup)
    } catch(err) {}
    if (!pathLeftover) return deleteCheckParent(req, res)
    // Else, invalidate the cache entry for the resource itself
    return dbUpsert({
      url: urlObj.protocol+'//'+urlObj.host+'/'+resourceId,
      headers: req.headers,
      method: req.method,
    }, {
      data: undefined,
      _valid: false,
      headers: { 'x-oada-rev': _rev},
    })
  }

  // Issue DELETE to server then update the db
  function del(req) {
    let urlObj = url.parse(req.url)
    return request(req).then((response) => {
      return dbDelete(req, response).then(() => {
        //it should return something that looks like a delete response
        return response
      })
    }).catch((e) => {
      // Handle offline case
      throw e
    })
  }

  function replaceLinks(obj, req) {
    let ret = (Array.isArray(obj)) ? [] : {};
    if (!obj) return obj;
    Object.keys(obj || {}).forEach(async function(key, i) {
      let val = obj[key];
      if (typeof val !== 'object' || !val) {
        ret[key] = val; // keep it asntType: 'application/vnd.oada.harvest.1+json'
        return;
      }
      if (val._meta) { // If has a '_rev' (i.e, resource), make it a link
        let lookup = await getLookup({
          url: req.url+'/'+key,
          headers: req.headers
        })
        ret[key] = { _id: lookup.doc.resourceId };
        if (obj[key]._rev) ret[key]._rev = obj[key]._rev
        return;
      }
      ret[key] = replaceLinks(obj[key], {
        url: req.url+'/'+key,
        headers: req.headers
      }); // otherwise, recurse into the object
    });
    return ret;
  }

  async function _recursiveUpsert(req, body) {
    let urlObj = url.parse(req.url);
    if (body._rev) {
      let lookup = await getLookup({
        url: req.url,
        headers: req.headers,
        _id: body._id
      })
      let newBody = replaceLinks(body, {
        url: req.url,
        headers: req.headers
      });
      await dbUpsert({
        url: urlObj.protocol+'//'+urlObj.host+'/'+(body._id || lookup.doc.resourceId),
        headers: req.headers
      }, {
        data: newBody,
        headers: { 'x-oada-rev': newBody._rev },
      })
    }
    if (typeof body === 'object') {
      return Promise.map(Object.keys(body || {}), (key) => {
        if (key.charAt(0) === '_') return
        if (!body[key]) return
        return _recursiveUpsert({
          url: req.url+'/'+key,
          headers: req.headers
        }, body[key])
      })
    } else return
  }

  function findNullValue(obj, path, nullPath) {
    if (typeof obj === 'object') {
      return Promise.map(Object.keys(obj || {}), (key) => {
        if (obj[key] === null) {
          nullPath = path + '/' + key;
          return nullPath;
        }
        return findNullValue(obj[key], path+'/'+key, nullPath).then((res) => {
          nullPath = res || nullPath;
          return res || nullPath
        })
      }).then(() => {
        return nullPath
      })
    } else return Promise.resolve(undefined)
  }

  // Will this handle watches put on keys of a resource? i.e., no _id to be found
  function findDeepestResource(obj, path, deepestResource) {
    if (typeof obj === 'object') {
      return Promise.map(Object.keys(obj || {}), (key) => {
        // _rev updates guaranteed to be present in change docs for affected resources
        if (key === '_rev') {
          deepestResource.path = path;
          deepestResource.data = obj;
        } else if (key.charAt(0) === '_') return deepestResource
        return findDeepestResource(obj[key], path+'/'+key, deepestResource).then(() => {
          return deepestResource
        })
      }).then(() => {
        return deepestResource
      })
    }
    return Promise.resolve(deepestResource);
  }

  function handleWatchChange(payload) {
    let urlObj = url.parse(payload.request.url)
    // Give the change body an _id so the deepest resource can be found
    payload.response.change.body._id = payload.response.resourceId;
    //TODO: This should be unnecessary. The payload ought to specify the root
    //of the watch as a resource.
    return findDeepestResource(payload.response.change.body, '', {
      path: '',
      data: payload.response.change.body,
    }).then(async (deepestResource) => {
      switch (payload.response.change.type.toLowerCase()) {
        case 'delete':
          // DELETE: remove the deepest resource from the change body, execute
          // the delete, and recursively update all other revs in the cache
          let nullPath = await findNullValue(deepestResource.data, '', '')
          let deletedPath = deepestResource.path+nullPath
          payload.nullPath = deletedPath;
          let lookup = await getLookup({
            url: payload.request.url+deepestResource.path+nullPath,
            header: payload.request.headers
          })
          return dbDelete({
            url: payload.request.url+deepestResource.path+nullPath,
            headers: payload.request.headers,
            method: payload.response.change.type
          }, {
            headers: {
              'x-oada-rev': deepestResource.data._rev,
              'content-location':  '/'+lookup.doc.resourceId
            }
          }).then(() => {
            // Update revs on all parents all the way down to (BUT OMITTING) the 
            // resource on which was the delete was called.
            pointer.remove(payload.response.change.body, deepestResource.path || '/')
            return _recursiveUpsert(payload.request, payload.response.change.body)
          })
          break;
        // Recursively update all of the resources down the returned change body
        case 'merge':
          return _recursiveUpsert(payload.request, payload.response.change.body)
          break;

        default:
          return;
      }
    }).catch((err) => {
      return
    })
  }

  async function resetCache() {
    if (db) await db.destroy();
    db = undefined;
    request = undefined;
    expiration = undefined;
  }

  let api = function handleRequest(req) {
    switch(req.method) {
      case 'get':
        return get(req);
      case 'delete':
        return del(req)
      case 'put':
        return put(req)
    }
  }

  return {
    api,
    db,
    resetCache,
    handleWatchChange,
	}
}

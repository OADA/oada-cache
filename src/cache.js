"use strict"
var pretty = require('prettyjson');
var Promise = require('bluebird');
var PouchDB = require('pouchdb');
var url = require('url');
var _ = require('lodash');
var pointer = require('json-pointer');
var OFFLINE = false;

//TODO: Should getLookup throw an error or return undefined?
// This needs to be handled by all that call getLookup!!!

export default function setupCache({name, req, exp}) {
try {

// name should be made unique across domains and users
	var db = db || new PouchDB(name);
	PouchDB.on('destroyed', function(dbName) {
		if (dbName === name) {
			db = new PouchDB(name)
		}
	})
	var request = req;
	var expiration = exp || 1000*60*60*24*2;//(ms/s)*(s/min)*(min/hr)*(hr/days)*days

// Get the resource and merge data if its already in the db.
  function dbUpsert(req, waitTime) {
    var urlObj = url.parse(req.url)
    var pieces = urlObj.path.split('/')
    var resourceId = pieces.slice(1,3).join('/'); //returns resources/abc
    var pathLeftover = (pieces.length > 3) ? '/'+pieces.slice(3, pieces.length).join('/') : '';

    // Create the content to put in the cache
    var dbPut = {
      _id: resourceId,
      valid: (req.valid === undefined) ? true : req.valid,
      // TODO: This current resets this access date for e.g., every put
      // while offline. This doesn't seem right. I think this should only
      // get updated when we know we're upserting a new value from the server
      accessed: Date.now(),
    }

    // ALL updates to existing docs (upserts) need to supply the current _rev.
    return db.get(resourceId).then((result) => {
    //If theres a path leftover, create an empty object, add a key to warn users
    //that the data is incomplete, and put the data at that path Leftover
      if (result.INCOMPLETE_RESOURCE) dbPut.INCOMPLETE_RESOURCE = true;
      dbPut._rev = result._rev
      if (req.method && req.method.toLowerCase() === 'delete') {
        if (!pathLeftover) {
          return db.remove(result)
        } else if (pointer.has(dbPut.doc, pathLeftover)) {
          dbPut.doc = result.doc;
          pointer.remove(dbPut.doc, pathLeftover)
          return db.put(dbPut).then((rrr) => {
						return rrr;
					}).catch((err) => {
						if (err.status === 409) {
							waitTime = waitTime || 1000;
							return Promise.delay(waitTime).then(() => {
								if (waitTime > 16000) throw err;
								return dbUpsert(req, waitTime*2)
							})
						}
						throw err;
					})
        }
      } else {
        if (pathLeftover) {
          // merge the new data into the old at the path leftover, then return old
          var curData = {};
          if (pointer.has(result.doc, pathLeftover)) curData = pointer.get(result.doc, pathLeftover);
          var newData = _.merge(curData, req.data || {})
          pointer.set(result.doc, pathLeftover, newData);
          dbPut.doc = result.doc;
        } else {
					dbPut.doc = _.merge(result.doc, req.data);
				}
      }

			if (req._rev) dbPut.doc._rev = req._rev;

      return db.put(dbPut).then((rrr) => {
				return rrr;
			}).catch((err) => {
				// retry 409s
				if (err.status === 409) {
					waitTime = waitTime || 1000;
					return Promise.delay(waitTime).then(() => {
						if (waitTime > 16000) throw err;
						return dbUpsert(req, waitTime*2)
					})
				}
				throw err;
      })

    // Else, the resource was not in the cache. 
    }).catch((e) => {
      if (req.method && req.method.toLowerCase() === 'delete') {
        // Deleting a resource that doesn't exist: do nothing.
      } else {
        if (pathLeftover) {
          //Execute the PUT and Warn users that the data is incomplete
          dbPut.doc = {};
          dbPut.INCOMPLETE_RESOURCE = true;
          pointer.set(dbPut.doc, pathLeftover, _.clone(req.data));
        } else dbPut.doc = req.data;
      }

			if (req._rev) dbPut.doc._rev = req._rev;

      return db.put(dbPut).then((rrr) => {
				return rrr
			}).catch((err) => {
				// retry 409s
				if (err.status === 409) {
					waitTime = waitTime || 1000;
					return Promise.delay(waitTime).then(() => {
						if (waitTime > 16000) throw err;
						return dbUpsert(req, waitTime*2)
					})
				}
				throw err;
      })
    })
  }

      /*
  async function dbUpsert(req) {
    var dbPut = await getUpsertDoc(req)
    await db.put(dbPut)
    } catch(err) {
      if (err.name === 'conflict') {
        //TODO: avoid infinite loops with this type of call
        // If there is a conflict in the lookup, repeat the lookup (the HEAD
        // request likely took too long and the lookup was already created by
        // another simultaneous request
        return dbUpsert(req)
      }
      throw err
    }
  }
  */

  async function getResFromServer(req) {
    var res = await request({
      method: 'GET',
      url: req.url,
      headers: req.headers
    })
    res.cached = false;
    req.data = res.data;
    await dbUpsert(req)
    return res
  }

  function getResFromDb(req, offline) {
    var urlObj = url.parse(req.url)
    var pieces = urlObj.path.split('/')
    var resourceId = pieces.slice(1,3).join('/'); //returns resources/abc
    var pathLeftover = (pieces.length > 3) ? '/'+pieces.slice(3, pieces.length).join('/') : '';
    return db.get(resourceId).then((resource) => {
      if (!offline && ((resource.accessed+expiration) <= Date.now() || !resource.valid)) {
        return getResFromServer(req)
      }
      //If no pathLeftover, it'll just return resource!
      if (pointer.has(resource.doc, pathLeftover)) {
        var data = pointer.get(resource.doc, pathLeftover)
        return {
          data,
          headers: {
            'x-oada-rev': data._rev,
            'content-location': resourceId+pathLeftover
          },
          status: 200,
          cached: true,
        }
      } else {
        return getResFromServer(req)
      }
    }).catch((err) => {
      if (!offline) return getResFromServer(req)
      return
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
    var urlObj = url.parse(req.url)
		var newReq = _.cloneDeep(req)
    if (!/^\/resources/.test(urlObj.path)) {
      // First lookup the resourceId in the cache
      var lookup = await getLookup(req)
			newReq.url = urlObj.protocol+'//'+urlObj.host+'/'+lookup.resourceId+lookup.pathLeftover;
    }
    return getResFromDb(newReq).then((result) => {
			return result
		})
  }

  // Perform lookup from bookmarks to resource id (and path leftover) mapping.
  // If the lookup fails, use a HEAD request to get it from the server and put
  // it in the cache. An optional _id can be passed into req to force creation
  // of a particular lookup in the event that the resource doesn't yet exist but will.
  // This is primarily for when links are created before the resource itself has been.
  function getLookup(req) {
    var urlObj = url.parse(req.url)
    var lookup = urlObj.host+urlObj.path;
    return db.get(lookup).catch(async function() {
    //Not found. Go to the oada server, get the associated resource and path 
    //leftover, and save the lookup.
			var resourceId;
			var pathLeftover;
			if (req._id) {
          resourceId = req._id;
          pathLeftover = '';
			} else {
				var response = await request({
					method: 'HEAD',
					url: req.url,
					headers: req.headers
				})
        //Save the url lookup for future use
        var pieces = response.headers['content-location'].split('/')
        resourceId = pieces.slice(1,3).join('/'); //returns resources/abc
        pathLeftover = (pieces.length > 3) ? '/'+pieces.slice(3, pieces.length).join('/') : '';
			}
			// Put the new lookup
			return db.put({
				_id: urlObj.host+urlObj.path,
				resourceId,
				pathLeftover
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
      })
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
  async function put(req, offline) {
    let urlObj = url.parse(req.url)
    if (offline) {
      //TODO:
      // 1) get the lookup
      // 2) store the last known online record
      // 3) store the change request into an array of offlineChanges
      // 4) update the cache (but dirty it)
      var lookup = await getLookup({
        url: urlObj.protocol+'//'+urlObj.host+reqPieces.slice(0, reqPieces.length-1).join('/'),
        headers: req.headers
      })
    } else {
      var response = await request(req)

      // Invalidate the resource in the cache (if it is cached)
      await dbUpsert({
        url: urlObj.protocol+'//'+urlObj.host+response.headers['content-location'],
        data: req.data,
				_rev: response.headers['x-oada-rev'],
				// TODO: should it be invalidated until pulled from server?
				valid: false
      })
      return response
    }
  }

  // Remove the deleted key from the parent resource optimistically using
  // put(). Also mark the parent invalid as the _rev update will affect it
  async function updateParent(req) {
    var urlObj = url.parse(req.url)
    // Try to get the parent document
    var reqPieces = urlObj.path.split('/')
    var lookup = await getLookup({
      url: urlObj.protocol+'//'+urlObj.host+reqPieces.slice(0, reqPieces.length-1).join('/'),
      headers: req.headers
    })
    await dbUpsert({
      url: urlObj.protocol+'//'+urlObj.host+'/'+lookup.resourceId+lookup.pathLeftover,
      method: 'delete',
      valid: false
    })
    return
  }

  // Issue DELETE to server then update the db
  async function del(req, offline) {
    var urlObj = url.parse(req.url)
    // Handle resource deletion
    if (/^\/resources/.test(urlObj.path)) {
      // Submit a dbUpsert to either remove the whole cache document or else
      // a key within a document
      var res = await dbUpsert({
        url: req.url,
        method: req.method,
        valid: false,
      })
    // Handle bookmarks link deletion
    } else {
      var pathLeftover;
      var resourceId;
      // Remove the lookup. This is specific to the specific endpoint
      var lookup = await getLookup({
        url: req.url,
        headers: req.headers
      })
      await db.remove(lookup)

      // If no path leftover, we just deleted a resource; invalidate parent link
      if (!lookup.pathLeftover) await updateParent(req)
    }

    // Execute the request if we're online, else queue it up
    var response;
    if (!offline) {
      response = await request(req)
    } else {}

    return response || res;
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
        ret[key] = { _id: lookup.resourceId };
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
        url: urlObj.protocol+'//'+urlObj.host+'/'+(body._id || lookup.resourceId),
        data: newBody,
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

	/*
  async function _upsertChangeArray(payload) {
    let urlObj = url.parse(payload.request.url);
    return Promise.map(payload.response.changes || [], async (change) => {
      if (change.type === 'merge') {
        return dbUpsert({
          url: urlObj.protocol+'//'+urlObj.host+'/'+change._id,
          data: change.body,
        })
      } else if (change.type === 'delete') {
        var nullPath = await findNullValue(change.body, '', '')
        return dbUpsert({
          url: urlObj.protocol+'//'+urlObj.host+'/'+change._id+nullPath,
          data: change.body,
        })
      }
    })
  }
	*/

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
    //handleWatchChange: _upsertChangeArray,
	}
} catch(err) {
  console.log(err) 
}
}

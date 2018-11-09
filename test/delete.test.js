process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
const Promise = require('bluebird');
const oada = require('../build/index')
const _ = require('lodash');
const {expect} = require('chai');
const config = require('./config.js');
const {putResource, cleanUp, getConnections} = require('./utils.js');
var token = config.token;
var domain = config.domain;

var connections;
var resources = [];

describe('~~~~DELETE METHOD~~~~~~~', () => {
  var conn;
  before('First, get the connections', async function() {
    connections = await getConnections({
      domain,
      token: 'def',
    })

    conn = connections['cNoWNo']
  })

  it(`Should error when neither 'url' nor 'path' are supplied`, async function() {
		
		await conn.resetCache()
		await cleanUp(resources, domain, token);
		await putResource({'something': 'b'}, '/bookmarks/test')

    try {
      var response = await conn.delete({
        type: 'application/json'
      })
      expect(response.status).not.to.equal(204)
    } catch (error) {
      expect(error.message).to.equal('Either path or url must be specified.')
    }
  })

  it(`Shouldn't error when the 'Content-Type' header can be derived from the 'type' key`, async function() {
		await conn.resetCache()
		await cleanUp(resources, domain, token);
		await putResource({'something': 'b'}, '/bookmarks/test')
    var response = await conn.delete({
      path: '/bookmarks/test',
      type: 'application/json'
    })
    expect(response.status).to.equal(204)
  })

  it(`Shouldn't error when 'Content-Type' header is specified.`, async function() {
		await conn.resetCache()
		await cleanUp(resources, domain, token);
		await putResource({'something': 'b'}, '/bookmarks/test')
    var response = await conn.delete({
      path: '/bookmarks/test',
      headers: {'content-type': 'application/json'}
    })
    expect(response.status).to.equal(204)
  })

  it(`Should error when _type cannot be derived from the above tested sources`, async function() {
		await conn.resetCache()
		await cleanUp(resources, domain, token);
		await putResource({'something': 'b'}, '/bookmarks/test')
		try {
      var response = await conn.delete({
        path: '/bookmarks/test',
      })
		}catch(error) {
      expect(error.message).to.equal(`'content-type' header must be specified.`)
		}
  })

	it(`Should produce a 403 error when using a content-type header for which your token does not have access to read/write`, async function() {
		this.timeout(4000);
		try {
			await conn.resetCache()
			await cleanUp(resources, domain, token);
			await putResource({'something': 'b'}, '/bookmarks/test')
			var response = await conn.delete({
				path: '/bookmarks/test',
				headers: {'content-type': 'application/vnd.oada.foobar.1+json'},
			})
			expect(response.status).to.equal(403)
		} catch(err) {
			expect(err.response.status).to.equal(403)
		}
	})

	it(`Should allow us to delete only a resource and leave the link alone`, async function() {
		this.timeout(4000);
		await conn.resetCache()
		await cleanUp(resources, domain, token);
		var result = await putResource({'something': 'b'}, '/bookmarks/test')
		var deleteResponse = await conn.delete({
			path: result.resource.headers['content-location'],
      headers: {'content-type': 'application/json'}
		})
		expect(deleteResponse.status).to.equal(204);
		var response = await conn.get({
			path: '/bookmarks/test'
		})
		expect(response.status).to.equal(200);
		expect(response.data).to.include.keys(['_id', '_rev'])
		expect(response.data).to.not.include.keys(['_meta', '_type', 'something'])
	})

	it(`Should allow us to delete only a link and leave the resource alone`, async function() {
		this.timeout(4000);
		await conn.resetCache()
		await cleanUp(resources, domain, token);
		var result = await putResource({'something': 'b'}, '/bookmarks/test')
		var deleteResponse = await conn.delete({
			path: '/bookmarks/test',
      headers: {'content-type': 'application/json'}
		})
		expect(deleteResponse.status).to.equal(204);
		var response = await conn.get({
			path: result.resource.headers['content-location'],
		})
		expect(response.status).to.equal(200);
	})

	it(`Should handle a sequence of deletes, ultimately deleting the target endpoint as intended`, async function() {
		this.timeout(4000);
		await conn.resetCache()
		await cleanUp(resources, domain, token);
		var result = await putResource({'something': 'b'}, '/bookmarks/test')
		var deleteOne = await conn.delete({
			path: '/bookmarks/test',
      headers: {'content-type': 'application/json'}
		})
		expect(deleteOne.status).to.equal(204)
		var deleteTwo = await conn.delete({
			path: '/bookmarks/test',
			headers: {'content-type': 'application/json'}
		})
		expect(deleteTwo.status).to.equal(204)
	})

	it(`Should handle concurrent deletes, ultimately deleting the target endpoint as intended`, async function() {
		this.timeout(4000);
		await conn.resetCache()
		await cleanUp(resources, domain, token);
		var result = await putResource({'something': 'b'}, '/bookmarks/test')
		var deleteOne = conn.delete({
			path: '/bookmarks/test',
      headers: {'content-type': 'application/json'}
		})
		var deleteTwo = conn.delete({
			path: '/bookmarks/test',
			headers: {'content-type': 'application/json'}
		})
		var deleteThree = conn.delete({
			path: '/bookmarks/test',
			headers: {'content-type': 'application/json'}
		})
		await Promise.join(deleteOne, deleteTwo, deleteThree, async function(deleteOne, deleteTwo, deleteThree) {
			expect(deleteOne.status).to.equal(204)
			expect(deleteTwo.status).to.equal(204)
			expect(deleteThree.status).to.equal(204)
			try {
				var response = await conn.get({
					path: '/bookmarks/test',
				})
				expect(response.status).to.equal(404)
			} catch(err) {
				expect(err.response.status).to.equal(404)
			}
		})
	})

	it(`Should produce a 412 if the 'If-Match' precondition fails`, async function() {
		try {
			this.timeout(4000);
			await conn.resetCache();
			await cleanUp(resources, domain, token);
			var result = await putResource({foo: 'bar'}, '/bookmarks/test');
			var response = await conn.delete({
				path: '/bookmarks/test',
				headers: {
					'If-Match': '2-foobar',
					'content-type': 'application/json'
				}
			})
			expect(response.status).to.equal(412)
		} catch (err) {
			expect(err.response.status).to.equal(412)
		}
	})

	it(`Should succeed in deleting a link if a valid 'If-Match' header which matches the current resource's _rev is supplied`, async function() {
		var result = await putResource({something: 'else'}, '/bookmarks/test');
		var response = await conn.delete({
			path: '/bookmarks/test',
			headers: {
				'if-match': result.resource.headers['x-oada-rev'],
				'content-type': 'application/json'
			}
		})
		expect(response.status).to.equal(204)
	})

	it(`Should succeed in deleting a resource if a valid 'If-Match' header which matches the current resource's _rev is supplied`, async function() {
		var result = await putResource({foo: 'bar'}, '/bookmarks/test');
		console.log(result.resource.headers['x-oada-rev'])
		var response = await conn.delete({
			path: result.resource.headers['content-location'],
			headers: {
				'if-match': result.resource.headers['x-oada-rev'],
				'content-type': 'application/json'
			}
		})
		expect(response.status).to.equal(204)
	})

  it('Now clean up', async function() {
    await conn.resetCache();
    return cleanUp(resources, domain, token);
  })

})

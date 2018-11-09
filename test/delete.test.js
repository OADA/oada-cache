process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
const Promise = require('bluebird');
const oada = require('../build/index')
const _ = require('lodash');
var chai = require('chai');
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
var expect = chai.expect;
const {token, domain} = require('./config.js');
const {putResource, cleanUp, getConnections} = require('./utils.js');

var connections;
var resources = [];

describe(`------------DELETE-----------------`, async function() {
	before(`Create connection types`, async function() {
		connections = await getConnections({
			domain,
			token
		})
		connections = Object.values(connections)
	})

	for (let i = 0; i < 4; i++) {
		describe(`Testing connection ${i+1}`, async function() {
			it(`Should error when neither 'url' nor 'path' are supplied`, async function() {
				await connections[i].resetCache()
				await cleanUp(resources, domain, token);
				await putResource({'something': 'b'}, '/bookmarks/test')

				return expect(
					connections[i].delete({
						type: 'application/json'
					})
				).to.be.rejectedWith(Error, 'Either path or url must be specified.')
			})

			/*
			it(`Shouldn't error when the 'Content-Type' header can be derived from the 'type' key`, async function() {
				await connections[i].resetCache()
				await cleanUp(resources, domain, token);
				await putResource({'something': 'b'}, '/bookmarks/test')
				var response = await connections[i].delete({
					path: '/bookmarks/test',
					type: 'application/json'
				})
				expect(response.status).to.equal(204)
			})

			it(`Shouldn't error when 'Content-Type' header is specified.`, async function() {
				await connections[i].resetCache()
				await cleanUp(resources, domain, token);
				await putResource({'something': 'b'}, '/bookmarks/test')
				var response = await connections[i].delete({
					path: '/bookmarks/test',
					headers: {'content-type': 'application/json'}
				})
				expect(response.status).to.equal(204)
			})

			it(`Should error when _type cannot be derived from the above tested sources`, async function() {
				await connections[i].resetCache()
				await cleanUp(resources, domain, token);
				await putResource({'something': 'b'}, '/bookmarks/test')
				return expect(
					connections[i].delete({
						path: '/bookmarks/test',
					})
				).to.be.rejectedWith(Error, `'content-type' header must be specified.`)
			})

			it(`Should produce a 403 error when using a content-type header for which your token does not have access to read/write`, async function() {
				this.timeout(4000);
				await connections[i].resetCache()
				await cleanUp(resources, domain, token);
				await putResource({'something': 'b'}, '/bookmarks/test')
				return expect(
					connections[i].delete({
						path: '/bookmarks/test',
						headers: {'content-type': 'application/vnd.oada.foobar.1+json'},
					})
				).to.be.rejectedWith(Error, `Forbidden`)
			})

			it(`Should allow us to delete only a resource and leave the link alone`, async function() {
				this.timeout(4000);
				await connections[i].resetCache()
				await cleanUp(resources, domain, token);
				var result = await putResource({'something': 'b'}, '/bookmarks/test')
				var deleteResponse = await connections[i].delete({
					path: result.resource.headers['content-location'],
					headers: {'content-type': 'application/json'}
				})
				expect(deleteResponse.status).to.equal(204);
				var response = await connections[i].get({
					path: '/bookmarks/test'
				})
				expect(response.status).to.equal(200);
				expect(response.data).to.include.keys(['_id', '_rev'])
				expect(response.data).to.not.include.keys(['_meta', '_type', 'something'])
			})

			it(`Should allow us to delete only a link and leave the resource alone`, async function() {
				this.timeout(4000);
				await connections[i].resetCache()
				await cleanUp(resources, domain, token);
				var result = await putResource({'something': 'b'}, '/bookmarks/test')
				var deleteResponse = await connections[i].delete({
					path: '/bookmarks/test',
					headers: {'content-type': 'application/json'}
				})
				expect(deleteResponse.status).to.equal(204);
				var response = await connections[i].get({
					path: result.resource.headers['content-location'],
				})
				expect(response.status).to.equal(200);
			})

			it(`Should handle a sequence of deletes, ultimately deleting the target endpoint as intended`, async function() {
				this.timeout(4000);
				await connections[i].resetCache()
				await cleanUp(resources, domain, token);
				var result = await putResource({'something': 'b'}, '/bookmarks/test')
				var deleteOne = await connections[i].delete({
					path: '/bookmarks/test',
					headers: {'content-type': 'application/json'}
				})
				expect(deleteOne.status).to.equal(204)
				var deleteTwo = await connections[i].delete({
					path: '/bookmarks/test',
					headers: {'content-type': 'application/json'}
				})
				expect(deleteTwo.status).to.equal(204)
			})

			it(`Should handle concurrent deletes, ultimately deleting the target endpoint as intended`, async function() {
				this.timeout(4000);
				await connections[i].resetCache()
				await cleanUp(resources, domain, token);
				var result = await putResource({'something': 'b'}, '/bookmarks/test')
				var deleteOne = connections[i].delete({
					path: '/bookmarks/test',
					headers: {'content-type': 'application/json'}
				})
				var deleteTwo = connections[i].delete({
					path: '/bookmarks/test',
					headers: {'content-type': 'application/json'}
				})
				var deleteThree = connections[i].delete({
					path: '/bookmarks/test',
					headers: {'content-type': 'application/json'}
				})
				await Promise.join(deleteOne, deleteTwo, deleteThree, async function(deleteOne, deleteTwo, deleteThree) {
					expect(deleteOne.status).to.equal(204)
					expect(deleteTwo.status).to.equal(204)
					expect(deleteThree.status).to.equal(204)
					try {
						var response = await connections[i].get({
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
					await connections[i].resetCache();
					await cleanUp(resources, domain, token);
					var result = await putResource({foo: 'bar'}, '/bookmarks/test');
					var response = await connections[i].delete({
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
				var response = await connections[i].delete({
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
				var response = await connections[i].delete({
					path: result.resource.headers['content-location'],
					headers: {
						'if-match': result.resource.headers['x-oada-rev'],
						'content-type': 'application/json'
					}
				})
				expect(response.status).to.equal(204)
			})
*/
			it('Now clean up', async function() {
				await connections[i].resetCache();
				return cleanUp(resources, domain, token);
			})
		})
	}
})

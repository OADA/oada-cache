process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
const Promise = require('bluebird');
const oada = require('../build/index')
const _ = require('lodash');
var chai = require('chai');
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
var expect = chai.expect;
const {token, domain} = require('./config.js');
const {tree, putResource, getConnections} = require('./utils.js');

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
				console.log(`Cache: ${connections[i].cache ? true : false}; Websocket: ${connections[i].websocket ? true : false}`)
				await connections[i].resetCache()
				await connections[i].delete({path:'/bookmarks/test', tree})
				await putResource({'something': 'b'}, '/bookmarks/test')

				return expect(
					connections[i].delete({
						type: 'application/json'
					})
				).to.be.rejectedWith(Error, 'Either path or url must be specified.')
			})

			it(`Shouldn't error when the 'Content-Type' header can be derived from the 'type' key`, async function() {
				await connections[i].resetCache()
				await connections[i].delete({path:'/bookmarks/test', tree})
				await putResource({'something': 'b'}, '/bookmarks/test')
				var response = await connections[i].delete({
					path: '/bookmarks/test',
					type: 'application/json'
				})
				expect(response.status).to.equal(204)
			})

			it(`Shouldn't error when 'Content-Type' header is specified.`, async function() {
				await connections[i].resetCache()
				await connections[i].delete({path:'/bookmarks/test', tree})
				await putResource({'something': 'b'}, '/bookmarks/test')
				var response = await connections[i].delete({
					path: '/bookmarks/test',
					headers: {'content-type': 'application/json'}
				})
				expect(response.status).to.equal(204)
			})

			it(`Should error when _type cannot be derived from the above tested sources`, async function() {
				await connections[i].resetCache()
				await connections[i].delete({path:'/bookmarks/test', tree})
				await putResource({'something': 'b'}, '/bookmarks/test')
				return expect(
					connections[i].delete({
						path: '/bookmarks/test',
					})
				).to.be.rejectedWith(Error, `content-type header must be specified.`)
			})

			it(`Should produce a 403 error when using a content-type header for which your token does not have access to read/write`, async function() {
				this.timeout(4000);
				await connections[i].resetCache()
				await connections[i].delete({path:'/bookmarks/test', tree})
				await putResource({'something': 'b'}, '/bookmarks/test')
				return expect(
					connections[i].delete({
						path: '/bookmarks/test',
						headers: {'content-type': 'application/vnd.oada.foobar.1+json'},
					})
				).to.be.rejectedWith(Error, `Request failed with status code 403`)
			})
  
			it(`Should allow us to delete only a resource and leave the link alone`, async function() {
				this.timeout(4000);
				await connections[i].resetCache()
        await connections[i].delete({path:'/bookmarks/test', tree})
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
				await connections[i].delete({path:'/bookmarks/test', tree})
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

			it(`Should handle a two deletes in series`, async function() {
				this.timeout(4000);
				await connections[i].resetCache()
				await connections[i].delete({path:'/bookmarks/test', tree})
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
				await connections[i].delete({path:'/bookmarks/test', tree})
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
					return expect(connections[i].get({
						path: '/bookmarks/test',
					})).to.be.rejectedWith(Error, 'Request failed with status code 404');
				})
			})

			it(`Should produce a 412 if the 'If-Match' precondition fails`, async function() {
				this.timeout(4000);
				await connections[i].resetCache();
				await connections[i].delete({path:'/bookmarks/test', tree})
				var result = await putResource({foo: 'bar'}, '/bookmarks/test');
				return expect(connections[i].delete({
					path: '/bookmarks/test',
					headers: {
						'If-Match': '2-foobar',
						'content-type': 'application/json'
					}
				})).to.be.rejectedWith(Error, 'Request failed with status code 412')
			})

			it(`Should succeed in deleting a link if a valid 'If-Match' header which matches the current resource's _rev is supplied`, async function() {
				var result = await putResource({something: 'else'}, '/bookmarks/test');
				var response = await connections[i].delete({
					path: '/bookmarks/test',
					headers: {
						'if-match': result.link.headers['x-oada-rev'],
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

			it(`Should delete an entire tree of links and resources when the 'tree' option is supplied`, async function() {
				var test = await putResource({foo: 'bar'}, '/bookmarks/test');
				var aaa = await putResource({foo: 'bar'}, '/bookmarks/test/aaa');
				var bbb = await putResource({foo: 'bar'}, '/bookmarks/test/aaa/bbb');
				var ccc = await putResource({foo: 'bar'}, '/bookmarks/test/aaa/bbb/index-one/ccc');
				var response = await connections[i].delete({
					path: '/bookmarks/test',
					tree
				})
				expect(response.status).to.equal(204)
				return Promise.each([
					test.resource.headers['content-location'],
					aaa.link.headers['content-location'],
					aaa.resource.headers['content-location'],
					bbb.link.headers['content-location'],
					bbb.resource.headers['content-location'],
					ccc.link.headers['content-location'],
					ccc.resource.headers['content-location'],
				], (path) => {
					if (/^\/resources/.test(path)) {
						return expect(connections[i].get({path})).to.be.rejectedWith(Error, 'Request failed with status code 403');
					} else {
						return expect(connections[i].get({path})).to.be.rejectedWith(Error, 'Request failedf with status code 404');
					}
				})
			})

      it(`Should gracefully handle a sequence of PUT, DELETE, PUT executed in series`, async function() {
        this.timeout(4000);
				var putOne = await connections[i].put({
					path: '/bookmarks/test/aaa',
					tree,
					data: {putOne: 'putOne'}
				})
				expect(putOne.status).to.equal(204)

				var putTwo = await connections[i].put({
					path: '/bookmarks/test/aaa/bbb',
					tree,
					data: {putTwo: 'putTwo'}
				})
				expect(putTwo.status).to.equal(204)

				var deleteOne = await connections[i].delete({
					path: '/bookmarks/test',
					tree,
				})
				expect(deleteOne.status).to.equal(204)

				var putThree = await connections[i].put({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc',
					tree,
					data: {putThree: 'putThree'}
				})
				expect(putThree.status).to.equal(204)

				var getOne = await connections[i].get({
					path: '/bookmarks/test',
					tree
				})
				expect(getOne.status).to.equal(200)
				expect(getOne.data.aaa).to.not.include.key('putOne')
				expect(getOne.data.aaa.bbb).to.not.include.key('putTwo')
				expect(getOne.data.aaa.bbb['index-one'].ccc).to.include.key('putThree')
      })

      it(`Should gracefully handle a concurrent sequence of PUT, DELETE, PUT`, async function() {
        this.timeout(6000);
				await connections[i].resetCache();
        await connections[i].delete({path:'/bookmarks/test', tree})

				var putOne = connections[i].put({
					path: '/bookmarks/test/aaa',
					tree,
					data: {putOne: 'putOne'}
				})
				var putTwo = connections[i].put({
					path: '/bookmarks/test/aaa/bbb',
					tree,
					data: {putTwo: 'putTwo'}
				})
				var deleteOne = connections[i].delete({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc',
					tree,
				})
				var putThree = connections[i].put({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc',
					tree,
					data: {putThree: 'putThree'}
				})
				var result = await Promise.join(
					putOne, 
					putTwo, 
					deleteOne, 
					putThree, 
          async function(putOne,putTwo,deleteOne,putThree) {
						expect(putOne.status).to.equal(204)
						expect(putTwo.status).to.equal(204)
						expect(deleteOne.status).to.equal(204)
						expect(putThree.status).to.equal(204)
					}
				)
      })

			it('Now clean up', async function() {
				await connections[i].resetCache();
				await connections[i].delete({path:'/bookmarks/test', tree})
      })
		})
	}
})

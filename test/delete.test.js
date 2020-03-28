process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0
const Promise = require('bluebird')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const { expect } = chai
const { token, domain } = require('./config.js')
const { tree, putResource, getConnections } = require('./utils.js')

const connections = getConnections({
  domain,
  token
})

describe(`------------DELETE-----------------`, function () {
  for (const connection of connections) {
    const { cache, websocket } = connection
    describe(`Testing connection cache:${cache} websocket:${websocket}`, function () {
      let conn
      before('Wait on connection', async function () {
        conn = await connection
      })

      beforeEach('Reset connection', async function () {
        await conn.resetCache()
        await conn.delete({ path: '/bookmarks/test', tree })
      })

      after('Clean up', async function () {
        await conn.delete({ path: '/bookmarks/test', tree })
        await conn.resetCache()
      })

      it(`1. Should error when neither 'url' nor 'path' are supplied`, async function () {
        await putResource({ something: 'b' }, '/bookmarks/test')

        return expect(
          conn.delete({
            type: 'application/json'
          })
        ).to.be.rejectedWith(Error, 'Either path or url must be specified.')
      })

      it(`2. Shouldn't error when the 'Content-Type' header can be derived from the 'type' key`, async function () {
        await putResource({ something: 'b' }, '/bookmarks/test')
        var response = await conn.delete({
          path: '/bookmarks/test',
          type: 'application/json'
        })
        expect(response.status.toString().charAt(0)).to.equal('2')
      })

      it(`3. Shouldn't error when 'Content-Type' header is specified.`, async function () {
        await putResource({ something: 'b' }, '/bookmarks/test')
        var response = await conn.delete({
          path: '/bookmarks/test',
          headers: { 'content-type': 'application/json' }
        })
        expect(response.status.toString().charAt(0)).to.equal('2')
      })

      it(`6. Should be able to delete only a resource and leave the link alone (GETs should 404)`, async function () {
        this.timeout(5000)
        var result = await putResource({ something: 'b' }, '/bookmarks/test')
        var deleteResponse = await conn.delete({
          path: result.resource.headers['content-location'],
          headers: { 'content-type': 'application/json' }
        })
        return expect(
          conn.get({
            path: '/bookmarks/test'
          })
        ).to.be.rejectedWith(Error, `Request failed with status code 404`)
      })

      it(`7. Should allow us to delete only a link and leave the resource alone`, async function () {
        this.timeout(40000)
        await Promise.delay(3000)
        //				var result = await putResource({'something': 'b'}, '/bookmarks/test')
        var result = await conn.put({
          path: '/bookmarks/test',
          data: { something: 'b' },
          tree
        })
        await Promise.delay(3000)
        var deleteResponse = await conn.delete({
          path: '/bookmarks/test',
          headers: { 'content-type': 'application/json' }
        })
        expect(deleteResponse.status.toString().charAt(0)).to.equal('2')
        var response = await conn.get({
          path: result.headers['content-location']
        })
        expect(response.status.toString().charAt(0)).to.equal('2')
      })

      it(`8. Should handle two deletes in series`, async function () {
        this.timeout(4000)
        var result = await putResource({ something: 'b' }, '/bookmarks/test')
        var deleteOne = await conn.delete({
          path: '/bookmarks/test',
          headers: { 'content-type': 'application/json' }
        })
        expect(deleteOne.status.toString().charAt(0)).to.equal('2')
        var deleteTwo = await conn.delete({
          path: '/bookmarks/test',
          headers: { 'content-type': 'application/json' }
        })
        expect(deleteTwo.status.toString().charAt(0)).to.equal('2')
      })

      it(`9. Should handle concurrent deletes, ultimately deleting the target endpoint as intended`, async function () {
        this.timeout(4000)
        var result = await putResource({ something: 'b' }, '/bookmarks/test')
        var deleteOne = conn.delete({
          path: '/bookmarks/test',
          headers: { 'content-type': 'application/json' }
        })
        var deleteTwo = conn.delete({
          path: '/bookmarks/test',
          headers: { 'content-type': 'application/json' }
        })
        var deleteThree = conn.delete({
          path: '/bookmarks/test',
          headers: { 'content-type': 'application/json' }
        })
        await Promise.join(deleteOne, deleteTwo, deleteThree, async function (
          deleteOne,
          deleteTwo,
          deleteThree
        ) {
          expect(deleteOne.status.toString().charAt(0)).to.equal('2')
          expect(deleteTwo.status.toString().charAt(0)).to.equal('2')
          expect(deleteThree.status.toString().charAt(0)).to.equal('2')
          return expect(
            conn.get({
              path: '/bookmarks/test'
            })
          ).to.be.rejectedWith(Error, 'Request failed with status code 404')
        })
      })

      it(`10. Should produce a 412 if the 'If-Match' precondition fails`, async function () {
        this.timeout(4000)
        var result = await putResource({ foo: 'bar' }, '/bookmarks/test')
        return expect(
          conn.delete({
            path: '/bookmarks/test',
            headers: {
              'If-Match': '2-foobar',
              'content-type': 'application/json'
            }
          })
        ).to.be.rejectedWith(Error, 'Request failed with status code 412')
      })

      it(`11. Should succeed in deleting a link if a valid 'If-Match' header which matches the current resource's _rev is supplied`, async function () {
        var result = await putResource({ something: 'else' }, '/bookmarks/test')
        var response = await conn.delete({
          path: '/bookmarks/test',
          headers: {
            'if-match': result.link.headers['x-oada-rev'],
            'content-type': 'application/json'
          }
        })
        expect(response.status.toString().charAt(0)).to.equal('2')
      })

      it(`12. Should succeed in deleting a resource if a valid 'If-Match' header which matches the current resource's _rev is supplied`, async function () {
        var result = await putResource({ foo: 'bar' }, '/bookmarks/test')
        var response = await conn.delete({
          path: result.resource.headers['content-location'],
          headers: {
            'if-match': result.resource.headers['x-oada-rev'],
            'content-type': 'application/json'
          }
        })
        expect(response.status.toString().charAt(0)).to.equal('2')
      })

      it(`13. Should delete an entire tree of links and resources when the 'tree' option is supplied`, async function () {
        //await conn.resetCache();
        //await conn.delete({path:'/bookmarks/test', tree})
        var test = await putResource({ foo: 'bar' }, '/bookmarks/test')
        var aaa = await putResource({ woo: 'bar' }, '/bookmarks/test/aaa')
        var bbb = await putResource({ boo: 'bar' }, '/bookmarks/test/aaa/bbb')
        var ccc = await putResource(
          { noo: 'bar' },
          '/bookmarks/test/aaa/bbb/index-one/ccc'
        )
        var response = await conn.delete({
          path: '/bookmarks/test',
          tree
        })
        expect(response.status.toString().charAt(0)).to.equal('2')
        return Promise.each(
          [
            test.resource.headers['content-location'],
            aaa.link.headers['content-location'],
            aaa.resource.headers['content-location'],
            bbb.link.headers['content-location'],
            bbb.resource.headers['content-location'],
            ccc.link.headers['content-location'],
            ccc.resource.headers['content-location']
          ],
          path => {
            if (/^\/resources/.test(path)) {
              return expect(conn.get({ path })).to.be.rejectedWith(
                Error,
                'Request failed with status code 403'
              )
            } else {
              return expect(conn.get({ path })).to.be.rejectedWith(
                Error,
                'Request failedf with status code 404'
              )
            }
          }
        ).catch(error => {
          console.log(error)
        })
      })

      it(`14. Should gracefully handle a sequence of PUT, DELETE, PUT executed in series`, async function () {
        this.timeout(4000)
        var putOne = await conn.put({
          path: '/bookmarks/test/aaa',
          tree,
          data: { putOne: 'putOne' }
        })
        expect(putOne.status.toString().charAt(0)).to.equal('2')

        var putTwo = await conn.put({
          path: '/bookmarks/test/aaa/bbb',
          tree,
          data: { putTwo: 'putTwo' }
        })
        expect(putTwo.status.toString().charAt(0)).to.equal('2')

        var deleteOne = await conn.delete({
          path: '/bookmarks/test',
          tree
        })
        expect(deleteOne.status.toString().charAt(0)).to.equal('2')

        var putThree = await conn.put({
          path: '/bookmarks/test/aaa/bbb/index-one/ccc',
          tree,
          data: { putThree: 'putThree' }
        })
        expect(putThree.status.toString().charAt(0)).to.equal('2')

        var getOne = await conn.get({
          path: '/bookmarks/test',
          tree
        })
        expect(getOne.status.toString().charAt(0)).to.equal('2')
        expect(getOne.data.aaa).to.not.include.key('putOne')
        expect(getOne.data.aaa.bbb).to.not.include.key('putTwo')
        expect(getOne.data.aaa.bbb['index-one'].ccc).to.include.key('putThree')
      })

      it(`15. Should gracefully handle a concurrent sequence of PUT, DELETE, PUT`, async function () {
        this.timeout(17000)
        try {
          var getOne = await conn.get({
            path: '/bookmarks/test/aaa'
          })
        } catch (err) {
          expect(err.response.status).to.equal(404)
        }

        var putOne = conn.put({
          path: '/bookmarks/test/aaa',
          tree,
          data: { putOne: 'putOne' }
        })
        var putTwo = conn.put({
          path: '/bookmarks/test/aaa/bbb',
          tree,
          data: { putTwo: 'putTwo' }
        })
        var deleteOne = conn.delete({
          path: '/bookmarks/test/aaa/bbb/index-one/ccc',
          tree
        })
        var putThree = conn.put({
          path: '/bookmarks/test/aaa/bbb/index-one/ccc',
          tree,
          data: { putThree: 'putThree' }
        })
        var result = await Promise.join(
          putOne,
          putTwo,
          deleteOne,
          putThree,
          //async function(putOne,putTwo,deleteOne,putThree) {
          async function (putOne, putTwo, deleteOne, putThree) {
            expect(putOne.status.toString().charAt(0)).to.equal('2')
            expect(putTwo.status.toString().charAt(0)).to.equal('2')
            expect(deleteOne.status.toString().charAt(0)).to.equal('2')
            expect(putThree.status.toString().charAt(0)).to.equal('2')
          }
        )
      })
    })
  }
})

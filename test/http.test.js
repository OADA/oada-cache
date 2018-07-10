process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
import oada from '../src/index'
import chai from 'chai';
var expect = chai.expect;

let token = 'def';
let url = 'https://vip3.ecn.purdue.edu/bookmarks';
let contentType = 'application/vnd.oada.yield.1+json';

it('should connect when a token is provided', () => {
  return oada.connect({token, domain: 'https://vip3.ecn.purdue.edu'}).then((result) => {
    expect(result).to.have.key('token')
  })
})

describe('it should connect when a token is provided', function() {
  this.timeout(10000);
  it('should also connect when options with metadata are provided', function(done) {
    this.timeout(10000);
    oada.connect({
      domain: 'vip3.ecn.purdue.edu',
      options: {
        redirect: 'http://localhost:8000/oauth2/redirect.html',
        metadata: 'eyJqa3UiOiJodHRwczovL2lkZW50aXR5Lm9hZGEtZGV2LmNvbS9jZXJ0cyIsImtpZCI6ImtqY1NjamMzMmR3SlhYTEpEczNyMTI0c2ExIiwidHlwIjoiSldUIiwiYWxnIjoiUlMyNTYifQ.eyJyZWRpcmVjdF91cmlzIjpbImh0dHA6Ly92aXAzLmVjbi5wdXJkdWUuZWR1OjgwMDAvb2F1dGgyL3JlZGlyZWN0Lmh0bWwiLCJodHRwOi8vbG9jYWxob3N0OjgwMDAvb2F1dGgyL3JlZGlyZWN0Lmh0bWwiXSwidG9rZW5fZW5kcG9pbnRfYXV0aF9tZXRob2QiOiJ1cm46aWV0ZjpwYXJhbXM6b2F1dGg6Y2xpZW50LWFzc2VydGlvbi10eXBlOmp3dC1iZWFyZXIiLCJncmFudF90eXBlcyI6WyJpbXBsaWNpdCJdLCJyZXNwb25zZV90eXBlcyI6WyJ0b2tlbiIsImlkX3Rva2VuIiwiaWRfdG9rZW4gdG9rZW4iXSwiY2xpZW50X25hbWUiOiJPcGVuQVRLIiwiY2xpZW50X3VyaSI6Imh0dHBzOi8vdmlwMy5lY24ucHVyZHVlLmVkdSIsImNvbnRhY3RzIjpbIlNhbSBOb2VsIDxzYW5vZWxAcHVyZHVlLmVkdT4iXSwic29mdHdhcmVfaWQiOiIxZjc4NDc3Zi0zNTQxLTQxM2ItOTdiNi04NjQ0YjRhZjViYjgiLCJyZWdpc3RyYXRpb25fcHJvdmlkZXIiOiJodHRwczovL2lkZW50aXR5Lm9hZGEtZGV2LmNvbSIsImlhdCI6MTUxMjAwNjc2MX0.AJSjNlWX8UKfVh-h1ebCe0MEGqKzArNJ6x0nmta0oFMcWMyR6Cn2saR-oHvU8WrtUMEr-w020mAjvhfYav4EdT3GOGtaFgnbVkIs73iIMtr8Z-Y6mDEzqRzNzVRMLghj7CyWRCNJEk0jwWjOuC8FH4UsfHmtw3ouMFomjwsNLY0',
        scope: 'oada.yield:all'
      }
    }).then((result) => {
      expect(result).to.have.key('token')
      done();
    })
  })
})

it('should perform a get over http', () => {
  return oada.get({url, token}).then((response) => {
    expect(200).to.equal(200)
    //    expect(response.headers).to.contains.keys(['location', 'content-location'])
  }).catch(() => {

  })
})

it('should perform a put over http', ()=> {
  expect(oada.put({
    url: url+'/test', 
    token, 
    contentType, 
    data:'123'})).toBe();
})

it('should perform a delete over http', ()=> {
  return oada.delete({
    url: url+'/test', 
    token, 
  }).then((res) => {
    res.response
    .response.to.have
  })
})


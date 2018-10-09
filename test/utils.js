const oada = require('../build/index.js').default;
const axios = require('axios');

async function getConnections({domain, options, token}) {
  var yy = await oada.connect({
    domain,
    options,
    token
  })

  var yn = await oada.connect({
    domain,
    options,
    token,
    websocket: false,
  })
  var ny = await oada.connect({
    domain,
    options,
    token,
    cache: false,
  })

  var nn = await oada.connect({
    domain,
    options,
    token,
    websocket: false,
    cache: false,
  })
  return [nn, yn, ny, yy]
}

async function cleanUp(resources, domain, token) {
  // Delete resources
  resources.forEach(async function(res) {
    await axios({
      method: 'delete',
      url: domain+res,
      headers: {
        Authorization: 'Bearer '+token,
      }
    })
  })
  // Delete link
  await axios({
    method: 'delete',
    url: domain+'/bookmarks/test',
    headers: {
      Authorization: 'Bearer '+token,
    }
  })
}

module.exports = {
  getConnections, cleanUp,
}

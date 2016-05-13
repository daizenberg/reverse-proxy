import Http from 'http'
import Url from 'url'

var server = new Http.Server();

server.listen(1980, '127.0.0.1');

server.on('request', (req, res) => {
  var url = parseUrl(req.url)
  if(!url) {
    console.error(`Error parsing source URL: ${req.url}`)
    res.end('Error: could not parse request URL')
    return
  }

  console.log(`Connecting to ${url.hostname}${url.path}`)
  fetchUrl(url,
    (remoteRes, body) => finishResponseSuccess(res, remoteRes, body),
    (error) => finishResponseError(res, error))
})

function parseUrl(sourceUrl) {
  var url = Url.parse(sourceUrl)
  var matches = /host=((w|.)+)/.exec(url.query)
  if(!matches || matches.length < 1)
    return null
  return {
    hostname: matches[1],
    path: url.pathname
  }
}

function fetchUrl(url, onSuccess, onError) {
  Http.get(url, (response) => {
      var body = ''
      response.on('data', (d) => body += d )
      response.on('end', () => onSuccess(response, body))
    }).on('error', (e) => onError(e))
}

function finishResponseError(localRes, error) {
  console.error(`Request error: ${e.message}`)
  localRes.end(`Remote host returned error: ${e.message}`)
}

function finishResponseSuccess(localRes, remoteRes, body) {
  // TODO: parse body, replace grammar
  // TODO: consider different return codes
  console.log(`Successfully recieved response, status code ${remoteRes.statusCode}`)
  localRes.end(body)
}

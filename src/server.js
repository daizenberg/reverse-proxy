import Http from 'http'
import Url from 'url'
import Parse from 'parse5'

var server = new Http.Server()
server.listen(1980, '127.0.0.1')

server.on('request', (req, res) => {
  var url = parseUrl(req.url)
  if (!url) {
    console.error(`Error parsing source URL: ${req.url}`)
    res.end('Error: could not parse request URL')
    return
  }

  console.log(`Connecting to ${url.hostname}${url.path}`)
  fetchUrl(url,
    res,
    (error) => finishResponseError(res, error))
})

function fetchUrl (url, localRes, onError) {
  Http.get(url, (response) => {
    var isParsable = parseHeaders(localRes, response)
    if (isParsable) {
      let parser = new Parse.SAXParser()
      let piggy = (text) => text.replace(/(\w)(\w*)/g, '$2$1ay')
      let direct = (text) => text
      let textConverter = piggy
      parser.on('text', (t) => {
        localRes.write(textConverter(t))
      })
      parser.on('startTag', (name, attrs, selfClosing) => {
        if (selfClosing || name === 'script' || name === 'style') {
          textConverter = direct
        } else {
          textConverter = piggy
        }
        localRes.write(`<${name}`)
        attrs.forEach(a => {
          if (a.name === 'href') {
            a.value = convertUrl(a.value)
          }
          localRes.write(` ${a.name}="${a.value}"`)
        })
        if (selfClosing) {
          localRes.write('/')
        }
        localRes.write('>')
      })
      parser.on('endTag', (name) => {
        localRes.write(`</${name}>`)
        textConverter = piggy
      })
      parser.on('doctype', (name, publicId, systemId) => {
        localRes.write(`<!DOCTYPE ${name}>`)
      })
      parser.on('end', () => localRes.end())
      response.pipe(parser)
    } else {
      response.pipe(localRes)
    }
  }).on('error', (e) => onError(e))
}

function finishResponseError (localRes, error) {
  console.error(`Request error: ${error.message}`)
  localRes.end(`Remote host returned error: ${error.message}`)
}

function parseHeaders (localRes, remoteRes) {
  let isParsable = true
  console.log(`Successfully recieved response, status code ${remoteRes.statusCode}`)
  localRes.statusCode = remoteRes.statusCode
  for (let header in remoteRes.headers) {
    let headerValue = remoteRes.headers[header]
    header = header.toLowerCase()
    if (header === 'location') {
      headerValue = convertUrl(headerValue)
    }
    if (header === 'content-type' && headerValue.indexOf('html') < 0) {
      isParsable = false
    }
    localRes.setHeader(header, headerValue)
  }
  return isParsable
}

function parseUrl (sourceUrl) {
  var url = Url.parse(sourceUrl)
  var matches = /host=((w|.|-|_)+)/.exec(url.query)
  if (!matches || matches.length < 1) {
    return null
  }
  return {
    hostname: matches[1],
    path: url.pathname
  }
}

function convertUrl (sourceUrl) {
  var url = Url.parse(sourceUrl)
  var x = `http://localhost:1980${url.pathname}?host=${url.hostname}`
  console.log(`converted url ${sourceUrl} to ${x}`)
  return x
}

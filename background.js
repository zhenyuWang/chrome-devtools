// the background script runs all the time and serves as a central message
// hub for each vue devtools (panel + proxy + backend) instance.

const ports = {}

chrome.runtime.onConnect.addListener(port => {
  let tab
  let name
  if (isNumeric(port.name)) {
    tab = port.name
    name = 'devtools'
    installProxy(+port.name)
  } else {
    tab = port.sender.tab.id
    name = 'backend'
  }

  if (!ports[tab]) {
    ports[tab] = {
      devtools: null,
      backend: null,
    }
  }
  ports[tab][name] = port

  if (ports[tab].devtools && ports[tab].backend) {
    doublePipe(tab, ports[tab].devtools, ports[tab].backend)
  }
})

function isNumeric (str) {
  return +str + '' === str
}

function installProxy (tabId) {
  chrome.tabs.executeScript(tabId, {
    file: 'proxy.js',
  }, function (res) {
    if (!res) {
      ports[tabId].devtools.postMessage('proxy-fail')
    } else {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('injected proxy to tab ' + tabId)
      }
    }
  })
}

function doublePipe (id, one, two) {
  one.onMessage.addListener(lOne)
  function lOne (message) {
    if (message.event === 'log') {
      // eslint-disable-next-line no-console
      return console.log('tab ' + id, message.payload)
    }
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('%cdevtools -> backend', 'color:#888;', message)
    }
    two.postMessage(message)
  }
  two.onMessage.addListener(lTwo)
  function lTwo (message) {
    if (message.event === 'log') {
      // eslint-disable-next-line no-console
      return console.log('tab ' + id, message.payload)
    }
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('%cbackend -> devtools', 'color:#888;', message)
    }
    one.postMessage(message)
  }
  function shutdown () {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('tab ' + id + ' disconnected.')
    }
    one.onMessage.removeListener(lOne)
    two.onMessage.removeListener(lTwo)
    one.disconnect()
    two.disconnect()
    ports[id] = null
  }
  one.onDisconnect.addListener(shutdown)
  two.onDisconnect.addListener(shutdown)
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('tab ' + id + ' connected.')
  }
}

chrome.runtime.onMessage.addListener((req, sender) => {
  if (sender.tab && req.vueDetected) {
    const suffix = req.nuxtDetected ? '.nuxt' : ''

    chrome.browserAction.setIcon({
      tabId: sender.tab.id,
      path: {
        16: `img/icon.png`,
        48: `img/icon.png`,
        128: `img/icon.png`,
      },
    })
    chrome.browserAction.setPopup({
      tabId: sender.tab.id,
      popup: req.devtoolsEnabled ? `popup.html` : `popup.html`,
    })
  }

  if (req.action === 'vue-take-screenshot' && sender.envType === 'devtools_child') {
    browser.tabs.captureVisibleTab({
      format: 'png',
    }).then(dataUrl => {
      browser.runtime.sendMessage({
        action: 'vue-screenshot-result',
        id: req.id,
        dataUrl,
      })
    })
  }
})
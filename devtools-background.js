// 多次尝试是因为刚打开控制台可能有些东西并未就绪（暂不清楚），导致并不能创建devtools panel，此时刷新页面就会出现
// 所以采用每隔一秒的尝试（最多十次），处理该问题

let created = false
let checkCount = 0

chrome.devtools.network.onNavigated.addListener(createPanel)

const checkInterval = setInterval(createPanel, 1000)
createPanel()

function createPanel () {
  if (created || checkCount++ > 10) {
    clearInterval(checkInterval)
    return
  }
  chrome.devtools.inspectedWindow.eval(
    '!!window',
    function () {
      if (created) {
        return
      }
      clearInterval(checkInterval)
      created = true
      chrome.devtools.panels.create(
        'My Chrome Devtools', 'img/icon.png', 'devtools.html',
        panel => {
          // panel loaded
          panel.onShown.addListener(onPanelShown)
          panel.onHidden.addListener(onPanelHidden)
        },
      )
    },
  )
}

// Manage panel visibility

function onPanelShown () {
  chrome.runtime.sendMessage('vue-panel-shown')
}

function onPanelHidden () {
  chrome.runtime.sendMessage('vue-panel-hidden')
}
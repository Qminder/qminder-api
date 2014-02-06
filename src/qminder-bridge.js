function QminderBridge() {

  "use strict";
  
  var onLoadCallback = null;

  var receiveMessage = function(event) {
    if (event.data.secretKey) {
      if (onLoadCallback) {
        onLoadCallback(event.data.secretKey);
      }
    }
  };

  window.addEventListener("message", receiveMessage, false);
  
  this.onLoad = function(callback) {
    onLoadCallback = callback;
  };
  
  this.playAlertSound = function() {
    parent.postMessage({"command": "playAlertSound"}, "*");
  };
}

var QminderBridge = new QminderBridge();

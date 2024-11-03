var activeTypers = {};
const TYPING_INDICATOR_TIMEOUT_IN_MSECS = 5000;

function sendTypingIndicator() {
  pubnub.signal({
    message: { id: pubnub.getUserId(), t: 't' },
    channel: publicChannel,
  });
}

function signalReceived(signalObj) {
  if (signalObj.message.t === 't' && signalObj.channel === publicChannel) {
    const typerId = signalObj.message.id;
    activeTypers[typerId] = signalObj.timetoken;
    evaluateCurrentTypers();
  }
}

function evaluateCurrentTypers() {
  const timeAgoTimestamp = (Date.now() - TYPING_INDICATOR_TIMEOUT_IN_MSECS) * 10000;
  Object.keys(activeTypers).forEach((key) => {
    if (activeTypers[key] < timeAgoTimestamp) {
      delete activeTypers[key];
    }
  });

  const typersCount = Object.keys(activeTypers).length;
  const typingIndicator = document.getElementById('typingIndicator');
  if (typersCount === 0) {
    typingIndicator.style.display = 'none';
  } else {
    typingIndicator.style.display = 'block';
    const typerName = typersCount === 1 ? userData[Object.keys(activeTypers)[0]].name : "Multiple people";
    document.getElementById('typingIndicatorName').innerText = `${typerName} are typing...`;
  }
}
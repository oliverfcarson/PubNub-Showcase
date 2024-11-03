var activeTypers = {};
const TYPING_INDICATOR_TIMEOUT_IN_MSECS = 5000;
const PLACEHOLDER_AVATAR = "../img/avatar/placeholder.png"; // Path to the placeholder image

// Send typing indicator signal
function sendTypingIndicator() {
  pubnub.signal({
    message: { id: pubnub.getUserId(), t: 't' },
    channel: publicChannel,
  });
}

// Handle received typing signals
function signalReceived(signalObj) {
  if (signalObj.message.t === 't' && signalObj.channel === publicChannel) {
    const typerId = signalObj.message.id;
    activeTypers[typerId] = signalObj.timetoken; // Store timetoken for each typer
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
  const typingIndicator = document.getElementById("typingIndicator");

  if (typersCount === 0) {
    typingIndicator.style.display = "none";
  } else {
    typingIndicator.style.display = "block";

    if (typersCount === 1) {
      // Display single user typing
      const typerId = Object.keys(activeTypers)[0];
      const typerData = channelMembers[typerId] || { profileUrl: PLACEHOLDER_AVATAR, name: typerId };
      document.getElementById("typingIndicatorName").innerText = `${typerData.name} is typing...`;
      document.getElementById("typingIndicatorAvatar").src = typerData.profileUrl || PLACEHOLDER_AVATAR;
    } else {
      // Display generic message for multiple users typing
      document.getElementById("typingIndicatorName").innerText = "Multiple people are typing...";
      document.getElementById("typingIndicatorAvatar").src = PLACEHOLDER_AVATAR;
    }
  }
}

// Check for active typers every second to see if we need to hide the indicator
setInterval(evaluateCurrentTypers, 1000);

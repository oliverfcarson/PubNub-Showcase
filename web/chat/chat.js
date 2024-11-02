// Configure PubNub with your keys and a unique user ID
const pubnub = new PubNub({
  subscribeKey: "sub-c-41316b37-f479-46f9-9cc2-4092d45f1b1b",
  publishKey: "pub-c-16ce1f19-1ef6-422a-9a9b-96cfff20cb69",
  uuid: "User-" + Math.random().toString(36).substring(7),
});

// Define the single public chat channel
const publicChannel = "Public.global_chat";

// Load the chat on page load
window.onload = function () {
  initializeChat();
};

// Set up the chat environment
function initializeChat() {
  subscribeToChannel();
  setupMessageInput();
  loadChatHistory();
}

// Subscribe to the public chat channel and set up listeners for various events
function subscribeToChannel() {
  pubnub.subscribe({
    channels: [publicChannel],
    withPresence: true,
  });

  pubnub.addListener({
    message: (event) => displayMessage(event),
    presence: (event) => handlePresence(event),
    signal: (signalEvent) => handleSignal(signalEvent),
    messageAction: (messageActionEvent) => handleMessageAction(messageActionEvent),
  });
}

// Load recent chat history for the channel
async function loadChatHistory() {
  try {
    const history = await pubnub.fetchMessages({
      channels: [publicChannel],
      count: 20,
    });

    const messages = history.channels[publicChannel];
    if (messages) {
      messages.forEach((msg) => displayMessage(msg, true));
    }
  } catch (error) {
    console.error("Error loading chat history:", error);
  }
}

// Set up the message input to send messages and handle typing indicator
function setupMessageInput() {
  const messageInput = document.getElementById("input-message");

  // Send message on "Enter" key press
  messageInput.addEventListener("keypress", function (event) {
    sendTypingIndicator();
    if (event.key === "Enter") {
      sendMessage();
    }
  });
}

// Send a message to the channel
async function sendMessage() {
  const messageInput = document.getElementById("input-message");
  const messageText = messageInput.value.trim();

  if (messageText) {
    try {
      const result = await pubnub.publish({
        channel: publicChannel,
        message: {
          text: messageText,
          userId: pubnub.getUUID(),
          timestamp: Date.now(),
        },
      });
      messageInput.value = ""; // Clear the input after sending
      sendReadReceipt(result.timetoken); // Send read receipt immediately for the message
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }
}

// Send a typing indicator signal
function sendTypingIndicator() {
  pubnub.signal({
    channel: publicChannel,
    message: { type: "typing", userId: pubnub.getUUID() },
  });
}

// Handle the receipt of a new message and display it with original styling
function displayMessage(event, isHistory = false) {
  const message = event.message;
  const messageList = document.getElementById("messageListContents");

  // Create message element with original styling
  const messageElement = document.createElement("div");
  messageElement.classList.add("message");

  // Format the timestamp
  const timestamp = new Date(message.timestamp).toLocaleTimeString();

  messageElement.innerHTML = `
    <strong>${message.userId}</strong> <small>${timestamp}</small><br>
    <span>${message.text}</span>
    <div class="message-actions" id="actions-${event.timetoken}">
      <button onclick="addEmojiReaction('${event.timetoken}', '😊')">😊</button>
      <button onclick="addEmojiReaction('${event.timetoken}', '👍')">👍</button>
      <button onclick="addEmojiReaction('${event.timetoken}', '❤️')">❤️</button>
      <span class="read-status" id="read-${event.timetoken}">Unread</span>
    </div>
  `;

  // Append the message to the chat display
  messageList.appendChild(messageElement);

  // Scroll to the bottom for new messages
  if (!isHistory) {
    messageList.scrollTop = messageList.scrollHeight;
  }
}

// Handle presence events
function handlePresence(event) {
  if (event.action === "join") {
    console.log(`${event.uuid} joined the chat.`);
  } else if (event.action === "leave" || event.action === "timeout") {
    console.log(`${event.uuid} left the chat.`);
  }
}

// Handle typing indicators using signals
function handleSignal(signalEvent) {
  const signal = signalEvent.message;
  if (signal.type === "typing" && signal.userId !== pubnub.getUUID()) {
    console.log(`${signal.userId} is typing...`);
    // Optional: add logic here to show a typing indicator in the UI
  }
}

// Handle message actions for read receipts and reactions
function handleMessageAction(messageActionEvent) {
  const action = messageActionEvent.data;
  const actionElement = document.getElementById(`actions-${action.messageTimetoken}`);

  if (action.type === "read") {
    const readStatus = document.getElementById(`read-${action.messageTimetoken}`);
    readStatus.textContent = "Read";
  } else if (action.type === "emoji") {
    const emoji = document.createElement("span");
    emoji.textContent = action.value;
    actionElement.appendChild(emoji); // Display the emoji reaction next to the message
  }
}

// Send a read receipt for a specific message
function sendReadReceipt(timetoken) {
  pubnub.addMessageAction({
    channel: publicChannel,
    messageTimetoken: timetoken,
    action: { type: "read", value: "read" },
  });
}

// Add an emoji reaction to a message
function addEmojiReaction(timetoken, emoji) {
  pubnub.addMessageAction({
    channel: publicChannel,
    messageTimetoken: timetoken,
    action: { type: "emoji", value: emoji },
  });
}

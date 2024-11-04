// Define a single public channel for chat
var publicChannel = "Public.global_chat";

// Initialize PubNub and variables
var pubnub = null;
var userId = null;
var channelMembers = {};
var userData = {};
var me = null;
const MAX_MESSAGES_SHOWN_PER_CHAT = 50;
var inflightReadReceipt = {};
var activeTypers = {};

// Initialize PubNub and set up the channel
async function loadChat() {
  userId = generateRandomUserId();
  pubnub = await createPubNubObject();
  me = await setupUser(pubnub.getUserId());

  // Subscribe to the public channel and set up event listeners
  pubnub.subscribe({
    channels: [publicChannel],
    withPresence: true,
  });

  setupEventListeners();
  await populateChatWindow();
}

// Generate a random user ID, e.g., "pubnub#12345"
function generateRandomUserId() {
  const randomNumber = Math.floor(10000 + Math.random() * 90000); // 5-digit random number
  return `pubnub#${randomNumber}`;
}

// Function to randomly select an avatar from "../img/avatar/001.png" to "../img/avatar/020.png"
function getRandomAvatar() {
  const avatarNumber = String(Math.floor(1 + Math.random() * 20)).padStart(3, '0'); // Generate a random number between 001 and 020
  return `../img/avatar/${avatarNumber}.png`;
}

// Create PubNub object with keys
async function createPubNubObject() {
  return new PubNub({
    subscribeKey: "",
    publishKey: "",
    userId: userId,
  });
}

// Setup the "me" user data without calling getUserMetadata
async function setupUser(uuid) {
  var profileAvatar = getRandomAvatar();
  try {
    await pubnub.objects.setUUIDMetadata({
      uuid: uuid,
      data: {
        name: uuid,
        profileUrl: profileAvatar,
      },
    });
  } catch (status) {
    console.log("operation failed w/ error:", status);
  }

  return {
    name: uuid, // Setting name to match the user ID
    profileUrl: profileAvatar, // Randomly selected avatar image
  };
}

// Set up PubNub event listeners
function setupEventListeners() {
  pubnub.addListener({
    message: (messageEvent) => messageReceived(messageEvent, false),
    presence: (presenceEvent) => handlePresenceEvent(presenceEvent),
    signal: (signalEvent) => signalReceived(signalEvent),
    messageAction: (messageActionEvent) => handleMessageAction(messageActionEvent),
  });

  document.getElementById("input-message").addEventListener("keypress", (event) => {
    sendTypingIndicator();
    if (event.key === "Enter") {
      messageInputSend();
    }
  });
}

// Populate the chat window with message history, including message actions
async function populateChatWindow() {
  const messageListDiv = document.getElementById("messageListContents");
  messageListDiv.innerHTML = ""; // Clear existing messages

  try {
    const history = await pubnub.fetchMessages({
      channels: [publicChannel],
      count: 25, // Fetch 25 messages with actions due to API limit
      includeUUID: true,
      includeMessageActions: true, // Include message actions in the response
    });

    // Loop through each message in the fetched history
    for (const msg of history.channels[publicChannel]) {
      msg.publisher = msg.uuid; // Ensure publisher ID is set

      // Display the message
      await messageReceived(msg, true);

      // Check if the message has associated actions (reactions)
      if (msg.actions && msg.actions.react) {
        // Loop through each reaction type and count
        for (const reaction in msg.actions.react) {
          const count = msg.actions.react[reaction].length;

          // Update the UI to show the reaction with the count
          maEmojiReaction({
            event: 'added',
            data: {
              messageTimetoken: msg.timetoken,
              type: 'react',
              value: reaction, // Use the emoji or reaction type
            },
            count: count, // Pass the count to display properly
          });
        }
      }
    }
  } catch (error) {
    console.log("Error fetching message history or actions:", error);
  }
}

// Handle sending a message
async function messageInputSend() {
  const messageInput = document.getElementById("input-message");
  const messageText = messageInput.value;
  if (!messageText.trim()) return;

  try {
    await pubnub.publish({
      channel: publicChannel,
      message: { content: { type: "text", text: messageText } },
      storeInHistory: true,
    });
    messageInput.value = ""; // Clear input
  } catch (error) {
    console.log("Error sending message:", error);
  }
}

// Handle incoming message actions (reactions, read receipts)
function handleMessageAction(messageActionEvent) {
  if (messageActionEvent.data.type === "read") {
    maReadReceipt(messageActionEvent);
  } else if (messageActionEvent.data.type === "react") {
    maEmojiReaction(messageActionEvent);
  }
}

function handlePresenceEvent(presenceEvent) {
  const { action, uuid } = presenceEvent;
  if (action === "join") {
    addUserToCurrentChannel(uuid);
  } else if (action === "leave" || action === "timeout") {
    removeUserFromCurrentChannel(uuid);
  }
}

// Add a user to the current channel and populate channelMembers
async function addUserToCurrentChannel(userId) {
  if (!channelMembers[userId]) {
    const userInfo = await getUserMetadataForId(userId); // Fetch metadata from PubNub
    channelMembers[userId] = {
      name: userInfo.name || userId,
      profileUrl: userInfo.profileUrl || PLACEHOLDER_AVATAR,
    };
    updateInfoPane();
  }
}

// Get metadata for a specific user by their UUID
async function getUserMetadataForId(userId) {
  try {
    const result = await pubnub.objects.getUUIDMetadata({ uuid: userId });
    return result.data;
  } catch {
    return { name: "Unknown", profileUrl: "../img/avatar/placeholder.png" };
  }
}

// Remove a user from the current channel
function removeUserFromCurrentChannel(userId) {
  delete channelMembers[userId];
  updateInfoPane();
}

// Update the info pane with the list of users in the current channel
function updateInfoPane() {
  const memberListDiv = document.getElementById("memberList");
  memberListDiv.innerHTML = "";

  // Add the current user at the top of the list
  const currentUserItem = document.createElement("div");
  currentUserItem.className = "user-with-presence";
  currentUserItem.innerHTML = `
    <div class="presence-avatar-container">
      <img src="${me.profileUrl}" class="chat-list-avatar">
      <span class="presence-dot-online"></span>
    </div>
    <span class="chat-list-name">${me.name} (You)</span>
  `;
  memberListDiv.appendChild(currentUserItem);

  // Add other users below the current user
  for (const userId in channelMembers) {
    // Skip the current user since it's already added
    if (userId === pubnub.getUserId()) continue;

    const member = channelMembers[userId];
    const memberItem = document.createElement("div");
    memberItem.className = "user-with-presence";
    memberItem.innerHTML = `
      <div class="presence-avatar-container">
        <img src="${member.profileUrl}" class="chat-list-avatar">
        <span class="presence-dot-online"></span>
      </div>
      <span class="chat-list-name">${member.name}</span>
    `;
    memberListDiv.appendChild(memberItem);
  }
}

// Send typing indicator
function sendTypingIndicator() {
  pubnub.signal({
    channel: publicChannel,
    message: { id: pubnub.getUserId(), t: "t" },
  });
}

// Convert PubNub timetoken to a readable date format
function convertTimetokenToDate(timetoken) {
  const date = new Date(timetoken / 10000);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Set the last read timestamp for the public channel
function setLastReadTimestamp(timetoken) {
  pubnub.objects.setMemberships({
    channels: [{ id: publicChannel, custom: { lastReadTimetoken: timetoken } }],
    uuid: pubnub.getUserId(),
  });
}

// Send a read receipt for a received message
async function sendReadReceipt(timetoken) {
  await pubnub.addMessageAction({
    channel: publicChannel,
    messageTimetoken: timetoken,
    action: { type: "read", value: pubnub.getUserId() },
  });
}

// Load the chat when the page loads
window.onload = function() {
  loadChat();
};

/**
 * This file contains logic for receiving messages and converting them into a user-readable form.
 * For notes about transitioning between this demo and a production app, see chat.js.
 */

const MESSAGE_DELETED_TEXT = "<span class='msg-deleted'>[Message has been Deleted by Moderator]</span>";
const EDITED_TEXT_ADDENDUM = "<span class='msg-edited'>(Edited by Moderator)</span>";

// Wrapper function to cater for whether the message had an associated image
function messageContents(messageData) {
  // Check if `messageData.message.content` and `attachments` exist before accessing them
  if (
    messageData.message &&
    messageData.message.content &&
    messageData.message.content.attachments &&
    messageData.message.content.attachments[0] &&
    messageData.message.content.attachments[0].image &&
    messageData.message.content.attachments[0].image.source
  ) {
    // There was an image attachment with the message
    var imageRender = `<img src="${messageData.message.content.attachments[0].image.source}" height="200"><br>`;
    return imageRender + escapeHTML(messageData.message.content.text);
  } else {
    // No attachment, return just the text
    return escapeHTML(messageData.message.content ? messageData.message.content.text : "");
  }
}


// Escape HTML to prevent XSS attacks
function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Updated messageReceived function in message.js

async function messageReceived(messageObj, isFromHistory) {
  try {
    if (messageObj.channel !== publicChannel) {
      incrementChannelUnreadCounter(messageObj.channel);
      return;
    }
    if (!messageObj.message.content) {
      return;
    }

    // Set up sender's data if not in channelMembers
    if (!channelMembers[messageObj.publisher]) {
      channelMembers[messageObj.publisher] = {
        name: messageObj.publisher,
        profileUrl: getRandomAvatar()
      };
    }

    let messageDiv;
    if (messageObj.publisher === pubnub.getUUID()) {
      const messageIsRead = inflightReadReceipt[messageObj.timetoken] || false;
      messageDiv = createMessageSent(messageObj, messageIsRead);
    } else {
      messageDiv = createMessageReceived(messageObj);

      if (!messageObj.actions?.read) {
        pubnub.addMessageAction({
          channel: publicChannel,
          messageTimetoken: messageObj.timetoken,
          action: {
            type: 'read',
            value: pubnub.getUUID()
          }
        });
      }
    }

    const messageListDiv = document.getElementById('messageListContents');
    if (messageListDiv.children.length >= MAX_MESSAGES_SHOWN_PER_CHAT) {
      messageListDiv.removeChild(messageListDiv.children[0]);
    }

    messageListDiv.appendChild(messageDiv);

    // Wait for the emoji reactions element to be in the DOM, then add the event listener
    setTimeout(() => {
      const emojiReactionsElement = document.getElementById('emoji-reactions-' + messageObj.timetoken);
      if (emojiReactionsElement) {
        emojiReactionsElement.addEventListener('click', () => {
          maAddEmojiReaction(messageObj.timetoken);
        });
      } else {
        console.warn(`Element 'emoji-reactions-${messageObj.timetoken}' not found.`);
      }
    }, 50); // Adjust timeout as necessary to ensure DOM availability
  } catch (e) {
    console.log('Exception during message reception: ', e);
  }
}

// Helper functions to create messages with proper structure

function createMessageSent(messageObj, messageIsRead) {
  const readSrc = messageIsRead ? '../img/icons/read.png' : '../img/icons/sent.png';
  const profileUrl = channelMembers[messageObj.publisher]?.profileUrl || '../img/avatar/placeholder.png';
  const name = channelMembers[messageObj.publisher]?.name || "Unknown";

  const newMsg = document.createElement('div');
  newMsg.id = messageObj.timetoken;
  newMsg.className = 'text-body-2 temp-message-container temp-message-container-me';
  newMsg.innerHTML = `
    <div class="temp-message-avatar">
      <img src="${profileUrl}" class="chat-list-avatar temp-message-avatar-img">
    </div>
    <div class="temp-message temp-mesage-me">
      <div class="temp-message-meta-container temp-message-meta-container-me">
        <div class="text-caption temp-message-meta-name">${name}</div>
        <div class="text-caption temp-message-meta-time">${convertTimetokenToDate(messageObj.timetoken)}</div>
      </div>
      <div class="temp-message-bubble temp-message-bubble-me" id="msg-text-${messageObj.timetoken}">
        ${messageContents(messageObj)}
        <div class="temp-read-indicator">
          <img id="message-check-${messageObj.timetoken}" src="${readSrc}" height="10px">
        </div>
        <div id="emoji-reactions-${messageObj.timetoken}" class="temp-message-reaction-display">
          <img src="../img/icons/smile.png" height="18">
          <span id="emoji-reactions-${messageObj.timetoken}-count" class="text-caption temp-message-reaction-number">0</span>
        </div>
      </div>
    </div>`;

  return newMsg;
}

function createMessageReceived(messageObj) {
  const profileUrl = channelMembers[messageObj.publisher]?.profileUrl || '../img/avatar/placeholder.png';
  const name = channelMembers[messageObj.publisher]?.name || "Unknown";

  const newMsg = document.createElement('div');
  newMsg.id = messageObj.timetoken;
  newMsg.className = 'text-body-2 temp-message-container temp-message-container-you';
  newMsg.innerHTML = `
    <div class="temp-message-avatar">
      <img src="${profileUrl}" class="chat-list-avatar temp-message-avatar-img">
    </div>
    <div class="temp-message temp-mesage-you">
      <div class="temp-message-meta-container temp-message-meta-container-you">
        <div class="text-caption temp-message-meta-name">${name}</div>
        <div class="text-caption temp-message-meta-time">${convertTimetokenToDate(messageObj.timetoken)}</div>
      </div>
      <div class="temp-message-bubble temp-message-bubble-you" id="msg-text-${messageObj.timetoken}">
        ${messageContents(messageObj)}
        <div class="temp-read-indicator">
          <img id="message-check-${messageObj.timetoken}" src="../img/icons/read.png" height="10px">
        </div>
        <div id="emoji-reactions-${messageObj.timetoken}" class="temp-message-reaction-display">
          <img src="../img/icons/smile.png" height="18">
          <span id="emoji-reactions-${messageObj.timetoken}-count" class="text-caption temp-message-reaction-number">0</span>
        </div>
      </div>
    </div>`;

  return newMsg;
}

// Function to convert a PubNub timetoken to a readable date format
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

// Function to send a read receipt for a message
async function sendReadReceipt(timetoken) {
  try {
    await pubnub.addMessageAction({
      channel: publicChannel,
      messageTimetoken: timetoken,
      action: { type: "read", value: pubnub.getUserId() },
    });
  } catch (error) {
    console.log("Failed to send read receipt:", error);
  }
}

//////////////////////
// Utility functions

// Placeholder for adding emoji reaction, assuming you have a separate handler in message-actions.js
function maAddEmojiReaction(messageId) {
  console.log("Add emoji reaction to message with ID:", messageId);
  // Logic to add emoji reaction can go here
}

var publicChannel = "Public.global_chat";

// Cache in-flight read receipts and message reactions
var inflightReadReceipt = {};
var messageReactions = {};

// Handle adding read receipts
function maReadReceipt(messageActionEvent) {
  const messageCheckElement = document.getElementById(
    'message-check-' + messageActionEvent.data.messageTimetoken
  );
  if (messageCheckElement) {
    if (
      messageActionEvent.event === 'added' &&
      messageActionEvent.data.type === 'read'
    ) {
      messageCheckElement.src = '../img/icons/read.png';
    }
  } else {
    inflightReadReceipt[messageActionEvent.data.messageTimetoken] = true;
  }
}

// Handle adding emoji reactions
function maEmojiReaction(messageActionEvent) {
  const messageReactionContainer = document.getElementById(
    'emoji-reactions-' + messageActionEvent.data.messageTimetoken
  );
  if (!messageReactionContainer) return;

  const countElement = document.getElementById(
    'emoji-reactions-' + messageActionEvent.data.messageTimetoken + '-count'
  );

  if (
    messageActionEvent.event === 'added' &&
    messageActionEvent.data.type === 'react'
  ) {
    messageReactions[messageActionEvent.data.messageTimetoken] =
      (messageReactions[messageActionEvent.data.messageTimetoken] || 0) + 1;
  } else if (
    messageActionEvent.event === 'removed' &&
    messageActionEvent.data.type === 'react'
  ) {
    messageReactions[messageActionEvent.data.messageTimetoken] =
      (messageReactions[messageActionEvent.data.messageTimetoken] || 0) - 1;
  } else {
    return;
  }

  countElement.innerText =
    messageReactions[messageActionEvent.data.messageTimetoken];
  messageReactionContainer.style.display =
    messageReactions[messageActionEvent.data.messageTimetoken] > 0
      ? 'block'
      : 'none';
}

// Add an emoji reaction
async function maAddEmojiReaction(messageId) {
  const messageElement = document.getElementById('emoji-reactions-' + messageId);

  if (messageElement.classList.contains('temp-message-reacted')) {
    try {
      await pubnub.removeMessageAction({
        channel: publicChannel,
        messageTimetoken: messageId,
        actionTimetoken: messageElement.dataset.actionid,
      });
      messageElement.classList.remove('temp-message-reacted');
    } catch (error) {
      console.log("Error removing reaction:", error);
    }
  } else {
    try {
      const result = await pubnub.addMessageAction({
        channel: publicChannel,
        messageTimetoken: messageId,
        action: { type: 'react', value: 'smile' },
      });
      messageElement.dataset.actionid = result.data.actionTimetoken;
      messageElement.classList.add('temp-message-reacted');
    } catch (error) {
      console.log("Error adding reaction:", error);
    }
  }
}

function setupReactionHoverEvents(messageDiv, messageId) {
  const emojiReactionsId = `emoji-reactions-${messageId}`;

  const addHoverEvents = (emojiReactionsElement) => {
    // Show emoji reactions on hover
    messageDiv.addEventListener("mouseenter", () => {
      emojiReactionsElement.style.display = "block";
    });

    // Hide emoji reactions when not hovering, only if no reactions exist
    messageDiv.addEventListener("mouseleave", () => {
      const countElement = emojiReactionsElement.querySelector(`#${emojiReactionsId}-count`);
      if (countElement && parseInt(countElement.innerText) === 0) {
        emojiReactionsElement.style.display = "none";
      }
    });

    // Add a click listener to add a reaction
    emojiReactionsElement.addEventListener("click", () => {
      maAddEmojiReaction(messageId);
    });
  };

  // Try to find the element immediately
  const emojiReactionsElement = document.getElementById(emojiReactionsId);
  if (emojiReactionsElement) {
    addHoverEvents(emojiReactionsElement);
    return;
  }

  // If not found, observe for its addition to the DOM
  const observer = new MutationObserver((mutationsList, observer) => {
    for (const mutation of mutationsList) {
      if (mutation.type === "childList") {
        const addedNode = Array.from(mutation.addedNodes).find(
          (node) => node.id === emojiReactionsId
        );
        if (addedNode) {
          addHoverEvents(addedNode);
          observer.disconnect(); // Stop observing once the element is found and events are added
          return;
        }
      }
    }
  });

  // Observe messageDiv for changes in its child elements
  observer.observe(messageDiv, { childList: true, subtree: true });
}
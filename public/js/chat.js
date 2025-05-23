const socket = io();

// Elements
const $messageForm = document.querySelector("#chat-form");
const $messageFormInput = document.querySelector("#msg");
const $messageFormButton = $messageForm.querySelector("button");
const $messages = document.querySelector(".chat-messages");

// Options - room name from URL query string
const { room } = Qs.parse(location.search, { ignoreQueryPrefix: true });

// Store current username globally, will be set by server after authentication
let currentUser = "Guest";

// Pagination variables
let currentPage = 1;
let totalPages = 1;
let isLoadingMessages = false;
const MESSAGES_PER_PAGE = 20; // Should match server-side limit or be configurable

// Helper function to get token from localStorage (similar to dashboard.js)
function getToken() {
  const userToken = localStorage.getItem("userToken");
  if (!userToken) return null;
  try {
    const parsedOuter = JSON.parse(userToken);
    if (typeof parsedOuter === 'object' && parsedOuter !== null && parsedOuter.token) {
      return parsedOuter.token;
    } else if (typeof parsedOuter === 'string') {
      return parsedOuter;
    }
    return userToken; // Fallback
  } catch (e) {
    return userToken; // Assume it's a raw token string
  }
}

const autoscroll = (forceScroll = false) => {
  if (!$messages || !$messages.lastElementChild) {
    return;
  }

  const $newMessage = $messages.lastElementChild;
  const newMessageStyles = getComputedStyle($newMessage);
  const newMessageMargin = parseInt(newMessageStyles.marginBottom) || 0;
  const newMessageHeight = $newMessage.offsetHeight + newMessageMargin;

  // Visible height
  const visibleHeight = $messages.offsetHeight;
  // Height of messages container
  const containerHeight = $messages.scrollHeight;
  // How far have I scrolled?
  const scrollOffset = $messages.scrollTop + visibleHeight;

  // Only autoscroll if the user is near the bottom, or if forceScroll is true (e.g., initial load)
  if (forceScroll || containerHeight - newMessageHeight * 2 <= scrollOffset + 10) { // Check if near bottom (e.g. within 2 new messages height)
    $messages.scrollTop = $messages.scrollHeight;
  }
};


function createMessageHTML(message, isOwnMessage) {
  const messageClass = isOwnMessage ? 'message--own' : 'message--other';
  const safeUsername = message.username; 
  const safeText = message.text;
  // Timestamp from server is already formatted by formatMessage, or it's an ISO string from DB
  const time = message.time || (message.timestamp ? moment(message.timestamp).format("h:mm a") : moment().format("h:mm a"));

  return `
    <div class="message ${messageClass}">
      <p class="meta">
        <span>${safeUsername}</span>
        <span>${time}</span>
      </p>
      <p class="text">
        ${safeText}
      </p>
    </div>
  `;
}

async function fetchMessages(roomName, pageToFetch) {
  if (isLoadingMessages) return;
  isLoadingMessages = true;

  const token = getToken();
  if (!token) {
    alert('Authentication token not found. Please log in.');
    isLoadingMessages = false;
    window.location.href = '/index.html';
    return;
  }

  try {
    const response = await fetch(`/api/v1/rooms/${encodeURIComponent(roomName)}/messages?page=${pageToFetch}&limit=${MESSAGES_PER_PAGE}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to fetch messages (status: ${response.status})`);
    }

    const responseData = await response.json();
    
    if (responseData.success && responseData.data) {
      totalPages = responseData.data.totalPages;
      currentPage = responseData.data.currentPage; // Update current page based on server response
      const messagesToDisplay = responseData.data.messages;

      if (pageToFetch === 1) {
        $messages.innerHTML = ''; // Clear messages for initial load
        messagesToDisplay.forEach(msg => {
          const isOwn = msg.username === currentUser;
          const html = createMessageHTML(msg, isOwn);
          $messages.insertAdjacentHTML("beforeend", html);
        });
        autoscroll(true); // Force scroll to bottom on initial load
      } else {
        // Prepending older messages
        const oldScrollHeight = $messages.scrollHeight;
        const oldScrollTop = $messages.scrollTop;

        // Messages from server are newest-first for the page.
        // To prepend correctly (oldest of the batch at the very top), iterate in reverse.
        for (let i = messagesToDisplay.length - 1; i >= 0; i--) {
          const msg = messagesToDisplay[i];
          const isOwn = msg.username === currentUser;
          const html = createMessageHTML(msg, isOwn);
          $messages.insertAdjacentHTML("afterbegin", html);
        }
        
        // Maintain scroll position
        $messages.scrollTop = oldScrollTop + ($messages.scrollHeight - oldScrollHeight);
      }
    } else {
      console.warn("No messages found or server indicated failure:", responseData.message);
      if (pageToFetch === 1) $messages.innerHTML = '<p class="text-center text-gray-400">No messages yet.</p>';
      // If totalPages is 0 from server, it means no messages at all.
      if(responseData.data && responseData.data.totalPages !== undefined) {
        totalPages = responseData.data.totalPages;
      }
    }
  } catch (error) {
    console.error("Error fetching messages:", error);
    Swal.fire('Error', `Could not load messages: ${error.message}`, 'error');
    if (pageToFetch === 1) $messages.innerHTML = '<p class="text-center text-red-500">Error loading messages.</p>';
  } finally {
    isLoadingMessages = false;
  }
}


// --- Socket Authentication and Event Handlers ---
const storedUserToken = localStorage.getItem("userToken"); 

if (storedUserToken) {
  let tokenValue = getToken(); // Use the helper to parse
  socket.emit('authenticate', { token: tokenValue });
} else {
  alert('Authentication token not found. Please log in.');
  window.location.href = '/index.html'; 
}

socket.on('authenticated', (data) => {
  console.log('Authenticated successfully as:', data.username);
  currentUser = data.username; 

  if (room) {
    socket.emit("joinRoom", { roomName: room }, (error) => { 
      if (error) {
        let errorMessage = 'Error joining room.';
        if (typeof error === 'string') { 
            errorMessage = error;
        } else if (error && error.message) { 
            errorMessage = error.message;
        }
        alert(errorMessage);
        window.location.href = "/dashboard.html"; 
      } else {
        console.log(`Successfully joined room: ${room} as ${currentUser}`);
        // Initial message load
        fetchMessages(room, 1);
      }
    });
  } else {
    console.error("Room name not found in query string. Cannot join.");
    alert("Room name not specified. Cannot join room.");
    window.location.href = "/dashboard.html"; 
  }
});

socket.on('unauthorized', (data) => {
  console.error('Authentication failed:', data ? data.message : 'No details provided by server.');
  alert(data && data.message ? data.message : 'Authentication failed. Please log in again.');
  localStorage.removeItem('userToken'); 
  window.location.href = '/index.html'; 
});

socket.on('error', (data) => { 
  console.error('Received server error:', data ? data.message : 'No details provided by server.');
  alert(`Server error: ${data && data.message ? data.message : 'An unexpected error occurred.'}`);
});


// --- Real-time Message Handling ---
socket.on("message", message => {
  if (!$messages) return;
  // Check if this message is already displayed (e.g. if it's from history just loaded)
  // This basic check might not be perfect for highly concurrent messages but helps.
  // A more robust way would be message IDs if available.
  const isNearBottom = $messages.scrollTop + $messages.clientHeight >= $messages.scrollHeight - 50; // 50px buffer

  const isOwn = message.username === currentUser;
  const html = createMessageHTML(message, isOwn);
  $messages.insertAdjacentHTML("beforeend", html);
  
  if(isNearBottom) { // Only autoscroll if user was near the bottom
      autoscroll(true); // Force scroll for new incoming messages when near bottom
  }
});

socket.on("welcomeMessage", message => {
  if (!$messages) return;
  const isNearBottom = $messages.scrollTop + $messages.clientHeight >= $messages.scrollHeight - 50;
  const isOwn = message.username === currentUser; 
  const html = createMessageHTML(message, isOwn);
  $messages.insertAdjacentHTML("beforeend", html);
  if(isNearBottom) {
      autoscroll(true);
  }
});

// Removed socket.on("loadHistory", ...) as messages are loaded via fetchMessages

// Sidebar logic
const sidebarTemplate = document.querySelector("#sidebar-template")?.innerHTML;
socket.on("roomUsers", ({ roomName, users }) => { 
  if (sidebarTemplate) {
    const html = Mustache.render(sidebarTemplate, {
      room: roomName, 
      users
    });
    const sidebarElement = document.querySelector("#sidebar");
    if (sidebarElement) {
      sidebarElement.innerHTML = html;
    }
  } else {
    console.warn("Sidebar template not found. Cannot render room data.");
  }
});

// Message form submission
if ($messageForm) {
  $messageForm.addEventListener("submit", e => {
    e.preventDefault();
    if (!$messageFormInput || !$messageFormButton) return;

    $messageFormButton.setAttribute("disabled", "disabled");
    const messageText = $messageFormInput.value;

    socket.emit("chatMessage", messageText, (error) => { 
      $messageFormButton.removeAttribute("disabled");
      $messageFormInput.value = "";
      $messageFormInput.focus();
      if (error) return console.log(error);
    });
  });
}

// Scroll listener for loading older messages
if ($messages) {
  $messages.addEventListener('scroll', () => {
    if ($messages.scrollTop === 0 && !isLoadingMessages && currentPage < totalPages) {
      console.log(`Scrolled to top. CurrentPage: ${currentPage}, TotalPages: ${totalPages}. Fetching older messages.`);
      // Fetch the next page (which means currentPage + 1, as currentPage is the one already loaded)
      fetchMessages(room, currentPage + 1);
    }
  });
}

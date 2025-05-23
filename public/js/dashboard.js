async function populateRooms() {
  const selectElement = document.getElementById("roomName");
  const apiEndpoint = `/api/v1/rooms`; // Publicly discoverable rooms

  const loadingSwal = Swal.fire({
    title: "Fetching data. Please wait...",
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    onBeforeOpen: () => {
      Swal.showLoading();
    },
  });

  try {
    const token = getToken();
    if (!token) {
      Swal.fire("Error", "Authentication token not found. Please log in.", "error");
      loadingSwal.close();
      // Potentially redirect to login: window.location.href = '/index.html';
      return;
    }
    const response = await fetch(apiEndpoint, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const result = await response.json(); // Expecting { success: boolean, data: [], message?: string }

    if (!response.ok || !result.success) {
      throw new Error(result.message || `Failed to fetch rooms (status: ${response.status})`);
    }
    
    const data = result.data;
    selectElement.innerHTML = "";

    data.forEach((room) => {
      console.log(room);
      const option = document.createElement("option");
      option.value = room.roomName;
      option.textContent = room.roomName;
      selectElement.appendChild(option);
    });

    loadingSwal.close();
  } catch (error) {
    console.error("Error:", error.message);

    loadingSwal.close();
    Swal.fire({
      title: "Internal Server Error",
      text: `${error.message}. Please contact the admin.`,
      icon: "error",
      confirmButtonText: "OK",
    });
  }
}

populateRooms();

$("#joinChat").on("click", async function (e) {
  e.preventDefault();
  // Username is no longer taken from input for joining, it's handled by chat.js via token
  const selectElement = document.getElementById("roomName");
  const selectedIndex = selectElement.selectedIndex;

  if (selectedIndex !== -1) {
    const selectedOption = selectElement.options[selectedIndex];
    const roomName = selectedOption.value; // This could be room name or an access link if design changes

    // Simple redirect, chatRoom.html and chat.js will handle authentication and joining
    // Ensure the query parameter is 'room' as expected by chat.js
    window.location.href = `chatRoom.html?room=${encodeURIComponent(roomName)}`;
  } else {
    Swal.fire({
      title: "Failed to Join",
      text: "No room selected from the list.",
      icon: "error",
      confirmButtonText: "OK",
    });
  }
});

// Helper function to get token from localStorage (similar to chat.js)
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
    return userToken; // Fallback if it's not JSON or not the expected structure
  } catch (e) {
    return userToken; // Assume it's a raw token string if JSON parsing fails
  }
}


document.addEventListener("DOMContentLoaded", async function () {
  const logoutButton = document.getElementById("logout");

  logoutButton.addEventListener("click", async function () {
    Swal.fire({
      title: "Are you sure?",
      text: "You will be logged out.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, log me out",
      cancelButtonText: "No, I still want to chat",
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.href = "../index.html";
        localStorage.removeItem("userToken");
      }
    });
  });
});

// --- Room Creation ---
const createRoomForm = document.getElementById('createRoomForm');
if (createRoomForm) {
  createRoomForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    // Username is no longer taken from input, it's derived from the token on the backend
    const newRoomName = document.getElementById('newRoomName').value;
    const isLocked = document.getElementById('isLocked').checked;
    const isDiscoverable = document.getElementById('isDiscoverable').checked;

    if (!newRoomName.trim()) {
      Swal.fire('Error', 'New room name cannot be empty.', 'error');
      return;
    }

    const loadingSwal = Swal.fire({
      title: "Creating Room...",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      willOpen: () => { Swal.showLoading(); },
    });

    try {
      const token = getToken();
      if (!token) {
        Swal.fire("Error", "Authentication token not found. Please log in.", "error");
        loadingSwal.close();
        return;
      }

      const response = await fetch('/api/v1/rooms', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        // Username is removed from body, backend uses token
        body: JSON.stringify({ roomName: newRoomName, isLocked, isDiscoverable }) 
      });
      const result = await response.json();
      loadingSwal.close();

      if (result.success) {
        Swal.fire({
          title: 'Room Created!',
          html: `Room '${newRoomName}' created successfully.<br>Invite Link: ${window.location.origin}/dashboard.html?join=${result.data.accessLink}`,
          icon: 'success'
        });
        fetchAndDisplayOwnedRooms(); // Refresh the list of owned rooms
        createRoomForm.reset(); // Reset the form
      } else {
        Swal.fire('Error', result.message || 'Failed to create room.', 'error');
      }
    } catch (error) {
      loadingSwal.close();
      console.error('Error creating room:', error);
      Swal.fire('Error', 'An error occurred while creating the room.', 'error');
    }
  });
}


// --- Display Owned Rooms & Management ---
async function fetchAndDisplayOwnedRooms() {
  const ownedRoomsListDiv = document.getElementById('ownedRoomsList');
  if (!ownedRoomsListDiv) return;

  // Show loading state (optional, can use Swal too)
  ownedRoomsListDiv.innerHTML = '<p class="text-gray-500">Loading your rooms...</p>';
  
  try {
    const token = getToken();
    if (!token) {
      ownedRoomsListDiv.innerHTML = '<p class="text-red-500">Authentication token not found. Please log in.</p>';
      return;
    }
    // Ensure this endpoint matches the one defined in your room routes for owned rooms
    const response = await fetch('/api/v1/rooms/owned', { 
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }); 
    const result = await response.json();

    if (result.success && result.data) {
      ownedRoomsListDiv.innerHTML = ''; // Clear loading message
      if (result.data.length === 0) {
        ownedRoomsListDiv.innerHTML = '<p class="text-gray-500">You do not own any rooms yet.</p>';
        return;
      }

      result.data.forEach(room => {
        const roomElement = document.createElement('div');
        // Updated classes for dark theme card item
        roomElement.className = 'owned-room-item p-4 bg-gray-600 border border-gray-500 rounded-lg shadow-md'; 
        roomElement.innerHTML = `
          <h3 class="text-xl font-semibold text-indigo-400 mb-2">${room.roomName}</h3>
          <p class="text-sm text-gray-300 mb-1">
            Invite Link: 
            <a href="/dashboard.html?join=${room.accessLink}" class="text-blue-400 hover:text-blue-300 hover:underline invite-link-display">${window.location.origin}/dashboard.html?join=${room.accessLink}</a>
          </p>
          <p class="text-sm text-gray-300">Locked: <span id="lockedStatus-${room._id}" class="font-medium ${room.isLocked ? 'text-red-400' : 'text-green-400'}">${room.isLocked ? 'Yes' : 'No'}</span></p>
          <p class="text-sm text-gray-300 mb-3">Discoverable: <span id="discoverableStatus-${room._id}" class="font-medium ${room.isDiscoverable ? 'text-green-400' : 'text-red-400'}">${room.isDiscoverable ? 'Yes' : 'No'}</span></p>
          <div class="mt-3 border-t border-gray-500 pt-3">
            <div class="flex items-center justify-start space-x-4 mb-3">
                <div class="flex items-center">
                    <input type="checkbox" id="lock-${room._id}" ${room.isLocked ? 'checked' : ''} class="h-4 w-4 text-indigo-500 border-gray-400 bg-gray-500 rounded focus:ring-indigo-500 focus:ring-offset-gray-600">
                    <label for="lock-${room._id}" class="ml-2 text-sm text-gray-300">Lock Room</label>
                </div>
                <div class="flex items-center">
                    <input type="checkbox" id="discover-${room._id}" ${room.isDiscoverable ? 'checked' : ''} class="h-4 w-4 text-indigo-500 border-gray-400 bg-gray-500 rounded focus:ring-indigo-500 focus:ring-offset-gray-600">
                    <label for="discover-${room._id}" class="ml-2 text-sm text-gray-300">Discoverable</label>
                </div>
            </div>
            <button data-roomid="${room._id}" class="updateRoomSettingsButton w-full sm:w-auto text-sm bg-sky-600 hover:bg-sky-700 text-white py-2 px-4 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-gray-600 mr-2">
                Update Settings
            </button>
            <button data-roomid="${room._id}" class="deleteRoomButton w-full sm:w-auto text-sm bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-gray-600">
                Delete Room
            </button>
          </div>
        `;
        ownedRoomsListDiv.appendChild(roomElement);
      });

      // Add event listeners for all update buttons
      document.querySelectorAll('.updateRoomSettingsButton').forEach(button => {
        button.addEventListener('click', function() { // No need for async here, updateRoomSettings is async
          const roomId = this.dataset.roomid;
          const newIsLocked = document.getElementById(`lock-${roomId}`).checked;
          const newIsDiscoverable = document.getElementById(`discover-${roomId}`).checked;
          updateRoomSettings(roomId, newIsLocked, newIsDiscoverable);
        });
      });
      
      // Add event listeners for all delete buttons
      document.querySelectorAll('.deleteRoomButton').forEach(button => {
        button.addEventListener('click', function() {
          const roomId = this.dataset.roomid;
          handleDeleteRoom(roomId);
        });
      });

    } else {
      ownedRoomsListDiv.innerHTML = `<p class="text-red-500">Error fetching rooms: ${result.message || 'Unknown error'}</p>`;
    }
  } catch (error) {
    console.error('Error fetching owned rooms:', error);
    ownedRoomsListDiv.innerHTML = `<p class="text-red-500">An error occurred while fetching your rooms.</p>`;
  }
}

async function updateRoomSettings(roomId, isLocked, isDiscoverable) {
  const loadingSwal = Swal.fire({
    title: "Updating Settings...",
    allowOutsideClick: false,
    showConfirmButton: false,
    willOpen: () => { Swal.showLoading(); },
  });

  try {
    const token = getToken();
    if (!token) {
      Swal.fire("Error", "Authentication token not found. Please log in.", "error");
      loadingSwal.close();
      return;
    }
    const response = await fetch(`/api/v1/rooms/${roomId}/settings`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ isLocked, isDiscoverable })
    });
    const result = await response.json();
    loadingSwal.close();

    if (result.success) {
      Swal.fire('Success', 'Room settings updated successfully!', 'success');
      // Update the displayed status locally without a full refresh
      // Ensure result.data exists and has the properties before accessing
      if (result.data) {
        const lockedStatusEl = document.getElementById(`lockedStatus-${roomId}`);
        if (lockedStatusEl) lockedStatusEl.textContent = result.data.isLocked ? 'Yes' : 'No';
         const discoverableStatusEl = document.getElementById(`discoverableStatus-${roomId}`);
        if (discoverableStatusEl) discoverableStatusEl.textContent = result.data.isDiscoverable ? 'Yes' : 'No';
        const lockCheckbox = document.getElementById(`lock-${roomId}`);
        if (lockCheckbox) lockCheckbox.checked = result.data.isLocked;
        const discoverCheckbox = document.getElementById(`discover-${roomId}`);
        if (discoverCheckbox) discoverCheckbox.checked = result.data.isDiscoverable;
      }
    } else {
      Swal.fire('Error', result.message || 'Failed to update settings.', 'error');
    }
  } catch (error) {
    loadingSwal.close();
    console.error('Error updating room settings:', error);
    Swal.fire('Error', 'An error occurred while updating room settings.', 'error');
  }
}

// --- Delete Room Handling ---
async function handleDeleteRoom(roomId) {
  Swal.fire({
    title: 'Are you sure?',
    text: "You won't be able to revert this!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Yes, delete it!'
  }).then(async (result) => {
    if (result.isConfirmed) {
      const loadingSwal = Swal.fire({
        title: "Deleting Room...",
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => { Swal.showLoading(); },
      });

      try {
        const token = getToken();
        if (!token) {
          Swal.fire("Error", "Authentication token not found. Please log in.", "error");
          loadingSwal.close();
          return;
        }

        const response = await fetch(`/api/v1/rooms/${roomId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        loadingSwal.close(); // Close loading swal regardless of outcome after fetch

        if (response.ok) { // Status 200-299
          Swal.fire(
            'Deleted!',
            'Your room has been deleted.',
            'success'
          );
          fetchAndDisplayOwnedRooms(); // Refresh the list
        } else {
          const errorData = await response.json().catch(() => ({ message: "Failed to delete room. Unknown error." }));
          if (response.status === 403) {
            Swal.fire('Forbidden', errorData.message || 'You are not authorized to delete this room.', 'error');
          } else if (response.status === 404) {
            Swal.fire('Not Found', errorData.message || 'Room not found or already deleted.', 'error');
          } else {
            Swal.fire('Error', errorData.message || 'Failed to delete room.', 'error');
          }
        }
      } catch (error) {
        loadingSwal.close();
        console.error('Error deleting room:', error);
        Swal.fire('Error', 'An error occurred while deleting the room.', 'error');
      }
    }
  });
}


// --- Invite Link Handling ---
function handleInviteLink() {
  const params = new URLSearchParams(window.location.search);
  const joinToken = params.get('join');

  if (joinToken) {
    Swal.fire({
      title: "Processing Invite Link...",
      allowOutsideClick: false,
      showConfirmButton: false,
      willOpen: () => { Swal.showLoading(); },
    });

    // The invite link itself (/api/v1/rooms/join/${joinToken}) should be a public GET endpoint
    // or if it requires auth, add token here. Assuming it's public for now to resolve room details.
    fetch(`/api/v1/rooms/join/${joinToken}`) 
      .then(response => response.json())
      .then(result => {
        Swal.close(); // Close the "Processing Invite" Swal
        if (result.success && result.data && result.data.roomName) {
          const roomName = result.data.roomName;
          // No need to prompt for username, chat.js handles it with token
          Swal.fire({
            title: 'Joining via Invite!',
            text: `You are about to join room: ${roomName}`,
            icon: 'info',
            confirmButtonText: 'Join Room'
          }).then((actionResult) => {
            if (actionResult.isConfirmed) {
              // Redirect to chat room, chat.js will handle auth and socket join
              window.location.href = `chatRoom.html?room=${encodeURIComponent(roomName)}`;
            }
          });
        } else {
          Swal.fire('Error', result.message || 'Invalid or expired invite link.', 'error');
        }
      })
      .catch(error => {
        Swal.close(); // Close the "Processing Invite" Swal
        console.error('Error processing invite link:', error);
        Swal.fire('Error', 'An error occurred while processing the invite link.', 'error');
      });
  }
}


// Initial calls when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  populateRooms(); // Existing function to populate joinable rooms
  fetchAndDisplayOwnedRooms();
  handleInviteLink(); 
});

async function populateRooms() {
  const selectElement = document.getElementById("roomName");
  const apiEndpoint = `/api/v1/rooms`;

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
    const response = await fetch(apiEndpoint);
    const { data } = await response.json();

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
  const username = document.getElementById("username").value;
  const selectElement = document.getElementById("roomName");
  const selectedIndex = selectElement.selectedIndex;
  if (selectedIndex !== -1) {
    const selectedOption = selectElement.options[selectedIndex];
    const roomName = selectedOption.value;

    const loginData = {
      username: username,
      roomName: roomName,
    };

    const loadingSwal = Swal.fire({
      title: "Joining Room...",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      onBeforeOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      console.log("Login data", loginData);
      const response = await fetch("/api/v1/participants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginData),
      });

      const data = await response.json();
      console.log("isi data", data);

      if (data.success === true) {
        sessionStorage.setItem("username", username);

        loadingSwal.close();

        Swal.fire({
          title: "Welcome to AChat!",
          icon: "success",
          text: "Successfully joined the room. You will be redirected in 3 seconds...",
          confirmButtonText: "OK",
        });

        setTimeout(() => {
          window.location.href = `chatRoom.html?joinRoom=${roomName}`;
        });
      } else {
        loadingSwal.close();

        Swal.fire({
          title: "Failed Join",
          text: data.message,
          icon: "error",
          confirmButtonText: "OK",
        });
      }
    } catch (error) {
      loadingSwal.close();

      console.error("Error:", error.message);
      Swal.fire({
        title: "Internal Server Error",
        text: `${error.message}. Please contact the admin.`,
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  } else {
    Swal.fire({
      title: "Failed Join",
      text: "No room option selected",
      icon: "error",
      confirmButtonText: "OK",
    });
  }
});

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
    const username = document.getElementById('username').value; // Get username from existing input
    const newRoomName = document.getElementById('newRoomName').value;
    const isLocked = document.getElementById('isLocked').checked;
    const isDiscoverable = document.getElementById('isDiscoverable').checked;

    if (!username.trim()) {
      Swal.fire('Error', 'Username is required to create a room.', 'error');
      return;
    }
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
      const response = await fetch('/api/v1/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, roomName: newRoomName, isLocked, isDiscoverable })
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
    // TODO: This endpoint needs actual authentication to get the correct userId
    const response = await fetch('/api/v1/rooms/ownedByMe'); 
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
            <button data-roomid="${room._id}" class="updateRoomSettingsButton w-full sm:w-auto text-sm bg-sky-600 hover:bg-sky-700 text-white py-2 px-4 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-gray-600">
                Update Settings
            </button>
          </div>
        `;
        ownedRoomsListDiv.appendChild(roomElement);
      });

      // Add event listeners for all update buttons
      document.querySelectorAll('.updateRoomSettingsButton').forEach(button => {
        button.addEventListener('click', async function() {
          const roomId = this.dataset.roomid;
          const newIsLocked = document.getElementById(`lock-${roomId}`).checked;
          const newIsDiscoverable = document.getElementById(`discover-${roomId}`).checked;
          updateRoomSettings(roomId, newIsLocked, newIsDiscoverable);
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
    const response = await fetch(`/api/v1/rooms/${roomId}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isLocked, isDiscoverable })
    });
    const result = await response.json();
    loadingSwal.close();

    if (result.success) {
      Swal.fire('Success', 'Room settings updated successfully!', 'success');
      // Update the displayed status locally without a full refresh
      document.getElementById(`lockedStatus-${roomId}`).textContent = result.data.isLocked;
      document.getElementById(`discoverableStatus-${roomId}`).textContent = result.data.isDiscoverable;
      document.getElementById(`lock-${roomId}`).checked = result.data.isLocked;
      document.getElementById(`discover-${roomId}`).checked = result.data.isDiscoverable;
    } else {
      Swal.fire('Error', result.message || 'Failed to update settings.', 'error');
    }
  } catch (error) {
    loadingSwal.close();
    console.error('Error updating room settings:', error);
    Swal.fire('Error', 'An error occurred while updating room settings.', 'error');
  }
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

    fetch(`/api/v1/rooms/join/${joinToken}`)
      .then(response => response.json())
      .then(result => {
        if (result.success) {
          const roomName = result.data.roomName;
          // const roomId = result.data.roomId; // roomId is available if needed
          
          // Get username - either from existing input or prompt
          let username = document.getElementById('username').value;
          if (!username || !username.trim()) {
            // If dashboard username field is empty, try from sessionStorage (from chat page) or prompt
            username = sessionStorage.getItem('username');
          }

          if (username && username.trim()) {
             // Simulate joining the room (similar to existing join logic)
            sessionStorage.setItem('username', username); // Ensure username is set for chat page
            Swal.fire({
                title: 'Joining via Invite!',
                text: `You are about to join room: ${roomName}`,
                icon: 'info',
                confirmButtonText: 'Join Room'
            }).then(() => {
                window.location.href = `chatRoom.html?joinRoom=${roomName}`; // Using existing join query param
            });
          } else {
            // Prompt for username if not found
            Swal.fire({
              title: `Joining Room: ${roomName}`,
              input: 'text',
              inputLabel: 'Enter your username',
              inputPlaceholder: 'Your username...',
              showCancelButton: true,
              confirmButtonText: 'Join',
              inputValidator: (value) => {
                if (!value || !value.trim()) {
                  return 'Username cannot be empty!';
                }
              }
            }).then((inputResult) => {
              if (inputResult.isConfirmed && inputResult.value) {
                const enteredUsername = inputResult.value;
                sessionStorage.setItem('username', enteredUsername);
                window.location.href = `chatRoom.html?joinRoom=${roomName}`;
              } else {
                 Swal.fire('Cancelled', 'Username not provided. Cannot join room.', 'info');
              }
            });
          }
        } else {
          Swal.fire('Error', result.message || 'Invalid or expired invite link.', 'error');
        }
      })
      .catch(error => {
        Swal.close();
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

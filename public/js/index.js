// Helper functions to display/clear error messages
function displayError(fieldId, message) {
  const errorElement = document.getElementById(fieldId + "-error");
  if (errorElement) {
    errorElement.textContent = message;
  }
}

function clearError(fieldId) {
  const errorElement = document.getElementById(fieldId + "-error");
  if (errorElement) {
    errorElement.textContent = "";
  }
}

// Login functionality
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

if (usernameInput) {
  usernameInput.addEventListener('input', () => clearError('username'));
}
if (passwordInput) {
  passwordInput.addEventListener('input', () => clearError('password'));
}


$("#signInButton").on("click", function (e) {
  e.preventDefault();

  const usernameValue = usernameInput ? usernameInput.value.trim() : '';
  const passwordValue = passwordInput ? passwordInput.value.trim() : '';
  let isValid = true;

  // Clear previous errors
  clearError('username');
  clearError('password');

  // Client-side validation
  if (!usernameValue) {
    displayError('username', "Username is required.");
    isValid = false;
  }
  if (!passwordValue) {
    displayError('password', "Password is required.");
    isValid = false;
  }

  if (!isValid) {
    return;
  }

  const loginData = {
    username: usernameValue,
    password: passwordValue,
  };

  $(this).prop("disabled", true);
  const $signInButton = $(this); // Store reference to the button

  const loadingSwal = Swal.fire({
    title: "Please wait...",
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => { // Changed from onBeforeOpen for newer SweetAlert versions
      Swal.showLoading();
    },
  });

  fetch("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(loginData),
  })
    .then((response) => {
      // Check if response is okay, if not, try to parse error from backend
      if (!response.ok) {
        return response.json().then(errData => {
          throw new Error(errData.message || `HTTP error! status: ${response.status}`);
        }).catch(() => {
          // Fallback if error parsing fails
          throw new Error(`HTTP error! status: ${response.status}`);
        });
      }
      return response.json();
    })
    .then((data) => {
      loadingSwal.close();
      if (data.success === true) {
        Swal.fire({
          title: "Success Login",
          text: "Successfully logged in, you will be redirected to the dashboard in 3 seconds..",
          icon: "success",
          confirmButtonText: "OK",
          timer: 3000, // Auto close after 3 seconds
          timerProgressBar: true
        }).then((result) => {
          // Store token and redirect
          // Ensure data.data or data.data.token structure based on your API response
          localStorage.setItem("userToken", JSON.stringify(data.data)); 
          window.location.href = "dashboard.html";
        });
      } else {
        // This 'else' might not be reached if !response.ok throws error first
        Swal.fire({
          title: "Failed Login",
          text: data.message || "Invalid username or password.", // Use server message or a default
          icon: "error",
          confirmButtonText: "OK",
        });
      }
    })
    .catch((error) => {
      loadingSwal.close();
      console.error("Login Error:", error);
      Swal.fire({
        title: "Login Error",
        text: error.message || "An unexpected error occurred. Please try again.",
        icon: "error",
        confirmButtonText: "OK",
      });
    })
    .finally(() => {
      $signInButton.prop("disabled", false); // Use stored reference
    });
});

// Registration functionality
const regUsernameInput = document.getElementById("reg-username");
const regPasswordInput = document.getElementById("reg-password");
const regGenderInput = document.getElementById("reg-gender"); // Assuming ID "reg-gender" for gender input

if (regUsernameInput) {
  regUsernameInput.addEventListener('input', () => clearError('reg-username'));
}
if (regPasswordInput) {
  regPasswordInput.addEventListener('input', () => clearError('reg-password'));
}
if (regGenderInput) {
  regGenderInput.addEventListener('input', () => clearError('reg-gender'));
}

// Check if the registerButton exists before attaching an event listener
// This helps if index.js is shared between login.html and register.html
if ($("#registerButton").length) {
  $("#registerButton").on("click", function (e) {
    e.preventDefault();

    const usernameValue = regUsernameInput ? regUsernameInput.value.trim() : '';
    const passwordValue = regPasswordInput ? regPasswordInput.value.trim() : '';
    const genderValue = regGenderInput ? regGenderInput.value.trim() : '';
    let isValid = true;

    // Clear previous errors
    clearError('reg-username');
    clearError('reg-password');
    clearError('reg-gender');

    // Username validation
    if (!usernameValue) {
      displayError('reg-username', "Username is required.");
      isValid = false;
    } else if (usernameValue.length < 3) {
      displayError('reg-username', "Username must be at least 3 characters.");
      isValid = false;
    }

    // Password validation (example: min 8 chars, at least one letter and one number)
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordValue) {
      displayError('reg-password', "Password is required.");
      isValid = false;
    } else if (passwordValue.length < 8) {
      displayError('reg-password', "Password must be at least 8 characters.");
      isValid = false;
    } else if (!passwordRegex.test(passwordValue)) {
      displayError('reg-password', "Password must be at least 8 characters, including one letter and one number.");
      isValid = false;
    }
    
    // Gender validation
    if (!genderValue) {
      displayError('reg-gender', "Gender is required.");
      isValid = false;
    }
    // Add more specific gender validation if needed (e.g., specific values)

    if (!isValid) {
      return;
    }

    const registerData = {
      username: usernameValue,
      password: passwordValue,
      gender: genderValue,
    };

    const $registerButton = $(this); // Store reference
    $registerButton.prop("disabled", true);

    const loadingSwal = Swal.fire({
      title: "Please wait...",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => { // Changed from onBeforeOpen
        Swal.showLoading();
      },
    });

    fetch("/api/v1/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerData),
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then(errData => {
            throw new Error(errData.message || `HTTP error! status: ${response.status}`);
          }).catch(() => {
             throw new Error(`HTTP error! status: ${response.status}`);
          });
        }
        return response.json();
      })
      .then((data) => {
        loadingSwal.close();
        if (data.success === true) {
          Swal.fire({
            title: "Success Register",
            text: "Successfully created an account. You may now log in to the application.",
            icon: "success",
            confirmButtonText: "OK",
          }).then((result) => {
            window.location.href = "index.html"; // Redirect to login page
          });
        } else {
          Swal.fire({
            title: "Failed Register",
            text: data.message || "Could not register account. Please try again.",
            icon: "error",
            confirmButtonText: "OK",
          });
        }
      })
      .catch((error) => {
        loadingSwal.close();
        console.error("Registration Error:", error);
        Swal.fire({
          title: "Registration Error",
          text: error.message || "An unexpected error occurred. Please try again.",
          icon: "error",
          confirmButtonText: "OK",
        });
      })
      .finally(() => {
        $registerButton.prop("disabled", false);
      });
  });
}

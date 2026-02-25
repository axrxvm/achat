const fetchSignupUrl = async ({ oauthBase, oauthAppId, redirectUrl, oauthProviders }) => {
  const response = await fetch(`${oauthBase}/init`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      app_id: oauthAppId,
      redirect: redirectUrl,
      providers: oauthProviders
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OAuth init failed: ${errorBody}`);
  }

  const data = await response.json();
  if (!data.signup_url) {
    throw new Error("OAuth init response did not include signup_url");
  }

  return data.signup_url;
};

module.exports = {
  fetchSignupUrl
};

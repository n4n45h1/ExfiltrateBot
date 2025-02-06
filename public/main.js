// Fetch user IP info (IPv4, IPv6) and location, then store them to the server
async function gatherAndSendInfo() {
  try {
    // Get IPv4
    const ipv4Res = await fetch('https://api.ipify.org?format=json');
    const ipv4Data = await ipv4Res.json();
    const ipv4 = ipv4Data.ip || 'Unknown';

    // Get IPv6
    const ipv6Res = await fetch('https://api64.ipify.org?format=json');
    const ipv6Data = await ipv6Res.json();
    const ipv6 = ipv6Data.ip || 'Unknown';

    // Get country and possibly more info from an IP geolocation API (ipapi, ipapi.co, etc.)
    // Example: https://ipapi.co/json
    let country = 'Unknown';
    try {
      const geoRes = await fetch('https://ipapi.co/json');
      const geoData = await geoRes.json();
      if (geoData.country_name) {
        country = geoData.country_name;
      }
    } catch (err) {
      console.error('Failed to fetch geolocation:', err);
    }

    const browser = navigator.userAgent || 'Unknown';
    const accessedAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    // Send to server
    const response = await fetch('/userinfo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ipv4, ipv6, country, browser, accessedAt })
    });

    if (!response.ok) {
      console.error('Failed to store user info on server');
    }
  } catch (err) {
    console.error('Error gathering user info:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      await gatherAndSendInfo();
      // Redirect to the Discord OAuth route
      window.location.href = '/auth/discord';
    });
  }
});

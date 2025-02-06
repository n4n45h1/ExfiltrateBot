require('dotenv').config();
const express = require('express');
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

// セッション設定
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false
  })
);

// OAuthスコープ "email" を含める
passport.use(
  new DiscordStrategy(
    {
      clientID: DISCORD_CLIENT_ID,
      clientSecret: DISCORD_CLIENT_SECRET,
      callbackURL: DISCORD_CALLBACK_URL,
      scope: ['identify', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      // プロフィールをセッションに保存
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

app.use(passport.initialize());
app.use(passport.session());

// トップページ
app.get('/', (req, res) => {
  res.send(`
    <h1>Discord OAuth Example</h1>
    <p><a href="/auth/discord">Login with Discord</a></p>
  `);
});

// Discordへのリダイレクト
app.get('/auth/discord', passport.authenticate('discord'));

// コールバックURL
app.get(
  '/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  async (req, res) => {
    // 認証成功
    const { email, username, discriminator, id } = req.user;
    // Webhookに送る埋め込み例
    const embed = {
      embeds: [
        {
          title: 'New OAuth Login',
          description: `A user just logged in via Discord!`,
          color: 3447003,
          fields: [
            {
              name: 'Username',
              value: `${username}#${discriminator} (ID: ${id})`
            },
            {
              name: 'Email',
              value: email || 'No email shared.'
            }
          ]
        }
      ]
    };

    try {
      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(embed)
      });
      console.log('Webhook successfully sent!');
    } catch (err) {
      console.error('Error sending webhook:', err);
    }

    res.send('<h2>Discord Authentication Successful</h2>');
  }
);

app.listen(PORT || 3000, () => {
  console.log(`Server started on port ${PORT || 3000}`);
});

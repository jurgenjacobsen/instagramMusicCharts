import express from 'express';
import cors from 'cors';
import ejs from 'ejs';

import path from 'path';
import dotenv from 'dotenv';

import axios from 'axios';
import { createCanvas, loadImage, registerFont } from 'canvas';

import passport from 'passport';
import LastFmStrategy from 'passport-lastfm';
import session from 'express-session';
import { GetTopAlbums } from './Utils';

dotenv.config();

const app = express();
const PORT = process.env?.PORT || 3000;
const API_KEY = process.env?.API_KEY;
const API_SECRET = process.env?.API_SECRET;
const PRODUCTION = process.env?.PRODUCTION;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../app'));
app.use(express.static(path.join(__dirname, '../app/public')));

app.use(cors());

app.use(
  session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true,
  }),
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LastFmStrategy(
    {
      api_key: API_KEY as string,
      secret: API_SECRET,
      callbackURL: PRODUCTION
        ? 'https://recordsbooth.onrender.com/callback'
        : `http://localhost:${PORT}/callback`,
    },
    (req, sessionKey, done) => {
      return done(null, sessionKey as any);
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj as any);
});

app.get('/login', passport.authenticate('lastfm'));

app.get('/callback', passport.authenticate('lastfm', { failureRedirect: '/' }), (req, res) => {
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

app.get('/', async (req: any, res) => {
  const sK = (req?.user as any)?.token;
  let data: undefined | any;
  let user: undefined | any = req?.user;
  let SEARCH_PERIOD = '7day';

  if (user) {
    data = await GetTopAlbums(user.name, SEARCH_PERIOD, sK, API_KEY as string, 10);
  }

  data = {
    albums: data?.topalbums?.album || null,
    userInfo: data?.topalbums?.['@attr'] || null,
    user: user,
  };

  res.render('app', { user, data });
});

registerFont(path.join(__dirname, '../app/public/fonts/Roboto-Bold.ttf'), {
  family: 'Roboto',
  weight: 'bold',
});

registerFont(path.join(__dirname, '../app/public/fonts/Roboto-Black.ttf'), {
  family: 'Roboto',
  weight: 'black',
});

app.get('/download', async (req, res) => {
  if (!req.user) return res.redirect('/login');

  const sK = (req?.user as any)?.token;
  let data: undefined | any;
  let user: undefined | any = req?.user;
  let SEARCH_PERIOD = '7day';

  data = await GetTopAlbums(user.name, SEARCH_PERIOD, sK, API_KEY as string, 10);

  data = data?.topalbums?.album;

  try {
    const title = 'My Top Albums';
    const subtitle = 'Last 7 days';
    const belowSubtitle = 'Generated by RecordsBooth Charts';

    const canvas = createCanvas(900, 900);
    const ctx = canvas.getContext('2d');

    for (let i = 0; i < data.length; i++) {
      const response = await axios.get(data[i]?.image?.[3]?.['#text'], {
        responseType: 'arraybuffer',
      });
      const imageBuffer = response.data;
      const image = await loadImage(imageBuffer as any);

      const x = (i % 3) * 300;
      const y = Math.floor(i / 3) * 300;
      ctx.drawImage(image, x, y, 300, 300);
    }

    const largeCanvas = createCanvas(1080, 1920);
    const largeCtx = largeCanvas.getContext('2d');

    largeCtx.fillStyle = '#03120e'; // Background color
    largeCtx.fillRect(0, 0, 1080, 1920); // Fill the background

    // Place image centered
    const centerX = (1080 - 900) / 2;
    const centerY = (1920 - 900) / 2 + 60;

    // Know location of image to cut it's corners
    const gridX = (1080 - 900) / 2;
    const gridY = (1920 - 900) / 2 + 60;
    const cornerRadius = 30;

    // Text configuration
    const titlePadding = 10;
    const titleHeight = 10;
    const subtitleTopMargin = 40;

    // Draw title
    largeCtx.font = 'black 92px Roboto';
    const titleWidth = largeCtx.measureText(title).width;
    const titleX = (1080 - titleWidth) / 2;
    const titleY = 360;

    // Draw underline for title and place title on top
    largeCtx.fillStyle = '#428f66';
    largeCtx.fillRect(
      titleX - titlePadding,
      titleY - titleHeight,
      titleWidth + titlePadding * 2,
      titleHeight,
    );
    largeCtx.fillStyle = '#f8f4e3';
    largeCtx.fillText(title, titleX, titleY - 15);

    // Draw subtitle
    largeCtx.font = 'bold 42px Roboto';
    const subtitleWidth = largeCtx.measureText(subtitle).width;
    const subtitleX = (1080 - subtitleWidth) / 2;
    const subtitleY = titleY + subtitleTopMargin;

    largeCtx.fillStyle = '#c7c4b7';
    largeCtx.fillText(subtitle, subtitleX, subtitleY);

    // Below Subtitle (under the grid)
    const belowSubtitleY = gridY + 900 + 60; // Positioned below the grid with padding

    largeCtx.font = `bold 36px Roboto`;
    const belowSubtitleWidth = largeCtx.measureText(belowSubtitle).width;
    const belowSubtitleX = (1080 - belowSubtitleWidth) / 2;

    largeCtx.fillStyle = '#c7c4b7'; // Slightly lighter gray for below subtitle
    largeCtx.fillText(belowSubtitle, belowSubtitleX, belowSubtitleY);

    // Clip the image to cut the corners
    largeCtx.beginPath();
    largeCtx.moveTo(gridX + cornerRadius, gridY);
    largeCtx.lineTo(gridX + 900 - cornerRadius, gridY);
    largeCtx.quadraticCurveTo(gridX + 900, gridY, gridX + 900, gridY + cornerRadius);
    largeCtx.lineTo(gridX + 900, gridY + 900 - cornerRadius);
    largeCtx.quadraticCurveTo(gridX + 900, gridY + 900, gridX + 900 - cornerRadius, gridY + 900);
    largeCtx.lineTo(gridX + cornerRadius, gridY + 900);
    largeCtx.quadraticCurveTo(gridX, gridY + 900, gridX, gridY + 900 - cornerRadius);
    largeCtx.lineTo(gridX, gridY + cornerRadius);
    largeCtx.quadraticCurveTo(gridX, gridY, gridX + cornerRadius, gridY);
    largeCtx.closePath();
    largeCtx.clip();

    largeCtx.drawImage(canvas, centerX, centerY, 900, 900);

    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', 'attachment; filename=album-covers.png');

    largeCanvas.toBuffer((err, buffer) => {
      if (err) {
        console.error('Error generating image:', err);
        res.status(500).send('An error occurred while generating the image.');
        return;
      }
      res.send(buffer);
    });
  } catch (error) {
    console.error(error);
    return res.redirect('/');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at ${PRODUCTION ? 'https://recordsbooth.onrender.com' : `http://localhost:${PORT}`}`);
});

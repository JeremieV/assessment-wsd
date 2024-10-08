import express, { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { scrapeOdds } from './task1';

const app = express();
const port = 3000;

/**

(instructions in case github copilot wants to help)

Build a RESTful API that exposes an endpoint for scraping odds from a bookmaker site.
The API should have the following endpoint:
- POST /odds: Scrape odds for a given horse racing event from a bookmaker site. The request body should contain the following fields:
  - eventUrl (string): The URL of the sports event page on the bookmaker site. The
    API should implement authentication and authorization, so that only authenticated users can
    access the /odds endpoint. You can use an API token or any library of your choice.

*/

const JWT_SECRET = "your_secret_key"; // Keep this secret in environment variables for production
const JWT_EXPIRATION = "1h";         // Token expiration time

// middleware to parse the request body as JSON
app.use(express.json());

const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  // Extract the token from the Authorization header ("Bearer XXXXXXXXXXXXX")
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // 401 Unauthorized response is appropriate when the client is not authenticated
    return res.sendStatus(401).send({ error: 'The client is unauthenticated' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      console.error(err);
      return res.sendStatus(403); // Forbidden
    }
    // req.user = user; // Attach user info to the request
    next();
  });
};

app.post('/login', (req: Request, res: Response) => {
  if (!req.body) {
    return res.status(400).send({ error: 'Missing request body' });
  }
  if (!req.body.username) {
    return res.status(400).send({ error: 'Missing username field' });
  }
  // For demo purposes, this will create a token for any user
  // In a real-world scenario, you would validate the user credentials 
  // based on a database and generate a token only for authenticated users
  const user = { username: req?.body.username };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
  res.json({ token });
});

app.post('/odds', authenticateToken, async (req: Request, res: Response) => {
  if (!req.body) {
    return res.status(400).send({ error: 'Missing request body' });
  }
  if (!req.body.eventUrl) {
    return res.status(400).send({ error: 'Missing eventUrl query parameter' });
  }
  if (typeof (req.body.eventUrl) !== 'string') {
    return res.status(400).send({ error: 'eventUrl expected to be a string' });
  }

  const odds = await scrapeOdds(req.body.eventUrl);

  if (odds.error) {
    return res.status(400).send({ error: odds.error });
  }

  return res.json(odds.result);
});

// if (require.main === module) {
// }
const server = app.listen(port, () => {
  console.log(`API being served on port ${port}`);
});

export default server;

// ---- APPENDIX: unsuccessful attempt at using cheerio ----

// try {
//   // Fetch the HTML content of the page
//   const { data: html } = await axios.get(req.body.eventUrl);

//   // Load the HTML into cheerio
//   const $ = load(html);

//   // Define the selector as per Puppeteer code
//   const rowsSelector = 'div.KambiBC-racing-participant-outcome-container';

//   // Wait for the elements to be available (Cheerio doesn't need to wait like Puppeteer)
//   const elements = $(rowsSelector);

//   if (!elements.length) {
//     throw new Error('No rows found');
//   }

//   // Extract horses' data
//   const horses: { name: string; odds: string; }[] = [];
//   elements.each((index, element) => {
//     const name = $(element).find('div.KambiBC-racing-participant__name span').text().trim();
//     const odds = $(element).find('div.KambiBC-racing-outcome-list button:first-of-type div.sc-kAyceB.gIMtGL').text().trim();

//     if (!name) {
//       throw new Error(`Name not found on row ${index}`);
//     }
//     if (!odds) {
//       throw new Error(`Odds not found for horse ${name} on row ${index}`);
//     }

//     horses.push({ name, odds });
//   });

//   // Return the results as a JSON response
//   return res.json({
//     eventUrl: req.body.eventUrl,
//     horses,
//   });
// } catch (error: any) {
//   // Handle errors
//   console.error(error.message);
//   return res.status(500).send({ error: error.message });
// }
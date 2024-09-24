import puppeteer from 'puppeteer';

// Write a Node.js program using Puppeteer to scrape odds for a given horse racing event
// from a bookmaker site. The script should take in the following parameters:
// - eventUrl (string): The URL of the horse racing event page on the bookmaker site.
// 
// The script should use Puppeteer to navigate to the event page, scrape the horse name
// and odds for the event from the bookmaker site, and return them in a JSON format.

interface Output {
  eventUrl: string;
  horses: {
    name: string;
    /** Odds are in fractional form: "x/y" (e.g. 2/1) */
    odds: string;
  }[]
}

async function scrapeOdds(eventUrl: string): Promise<Output> {
  // Launch the browser, open a new blank page and navigate to the event URL
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(eventUrl);
  await page.setViewport({ width: 1080, height: 1024 });

  const rowsSelector = `div.KambiBC-racing-participant-outcome-container`;

  // Wait for the rows to be loaded. There is a 30 seconds default timeout
  await page.waitForSelector(rowsSelector)

  const horses = await page.$$eval(rowsSelector,
    elements => {
      return elements.map((element, index) => {
        const name = element.querySelector('div.KambiBC-racing-participant__name span')?.textContent;
        if (!name) {
          throw new Error(`Name not found on row ${index}`);
        }
        const odds = element.querySelector('div.KambiBC-racing-outcome-list button:first-of-type div.sc-kAyceB.gIMtGL')?.textContent;
        if (!odds) {
          throw new Error(`Odds not found for horse ${name} on row ${index}`);
        }
        return { name, odds };
      });
    });

  if (!horses) {
    throw new Error('No horses found');
  }

  await browser.close();

  return {
    eventUrl,
    horses
  }
};

async function main() {
  // validate the command line arguments
  if (process.argv.length !== 3) {
    console.error('Usage: node index.js <eventUrl>');
    process.exit(1);
  }
  
  // validate URL
  const url = process.argv[2];
  try {
    // will throw if the URL is invalid
    new URL(url);
  } catch {
    console.error(`Invalid URL: ${url}`);
    process.exit(1);
  }
  // ensure that the URL is a betmgm.co.uk URL
  if (!(new URL(url).hostname === 'www.betmgm.co.uk')) {
    throw new Error('Invalid URL: must be a betmgm.co.uk URL');
  }

  // run the main function (puppeteer)
  const odds = await scrapeOdds(url)
  console.log(odds);
}

main();
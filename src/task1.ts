import puppeteer, { Browser } from 'puppeteer';


// (instructions in case github copilot wants to help)
// 
// Write a Node.js program using Puppeteer to scrape odds for a given horse racing event
// from a bookmaker site. The script should take in the following parameters:
// - eventUrl (string): The URL of the horse racing event page on the bookmaker site.
// 
// The script should use Puppeteer to navigate to the event page, scrape the horse name
// and odds for the event from the bookmaker site, and return them in a JSON format.

interface Output {
  result?: {
    eventUrl: string;
    horses: {
      name: string;
      /** Odds are in fractional form: "x/y" (e.g. 2/1) */
      odds: string;
    }[];
  }
  error?: string;
}

let browser: Browser | null = null;

export async function scrapeOdds(eventUrl: string): Promise<Output> {
  try {
    // will throw if the URL is invalid
    new URL(eventUrl);
  } catch {
    return { error: `Invalid URL: ${eventUrl}` };
  }

  // ensure that the URL is a betmgm.co.uk URL
  if (!(new URL(eventUrl).hostname === 'www.betmgm.co.uk')) {
    return { error: 'Invalid URL: must be a www.betmgm.co.uk URL' };
  }

  // Launch the browser, open a new blank page and navigate to the event URL
  if (browser === null) browser = await puppeteer.launch();

  const page = await browser.newPage();
  await page.goto(eventUrl);
  await page.setViewport({ width: 1080, height: 1024 });

  const rowsSelector = `div.KambiBC-racing-participant-outcome-container`;

  try {
    // Wait for the rows to be loaded. There is a 30 seconds default timeout
    await page.waitForSelector(rowsSelector);
  } catch (error) {
    return { error: 'Timeout error. Rows not found. This may happen for past events. Please make sure to input a future event.' };
  }

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
    return { error: 'No horses found' };
  }

  await page.close();

  return {
    result: {
      eventUrl,
      horses
    }
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

  // run the main function (puppeteer)
  const odds = await scrapeOdds(url);
  console.log(odds.result ?? odds.error);

  // close the browser and exit the process
  await closeBrowser();
  process.exit(0);
}

async function closeBrowser() {
  return await browser?.close();
}

// Clean up the resources when the script is terminated
// Register exit handlers to close browser on process termination
process.on('exit', async () => {
  console.log('Process exiting.');
  // async logic is not guaranteed to run before the process exits
  // care has to be taken to ensure that the browser is closed before the process exits
  // this next line will not run in most cases...
  await closeBrowser();
});

process.on('SIGINT', async () => {
  console.log('SIGINT received.');
  await closeBrowser();
  process.exit(0); // Ensure the process exits after cleaning up
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received.');
  await closeBrowser();
  process.exit(0);
});

process.on('uncaughtException', async (err) => {
  console.error('Uncaught Exception:', err);
  await closeBrowser();
  process.exit(1);
});

// if the script is being run directly, call the main function
if (require.main === module) {
  main();
}
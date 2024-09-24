# White Swan Data Node Assessment

To run the code, do:

```sh

```

## Setup

Setup I did right at the start:

```sh
npm init # create a new npm project
npm i puppeteer # install puppeteer
npm install typescript ts-node @types/node --save-dev # install typescript
npx tsc --init # setup typescript

git init
# then created .gitignore and added node_modules
```

## Task 1

I checked the first three bookmakers at the [provided link](https://www.telegraph.co.uk/betting/sports-guides/best-betting-sites-uk/) and chose bet365.com somewhat arbitrarily but also because the interface looked clean and regular.

I have no experience using puppeteer but I am very familiar with playwright, so I need to read the documentation a little bit.

It took me some time to explore puppeteer and the different bookmakers, but i ended up settling on betmgm.co.uk because it seemed to have the easiest markup to work with.

If we look at an example URL:

https://www.betmgm.co.uk/sports\#racing/event/1021685425

We see that the UI is made up of rows that contain horse name and fractional odds, among other things. We want to extract each row separately, and then from each row select the name and the odds, so that they do not get scrambled.

A row is a div with the class `KambiBC-racing-participant-outcome-container`. We can then query the rows by using the following query selector:

```
div.KambiBC-racing-participant-outcome-container
```

Importantly, before we do so, we need to wait for the page to load. We can wait for the above selector. There is a 30 seconds default timeout.

```js
await page.waitForSelector(rowsSelector)
```

We can then select all the rows and extract the name and available odds using puppeteer. Notice that the bookmaker I have chosen does not display the odds other than the UK, Australia and South Africa.

If the country is none of the above, then the only odds displayed are 'SP' ("Starting Price"). In this case, my puppeteer script returns 'SP'. This can be easily changed depending on the desired behaviour (unspecified in the instructions).

Another edge case to take into account is for events that have already finished. In this case, the bookmaker site uses a slightly different markup, and my script times out. For a production application this case should certainly be handled.

## Task 2

I installed express and chose to keep the application scaffold simple for this simple app (so I didn't use the `express-generator` which can generate a default application scaffold).

Instead I intead to create the server in a single file to keep it simple.

Running puppeteer (a headless browser) on the server would certainly be too resource intensive so instead I intend to scrape the bookmakers using axios and cheerios.

```sh
npm i express axios cheerio
```

For the `/odds` endpoint I asked ChatGPT to translate my puppeteer code into code that uses axios and cheerios. 

Huh... funnily, the endpoint fails to fetch the data from the webpage. Cheerios is not a web browser, it does not render the page or run client side javascript. This turns out to be the source of my error: if I disable javascript in the browser, the desired data does not load. I think this is the case for all the big bookmakers, because I saw loading indicators on all of them (indicating hydration).

Honestly, I should have thought of this beforehand. But I will blame it on my limited scraping experience 😇. 

So it turns out we will need to run puppeteer on the server in the end... the assignment makes more sense now.

```sh
npm uninstall cheerio
```

It is simply a matter of calling the scrapeOdds function from the `/odds` api endpoint, so that's easy.

### An important optimisation

However I'm immediately thinking that launching a new headless browser for each request is not very effective... so I moved the browser to a global variable, which gets instantiated only once during the execution of the server.

```js
let browser: Browser | null = null;

export async function scrapeOdds(eventUrl: string): Promise<Output> {
  // Launch the browser, open a new blank page and navigate to the event URL
  if (browser === null) browser = await puppeteer.launch();
  ...
```

Then we need to close the browser properly when the process exits, to not leave resources hanging.

Inside `scrapeOdds`, we now simply open a new page and close it at the end of the function, which is much faster than initializing a new browser each time.

On my machine, we go from ~5.8s to ~2.8s on each api call (except the first one) thanks to this optimisation.

### Implementing the authentication and authorization

### One last thing... testing!

- TODO catch the timeout errors which make the process exit
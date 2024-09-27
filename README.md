# White Swan Data Node Assessment

## Instructions for running the code

To run the code, do the following:

### Task 1: scraping

Replace `<url>` by a url of a **future** horse racing event from btemgm.co.uk.

A url should look like https://www.betmgm.co.uk/sports\#racing/event/1021685454 , but with a future event id.

```sh
npm run script -- <url>
```

The result of the execution will be printed to the console.

### Task 2: API

Run the server like so:

```sh
npm run server
```

The api serves requests on `localhost:3000`

There are 2 API endpoints:

POST `/login`:
- you need to authenticate with this endpoint to retrieve a JWT before being able to fetch the odds.
- the body of the request should be a JSON object of the type `{ username: string }`
- the username does not matter, for this example all usernames are valid and the response will be a JSON object of type `{ token: string }`
- the token has to be used in order to gain access to the `/odds` endpoint

POST `/odds`:
- has to be queried with the `authorization` header set to the value `Bearer <token>` where `<token>` is replace by the one obtained from the `/login` endpoint.
- the JSON body of the request should be an object of type `{ eventUrl: string }` where the string is a future horse racing event.
- returns an object of type `{ eventUrl: string, horses: { name: string, odds: string }[] }`

In case of errors, both endpoints will return an error code with a JSON body of type `{ error: string }` detailing the error.

I used Postman for sending the requests during development. For quickly testing the endpoints, you can use the following commands:

```sh
# retrieving the JWT token
curl -X POST localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{ "username": "exampleUser" }'

# fill these two based on the previous request and the url you would like to scrape
export token="<token from previous request>"
export url="https://www.betmgm.co.uk/sports#racing/event/1021707893"

# fetching the odds
curl -X POST localhost:3000/odds \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $token" \
  -d "{ \"eventUrl\": \"$url\" }"
```

### Running the tests

**Before running the tests is necessary to input correct URLs based on the current time, or the tests might not work correctly.**

This is done by changing the first two constants at the top of the `src/all.test.ts` file: `futureEvent` and `pastEvent`. Fill them with a url for an event that hasn't happened, and an event that has already happened, respectively.

You can then run the tests by using:

```sh
npm run test
```

### Running in a container

I tried containerising the app but I could not get it to work. This is to show how it would have worked. You can safely ignore this subsection.

```sh
docker build -t scraper . # build the image
docker run -i --init --rm --cap-add=SYS_ADMIN scraper node dist/task1.js https://www.betmgm.co.uk/sports\#racing/event/1021685454 # task 1
docker run -p 3000:3000 scraper # task 2
docker run scraper jest dist # tests
```

---

The rest of this file is a walk through of how I approached the task.

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

I checked the first three bookmakers at the [provided link](https://www.telegraph.co.uk/betting/sports-guides/best-betting-sites-uk/).

It took me some time to explore puppeteer and the different bookmakers, but i ended up settling on betmgm.co.uk because it seemed to have the easiest markup to work with.

If we look at an example URL:

`https://www.betmgm.co.uk/sports#racing/event/1021685425`

We see that the UI is made up of rows that contain horse name and fractional odds, among other things. We want to extract each row separately, and then from each row select the name and the odds, so that we are sure that the odds correspond to that horse name.

A row is a div with the class `KambiBC-racing-participant-outcome-container`. We can then query the rows by using the following query selector:

```css
div.KambiBC-racing-participant-outcome-container
```

Importantly, before we do so, we need to wait for the page to load. We can wait for the above selector. There is a 30 seconds default timeout.

```js
await page.waitForSelector(rowsSelector)
```

We can then select all the rows and extract the name and available odds using puppeteer. Notice that the bookmaker I have chosen does not usually display the odds other than the UK, Australia and South Africa.

If the country is none of the above, then the only odds displayed are 'SP' ("Starting Price"). In this case, my puppeteer script returns 'SP'. This can be easily changed depending on the desired behaviour (unspecified in the instructions).

Another edge case to take into account is for events that have already finished. In this case, the bookmaker site uses a slightly different markup, and my script returns an error. I assume this is an acceptable constraint: "we can only scrape future events".

## Task 2

I installed express and chose to keep the application scaffold simple for this simple app (so I didn't use the `express-generator` which can generate a default application scaffold).

Instead I intend to create the server in a single file to keep it simple.

Running puppeteer (a headless browser) on the server would certainly be too resource intensive so instead I intend to scrape the bookmakers using axios and cheerios.

```sh
npm i express axios cheerio
```

For the `/odds` endpoint I asked ChatGPT to translate my puppeteer code into code that uses axios and cheerios. 

Huh... funnily, the endpoint fails to fetch the data from the webpage. Cheerios is not a web browser, it does not render the page or run client side javascript. This turns out to be the source of my error: if I disable javascript in the browser, the desired data does not load. I think this is the case for all the big bookmakers, because I saw loading indicators on all of them (indicating hydration).

Honestly, I should have thought of this beforehand. But I will blame it on my limited scraping experience...

So it turns out we will need to run puppeteer on the server in the end... the assignment makes more sense now.

```sh
npm uninstall axios cheerio
```

It is simply a matter of calling the scrapeOdds function from the `/odds` api endpoint, so that's easy.

### An important optimisation

However I'm immediately thinking that launching a new headless browser for each request is not very effective... so I moved the browser object to a global variable, which gets instantiated only once during the execution of the server.

```js
let browser: Browser | null = null;

export async function scrapeOdds(eventUrl: string): Promise<Output> {
  // Launch the browser, open a new blank page and navigate to the event URL
  if (browser === null) browser = await puppeteer.launch();
  ...
```

Then we need to close the browser properly when the process exits, to not leave resources hanging:

```js
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
```

Inside `scrapeOdds`, we now simply open a new page and close it at the end of the function, which is much faster than initializing a new browser each time.

On my machine, we go from ~5.8s to ~2.8s on each api call (except the first one) thanks to this optimisation. We still need to wait for the webpage to load so we certainly can't do much better.

### Implementing the authentication and authorization

I will use JWT tokens for the authentication and authorization. They are stateless and scalable but there is no easy way to revoke them once issued.

The `/login` endpoint hands JWT tokens to users. The JWT tokens are set to expire within 1h.

In the real world you would check that the user exists in the database and that the provided password is correct:

```js
// something like that
const validPassword = bcrypt.compareSync(database_password, request_password);
```

JWT is appropriate when tokens need to be stored client-side, such as in local storage or cookies, and sent with every request.

However this API is likely to be consumed by another server proces in the real world.

So an API such as this one should probably be authenticated by a per-user API token generated randomly for every account and stored in the database.

But implementing this is trivial and not easy to showcase without a database. So I have decided to go for JWT.

Once the token is retrieved from the `/login` endpoint, it can be used in the authorisation header in the form of `Bearer <token>` to gain access to the `/odds` endpoint.

### Testing

I have created some unit tests for the API. I will make sure it doesn't respond to unauthorized requests, and that it returns the odds correctly.

```sh
npm i jest @types/jest supertest @types/supertest
```

Please refer to the `src/all.test.ts` file for more details.

### Containerising

I wanted to containerise the app to make the builds reproducible.

I went for the official puppeteer image because I can foresee the many different dependencies and steps needed in order to make puppeteer work inside a container.

However I get the following error when I run my docker container:

```
Uncaught Exception: Error: Could not find Chrome (ver. 129.0.6668.58). This can occur if either
 1. you did not perform an installation before running the script (e.g. `npx puppeteer browsers install ${browserType}`) or
 2. your cache path is incorrectly configured (which is: /home/pptruser/.cache/puppeteer).
For (2), check out our guide on configuring puppeteer at https://pptr.dev/guides/configuration.
    at ChromeLauncher.resolveExecutablePath (/usr/src/app/node_modules/puppeteer-core/lib/cjs/puppeteer/node/BrowserLauncher.js:292:27)
    at ChromeLauncher.executablePath (/usr/src/app/node_modules/puppeteer-core/lib/cjs/puppeteer/node/ChromeLauncher.js:209:25)
    at ChromeLauncher.computeLaunchArguments (/usr/src/app/node_modules/puppeteer-core/lib/cjs/puppeteer/node/ChromeLauncher.js:89:37)
    at async ChromeLauncher.launch (/usr/src/app/node_modules/puppeteer-core/lib/cjs/puppeteer/node/BrowserLauncher.js:71:28)
```

I have tried everything and I still can't get it to work. So I decided to give up. I hope that's alright!

Among other things I have tried aliasing `chrome`, remove and reinstall puppeteer during the build (recommended online), setting environment the path to the correct value using environment variables, and more.

## Conclusion

There are limitations to the API I have built. For one, it can only scrape events in the future. For any events that have already passed, it will return an error code. I assumed this was acceptable for this minimal example, although depending on the use case previous events' odds could be useful.

For some events, such as events in the "international" category, the odds aren't usually availale on the bookmaker site and my script returns "SP" in place of all the odds. I also assumed this was acceptable behaviour.

My script may also return "SP" for some grayed out horses, at the end of the list. For some others the odds may still be scraped although they do not appear on the screen. I didn't know what to make of this.

I may have made mistakes due to my ignorance of betting... my script works for the events in "meetings", not "Specials & Ante Post". What is the difference? On the job I would gather some more domain knowledge.

There are certainly things about the code that could be improved. One thing I'm not happy about is that the API requests and responses aren't very strictly typed. Another thing is that I'm sure there are better ways to validate the request bodies.

I am conscious that there could be improvements, but I know I would learn all of the best practices and your team's preferences very quickly on the job. I haven't written APIs like this in a long time, but I am quite conscientious and can adhere to conventions. All this to say I could write very clean, typed API endpoints in no time!
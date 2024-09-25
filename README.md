# White Swan Data Node Assessment

## Running the 

To run the code, do:

```sh
# run task 1
# run task 2
# run tests

# run in a docker container
```

The following is a walk through of how I approached the task.

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

`https://www.betmgm.co.uk/sports#racing/event/1021685425`

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

---

Once the token is retrieved from the `/login` endpoint, it can be used in the authorisation header in the form of `Bearer <token>` to gain access to the `/odds` endpoint.

### One last thing... testing!

I'll create some unit tests for the API. Make sure it doesn't respond to unauthorized requests, and that it returns the odds correctly.

```sh
npm i jest @types/jest supertest @types/supertest
``` 

The tests depend on a URL of an event in the future, one in the past, and an international event (that does not display any odds). They are declared as constants at the top of the `all.test.ts` file. It is necessary to manually input the correct URLs based on the current time, or the tests might not work correctly.

### Another last thing... containers

Let's containerise the app in order to create a reproducible environment. It's also most likely what you'd do to deploy the app.

## Conclusion

There are limitations to the API I have built. For one, it can only scrape events in the future. For any events that have already passed, it will return an error code. I assumed this was acceptable for this minimal example, although depending on the use case passed event odds could be useful.

For some events, such as events happening in France, for example, the odds aren't availale on the bookmaker and my script returns "SP" in place of all the odds. I also assumed this was acceptable behaviour.

I may have made other mistakes due to my ignorance of betting... my script works for the events in "meetings", not "Specials & Ante Post". What is the difference? On the job I would gather some more knowledge on the domain.

There are certainly things that could be improved. One thing I'm not happy about is that the API requests and responses aren't very strictly typed. Another thing is that I'm sure there are better ways to validate the request bodies.

I am conscious that there could be improvements, but I know I would learn all of the best practices and your team's preferences very quickly on the job. I haven't written APIs like these in a long time, but I am quite conscientious and can adhere to conventions. All this to say I could write very clean, typed API endpoints in no time.
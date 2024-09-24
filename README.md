# White Swan Data Node Assessment

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

It took me some time to explore puppeteer and the different bookmakers, but i ended up settling on betmgm.co.uk because it had the easiest markup to work with in my opinion.

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
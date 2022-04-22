const puppeteer = require('puppeteer');
const Album = require("./Album");

let browser, page;

/**
 * Opens the browser and navigates to the pitchfork page
 * If it has an ad overlay, tries to close it 
 */
async function setupBrowserAndPage() {
    browser = await puppeteer.launch({ headless: false });
    page = await browser.newPage();
    page.setJavaScriptEnabled(false);

    console.log("[Puppeteer] up and running");
}

async function getProperty(element, property) {
    return await (await element.getProperty(property)).jsonValue();
}

/**
 * Tries to find the link to the artist
 * @param {String} artist 
 * @returns {String} link to the artist page
 */
async function searchArtist(artist) {

    await page.goto("https://pitchfork.com/search/");

    console.log("\nsearching artist", artist);

    // Searches the artist
    const inputPath = "#empty-search-header > div > div > div > div > div > form > input";
    await page.type(inputPath, `${artist}`);
    await page.keyboard.press("Enter");

    const artistsResults = await page.waitForSelector("#result-artists");

    // If the search had one or more results, find the artist
    // among the results
    if (artistsResults) {

        const frame = page.mainFrame();
        const results = await frame.$$('#result-artists ul li a');

        let singleResult;

        for (let index = 0; index < results.length; index++) {

            const spanText = await results[index].$eval('span', el => el.textContent);

            if (spanText.toLowerCase() === artist.toLowerCase()) {
                singleResult = await getProperty(results[index], "href");
                break;
            }
        }
        return singleResult;
    }

    throw Error("Couldn't find specified artist");
}

/**
 * Tries to find the album review link
 * @param {String} artistLink 
 * @param {String} album album name 
 * @returns {String} link to the album review page
 */
async function searchAlbum(artistLink, album) {
    // Navigates to the artist page
    await page.goto(artistLink + "albumreviews");

    console.log("searching album", album);

    const albumReviews = await page.waitForSelector("#result-albumreviews");

    // If the search had one or more results, find the album
    // among the results
    if (albumReviews) {
        const frame = page.mainFrame();
        const links = await frame.$$('#result-albumreviews ul li a');
        const titles = await frame.$$('#result-albumreviews ul li a .review__title-album');

        let singleResult;

        for (let index = 0; index < titles.length; index++) {
            const currentTitle = await getProperty(titles[index], "innerText");

            if (currentTitle.toLowerCase() === album.toLowerCase()) {
                singleResult = await getProperty(links[index], "href");
                break;
            }
        }

        return singleResult;
    }

    throw Error("Couldn't find specified album");
}

/**
 * Gets the album score given by pitchfork
 * @param {String} albumLink 
 * @returns {Number | null} album score
 */
async function getAlbumScore(albumLink) {

    // Navigates to the album page
    await page.goto(albumLink);

    // Gets the div that wraps the album cover and score
    const generalDiv = await page.waitForXPath("/html/body/div[1]/div/main/article/div[1]/header/div[1]/div[2]/div");

    // Gets the paragraphs that are contained in that div
    const paragraphs = await generalDiv.$$("p");

    // If the section has paragraphs, get the first one (that is the score) and return it
    if (paragraphs) {
        let score = await getProperty(paragraphs[0], "innerText");
        return Number(score);
    }

    return;
}

async function scrape() {

    const albums = [
        new Album("lorde", "melodrama"),
        new Album("david bowie", "blackstar"),
        new Album("paramore", "after laughter")
    ]

    await setupBrowserAndPage();

    try {
        for (const album of albums) {
            const artistLink = await searchArtist(album.artist);

            if (artistLink) {
                const albumReviewLink = await searchAlbum(artistLink, album.albumName);

                if (albumReviewLink) {
                    const score = await getAlbumScore(albumReviewLink);

                    console.log(`${album.albumName} scored: ${score}`);
                }
            }
        }
    } catch (error) {
        console.log(error);
    }
}
scrape();
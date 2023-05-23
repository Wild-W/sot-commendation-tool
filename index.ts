import axios from "axios";
import cheerio, { AnyNode, Cheerio } from "cheerio";
import fs from "fs";
import { exit } from "process";
import { JSDOM } from 'jsdom';

const MS_DELAY = 300;

type Commendation = {
    name: string,
    imageUrl: string,
    rewards: Rewards,
    description: string,
    gradeRequirements: string[],
    timeLimited: boolean,
};

type Rewards = {
    html: string,
    items: RewardItem[],
    doubloons: number,
};

type RewardItem = {
    name: string,
    imageUrl: string,
    wikiPageUrl: string,
};


function cleanText(text: string) {
    return text.trim().replace(/\s+/g, " ");
}

const gradeRegex = /Grade [IV]{1,3}: /g;
const noteRegex = / Note:/;

function parseDescription(desc: string): [string, boolean] {
    desc = desc.replace(noteRegex, "\nNote:");

    let timeLimited = desc.includes("Time-limited");

    if (timeLimited) {
        desc = desc.replace("Time-limited", "");
    }
    desc = desc.replace(gradeRegex, "");

    const textSegments = desc.split("  ");

    return [textSegments[0], timeLimited];
}

function getHyperLink<T extends AnyNode>(el: Cheerio<T>): string {
    return (el.attr() as { href?: string })?.href ?? "";
}

function fullLink(link: string): string {
    return "https://seaofthieves.wiki.gg" + link;
}

const idFromPageUrl = (webPage: string): string => {
    const id = webPage.match(/(?<=#).+/);

    if (id == null) {
        console.error({ webPage, id });
        exit();
    }

    return id[0];
}

const timer = async (ms: number) => {
    return new Promise(res => setTimeout(res, ms));
};

const cleanImageUrl = (link: string) => link.replace(/\?cb=\d+/, "");

async function getImageLink(webPage: string): Promise<string> {
    console.log(webPage);
    return axios.get(webPage)
        .then(async response => {
            const $ = cheerio.load(response.data);

            if (webPage.startsWith("https://seaofthieves.wiki.gg/wiki/Achievements")) {
                const id = idFromPageUrl(webPage);
                await timer(MS_DELAY);

                return getImageLink(fullLink(getHyperLink($($(`span#${id.replace("?", "\\?")}.mw-headline`).parent().parent().parent()
                    .children("div.floatleft").children("a.image").get(0)))));
            }
            if (webPage.startsWith("https://seaofthieves.wiki.gg/wiki/Titles")) {
                const id = idFromPageUrl(webPage);
                await timer(MS_DELAY);

                return getImageLink(fullLink(`/wiki/File:${id.replace("'", "%27")}_emblem.png`));
            }
            if (webPage.startsWith("https://seaofthieves.wiki.gg/wiki/File:")) {
                return fullLink(getHyperLink($($("div#file.fullImageLink").children("a").get(0))));
            }
            return fullLink(getHyperLink($("a.image.image-thumbnail")));
        }).catch(err =>{
            console.error(err);
            exit();
        });
}

function processImgHTML(htmlString: string): string {
	const { document } = new JSDOM(htmlString).window;
	const images = document.getElementsByTagName('img');
  
	for (const img of images) {
	  	if (img.hasAttribute('data-src')) {
			img.removeAttribute('src');
			img.removeAttribute('style');
			img.setAttribute('src', img.getAttribute('data-src') ?? "");
			img.removeAttribute('data-src');
	  	}
	}
  
	return document.body.innerHTML
		.replace(/<a href="\//g, "<a href=\"https://seaofthieves.wiki.gg/")
		.replace(/\/revision\/latest(\/scale\-to\-width\-down\/24){0,1}\?cb=\d+/g, "");
}

const notRewards = [
    "Athena%27s_Fortune_Shop",
    "Ship_Customisation_Chest",
    "Ship_Customization_Chest",
    "Shipwright_Shop",
    "Vanity_Chest",
    "Clothing_Chest"
];

let commendations: Commendation[] = [];

(async () => {
    const webString = await axios.get("https://seaofthieves.wiki.gg/wiki/Commendations");
    const $ = cheerio.load(webString.data);

    const tableArr = $("div.mw-parser-output").find("table").toArray();
    for (let index = 0; index < tableArr.length; index++) {
        const trArr = $(tableArr[index]).find("tr").toArray();
        for (let idx = 1 /* First row is useless */; idx < trArr.length; idx++) {
            const row = $(trArr[idx]);

            const thCells = row.find("th");
            const tdCells = row.find("td");
            const nameCell = $(thCells.get(1));
            const requirementCell = $(tdCells.get(0));
            const rewardsCell = $(tdCells.get(1));
            const descriptionInfo = cleanText(requirementCell.text());

            // const id: string = (nameCell.attr() as { id: string }).id;
            const name: string = cleanText(nameCell.text());
            const imageUrl: string = cleanImageUrl(getHyperLink($(thCells.children("div.thumb-frame.pseudo-before").children("a.image").get(0))));
            const [description, timeLimited] = parseDescription(cleanText(descriptionInfo));
            const gradeRequirements = $($(requirementCell.children("div.mw-collapsible mw-made-collapsible")
                .children("div.mw-collapsible-content").children("ul").get(0)).children("li"))
                .toArray().map(el => $(el).text().replace(gradeRegex, ""));

            let doubloonStr = rewardsCell.find("span.coin").text();

            let rewards: Rewards = {
                html: processImgHTML(rewardsCell.html() ?? ""),
                doubloons: Number(doubloonStr.substring(0, doubloonStr.length - 1)) || 0,
                items: []
            };
            let rewardLinks = rewardsCell.find("a").toArray();

            for (let i = 0; i < rewardLinks.length; i++){
                const element = $(rewardLinks[i]);
                const text = element.text();

                if (text !== "") {
                    const shortLink = getHyperLink(element);
                    
                    if (notRewards.includes(shortLink.substring(6))) continue;

                    const link = fullLink(shortLink);
                    const imgUrl = await getImageLink(link);
                    const name = cleanText(text);

                    rewards.items.push({
                        name,
                        imageUrl: cleanImageUrl(imgUrl),
                        wikiPageUrl: link,
                    });
                }
            };

            commendations.push({
                description,
                gradeRequirements,
                imageUrl: fullLink(imageUrl),
                name,
                rewards,
                timeLimited,
            });
        }
        
        fs.writeFileSync("./output.json", JSON.stringify(commendations));
    }
})();

"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const cheerio_1 = __importDefault(require("cheerio"));
const fs_1 = __importDefault(require("fs"));
const process_1 = require("process");
const jsdom_1 = require("jsdom");
const MS_DELAY = 300;
function cleanText(text) {
    return text.trim().replace(/\s+/g, " ");
}
const gradeRegex = /Grade [IV]{1,3}: /g;
const noteRegex = / Note:/;
function parseDescription(desc) {
    desc = desc.replace(noteRegex, "\nNote:");
    let timeLimited = desc.includes("Time-limited");
    if (timeLimited) {
        desc = desc.replace("Time-limited", "");
    }
    desc = desc.replace(gradeRegex, "");
    const textSegments = desc.split("  ");
    return [textSegments[0], timeLimited];
}
function getHyperLink(el) {
    var _a, _b;
    return (_b = (_a = el.attr()) === null || _a === void 0 ? void 0 : _a.href) !== null && _b !== void 0 ? _b : "";
}
function fullLink(link) {
    return "https://seaofthieves.wiki.gg" + link;
}
const idFromPageUrl = (webPage) => {
    const id = webPage.match(/(?<=#).+/);
    if (id == null) {
        console.error({ webPage, id });
        (0, process_1.exit)();
    }
    return id[0];
};
const timer = (ms) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise(res => setTimeout(res, ms));
});
const cleanImageUrl = (link) => link.replace(/\?cb=\d+/, "");
function getImageLink(webPage) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(webPage);
        return axios_1.default.get(webPage)
            .then((response) => __awaiter(this, void 0, void 0, function* () {
            const $ = cheerio_1.default.load(response.data);
            if (webPage.startsWith("https://seaofthieves.wiki.gg/wiki/Achievements")) {
                const id = idFromPageUrl(webPage);
                yield timer(MS_DELAY);
                return getImageLink(fullLink(getHyperLink($($(`span#${id.replace("?", "\\?")}.mw-headline`).parent().parent().parent()
                    .children("div.floatleft").children("a.image").get(0)))));
            }
            if (webPage.startsWith("https://seaofthieves.wiki.gg/wiki/Titles")) {
                const id = idFromPageUrl(webPage);
                yield timer(MS_DELAY);
                return getImageLink(fullLink(`/wiki/File:${id.replace("'", "%27")}_emblem.png`));
            }
            if (webPage.startsWith("https://seaofthieves.wiki.gg/wiki/File:")) {
                return fullLink(getHyperLink($($("div#file.fullImageLink").children("a").get(0))));
            }
            return fullLink(getHyperLink($("a.image.image-thumbnail")));
        })).catch(err => {
            console.error(err);
            (0, process_1.exit)();
        });
    });
}
function processImgHTML(htmlString) {
    var _a;
    const { document } = new jsdom_1.JSDOM(htmlString).window;
    const images = document.getElementsByTagName('img');
    for (const img of images) {
        if (img.hasAttribute('data-src')) {
            img.removeAttribute('src');
            img.removeAttribute('style');
            img.setAttribute('src', (_a = img.getAttribute('data-src')) !== null && _a !== void 0 ? _a : "");
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
let commendations = [];
(() => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const webString = yield axios_1.default.get("https://seaofthieves.wiki.gg/wiki/Commendations");
    const $ = cheerio_1.default.load(webString.data);
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
            const name = cleanText(nameCell.text());
            const imageUrl = cleanImageUrl(getHyperLink($(thCells.children("div.thumb-frame.pseudo-before").children("a.image").get(0))));
            const [description, timeLimited] = parseDescription(cleanText(descriptionInfo));
            const gradeRequirements = $($(requirementCell.children("div.mw-collapsible mw-made-collapsible")
                .children("div.mw-collapsible-content").children("ul").get(0)).children("li"))
                .toArray().map(el => $(el).text().replace(gradeRegex, ""));
            let doubloonStr = rewardsCell.find("span.coin").text();
            let rewards = {
                html: processImgHTML((_a = rewardsCell.html()) !== null && _a !== void 0 ? _a : ""),
                doubloons: Number(doubloonStr.substring(0, doubloonStr.length - 1)) || 0,
                items: []
            };
            let rewardLinks = rewardsCell.find("a").toArray();
            for (let i = 0; i < rewardLinks.length; i++) {
                const element = $(rewardLinks[i]);
                const text = element.text();
                if (text !== "") {
                    const shortLink = getHyperLink(element);
                    if (notRewards.includes(shortLink.substring(6)))
                        continue;
                    const link = fullLink(shortLink);
                    const imgUrl = yield getImageLink(link);
                    const name = cleanText(text);
                    rewards.items.push({
                        name,
                        imageUrl: cleanImageUrl(imgUrl),
                        wikiPageUrl: link,
                    });
                }
            }
            ;
            commendations.push({
                description,
                gradeRequirements,
                imageUrl: fullLink(imageUrl),
                name,
                rewards,
                timeLimited,
            });
        }
        fs_1.default.writeFileSync("./output.json", JSON.stringify(commendations));
    }
}))();

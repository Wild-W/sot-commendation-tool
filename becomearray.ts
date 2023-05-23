import fs from "fs";

const data = JSON.parse(fs.readFileSync("./output.json", {encoding: "utf-8", flag: "r"}));
let arr = [];

for (const v of Object.values(data)) {
    arr.push(v);
}

fs.writeFileSync("./output2.json", JSON.stringify(arr));
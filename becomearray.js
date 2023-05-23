"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const data = JSON.parse(fs_1.default.readFileSync("./output.json", { encoding: "utf-8", flag: "r" }));
let arr = [];
for (const v of Object.values(data)) {
    arr.push(v);
}
fs_1.default.writeFileSync("./output2.json", JSON.stringify(arr));

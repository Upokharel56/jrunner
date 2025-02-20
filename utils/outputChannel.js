const vscode = require("vscode");

const outputChannel = vscode.window.createOutputChannel('JRunner');


const terminal = vscode.window.createTerminal({ name: "JRunner Terminal" });

module.exports = {outputChannel, terminal};
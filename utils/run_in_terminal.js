const vscode = require('vscode');
const child_process = require('child_process');
const fs = require('fs');
const {outputChannel, terminal} = require("./outputChannel");

function terminalExists(cmd) {
    try {
        child_process.execSync(`command -v ${cmd}`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}



function getLinuxTerminalCommand(runCommand) {
    const linuxTerminals = [
        { name: 'gnome-terminal', cmd: `gnome-terminal -- bash -c '${runCommand}; echo; read -n 1 -s -r -p "Press any key to exit..."'` },
        { name: 'konsole', cmd: `konsole --noclose -e bash -c "${runCommand}; echo; read -n 1"` },
        { name: 'xfce4-terminal', cmd: `xfce4-terminal --hold -e "bash -c '${runCommand}; read -n 1'"` },
        { name: 'tilix', cmd: `tilix -e bash -c "${runCommand}; read -n 1"` },
        { name: 'xterm', cmd: `xterm -hold -e '${runCommand}'` },
        { name: 'lxterminal', cmd: `lxterminal -e "bash -c '${runCommand}; read -n 1'"` },
        { name: 'mate-terminal', cmd: `mate-terminal -- bash -c '${runCommand}; read -n 1'` },
        { name: 'terminator', cmd: `terminator -x bash -c "${runCommand}; read -n 1"` },
        { name: 'urxvt', cmd: `urxvt -e sh -c '${runCommand}; read -n 1'` },
        { name: 'st', cmd: `st -e sh -c '${runCommand}; read -n 1'` },
        { name: 'alacritty', cmd: `alacritty -e sh -c '${runCommand}; read -n 1'` }

    ];

    for (const terminal of linuxTerminals) {
        if (terminalExists(terminal.name)) {
            outputChannel.appendLine(`Using terminal: ${terminal.name}\n`);
            return terminal.cmd;
        }
    }

    //use x-terminal-emulator as fallback
    return `x-terminal-emulator -e 'bash -c "${runCommand}; read -n 1"'`;

}


function getTerminalCommand(runCommand) {
    const os = process.platform;
    outputChannel.appendLine(`Found OS: ${os}`);

    if (os === "win32") {
        return `start cmd.exe /k "${runCommand} & echo. & echo Press any key to continue... & pause"`;
    } else if (os === "darwin") {
        return `osascript -e 'tell application "Terminal" to do script "${runCommand}; echo; read -n 1 -s -r -p \\"Press any key to exit...\\""'`;
    }else if (os === "macos") {
        return `osascript -e 'tell application "Terminal" to do script "${runCommand}; echo; read -n 1 -s -r -p \\"Press any key to exit...\\""'`;
    }

    else if (os === "linux") {
        return getLinuxTerminalCommand(runCommand);
    } else {
        outputChannel.appendLine(`Unsupported OS: ${os} Use f7 to run the code in default terminal \n`);
       vscode.window.showErrorMessage(`Unsupported OS: ${os} Use f7 to run the code`);
    }
}


function run_in_external_terminal(runCommand) {
    let terminalCommand;
    try {
        terminalCommand = getTerminalCommand(runCommand);
    } catch (error) {
        vscode.window.showErrorMessage(error.message);
        return;
    }

    child_process.exec(terminalCommand, (error, stdout, stderr) => {
        if (error) {
                outputChannel.appendLine(`Error running the file in external terminal : ${stderr}\n Running in dedicated terminal : `);
                terminal.show();
                terminal.sendText(runCommand);
        }
    });
}

module.exports = { run_in_external_terminal };

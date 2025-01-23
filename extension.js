// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
/**
 * @param {vscode.ExtensionContext} context
 */
const vscode = require("vscode");
const child_process = require("child_process");
const fs = require("fs");
const path = require("path");


const outputChannel = vscode.window.createOutputChannel('JRunner');
let terminal

// ANSI escape codes for colors
const colors = {
    red: '[Error] ',
    green: '[Sucess] ',
    blue: '[Info] ',  
};

function output_color(message,color){
	outputChannel.appendLine(`${colors[color]}${message} \n`);
}

const errorRegex = /(.*?):(\d+): error: (.*)/g;

let decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 0, 0, 0.3)', // Red background
    isWholeLine: true,
});


function parseCompilationErrors(stderr) {
    const errors = [];
    const errorMap = {}; // Map to track line numbers and their aggregated errors
    let match;

    while ((match = errorRegex.exec(stderr)) !== null) {
        const filePath = match[1];
        const lineNumber = parseInt(match[2], 10) - 1; // Convert to zero-based index
        const newMessage = match[3];

        if (!errorMap[lineNumber]) {
            // First error for this line
            errorMap[lineNumber] = { filePath, lineNumber, message: newMessage };
        } else {
            // Append new message to existing message
            errorMap[lineNumber].message += ` && ${newMessage}`;
        }
    }

    // Convert the map values into an array of errors
    for (const line in errorMap) {
        errors.push(errorMap[line]);
    }

    return errors;
}

let activeDecorations = new Map(); // Track decorations by filePath and lineNumber


function highlightErrorsInEditor(errors) {
    const decorations = [];

    errors.forEach((error) => {
        const { filePath, lineNumber, message } = error;

        // Open the file in VS Code
        vscode.workspace.openTextDocument(filePath).then((doc) => {
            vscode.window.showTextDocument(doc).then((editor) => {
                const range = new vscode.Range(
                    new vscode.Position(lineNumber, 0),
                    new vscode.Position(lineNumber, doc.lineAt(lineNumber).text.length)
                );

                decorations.push({
                    range,
                    hoverMessage: {
                        value: `**Error**: ${message}`,
                        isTrusted: true,
                    },
                    renderOptions: {
                        after: {
                            contentText: ` 🔴 ${message}`,
                            color: 'red',
                            margin: '10px',
                        },
                    },
                });

                // Apply all decorations at once
                editor.setDecorations(decorationType, decorations);

				// Store the decoration to track it
                if (!activeDecorations.has(filePath)) {
                    activeDecorations.set(filePath, new Map());
                }
                activeDecorations.get(filePath).set(lineNumber, { editor, decorationType });


            });
        });
    });


	 // Listen for changes in the document
	 vscode.workspace.onDidChangeTextDocument((event) => {
        const filePath = event.document.fileName;

        if (activeDecorations.has(filePath)) {
            const lineNumbersToRemove = new Set();

            // Check if any line with a decoration was edited
            event.contentChanges.forEach((change) => {
                const startLine = change.range.start.line;
                const endLine = change.range.end.line;
                for (let line = startLine; line <= endLine; line++) {
                    if (activeDecorations.get(filePath).has(line)) {
                        lineNumbersToRemove.add(line);
                    }
                }
            });

            // Remove decorations for edited lines
            lineNumbersToRemove.forEach((lineNumber) => {
                const { editor, decorationType } = activeDecorations.get(filePath).get(lineNumber);
                editor.setDecorations(decorationType, []); // Clear decorations
                activeDecorations.get(filePath).delete(lineNumber);

                // Clean up if no decorations remain for the file
                if (activeDecorations.get(filePath).size === 0) {
                    activeDecorations.delete(filePath);
                }
            });
        }
    });




}





function activate(context) {

	// vscode.window.createQuickPick(vscode.QuickPickItemKind.Default)
	const runButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    runButton.text = `$(play) Run`;  // Play icon in the status bar
    runButton.tooltip = 'Run Java Program';
    runButton.command = 'jrunner.runJava'; // Command to run Java program
    runButton.show();

 

  const runJava = vscode.commands.registerCommand("jrunner.runJava", () => {
	let message;
	
	outputChannel.show()
    const editor = vscode.window.activeTextEditor;
	
    if (!editor) {
		message = "No active Java file to run!"
		output_color(message,"red")
      vscode.window.showErrorMessage(message);
      return;
    }

    const document = editor.document;

	if (document && document.isDirty){
		document.save();
	}


    if (document.languageId !== "java") {
		message = "This command is for Java files only!"
		output_color(message,"red")
      vscode.window.showErrorMessage(message);
      return;
    }

    const filePath = document.fileName;
	const className = path.basename(filePath, ".java");

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
		message = "No workspace folder is open."
		output_color(message,"red")
      vscode.window.showErrorMessage(message);
      return;
    }

    const projectRoot = workspaceFolders[0].uri.fsPath;

	// Ensure .output directory exists
	let outputDir = path.join(projectRoot, ".output");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Compile the Java file into .output
    const relativeFilePath = path.relative(projectRoot, filePath);
    // const targetClassDir = path.dirname(path.join(outputDir, relativeFilePath));
    // if (!fs.existsSync(targetClassDir)) {
    //   fs.mkdirSync(targetClassDir, { recursive: true });
    // }

    const compileCommand = `javac -d "${outputDir}" "${filePath}"`;
	output_color(`Java command geenerated : ${compileCommand} \n\n`,"green")
    
	child_process.exec(compileCommand, (error, stdout, stderr) => {
      if (error) {
		message = `Compilation Error: ${stderr}`
        // vscode.window.showErrorMessage(message);
		  // Parse errors from stderr
		  const errors = parseCompilationErrors(stderr);
		  if (errors.length > 0) {
			  highlightErrorsInEditor(errors);
		  }

		outputChannel.appendLine(message)
        return;
      }

	 output_color(`Compiled: ${filePath} -> ${outputDir} \n Running: ${className}.java \n`,"blue")

	// Determine the class name (package path)
	
      // Run the compiled class
      const runCommand = `java -cp "${outputDir}" "${className}"`;


	  console.log(`Generated information : \n 
		Filename : ${document.fileName}, 
		classNamee : ${className},
		compilleCommand: ${compileCommand}, 
		runCommand: ${runCommand}
		`)
		
		run_in_external_terminal(runCommand)
    //   const terminal = vscode.window.createTerminal({
    //     name: `${document.fileName}`,
    //     shellPath: process.platform === "win32" ? "cmd.exe" : "/bin/bash",
    //   });

	 


    //   terminal.show();
    //   terminal.sendText(runCommand);
    });
  });

  context.subscriptions.push(runButton);
  context.subscriptions.push(runJava);
}

function deactivate() {}

function run_in_external_terminal(runCommand){
	const os =process.platform;

	const terminalCommand = {
		"win32" : `cmd.exe /c "${runCommand} & echo. & echo Press any key to continue... & pause"`,
		"darwin" : `osascript -e 'tell application "Terminal" to do script "${runCommand} && echo && read -n 1 -s -r -p \\"Press any key to exit...\\""'`,
		"linux": `gnome-terminal -- bash -c '${runCommand} && echo && read -n 1 -s -r -p "\nPress any key to exit..."'`
	}[os];

	child_process.exec(terminalCommand, (error, stdout, stderr) => {
		if (error) {
			vscode.window.showErrorMessage(`Error opening terminal: ${stderr}`);
			output_color(`Error running the file. ${stderr} \n Potential Solution: Try manually running the following in to the terminal. (ctrl + \` to open) \n ${runCommand} \n.  `, "red")
		}
	});



}


module.exports = {
  activate,
  deactivate,
};

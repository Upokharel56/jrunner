// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below


const { run_in_external_terminal } = require("./utils/run_in_terminal");
const { parseCompilationErrors, highlightErrorsInEditor } = require("./utils/parse_compile_error");



/**
 * @param {vscode.ExtensionContext} context
 */


const vscode = require("vscode");
const child_process = require("child_process");
const fs = require("fs");
const path = require("path");


const {outputChannel} = require("./utils/outputChannel");


// ANSI escape codes for colors
const colors = {
    red: '[Error] ',
    green: '[Sucess] ',
    blue: '[Info] ',  
};

function output_color(message,color){
	outputChannel.appendLine(`${colors[color]}${message} \n`);
}


function pre_check( editor){
    const document = editor.document;

	if (document && document.isDirty){
		document.save();
	}


    if (document.languageId !== "java") {
		message = "This command is for Java files only!"
		output_color(message,"red")
      vscode.window.showErrorMessage(message);
      
      throw new Error("This command is for Java files only!");
    }

    const filePath = document.fileName;
	const className = path.basename(filePath, ".java");

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
		message = "No workspace folder is open."
		output_color(message,"red")
      vscode.window.showErrorMessage(message);
      throw new Error("No workspace folder is open.");
    }

    const projectRoot = workspaceFolders[0].uri.fsPath;

	// Ensure .output directory exists
	let outputDir = path.join(projectRoot, ".output");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    return {filePath, className, outputDir, document};



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

    let filePath, className, outputDir, document;
    try{

         ({filePath, className, outputDir, document} = pre_check(editor));
    }catch(error){
        output_color(error.message,"red")
        return;
    }



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


      const runCommand = `java -cp "${outputDir}" "${className}"`;


	  console.log(`Generated information : \n 
		Filename : ${document.fileName}, 
		classNamee : ${className},
		compilleCommand: ${compileCommand}, 
		runCommand: ${runCommand}
		`)
		
		run_in_external_terminal(runCommand)

    });
  });

  context.subscriptions.push(runButton);
  context.subscriptions.push(runJava);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};

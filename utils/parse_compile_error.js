const vscode = require("vscode");
const child_process = require("child_process");
const fs = require("fs");
const path = require("path");

let decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 0, 0, 0.3)', // Red background
    isWholeLine: true,
});


const errorRegex = /(.*?):(\d+): error: (.*)/g;


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

module.exports = { parseCompilationErrors, highlightErrorsInEditor };
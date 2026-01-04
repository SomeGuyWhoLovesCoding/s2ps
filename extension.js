const vscode = require('vscode');
const fs = require('fs').promises;
const path = require('path');

const characterCache = new Map();
let diagnosticTimeout = null;
const watchedProjections = new Map();

function activate(context) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('s2ps');
    context.subscriptions.push(diagnosticCollection);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('s2ps.acceptCorrection', (range, replacement) => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                editor.edit(editBuilder => {
                    editBuilder.replace(range, replacement);
                });
            }
        })
    );

    // Command to accept quick fix at cursor position
    context.subscriptions.push(
        vscode.commands.registerCommand('s2ps.acceptQuickFixAtCursor', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 's2ps') {
                return;
            }

            const position = editor.selection.active;
            const uri = editor.document.uri;
            const diagnostics = diagnosticCollection.get(uri) || [];

            for (const diagnostic of diagnostics) {
                if (diagnostic.range.contains(position) && 
                    diagnostic.code && 
                    typeof diagnostic.code === 'string' && 
                    diagnostic.code.startsWith('s2ps:fix:')) {
                    
                    const suggestion = diagnostic.code.substring(9);
                    await editor.edit(editBuilder => {
                        editBuilder.replace(diagnostic.range, suggestion);
                    });
                    return;
                }
            }

            const line = editor.document.lineAt(position.line);
            for (const diagnostic of diagnostics) {
                if (diagnostic.range.start.line === position.line &&
                    diagnostic.code && 
                    typeof diagnostic.code === 'string' && 
                    diagnostic.code.startsWith('s2ps:fix:')) {
                    
                    const suggestion = diagnostic.code.substring(9);
                    await editor.edit(editBuilder => {
                        editBuilder.replace(diagnostic.range, suggestion);
                    });
                    return;
                }
            }

            await editor.edit(editBuilder => {
                editBuilder.insert(position, '\n');
            });
        })
    );

    // Command to accept quick fix or insert tab
    context.subscriptions.push(
        vscode.commands.registerCommand('s2ps.acceptQuickFixOrTab', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 's2ps') {
                await vscode.commands.executeCommand('tab');
                return;
            }

            const position = editor.selection.active;
            const uri = editor.document.uri;
            const diagnostics = diagnosticCollection.get(uri) || [];

            for (const diagnostic of diagnostics) {
                if (diagnostic.range.contains(position) && 
                    diagnostic.code && 
                    typeof diagnostic.code === 'string' && 
                    diagnostic.code.startsWith('s2ps:fix:')) {
                    
                    const suggestion = diagnostic.code.substring(9);
                    await editor.edit(editBuilder => {
                        editBuilder.replace(diagnostic.range, suggestion);
                    });
                    return;
                }
            }

            const line = editor.document.lineAt(position.line);
            for (const diagnostic of diagnostics) {
                if (diagnostic.range.start.line === position.line &&
                    diagnostic.code && 
                    typeof diagnostic.code === 'string' && 
                    diagnostic.code.startsWith('s2ps:fix:')) {
                    
                    const suggestion = diagnostic.code.substring(9);
                    await editor.edit(editBuilder => {
                        editBuilder.replace(diagnostic.range, suggestion);
                    });
                    return;
                }
            }

            await editor.edit(editBuilder => {
                editBuilder.insert(position, '\t');
            });
        })
    );

    // Update diagnostics when document changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.languageId === 's2ps') {
                if (diagnosticTimeout) {
                    clearTimeout(diagnosticTimeout);
                }
                
                diagnosticTimeout = setTimeout(() => {
                    updateDiagnostics(e.document, diagnosticCollection);
                }, 100);
            }
        })
    );

    // Update diagnostics when document is opened
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(doc => {
            if (doc.languageId === 's2ps') {
                updateDiagnostics(doc, diagnosticCollection);
            }
        })
    );

    // Watch for changes in projection files
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(doc => {
            for (const [mainUri, projectionPath] of watchedProjections) {
                if (doc.uri.fsPath === projectionPath) {
                    const mainDoc = vscode.workspace.textDocuments.find(d => d.uri.toString() === mainUri);
                    if (mainDoc && mainDoc.languageId === 's2ps') {
                        updateDiagnostics(mainDoc, diagnosticCollection);
                    }
                }
            }
        })
    );

    // Register code action provider for quick fixes
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('s2ps', new CharacterCorrectionProvider(), {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        })
    );

    // Register completion provider
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider('s2ps', new CharacterCompletionProvider(), '(', '\n')
    );
}

async function loadCharacterProjection(projectionPath, mainDocumentUri) {
    try {
        const content = await fs.readFile(projectionPath, 'utf8');
        const lines = content.split('\n');
        const characters = new Set();
        const projectionNameToId = new Map();
        const projectionIdToName = new Map();
        
        watchedProjections.set(mainDocumentUri.toString(), projectionPath);
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('@char ')) {
                const match = trimmed.match(/@char\s+(?:"([^"]+)"|([^\s=]+))\s*=\s*(\S+)/);
                if (match) {
                    const charName = match[1] || match[2];
                    const charId = match[3];
                    
                    // Skip UUIDs
                    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    if (uuidPattern.test(charId)) {
                        continue;
                    }
                    
                    // Skip if ID looks like a hash
                    if (charId.length > 20 || /^[0-9a-f]{16,}$/i.test(charId)) {
                        continue;
                    }
                    
                    projectionNameToId.set(charName, charId);
                    projectionIdToName.set(charId, charName);
                    
                    characters.add(charName);
                    characters.add(charId);
                    
                    if (charName.includes(' ')) {
                        characters.add(charName.split(' ')[0]);
                    }
                    
                    if (charName.includes('-')) {
                        characters.add(charName.replace(/-/g, ''));
                        characters.add(charName.split('-')[0]);
                    }
                }
            }
        }
        
        return { 
            characters, 
            projectionNameToId, 
            projectionIdToName 
        };
    } catch (error) {
        console.error(`Error loading character projection from ${projectionPath}:`, error);
        return { 
            characters: new Set(), 
            projectionNameToId: new Map(), 
            projectionIdToName: new Map() 
        };
    }
}

function parseDialogueLine(text) {
    if (text.includes('// nofix')) {
        return null;
    }
    
    const match = text.match(/^(\s*)((?:"[^"]+"|[^(\s]+))\((\w[^)]*)\)/);
    if (!match) return null;
    
    return {
        indent: match[1],
        character: match[2].replace(/"/g, ''),
        expression: match[3]
    };
}

const MAX_LINE_COUNT = 100;

function findCharIdPosition(lineText, charName, charId) {
    const nameIndex = lineText.indexOf(charName);
    if (nameIndex === -1) return null;
    
    const equalsIndex = lineText.indexOf('=', nameIndex + charName.length);
    if (equalsIndex === -1) return null;
    
    const idIndex = lineText.indexOf(charId, equalsIndex + 1);
    if (idIndex === -1) return null;
    
    return {
        start: idIndex,
        end: idIndex + charId.length
    };
}

async function updateDiagnostics(document, collection) {
    if (diagnosticTimeout) {
        clearTimeout(diagnosticTimeout);
        diagnosticTimeout = null;
    }
    
    const diagnostics = [];
    const definedCharacters = new Set();
    const projectionNameToId = new Map();
    const projectionIdToName = new Map();
    const documentDir = path.dirname(document.uri.fsPath);
    
    const editor = vscode.window.activeTextEditor;
    let startLine = 0;
    let endLine = document.lineCount;
    
    if (document.lineCount > MAX_LINE_COUNT && editor && editor.document.uri === document.uri) {
        const visibleRange = editor.visibleRanges[0];
        if (visibleRange) {
            startLine = Math.max(0, visibleRange.start.line - 50);
            endLine = Math.min(document.lineCount, visibleRange.end.line + 50);
        }
    }
    
    const cacheKey = document.uri.toString();
    characterCache.delete(cacheKey);
    
    const projectionPromises = [];
    const charCommands = [];
    
    // Load all projections first
    for (let i = startLine; i < endLine; i++) {
        const line = document.lineAt(i);
        const text = line.text.trim();
        
        if (text.startsWith('@chrpjtl ')) {
            const projectionFile = text.substring(9).trim();
            const projectionPath = path.isAbsolute(projectionFile) 
                ? projectionFile 
                : path.join(documentDir, projectionFile);
            
            projectionPromises.push(
                loadCharacterProjection(projectionPath, document.uri).then(({ characters, projectionNameToId: nameToId, projectionIdToName: idToName }) => {
                    for (const char of characters) {
                        definedCharacters.add(char);
                    }
                    for (const [name, id] of nameToId) {
                        projectionNameToId.set(name, id);
                    }
                    for (const [id, name] of idToName) {
                        projectionIdToName.set(id, name);
                    }
                })
            );
        }
    }
    
    await Promise.all(projectionPromises);
    
    // Collect @char commands from script
    for (let i = startLine; i < endLine; i++) {
        const line = document.lineAt(i);
        const text = line.text.trim();
        
        if (text.startsWith('@char ')) {
            const match = text.match(/@char\s+(?:"([^"]+)"|([^\s=]+))\s*=\s*(\S+)/);
            if (match) {
                const charName = match[1] || match[2];
                const charId = match[3];
                definedCharacters.add(charName);
                definedCharacters.add(charId);
                
                charCommands.push({
                    line: i,
                    charName: charName,
                    charId: charId,
                    lineText: line.text
                });
                
                if (charName.includes(' ')) {
                    definedCharacters.add(charName.split(' ')[0]);
                }
                if (charName.includes('-')) {
                    definedCharacters.add(charName.replace(/-/g, ''));
                    definedCharacters.add(charName.split('-')[0]);
                }
            }
        }
    }
    
    // SIMPLIFIED: Check @char commands for autocorrection
    // Look for IDs that are similar to projection character names
    for (const cmd of charCommands) {
        let suggestion = null;
        let reason = "";
        
        // Get all projection character names
        const projectionNames = Array.from(projectionNameToId.keys());
        
        // SPECIAL CASE: If ID ends with "older" and there's a similar name in projection
        // This handles "Bellolder" -> "Belloolder" case
        if (cmd.charId.endsWith('older')) {
            const baseName = cmd.charId.slice(0, -5); // Remove "older"
            
            // Look for projection names that start with the same base
            for (const projName of projectionNames) {
                if (projName.startsWith(baseName) && projName !== cmd.charId) {
                    suggestion = projectionNameToId.get(projName);
                    reason = `Character ID "${cmd.charId}" similar to projection character "${projName}"`;
                    break;
                }
            }
        }
        
        // If no special case found, try fuzzy matching
        if (!suggestion) {
            const bestMatch = findBestCharacterMatch(cmd.charId, projectionNames);
            
            if (bestMatch && isReasonableMatch(cmd.charId, bestMatch)) {
                suggestion = projectionNameToId.get(bestMatch);
                reason = `Character ID "${cmd.charId}" similar to projection character "${bestMatch}"`;
            }
        }
        
        // Also check if character name has a direct mapping
        if (!suggestion && projectionNameToId.has(cmd.charName)) {
            const projectionId = projectionNameToId.get(cmd.charName);
            if (projectionId !== cmd.charId) {
                suggestion = projectionId;
                reason = `Character ID "${cmd.charId}" doesn't match projection`;
            }
        }
        
        // Create diagnostic if we have a suggestion
        if (suggestion) {
            const idPos = findCharIdPosition(cmd.lineText, cmd.charName, cmd.charId);
            if (idPos) {
                const range = new vscode.Range(cmd.line, idPos.start, cmd.line, idPos.end);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `${reason}. Use "${suggestion}"?`,
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.code = `s2ps:fix:${suggestion}`;
                diagnostics.push(diagnostic);
            }
        }
    }
    
    // Update cache
    characterCache.set(cacheKey, { 
        characters: new Set(definedCharacters),
        projectionNameToId: new Map(projectionNameToId),
        projectionIdToName: new Map(projectionIdToName)
    });
    
    // Check dialogue lines
    for (let i = startLine; i < endLine; i++) {
        const line = document.lineAt(i);
        const text = line.text;
        
        if (text.includes('// nofix')) {
            continue;
        }
        
        const dialogue = parseDialogueLine(text);
        if (dialogue) {
            const charName = dialogue.character;
            const charNameStart = dialogue.indent.length;
            const charNameEnd = charNameStart + charName.length;
            
            if (!definedCharacters.has(charName)) {
                let suggestion = null;
                
                // Try to match against projection IDs
                if (projectionIdToName.size > 0) {
                    const projectionIds = Array.from(projectionIdToName.keys());
                    const bestMatch = findBestCharacterMatch(charName, projectionIds);
                    if (bestMatch && isReasonableMatch(charName, bestMatch)) {
                        suggestion = bestMatch;
                    }
                }
                
                // Try to match against character names
                if (!suggestion && projectionNameToId.size > 0) {
                    const characterNames = Array.from(projectionNameToId.keys());
                    const bestMatch = findBestCharacterMatch(charName, characterNames);
                    if (bestMatch && projectionNameToId.has(bestMatch) && isReasonableMatch(charName, bestMatch)) {
                        suggestion = projectionNameToId.get(bestMatch);
                    }
                }
                
                // Fallback
                if (!suggestion) {
                    const bestMatch = findBestCharacterMatch(charName, Array.from(definedCharacters));
                    if (bestMatch && isReasonableMatch(charName, bestMatch)) {
                        suggestion = bestMatch;
                    }
                }
                
                if (suggestion) {
                    const range = new vscode.Range(i, charNameStart, i, charNameEnd);
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        `Unknown character "${charName}". Did you mean "${suggestion}"?`,
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.code = `s2ps:fix:${suggestion}`;
                    diagnostics.push(diagnostic);
                }
            }
        }
    }
    
    collection.set(document.uri, diagnostics);
}

// IMPROVED: Better matching for common patterns like "older" endings
function isReasonableMatch(input, match) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(match)) {
        return false;
    }
    
    if (/^[0-9a-f]{16,}$/i.test(match)) {
        return false;
    }
    
    // Special case for "older" endings
    if (input.endsWith('older') && match.endsWith('older')) {
        const inputBase = input.slice(0, -5);
        const matchBase = match.slice(0, -5);
        
        // If bases are similar, it's a good match
        if (inputBase.length >= 3 && matchBase.length >= 3) {
            const distance = damerauLevenshteinDistance(inputBase.toLowerCase(), matchBase.toLowerCase());
            const maxLen = Math.max(inputBase.length, matchBase.length);
            const score = distance / maxLen;
            
            // Allow more tolerance for "older" endings
            return score <= 0.4;
        }
    }
    
    if (input.length <= 4 && Math.abs(input.length - match.length) > 3) {
        return false;
    }
    
    if (input.length <= 8 && Math.abs(input.length - match.length) > 5) {
        return false;
    }
    
    return true;
}

function damerauLevenshteinDistance(a, b) {
    const lenA = a.length;
    const lenB = b.length;
    const INF = lenA + lenB;
    
    const score = Array(lenA + 2).fill(null).map(() => Array(lenB + 2).fill(0));
    
    score[0][0] = INF;
    for (let i = 0; i <= lenA; i++) {
        score[i + 1][1] = i;
        score[i + 1][0] = INF;
    }
    for (let j = 0; j <= lenB; j++) {
        score[1][j + 1] = j;
        score[0][j + 1] = INF;
    }
    
    const da = new Map();
    for (let i = 0; i < lenA; i++) da.set(a[i], 0);
    for (let j = 0; j <= lenB; j++) da.set(b[j], 0);
    
    for (let i = 1; i <= lenA; i++) {
        let db = 0;
        for (let j = 1; j <= lenB; j++) {
            const i1 = da.get(b[j - 1]) || 0;
            const j1 = db;
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            
            if (cost === 0) db = j;
            
            const substitution = score[i][j] + cost;
            const insertion = score[i + 1][j] + 1;
            const deletion = score[i][j + 1] + 1;
            let transposition = INF;
            
            if (i1 > 0 && j1 > 0) {
                transposition = score[i1][j1] + (i - i1 - 1) + 1 + (j - j1 - 1);
            }
            
            score[i + 1][j + 1] = Math.min(substitution, insertion, deletion, transposition);
        }
        da.set(a[i - 1], i);
    }
    
    return score[lenA + 1][lenB + 1];
}

// IMPROVED: Better threshold for "older" endings
function findBestCharacterMatch(inputName, characters) {
    if (characters.length === 0) return null;
    
    let bestMatch = null;
    let bestScore = Infinity;
    const inputLower = inputName.toLowerCase();
    
    // Exact case-insensitive match
    for (const charName of characters) {
        if (charName.toLowerCase() === inputLower) {
            return charName;
        }
    }
    
    // Special case for "older" endings
    if (inputLower.endsWith('older')) {
        const inputBase = inputLower.slice(0, -5);
        
        for (const charName of characters) {
            const charNameLower = charName.toLowerCase();
            if (charNameLower.endsWith('older')) {
                const charNameBase = charNameLower.slice(0, -5);
                
                // Compare just the bases
                const distance = damerauLevenshteinDistance(inputBase, charNameBase);
                const maxLen = Math.max(inputBase.length, charNameBase.length);
                
                if (maxLen === 0) continue;
                
                const score = distance / maxLen;
                
                // More lenient threshold for "older" endings
                if (score < bestScore && score <= 0.4) {
                    bestScore = score;
                    bestMatch = charName;
                }
            }
        }
        
        if (bestMatch) {
            return bestMatch;
        }
    }
    
    // Regular fuzzy matching for other cases
    for (const charName of characters) {
        const charNameLower = charName.toLowerCase();
        const distance = damerauLevenshteinDistance(inputLower, charNameLower);
        const maxLen = Math.max(inputName.length, charName.length);
        
        if (inputName.length <= 3 && Math.abs(inputName.length - charName.length) > 1) {
            continue;
        }
        
        const normalizedScore = distance / maxLen;
        const lengthDiff = Math.abs(inputName.length - charName.length);
        const lengthPenalty = lengthDiff / maxLen;
        const finalScore = normalizedScore * 0.7 + lengthPenalty * 0.3;
        
        if (finalScore < bestScore) {
            bestScore = finalScore;
            bestMatch = charName;
        }
    }
    
    let threshold;
    if (inputName.length <= 3) {
        threshold = 0.4;
    } else if (inputName.length <= 6) {
        threshold = 0.3;
    } else {
        threshold = 0.25;
    }
    
    if (inputName.length === 1) {
        threshold = 0.2;
    }
    
    return (bestScore <= threshold) ? bestMatch : null;
}

class CharacterCorrectionProvider {
    provideCodeActions(document, range, context) {
        const actions = [];
        
        for (const diagnostic of context.diagnostics) {
            if (diagnostic.code && typeof diagnostic.code === 'string' && diagnostic.code.startsWith('s2ps:fix:')) {
                const suggestion = diagnostic.code.substring(9);
                
                const action = new vscode.CodeAction(
                    `Change to "${suggestion}"`,
                    vscode.CodeActionKind.QuickFix
                );
                action.edit = new vscode.WorkspaceEdit();
                action.edit.replace(document.uri, diagnostic.range, suggestion);
                action.diagnostics = [diagnostic];
                action.isPreferred = true;
                
                action.command = {
                    title: 'Accept with Enter',
                    command: 's2ps.acceptQuickFixAtCursor',
                    tooltip: 'Press Enter to accept this correction'
                };
                
                actions.push(action);
            }
        }
        
        return actions;
    }
}

class CharacterCompletionProvider {
    provideCompletionItems(document, position, token, context) {
        const line = document.lineAt(position.line);
        const text = line.text.substring(0, position.character);
        
        const charMatch = text.match(/^(\s*)([\w-]*)$/);
        if (charMatch) {
            return [];
        }
        
        return [];
    }
}

function deactivate() {
    if (diagnosticTimeout) {
        clearTimeout(diagnosticTimeout);
    }
    characterCache.clear();
    watchedProjections.clear();
}

module.exports = {
    activate,
    deactivate
};
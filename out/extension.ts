import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('s2ps');
    context.subscriptions.push(diagnosticCollection);

    // Update diagnostics when document changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.languageId === 's2ps') {
                updateDiagnostics(e.document, diagnosticCollection);
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

    // Register code action provider for quick fixes
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('s2ps', new CharacterCorrectionProvider(), {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        })
    );
}

function updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection) {
    const diagnostics: vscode.Diagnostic[] = [];
    const definedCharacters = new Set<string>();
    
    // First pass: collect all @char definitions
    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const text = line.text.trim();
        
        if (text.startsWith('@char ')) {
            const match = text.match(/@char\s+(\w+)\s*=\s*(\w+)/);
            if (match) {
                definedCharacters.add(match[1]); // Character name
                definedCharacters.add(match[2]); // Character ID
            }
        }
    }
    
    // Second pass: check Character(expr) usage
    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const text = line.text.trim();
        
        const dialogueMatch = text.match(/^(\w+)\(([^)]+)\)$/);
        if (dialogueMatch) {
            const charName = dialogueMatch[1];
            
            if (!definedCharacters.has(charName)) {
                // Find best match
                const bestMatch = findBestCharacterMatch(charName, Array.from(definedCharacters));
                
                if (bestMatch) {
                    const range = new vscode.Range(
                        i, 
                        line.text.indexOf(charName), 
                        i, 
                        line.text.indexOf(charName) + charName.length
                    );
                    
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        `Unknown character "${charName}". Did you mean "${bestMatch}"?`,
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.code = { value: bestMatch, target: vscode.Uri.parse('s2ps:fix-character') };
                    diagnostics.push(diagnostic);
                }
            }
        }
    }
    
    collection.set(document.uri, diagnostics);
}

// Damerau-Levenshtein distance implementation
function damerauLevenshteinDistance(a: string, b: string): number {
    const lenA = a.length;
    const lenB = b.length;
    const INF = lenA + lenB;
    
    const score: number[][] = Array(lenA + 2).fill(null).map(() => Array(lenB + 2).fill(0));
    
    score[0][0] = INF;
    for (let i = 0; i <= lenA; i++) {
        score[i + 1][1] = i;
        score[i + 1][0] = INF;
    }
    for (let j = 0; j <= lenB; j++) {
        score[1][j + 1] = j;
        score[0][j + 1] = INF;
    }
    
    const da = new Map<string, number>();
    for (let i = 0; i < lenA; i++) da.set(a[i], 0);
    for (let j = 0; j < lenB; j++) da.set(b[j], 0);
    
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

function findBestCharacterMatch(inputName: string, characters: string[]): string | null {
    if (characters.length === 0) return null;
    
    let bestMatch: string | null = null;
    let bestScore = Infinity;
    const inputLower = inputName.toLowerCase();
    
    // Exact case-insensitive match
    for (const charName of characters) {
        if (charName.toLowerCase() === inputLower) {
            return charName;
        }
    }
    
    // Damerau-Levenshtein with normalization
    for (const charName of characters) {
        const distance = damerauLevenshteinDistance(inputLower, charName.toLowerCase());
        const maxLen = Math.max(inputName.length, charName.length);
        const normalizedScore = distance / maxLen;
        
        const lengthDiff = Math.abs(inputName.length - charName.length);
        const lengthPenalty = lengthDiff / maxLen;
        const finalScore = normalizedScore * 0.7 + lengthPenalty * 0.3;
        
        if (finalScore < bestScore) {
            bestScore = finalScore;
            bestMatch = charName;
        }
    }
    
    // Threshold based on length
    const threshold = inputName.length <= 3 ? 0.4 : inputName.length <= 6 ? 0.3 : 0.25;
    
    return (bestScore <= threshold) ? bestMatch : null;
}

class CharacterCorrectionProvider implements vscode.CodeActionProvider {
    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];
        
        for (const diagnostic of context.diagnostics) {
            if (diagnostic.code && typeof diagnostic.code === 'object') {
                const suggestion = diagnostic.code.value as string;
                const action = new vscode.CodeAction(
                    `Change to "${suggestion}"`,
                    vscode.CodeActionKind.QuickFix
                );
                action.edit = new vscode.WorkspaceEdit();
                action.edit.replace(document.uri, diagnostic.range, suggestion);
                action.diagnostics = [diagnostic];
                actions.push(action);
            }
        }
        
        return actions;
    }
}

export function deactivate() {}
# Script2Plot Syntax (s2ps) - Visual Studio Code Extension

A comprehensive syntax highlighter and autocorrector for Script2Plot (s2ps) screenwriting format, providing intelligent assistance for both character syntax and character dialogue syntax.

## Features

### Syntax Highlighting
- **Color-coded command types** for easy visual parsing:
  - **Title commands**: Yellow (`#FFFF00`)
  - **Character projection commands**: Cyan (`#00FFFF`)
  - **Scene commands**: Indigo (`#4B0082`)
  - **Sound commands**: Blue (`#0000FF`)
  - **Music commands**: Turquoise (`#40E0D0`)
  - **Character commands**: Gray (`#808080`)
  - **Action commands**: Dark red (`#AA0011`)
  - **Textplate commands**: Tan (`#D2B48C`)
- **Parameter highlighting**: Light blue (`#9CDCFE`)
- **Function syntax**: Purple (`#c7cdff`) for names, light gray (`#b5c2cf`) for arguments
- **Comments**: Green italic (`#6A9955`)

### Built-in Autocorrector
- **Character Syntax Autocorrection**: Automatically fixes common character syntax errors
- **Character Dialogue Syntax Autocorrection**: Intelligently corrects dialogue formatting issues
- **Real-time suggestions** as you type
- **Context-aware corrections** based on s2ps formatting rules

### Language Support
- Full support for `.s2ps` file extensions
- Language ID: `s2ps`
- Aliases: `Script2Plot`, `s2ps`

## Requirements
- Visual Studio Code version 1.60.0 or higher
- No additional dependencies required

## Extension Settings

This extension contributes the following syntax highlighting rules through `configurationDefaults`:

### Command Type Colors:
- `s2ps.command.title`: Title commands
- `s2ps.command.chprjtl`: Character projection commands
- `s2ps.command.scene`: Scene commands
- `s2ps.command.sound`: Sound commands
- `s2ps.command.music`: Music commands
- `s2ps.command.char`: Character commands
- `s2ps.command.action`: Action commands
- `s2ps.command.textplate`: Textplate commands

### Syntax Elements:
- `s2ps.parameter`: Command parameters
- `s2ps.function.name`: Function names
- `s2ps.function.argument`: Function arguments
- `comment.line.s2ps`: Line comments

## Using the Autocorrector

The autocorrector activates automatically when editing `.s2ps` files. It provides:

1. **Visual Indicators**:
   - Unknown characters are underlined with a yellow squiggly line
   - Hover to see: `Unknown character "Gooo". Did you mean "Goomo"?(s2ps:fix:Goomo)`

2. **Quick Fix Hotkeys** (when cursor is on/near the error):
   - **Enter**: Automatically apply the suggested correction
   - **Tab**: Also applies the suggested correction
   - Both keys insert normal newline/tab if no correction is available

3. **Traditional Methods**:
   - Press `Ctrl+.` (Windows/Linux) or `Cmd+.` (macOS) for Quick Fix menu
   - Click the lightbulb icon when hovering

4. **Intelligent Matching**:
   - Uses fuzzy matching to suggest corrections
   - Considers character definitions from `@char` and `@chprjtl` commands
   - Case-insensitive with smart distance calculations

The autocorrector runs in the background and provides suggestions through VS Code's suggestion interface. You can accept corrections by pressing `Tab` or `Enter` when suggestions appear.

*The type of autocorrector is similar but better than the claude.ai version made with react.js I've eventually scrapped.

## Release Notes

### 0.0.1
Initial release of Script2Plot Syntax extension featuring:
- Complete syntax highlighting for all s2ps command types
- Built-in autocorrector for character syntax
- Built-in autocorrector for character dialogue syntax
- Color-coded visual differentiation of script elements
- Support for `.s2ps` file extensions

## Working with s2ps Files

1. Create a new file with `.s2ps` extension
2. Start typing your script - syntax highlighting will activate immediately
3. Use s2ps commands (title, scene, char, action, etc.) - they will be automatically color-coded
4. The autocorrector will provide suggestions for character and dialogue syntax as you type

### Useful Editor Shortcuts:
- Split editor: `Cmd+\` (macOS) or `Ctrl+\` (Windows/Linux)
- Toggle suggestions: `Ctrl+Space` (all platforms)
- Accept suggestion: `Tab` or `Enter`

## For More Information

- [Visual Studio Code Extension API](https://code.visualstudio.com/api)
- [TextMate Grammar Syntax](https://macromates.com/manual/en/language_grammars)
- [Script2Plot Documentation](https://script2plot.com/docs)

**Happy screenwriting with Script2Plot!**